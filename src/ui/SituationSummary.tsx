import type { GameplayExperience } from '../application/gameplay/cockpit';
import { formatMinute } from '../simulation/clock';
export function SituationSummary({
  experience: e,
}: {
  experience: GameplayExperience;
}) {
  const v = e.player;
  return (
    <section className="situation-summary">
      <p className="eyebrow">SYTUACJA → DOWODY → DECYZJA</p>
      <h2>Firma musi obsługiwać zamówienia. Co już ustalono?</h2>
      <p>
        Aktualna użyteczna wydajność: {v.availability.capacity}/turę.
        Zaległości: {v.business.backlog}. Dostępność procesu nie identyfikuje
        przyczyny ograniczenia.
      </p>
      <h3>Ostatnie pozyskane informacje</h3>
      {e.signals.length ? (
        e.signals.slice(-3).map((o) => (
          <p key={o.id}>
            <strong>
              {formatMinute(o.obtained)} · {o.source}
            </strong>{' '}
            {o.text}
          </p>
        ))
      ) : (
        <p>
          Nie pozyskano jeszcze badań. Przyczyna nieustalona; wybierz źródło w
          INVESTIGATE.
        </p>
      )}
      <p>
        Czego jeszcze nie potwierdzono:{' '}
        {!v.authObservations.length ? 'logi logowania; ' : ''}
        {v.integrity && !v.integrity.observations.length
          ? 'poprawność dokumentów; '
          : ''}
        {v.recovery && !v.recovery.observations.length
          ? 'działanie aplikacji i jej zależności; '
          : ''}
        {v.branch && !v.branch.observations.length
          ? 'stan łączy oddziału; '
          : ''}
        tożsamość człowieka za kontem i zamiar operacji wymagają osobnego
        uzasadnienia.
      </p>
      <a href="#team-actions">Wybierz badanie lub działanie zespołu →</a>
    </section>
  );
}
