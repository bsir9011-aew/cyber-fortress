import {
  isCurrentCampaignCommand as isV7CampaignCommand,
  isCurrentRecordedCommand as isV7RecordedCommand,
  readCurrentGameSave as readV7Save,
} from './gameSaveV7';
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
export const CURRENT_GAME_SAVE_KEY = 'fortress-lab.game.v8';
export interface FortressSaveV8 {
  readonly schemaVersion: 8;
  readonly engineVersion: '14.0.0';
  readonly contentVersion: 'nexus-east-1';
  readonly savedAt: string;
  readonly session: GameSession;
}
export function createCurrentGameSave(
  session: GameSession,
  savedAt: string,
): FortressSaveV8 {
  return {
    schemaVersion: 8,
    engineVersion: '14.0.0',
    contentVersion: 'nexus-east-1',
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
  if (isV7RecordedCommand(v)) return true;
  if (
    !object(v) ||
    v.type !== 'schedule-task' ||
    !keys(v, ['type', 'workerId', 'action']) ||
    !object(v.action) ||
    typeof v.action.type !== 'string'
  )
    return false;
  if (
    [
      'inspect-branch-links',
      'inspect-branch-gateway-logs',
      'confirm-branch-requirements',
    ].includes(v.action.type)
  )
    return v.workerId === 'analyst' && keys(v.action, ['type']);
  if (v.workerId !== 'administrator') return false;
  if (v.action.type === 'repair-branch-link') return keys(v.action, ['type']);
  if (v.action.type === 'activate-branch-route')
    return (
      keys(v.action, ['type', 'route']) &&
      (v.action.route === 'primary' || v.action.route === 'backup')
    );
  if (v.action.type === 'set-branch-smb-scope')
    return (
      keys(v.action, ['type', 'scope']) &&
      typeof v.action.scope === 'string' &&
      ['none', 'documents', 'all'].includes(v.action.scope)
    );
  return (
    v.action.type === 'set-branch-account-restriction' &&
    keys(v.action, ['type', 'accountId', 'restricted']) &&
    typeof v.action.accountId === 'string' &&
    ['east-operator', 'east-documents'].includes(v.action.accountId) &&
    typeof v.action.restricted === 'boolean'
  );
}
export function isCurrentCampaignCommand(v: unknown): v is CampaignCommand {
  if (!object(v) || typeof v.type !== 'string') return false;
  if (v.type === 'incident-command')
    return keys(v, ['type', 'command']) && isCurrentRecordedCommand(v.command);
  if (isV7CampaignCommand(v)) return true;
  if (v.type === 'start-branch-incident')
    return (
      keys(v, ['type', 'familyId']) && v.familyId === 'nexus-east-branch-v1'
    );
  if (
    v.type !== 'prepare-branch-architecture' ||
    !keys(v, ['type', 'change']) ||
    !object(v.change)
  )
    return false;
  const c = v.change;
  if (c.component === 'smb')
    return (
      keys(c, ['component', 'scope']) &&
      typeof c.scope === 'string' &&
      ['none', 'documents', 'all'].includes(c.scope)
    );
  return (
    typeof c.component === 'string' &&
    ['erp', 'backup', 'monitoring'].includes(c.component) &&
    keys(c, ['component', 'enabled']) &&
    typeof c.enabled === 'boolean'
  );
}
export function readCurrentGameSave(text: string): Result<FortressSaveV8> {
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
      v.schemaVersion === 7
    ) {
      const old = readV7Save(text);
      return old.ok
        ? {
            ok: true,
            value: createCurrentGameSave(old.value.session, old.value.savedAt),
          }
        : old;
    }
    if (v.schemaVersion !== 8)
      throw new Error('Nieobsługiwana wersja schematu zapisu.');
    if (v.engineVersion !== '14.0.0' || v.contentVersion !== 'nexus-east-1')
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
        'Zapis V8 jest niespójny. Bieżąca gra pozostała bez zmian.',
      );
    return { ok: true, value: v as unknown as FortressSaveV8 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Nie udało się odczytać zapisu.',
    };
  }
}
export function serializeCurrentGameSave(save: FortressSaveV8): Result<string> {
  try {
    const text = JSON.stringify(save);
    const valid = readCurrentGameSave(text);
    return valid.ok ? { ok: true, value: text } : valid;
  } catch {
    return { ok: false, error: 'Nie udało się przygotować zapisu V8.' };
  }
}
