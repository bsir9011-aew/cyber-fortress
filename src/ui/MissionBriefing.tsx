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
          {view.branch ? (
            'Oddział na granicy.'
          ) : view.recovery ? (
            'ERP nie odpowiada.'
          ) : view.vendor ? (
            <>
              Dostawca
              <br />
              <span className="accent">na godzinę.</span>
            </>
          ) : view.integrity ? (
            <>
              Ostatnia czysta
              <br />
              <span className="accent">kopia.</span>
            </>
          ) : (
            <>
              Ostatnie okno
              <br />
              <span className="accent">wysyłkowe.</span>
            </>
          )}
        </h1>
        <p className="briefing-role">
          {view.branch
            ? 'Security Engineer · architektura dostępu NEXUS EAST.'
            : 'Pierwszy dzień w roli Security Engineer.'}
        </p>
        <blockquote>
          <span className="speaker-tag">Ewa · kierowniczka operacji</span>
          {view.briefing.message}
        </blockquote>
        <div className="briefing-objectives">
          <article>
            <span className="eyebrow">
              Cel 01 /{' '}
              {view.branch
                ? 'Architektura'
                : view.recovery
                  ? 'Odzyskiwanie'
                  : view.integrity
                    ? 'Integralność'
                    : 'Poufność'}
            </span>
            <h2>
              {view.branch
                ? 'Zapewnij właściwy dostęp EAST'
                : view.recovery
                  ? 'Odzyskaj usługę i poprawne dane'
                  : view.integrity
                    ? 'Odzyskaj poprawne dokumenty'
                    : 'Chroń dane operacyjne'}
            </h2>
            <p>
              {view.branch ? (
                'Zaprojektuj i sprawdź drogę ERP oraz uzasadniony dostęp do FS-01. Transport, ACL, tożsamość i nadanie to osobne warunki.'
              ) : view.recovery ? (
                'Przywróć użyteczny ERP, uzgodnij brakujące zapisy i wykonane wysyłki. Sprawdź wynik na podstawie niezależnego dziennika.'
              ) : view.vendor ? (
                <>
                  Dostawca
                  <br />
                  <span className="accent">na godzinę.</span>
                </>
              ) : view.integrity ? (
                'Ogranicz źródło zmian, odtwórz lub uzgodnij dokumenty i sprawdź rezultat. Serwer online nie potwierdza integralności.'
              ) : (
                <>
                  Cel: 0 ujawnionych rekordów z {view.recordPool}. Podczas gry
                  znasz tylko to, co uda się zaobserwować.
                </>
              )}
            </p>
          </article>
          <article>
            <span className="eyebrow">Cel 02 / Ciągłość</span>
            <h2>Dowieź wysyłki</h2>
            <p>
              Do 15:30 pozostaw najwyżej {view.maxFinalBacklog} zaległych
              zamówień.{' '}
              {view.branch
                ? 'EAST wnosi do 6 z 22 zamówień/turę. Backup zapewnia najwyżej 3 i nie przenosi SMB.'
                : view.recovery
                  ? 'Zamknij i uzgodnij tryb ręczny. Potwierdź spójność danych po odtworzeniu.'
                  : view.vendor
                    ? 'CARGO-LINK wnosi 6 z 22 zamówień wydajności. Zbadaj potrzebne przepływy i pamiętaj o terminie wyjątku.'
                    : view.integrity
                      ? 'Wysyłki wymagają także poprawnych dokumentów FS-01. Izolacja odbiera legalną pracę stacji.'
                      : 'Zdalny zespół potrzebuje ERP przez VPN.'}
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
              {view.branch
                ? 'Przełącza przygotowane trasy, naprawia łącze, zmienia zakres SMB i bieżącą autoryzację kont oddziału. Efekt po ukończeniu pracy.'
                : view.recovery
                  ? 'Restartuje ERP, odtwarza wybraną kopię, przełącza ruch na standby i zarządza obsługą ręczną. Każde zadanie wymaga czasu.'
                  : view.vendor
                    ? 'Cofa, zawęża lub rozszerza ważny wyjątek dostawcy. Zmiany wymagają czasu i nie kończą sesji.'
                    : view.integrity
                      ? 'Izoluje stację, ogranicza jej zapis i odtwarza dokumenty. Podłączenie wymaga spełnienia warunków bezpieczeństwa.'
                      : 'Kończy tunele, zmienia logowania i reguły dostępu. Każda zmiana wymaga czasu.'}
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
