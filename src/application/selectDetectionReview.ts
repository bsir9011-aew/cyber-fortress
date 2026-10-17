import type { SimulationState } from '../domain/simulation';
import { isFinished } from '../simulation/clock';
import {
  availableEndpointRecords,
  endpointDetectionRecords,
  continuesEndpointSeries,
} from '../simulation/endpointTelemetry';
import type { EndpointTelemetry } from '../domain/resilience';

/** Reconstruct only membership of real alerts, never create retrospective alerts.
 * Walk the actual detector boundaries: later delivery cannot retroactively extend
 * a series at a boundary where the record was unavailable or outside its window.
 */
function detectedSeriesMembership(
  telemetry: EndpointTelemetry,
  state: SimulationState,
) {
  const membership = new Map<string, Set<string>>();
  const cursors = new Map<string, number>();
  const c = telemetry.coverage;
  if (!c.collectorAvailable) return membership;
  for (let turn = 0; turn <= state.clock.turn; turn++) {
    const minute = state.clock.startMinute + turn * state.clock.turnMinutes;
    const records = endpointDetectionRecords(
      availableEndpointRecords(telemetry, minute),
      c.detection,
      minute,
    );
    const alert = [...telemetry.alerts]
      .reverse()
      .find(
        (a) =>
          a.minute <= minute &&
          a.ruleId === c.detection.id &&
          a.endpointId === c.endpointId &&
          a.sensorId === c.sensorId,
      );
    if (!alert || !records.length) continue;
    const cursor =
      cursors.get(alert.id) ??
      Math.max(
        ...telemetry.records
          .filter((r) => alert.eventIds.includes(r.id))
          .map((r) => r.minute),
        alert.windowStartMinute,
      );
    if (!continuesEndpointSeries(records, cursor, c.detection.windowMinutes))
      continue;
    cursors.set(alert.id, Math.max(cursor, ...records.map((r) => r.minute)));
    for (const record of records) {
      if (alert.eventIds.includes(record.id)) continue;
      const series = membership.get(record.id) ?? new Set<string>();
      series.add(alert.id);
      membership.set(record.id, series);
    }
  }
  return membership;
}

