import type { CampaignCommand, CampaignState } from '../domain/campaign';
import type { ScenarioMode } from '../domain/scenario';
import { createCampaign, campaignReducer } from './campaignReducer';
import { createOperationSession, initialUiState } from './operationSession';
import type { OperationSession, SavedUiState } from './operationSession';

export type HeadquartersTab =
  | 'overview'
  | 'projects'
  | 'schedule'
  | 'posture'
  | 'map';
export type MissionMetadata = Pick<
  OperationSession,
  'attemptId' | 'createdAt' | 'completedAt'
>;
export interface StrategicSession {
  readonly kind: 'campaign';
  readonly attemptId: string;
  readonly createdAt: string;
  readonly initialSeed: number;
  readonly campaign: CampaignState;
  readonly commands: readonly CampaignCommand[];
  readonly missionMetadata: MissionMetadata | null;
  readonly uiState: SavedUiState;
  readonly headquartersTab: HeadquartersTab;
}
export type GameSession =
  | { readonly kind: 'incident'; readonly operation: OperationSession }
  | StrategicSession;
export function createStandalone(
  mode: ScenarioMode,
  seed: number,
  id: string,
  now: string,
): GameSession {
  return {
    kind: 'incident',
    operation: createOperationSession(mode, seed, id, now),
  };
}
export function createStrategicSession(
  id: string,
  now: string,
  seed = 0,
): StrategicSession {
  return {
    kind: 'campaign',
    attemptId: id,
    createdAt: now,
    initialSeed: seed,
    campaign: createCampaign(seed),
    commands: [],
    missionMetadata: null,
    uiState: { ...initialUiState },
    headquartersTab: 'overview',
  };
}
export function applyCampaignSession(
  session: StrategicSession,
  command: CampaignCommand,
  now: string,
): StrategicSession {
  const campaign = campaignReducer(session.campaign, command);
  let missionMetadata = session.missionMetadata;
  let uiState = session.uiState;
  if (
    session.campaign.phase === 'preparation' &&
    campaign.phase === 'incident'
  ) {
    missionMetadata = {
      attemptId: `${session.attemptId}-M${campaign.preparation.number}`,
      createdAt: now,
      completedAt: null,
    };
    uiState = { ...initialUiState };
  }
  if (
    session.campaign.phase === 'incident' &&
    campaign.phase === 'report' &&
    missionMetadata
  )
    missionMetadata = { ...missionMetadata, completedAt: now };
  if (campaign.phase === 'preparation') missionMetadata = null;
  return {
    ...session,
    campaign,
    commands: [...session.commands, command],
    missionMetadata,
    uiState,
  };
}
/** Wskazuje jedyny świat kampanii; nie tworzy jego kopii ani alternatywnego silnika. */
export function currentOperation(game: GameSession): OperationSession | null {
  if (game.kind === 'incident') return game.operation;
  if (!game.campaign.incident || !game.missionMetadata) return null;
  let start = game.commands.length - 1;
  while (start >= 0 && game.commands[start]?.type !== 'start-incident') start--;
  const commands = game.commands
    .slice(start + 1)
    .flatMap((command) =>
      command.type === 'incident-command' ? [command.command] : [],
    );
  return {
    ...game.missionMetadata,
    simulation: game.campaign.incident,
    commands,
    uiState: game.uiState,
  };
}
