import type { SimulationCommand, SimulationState } from '../domain/simulation';
import { applySimulationCommand } from '../simulation/engine';
import { createInitialSimulation } from './createInitialSimulation';

export function simulationReducer(
  state: SimulationState,
  command: SimulationCommand,
): SimulationState {
  return command?.type === 'reset'
    ? createInitialSimulation()
    : applySimulationCommand(state, command);
}