/** Private classification is a debrief projection, never an input to the detector. */
export function selectDetectionReview(state: SimulationState) {
  const i = state.integrity,
    d = state.hidden.scenario.integrity;
  if (!i || !d || !isFinished(state.clock)) return null;
  const telemetry = state.telemetry.endpoint;
  const alerts = telemetry?.alerts ?? [];
  const seriesMembership = telemetry
    ? detectedSeriesMembership(telemetry, state)
    : new Map<string, Set<string>>();
  const endMinute =
    state.clock.startMinute + state.clock.turn * state.clock.turnMinutes;
  const operations = i.operationRecords.flatMap((r, index) => {
    if (r.operation !== 'modify') return [];
    const event = telemetry?.localEvents.find(
      (e) =>
        e.minute === r.minute &&
        e.operation === r.operation &&
        e.endpointId === r.endpointId &&
        e.accountId === r.accountId &&
        e.outcome === r.outcome &&
        e.documentIds.join(',') === r.documentIds.join(','),
    );
    const record = telemetry?.records.find((e) => e.id === event?.id);
    const alertIds = event
      ? alerts.filter((a) => a.eventIds.includes(event.id)).map((a) => a.id)
      : [];
    const detectedSeriesAlertIds = event
      ? [...(seriesMembership.get(event.id) ?? [])]
      : [];
    const detectionStatus =
      r.outcome !== 'allowed'
        ? ('operation-denied' as const)
        : alertIds.length
          ? ('alert-trigger' as const)
          : detectedSeriesAlertIds.length
            ? ('detected-series' as const)
            : !event
              ? ('outside-sensor-coverage' as const)
              : !record ||
                  record.availableAtMinute > endMinute ||
                  record.deliveredAtMinute > endMinute
                ? ('not-delivered-in-time' as const)
                : ('undetected' as const);
    return [
      {
        id: `LOCAL-${index + 1}`,
        ...r,
        classification: d.legitimateModifications
          ? ('legal' as const)
          : ('harmful' as const),
        eventId: event?.id ?? null,
        availableAtMinute: record?.availableAtMinute ?? null,
        alertIds,
        detectedSeriesAlertIds,
        detectionStatus,
        missedReason:
          detectionStatus === 'alert-trigger' ||
          detectionStatus === 'detected-series'
            ? null
            : detectionStatus === 'undetected'
              ? 'threshold-or-window-not-met'
              : detectionStatus === 'not-delivered-in-time'
                ? 'not-delivered-within-mission'
                : detectionStatus,
      },
    ];
  });
  const classifiedAlerts = alerts.map((a) => {
    const sourceOperations = operations.filter((o) =>
      o.alertIds.includes(a.id),
    );
    const harmful = sourceOperations.some(
      (o) => o.classification === 'harmful' && o.outcome === 'allowed',
    );
    const legal = sourceOperations.some(
      (o) => o.classification === 'legal' && o.outcome === 'allowed',
    );
    return {
      ...a,
      sourceOperationIds: sourceOperations.map((o) => o.id),
      continuationOperationIds: operations
        .filter((o) => o.detectedSeriesAlertIds.includes(a.id))
        .map((o) => o.id),
      classification:
        harmful && legal
          ? ('mixed' as const)
          : harmful
            ? ('harmful' as const)
            : legal
              ? ('legal' as const)
              : ('unresolved' as const),
    };
  });
  return {
    rule: telemetry?.coverage.detection ?? null,
    coverage: telemetry?.coverage ?? null,
    counting:
      telemetry?.coverage.detection.counting === 'unique-documents-v2'
        ? 'distinct-document-ids-in-sliding-window'
        : 'historical-sum-of-document-occurrences',
    alerts: classifiedAlerts,
    sourceOperations: operations,
    falsePositiveAlertIds: classifiedAlerts
      .filter((a) => a.classification === 'legal')
      .map((a) => a.id),
    truePositiveAlertIds: classifiedAlerts
      .filter(
        (a) => a.classification === 'harmful' || a.classification === 'mixed',
      )
      .map((a) => a.id),
    undetectedHarmfulOperationIds: operations
      .filter(
        (o) =>
          o.classification === 'harmful' &&
          o.outcome === 'allowed' &&
          o.detectionStatus === 'undetected',
      )
      .map((o) => o.id),
    detectedSeriesOperationIds: operations
      .filter((o) => o.detectionStatus === 'detected-series')
      .map((o) => o.id),
    outsideCoverageOperationIds: operations
      .filter((o) => o.detectionStatus === 'outside-sensor-coverage')
      .map((o) => o.id),
    notDeliveredInTimeOperationIds: operations
      .filter((o) => o.detectionStatus === 'not-delivered-in-time')
      .map((o) => o.id),
    evidenceObtained: [
      ...(telemetry?.observations ?? []).map((o) => ({
        id: o.id,
        source: 'edr',
        minute: o.observedAtMinute,
        recordCount: o.records.length,
      })),
      ...i.endpointObservations.map((o) => ({
        id: o.id,
        source: 'local-journal',
        minute: o.minute,
        recordCount: o.records.length,
      })),
      ...i.observations.map((o) => ({
        id: o.id,
        source: 'document-comparison',
        minute: o.minute,
        recordCount: o.scope.length,
      })),
    ].sort((a, b) => a.minute - b.minute),
    responses: i.decisions.flatMap((decision) => {
      const task = state.tasks.find((t) => t.id === decision.taskId);
      if (
        !task ||
        ![
          'isolate-endpoint',
          'restrict-endpoint-writes',
          'reconnect-endpoint',
        ].includes(task.action.type)
      )
        return [];
      const completed = decision.completedAtMinute;
      return [
        {
          taskId: task.id,
          action: task.action.type,
          orderedAtMinute: decision.orderedAtMinute,
          completedAtMinute: completed,
          availableAlertIds: alerts
            .filter((a) => a.minute <= decision.orderedAtMinute)
            .map((a) => a.id),
          knownObservationIds: decision.knownObservationIds,
          completionBoundary: decision.effect,
          subsequentHarmfulOperationsAllowed: operations.filter(
            (o) =>
              completed !== null &&
              o.minute >= completed &&
              o.classification === 'harmful' &&
              o.outcome === 'allowed',
          ).length,
          subsequentOperationsDenied: operations.filter(
            (o) =>
              completed !== null &&
              o.minute >= completed &&
              o.outcome === 'denied',
          ).length,
        },
      ];
    }),
    business: {
      processed: state.business.totalProcessed,
      backlog: state.business.backlog,
      reducedPackingTurns: state.history.filter(
        (e) =>
          e.kind === 'business-report' &&
          e.report.contributions?.some(
            (c) => c.id === 'packing-station' && !c.available,
          ),
      ).length,
    },
    limitation:
      'FP = alert dotyczący legalnej aktywności. FN obejmuje dostarczone na czas szkodliwe operacje, które nie wyzwoliły alertu ani nie należały do już wykrytej serii. Kontynuacje serii nie zmieniają historycznych rekordów wyzwalających alert. Brak pokrycia i niedostarczenie na czas pokazujemy osobno. To wynik tego przebiegu, nie uniwersalna skuteczność EDR. Dostępny alert nie dowodzi jego przeczytania. Następstwa obejmują inne przyczyny; raport nie ocenia racjonalności decyzji.',
  };
}
export type DetectionReview = NonNullable<
  ReturnType<typeof selectDetectionReview>
>;
