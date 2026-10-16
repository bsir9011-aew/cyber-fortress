import type {
  EmployeeTask,
  SimulationCommand,
  SimulationEventData,
  SimulationState,
} from '../domain/simulation';
import { isAssetOnline, isSessionActive, issueVpnSession } from './access';
import { isBusinessGoalMet, settleBusiness } from './business';
import { currentMinute, isFinished } from './clock';
import { taskRejection, taskSpecs } from './tasks';

function record(
  state: SimulationState,
  event: SimulationEventData,
): SimulationState {
  return {
    ...state,
    history: [
      ...state.history,
      {
        ...event,
        id: `E-${String(state.history.length + 1).padStart(4, '0')}`,
        minute: currentMinute(state.clock),
      },
    ],
  };
}

function applyTaskEffect(
  state: SimulationState,
  task: EmployeeTask,
): SimulationState {
  const { action } = task;
  switch (action.type) {
    case 'set-vpn':
      return {
        ...state,
        world: {
          ...state.world,
          assets: state.world.assets.map((asset) =>
            asset.id === action.assetId
              ? { ...asset, status: action.enabled ? 'online' : 'offline' }
              : asset,
          ),
        },
        access: {
          ...state.access,
          sessions: state.access.sessions.map((session) =>
            !action.enabled &&
            session.gatewayAssetId === action.assetId &&
            session.status === 'active'
              ? { ...session, status: 'terminated' }
              : session,
          ),
        },
      };
    case 'set-network-rule':
      return {
        ...state,
        access: {
          ...state.access,
          rules: state.access.rules.map((rule) =>
            rule.id === action.ruleId
              ? { ...rule, action: action.action }
              : rule,
          ),
        },
      };
    case 'terminate-session':
      return {
        ...state,
        access: {
          ...state.access,
          sessions: state.access.sessions.map((session) =>
            session.id === action.sessionId && session.status === 'active'
              ? { ...session, status: 'terminated' }
              : session,
          ),
        },
      };
    case 'block-account':
      return {
        ...state,
        access: {
          ...state.access,
          accounts: state.access.accounts.map((account) =>
            account.id === action.accountId
              ? { ...account, loginStatus: 'blocked' }
              : account,
          ),
        },
      };
    case 'reset-credential':
      return {
        ...state,
        access: {
          ...state.access,
          accounts: state.access.accounts.map((account) =>
            account.id === action.accountId
              ? { ...account, credentialVersion: account.credentialVersion + 1 }
              : account,
          ),
        },
      };
    case 'inspect-vpn-sessions':
    case 'inspect-auth-logs':
      return state;
  }
}

/** Jeden zagregowany legalny zespół, bez automatycznego odtwarzania S-19. */
function resumeLegitimateWork(state: SimulationState): SimulationState {
  const minute = currentMinute(state.clock);
  const access = {
    ...state.access,
    sessions: state.access.sessions.map((session) =>
      session.status === 'active' && session.expiresAtMinute <= minute
        ? { ...session, status: 'expired' as const }
        : session,
    ),
  };
  const next = { ...state, access };
  const account = access.accounts.find(
    (item) => item.id === state.process.remoteAccountId,
  );
  if (
    !account ||
    access.sessions.some(
      (session) =>
        session.accountId === account.id && isSessionActive(session, minute),
    )
  )
    return next;
  const result = issueVpnSession(
    state.world,
    access,
    {
      sessionId: `B-reconnect-${String(state.clock.turn).padStart(2, '0')}`,
      accountId: account.id,
      credentialVersion: account.credentialVersion,
    },
    minute,
  );
  if (!result.ok) return next;
  return {
    ...next,
    access: result.access,
    hidden: {
      sessionOrigins: {
        ...state.hidden.sessionOrigins,
        [result.session.id]: 'legitimate',
      },
    },
  };
}

