import { readSave, serializeSave } from './saveFormat';
import type { FortressSaveV1, Result } from './saveFormat';
import { readHistory } from './attemptHistory';
import type { HistoryDocument } from './attemptHistory';

export const SAVE_KEY = 'fortress-lab.save.v1';
export const HISTORY_KEY = 'fortress-lab.history.v1';
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
// Dostęp do window.localStorage też może rzucić SecurityError.
export function browserStorage(): StorageAdapter {
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  };
}
function read<T>(
  storage: StorageAdapter,
  key: string,
  parse: (text: string) => Result<T>,
): Result<T | null> {
  try {
    const text = storage.getItem(key);
    return text === null ? { ok: true, value: null } : parse(text);
  } catch {
    return {
      ok: false,
      error:
        'Pamięć przeglądarki jest niedostępna. Gra działa dalej; możesz eksportować zapis.',
      code: 'storage-unavailable',
    };
  }
}
function write(
  storage: StorageAdapter,
  key: string,
  text: string,
): Result<null> {
  try {
    storage.setItem(key, text);
    return { ok: true, value: null };
  } catch {
    return {
      ok: false,
      error:
        'Zapis nie powiódł się: brak miejsca lub dostępu do pamięci przeglądarki. Wyeksportuj zapis.',
    };
  }
}
export const loadLocalSave = (storage: StorageAdapter) =>
  read(storage, SAVE_KEY, readSave);
export const loadAttemptHistory = (storage: StorageAdapter) =>
  read(storage, HISTORY_KEY, readHistory);
export function storeLocalSave(
  storage: StorageAdapter,
  save: FortressSaveV1,
): Result<null> {
  const text = serializeSave(save);
  return text.ok ? write(storage, SAVE_KEY, text.value) : text;
}
export function storeAttemptHistory(
  storage: StorageAdapter,
  history: HistoryDocument,
) {
  return write(storage, HISTORY_KEY, JSON.stringify(history));
}
export function clearAttemptHistory(
  storage: StorageAdapter,
  clearedAt: string,
): Result<null> {
  return storeAttemptHistory(storage, {
    schemaVersion: 1,
    attempts: [],
    clearedAt,
  });
}
