import type { ReferenceSimulationState } from '../domain/simulation';
import { referenceScenario } from '../content/scenarios/reference';
import { createScenario } from './createScenario';

/** Kompatybilne wejście do referencyjnego wariantu 4A/4B. */
export function createInitialSimulation(): ReferenceSimulationState {
  const state = createScenario(referenceScenario, {
    mode: 'training',
    seed: 0,
  });
  const attacker = state.hidden.attacker;
  if (!attacker) throw new Error('Reference scenario requires an attacker');
  return { ...state, hidden: { ...state.hidden, attacker } };
}
