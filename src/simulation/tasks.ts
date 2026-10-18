import { branchTaskSpecs, isBranchAction, branchTaskRejection } from './branch';
import type {
  CommandRejection,
  SimulationState,
  TaskAction,
  WorkerId,
} from '../domain/simulation';
import {
  recoveryTaskSpecs,
  isRecoveryAction,
  recoveryTaskRejection,
  recoveryTaskTurns,
} from './recovery';
import { vendorTaskRejection } from './vendor';
import { isAssetOnline, isSessionActive } from './access';
import { currentMinute } from './clock';
import {
  isIntegrityAction,
  integrityTaskRejection,
  integrityTaskTurns,
} from './integrity';

export function knownAccountIds(
  state: Pick<SimulationState, 'knowledge' | 'incident' | 'vendor' | 'branch'>,
): readonly string[] {
  return [
    ...new Set([
      ...(state.branch?.contexts.map((c) => c.accountId) ?? []),
      ...(state.vendor?.observations ?? []).flatMap((o) =>
        o.records.map((r) => r.accountId),
      ),
      ...state.incident.alerts.map((alert) => alert.accountId),
      ...(state.knowledge.fileObservations ?? []).flatMap((o) =>
        o.records.map((r) => r.accountId),
      ),
      ...(state.knowledge.sessionObservation?.sessions.map(
        (session) => session.accountId,
      ) ?? []),
      ...state.knowledge.authObservations.flatMap((observation) =>
        observation.records.map((record) => record.accountId),
      ),
    ]),
  ];
}

export function knownSessionIds(
  state: Pick<SimulationState, 'knowledge' | 'vendor'>,
): readonly string[] {
  return [
    ...new Set([
      ...(state.vendor?.observations ?? []).flatMap((o) =>
        o.records.map((r) => r.sessionId),
      ),
      ...(state.knowledge.fileObservations ?? []).flatMap((o) =>
        o.records.flatMap((r) => (r.sessionId ? [r.sessionId] : [])),
      ),
      ...(state.knowledge.sessionObservation?.sessions.map(
        (session) => session.id,
      ) ?? []),
      ...state.knowledge.authObservations.flatMap((observation) =>
        observation.records.flatMap((record) =>
          record.sessionId ? [record.sessionId] : [],
        ),
      ),
    ]),
  ];
}

export const taskSpecs: Record<
  TaskAction['type'],
  { readonly workerId: WorkerId; readonly turns: number }
> = {
  ...branchTaskSpecs,
  ...recoveryTaskSpecs,
  'inspect-vendor-operations': { workerId: 'analyst', turns: 1 },
  'revoke-vendor-exception': { workerId: 'administrator', turns: 1 },
  'narrow-vendor-exception': { workerId: 'administrator', turns: 2 },
  'expand-vendor-exception': { workerId: 'administrator', turns: 2 },
  'inspect-edr-telemetry': { workerId: 'analyst', turns: 1 },
  'inspect-documents': { workerId: 'analyst', turns: 2 },
  'inspect-backups': { workerId: 'analyst', turns: 1 },
  'verify-backup': { workerId: 'analyst', turns: 2 },
  'restore-documents': { workerId: 'administrator', turns: 2 },
  'reconcile-documents': { workerId: 'analyst', turns: 2 },
  'examine-endpoint': { workerId: 'analyst', turns: 2 },
  'isolate-endpoint': { workerId: 'administrator', turns: 1 },
  'restrict-endpoint-writes': { workerId: 'administrator', turns: 2 },
  'reconnect-endpoint': { workerId: 'administrator', turns: 1 },
  'inspect-vpn-sessions': { workerId: 'analyst', turns: 1 },
  'inspect-auth-logs': { workerId: 'analyst', turns: 1 },
  'inspect-file-access': { workerId: 'analyst', turns: 1 },
  'contact-account-owner': { workerId: 'analyst', turns: 1 },
  'terminate-session': { workerId: 'administrator', turns: 1 },
  'block-account': { workerId: 'administrator', turns: 1 },
  'unblock-account': { workerId: 'administrator', turns: 1 },
  'reset-credential': { workerId: 'administrator', turns: 2 },
  'set-vpn': { workerId: 'administrator', turns: 1 },
  'set-network-rule': { workerId: 'administrator', turns: 2 },
};

