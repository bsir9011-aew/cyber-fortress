import type { GameSession } from '../application/gameSession';
import type { CampaignCommand } from '../domain/campaign';
import type { RecordedCommand } from '../application/operationSession';
import {
  boundedJson,
  identifier,
  isRecordedCommand,
  keys,
  object,
  timestamp,
} from './saveFormat';
import type { Result } from './saveFormat';
import {
  isCampaignCommand,
  MAX_GAME_BYTES,
  MAX_GAME_COMMANDS,
  readGameSave,
  validateGameSession,
} from './gameSave';
export { MAX_GAME_BYTES, MAX_GAME_COMMANDS };
export const CURRENT_GAME_SAVE_KEY = 'fortress-lab.game.v3';
export interface FortressSaveV3 {
  readonly schemaVersion: 3;
  readonly engineVersion: '8.0.0';
  readonly contentVersion: 'nexus-integrity-1';
  readonly savedAt: string;
  readonly session: GameSession;
}
export function createCurrentGameSave(
  session: GameSession,
  savedAt: string,
): FortressSaveV3 {
  return {
    schemaVersion: 3,
    engineVersion: '8.0.0',
    contentVersion: 'nexus-integrity-1',
    savedAt,
    session,
  };
}
export function isCurrentRecordedCommand(
  value: unknown,
): value is RecordedCommand {
  if (isRecordedCommand(value, true)) return true;
  if (!object(value)) return false;
  if (value.type === 'set-integrity-hypothesis')
    return (
      keys(value, ['type', 'hypothesis']) &&
      ['insufficient-evidence', 'local-modification', 'data-drift'].includes(
        String(value.hypothesis),
      ) &&
      typeof value.hypothesis === 'string'
    );
  if (
    value.type !== 'schedule-task' ||
    !keys(value, ['type', 'workerId', 'action']) ||
    (value.workerId !== 'analyst' && value.workerId !== 'administrator') ||
    !object(value.action)
  )
    return false;
  const a = value.action;
  if (
    ['inspect-documents', 'inspect-backups', 'reconcile-documents'].includes(
      String(a.type),
    )
  )
    return typeof a.type === 'string' && keys(a, ['type']);
  if (a.type === 'verify-backup' || a.type === 'restore-documents')
    return keys(a, ['type', 'backupId']) && identifier(a.backupId);
  if (
    [
      'examine-endpoint',
      'isolate-endpoint',
      'restrict-endpoint-writes',
      'reconnect-endpoint',
    ].includes(String(a.type))
  )
    return (
      typeof a.type === 'string' &&
      keys(a, ['type', 'endpointId']) &&
      identifier(a.endpointId)
    );
  return false;
}
export function isCurrentCampaignCommand(v: unknown): v is CampaignCommand {
  return (
    isCampaignCommand(v) ||
    (object(v) &&
      ((v.type === 'start-integrity-incident' && keys(v, ['type'])) ||
        (v.type === 'incident-command' &&
          keys(v, ['type', 'command']) &&
          isCurrentRecordedCommand(v.command))))
  );
}
export function readCurrentGameSave(text: string): Result<FortressSaveV3> {
  try {
    if (
      text.length > MAX_GAME_BYTES ||
      new TextEncoder().encode(text).byteLength > MAX_GAME_BYTES
    )
      throw new Error('Zapis przekracza limit 8 MiB.');
    const v: unknown = JSON.parse(text);
    if (!object(v)) throw new Error('Zapis jest niekompletny.');
    if (v.schemaVersion === 1 || v.schemaVersion === 2) {
      const old = readGameSave(text);
      return old.ok
        ? {
            ok: true,
            value: createCurrentGameSave(old.value.session, old.value.savedAt),
          }
        : old;
    }
    if (v.schemaVersion !== 3)
      throw new Error('Nieobsługiwana wersja schematu zapisu.');
    if (v.engineVersion !== '8.0.0' || v.contentVersion !== 'nexus-integrity-1')
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
        'Zapis V3 jest niespójny. Bieżąca gra pozostała bez zmian.',
      );
    return { ok: true, value: v as unknown as FortressSaveV3 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Nie udało się odczytać zapisu.',
    };
  }
}
export function serializeCurrentGameSave(save: FortressSaveV3): Result<string> {
  try {
    const text = JSON.stringify(save);
    const valid = readCurrentGameSave(text);
    return valid.ok ? { ok: true, value: text } : valid;
  } catch {
    return { ok: false, error: 'Nie udało się przygotować zapisu V3.' };
  }
}
