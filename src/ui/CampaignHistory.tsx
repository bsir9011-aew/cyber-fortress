import { campaignMissions } from '../application/gameplay/campaignExperience';
import { projectDefinition } from '../content/securityProjects';
import { useState } from 'react';
import type { StrategicSession } from '../application/gameSession';
import type { selectRecordedCampaignHistory } from '../application/gameplay/campaignHistory';
import { campaignAarMissionId } from '../application/createAfterActionReport';
import { AfterActionExport } from './AfterActionExport';
export function CampaignHistory({
  session,
  rows,
}: {
  session: StrategicSession;
  rows: ReturnType<typeof selectRecordedCampaignHistory>;
}) {
  const [first, setFirst] = useState(0),
    [second, setSecond] = useState(0);
  const a =
    rows.find((r) => r.number === first) ??
    rows.find((r) =>
      rows.some((b) => b.family === r.family && b.number !== r.number),
    );
  const b =
    rows.find(
      (r) =>
        r.number === second && r.family === a?.family && r.number !== a?.number,
    ) ?? rows.find((r) => r.family === a?.family && r.number !== a?.number);
  return (
    <section className="campaign-history" aria-label="Historia kampanii">
      <h2>Historia decyzji i prób</h2>
      {!rows.length && (
        <p>
          Jeszcze nie ukończono misji. Historia powstaje z rzeczywistego
          przebiegu kampanii.
        </p>
      )}
      {rows.map((r) => (
        <article key={r.number}>
          <h3>
            {r.family} · {campaignMissions.find((m) => m.id === r.family)?.name}{' '}
            <small>
              próba {r.number}
              {r.repeat ? ' · ponowienie' : ''}
            </small>
          </h3>
          <strong>
            {r.detail?.result.label ??
              'Szczegółowy wynik celów: brak danych w dostępnej historii'}
          </strong>
          <p>
            {r.name}. Obsłużone {r.processed} · zaległe {r.backlog} · ujawnione
            rekordy {r.exposedRecords}. Aktywne inwestycje:{' '}
            {r.activeProjects
              .map((id) => projectDefinition(id).name)
              .join(', ') || 'brak'}
            .
          </p>
          {r.detail && (
            <ul>
              {r.detail.result.goals.map(([name, met]) => (
                <li key={name}>
                  {name}:{' '}
                  {met === null
                    ? 'nie dotyczy'
                    : met
                      ? 'osiągnięty'
                      : 'nieosiągnięty'}
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary>Zachowana architektura i działania</summary>
            {r.detail ? (
              <>
                <p>
                  Ukończonych prac:{' '}
                  {Object.values(r.detail.actions).reduce((n, v) => n + v, 0)}.
                </p>
                <ul>
                  {Object.entries(r.detail.actions).map(([type, count]) => (
                    <li key={type}>
                      {type}: {count}
                    </li>
                  ))}
                </ul>
                <pre>{JSON.stringify(r.detail.architecture, null, 2)}</pre>
                <p>
                  Konfiguracja w chwili startu tej zapisanej próby, nie
                  alternatywna symulacja.
                </p>
              </>
            ) : (
              <p>
                Brak szczegółowego dziennika. Nie odtwarzamy brakujących
                decyzji.
              </p>
            )}
          </details>
          <details>
            <summary>Eksport AAR tej próby</summary>
            <AfterActionExport
              game={session}
              missionId={campaignAarMissionId(session.attemptId, r.number)}
              compact
            />
          </details>
        </article>
      ))}
      {a && b && (
        <section className="attempt-comparison" aria-label="Porównanie prób">
          <h3>Porównaj dwie zapisane próby tej samej misji</h3>
          <label>
            Pierwsza próba
            <select
              value={a.number}
              onChange={(e) => setFirst(Number(e.target.value))}
            >
              {rows
                .filter((r) =>
                  rows.some(
                    (o) => o.family === r.family && o.number !== r.number,
                  ),
                )
                .map((r) => (
                  <option key={r.number} value={r.number}>
                    {r.family} · próba {r.number}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Druga próba
            <select
              value={b.number}
              onChange={(e) => setSecond(Number(e.target.value))}
            >
              {rows
                .filter((r) => r.family === a.family && r.number !== a.number)
                .map((r) => (
                  <option key={r.number} value={r.number}>
                    {r.family} · próba {r.number}
                  </option>
                ))}
            </select>
          </label>
          <table>
            <caption>
              Porównanie dostępnych wspólnych miar — bez rankingu
            </caption>
            <thead>
              <tr>
                <th>Miara</th>
                <th>Próba {a.number}</th>
                <th>Próba {b.number}</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Obsłużone', a.processed, b.processed],
                  ['Zaległości', a.backlog, b.backlog],
                  ['Ekspozycja rekordów', a.exposedRecords, b.exposedRecords],
                  [
                    'Wynik',
                    a.detail?.result.label ?? 'brak danych',
                    b.detail?.result.label ?? 'brak danych',
                  ],
                  [
                    'Działania',
                    a.detail
                      ? Object.values(a.detail.actions).reduce(
                          (n, v) => n + v,
                          0,
                        )
                      : 'brak danych',
                    b.detail
                      ? Object.values(b.detail.actions).reduce(
                          (n, v) => n + v,
                          0,
                        )
                      : 'brak danych',
                  ],
                  [
                    'Inwestycje',
                    a.activeProjects
                      .map((id) => projectDefinition(id).name)
                      .join(', ') || 'brak',
                    b.activeProjects
                      .map((id) => projectDefinition(id).name)
                      .join(', ') || 'brak',
                  ],
                ] as const
              ).map(([name, x, y]) => (
                <tr key={name}>
                  <th>{name}</th>
                  <td>{x}</td>
                  <td>{y}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Rodzaje działań i konfiguracje znajdują się przy każdej próbie
            powyżej. Nie symulowano alternatywnych decyzji.
          </p>
        </section>
      )}
    </section>
  );
}
