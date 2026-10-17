import type { SimulationCommand, SimulationState } from '../domain/simulation';
import type { ScenarioMode } from '../domain/scenario';
import { createScenarioRun } from './scenarioSelectors';
import { simulationReducer } from './simulationReducer';
import type { MapLayer } from './infrastructureSelectors';

export type RecordedCommand = Exclude<SimulationCommand, { type: 'reset' }>;
export interface SavedUiState {
  readonly briefing: boolean;
  readonly context: 'cases' | 'operations' | 'architecture';
  readonly layer: MapLayer;
  readonly selection: {
    readonly kind: 'asset' | 'connection';
    readonly id: string;
  } | null;
}
export interface OperationSession {
  readonly attemptId: string;
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly simulation: SimulationState;
  /** Journal do sprawdzenia migawki, wykonywany wyłącznie istniejącym reducerem. */
  readonly commands: readonly RecordedCommand[];
  readonly uiState: SavedUiState;
}
export const initialUiState: SavedUiState = {
  briefing: true,
  context: 'cases',
  layer: 'network',
  selection: null,
};
export function createOperationSession(
  mode: ScenarioMode,
  seed: number,
  attemptId: string,
  createdAt: string,
): OperationSession {
  return {
    attemptId,
    createdAt,
    completedAt: null,
    simulation: createScenarioRun(mode, seed),
    commands: [],
    uiState: { ...initialUiState },
  };
}
export function applyOperationCommand(
  session: OperationSession,
  command: RecordedCommand,
  now: string,
): OperationSession {
  if (session.simulation.clock.turn === session.simulation.clock.turnLimit)
    return session;
  const simulation = simulationReducer(session.simulation, command);
  return {
    ...session,
    simulation,
    commands: [...session.commands, command],
    completedAt:
      simulation.clock.turn === simulation.clock.turnLimit ? now : null,
  };
}
