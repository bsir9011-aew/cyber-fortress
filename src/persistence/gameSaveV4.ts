import {
  isCurrentCampaignCommand as isV3CampaignCommand,
  isCurrentRecordedCommand as isV3RecordedCommand,
  readCurrentGameSave as readV3Save,
} from './gameSaveV3';
import type { GameSession } from '../application/gameSession';
import type { CampaignCommand } from '../domain/campaign';
import type { RecordedCommand } from '../application/operationSession';
import { boundedJson, keys, object, timestamp } from './saveFormat';
import type { Result } from './saveFormat';
import {
  MAX_GAME_BYTES,
  MAX_GAME_COMMANDS,
  validateGameSession,
} from './gameSave';
export { MAX_GAME_BYTES, MAX_GAME_COMMANDS };
export const CURRENT_GAME_SAVE_KEY = 'fortress-lab.game.v4';
export interface FortressSaveV4 {
  readonly schemaVersion: 4;
  readonly engineVersion: '9.0.0';
  readonly contentVersion: 'nexus-resilience-1';
  readonly savedAt: string;
  readonly session: GameSession;
}
export function createCurrentGameSave(
  session: GameSession,
  savedAt: string,
): FortressSaveV4 {
  return {
    schemaVersion: 4,
    engineVersion: '9.0.0',
    contentVersion: 'nexus-resilience-1',
    savedAt,
    session,
  };
}
export function isCurrentRecordedCommand(
  value: unknown,
): value is RecordedCommand {
  return (
    isV3RecordedCommand(value) ||
    (object(value) &&
      value.type === 'schedule-task' &&
      keys(value, ['type', 'workerId', 'action']) &&
      value.workerId === 'analyst' &&
      object(value.action) &&
      value.action.type === 'inspect-edr-telemetry' &&
      keys(value.action, ['type']))
  );
}
export function isCurrentCampaignCommand(v: unknown): v is CampaignCommand {
  if (isV3CampaignCommand(v)) return true;
  if (!object(v) || typeof v.type !== 'string') return false;
  if (v.type === 'accept-resilience-funding') return keys(v, ['type']);
  if (v.type === 'incident-command')
    return keys(v, ['type', 'command']) && isCurrentRecordedCommand(v.command);
  if (v.projectId !== 'endpoint-edr' && v.projectId !== 'backup-resilience')
    return false;
  if (v.type === 'assign-work')
    return (
      keys(v, ['type', 'projectId', 'workerId']) &&
      (v.workerId === 'administrator' || v.workerId === 'analyst')
    );
  return (
    ['plan-project', 'reserve-project', 'cancel-project'].includes(
      String(v.type),
    ) && keys(v, ['type', 'projectId'])
  );
}
export function readCurrentGameSave(text: string): Result<FortressSaveV4> {
  try {
    if (
      text.length > MAX_GAME_BYTES ||
      new TextEncoder().encode(text).byteLength > MAX_GAME_BYTES
    )
      throw new Error('Zapis przekracza limit 8 MiB.');
    const v: unknown = JSON.parse(text);
    if (!object(v)) throw new Error('Zapis jest niekompletny.');
    if (
      v.schemaVersion === 1 ||
      v.schemaVersion === 2 ||
      v.schemaVersion === 3
    ) {
      const old = readV3Save(text);
      return old.ok
        ? {
            ok: true,
            value: createCurrentGameSave(old.value.session, old.value.savedAt),
          }
        : old;
    }
    if (v.schemaVersion !== 4)
      throw new Error('Nieobsługiwana wersja schematu zapisu.');
    if (
      v.engineVersion !== '9.0.0' ||
      v.contentVersion !== 'nexus-resilience-1'
    )
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
      !validateGameSession(
        v.session,
        v.savedAt,
        isCurrentCampaignCommand,
        isCurrentRecordedCommand,
      )
    )
      throw new Error(
        'Zapis V4 jest niespójny. Bieżąca gra pozostała bez zmian.',
      );
    return { ok: true, value: v as unknown as FortressSaveV4 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Nie udało się odczytać zapisu.',
    };
  }
}
export function serializeCurrentGameSave(save: FortressSaveV4): Result<string> {
  try {
    const text = JSON.stringify(save);
    const valid = readCurrentGameSave(text);
    return valid.ok ? { ok: true, value: text } : valid;
  } catch {
    return { ok: false, error: 'Nie udało się przygotować zapisu V4.' };
  }
}
