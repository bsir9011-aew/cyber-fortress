import type { SimulationState } from '../domain/simulation';
import { isFinished } from '../simulation/clock';
import { isBusinessGoalMet } from '../simulation/business';
import { assessThreatAccess } from '../simulation/threatAssessment';
import { selectIntegrityReport } from './selectIntegrityReport';

/** Osobna bramka ujawnienia. Bieżąca projekcja nigdy nie otrzymuje raportu. */
export function selectMissionReport(state: SimulationState) {
  if (!isFinished(state.clock)) return null;
  const attacker = state.hidden.attacker;
  const access = assessThreatAccess(state);
  const retryBudgetExhausted =
    attacker?.status === 'blocked' &&
    attacker.consecutiveFailures >= attacker.definition.maxConsecutiveFailures;
  return {
    ...(state.integrity ? { integrity: selectIntegrityReport(state) } : {}),
    scenario: {
      id: state.hidden.scenario.id,
      name: state.hidden.scenario.name,
      kind: state.hidden.scenario.kind,
      explanation: state.hidden.scenario.explanation,
      mode: state.run.mode,
      seed: state.run.seed,
    },
    confidentiality: {
      exposedRecords: attacker?.transfer.exposedRecords ?? 0,
      recordLimit: state.hidden.scenario.goals.recordPool,
      goalMet:
        (attacker?.transfer.exposedRecords ?? 0) <=
        state.hidden.scenario.goals.maxExposedRecords,
      attackerStatus: attacker?.status ?? null,
      events: (attacker?.privateHistory ?? []).map((event) => ({
        minute: event.minute,
        outcome: event.outcome,
        copiedRecords: event.copiedRecords,
        sessionId: event.sessionId,
      })),
    },
    continuity: {
      received: state.business.totalReceived,
      processed: state.business.totalProcessed,
      backlog: state.business.backlog,
      backlogLimit: state.process.maxFinalBacklog,
      goalMet: isBusinessGoalMet(state),
    },
    containment: {
      ...access,
      required: state.hidden.scenario.goals.requireThreatContainment,
      goalMet: state.hidden.scenario.goals.requireThreatContainment
        ? access.targetAccessCutOff
        : null,
      retryBudgetExhausted,
      stoppedOnlyByRetryBudget:
        retryBudgetExhausted && !access.targetAccessCutOff,
    },
    legitimateActivity: {
      reducedCapacityTurns: state.history.filter(
        (event) =>
          event.kind === 'business-report' &&
          event.report.capacity <
            state.process.localCapacity +
              state.process.remoteCapacity +
              (state.process.additionalWork ?? []).reduce(
                (total, work) => total + work.capacity,
                0,
              ),
      ).length,
      restrictedAccounts: state.hidden.scenario.legitimateBehaviors
        .filter((behavior) => {
          const account = state.access.accounts.find(
            (item) => item.id === behavior.accountId,
          );
          return (
            !account ||
            account.loginStatus === 'blocked' ||
            (behavior.credentialPolicy === 'fixed' &&
              behavior.credentialVersion !== account.credentialVersion)
          );
        })
        .map((behavior) => behavior.accountId),
      initialFailureCount: state.telemetry.sourceEvents.filter(
        (event) =>
          event.minute < state.clock.startMinute && event.outcome === 'failure',
      ).length,
    },
    // Nie nazywamy wszystkich kliknięć momentami przełomowymi.
    moments: state.hidden.decisionHistory
      .filter(
        (decision) =>
          decision.completedAtMinute !== null &&
          decision.impact?.changedCapabilities,
      )
      .slice(0, 3),
    actions: state.tasks
      .filter(
        (task) =>
          task.workerId === 'administrator' && task.status === 'completed',
      )
      .map((task) => ({
        id: task.id,
        action: task.action,
        minute:
          state.clock.startMinute + task.dueTurn * state.clock.turnMinutes,
      })),
  };
}

export type MissionReport = NonNullable<ReturnType<typeof selectMissionReport>>;
