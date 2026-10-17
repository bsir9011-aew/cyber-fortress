import type { GameSession } from '../application/gameSession';
import type { OperationSession } from '../application/operationSession';
import type { CampaignCommand } from '../domain/campaign';
import {
  createCampaign,
  campaignReducer,
} from '../application/campaignReducer';
import { createScenarioRun } from '../application/scenarioSelectors';
import { simulationReducer } from '../application/simulationReducer';
import {
  boundedJson,
  identifier,
  integer,
  isRecordedCommand,
  keys,
  object,
  readSave,
  sameJson,
  timestamp,
  toOperationSession,
  validateUi,
} from './saveFormat';
import type { Result } from './saveFormat';

export const GAME_SAVE_KEY = 'fortress-lab.game.v2';
export const MAX_GAME_BYTES = 8 * 1024 * 1024;
export const MAX_GAME_COMMANDS = 10000;
export interface FortressSaveV2 {
  // Additive V2 actions (including unblock-account) preserve existing journals
  // and snapshots, so the 7.0.0 envelope remains readable without migration.
  readonly schemaVersion: 2;
  readonly engineVersion: '7.0.0';
  readonly contentVersion: 'nexus-strategy-1';
  readonly savedAt: string;
  readonly session: GameSession;
}
export function createGameSave(
  session: GameSession,
  savedAt: string,
): FortressSaveV2 {
  return {
    schemaVersion: 2,
    engineVersion: '7.0.0',
    contentVersion: 'nexus-strategy-1',
    savedAt,
    session,
  };
}
function fail(): never {
  throw new Error(
    'Zapis V2 jest niekompletny lub niespójny. Bieżąca gra pozostała bez zmian.',
  );
}
export function isCampaignCommand(v: unknown): v is CampaignCommand {
  if (!object(v) || typeof v.type !== 'string') return false;
  if (
    ['advance-preparation', 'start-incident', 'return-headquarters'].includes(
      String(v.type),
    )
  )
    return typeof v.type === 'string' && keys(v, ['type']);
  if (v.type === 'set-segmentation-scope')
    return (
      keys(v, ['type', 'scope']) &&
      (v.scope === 'file-team' || v.scope === 'document-users')
    );
  if (v.type === 'incident-command')
    return keys(v, ['type', 'command']) && isRecordedCommand(v.command, true);
  if (
    v.projectId !== 'remote-access' &&
    v.projectId !== 'file-visibility' &&
    v.projectId !== 'segmentation'
  )
    return false;
  if (v.type === 'assign-work')
    return (
      keys(v, ['type', 'projectId', 'workerId']) &&
      (v.workerId === 'analyst' || v.workerId === 'administrator')
    );
  return (
    typeof v.type === 'string' &&
    ['plan-project', 'reserve-project', 'cancel-project'].includes(v.type) &&
    keys(v, ['type', 'projectId'])
  );
}
function metadata(
  v: unknown,
  savedAt: string,
): v is Record<string, unknown> &
  Pick<OperationSession, 'attemptId' | 'createdAt' | 'completedAt'> {
  return (
    object(v) &&
    identifier(v.attemptId) &&
    timestamp(v.createdAt) &&
    v.createdAt <= savedAt &&
    (v.completedAt === null ||
      (timestamp(v.completedAt) &&
        v.completedAt >= v.createdAt &&
        v.completedAt <= savedAt))
  );
}
function validateOperation(
  v: unknown,
  savedAt: string,
  recordedCommand = (c: unknown) => isRecordedCommand(c, true),
): v is OperationSession {
  if (
    !object(v) ||
    !keys(v, [
      'attemptId',
      'createdAt',
      'completedAt',
      'simulation',
      'commands',
      'uiState',
    ]) ||
    !metadata(v, savedAt) ||
    !object(v.simulation) ||
    !object(v.simulation.run) ||
    !Array.isArray(v.commands) ||
    v.commands.length > MAX_GAME_COMMANDS ||
    !v.commands.every(recordedCommand)
  )
    return false;
  const { run } = v.simulation;
  if ((run.mode !== 'training' && run.mode !== 'unknown') || !integer(run.seed))
    return false;
  let expected = createScenarioRun(run.mode, run.seed);
  for (const command of v.commands) {
    if (expected.clock.turn === expected.clock.turnLimit) return false;
    expected = simulationReducer(expected, command);
  }
  return (
    sameJson(expected, v.simulation) &&
    validateUi(v.uiState, expected) &&
    (v.completedAt !== null) ===
      (expected.clock.turn === expected.clock.turnLimit)
  );
}
/** Shared replay validation; V2 defaults keep the historical command contract. */
export function validateGameSession(
  value: unknown,
  savedAt: string,
  campaignCommand = isCampaignCommand,
  recordedCommand = (c: unknown) => isRecordedCommand(c, true),
): value is GameSession {
  if (!object(value)) return false;
  const s = value;
  if (s.kind === 'incident') {
    if (
      !keys(s, ['kind', 'operation']) ||
      !validateOperation(s.operation, savedAt, recordedCommand)
    )
      fail();
  } else if (s.kind === 'campaign') {
    if (
      !keys(s, [
        'kind',
        'attemptId',
        'createdAt',
        'initialSeed',
        'campaign',
        'commands',
        'missionMetadata',
        'uiState',
        'headquartersTab',
      ]) ||
      !identifier(s.attemptId) ||
      !timestamp(s.createdAt) ||
      s.createdAt > savedAt ||
      !integer(s.initialSeed) ||
      !Array.isArray(s.commands) ||
      s.commands.length > MAX_GAME_COMMANDS ||
      !s.commands.every(campaignCommand) ||
      typeof s.headquartersTab !== 'string' ||
      !['overview', 'projects', 'schedule', 'posture', 'map'].includes(
        s.headquartersTab,
      )
    )
      fail();
    let expected = createCampaign(s.initialSeed);
    for (const command of s.commands)
      expected = campaignReducer(expected, command);
    if (
      !sameJson(expected, s.campaign) ||
      !validateUi(
        s.uiState,
        expected.incident ?? createScenarioRun('training', 0),
      )
    )
      fail();
    if (expected.incident) {
      if (
        !metadata(s.missionMetadata, savedAt) ||
        !keys(s.missionMetadata as unknown as Record<string, unknown>, [
          'attemptId',
          'createdAt',
          'completedAt',
        ]) ||
        s.missionMetadata.attemptId !==
          `${s.attemptId}-M${expected.preparation.number}` ||
        s.missionMetadata.createdAt < s.createdAt ||
        (s.missionMetadata.completedAt !== null) !==
          (expected.phase === 'report')
      )
        fail();
    } else if (s.missionMetadata !== null) fail();
  } else fail();
  return true;
}
export function readGameSave(text: string): Result<FortressSaveV2> {
  try {
    if (
      text.length > MAX_GAME_BYTES ||
      new TextEncoder().encode(text).byteLength > MAX_GAME_BYTES
    )
      throw new Error('Zapis przekracza limit 8 MiB.');
    let v: unknown;
    try {
      v = JSON.parse(text);
    } catch {
      throw new Error('Plik nie zawiera poprawnego JSON.');
    }
    if (!object(v)) fail();
    if (v.schemaVersion === 1) {
      const legacy = readSave(text);
      if (!legacy.ok) return legacy;
      return {
        ok: true,
        value: createGameSave(
          { kind: 'incident', operation: toOperationSession(legacy.value) },
          legacy.value.savedAt,
        ),
      };
    }
    if (v.schemaVersion !== 2)
      throw new Error('Nieobsługiwana wersja schematu zapisu.');
    if (v.engineVersion !== '7.0.0' || v.contentVersion !== 'nexus-strategy-1')
      throw new Error('Zapis wymaga innej wersji silnika lub treści.');
    boundedJson(v);
    if (
      !keys(v, [
        'schemaVersion',
        'engineVersion',
        'contentVersion',
        'savedAt',
        'session',
      ]) ||
      !timestamp(v.savedAt) ||
      !object(v.session)
    )
      fail();
    if (!validateGameSession(v.session, v.savedAt)) fail();
    return { ok: true, value: v as unknown as FortressSaveV2 };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Nie udało się odczytać zapisu.',
    };
  }
}
export function serializeGameSave(save: FortressSaveV2): Result<string> {
  try {
    const text = JSON.stringify(save);
    const valid = readGameSave(text);
    return valid.ok ? { ok: true, value: text } : valid;
  } catch {
    return { ok: false, error: 'Nie udało się przygotować zapisu V2.' };
  }
}
