import type { PlayerView } from '../application/selectPlayerView';
import { formatMinute } from '../simulation/clock';
import { eventLabel } from './simulationPresentation';

export function SimulationEventLog({ view }: { view: PlayerView }) {
  return (
    <section className="simulation-events" aria-label="Dziennik operacyjny">
      <div className="event-log-heading">
        <h2>Dziennik operacyjny</h2>
        <span>Potwierdzenia działań i raporty firmy</span>
      </div>
      {view.history.length === 0 ? (
        <p className="source-note">
          Brak wykonanych działań. Firma czeka na pierwszy przedział operacyjny.
        </p>
      ) : (
        <ol>
          {[...view.history].reverse().map((event) => (
            <li key={event.id} className={`event-${event.kind}`}>
              <time>{formatMinute(event.minute)}</time>
              <span>{eventLabel(event)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
