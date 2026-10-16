import type {
  CommandRejection,
  SimulationState,
  TaskAction,
  WorkerId,
} from '../domain/simulation';
import { isAssetOnline, isSessionActive } from './access';
import { currentMinute } from './clock';
import { nexusOwnerAccount } from '../content/nexusIncident';

export function knownAccountIds(
  state: Pick<SimulationState, 'knowledge' | 'incident'>,
): readonly string[] {
  return [
    ...new Set([
      ...state.incident.alerts.map((alert) => alert.accountId),
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
  state: Pick<SimulationState, 'knowledge'>,
): readonly string[] {
  return [
    ...new Set([
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
  'inspect-vpn-sessions': { workerId: 'analyst', turns: 1 },
  'inspect-auth-logs': { workerId: 'analyst', turns: 1 },
  'contact-account-owner': { workerId: 'analyst', turns: 1 },
  'terminate-session': { workerId: 'administrator', turns: 1 },
  'block-account': { workerId: 'administrator', turns: 1 },
  'reset-credential': { workerId: 'administrator', turns: 2 },
  'set-vpn': { workerId: 'administrator', turns: 1 },
  'set-network-rule': { workerId: 'administrator', turns: 2 },
};

export function taskRejection(
  state: SimulationState,
  workerId: WorkerId,
  action: TaskAction,
): CommandRejection | null {
  if (!action || !Object.hasOwn(taskSpecs, action.type))
    return 'invalid-command';
  const spec = taskSpecs[action.type];
  if (spec.workerId !== workerId) return 'wrong-worker';
  if (
    state.tasks.some(
      (task) => task.workerId === workerId && task.status === 'running',
    )
  )
    return 'worker-busy';
  if (state.clock.turn + spec.turns > state.clock.turnLimit)
    return 'outside-time-window';
  switch (action.type) {
    case 'inspect-vpn-sessions':
      return state.telemetry.sessionSensor.enabled &&
        state.telemetry.sessionSensor.sourceAssetId ===
          state.access.vpnAssetId &&
        isAssetOnline(state.world, state.telemetry.sessionSensor.sourceAssetId)
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
      return action.accountId === nexusOwnerAccount.accountId
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
    case 'reset-credential': {
      if (!knownAccountIds(state).includes(action.accountId))
        return 'target-not-observed';
      const account = state.access.accounts.find(
        (item) => item.id === action.accountId,
      );
      if (!account) return 'unknown-target';
      if (action.type === 'block-account' && account.loginStatus === 'blocked')
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
