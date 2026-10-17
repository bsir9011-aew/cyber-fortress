import type { SimulationState, TaskAction } from '../domain/simulation';
import { isAssetOnline } from '../simulation/access';
import { taskRejection, taskSpecs } from '../simulation/tasks';
import { integrityTaskTurns } from '../simulation/integrity';

/** Allowlist projection: no document truth, backup contents, compromise or plan. */
export function selectIntegrityView(state: SimulationState) {
  const i = state.integrity;
  const d = state.hidden.scenario.integrity;
  if (!i || !d) return null;
  const actions: TaskAction[] = [
    { type: 'inspect-documents' },
    { type: 'inspect-backups' },
    { type: 'reconcile-documents' },
    ...(
      [
        'examine-endpoint',
        'isolate-endpoint',
        'restrict-endpoint-writes',
        'reconnect-endpoint',
      ] as const
    ).map((type) => ({ type, endpointId: i.endpoint.id })),
    ...(i.backupInventoryMinute === null
      ? []
      : d.backups.flatMap((b) => [
          { type: 'verify-backup' as const, backupId: b.id },
          { type: 'restore-documents' as const, backupId: b.id },
        ])),
  ];
  return {
    endpoint: {
      id: i.endpoint.id,
      assetId: i.endpoint.assetId,
      accountId: i.endpoint.accountId,
      isolated: i.endpoint.isolated,
      writesRestricted: i.endpoint.writesRestricted,
      businessCapacity: i.endpoint.businessCapacity,
    },
    datasetAssetId: d.datasetAssetId,
    documentedTotal: d.documentIds.length,
    fsOnline: isAssetOnline(state.world, d.datasetAssetId),
    observations: i.observations,
    endpointObservations: i.endpointObservations,
    backupInventoryMinute: i.backupInventoryMinute,
    backups:
      i.backupInventoryMinute === null
        ? []
        : d.backups.map((b) => ({
            id: b.id,
            minute: b.minute,
            count: b.documentIds.length,
            available: b.available,
            restoreTurns: b.restoreTurns,
            verification: i.backups.find((v) => v.id === b.id)!.verification,
            verifiedAtMinute: i.backups.find((v) => v.id === b.id)!
              .verifiedAtMinute,
            rpoMinutes: state.clock.startMinute - b.minute,
          })),
    hypothesis: i.hypothesis,
    actions: actions.map((action) => ({
      action,
      workerId: taskSpecs[action.type].workerId,
      turns: integrityTaskTurns(state, action) ?? taskSpecs[action.type].turns,
      rejection:
        state.clock.turn >= state.clock.turnLimit
          ? ('simulation-finished' as const)
          : taskRejection(state, taskSpecs[action.type].workerId, action),
    })),
  };
}
export type IntegrityView = NonNullable<ReturnType<typeof selectIntegrityView>>;
