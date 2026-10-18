import type { SimulationState } from '../domain/simulation';
import {
  assessBranchAccess,
  branchWorkAvailability,
} from '../simulation/branchAccess';
import { isFinished } from '../simulation/clock';
export function branchOutcome(s: SimulationState) {
  const b = s.branch!,
    d = s.hidden.scenario.branch!,
    availability = branchWorkAvailability(s);
  const exposedRecords = b.operations.reduce(
    (n, o) => n + (o.origin === 'unauthorized' ? (o.recordsRead ?? 0) : 0),
    0,
  );
  const remainingAccess =
    d.compromisedContextId !== null &&
    assessBranchAccess(s, d.compromisedContextId, 'fs-01', 'SMB').allowed;
  return {
    ready: availability.ready,
    exposedRecords,
    remainingAccess,
    goalMet:
      availability.ready &&
      s.business.backlog <= s.process.maxFinalBacklog &&
      exposedRecords === 0 &&
      !remainingAccess,
  };
}
export function selectBranchReport(s: SimulationState) {
  const b = s.branch,
    d = s.hidden.scenario.branch;
  if (!b || !d || !isFinished(s.clock)) return null;
  const outcome = branchOutcome(s);
  const routes = (['primary', 'backup'] as const).map((route) => ({
    route,
    checks: b.contexts.flatMap((c) => [
      {
        contextId: c.id,
        accountId: c.accountId,
        target: 'erp',
        protocol: 'HTTPS',
        ...assessBranchAccess(s, c.id, 'erp', 'HTTPS', route),
      },
      {
        contextId: c.id,
        accountId: c.accountId,
        target: 'fs-01',
        protocol: 'SMB',
        ...assessBranchAccess(s, c.id, 'fs-01', 'SMB', route),
      },
    ]),
  }));
  const need = d.requiresDocuments;
  const unnecessaryFileAccess = b.contexts
    .filter(
      (c) =>
        assessBranchAccess(s, c.id, 'fs-01', 'SMB').allowed &&
        (!need || !d.documentAccountIds.includes(c.accountId)),
    )
    .map((c) => c.accountId);
  return {
    ...outcome,
    kind: d.kind,
    explanation: s.hidden.scenario.explanation,
    initialArchitecture: d.architecture,
    finalArchitecture: b.architecture,
    activeRoute: b.activeRoute,
    requiresDocuments: need,
    documentDemandFromMinute:
      s.clock.startMinute + d.documentsFromTurn * s.clock.turnMinutes,
    routes,
    contexts: b.contexts,
    operations: b.operations,
    observations: b.observations,
    tasks: b.results,
    events: b.events,
    transitions: b.transitions,
    business: s.business,
    unnecessaryFileAccess,
    unnecessaryExposureIntervals: b.transitions
      .filter(
        (t) =>
          t.minute <
          s.clock.startMinute + s.clock.turnLimit * s.clock.turnMinutes,
      )
      .flatMap((t) => {
        const accountIds = t.fileAccessAccountIds.filter(
          (id) => !need || !d.documentAccountIds.includes(id),
        );
        return accountIds.length
          ? [
              {
                startMinute: t.minute,
                endMinute: t.minute + s.clock.turnMinutes,
                accountIds,
              },
            ]
          : [];
      }),
    backupUse: {
      prepared: d.architecture.backupPrepared,
      activeIntervals: b.transitions.filter(
        (t) =>
          t.route === 'backup' &&
          t.minute <
            s.clock.startMinute + s.clock.turnLimit * s.clock.turnMinutes,
      ).length,
      forwardedOperations: b.operations.filter(
        (o) => o.checks.route === 'backup' && o.checks.reachedService,
      ).length,
    },
    unusedCapabilities: [
      ...(d.architecture.backupPrepared &&
      !b.transitions.some((t) => t.route === 'backup')
        ? ['Przygotowana trasa zapasowa nie została aktywowana.']
        : []),
      ...(d.architecture.monitoring &&
      !b.observations.some((o) => o.source === 'EAST gateway metadata')
        ? ['Monitoring był wdrożony, ale nie pobrano jego obserwacji.']
        : []),
    ],
    limitations: [
      'Metadane bramy pokazują przekazanie przepływu, nie zawartość transmisji ani zgodę serwera na odczyt.',
      'Brak odczytu nie dowodzi trwałego odcięcia; remainingAccess ocenia aktualną drogę przejętego kontekstu.',
      'Nie obliczono alternatywnych przebiegów ani strat zamówień w PLN.',
    ],
  };
}
export type BranchReport = NonNullable<ReturnType<typeof selectBranchReport>>;
