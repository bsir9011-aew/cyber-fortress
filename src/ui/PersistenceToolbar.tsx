import { useRef, useState } from 'react';
import {
  createCurrentGameSave,
  MAX_GAME_BYTES,
  readCurrentGameSave,
  serializeCurrentGameSave,
} from '../persistence/gameSaveV3';
import type { FortressSaveV3 } from '../persistence/gameSaveV3';
import type { GameSession } from '../application/gameSession';

export function PersistenceToolbar({
  game,
  legacyRaw,
  previousRaw,
  canExport,
  status,
  error,
  onRetry,
  onImport,
  onHistory,
}: {
  game: GameSession;
  legacyRaw: string | null;
  previousRaw: string | null;
  canExport: boolean;
  status: string;
  error: string;
  onRetry: () => void;
  onImport: (save: FortressSaveV3) => void;
  onHistory: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  function exportSave() {
    const result = serializeCurrentGameSave(
      createCurrentGameSave(game, new Date().toISOString()),
    );
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const url = URL.createObjectURL(
      new Blob([result.value], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `fortress-lab-${game.kind === 'incident' ? game.operation.attemptId : game.attemptId}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      'Eksport przygotowany. Plik zawiera pełny stan, także ukrytą prawdę incydentu.',
    );
  }
  function exportLegacy(raw: string, version: string) {
    const url = URL.createObjectURL(
      new Blob([raw], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `fortress-lab-original-${version}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      if (file.size > MAX_GAME_BYTES) {
        setMessage('Plik przekracza limit 8 MiB.');
        return;
      }
      const result = readCurrentGameSave(await file.text());
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      onImport(result.value);
    } catch {
      setMessage(
        'Nie udało się odczytać pliku. Bieżąca gra pozostała bez zmian.',
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  return (
    <section className="persistence-toolbar" aria-label="Zapis i pliki">
      <div className="save-indicator" role="status" aria-live="polite">
        <strong className={error ? 'warning-text' : ''}>{status}</strong>
        <span>Tylko na tym urządzeniu i w tej przeglądarce.</span>
      </div>
      <div className="persistence-actions">
        {error && canExport && <button onClick={onRetry}>Ponów zapis</button>}
        <button disabled={!canExport} onClick={exportSave}>
          Eksportuj zapis
        </button>
        <button disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Sprawdzanie pliku…' : 'Importuj zapis'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          aria-label="Plik zapisu JSON"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
        {legacyRaw !== null && (
          <button onClick={() => exportLegacy(legacyRaw, 'v1')}>
            Eksportuj oryginał V1
          </button>
        )}
        {previousRaw !== null && (
          <button onClick={() => exportLegacy(previousRaw, 'v2')}>
            Eksportuj oryginał V2
          </button>
        )}
        <button onClick={onHistory}>Historia prób</button>
      </div>
      {error && (
        <p role="alert" className="persistence-message">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="persistence-message">
          {message}
        </p>
      )}
    </section>
  );
}
