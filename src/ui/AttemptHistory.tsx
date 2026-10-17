import type { GameSession } from '../application/gameSession';
import { AfterActionExport } from './AfterActionExport';
import { useEffect, useRef } from 'react';
import type { AttemptSummary } from '../persistence/attemptHistory';
import { HISTORY_LIMIT } from '../persistence/attemptHistory';
import { scenarioCatalog } from '../content/scenarios';

function outcome(entry: AttemptSummary) {
  const failures = [
    !entry.confidentialityMet && 'Utrata poufności',
    !entry.continuityMet && 'Problem operacyjny',
    entry.containmentMet === false && 'Dostęp nieograniczony',
  ].filter(Boolean);
  return failures.length
    ? failures.join(' · ')
    : entry.containmentMet === null
      ? 'Działalność zachowana'
      : 'Cele osiągnięte';
}
export function AttemptHistory({
  entries,
  game,
  error,
  onBack,
  onClear,
  onRetry,
  onReplay,
}: {
  entries: readonly AttemptSummary[];
  game: GameSession;
  error: string;
  onBack: () => void;
  onClear: () => void;
  onRetry: () => void;
  onReplay: (entry: AttemptSummary) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main id="main" className="history-screen">
      <p className="eyebrow">NEXUS / Pamięć operacji</p>
      <h1 ref={heading} tabIndex={-1}>
        Historia prób
      </h1>
      <p>
        Porównaj skutki swoich decyzji. Zachowujemy ostatnie {HISTORY_LIMIT}{' '}
        zakończonych prób na tym urządzeniu. Powtórka rozpoczyna ten sam wariant
        od 14:00.
      </p>
      <p>
        To historia samodzielnych treningów i incydentów. Wyniki strategii są w
        Centrali, w historii bieżącej kampanii.
      </p>
      <div className="history-controls">
        <button onClick={onBack}>Wróć do rozgrywki</button>
        <button disabled={!entries.length && !error} onClick={onClear}>
          Wyczyść historię
        </button>
      </div>
      {error && (
        <div role="alert">
          <p>{error}</p>
          {entries.length > 0 && (
            <button onClick={onRetry}>Ponów zapis historii</button>
          )}
        </div>
      )}
      {entries.length === 0 ? (
        <p className="empty-history">
          Nie ma jeszcze zakończonych prób. Ukończ 18 tur, aby zobaczyć pierwszy
          wynik.
        </p>
      ) : (
        <div
          className="history-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Porównanie zakończonych prób; tabelę można przewijać"
        >
          <table>
            <caption>Wyniki zakończonych operacji — najnowsze na górze</caption>
            <thead>
              <tr>
                <th scope="col">Próba / wariant</th>
                <th scope="col">Dane ujawnione</th>
                <th scope="col">Działalność</th>
                <th scope="col">Ograniczenie zagrożenia</th>
                <th scope="col">Tury / działania</th>
                <th scope="col">Wynik</th>
                <th scope="col">Powtórka</th>
                <th scope="col">Raport szczegółowy</th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((entry) => (
                <tr key={entry.attemptId}>
                  <th scope="row">
                    <strong>
                      {
                        scenarioCatalog.find((s) => s.id === entry.scenarioId)
                          ?.name
                      }
                    </strong>
                    <small>
                      {entry.mode === 'training'
                        ? 'Trening'
                        : 'Nieznany incydent'}{' '}
                      · seed {entry.seed}
                    </small>
                    <small>ID {entry.attemptId.slice(0, 8)}</small>
                    <time dateTime={entry.completedAt}>
                      {new Date(entry.completedAt).toLocaleString('pl-PL')}
                    </time>
                  </th>
                  <td>
                    {entry.exposedRecords} rekordów
                    <small>
                      {entry.containmentMet === null
                        ? 'Brak potwierdzonej złośliwej aktywności'
                        : entry.confidentialityMet
                          ? 'Cel poufności zachowany'
                          : 'Cel poufności utracony'}
                    </small>
                  </td>
                  <td>
                    {entry.processed} obsłużonych
                    <small>{entry.backlog} zaległych</small>
                  </td>
                  <td>
                    {entry.containmentMet === null
                      ? 'Nie dotyczy'
                      : entry.containmentMet
                        ? 'Dostęp odcięty'
                        : 'Dostęp nadal możliwy'}
                  </td>
                  <td>
                    {entry.turns} tur
                    <small>
                      Ukończone zmiany administratora: {entry.keyActions}
                    </small>
                  </td>
                  <td>{outcome(entry)}</td>
                  <td>
                    <button
                      onClick={() => onReplay(entry)}
                      aria-label={`Powtórz próbę ${entry.attemptId.slice(0, 8)}`}
                    >
                      Powtórz
                    </button>
                  </td>
                  <td className="history-aar">
                    {game.kind === 'incident' &&
                    game.operation.attemptId === entry.attemptId &&
                    game.operation.simulation.clock.turn === 18 ? (
                      <AfterActionExport game={game} compact />
                    ) : (
                      <p>
                        Ta próba zawiera wynik, ale pełna chronologia nie jest
                        dostępna w bieżącym zapisie. Nie można odtworzyć
                        szczegółowego raportu z samych liczników.
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
