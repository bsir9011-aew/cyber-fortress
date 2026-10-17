import type { SimulationState } from '../domain/simulation';
import type { VendorOperation } from '../domain/vendor';
import { currentMinute } from './clock';
import {
  isAssetOnline,
  isSessionActive,
  networkAllows,
  vendorExceptionAllows,
} from './access';
/** Shared resolver instrumentation: public monitor facts never contain actor origin. */
export function recordVendorOperation(
  state: SimulationState,
  sessionId: string,
  targetAssetId: string,
  protocol: 'HTTPS' | 'SMB',
  operation: VendorOperation['operation'],
  recordsRead: number | null,
  allowed: boolean,
): SimulationState {
  const v = state.vendor;
  const session = state.access.sessions.find((s) => s.id === sessionId);
  const accountId = state.access.vendorAuthorization?.accountId;
  if (
    !v ||
    !session ||
    session.accountId !== accountId ||
    !isAssetOnline(state.world, state.access.vpnAssetId)
  )
    return state;
  const minute = currentMinute(state.clock);
  const flow = {
    sourceAssetId: session.gatewayAssetId,
    accountId,
    targetAssetId,
    protocol,
  };
  const supplierFlow = {
    sourceAssetId: 'cargo-link',
    targetAssetId: state.access.vpnAssetId,
    protocol: 'VPN',
    accountId,
  };
  const sourcePath = state.world.connections.some(
    (c) =>
      c.kind === 'network' &&
      c.sourceAssetId === 'cargo-link' &&
      c.targetAssetId === state.access.vpnAssetId &&
      c.protocol === 'VPN',
  );
  const record: VendorOperation = {
    id: `CARGO-OP-${v.operations.length + 1}`,
    minute,
    accountId,
    sessionId,
    targetAssetId,
    protocol,
    operation,
    outcome: allowed ? 'allowed' : 'denied',
    recordsRead: allowed ? recordsRead : null,
    source: 'nexus-vpn-access-monitor',
    accessChecks: {
      topologyExists:
        sourcePath &&
        state.world.connections.some(
          (c) =>
            c.kind === 'network' &&
            c.sourceAssetId === flow.sourceAssetId &&
            c.targetAssetId === targetAssetId &&
            c.protocol === protocol,
        ),
      serviceAvailable:
        isAssetOnline(state.world, targetAssetId) &&
        state.world.assets.some(
          (a) => a.id === targetAssetId && a.protocols.includes(protocol),
        ),
      accountExists: state.access.accounts.some((a) => a.id === accountId),
      sessionActive: isSessionActive(session, minute),
      networkAllowed:
        networkAllows(state.world, state.access, supplierFlow) &&
        networkAllows(state.world, state.access, flow),
      permissionAllowed: state.access.permissions.some(
        (p) =>
          p.accountId === accountId &&
          p.targetAssetId === targetAssetId &&
          p.protocol === protocol,
      ),
      exceptionAllowed: vendorExceptionAllows(
        state.access,
        accountId,
        targetAssetId,
        protocol,
        minute,
      ),
    },
  };
  return {
    ...state,
    vendor: {
      ...v,
      operations: [
        ...v.operations,
        {
          ...record,
          origin: state.hidden.sessionOrigins[sessionId] ?? 'unclassified',
        },
      ],
    },
  };
}
export function observeVendorOperations(
  state: SimulationState,
  id: string,
): SimulationState {
  if (!state.vendor || !isAssetOnline(state.world, state.access.vpnAssetId))
    return state;
  const minute = currentMinute(state.clock);
  const records = state.vendor.operations
    .filter((o) => o.minute <= minute && o.minute >= minute - 120)
    .map(({ origin: _origin, ...record }) => record);
  return {
    ...state,
    vendor: {
      ...state.vendor,
      observations: [
        ...state.vendor.observations,
        {
          id,
          observedAtMinute: minute,
          source: 'nexus-vpn-access-monitor',
          records,
        },
      ],
    },
  };
}
