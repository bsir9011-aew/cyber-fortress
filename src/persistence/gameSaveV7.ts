import {
  isCurrentCampaignCommand as isV6CampaignCommand,
  isCurrentRecordedCommand as isV6RecordedCommand,
  readCurrentGameSave as readV6Save,
} from './gameSaveV6';
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
export const CURRENT_GAME_SAVE_KEY = 'fortress-lab.game.v7';
export interface FortressSaveV7 {
  readonly schemaVersion: 7;
  readonly engineVersion: '13.0.0';
  readonly contentVersion: 'nexus-recovery-1';
  readonly savedAt: string;
  readonly session: GameSession;
}
export function createCurrentGameSave(
  session: GameSession,
  savedAt: string,
): FortressSaveV7 {
  return {
    schemaVersion: 7,
    engineVersion: '13.0.0',
    contentVersion: 'nexus-recovery-1',
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
  if (isV6RecordedCommand(v)) return true;
  if (
    !object(v) ||
    v.type !== 'schedule-task' ||
    !keys(v, ['type', 'workerId', 'action']) ||
    !object(v.action) ||
    typeof v.action.type !== 'string'
  )
    return false;
  const analyst = [
    'inspect-erp-service',
    'inspect-erp-database',
    'inspect-erp-backups',
    'contact-warehouse-operations',
    'inspect-erp-consistency',
    'reconcile-erp-records',
  ];
  const administrator = [
    'restart-erp-service',
    'switch-erp-standby',
    'start-manual-shipping',
    'close-manual-shipping',
  ];
  if (analyst.includes(v.action.type))
    return v.workerId === 'analyst' && keys(v.action, ['type']);
  if (administrator.includes(v.action.type))
    return v.workerId === 'administrator' && keys(v.action, ['type']);
  return (
    ((v.action.type === 'verify-erp-backup' && v.workerId === 'analyst') ||
      (v.action.type === 'restore-erp-backup' &&
        v.workerId === 'administrator')) &&
    keys(v.action, ['type', 'backupId']) &&
    typeof v.action.backupId === 'string' &&
    ['ERP-1320', 'ERP-1350'].includes(v.action.backupId)
  );
}
export function isCurrentCampaignCommand(v: unknown): v is CampaignCommand {
  if (!object(v) || typeof v.type !== 'string') return false;
  if (v.type === 'incident-command')
    return keys(v, ['type', 'command']) && isCurrentRecordedCommand(v.command);
  if (isV6CampaignCommand(v)) return true;
  return (
    v.type === 'start-recovery-incident' &&
    keys(v, ['type', 'familyId']) &&
    v.familyId === 'nexus-erp-recovery-v1'
  );
}
export function readCurrentGameSave(text: string): Result<FortressSaveV7> {
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
      v.schemaVersion === 6
    ) {
      const old = readV6Save(text);
      return old.ok
        ? {
            ok: true,
            value: createCurrentGameSave(old.value.session, old.value.savedAt),
          }
        : old;
    }
    if (v.schemaVersion !== 7)
      throw new Error('Nieobsługiwana wersja schematu zapisu.');
    if (v.engineVersion !== '13.0.0' || v.contentVersion !== 'nexus-recovery-1')
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
        'Zapis V7 jest niespójny. Bieżąca gra pozostała bez zmian.',
      );
    return { ok: true, value: v as unknown as FortressSaveV7 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Nie udało się odczytać zapisu.',
    };
  }
}
export function serializeCurrentGameSave(save: FortressSaveV7): Result<string> {
  try {
    const text = JSON.stringify(save);
    const valid = readCurrentGameSave(text);
    return valid.ok ? { ok: true, value: text } : valid;
  } catch {
    return { ok: false, error: 'Nie udało się przygotować zapisu V7.' };
  }
}
