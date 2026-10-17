import type { PlayerView } from '../application/selectPlayerView';
import type { SimulationCommand } from '../domain/simulation';
import { formatMinute } from '../simulation/clock';

export function SimulationTimeBar({
  view,
  onCommand,
  canReset = true,
}: {
  view: PlayerView;
  onCommand: (command: SimulationCommand) => void;
  canReset?: boolean;
}) {
  return (
    <section className="simulation-timebar" aria-label="Zegar symulacji">
      <div className="simulation-time">
        <span className="eyebrow muted">Czas świata</span>
        <strong data-testid="simulation-time">
          {formatMinute(view.minute)}
        </strong>
      </div>
      <div className="turn-progress">
        <span>
          Tura {view.clock.turn} / {view.clock.turnLimit}
        </span>
        <progress
          value={view.clock.turn}
          max={view.clock.turnLimit}
          aria-label="Postęp okna operacyjnego"
        />
        <small>
          {view.finished
            ? 'Okno operacyjne zamknięte'
            : 'Czas stoi podczas planowania'}{' '}
          · termin{' '}
          {formatMinute(
            view.clock.startMinute +
              view.clock.turnMinutes * view.clock.turnLimit,
          )}
        </small>
      </div>
      <button
        className="advance-button"
        onClick={() => onCommand({ type: 'advance-turn' })}
        disabled={view.finished}
      >
        Następne {view.clock.turnMinutes} minut{' '}
        <span aria-hidden="true">→</span>
      </button>
      {canReset && (
        <button
          className="reset-button"
          onClick={() => onCommand({ type: 'reset' })}
        >
          {view.finished ? 'Powtórz ten sam incydent' : 'Powtórz próbę'}
        </button>
      )}
    </section>
  );
}
