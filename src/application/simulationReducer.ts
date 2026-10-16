import type {
  ReferenceSimulationState,
  SimulationCommand,
  SimulationState,
} from '../domain/simulation';
import { applySimulationCommand } from '../simulation/engine';
import { createScenario } from './createScenario';

export function simulationReducer(
  state: ReferenceSimulationState,
  command: SimulationCommand,
): ReferenceSimulationState;
export function simulationReducer(
  state: SimulationState,
  command: SimulationCommand,
): SimulationState;
export function simulationReducer(
  state: SimulationState,
  command: SimulationCommand,
): SimulationState {
  return command?.type === 'reset'
    ? createScenario(state.hidden.scenario, state.run)
    : applySimulationCommand(state, command);
}
