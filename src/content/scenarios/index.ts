import { referenceScenario } from './reference';
import { legitimateScenario } from './legitimate';
import { stolenCredentialScenario } from './stolenCredential';

/** Stabilna kolejność protokołu wyboru; nigdy nie zależy od decyzji gracza. */
export const scenarioCatalog = [
  referenceScenario,
  legitimateScenario,
  stolenCredentialScenario,
] as const;
