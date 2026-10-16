import type { PlayerView } from '../application/selectPlayerView';

export function MissionBriefing({
  onStart,
  view,
}: {
  onStart: () => void;
  view: PlayerView;
}) {
  return (
    <main id="main" className="briefing-screen">
      <div className="briefing-copy">
        <span className="eyebrow">
          NEXUS Logistics /{' '}
          {view.run.mode === 'training' ? 'Trening' : 'Nieznany incydent'}
        </span>
        <span className="mission-tag">14:00 — 15:30 · 18 tur</span>
        <h1>
          Ostatnie okno
          <br />
          <span className="accent">wysyłkowe.</span>
        </h1>
        <p className="briefing-role">
          Pierwszy dzień w roli Security Engineer.
        </p>
        <blockquote>
          <span className="speaker-tag">Ewa · kierowniczka operacji</span>
          {view.briefing.message}
        </blockquote>
        <div className="briefing-objectives">
          <article>
            <span className="eyebrow">Cel 01 / Poufność</span>
            <h2>Chroń dane operacyjne</h2>
            <p>
              Cel: 0 ujawnionych rekordów z {view.recordPool}. Podczas gry znasz
              tylko to, co uda się zaobserwować.
            </p>
          </article>
          <article>
            <span className="eyebrow">Cel 02 / Ciągłość</span>
            <h2>Dowieź wysyłki</h2>
            <p>
              Do 15:30 pozostaw najwyżej {view.maxFinalBacklog} zaległych
              zamówień. Zdalny zespół potrzebuje ERP przez VPN.
            </p>
          </article>
        </div>
        <button className="primary-button" onClick={onStart} autoFocus>
          Rozpocznij dochodzenie <span aria-hidden="true">→</span>
        </button>
        <p className="briefing-time-note">
          Zegar stoi, gdy czytasz i planujesz. Tylko „Następne 5 minut” porusza
          świat.
        </p>
      </div>
      <aside className="briefing-resources" aria-label="Zespół misji">
        <div className="briefing-emblem" aria-hidden="true">
          ⌖<span>NEXUS / OPERATIONS</span>
        </div>
        <p className="eyebrow">Masz do dyspozycji</p>
        <h2>
          Dwie osoby.
          <br />
          Dwa rodzaje pracy.
        </h2>
        <article>
          <span className="resource-monogram">A</span>
          <div>
            <h3>Analityk</h3>
            <p>{view.briefing.analystHint}</p>
          </div>
        </article>
        <article>
          <span className="resource-monogram">B</span>
          <div>
            <h3>Bartek · administrator</h3>
            <p>
              Kończy tunele, zmienia logowania i reguły dostępu. Każda zmiana
              wymaga czasu.
            </p>
          </div>
        </article>
        <p className="briefing-footnote">
          Każda osoba wykonuje jedno zadanie naraz. Mogą pracować równolegle.
          Nie musisz czekać na komplet dowodów, aby podjąć decyzję.
        </p>
      </aside>
    </main>
  );
}
