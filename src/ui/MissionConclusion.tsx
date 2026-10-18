import type { GameplayExperience } from '../application/gameplay/cockpit';
import type { MissionReport } from '../application/selectMissionReport';
import { reportResult } from '../application/gameplay/campaignHistory';
import { actionLabel } from './simulationPresentation';
import { formatMinute } from '../simulation/clock';
export function MissionConclusion({
  report: r,
  decisions,
  onContinue,
}: {
  report: MissionReport;
  decisions: GameplayExperience['decisions'];
  onContinue: () => void;
}) {
  const result = reportResult(r);
  return (
    <section className="mission-conclusion" aria-label="Wnioski po misji">
      <p className="eyebrow">CO SIĘ WYDARZYŁO?</p>
      <h2>{result.label}</h2>
      <p>{r.scenario.explanation}</p>
      <p>
        Obsłużono{' '}
        <strong>
          {r.continuity.processed}/{r.continuity.received}
        </strong>{' '}
        zamówień; zaległe <strong>{r.continuity.backlog}</strong>. Nieuprawniony
        odczyt: {r.confidentiality.exposedRecords} rekordów.
      </p>
      <ul className="goal-summary">
        {result.goals.map(([name, met]) => (
          <li key={name}>
            {name}:{' '}
            <strong>
              {met === null
                ? 'nie dotyczy'
                : met
                  ? 'osiągnięty'
                  : 'pozostał problem'}
            </strong>
          </li>
        ))}
      </ul>
      <p>
        <strong>Pozostały problem: </strong>
        {r.finale?.residualRisk[0] ??
          (r.containment.required && !r.containment.goalMet
            ? 'Dostęp wymaga dalszej uwagi.'
            : r.integrity?.summary.sourceHasWrite
              ? 'Źródło modyfikacji nadal ma możliwość zapisu.'
              : !result.met
                ? 'Sprawdź nieosiągnięte cele i szczegółowy raport.'
                : 'Nie wykazano dalszego problemu w celach tego przebiegu; zakres modelu pozostaje ograniczony.')}
      </p>
      <h3>TWOJE DECYZJE</h3>
      {decisions.length ? (
        decisions.map((d) => (
          <article key={d.task.id}>
            <strong>
              {formatMinute(d.orderedAtMinute)} · {actionLabel(d.task.action)}
            </strong>
            <p>
              W chwili decyzji:{' '}
              {d.known.length
                ? d.known.map((o) => `${o.source}: ${o.text}`).join(' ')
                : 'Brak pozyskanych migawek tych źródeł; dostępne były briefing i jawna konfiguracja.'}
            </p>
            <p>
              Ukończono {formatMinute(d.minute)}. {d.text}
            </p>
          </article>
        ))
      ) : (
        <p>Brak ukończonych zadań. Pełny AAR zachowuje również prace w toku.</p>
      )}
      <p>
        Dalsze skutki mogą obejmować kilka równoległych przyczyn. Pozyskana
        wiedza nie jest równoznaczna z jej przeczytaniem.
      </p>
      <button className="primary-button" onClick={onContinue}>
        Przejdź do następnej decyzji →
      </button>
    </section>
  );
}
