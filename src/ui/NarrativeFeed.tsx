import type { PlayerView } from '../application/selectPlayerView';
import { formatMinute } from '../simulation/clock';

export function NarrativeFeed({ view }: { view: PlayerView }) {
  return (
    <section className="narrative-panel" aria-label="Wiadomości zespołu">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Ludzie i konsekwencje</span>
          <h2>Wiadomości zespołu</h2>
        </div>
        <span className="muted">{view.messages.length} wiadomości</span>
      </div>
      <ol
        className="narrative-feed"
        aria-live="polite"
        aria-relevant="additions"
      >
        {[...view.messages].reverse().map((message) => (
          <li key={message.id}>
            <span
              className={`message-avatar speaker-${message.speaker}`}
              aria-hidden="true"
            >
              {message.speaker[0]}
            </span>
            <div>
              <div className="message-byline">
                <strong>{message.speaker}</strong>
                <time>{formatMinute(message.minute)}</time>
                <small>
                  {message.source === 'human-statement'
                    ? 'relacja człowieka'
                    : message.source === 'configuration'
                      ? 'potwierdzenie zmiany'
                      : message.source === 'business'
                        ? 'obserwacja biznesowa'
                        : message.source === 'task'
                          ? 'wynik badania'
                          : 'briefing'}
                </small>
              </div>
              <p>{message.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
