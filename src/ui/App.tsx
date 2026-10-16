import { nexusLogistics } from '../content/organization';

export function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="FORTRESS LAB — ekran główny">
          <span className="brand-mark" aria-hidden="true">⬡</span>
          <span>FORTRESS <span className="accent">LAB</span></span>
        </a>
        <span className="version">Wersja developerska 0.2</span>
      </header>

      <main id="main">
        <section className="intro" aria-labelledby="welcome-title">
          <p className="eyebrow">Centrum operacyjne · {nexusLogistics.name}</p>
          <h1 id="welcome-title">Firma musi działać.</h1>
          <p className="lead">
            Poznaj infrastrukturę. Zrozum zależności. Podejmuj decyzje,
            których konsekwencje odczuje cała organizacja.
          </p>
        </section>

        <section className="workspace" aria-labelledby="map-title">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Infrastruktura IT</p>
              <h2 id="map-title">{nexusLogistics.name}</h2>
            </div>
            <span className="tag">Bootstrap 0.2</span>
          </div>
          <div className="map-placeholder">
            <svg className="map-grid" viewBox="0 0 800 280" role="img" aria-labelledby="map-description">
              <title id="map-description">Obszar przyszłej mapy infrastruktury SVG. Brak wczytanego scenariusza.</title>
              <defs>
                <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 H 0 V 32" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="800" height="280" fill="url(#grid)" />
            </svg>
            <div className="empty-state">
              <span className="empty-symbol" aria-hidden="true">＋</span>
              <h3>Przestrzeń dla infrastruktury</h3>
              <p>Scenariusz nie jest jeszcze wczytany.</p>
            </div>
          </div>
          <p className="panel-note">Mapa będzie przedstawiać zasoby i relacje między nimi.</p>
        </section>

        <aside className="development-note" aria-labelledby="development-title">
          <span className="note-marker" aria-hidden="true">i</span>
          <div>
            <h2 id="development-title">Fundament pod kolejne decyzje</h2>
            <p>
              To wersja developerska FORTRESS LAB. Symulacja, incydenty i pierwsza
              misja zostaną dodane w kolejnych etapach.
            </p>
          </div>
        </aside>
      </main>

      <footer>Nauka cyberbezpieczeństwa poprzez decyzje i ich konsekwencje.</footer>
    </div>
  );
}
