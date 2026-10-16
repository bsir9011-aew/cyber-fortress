import type { SimulationState, EmployeeTask } from '../domain/simulation';
import type {
  ThreatAccessAssessment,
  DecisionRecord,
} from '../domain/incident';
import {
  canUseService,
  isAssetOnline,
  isSessionActive,
  issueVpnSession,
} from './access';
import { businessAvailability } from './business';
import { currentMinute } from './clock';

/** Autorytatywna diagnoza możliwości, tylko prywatny ślad decyzji i raport po grze. */
export function assessThreatAccess(
  state: SimulationState,
): ThreatAccessAssessment {
  const definition = state.hidden.attacker?.definition;
  if (!definition)
    return {
      applicable: false,
      activeSessionIds: [],
      usableSessionIds: [],
      stolenCredentialStillCurrent: false,
      newAuthenticationAllowed: false,
      accessAfterNewAuthentication: false,
      targetAccessCutOff: false,
      accountContained: false,
    };
  const minute = currentMinute(state.clock);
  const active = state.access.sessions.filter(
    (session) =>
      session.accountId === definition.accountId &&
      session.gatewayAssetId === definition.knownGatewayAssetId &&
      state.hidden.sessionOrigins[session.id] === 'unauthorized' &&
      isSessionActive(session, minute) &&
      isAssetOnline(state.world, session.gatewayAssetId),
  );
  const usable = active.filter((session) =>
    canUseService(
      state.world,
      state.access,
      session.id,
      definition.targetAssetId,
      definition.protocol,
      minute,
    ),
  );
  let probeId = 'report-probe';
  while (state.access.sessions.some((session) => session.id === probeId))
    probeId += '-';
  // Czysta ocena funkcji wydawania, bez dopisania sesji ani logu do świata.
  const authentication =
    definition.knownGatewayAssetId === state.access.vpnAssetId
      ? issueVpnSession(
          state.world,
          state.access,
          {
            sessionId: probeId,
            accountId: definition.accountId,
            credentialVersion: definition.stolenCredentialVersion,
          },
          minute,
        )
      : null;
  const newAuthenticationAllowed = authentication?.ok === true;
  const accessAfterNewAuthentication =
    authentication?.ok === true &&
    canUseService(
      state.world,
      authentication.access,
      authentication.session.id,
      definition.targetAssetId,
      definition.protocol,
      minute,
    );
  const account = state.access.accounts.find(
    (item) => item.id === definition.accountId,
  );
  const credentialRejectedByIdentity =
    !account ||
    account.loginStatus === 'blocked' ||
    account.credentialVersion !== definition.stolenCredentialVersion ||
    account.mfaPolicy === 'required';
  return {
    applicable: true,
    activeSessionIds: active.map((session) => session.id),
    usableSessionIds: usable.map((session) => session.id),
    stolenCredentialStillCurrent: state.access.accounts.some(
      (account) =>
        account.id === definition.accountId &&
        account.credentialVersion === definition.stolenCredentialVersion,
    ),
    newAuthenticationAllowed,
    accessAfterNewAuthentication,
    targetAccessCutOff: usable.length === 0 && !accessAfterNewAuthentication,
    // Sama niedostępność bramy nie zabezpiecza konta na czas po jej przywróceniu.
    accountContained: active.length === 0 && credentialRejectedByIdentity,
  };
}

export function rememberDecision(
  state: SimulationState,
  task: EmployeeTask,
): SimulationState {
  if (task.workerId !== 'administrator') return state;
  const auth = state.knowledge.authObservations.at(-1);
  const sessions = state.knowledge.sessionObservation;
  const record: DecisionRecord = {
    taskId: task.id,
    action: { ...task.action },
    orderedAtMinute: currentMinute(state.clock),
    completedAtMinute: null,
    impact: null,
    knownThen: {
      alertIds: state.incident.alerts.map((alert) => alert.id),
      authObservationMinute: auth?.observedAtMinute ?? null,
      authRecordCount: auth?.records.length ?? 0,
      sessionObservationMinute: sessions?.observedAtMinute ?? null,
      sessionIds: sessions?.sessions.map((session) => session.id) ?? [],
      ownerStatementMinute:
        state.knowledge.ownerStatements.at(-1)?.observedAtMinute ?? null,
      hypothesis: state.incident.hypothesis,
    },
  };
  return {
    ...state,
    hidden: {
      ...state.hidden,
      decisionHistory: [...state.hidden.decisionHistory, record],
    },
  };
}

export function completeDecision(
  before: SimulationState,
  after: SimulationState,
  task: EmployeeTask,
): SimulationState {
  if (task.workerId !== 'administrator') return after;
  const beforeAccess = assessThreatAccess(before);
  const afterAccess = assessThreatAccess(after);
  const remoteCapacityBefore = businessAvailability(before).capacity;
  const remoteCapacityAfter = businessAvailability(after).capacity;
  return {
    ...after,
    hidden: {
      ...after.hidden,
      decisionHistory: after.hidden.decisionHistory.map((decision) =>
        decision.taskId !== task.id
          ? decision
          : {
              ...decision,
              completedAtMinute: currentMinute(after.clock),
              impact: {
                before: beforeAccess,
                after: afterAccess,
                remoteCapacityBefore,
                remoteCapacityAfter,
                exposedRecordsAtCompletion:
                  before.hidden.attacker?.transfer.exposedRecords ?? 0,
                changedCapabilities:
                  JSON.stringify(beforeAccess) !==
                    JSON.stringify(afterAccess) ||
                  remoteCapacityBefore !== remoteCapacityAfter,
              },
            },
      ),
    },
  };
}