export function taskRejection(
  state: SimulationState,
  workerId: WorkerId,
  action: TaskAction,
): CommandRejection | null {
  if (
    !action ||
    typeof action.type !== 'string' ||
    !Object.hasOwn(taskSpecs, action.type)
  )
    return 'invalid-command';
  const spec = taskSpecs[action.type];
  if (spec.workerId !== workerId) return 'wrong-worker';
  if (
    state.tasks.some(
      (task) => task.workerId === workerId && task.status === 'running',
    )
  )
    return 'worker-busy';
  if (
    state.clock.turn +
      (recoveryTaskTurns(state, action) ??
        integrityTaskTurns(state, action) ??
        spec.turns) >
    state.clock.turnLimit
  )
    return 'outside-time-window';
  if (isBranchAction(action)) return branchTaskRejection(state, action);
  if (isRecoveryAction(action)) return recoveryTaskRejection(state, action);
  if (isIntegrityAction(action)) return integrityTaskRejection(state, action);
  switch (action.type) {
    case 'inspect-vendor-operations':
    case 'revoke-vendor-exception':
    case 'narrow-vendor-exception':
    case 'expand-vendor-exception':
      return vendorTaskRejection(state, action);
    case 'inspect-edr-telemetry':
      return state.integrity &&
        state.telemetry.endpoint?.coverage.collectorAvailable
        ? null
        : 'source-unavailable';
    case 'inspect-vpn-sessions':
      return state.telemetry.sessionSensor.enabled &&
        state.telemetry.sessionSensor.sourceAssetId ===
          state.access.vpnAssetId &&
        isAssetOnline(state.world, state.telemetry.sessionSensor.sourceAssetId)
        ? null
        : 'source-unavailable';
    case 'inspect-file-access':
      return state.telemetry.fileAudit?.sensor.enabled &&
        isAssetOnline(
          state.world,
          state.telemetry.fileAudit.sensor.sourceAssetId,
        )
        ? null
        : 'source-unavailable';
    case 'inspect-auth-logs':
      return state.telemetry.authenticationSensor.enabled &&
        isAssetOnline(
          state.world,
          state.telemetry.authenticationSensor.sourceAssetId,
        )
        ? null
        : 'source-unavailable';
    case 'contact-account-owner':
      if (!knownAccountIds(state).includes(action.accountId))
        return 'target-not-observed';
      return state.hidden.scenario.witnesses.some(
        (witness) => witness.accountId === action.accountId,
      )
        ? null
        : 'unknown-target';
    case 'terminate-session':
      if (!knownSessionIds(state).includes(action.sessionId))
        return 'target-not-observed';
      return state.access.sessions.some(
        (session) =>
          session.id === action.sessionId &&
          isSessionActive(session, currentMinute(state.clock)),
      )
        ? null
        : 'invalid-state';
    case 'block-account':
    case 'unblock-account':
    case 'reset-credential': {
      if (!knownAccountIds(state).includes(action.accountId))
        return 'target-not-observed';
      const account = state.access.accounts.find(
        (item) => item.id === action.accountId,
      );
      if (!account) return 'unknown-target';
      if (action.type === 'block-account' && account.loginStatus === 'blocked')
        return 'invalid-state';
      if (
        action.type === 'unblock-account' &&
        account.loginStatus !== 'blocked'
      )
        return 'invalid-state';
      return null;
    }
    case 'set-vpn':
      if (typeof action.enabled !== 'boolean') return 'invalid-command';
      if (
        action.assetId !== state.access.vpnAssetId ||
        !state.world.assets.some((asset) => asset.id === action.assetId)
      )
        return 'unknown-target';
      return isAssetOnline(state.world, action.assetId) === action.enabled
        ? 'invalid-state'
        : null;
    case 'set-network-rule':
      if (action.action !== 'allow' && action.action !== 'deny')
        return 'invalid-command';
      if (!state.access.rules.some((rule) => rule.id === action.ruleId))
        return 'unknown-target';
      return state.access.rules.some(
        (rule) => rule.id === action.ruleId && rule.action === action.action,
      )
        ? 'invalid-state'
        : null;
  }
}
