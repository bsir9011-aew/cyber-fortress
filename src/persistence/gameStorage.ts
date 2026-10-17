import type { GameSession } from '../application/gameSession';
import type { StorageAdapter } from './localStorage';
import { SAVE_KEY } from './localStorage';
import {
  createGameSave,
  GAME_SAVE_KEY,
  readGameSave,
  serializeGameSave,
} from './gameSave';
import type { Result } from './saveFormat';
export function loadGameState(storage: StorageAdapter) {
  let legacyRaw: string | null = null;
  let result: Result<GameSession | null>;
  try {
    legacyRaw = storage.getItem(SAVE_KEY);
    const current = storage.getItem(GAME_SAVE_KEY);
    const text = current ?? legacyRaw;
    if (text === null) result = { ok: true, value: null };
    else {
      const parsed = readGameSave(text);
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
  return { result, legacyRaw };
}
/** Nigdy nie zapisuje ani nie usuwa klucza V1, także po poprawnej migracji. */
export function storeGameState(
  storage: StorageAdapter,
  game: GameSession,
  savedAt: string,
): Result<null> {
  const encoded = serializeGameSave(createGameSave(game, savedAt));
  if (!encoded.ok) return encoded;
  try {
    storage.setItem(GAME_SAVE_KEY, encoded.value);
    return { ok: true, value: null };
  } catch {
    return {
      ok: false,
      error:
        'Zapis nie powiódł się: brak miejsca lub dostępu do pamięci przeglądarki. Wyeksportuj zapis.',
    };
  }
}
