import type { SimulationState } from '../domain/simulation';
import { isFinished } from '../simulation/clock';
/** Private classification is a debrief projection, never an input to the detector. */
export function selectDetectionReview(state: SimulationState) {
  const i = state.integrity,
    d = state.hidden.scenario.integrity;
  if (!i || !d || !isFinished(state.clock)) return null;
  const telemetry = state.telemetry.endpoint;
  const alerts = telemetry?.alerts ?? [];
  const operations = i.operationRecords.flatMap((r, index) => {
    if (r.operation !== 'modify') return [];
    const event = telemetry?.localEvents.find(
      (e) =>
        e.minute === r.minute &&
        e.operation === r.operation &&
        e.endpointId === r.endpointId &&
        e.documentIds.join(',') === r.documentIds.join(','),
    );
    const record = telemetry?.records.find((e) => e.id === event?.id);
    const alertIds = event
      ? alerts.filter((a) => a.eventIds.includes(event.id)).map((a) => a.id)
      : [];
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
        missedReason:
          r.outcome !== 'allowed'
            ? 'operation-denied'
            : alertIds.length
              ? null
              : !event
                ? 'outside-sensor-coverage'
                : !record ||
                    record.availableAtMinute >
                      state.clock.startMinute +
                        state.clock.turnLimit * state.clock.turnMinutes
                  ? 'not-delivered-within-mission'
                  : 'threshold-or-window-not-met',
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
          !o.alertIds.length,
      )
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
      'FP = alert dotyczący legalnej aktywności. Niewykryte szkodliwe operacje są liczone osobno, z przyczyną braku sygnału (również brak pokrycia/opóźnienie). To wynik tego przebiegu, nie uniwersalna skuteczność EDR. Dostępny alert nie dowodzi jego przeczytania. Następstwa obejmują inne przyczyny; raport nie ocenia racjonalności decyzji.',
  };
}
export type DetectionReview = NonNullable<
  ReturnType<typeof selectDetectionReview>
>;
