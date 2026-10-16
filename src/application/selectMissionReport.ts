import type { SimulationState } from '../domain/simulation';
import { isFinished } from '../simulation/clock';
import { isBusinessGoalMet } from '../simulation/business';
import { assessThreatAccess } from '../simulation/threatAssessment';

/** Osobna bramka ujawnienia. Bieżąca projekcja nigdy nie otrzymuje raportu. */
export function selectMissionReport(state: SimulationState) {
  if (!isFinished(state.clock)) return null;
  const attacker = state.hidden.attacker;
  const access = assessThreatAccess(state);
  const retryBudgetExhausted =
    attacker.status === 'blocked' &&
    attacker.consecutiveFailures >= attacker.definition.maxConsecutiveFailures;
  return {
    confidentiality: {
      exposedRecords: attacker.transfer.exposedRecords,
      recordLimit: attacker.definition.recordLimit,
      goalMet: attacker.transfer.exposedRecords === 0,
      attackerStatus: attacker.status,
      events: attacker.privateHistory.map((event) => ({
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
      retryBudgetExhausted,
      stoppedOnlyByRetryBudget:
        retryBudgetExhausted && !access.targetAccessCutOff,
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
