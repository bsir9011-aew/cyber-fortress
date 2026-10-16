import { nexusSimulation } from '../content/nexusSimulation';
import type { SimulationState } from '../domain/simulation';
import { createInitialWorld } from './createInitialWorld';
import { nexusAttack } from '../content/nexusAttack';
import { createInitialAttacker } from '../simulation/attacker';
import { nexusBriefing, nexusTelemetry } from '../content/nexusIncident';
import { updateTelemetry } from '../simulation/telemetry';

export function createInitialSimulation(): SimulationState {
  const scenario = structuredClone(nexusSimulation);
  return updateTelemetry({
    ...scenario,
    hidden: {
      ...scenario.hidden,
      attacker: createInitialAttacker(nexusAttack),
      decisionHistory: [],
    },
    world: createInitialWorld(),
    business: {
      totalReceived: 0,
      totalProcessed: 0,
      backlog: 0,
      lastReport: null,
    },
    tasks: [],
    telemetry: structuredClone(nexusTelemetry),
    incident: {
      alerts: [],
      hypothesis: 'insufficient-evidence',
      messages: [
        {
          id: 'ewa-briefing',
          minute: scenario.clock.startMinute,
          speaker: 'Ewa',
          text: nexusBriefing.message,
          source: 'briefing',
          referenceId: 'mission-briefing',
        },
      ],
    },
    knowledge: {
      sessionObservation: null,
      authObservations: [],
      ownerStatements: [],
    },
    history: [],
  });
}
