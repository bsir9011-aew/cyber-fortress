import { nexusInfrastructure } from '../content/nexusInfrastructure';
import type { WorldState } from '../domain/world';

/** Każdy świat otrzymuje własne encje i kolekcje, również zagnieżdżone. */
export function createInitialWorld(): WorldState {
  return structuredClone(nexusInfrastructure);
}
