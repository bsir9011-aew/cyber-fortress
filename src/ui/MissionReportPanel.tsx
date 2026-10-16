import type { MissionReport } from '../application/selectMissionReport';
import { formatMinute } from '../simulation/clock';
import { actionLabel } from './simulationPresentation';
import { hypothesisLabels } from './InvestigationPanel';

const outcomeLabels = {
  'reconnaissance-confirmed': 'Potwierdzono dostęp do FS-01',
  'transfer-started': 'Rozpoczęto transfer',
  'records-copied': 'Dostarczono dane do klienta VPN',
  'session-lost': 'Utracono dotychczasowy tunel',
  'access-denied': 'Dostęp do FS-01 odmówiony',
  'authentication-accepted': 'Uzyskano nowy tunel',
  'authentication-rejected': 'Nowe uwierzytelnienie odrzucone',
} as const;

export function MissionReportPanel({
  report,
  onReplay,
  onNewIncident,
}: {
  report: MissionReport;
  onReplay: () => void;
  onNewIncident: () => void;
}) {
  const { confidentiality: data, continuity: business, containment } = report;
  return (
    <section
      className="mission-report"
      aria-labelledby="report-title"
      data-testid="mission-report"
    >
      <div className="report-heading">
        <div>
          <span className="eyebrow">
            15:30 / Raport po zakończeniu scenariusza
          </span>
          <h1 id="report-title">
            Koniec okna wysyłkowego.
            <br />
            <span className="accent">Co naprawdę się wydarzyło?</span>
          </h1>
        </div>
        <button className="primary-button" onClick={onReplay}>
          Powtórz ten sam incydent →
        </button>
      </div>
      <p className="report-disclosure">
        Poniżej ujawniamy prawdę symulacji. Te informacje nie były dostępnymi
        logami SOC podczas gry.
      </p>
      <section className="variant-reveal" aria-label="Ujawniony wariant">
        <span className="eyebrow">Typ incydentu ujawniony po zakończeniu</span>
        <h2>{report.scenario.name}</h2>
        <p>{report.scenario.explanation}</p>
        <small>
          {report.scenario.mode === 'training'
            ? 'Trening'
            : 'Nieznany incydent'}{' '}
          · numer próby {report.scenario.seed}
        </small>
      </section>
      <div className="report-scorecards">
        <article
          className={`report-scorecard ${data.goalMet ? 'achieved' : 'missed'}`}
        >
          <span className="eyebrow">01 / Poufność</span>
          <span className="status-pill">
            {data.goalMet ? 'Cel osiągnięty' : 'Dane ujawnione'}
          </span>
          <div className="result-number" data-testid="exposed-records">
            {data.exposedRecords}
            <small> / {data.recordLimit}</small>
          </div>
          <h2>ujawnionych rekordów</h2>
          <p>
            Cel: 0. Dane dostarczone do klienta VPN pozostają ujawnione mimo
            późniejszej blokady.
          </p>
        </article>
        <article
          className={`report-scorecard ${business.goalMet ? 'achieved' : 'missed'}`}
        >
          <span className="eyebrow">02 / Ciągłość działania</span>
          <span className="status-pill">
            {business.goalMet ? 'Termin dotrzymany' : 'Limit przekroczony'}
          </span>
          <div className="result-number" data-testid="report-backlog">
            {business.backlog}
            <small> / limit {business.backlogLimit}</small>
          </div>
          <h2>zaległych zamówień</h2>
          <p>
            Przyjęto {business.received} · obsłużono {business.processed}. To
            wynik niezależny od poufności.
          </p>
        </article>
      </div>
      {containment.applicable ? (
        <section
          className="containment-report"
          aria-labelledby="containment-title"
        >
          <span className="eyebrow">03 / Pozostałe możliwości przeciwnika</span>
          <p className="containment-goal">
            Cel ograniczenia dostępu do FS-01:{' '}
            {containment.goalMet
              ? 'osiągnięty w aktualnej konfiguracji'
              : 'nieosiągnięty'}
            . Stan konta i tunele oceniamy osobno.
          </p>
          <h2 id="containment-title">
            {containment.targetAccessCutOff
              ? 'Dostęp do FS-01 jest obecnie odcięty'
              : 'Techniczna możliwość dostępu nadal istnieje'}
          </h2>
          <div className="containment-facts">
            <p>
              <strong>Tunele przeciwnika:</strong>{' '}
              {containment.activeSessionIds.length
                ? containment.activeSessionIds.join(', ')
                : 'brak aktywnych'}
            </p>
            <p>
              <strong>Dostęp do FS-01 przez istniejący tunel:</strong>{' '}
              {containment.usableSessionIds.length ? 'możliwy' : 'niemożliwy'}
            </p>
            <p>
              <strong>Przejęte poświadczenie:</strong>{' '}
              {containment.stolenCredentialStillCurrent
                ? 'nadal aktualna wersja'
                : 'wersja została zmieniona'}
            </p>
            <p>
              <strong>Nowe logowanie starą wersją:</strong>{' '}
              {containment.newAuthenticationAllowed
                ? 'możliwe'
                : 'odrzucane lub usługa niedostępna'}
            </p>
            <p>
              <strong>Dostęp do FS-01 po nowym logowaniu:</strong>{' '}
              {containment.accessAfterNewAuthentication
                ? 'możliwy'
                : 'niemożliwy'}
            </p>
            <p>
              <strong>Konto i tunele:</strong>{' '}
              {containment.accountContained
                ? 'brak aktywnego tunelu i możliwości nowego logowania'
                : 'konto wymaga dalszego ograniczenia'}
            </p>
          </div>
          {containment.retryBudgetExhausted && (
            <p className="decision-warning">
              Przeciwnik wyczerpał limit ponowień.{' '}
              {containment.stoppedOnlyByRetryBudget
                ? 'Techniczne warunki nadal pozwalają wrócić — samo zakończenie prób nie oznacza bezpieczeństwa.'
                : 'Niezależnie od limitu sprawdzono także rzeczywiste możliwości dostępu.'}
            </p>
          )}
          {!containment.accountContained && containment.targetAccessCutOff && (
            <p className="decision-warning">
              Odcięcie udziału lub niedostępność usługi nie oznacza usunięcia
              przejętego poświadczenia. Sprawdź pozostałe tunele i zasady nowych
              logowań.
            </p>
          )}
        </section>
      ) : (
        <section
          className="containment-report legitimate-report"
          aria-label="Legalna aktywność"
        >
          <span className="eyebrow">03 / Interpretacja sygnału</span>
          <h2>Legalna aktywność, uzasadniony alert</h2>
          <p>
            Sensor zarejestrował {report.legitimateActivity.initialFailureCount}{' '}
            odmów sprzed rozpoczęcia misji. Reguła prawidłowo wskazała nietypowe
            uwierzytelnienia; nie potwierdzała przejęcia konta.
          </p>
          <p>
            W tym wariancie nie było napastnika ani skradzionego poświadczenia.
            Sukces logowania, migawka tunelu, relacja Marty i jej udokumentowana
            praca na FS-01 pozwalały porównać hipotezy przed raportem.
          </p>
          <p>
            {report.legitimateActivity.reducedCapacityTurns > 0
              ? 'Twoje ograniczenia dotknęły rzeczywistej legalnej działalności.'
              : 'Nie wystąpiły przedziały obniżonej wydajności legalnego procesu.'}{' '}
            Brak utraty danych nie jest tu wynikiem pokonania przeciwnika.
          </p>
        </section>
      )}
      <section
        className="legitimate-impact"
        aria-label="Skutki dla legalnej działalności"
      >
        <span className="eyebrow">Technika i biznes</span>
        <h2>Co odczuła firma?</h2>
        <p>
          Przedziały poniżej normalnej wydajności:{' '}
          <strong data-testid="reduced-capacity-turns">
            {report.legitimateActivity.reducedCapacityTurns}
          </strong>
          . Zaległe zamówienia na koniec: <strong>{business.backlog}</strong>.
        </p>
        <p>
          Legalne konta z ograniczoną możliwością ponownego logowania:{' '}
          {report.legitimateActivity.restrictedAccounts.join(', ') || 'brak'}.
          Ograniczenie nowych logowań nie oznacza automatycznego zakończenia
          wcześniejszej sesji.
        </p>
      </section>
      <section
        className="decision-analysis"
        aria-labelledby="decision-analysis-title"
      >
        <div className="section-heading">
          <div>
            <span className="eyebrow">Twoje decyzje i ich skutki</span>
            <h2 id="decision-analysis-title">
              Momenty, które zmieniły możliwości
            </h2>
          </div>
          <span className="muted">Maksymalnie trzy</span>
        </div>
        {report.moments.length === 0 && (
          <p>
            Nie ukończono zmiany ograniczającej dostęp lub zmieniającej
            wydajność. Brak takiej zmiany sam w sobie nie przesądza o jakości
            decyzji.
          </p>
        )}
        <ol className="decision-moments">
          {report.moments.map((moment) => (
            <li key={moment.taskId}>
              <div className="moment-title">
                <time>{formatMinute(moment.completedAtMinute!)}</time>
                <h3>{actionLabel(moment.action)}</h3>
              </div>
              <div className="moment-comparison">
                <div>
                  <span className="comparison-label">
                    Wiedza przy zleceniu ·{' '}
                    {formatMinute(moment.orderedAtMinute)}
                  </span>
                  <p>
                    Alerty: {moment.knownThen.alertIds.length}.{' '}
                    {moment.knownThen.authObservationMinute !== null
                      ? `Logi z ${formatMinute(moment.knownThen.authObservationMinute)}: ${moment.knownThen.authRecordCount} zdarzeń.`
                      : 'Logi nie były zbadane.'}{' '}
                    {moment.knownThen.sessionObservationMinute !== null
                      ? `Migawka sesji z ${formatMinute(moment.knownThen.sessionObservationMinute)}: ${moment.knownThen.sessionIds.join(', ') || 'brak'}.`
                      : 'Brak odczytu aktywnych sesji.'}{' '}
                    {moment.knownThen.ownerStatementMinute !== null
                      ? `Relacja Marty z ${formatMinute(moment.knownThen.ownerStatementMinute)}.`
                      : 'Brak rozmowy z Martą.'}
                  </p>
                  <small>
                    Hipoteza: {hypothesisLabels[moment.knownThen.hypothesis]}
                  </small>
                </div>
                <div>
                  <span className="comparison-label truth-label">
                    Prawda ujawniona po grze
                  </span>
                  {containment.applicable ? (
                    <p>
                      Przed próbą przeciwnika było już ujawnionych{' '}
                      {moment.impact!.exposedRecordsAtCompletion} rekordów.
                      Dostęp do celu:{' '}
                      {moment.impact!.before.targetAccessCutOff
                        ? 'odcięty'
                        : 'możliwy'}{' '}
                      →{' '}
                      {moment.impact!.after.targetAccessCutOff
                        ? 'odcięty'
                        : 'możliwy'}
                      . Nowe logowanie:{' '}
                      {moment.impact!.before.newAuthenticationAllowed
                        ? 'możliwe'
                        : 'niemożliwe'}{' '}
                      →{' '}
                      {moment.impact!.after.newAuthenticationAllowed
                        ? 'możliwe'
                        : 'niemożliwe'}
                      . Wydajność: {moment.impact!.remoteCapacityBefore} →{' '}
                      {moment.impact!.remoteCapacityAfter} zamówień / turę.
                    </p>
                  ) : (
                    <p>
                      W tym wariancie sesja była legalna. Zmiana dotyczyła
                      rzeczywistej pracy firmy, bez ograniczania nieistniejącego
                      ataku. Wydajność: {moment.impact!.remoteCapacityBefore} →{' '}
                      {moment.impact!.remoteCapacityAfter} zamówień / turę.
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
      {containment.applicable && (
        <details className="report-timeline">
          <summary>
            Rzeczywisty przebieg przeciwnika · ujawniony po zakończeniu
          </summary>
          <ol>
            {data.events.map((event, index) => (
              <li key={index}>
                <time>{formatMinute(event.minute)}</time>
                <span>
                  {outcomeLabels[event.outcome]}
                  {event.sessionId ? ` · ${event.sessionId}` : ''}
                  {event.copiedRecords
                    ? ` · ${event.copiedRecords} rekordów`
                    : ''}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
      <details className="report-timeline">
        <summary>
          Wszystkie ukończone zmiany administratora ({report.actions.length})
        </summary>
        <ol>
          {report.actions.map((action) => (
            <li key={action.id}>
              <time>{formatMinute(action.minute)}</time>
              <span>{actionLabel(action.action)}</span>
            </li>
          ))}
        </ol>
      </details>
      <div className="replay-callout">
        <div>
          <h2>Sprawdź inną decyzję.</h2>
          <p>
            Nowa próba ma identyczne warunki początkowe. Zmień strategię i
            porównaj osobno dane, dostęp i wysyłki.
          </p>
        </div>
        <div className="replay-actions">
          <button className="primary-button" onClick={onReplay}>
            Powtórz ten sam incydent →
          </button>
          <button className="secondary-button" onClick={onNewIncident}>
            Nowy incydent →
          </button>
        </div>
      </div>
    </section>
  );
}
