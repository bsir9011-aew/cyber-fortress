import type {
  EmployeeTask,
  SimulationState,
  TaskAction,
  CommandRejection,
} from '../domain/simulation';
import { canUseService, isAssetOnline, isSessionActive } from './access';
import { currentMinute } from './clock';
import { attemptFileAccess } from './fileAudit';
import { recordVendorOperation } from './vendorTelemetry';
export function initializeVendor(state: SimulationState): SimulationState {
  if (!state.hidden.scenario.vendor) return state;
  const e = state.access.vendorAuthorization?.exception;
  return {
    ...state,
    vendor: {
      operations: [],
      observations: [],
      completedBatches: 0,
      accessChanges: e
        ? [
            {
              minute: state.clock.startMinute,
              kind: 'activated',
              taskId: null,
              exception: e,
            },
          ]
        : [],
    },
  };
}
export function vendorWorkAvailable(state: SimulationState): boolean {
  const d = state.hidden.scenario.vendor,
    v = state.vendor;
  if (!d || !v) return false;
  if (v.completedBatches >= d.requiredBatches) return true;
  return state.access.sessions.some(
    (s) =>
      s.accountId === state.access.vendorAuthorization?.accountId &&
      state.hidden.sessionOrigins[s.id] === 'legitimate' &&
      canUseService(
        state.world,
        state.access,
        s.id,
        'carrier-api',
        'HTTPS',
        currentMinute(state.clock),
      ) &&
      (!d.requiresFiles ||
        canUseService(
          state.world,
          state.access,
          s.id,
          'fs-01',
          'SMB',
          currentMinute(state.clock),
        )),
  );
}
/** Executes the same real service predicates used by business settlement in this interval. */
export function recordLegalVendorActivity(
  state: SimulationState,
): SimulationState {
  const d = state.hidden.scenario.vendor,
    v = state.vendor;
  if (!d || !v || v.completedBatches >= d.requiredBatches) return state;
  const session = state.access.sessions.find(
    (s) =>
      s.accountId === state.access.vendorAuthorization?.accountId &&
      state.hidden.sessionOrigins[s.id] === 'legitimate' &&
      isSessionActive(s, currentMinute(state.clock)),
  );
  if (!session) return state;
  const apiAllowed = canUseService(
    state.world,
    state.access,
    session.id,
    'carrier-api',
    'HTTPS',
    currentMinute(state.clock),
  );
  let next = recordVendorOperation(
    state,
    session.id,
    'carrier-api',
    'HTTPS',
    'integrate',
    null,
    apiAllowed,
  );
  let filesAllowed = true;
  if (d.requiresFiles) {
    const result = attemptFileAccess(next, session.id, 'fs-01', 'read', 6);
    next = result.state;
    filesAllowed = result.allowed;
  }
  if (apiAllowed && filesAllowed)
    next = {
      ...next,
      vendor: { ...next.vendor!, completedBatches: v.completedBatches + 1 },
    };
  return next;
}
export function expireVendorException(state: SimulationState): SimulationState {
  const a = state.access.vendorAuthorization,
    e = a?.exception;
  if (
    !state.vendor ||
    !a ||
    !e ||
    e.status !== 'active' ||
    currentMinute(state.clock) < e.expiresAtMinute
  )
    return state;
  const exception = { ...e, status: 'expired' as const };
  return {
    ...state,
    access: { ...state.access, vendorAuthorization: { ...a, exception } },
    vendor: {
      ...state.vendor,
      accessChanges: [
        ...state.vendor.accessChanges,
        { minute: e.expiresAtMinute, kind: 'expired', taskId: null, exception },
      ],
    },
  };
}
export function vendorTaskRejection(
  state: SimulationState,
  action: TaskAction,
): CommandRejection | null {
  if (!state.vendor || !state.access.vendorAuthorization)
    return 'unknown-target';
  if (action.type === 'inspect-vendor-operations')
    return isAssetOnline(state.world, state.access.vpnAssetId)
      ? null
      : 'source-unavailable';
  const e = state.access.vendorAuthorization.exception;
  if (!('approvalId' in action) || !e || e.approvalId !== action.approvalId)
    return 'unknown-target';
  if (e.status !== 'active' || currentMinute(state.clock) >= e.expiresAtMinute)
    return 'invalid-state';
  if (action.type === 'narrow-vendor-exception' && e.scope !== 'api-and-files')
    return 'invalid-state';
  if (action.type === 'expand-vendor-exception' && e.scope !== 'api-only')
    return 'invalid-state';
  const duration = action.type === 'revoke-vendor-exception' ? 5 : 10;
  return currentMinute(state.clock) + duration >= e.expiresAtMinute
    ? 'outside-time-window'
    : null;
}
export function applyVendorTask(
  state: SimulationState,
  task: EmployeeTask,
): SimulationState {
  const action = task.action;
  if (
    !('approvalId' in action) ||
    vendorTaskRejectionAtCompletion(state, action)
  )
    return state;
  const authorization = state.access.vendorAuthorization!;
  const e = authorization.exception!;
  const exception = {
    ...e,
    ...(action.type === 'revoke-vendor-exception'
      ? { status: 'revoked' as const }
      : {
          scope:
            action.type === 'narrow-vendor-exception'
              ? ('api-only' as const)
              : ('api-and-files' as const),
        }),
  };
  const kind =
    action.type === 'revoke-vendor-exception'
      ? ('revoked' as const)
      : action.type === 'narrow-vendor-exception'
        ? ('narrowed' as const)
        : ('expanded' as const);
  return {
    ...state,
    access: {
      ...state.access,
      vendorAuthorization: { ...authorization, exception },
    },
    vendor: {
      ...state.vendor!,
      accessChanges: [
        ...state.vendor!.accessChanges,
        {
          minute: currentMinute(state.clock),
          kind,
          taskId: task.id,
          exception,
        },
      ],
    },
  };
}
function vendorTaskRejectionAtCompletion(
  state: SimulationState,
  action: Extract<TaskAction, { approvalId: string }>,
) {
  const e = state.access.vendorAuthorization?.exception;
  return (
    !state.vendor ||
    !e ||
    e.approvalId !== action.approvalId ||
    e.status !== 'active' ||
    currentMinute(state.clock) >= e.expiresAtMinute
  );
}
