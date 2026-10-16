import { nexusSimulation } from '../content/nexusSimulation';
import type { SimulationState } from '../domain/simulation';
import { createInitialWorld } from './createInitialWorld';

export function createInitialSimulation(): SimulationState {
  return {
    ...structuredClone(nexusSimulation),
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
