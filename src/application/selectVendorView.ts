import type { SimulationState, TaskAction } from '../domain/simulation';
import { currentMinute } from '../simulation/clock';
import { isAssetOnline } from '../simulation/access';
import { taskRejection, taskSpecs } from '../simulation/tasks';
/** Allowlist: no planner, source operations, actor labels or private business requirements. */
export function selectVendorView(state: SimulationState) {
  if (!state.vendor || !state.access.vendorAuthorization) return null;
  const a = state.access.vendorAuthorization;
  const e = a.exception;
  const actions: TaskAction[] = [
    { type: 'inspect-vendor-operations' },
    ...(e
      ? [
          {
            type: 'revoke-vendor-exception' as const,
            approvalId: e.approvalId,
          },
          {
            type: 'narrow-vendor-exception' as const,
            approvalId: e.approvalId,
          },
          {
            type: 'expand-vendor-exception' as const,
            approvalId: e.approvalId,
          },
        ]
      : []),
  ];
  return {
    accountId: a.accountId,
    exception: e,
    expired: !!e && currentMinute(state.clock) >= e.expiresAtMinute,
    monitorAvailable: isAssetOnline(state.world, state.access.vpnAssetId),
    observations: state.vendor.observations,
    accessChanges: state.vendor.accessChanges,
    actions: actions.map((action) => ({
      action,
      ...taskSpecs[action.type],
      rejection:
        state.clock.turn >= state.clock.turnLimit
          ? 'simulation-finished'
          : taskRejection(state, taskSpecs[action.type].workerId, action),
    })),
  };
}
export type VendorView = NonNullable<ReturnType<typeof selectVendorView>>;
