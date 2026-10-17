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
