import type { ScenarioMode } from '../domain/scenario';
import type { SimulationCommand, SimulationState } from '../domain/simulation';
import { createScenarioRun } from './scenarioSelectors';
import { simulationReducer } from './simulationReducer';

export type ScenarioCommand =
  | SimulationCommand
  | {
      readonly type: 'start-run';
      readonly mode: ScenarioMode;
      readonly seed: number;
    };

/** Zmiana incydentu tworzy nowy stan. Zwykła rozgrywka nadal używa starego reducera. */
export function scenarioReducer(
  state: SimulationState,
  command: ScenarioCommand,
): SimulationState {
  return command.type === 'start-run'
    ? createScenarioRun(command.mode, command.seed)
    : simulationReducer(state, command);
}
