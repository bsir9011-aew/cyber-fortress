import type {
  SimulationState,
  ProcessAvailability,
} from '../domain/simulation';
import { isAssetOnline, networkAllows, canUseService } from './access';
import { currentMinute } from './clock';
export function assessErpAvailability(state: SimulationState) {
  const r = state.recovery,
    d = state.hidden.scenario.recovery;
  if (!r || !d) throw new Error('Not a recovery mission');
  const data = r[r.activeInstance],
    primary = r.activeInstance === 'primary',
    target = primary ? 'erp' : 'erp-standby';
  const host = isAssetOnline(state.world, target);
  const storage = isAssetOnline(
    state.world,
    primary ? 'erp-storage' : 'standby-storage',
  );
  const database = primary ? isAssetOnline(state.world, 'erp-db') : host;
  const connection = (
    sourceAssetId: string,
    targetAssetId: string,
    protocol: string,
  ) =>
    networkAllows(state.world, state.access, {
      sourceAssetId,
      targetAssetId,
      protocol,
    });
  const databasePath = primary
    ? connection('erp', 'erp-db', 'SQL') &&
      connection('erp-db', 'erp-storage', 'BLOCK')
    : connection('erp-standby', 'standby-storage', 'BLOCK');
  const consistent = data.corruptRecordIds.length === 0;
  const localPath =
    state.access.accounts.some((a) => a.id === 'erp-warehouse') &&
    state.access.permissions.some(
      (p) =>
        p.accountId === 'erp-warehouse' &&
        p.targetAssetId === target &&
        p.protocol === 'HTTPS',
    ) &&
    networkAllows(state.world, state.access, {
      sourceAssetId: state.process.workstationAssetId,
      targetAssetId: target,
      protocol: 'HTTPS',
      accountId: 'erp-warehouse',
    });
  const remotePath = state.access.sessions.some(
    (s) =>
      s.accountId === state.process.remoteAccountId &&
      canUseService(
        state.world,
        state.access,
        s.id,
        target,
        'HTTPS',
        currentMinute(state.clock),
      ),
  );
  const functional =
    host &&
    data.processRunning &&
    database &&
    storage &&
    databasePath &&
    consistent;
  const missingRecordIds = d.records
    .filter((v) => !data.recordIds.includes(v.id))
    .map((v) => v.id);
  const coverage =
    (d.records.length - missingRecordIds.length) / d.records.length;
  const localAvailable = functional && localPath,
    remoteAvailable = functional && remotePath;
  const capacity =
    (localAvailable ? Math.floor(state.process.localCapacity * coverage) : 0) +
    (remoteAvailable ? Math.floor(state.process.remoteCapacity * coverage) : 0);
  return {
    instance: r.activeInstance,
    target,
    host,
    processRunning: data.processRunning,
    database,
    storage,
    databasePath,
    consistent,
    localPath,
    remotePath,
    localAvailable,
    remoteAvailable,
    capacity,
    useful: capacity > 0,
    missingRecordIds,
    corruptRecordIds: data.corruptRecordIds,
    recoveryPointMinute: data.recoveryPointMinute,
    backupId: data.backupId,
  };
}
export function pendingErpOrderIds(state: SimulationState): readonly string[] {
  const r = state.recovery;
  return r
    ? r.orders
        .filter(
          (o) =>
            o.fulfilledBy !== null &&
            !r[r.activeInstance].postedOrderIds.includes(o.id),
        )
        .map((o) => o.id)
    : [];
}
export function manualEligible(state: SimulationState): readonly string[] {
  const r = state.recovery,
    d = state.hidden.scenario.recovery;
  if (!r || !d || !isAssetOnline(state.world, d.reconciliationSource.assetId))
    return [];
  const orders = [
    ...r.orders,
    ...Array.from(
      {
        length:
          state.clock.turn < state.clock.turnLimit
            ? state.process.ordersPerTurn
            : 0,
      },
      (_, i) => ({
        id: `ORD-${String(r.orders.length + i + 1).padStart(3, '0')}`,
        fulfilledBy: null,
      }),
    ),
  ];
  return orders
    .filter(
      (o) =>
        o.fulfilledBy === null &&
        Number(o.id.slice(4)) <= d.manualManifestLimit,
    )
    .map((o) => o.id);
}
/** The sole projection used by both settlement and reporting. Manual and ERP are exclusive. */
export function recoveryBusinessAvailability(
  state: SimulationState,
): ProcessAvailability {
  const a = assessErpAvailability(state),
    r = state.recovery!;
  const capacity = r.manualActive
    ? Math.min(10, manualEligible(state).length)
    : a.capacity;
  return {
    capacity,
    localAvailable: r.manualActive ? capacity > 0 : a.localAvailable,
    remoteAvailable: r.manualActive ? false : a.remoteAvailable,
    status:
      capacity === 0
        ? 'unavailable'
        : capacity === 22
          ? 'available'
          : 'degraded',
    contributions: [
      {
        id: r.manualActive ? 'manual-shipping' : a.target,
        name: r.manualActive
          ? 'Ręczne manifesty — zamiast ERP'
          : 'ERP — sprawna usługa i poprawne dane',
        available: capacity > 0,
        capacity,
      },
    ],
  };
}
