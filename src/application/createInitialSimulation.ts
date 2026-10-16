import { nexusSimulation } from '../content/nexusSimulation';
import type { SimulationState } from '../domain/simulation';
import { createInitialWorld } from './createInitialWorld';
import { nexusAttack } from '../content/nexusAttack';
import { createInitialAttacker } from '../simulation/attacker';

export function createInitialSimulation(): SimulationState {
  const scenario = structuredClone(nexusSimulation);
  return {
    ...scenario,
    hidden: {
      ...scenario.hidden,
      attacker: createInitialAttacker(nexusAttack),
    },
    world: createInitialWorld(),
    business: {
      totalReceived: 0,
      totalProcessed: 0,
      backlog: 0,
      lastReport: null,
    },
    tasks: [],
    knowledge: { sessionObservation: null },
    history: [],
  };
}
