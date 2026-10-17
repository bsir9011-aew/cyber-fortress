import type { RecoveryTaskAction } from '../domain/recovery';
import { taskSpecs, taskRejection } from '../simulation/tasks';
import { recoveryTaskSpecs, recoveryTaskTurns } from '../simulation/recovery';
import type { SimulationState } from '../domain/simulation';
import { pendingErpOrderIds } from '../simulation/recoveryAccess';
/** Observation snapshots only: no cause, private datasets or live storage flags. */
export function selectRecoveryView(state: SimulationState) {
  const r = state.recovery;
  if (!r) return null;
  const knownBackups = new Map<
    string,
    (typeof r.observations)[number]['backups'][number]
  >();
  for (const b of r.observations.flatMap((o) => o.backups)) {
    const earlier = knownBackups.get(b.id);
    knownBackups.set(b.id, {
      ...b,
      verified: b.verified ?? earlier?.verified ?? null,
    });
  }
  const backups = [...knownBackups.values()];
  const actions: RecoveryTaskAction[] = (
    Object.keys(recoveryTaskSpecs) as RecoveryTaskAction['type'][]
  ).flatMap((type) =>
    type === 'verify-erp-backup' || type === 'restore-erp-backup'
      ? backups.map((b) => ({ type, backupId: b.id }))
      : [{ type } as RecoveryTaskAction],
  );
  return {
    actions: actions.map((action) => ({
      action,
      workerId: taskSpecs[action.type].workerId,
      turns: recoveryTaskTurns(state, action) ?? taskSpecs[action.type].turns,
      rejection: taskRejection(state, taskSpecs[action.type].workerId, action),
    })),
    activeInstance: r.activeInstance,
    manualActive: r.manualActive,
    observations: r.observations,
    results: r.results,
    backups,
    manualProcessed: r.orders.filter((o) => o.fulfilledBy === 'manual').length,
    pendingOrders: pendingErpOrderIds(state).length,
    confidence: r.verifiedRevision === r.revision,
    rtoMinutes: state.hidden.scenario.recovery!.rtoMinutes,
    rpoMinutes: state.hidden.scenario.recovery!.rpoMinutes,
  };
}
export function selectKnownRecoveryWorld(state: SimulationState) {
  if (!state.recovery) return state.world;
  const known = Object.assign(
    {},
    ...state.recovery.observations.map((o) => o.assetStatuses),
  ) as Record<string, 'online' | 'offline'>;
  const privateIds = [
    'erp',
    'erp-db',
    'erp-storage',
    'erp-backups',
    'erp-standby',
    'standby-storage',
  ];
  return {
    ...state.world,
    assets: state.world.assets.map((a) =>
      privateIds.includes(a.id)
        ? { ...a, status: known[a.id] ?? ('unknown' as const) }
        : a,
    ),
  };
}

export type RecoveryView = NonNullable<ReturnType<typeof selectRecoveryView>>;
