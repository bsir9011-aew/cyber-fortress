import { nexusLogistics } from '../content/organization';
import type { WorldState } from '../domain/world';

/** Bootstrap bez scenariusza i bez współdzielenia kolekcji między światami. */
export function createInitialWorld(): WorldState {
  return {
    organizationId: nexusLogistics.id,
    assets: [],
    connections: [],
  };
}
