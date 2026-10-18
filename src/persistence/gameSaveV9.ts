import {
  isCurrentCampaignCommand as isV8CampaignCommand,
  isCurrentRecordedCommand as isV8RecordedCommand,
  readCurrentGameSave as readV8Save,
} from './gameSaveV8';
import type { GameSession } from '../application/gameSession';
import type { CampaignCommand } from '../domain/campaign';
import { boundedJson, keys, object, timestamp } from './saveFormat';
import type { Result } from './saveFormat';
import {
  MAX_GAME_BYTES,
  MAX_GAME_COMMANDS,
  validateGameSession,
} from './gameSave';
export { MAX_GAME_BYTES, MAX_GAME_COMMANDS };
export const CURRENT_GAME_SAVE_KEY = 'fortress-lab.game.v9';
export interface FortressSaveV9 {
  readonly schemaVersion: 9;
  readonly engineVersion: '15.0.0';
  readonly contentVersion: 'nexus-finale-1';
  readonly savedAt: string;
  readonly session: GameSession;
}
export function createCurrentGameSave(
  session: GameSession,
  savedAt: string,
): FortressSaveV9 {
  return {
    schemaVersion: 9,
    engineVersion: '15.0.0',
    contentVersion: 'nexus-finale-1',
    savedAt,
    session,
  };
}
export function isCurrentRecordedCommand(
  v: unknown,
): v is import('../application/operationSession').RecordedCommand {
  if (!object(v) || typeof v.type !== 'string') return false;
  if (
    v.type === 'schedule-task' &&
    (!object(v.action) || typeof v.action.type !== 'string')
  )
    return false;
  if (isV8RecordedCommand(v)) return true;
  if (v.type === 'set-crisis-hypothesis')
    return (
      keys(v, ['type', 'hypothesis']) &&
      typeof v.hypothesis === 'string' &&
      [
        'operational-failure',
        'security-incident',
        'multiple-independent-events',
        'insufficient-evidence',
      ].includes(v.hypothesis)
    );
  if (
    v.type !== 'schedule-task' ||
    !keys(v, ['type', 'workerId', 'action']) ||
    v.workerId !== 'administrator' ||
    !object(v.action)
  )
    return false;
  const a = v.action;
  return (
    a.type === 'approve-emergency-vendor-access' &&
    keys(a, ['type', 'scope', 'expiresAtMinute', 'justification']) &&
    (a.scope === 'api-only' || a.scope === 'api-and-files') &&
    (a.expiresAtMinute === 870 ||
      a.expiresAtMinute === 900 ||
      a.expiresAtMinute === 930) &&
    typeof a.justification === 'string' &&
    a.justification.trim().length >= 10 &&
    a.justification.length <= 200
  );
}
export function isCurrentCampaignCommand(v: unknown): v is CampaignCommand {
  if (!object(v) || typeof v.type !== 'string') return false;
  if (v.type === 'incident-command')
    return keys(v, ['type', 'command']) && isCurrentRecordedCommand(v.command);
  if (isV8CampaignCommand(v)) return true;
  return (
    v.type === 'start-finale-incident' &&
    keys(v, ['type', 'familyId']) &&
    v.familyId === 'nexus-campaign-finale-v1'
  );
}
export function readCurrentGameSave(text: string): Result<FortressSaveV9> {
  try {
    if (
      text.length > MAX_GAME_BYTES ||
      new TextEncoder().encode(text).byteLength > MAX_GAME_BYTES
    )
      throw new Error('Zapis przekracza limit 8 MiB.');
    const v: unknown = JSON.parse(text);
    if (!object(v)) throw new Error('Zapis jest niekompletny.');
    if (v.format === 'FORTRESS_AAR')
      throw new Error(
        'Wybrany plik to raport AAR, nie zapis gry. Do wznowienia użyj eksportu zapisu.',
      );
    if (
      v.schemaVersion === 1 ||
      v.schemaVersion === 2 ||
      v.schemaVersion === 3 ||
      v.schemaVersion === 4 ||
      v.schemaVersion === 5 ||
      v.schemaVersion === 6 ||
      v.schemaVersion === 7 ||
      v.schemaVersion === 8
    ) {
      const old = readV8Save(text);
      return old.ok
        ? {
            ok: true,
            value: createCurrentGameSave(old.value.session, old.value.savedAt),
          }
        : old;
    }
    if (v.schemaVersion !== 9)
      throw new Error('Nieobsługiwana wersja schematu zapisu.');
    if (v.engineVersion !== '15.0.0' || v.contentVersion !== 'nexus-finale-1')
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
        'Zapis V9 jest niespójny. Bieżąca gra pozostała bez zmian.',
      );
    return { ok: true, value: v as unknown as FortressSaveV9 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Nie udało się odczytać zapisu.',
    };
  }
}
export function serializeCurrentGameSave(save: FortressSaveV9): Result<string> {
  try {
    const text = JSON.stringify(save);
    const valid = readCurrentGameSave(text);
    return valid.ok ? { ok: true, value: text } : valid;
  } catch {
    return { ok: false, error: 'Nie udało się przygotować zapisu V9.' };
  }
}
