import type { GameSession } from '../application/gameSession';
import type { StorageAdapter } from './localStorage';
import { SAVE_KEY } from './localStorage';
import { GAME_SAVE_KEY } from './gameSave';
import {
  createCurrentGameSave,
  CURRENT_GAME_SAVE_KEY,
  readCurrentGameSave,
  serializeCurrentGameSave,
} from './gameSaveV3';
import type { Result } from './saveFormat';
/** Original bytes stay exportable even when replay validation rejects them. */
export function loadCurrentGameState(storage: StorageAdapter) {
  let legacyRaw: string | null = null;
  let previousRaw: string | null = null;
  let result: Result<GameSession | null>;
  try {
    legacyRaw = storage.getItem(SAVE_KEY);
    previousRaw = storage.getItem(GAME_SAVE_KEY);
    const current = storage.getItem(CURRENT_GAME_SAVE_KEY);
    const text = current ?? previousRaw ?? legacyRaw;
    if (text === null) result = { ok: true, value: null };
    else {
      const parsed = readCurrentGameSave(text);
      result = parsed.ok ? { ok: true, value: parsed.value.session } : parsed;
    }
  } catch {
    result = {
      ok: false,
      code: 'storage-unavailable',
      error:
        'Pamięć przeglądarki jest niedostępna. Gra działa dalej; możesz eksportować zapis.',
    };
  }
  return { result, legacyRaw, previousRaw };
}
export function storeCurrentGameState(
  storage: StorageAdapter,
  game: GameSession,
  savedAt: string,
): Result<null> {
  const encoded = serializeCurrentGameSave(
    createCurrentGameSave(game, savedAt),
  );
  if (!encoded.ok) return encoded;
  try {
    storage.setItem(CURRENT_GAME_SAVE_KEY, encoded.value);
    return { ok: true, value: null };
  } catch {
    return {
      ok: false,
      error:
        'Zapis nie powiódł się: brak miejsca lub dostępu do pamięci przeglądarki. Wyeksportuj zapis.',
    };
  }
}
