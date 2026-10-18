import type { GameplayExperience } from '../application/gameplay/cockpit';
import { formatMinute } from '../simulation/clock';
import { actionLabel } from './simulationPresentation';
const resultLabels: Record<string, string> = {
  succeeded: 'Powodzenie',
  failed: 'Niepowodzenie',
  partial: 'Częściowy skutek',
  observed: 'Pozyskano obserwację',
  completed: 'Praca zakończona',
  applied: 'Zmiana zastosowana',
  unconfirmed: 'Brak potwierdzenia skutku',
};
const workers = { administrator: 'Administrator', analyst: 'Analityk' };
export function DecisionCockpit({
  experience: e,
}: {
  experience: GameplayExperience;
}) {
  const v = e.player,
    remaining = (v.clock.turnLimit - v.clock.turn) * v.clock.turnMinutes;
  return (
    <section className="decision-cockpit" aria-label="Decision Cockpit">
      <div className="situation-strip" aria-label="Situation Bar">
        <strong>
          {formatMinute(v.minute)} <small>pozostało {remaining} min</small>
        </strong>
        <span>
          Otrzymane <b>{v.business.totalReceived}</b>
        </span>
        <span>
          Obsłużone <b>{v.business.totalProcessed}</b>
        </span>
        <span>
          Zaległe <b>{v.business.backlog}</b>
        </span>
        <span>
          Wydajność <b>{v.availability.capacity}/turę</b>
        </span>
      </div>
      <section className="team-operations" aria-label="Team Operations">
        <h2>TEAM OPERATIONS</h2>
        <div>
          {(['administrator', 'analyst'] as const).map((worker) => {
            const t = v.tasks.find(
              (t) => t.workerId === worker && t.status === 'running',
            );
            const last = e.feedback
              .filter((r) => r.task.workerId === worker)
              .at(-1);
            return (
              <article key={worker} data-worker-id={worker}>
                <strong>
                  {workers[worker]} ·{' '}
                  {t ? 'zajęty' : v.finished ? 'misja zakończona' : 'wolny'}
                </strong>
                {t ? (
                  <p>
                    {actionLabel(t.action)}
                    <br />
                    {formatMinute(
                      v.clock.startMinute + t.startTurn * v.clock.turnMinutes,
                    )}{' '}
                    →{' '}
                    {formatMinute(
                      v.clock.startMinute + t.dueTurn * v.clock.turnMinutes,
                    )}
                  </p>
                ) : (
                  <p>{last ? last.text : 'Gotowy do zlecenia pracy.'}</p>
                )}
              </article>
            );
          })}
        </div>
        <details>
          <summary>Ukończone prace i wyniki ({e.feedback.length})</summary>
          {e.feedback
            .slice()
            .reverse()
            .map((r) => (
              <p key={r.task.id}>
                {formatMinute(r.minute)} · {actionLabel(r.task.action)} ·{' '}
                {resultLabels[r.status] ?? r.status}: {r.text}
              </p>
            ))}
        </details>
      </section>
      {e.lastTurn && (
        <details className="turn-recap" open key={e.lastTurn.turn}>
          <summary>
            OSTATNIE {v.clock.turnMinutes} MINUT · tura {e.lastTurn.turn}
          </summary>
          <p>
            Przyjęto {e.lastTurn.received}, obsłużono {e.lastTurn.processed}.
            Zaległości{' '}
            {e.lastTurn.backlogChange > 0
              ? 'wzrosły o'
              : e.lastTurn.backlogChange < 0
                ? 'spadły o'
                : 'bez zmian:'}{' '}
            {Math.abs(e.lastTurn.backlogChange)}.
            {e.lastTurn.capacityChange !== null &&
              e.lastTurn.capacityChange !== 0 &&
              ` Wydajność rozliczonego przedziału zmieniła się o ${e.lastTurn.capacityChange}.`}
          </p>
          <div role="status" aria-live="polite">
            {e.lastTurn.notices.slice(0, 4).map((n, i) => (
              <p key={i}>
                <span className="fact-kind">
                  {n.kind === 'observation' ? 'Obserwacja' : 'Operacja'}
                </span>{' '}
                {n.text}
              </p>
            ))}
          </div>
          {e.lastTurn.notices.length > 4 && (
            <details>
              <summary>
                Pozostałe informacje ({e.lastTurn.notices.length - 4})
              </summary>
              {e.lastTurn.notices.slice(4).map((n, i) => (
                <p key={i}>
                  {n.kind === 'observation' ? 'Obserwacja' : 'Operacja'} ·{' '}
                  {n.text}
                </p>
              ))}
            </details>
          )}
          <small>
            Hipoteza gracza jest interpretacją. Szczegółowe dowody pozostają w
            panelu sprawy.
          </small>
        </details>
      )}
    </section>
  );
}
export function BusinessContributions({
  experience: e,
}: {
  experience: GameplayExperience;
}) {
  return (
    <section className="process-contributions" aria-label="Co obecnie pracuje">
      <h3>CO OBECNIE PRACUJE?</h3>
      {e.business.map((c) => (
        <details key={c.id}>
          <summary>
            {c.name}{' '}
            <strong>
              {c.current}/{c.maximum}
            </strong>
          </summary>
          <p>
            Fakt: aktualnie {c.current} zamówień wydajności na turę. Warunek:{' '}
            {c.condition}
          </p>
          {c.evidence.map((o) => (
            <p key={o.id}>
              Pozyskane {formatMinute(o.obtained)} · {o.source}: {o.text}
            </p>
          ))}
          {c.unknown && (
            <p>
              {c.unknown} Obserwacje są migawkami, nie bieżącą diagnozą
              wszystkich zależności.
            </p>
          )}
        </details>
      ))}
      <p>
        Suma: <strong>{e.player.availability.capacity}</strong> /{' '}
        {e.business.reduce((n, c) => n + c.maximum, 0)}. Wydajność nie jest
        liczbą faktycznie zrealizowanych zamówień.
      </p>
    </section>
  );
}
