import type {
  RunIdentity,
  ScenarioDefinition,
  ScenarioMode,
} from '../domain/scenario';
import { scenarioCatalog } from '../content/scenarios';
import { createScenario } from './createScenario';

/** Wybór wyłącznie na początku próby; bez czasu systemowego i losowania. */
export function selectScenario(
  mode: ScenarioMode,
  seed: number,
): ScenarioDefinition {
  if (
    !Number.isSafeInteger(seed) ||
    seed < 0 ||
    !['training', 'unknown'].includes(mode)
  )
    throw new Error('Invalid scenario selection');
  return mode === 'training'
    ? scenarioCatalog[0]
    : scenarioCatalog[seed % scenarioCatalog.length]!;
}

export function createScenarioRun(mode: ScenarioMode, seed: number) {
  return createScenario(selectScenario(mode, seed), { mode, seed });
}

export function nextRun(run: RunIdentity): RunIdentity {
  const seed = (run.seed + 1) % (Number.MAX_SAFE_INTEGER - 1);
  return { mode: 'unknown', seed };
}
