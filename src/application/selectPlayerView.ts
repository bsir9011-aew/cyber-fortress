import type { SimulationState } from '../domain/simulation';
import type { NetworkRule } from '../domain/access';
import type { InfrastructureConnection } from '../domain/infrastructure';
import { isAssetOnline, selectNetworkRule } from '../simulation/access';
import {
  businessAvailability,
  isBusinessGoalMet,
} from '../simulation/business';
import { currentMinute, isFinished } from '../simulation/clock';
import { knownAccountIds } from '../simulation/tasks';

/** Jawna projekcja: nigdy spread SimulationState/access/hidden do komponentów. */
export function selectPlayerView(state: SimulationState) {
  return {
    run: { ...state.run },
    briefing: { ...state.hidden.scenario.briefing },
    recordPool: state.hidden.scenario.goals.recordPool,
    world: state.world,
    clock: state.clock,
    minute: currentMinute(state.clock),
    finished: isFinished(state.clock),
    business: state.business,
    processName: state.process.name,
    maxFinalBacklog: state.process.maxFinalBacklog,
    goalMet: isBusinessGoalMet(state),
    availability: businessAvailability(state),
    businessDependencies: {
      localCapacity: state.process.localCapacity,
      remoteCapacity: state.process.remoteCapacity,
      remoteAccountId: state.process.remoteAccountId,
      additionalWork: state.process.additionalWork ?? [],
    },
    vpnAssetId: state.access.vpnAssetId,
    vpnOnline: isAssetOnline(state.world, state.access.vpnAssetId),
    erpOnline: isAssetOnline(state.world, state.process.erpAssetId),
    // Reguły są jawną dokumentacją konfiguracyjną w wariancie referencyjnym.
    rules: state.access.rules,
    tasks: state.tasks,
    history: state.history,
    sessionObservation: state.knowledge.sessionObservation,
    authObservations: state.knowledge.authObservations,
    ownerStatements: state.knowledge.ownerStatements,
    alerts: state.incident.alerts,
    hypothesis: state.incident.hypothesis,
    messages: state.incident.messages,
    knownAccountIds: knownAccountIds(state),
    sensors: {
      authentication: state.telemetry.authenticationSensor,
      sessions: state.telemetry.sessionSensor,
    },
  };
}

export type PlayerView = ReturnType<typeof selectPlayerView>;

export function selectConnectionRule(
  rules: readonly NetworkRule[],
  connection: InfrastructureConnection | undefined,
): NetworkRule | undefined {
  return connection?.kind === 'network' && connection.protocol
    ? selectNetworkRule(rules, {
        sourceAssetId: connection.sourceAssetId,
        targetAssetId: connection.targetAssetId,
        protocol: connection.protocol,
      })
    : undefined;
}
