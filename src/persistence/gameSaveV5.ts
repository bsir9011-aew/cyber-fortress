import {
  isCurrentCampaignCommand as isV4CampaignCommand,
  isCurrentRecordedCommand as isV4RecordedCommand,
  readCurrentGameSave as readV4Save,
} from './gameSaveV4';
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
export const CURRENT_GAME_SAVE_KEY = 'fortress-lab.game.v5';
export interface FortressSaveV5 {
  readonly schemaVersion: 5;
  readonly engineVersion: '11.0.0';
  readonly contentVersion: 'nexus-detection-1';
  readonly savedAt: string;
  readonly session: GameSession;
}
export function createCurrentGameSave(
  session: GameSession,
  savedAt: string,
): FortressSaveV5 {
  return {
    schemaVersion: 5,
    engineVersion: '11.0.0',
    contentVersion: 'nexus-detection-1',
    savedAt,
    session,
  };
}
export const isCurrentRecordedCommand = isV4RecordedCommand;
export function isCurrentCampaignCommand(v: unknown): v is CampaignCommand {
  if (isV4CampaignCommand(v)) return true;
  if (!object(v)) return false;
  if (v.type === 'start-detection-incident')
    return (
      keys(v, ['type', 'familyId']) &&
      v.familyId === 'nexus-integrity-detection-v1'
    );
  return (
    v.type === 'configure-endpoint-detection' &&
    keys(v, ['type', 'endpointId', 'threshold', 'windowMinutes']) &&
    v.endpointId === 'pakowanie-03' &&
    typeof v.threshold === 'number' &&
    Number.isSafeInteger(v.threshold) &&
    v.threshold >= 2 &&
    v.threshold <= 30 &&
    [5, 10, 20].includes(v.windowMinutes as number)
  );
}
export function readCurrentGameSave(text: string): Result<FortressSaveV5> {
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
      v.schemaVersion === 4
    ) {
      const old = readV4Save(text);
      return old.ok
        ? {
            ok: true,
            value: createCurrentGameSave(old.value.session, old.value.savedAt),
          }
        : old;
    }
    if (v.schemaVersion !== 5)
      throw new Error('Nieobsługiwana wersja schematu zapisu.');
    if (
      v.engineVersion !== '11.0.0' ||
      v.contentVersion !== 'nexus-detection-1'
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
        'Zapis V5 jest niespójny. Bieżąca gra pozostała bez zmian.',
      );
    return { ok: true, value: v as unknown as FortressSaveV5 };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Nie udało się odczytać zapisu.',
    };
  }
}
export function serializeCurrentGameSave(save: FortressSaveV5): Result<string> {
  try {
    const text = JSON.stringify(save);
    const valid = readCurrentGameSave(text);
    return valid.ok ? { ok: true, value: text } : valid;
  } catch {
    return { ok: false, error: 'Nie udało się przygotować zapisu V5.' };
  }
}
