import { useState } from 'react';
import { browserStorage } from '../persistence/localStorage';
const definitions: Record<string, string> = {
  MFA: 'Dodatkowy składnik uwierzytelnienia. Chroni nowe logowania; nie kończy wcześniej wydanej sesji.',
  ACL: 'Reguła dopuszczania lub odmawiania przepływu. Dozwolona sieć nie zastępuje uprawnienia do danych.',
  EDR: 'Telemetria endpointu i reguły detekcji. W FORTRESS LAB pilotaż obejmuje pakowanie-03; alert wymaga dochodzenia.',
  'False Positive':
    'Alert wywołany legalną aktywnością. Sam sygnał nie powoduje straty; reakcja może ograniczyć działalność.',
  'False Negative':
    'Szkodliwa aktywność niewykryta w odpowiednim pokryciu. Brak alertu nie jest dowodem bezpieczeństwa.',
  RTO: 'Docelowy czas odzyskania użytecznej usługi. Nie określa, ile danych może brakować.',
  RPO: 'Akceptowalny maksymalny okres utraty danych. Nie oznacza czasu uruchomienia systemu.',
  'Site-to-site VPN':
    'Tunel łączący infrastrukturę oddziału z centralą. Nie jest osobistą sesją użytkownika; nie nadaje praw do plików.',
  'Least Privilege':
    'Dostęp ograniczony do niezbędnych operacji, zasobów i czasu. Potrzebny zakres zależy od legalnej pracy.',
  Backup:
    'Punkt odtworzenia danych. Starsza lub niesprawdzona kopia może wymagać uzgodnienia; nie usuwa aktywnego źródła szkód.',
  Standby:
    'Odrębna instancja usługi z własnym stanem danych. W ERP może działać na niezależnym storage, ale zawierać starsze zapisy.',
  Reconciliation:
    'Uzgodnienie brakujących zapisów i wykonanych operacji z właściwym dziennikiem. Nie oznacza ponownej wysyłki zamówień.',
};
export function Terms({ terms }: { terms: readonly string[] }) {
  return (
    <details className="context-terms">
      <summary>Pojęcia w tym kontekście</summary>
      <div>
        {terms.map((term) => (
          <details key={term}>
            <summary>{term}</summary>
            <p>{definitions[term]}</p>
          </details>
        ))}
      </div>
    </details>
  );
}
const key = 'fortress-lab.ui.intro.v1';
export function GameplayHelp() {
  const [open, setOpen] = useState(() => {
    try {
      return browserStorage().getItem(key) !== 'dismissed';
    } catch {
      return true;
    }
  });
  const close = () => {
    setOpen(false);
    try {
      browserStorage().setItem(key, 'dismissed');
    } catch {
      /* An unavailable UI preference never affects play. */
    }
  };
  return (
    <section className="gameplay-help" aria-label="Wprowadzenie do gry">
      {open ? (
        <>
          <p className="eyebrow">TWÓJ PIERWSZY RUCH</p>
          <h2>Odpowiadasz za bezpieczeństwo firmy, która musi działać.</h2>
          <div className="intro-columns">
            <p>
              Masz ograniczony budżet i dwoje specjalistów. W Centrali planujesz
              pracę; w misji zlecasz badania i reakcję.
            </p>
            <p>
              Czas stoi podczas czytania. Płynie dopiero, gdy rozliczysz godzinę
              przygotowania lub przejdziesz do kolejnych pięciu minut.
            </p>
            <p>
              Obserwacja nie musi oznaczać ataku. Przyczyna może być
              nieustalona, a działania wpływają na biznes. Zbierz dowody i
              sprawdzaj skutki.
            </p>
          </div>
          <button onClick={close}>Rozumiem — przejdź do gry</button>
          <button onClick={close}>Pomiń wprowadzenie</button>
        </>
      ) : (
        <button onClick={() => setOpen(true)}>
          Jak grać? · krótkie wprowadzenie
        </button>
      )}
    </section>
  );
}
export function DeferredDetails({
  title,
  children,
}: {
  title: string;
  children: () => import('react').ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="deferred-details"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>{title}</summary>
      {open && children()}
    </details>
  );
}
