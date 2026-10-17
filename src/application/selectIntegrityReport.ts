import { selectDetectionReview } from './selectDetectionReview';
import type { SimulationState } from '../domain/simulation';
import type { IntegrityMissionSummary } from '../domain/integrity';
import { isFinished } from '../simulation/clock';
import { canUseLocalService, isAssetOnline } from '../simulation/access';
import { businessAvailability } from '../simulation/business';
import { documentCounts } from '../simulation/integrity';

/** Private cause and current data are disclosed only after the last turn. */
export function selectIntegrityReport(state: SimulationState) {
  const i = state.integrity;
  const d = state.hidden.scenario.integrity;
  if (!i || !d || !isFinished(state.clock)) return null;
  const lastRecovery = i.recoveries.at(-1);
  const backup = d.backups.find((b) => b.id === lastRecovery?.backupId);
  const sourceHasWrite =
    state.hidden.integrityThreat?.compromised === true &&
    canUseLocalService(
      state.world,
      state.access,
      i.endpoint,
      d.datasetAssetId,
      'SMB',
      'modify',
    );
  const summary: IntegrityMissionSummary = {
    serviceOnline: isAssetOnline(state.world, d.datasetAssetId),
    dataAvailable:
      businessAvailability(state).contributions?.find(
        (c) => c.id === 'correct-documents',
      )?.available === true,
    ...documentCounts(i.documents),
    everDamaged: i.documents.filter((doc) => doc.everDamaged).length,
    sourceHasWrite,
    endpointIsolated: i.endpoint.isolated,
    writesRestricted: i.endpoint.writesRestricted,
    backupId: backup?.id ?? null,
    rpoMinutes: backup ? state.clock.startMinute - backup.minute : null,
    rtoMinutes:
      i.verifiedRecoveryMinute === null
        ? null
        : i.verifiedRecoveryMinute - state.clock.startMinute,
    missingChanges: lastRecovery?.missingDocuments ?? 0,
    reconstructed: i.reconciledIds.length,
    verified: i.verifiedRecoveryMinute !== null,
    limitedDataMinutes:
      state.history.filter(
        (e) =>
          e.kind === 'business-report' &&
          e.report.contributions?.some(
            (c) => c.id === 'correct-documents' && !c.available,
          ),
      ).length * state.clock.turnMinutes,
    peakBacklog: Math.max(
      0,
      ...state.history.flatMap((e) =>
        e.kind === 'business-report' ? [e.report.backlog] : [],
      ),
    ),
  };
  return {
    summary,
    detectionReview: selectDetectionReview(state),
    investments: {
      edr: state.telemetry.endpoint
        ? {
            coverage: state.telemetry.endpoint.coverage,
            capturedEvents: state.telemetry.endpoint.nextEventNumber - 1,
            deliveredEvents: state.telemetry.endpoint.records.length,
            alerts: state.telemetry.endpoint.alerts,
            observations: state.telemetry.endpoint.observations,
            informedActions: i.decisions.filter(
              (decision) =>
                decision.knownObservationIds.some((id) =>
                  state.telemetry.endpoint!.observations.some(
                    (o) =>
                      o.id === id &&
                      o.records.some(
                        (r) =>
                          r.operation === 'modify' && r.outcome === 'allowed',
                      ),
                  ),
                ) &&
                state.tasks.some(
                  (t) =>
                    t.id === decision.taskId &&
                    ['isolate-endpoint', 'restrict-endpoint-writes'].includes(
                      t.action.type,
                    ),
                ),
            ).length,
            firstEvidenceMinute:
              state.telemetry.endpoint.observations.find((o) =>
                o.records.some(
                  (r) => r.operation === 'modify' && r.outcome === 'allowed',
                ),
              )?.observedAtMinute ?? null,
          }
        : null,
      firstLocalEvidenceMinute:
        i.endpointObservations.find((o) =>
          o.records.some(
            (r) => r.operation === 'modify' && r.outcome === 'allowed',
          ),
        )?.minute ?? null,
      backup: state.hidden.scenario.backupReadiness ?? null,
      restoreMinutes: lastRecovery
        ? lastRecovery.completedAtMinute - lastRecovery.orderedAtMinute
        : null,
    },
    documents: i.documents,
    recoveries: i.recoveries,
    decisions: i.decisions.map((decision) => ({
      ...decision,
      knownEvidence: decision.knownObservationIds.map((id) => {
        const documents = i.observations.find((o) => o.id === id);
        if (documents)
          return {
            id,
            minute: documents.minute,
            source: 'Porównanie ERP / FS-01',
            summary: `${documents.correct} poprawnych, ${documents.damaged} uszkodzonych, ${documents.reconcile} do uzgodnienia; zakres ${documents.scope.length}.`,
          };
        const endpoint = i.endpointObservations.find((o) => o.id === id);
        if (endpoint)
          return {
            id,
            minute: endpoint.minute,
            source: 'Lokalny dziennik stacji',
            summary: `${endpoint.records.length} operacji; dopuszczone modify: ${endpoint.records.filter((r) => r.operation === 'modify' && r.outcome === 'allowed').length}.`,
          };
        const edr = state.telemetry.endpoint?.observations.find(
          (o) => o.id === id,
        );
        if (edr)
          return {
            id,
            minute: edr.observedAtMinute,
            source: 'Kolektor EDR / fortress-endpoint-agent',
            summary: `${edr.records.length} dostarczonych rekordów; zakres sensora ${edr.sensorId}, okno ${edr.windowStartMinute}–${edr.windowEndMinute}.`,
          };
        const file = state.knowledge.fileObservations?.find((o) => o.id === id);
        return {
          id,
          minute: file?.observedAtMinute ?? decision.orderedAtMinute,
          source: 'Audyt FS-01',
          summary: `${file?.records.length ?? 0} pozyskanych rekordów.`,
        };
      }),
    })),
    actions: state.tasks,
    observations: i.observations,
    threatHistory: state.hidden.integrityThreat?.history ?? [],
    compromised: state.hidden.integrityThreat?.compromised ?? false,
    explanation: state.hidden.scenario.explanation,
    business: state.business,
    goalMet:
      summary.correct === summary.total &&
      summary.dataAvailable &&
      summary.verified &&
      !summary.sourceHasWrite &&
      state.business.backlog <= state.process.maxFinalBacklog,
  };
}