function observeVpnSessions(state: SimulationState): SimulationState {
  if (!isAssetOnline(state.world, state.access.vpnAssetId))
    return record(state, { kind: 'research-unavailable' });
  const minute = currentMinute(state.clock);
  const sessions = state.access.sessions
    .filter(
      (session) =>
        session.gatewayAssetId === state.access.vpnAssetId &&
        isSessionActive(session, minute),
    )
    .map((session) => ({
      id: session.id,
      accountId: session.accountId,
      gatewayAssetId: session.gatewayAssetId,
      startedAtMinute: session.startedAtMinute,
    }));
  return record(
    {
      ...state,
      knowledge: {
        ...state.knowledge,
        sessionObservation: { observedAtMinute: minute, sessions },
      },
    },
    { kind: 'sessions-observed', count: sessions.length },
  );
}

function advanceTurn(state: SimulationState): SimulationState {
  // 1. Rozliczenie zakończonego przedziału na STAREJ konfiguracji.
  const business = settleBusiness(state);
  let next = record(
    {
      ...state,
      business,
      clock: { ...state.clock, turn: state.clock.turn + 1 },
    },
    { kind: 'business-report', report: business.lastReport! },
  );
  // 2. Zakończenie prac: czas, priorytet (administrator przed badaniem), stabilny ID.
  const due = state.tasks
    .filter(
      (task) => task.status === 'running' && task.dueTurn <= next.clock.turn,
    )
    .sort(
      (a, b) =>
        a.dueTurn - b.dueTurn ||
        (a.workerId === 'administrator' ? 0 : 1) -
          (b.workerId === 'administrator' ? 0 : 1) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  for (const task of due) {
    const completed: EmployeeTask = { ...task, status: 'completed' };
    next = {
      ...next,
      tasks: next.tasks.map((item) => (item.id === task.id ? completed : item)),
    };
    next = record(applyTaskEffect(next, completed), {
      kind: 'task-completed',
      task: completed,
    });
    if (task.workerId === 'administrator')
      next = record(next, { kind: 'configuration-changed', task: completed });
  }
  // 3. Wygaśnięcia i legalne ponowne logowanie po zmianach konfiguracji.
  next = resumeLegitimateWork(next);
  // 4. Tylko ukończone badanie ujawnia dozwoloną obserwację.
  for (const task of due)
    if (task.action.type === 'inspect-vpn-sessions')
      next = observeVpnSessions(next);
  // 5. Ocena celu; brak nowych tur po terminie.
  if (isFinished(next.clock))
    next = record(next, {
      kind: 'simulation-finished',
      success: isBusinessGoalMet(next),
    });
  return next;
}

/** Czysta transformacja stanu. Reset konfiguruje warstwa application. */
export function applySimulationCommand(
  state: SimulationState,
  command: Exclude<SimulationCommand, { type: 'reset' }>,
): SimulationState {
  if (isFinished(state.clock))
    return record(state, {
      kind: 'command-rejected',
      reason: 'simulation-finished',
    });
  if (!command || typeof command !== 'object')
    return record(state, {
      kind: 'command-rejected',
      reason: 'invalid-command',
    });
  if (command.type === 'advance-turn') return advanceTurn(state);
  if (command.type !== 'schedule-task')
    return record(state, {
      kind: 'command-rejected',
      reason: 'invalid-command',
    });
  const rejection = taskRejection(state, command.workerId, command.action);
  if (rejection)
    return record(state, { kind: 'command-rejected', reason: rejection });
  const task: EmployeeTask = {
    id: `T-${String(state.tasks.length + 1).padStart(4, '0')}`,
    workerId: command.workerId,
    action: { ...command.action },
    startTurn: state.clock.turn,
    dueTurn: state.clock.turn + taskSpecs[command.action.type].turns,
    status: 'running',
  };
  return record(
    { ...state, tasks: [...state.tasks, task] },
    { kind: 'task-started', task },
  );
}
