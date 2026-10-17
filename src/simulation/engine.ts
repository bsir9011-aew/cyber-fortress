import type {
  EmployeeTask,
  SimulationCommand,
  SimulationEventData,
  SimulationState,
} from '../domain/simulation';
import { isAssetOnline, isSessionActive } from './access';
import { isBusinessGoalMet, settleBusiness } from './business';
import { currentMinute, isFinished } from './clock';
import { taskRejection, taskSpecs } from './tasks';
import { stepAttacker } from './attacker';
import { readAuthenticationLogs, updateTelemetry } from './telemetry';
import { updateNarrative } from './narrative';
import { completeDecision, rememberDecision } from './threatAssessment';
import { resumeLegitimateWork } from './legitimateActors';
import { readFileAccess, recordLegalFileActivity } from './fileAudit';
import {
  applyIntegrityTask,
  observeIntegrityTask,
  rememberIntegrityDecision,
  integrityTaskTurns,
} from './integrity';

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
    case 'unblock-account':
      return {
        ...state,
        access: {
          ...state.access,
          accounts: state.access.accounts.map((account) =>
            account.id === action.accountId
              ? {
                  ...account,
                  loginStatus:
                    action.type === 'block-account' ? 'blocked' : 'enabled',
                }
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
    case 'inspect-file-access':
    case 'inspect-auth-logs':
    case 'contact-account-owner':
      return state;
  }
  return applyIntegrityTask(state, task);
}

function observeVpnSessions(state: SimulationState): SimulationState {
  if (
    !state.telemetry.sessionSensor.enabled ||
    state.telemetry.sessionSensor.sourceAssetId !== state.access.vpnAssetId ||
    !isAssetOnline(state.world, state.telemetry.sessionSensor.sourceAssetId)
  )
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

function observeCompletedResearch(
  state: SimulationState,
  task: EmployeeTask,
): SimulationState {
  if (task.action.type === 'inspect-vpn-sessions')
    return observeVpnSessions(state);
  if (task.action.type === 'inspect-file-access') {
    const observation = readFileAccess(state, task.id);
    if (!observation) return record(state, { kind: 'research-unavailable' });
    return record(
      {
        ...state,
        knowledge: {
          ...state.knowledge,
          fileObservations: [
            ...(state.knowledge.fileObservations ?? []),
            observation,
          ],
        },
      },
      { kind: 'file-access-observed', count: observation.records.length },
    );
  }
  if (task.action.type === 'inspect-auth-logs') {
    const observation = readAuthenticationLogs(state, task.id);
    if (!observation) return record(state, { kind: 'research-unavailable' });
    return record(
      {
        ...state,
        knowledge: {
          ...state.knowledge,
          authObservations: [...state.knowledge.authObservations, observation],
        },
      },
      { kind: 'auth-logs-observed', count: observation.records.length },
    );
  }
  if (task.action.type === 'contact-account-owner') {
    const accountId = task.action.accountId;
    const witness = state.hidden.scenario.witnesses.find(
      (item) => item.accountId === accountId,
    );
    if (!witness) return record(state, { kind: 'research-unavailable' });
    const statement = {
      id: task.id,
      kind: 'human-statement' as const,
      ...witness,
      observedAtMinute: currentMinute(state.clock),
    };
    return record(
      {
        ...state,
        knowledge: {
          ...state.knowledge,
          ownerStatements: [...state.knowledge.ownerStatements, statement],
        },
      },
      { kind: 'owner-contacted', accountId: task.action.accountId },
    );
  }
  return state;
}

function advanceTurn(state: SimulationState): SimulationState {
  // 1. Rozliczenie zakończonego przedziału na STAREJ konfiguracji.
  const business = settleBusiness(state);
  state = recordLegalFileActivity(state);
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
    next = record(
      completeDecision(next, applyTaskEffect(next, completed), completed),
      {
        kind: 'task-completed',
        task: completed,
      },
    );
    if (task.workerId === 'administrator')
      next = record(next, { kind: 'configuration-changed', task: completed });
  }
  // 3. Wygaśnięcia oraz legalny zespół i przeciwnik po zmianach konfiguracji.
  next = resumeLegitimateWork(next);
  next = stepAttacker(next);
  next = updateTelemetry(next);
  // 4. Tylko ukończone badanie ujawnia dozwoloną obserwację.
  for (const task of due)
    next = observeIntegrityTask(observeCompletedResearch(next, task), task);
  // 5. Ocena celu; brak nowych tur po terminie.
  if (isFinished(next.clock))
    next = record(next, {
      kind: 'simulation-finished',
      success: isBusinessGoalMet(next),
    });
  return updateNarrative(next);
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
  if (
    command.type === 'set-integrity-hypothesis' &&
    state.integrity &&
    ['insufficient-evidence', 'local-modification', 'data-drift'].includes(
      command.hypothesis,
    )
  )
    return {
      ...state,
      integrity: { ...state.integrity, hypothesis: command.hypothesis },
    };
  if (command.type === 'set-hypothesis') {
    if (
      ![
        'insufficient-evidence',
        'compromised-credential',
        'unusual-legitimate-session',
        'existing-tunnel-access',
      ].includes(command.hypothesis)
    )
      return record(state, {
        kind: 'command-rejected',
        reason: 'invalid-command',
      });
    return {
      ...state,
      incident: { ...state.incident, hypothesis: command.hypothesis },
    };
  }
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
    dueTurn:
      state.clock.turn +
      (integrityTaskTurns(state, command.action) ??
        taskSpecs[command.action.type].turns),
    status: 'running',
  };
  return record(
    rememberIntegrityDecision(
      rememberDecision({ ...state, tasks: [...state.tasks, task] }, task),
      task,
    ),
    { kind: 'task-started', task },
  );
}
