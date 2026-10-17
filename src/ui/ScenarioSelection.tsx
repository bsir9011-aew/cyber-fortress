import type { ScenarioMode } from '../domain/scenario';

export function ScenarioSelection({
  onSelect,
  autoFocus = true,
  onStrategy,
}: {
  onSelect: (mode: ScenarioMode) => void;
  autoFocus?: boolean;
  onStrategy?: () => void;
}) {
  return (
    <main id="main" className="scenario-selection">
      <div className="selection-heading">
        <p className="eyebrow">Rozpocznij nową grę · wybierz tryb</p>
        <span className="eyebrow">FORTRESS LAB / The Uncertainty Protocol</span>
        <h1>
          Ten sam sygnał.
          <br />
          <span className="accent">Czy ta sama przyczyna?</span>
        </h1>
        <p>
          NEXUS Logistics czeka na Twoją decyzję. Zbadaj dostępne fakty, chroń
          dane i utrzymaj wysyłki.
        </p>
      </div>
      {onStrategy && (
        <article className="strategy-entry">
          <span className="eyebrow">03 / Odpowiadasz za firmę</span>
          <div>
            <h2>Strategia — Centrala NEXUS</h2>
            <p>
              68 000 zł rezerwy. Dwie osoby. Cztery godziny na przygotowanie.
              Wybierz inwestycje, sprawdź zależności i zachowaj skutki na
              kolejne incydenty.
            </p>
          </div>
          <button className="primary-button" onClick={onStrategy}>
            Rozpocznij strategię →
          </button>
        </article>
      )}
      <div className="mode-cards">
        <article>
          <span className="mode-number">01 / Poznaj mechanizmy</span>
          <h2>Trening</h2>
          <p>
            Dotychczasowa misja referencyjna. Poznaj zegar, źródła dowodów i
            konsekwencje zmian dostępu.
          </p>
          <ul>
            <li>18 tur, bez presji czasu rzeczywistego</li>
            <li>Ten sam punkt startowy przy powtórce</li>
            <li>Oddzielne cele poufności i wysyłek</li>
          </ul>
          <button
            className="primary-button"
            onClick={() => onSelect('training')}
            autoFocus={autoFocus}
          >
            Rozpocznij trening →
          </button>
        </article>
        <article className="unknown-mode">
          <span className="mode-number">02 / Zaufaj analizie</span>
          <h2>Nieznany incydent</h2>
          <p>
            Podobny sygnał może mieć różne przyczyny. Typ incydentu poznasz
            dopiero w raporcie. Dowody są dostępne podczas gry.
          </p>
          <ul>
            <li>Stan świata ustalony przed pierwszą decyzją</li>
            <li>Legalna działalność ma własne zależności</li>
            <li>Ta sama reakcja może dać inny wynik</li>
          </ul>
          <button
            className="primary-button"
            onClick={() => onSelect('unknown')}
          >
            Podejmij nieznany incydent →
          </button>
        </article>
      </div>
      <p className="selection-note">
        Czytaj sygnały, nie zgaduj przyczyny. Po zakończeniu możesz powtórzyć
        identyczną próbę lub rozpocząć kolejny incydent.
      </p>
    </main>
  );
}
