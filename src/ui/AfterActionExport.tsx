import { useEffect, useRef, useState } from 'react';
import type { GameSession } from '../application/gameSession';
import type { FortressAfterActionReportV1 } from '../domain/afterActionReport';
import {
  canCreateAfterActionReport,
  createAfterActionReport,
} from '../application/createAfterActionReport';
import {
  AI_COACH_INSTRUCTION,
  encodeAfterActionReport,
} from '../application/afterActionExport';
import { downloadTextFile } from './downloadTextFile';
import './afterAction.css';

export function AfterActionExport({
  game,
  missionId,
  compact = false,
}: {
  game: GameSession;
  missionId?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [manualCopy, setManualCopy] = useState(false);
  const copyRef = useRef<HTMLTextAreaElement>(null);
  const cached = useRef<{
    game: GameSession;
    missionId: string | undefined;
    report: FortressAfterActionReportV1;
  } | null>(null);
  useEffect(() => {
    if (manualCopy) {
      copyRef.current?.focus();
      copyRef.current?.select();
    }
  }, [manualCopy]);
  if (!canCreateAfterActionReport(game, missionId)) return null;
  async function exportReport(format: 'json' | 'markdown') {
    setBusy(true);
    setMessage('');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    try {
      if (
        cached.current?.game !== game ||
        cached.current.missionId !== missionId
      ) {
        const result = createAfterActionReport(
          game,
          missionId,
          new Date().toISOString(),
        );
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        cached.current = { game, missionId, report: result.value };
      }
      downloadTextFile(encodeAfterActionReport(cached.current.report, format));
      setMessage(
        'Raport przygotowany. Zawiera fakty i prawdę ujawnioną po misji. To nie jest zapis do wczytania w grze.',
      );
    } catch {
      setMessage(
        'Nie udało się przygotować pliku raportu. Limit eksportu wynosi 2 MiB; nie pobrano niepełnego pliku.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function copyInstruction() {
    try {
      await navigator.clipboard.writeText(AI_COACH_INSTRUCTION);
      setMessage(
        'Skopiowano instrukcję analizy. Dołącz pobrany raport w wybranej rozmowie z ChatGPT.',
      );
      setManualCopy(false);
    } catch {
      setManualCopy(true);
      setMessage(
        'Schowek jest niedostępny. Zaznaczony tekst poniżej możesz skopiować ręcznie.',
      );
    }
  }
  return (
    <section
      className={`aar-export${compact ? ' aar-compact' : ''}`}
      aria-label="Raport After Action Review"
      data-testid="aar-export"
    >
      {!compact && (
        <>
          <p className="eyebrow">ANALIZA TWOJEJ DECYZYJNOŚCI</p>
          <h2>Co możesz wyciągnąć z tej rozgrywki?</h2>
          <p>
            Incydent zakończony. Możesz przeanalizować swoje decyzje, porównać
            je z rzeczywistym przebiegiem zagrożenia i spróbować ponownie.
          </p>
          <p>
            Pobierz raport rozgrywki i prześlij go do ChatGPT, aby omówić
            decyzje, dostępne dowody, błędne założenia i alternatywne strategie.
          </p>
        </>
      )}
      <div className="aar-actions">
        <button disabled={busy} onClick={() => void exportReport('json')}>
          POBIERZ RAPORT DO ANALIZY AI <small>JSON · AAR V1</small>
        </button>
        <button disabled={busy} onClick={() => void exportReport('markdown')}>
          POBIERZ RAPORT DLA CZŁOWIEKA <small>Markdown · .md</small>
        </button>
        <button disabled={busy} onClick={() => void copyInstruction()}>
          Kopiuj instrukcję analizy
        </button>
      </div>
      {!compact && (
        <p className="source-note">
          Raporty działają offline i nie są zapisami gry. Nic nie jest
          automatycznie wysyłane. Nie potrzebujesz konta ani klucza API do
          pobrania pliku.
        </p>
      )}
      {busy && (
        <p role="status">Odtwarzanie dziennika i przygotowanie raportu…</p>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
      {manualCopy && (
        <label className="aar-copy">
          Instrukcja do ręcznego skopiowania
          <textarea
            ref={copyRef}
            readOnly
            value={AI_COACH_INSTRUCTION}
            rows={14}
          />
        </label>
      )}
    </section>
  );
}
