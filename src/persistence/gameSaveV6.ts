import {
  isCurrentCampaignCommand as isV5CampaignCommand,
  isCurrentRecordedCommand as isV5RecordedCommand,
  readCurrentGameSave as readV5Save,
} from './gameSaveV5';
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
export const CURRENT_GAME_SAVE_KEY = 'fortress-lab.game.v6';
export interface FortressSaveV6 {
  readonly schemaVersion: 6;
  readonly engineVersion: '12.0.0';
  readonly contentVersion: 'nexus-vendor-1';
  readonly savedAt: string;
  readonly session: GameSession;
}
export function createCurrentGameSave(
  session: GameSession,
  savedAt: string,
): FortressSaveV6 {
  return {
    schemaVersion: 6,
    engineVersion: '12.0.0',
    contentVersion: 'nexus-vendor-1',
    savedAt,
    session,
  };
}
export function isCurrentRecordedCommand(
  v: unknown,
): v is import('../application/operationSession').RecordedCommand {
  if (isV5RecordedCommand(v)) return true;
  if (
    !object(v) ||
    v.type !== 'schedule-task' ||
    !keys(v, ['type', 'workerId', 'action']) ||
    !object(v.action)
  )
    return false;
  if (v.action.type === 'inspect-vendor-operations')
    return v.workerId === 'analyst' && keys(v.action, ['type']);
  return (
    v.workerId === 'administrator' &&
    [
      'revoke-vendor-exception',
      'narrow-vendor-exception',
      'expand-vendor-exception',
    ].includes(String(v.action.type)) &&
    keys(v.action, ['type', 'approvalId']) &&
    typeof v.action.approvalId === 'string' &&
    /^CARGO-APPROVAL-[1-9][0-9]{0,4}$/.test(v.action.approvalId)
  );
}
export function isCurrentCampaignCommand(v: unknown): v is CampaignCommand {
  if (isV5CampaignCommand(v)) return true;
  if (!object(v)) return false;
  if (v.type === 'incident-command')
    return keys(v, ['type', 'command']) && isCurrentRecordedCommand(v.command);
  if (v.type === 'start-vendor-incident')
    return (
      keys(v, ['type', 'familyId']) && v.familyId === 'nexus-vendor-access-v1'
    );
  return (
    v.type === 'prepare-vendor-exception' &&
    keys(v, ['type', 'scope', 'expiresAtMinute']) &&
    (v.scope === 'api-only' || v.scope === 'api-and-files') &&
    [870, 900, 930].includes(v.expiresAtMinute as number)
  );
}
export function readCurrentGameSave(text: string): Result<FortressSaveV6> {
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
      v.schemaVersion === 5
    ) {
      const old = readV5Save(text);
      return old.ok
        ? {
            ok: true,
            value: createCurrentGameSave(old.value.session, old.value.savedAt),
          }
        : old;
    }
    if (v.schemaVersion !== 6)
      throw new Error('Nieobsługiwana wersja schematu zapisu.');
    if (v.engineVersion !== '12.0.0' || v.contentVersion !== 'nexus-vendor-1')
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
        'Zapis V6 jest niespójny. Bieżąca gra pozostała bez zmian.',
      );
    return { ok: true, value: v as unknown as FortressSaveV6 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Nie udało się odczytać zapisu.',
    };
  }
}
export function serializeCurrentGameSave(save: FortressSaveV6): Result<string> {
  try {
    const text = JSON.stringify(save);
    const valid = readCurrentGameSave(text);
    return valid.ok ? { ok: true, value: text } : valid;
  } catch {
    return { ok: false, error: 'Nie udało się przygotować zapisu V6.' };
  }
}
