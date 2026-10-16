import type { PlayerView } from '../application/selectPlayerView';
import type { SimulationCommand } from '../domain/simulation';
import type { IncidentHypothesis } from '../domain/incident';
import { formatMinute } from '../simulation/clock';

export const hypothesisLabels: Record<IncidentHypothesis, string> = {
  'insufficient-evidence': 'Nie mamy wystarczających informacji',
  'compromised-credential': 'Przejęte poświadczenie',
  'unusual-legitimate-session': 'Legalna, ale nietypowa sesja',
  'existing-tunnel-access': 'Istniejący tunel nadal umożliwia dostęp',
};

export function InvestigationPanel({
  view,
  onCommand,
}: {
  view: PlayerView;
  onCommand: (command: SimulationCommand) => void;
}) {
  const auth = view.authObservations.at(-1);
  const sessions = view.sessionObservation;
  const owner = view.ownerStatements.at(-1);
  const sensor = view.sensors.authentication;
  return (
    <div className="investigation-panel">
      <section className="alert-card" aria-labelledby="alert-title">
        <div className="alert-icon" aria-hidden="true">
          !
        </div>
        <div>
          <span className="eyebrow">Sprawa 01 / Sygnał do zbadania</span>
          <h2 id="alert-title">Nietypowe uwierzytelnienia VPN</h2>
          {view.alerts.map((alert) => (
            <div key={alert.id}>
              <p>
                <strong>{alert.failureCount} nieudane próby</strong> dla konta{' '}
                <strong>{alert.accountId}</strong> w oknie{' '}
                {formatMinute(alert.windowStartMinute)}–
                {formatMinute(alert.windowEndMinute)}.
              </p>
              <p className="evidence-meta">
                {alert.id} · sensor {alert.sensorId} · alert z{' '}
                {formatMinute(alert.minute)} · reguła: co najmniej 20 błędów /
                20 min
              </p>
            </div>
          ))}
          {!view.alerts.length && (
            <p>
              Brak alertów z dostępnych źródeł. Nie oznacza to braku zagrożenia.
            </p>
          )}
          <p className="alert-caveat">
            Sygnał nie potwierdza przejęcia konta ani sposobu zdobycia
            poświadczenia. Sprawdź logi, sesje i kontekst właścicielki konta.
          </p>
        </div>
        <span className="status-pill warning">Wymaga analizy</span>
      </section>
      <div className="section-heading evidence-heading">
        <div>
          <span className="eyebrow">Pozyskana wiedza</span>
          <h2>Dowody i ich granice</h2>
        </div>
        <span className="muted">Nowe dane wymagają zadania analityka</span>
      </div>
      <div className="evidence-grid">
        <section
          className="evidence-card auth-evidence"
          aria-label="Dowód: logi uwierzytelnienia"
        >
          <div className="evidence-card-heading">
            <h3>01 / Uwierzytelnienia</h3>
            <span className={`status-pill ${auth ? 'observed' : ''}`}>
              {auth ? 'Pozyskano' : 'Nie zbadano'}
            </span>
          </div>
          {auth ? (
            <>
              <p className="evidence-meta">
                Źródło: {auth.sensorId} / {auth.sourceAssetId} · pozyskano{' '}
                {formatMinute(auth.observedAtMinute)}
                <br />
                Zakres {formatMinute(auth.windowStartMinute)}–
                {formatMinute(auth.windowEndMinute)} · retencja{' '}
                {auth.retentionMinutes} min · opóźnienie {auth.delayMinutes} min
              </p>
              <div className="auth-summary">
                <strong>
                  {
                    auth.records.filter((event) => event.outcome === 'failure')
                      .length
                  }
                </strong>{' '}
                odmów <span>/</span>{' '}
                <strong>
                  {
                    auth.records.filter((event) => event.outcome === 'success')
                      .length
                  }
                </strong>{' '}
                udanych logowań
              </div>
              <div
                className="evidence-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Przewijana tabela logowań"
              >
                <table className="auth-table">
                  <caption>Zarejestrowane zdarzenia uwierzytelnienia</caption>
                  <thead>
                    <tr>
                      <th>Czas</th>
                      <th>Konto</th>
                      <th>Wynik</th>
                      <th>Sesja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...auth.records].reverse().map((event) => (
                      <tr key={event.id}>
                        <td>{formatMinute(event.minute)}</td>
                        <td>{event.accountId}</td>
                        <td>
                          <span
                            className={
                              event.outcome === 'success'
                                ? 'log-success'
                                : 'log-failure'
                            }
                          >
                            {event.outcome === 'success' ? 'Sukces' : 'Odmowa'}
                          </span>
                        </td>
                        <td>{event.sessionId ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="evidence-caveat">
                Błędy i późniejszy sukces nie dowodzą odgadnięcia hasła.
                Logowanie nie jest audytem dostępu do danych. Nie modelujemy
                adresów źródłowych.
              </p>
            </>
          ) : (
            <div className="evidence-empty">
              <span aria-hidden="true">≡</span>
              <p>Zleć badanie logów. Otworzenie sprawy nie pobiera zdarzeń.</p>
              <small>
                Sensor {sensor.id} · retencja {sensor.retentionMinutes} min ·
                opóźnienie {sensor.delayMinutes} min
              </small>
            </div>
          )}
          {view.authObservations.length > 1 && (
            <details className="evidence-history">
              <summary>
                Wcześniejsze odczyty ({view.authObservations.length - 1})
              </summary>
              {view.authObservations.slice(0, -1).map((observation) => (
                <details key={observation.id}>
                  <summary>
                    {formatMinute(observation.observedAtMinute)} ·{' '}
                    {observation.records.length} zdarzeń
                  </summary>
                  <ul>
                    {observation.records.map((record) => (
                      <li key={record.id}>
                        {formatMinute(record.minute)} · {record.accountId} ·{' '}
                        {record.outcome === 'success' ? 'sukces' : 'odmowa'} ·{' '}
                        {record.sessionId ?? 'bez sesji'}
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </details>
          )}
        </section>
        <div className="evidence-stack">
          <section className="evidence-card" aria-label="Dowód: aktywne sesje">
            <div className="evidence-card-heading">
              <h3>02 / Aktywne tunele</h3>
              <span className={`status-pill ${sessions ? 'observed' : ''}`}>
                {sessions ? 'Migawka' : 'Nie zbadano'}
              </span>
            </div>
            {sessions ? (
              <>
                <p className="evidence-meta">
                  Źródło: VPN Active Sessions · odczyt{' '}
                  {formatMinute(sessions.observedAtMinute)} · bez retencji i
                  opóźnienia
                </p>
                <ul className="observed-sessions">
                  {sessions.sessions.map((session) => (
                    <li key={session.id}>
                      <strong>{session.id}</strong>
                      <span>{session.accountId}</span>
                      <small>
                        Brama {session.gatewayAssetId} · początek{' '}
                        {formatMinute(session.startedAtMinute)} · aktywna w
                        chwili odczytu
                      </small>
                    </li>
                  ))}
                </ul>
                {sessions.sessions.length === 0 && (
                  <p>W chwili badania brak aktywnych sesji.</p>
                )}
                <p className="evidence-caveat">
                  To migawka. Lista nie odświeża się po zmianie konfiguracji i
                  nie określa pochodzenia sesji.
                </p>
              </>
            ) : (
              <p className="evidence-empty">
                Nie odczytano bramy. Sukces w logach nie mówi, czy tunel nadal
                jest aktywny.
              </p>
            )}
          </section>
          <section className="evidence-card" aria-label="Dowód: relacja Marty">
            <div className="evidence-card-heading">
              <h3>03 / Właścicielka konta</h3>
              <span className={`status-pill ${owner ? 'observed' : ''}`}>
                {owner ? 'Relacja' : 'Brak rozmowy'}
              </span>
            </div>
            {owner ? (
              <>
                <p className="evidence-meta">
                  Źródło: {owner.speaker}, właścicielka {owner.accountId} ·
                  rozmowa {formatMinute(owner.observedAtMinute)} · dotyczy{' '}
                  {formatMinute(owner.referencedMinute)}
                </p>
                <blockquote>„{owner.text}”</blockquote>
                <p className="evidence-caveat">
                  Relacja człowieka, osobna od technicznego zapisu
                  uwierzytelnienia.
                </p>
              </>
            ) : (
              <p className="evidence-empty">
                Marta może podać kontekst użycia swojego konta. Kontakt zajmie 5
                minut pracy analityka.
              </p>
            )}
          </section>
        </div>
      </div>
      <section className="hypothesis-panel" aria-labelledby="hypothesis-title">
        <div>
          <span className="eyebrow">Twoje rozumowanie</span>
          <h2 id="hypothesis-title">Hipoteza robocza</h2>
          <p>
            Opcjonalna notatka. Nie zmienia świata i nie jest oceniana w trakcie
            misji.
          </p>
        </div>
        <fieldset disabled={view.finished}>
          <legend className="sr-only">Wybierz hipotezę</legend>
          {(
            Object.entries(hypothesisLabels) as [IncidentHypothesis, string][]
          ).map(([id, label]) => (
            <label key={id}>
              <input
                type="radio"
                name="hypothesis"
                value={id}
                checked={view.hypothesis === id}
                onChange={() =>
                  onCommand({ type: 'set-hypothesis', hypothesis: id })
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </section>
      <details className="configuration-evidence">
        <summary>Znana konfiguracja i zakres obserwacji</summary>
        <p>
          Reguły są jawną dokumentacją infrastruktury. Linia na mapie nie
          potwierdza uprawnień. Nie mamy sensora przepływów ani audytu plików;
          brak takiego dowodu nie oznacza braku dostępu.
        </p>
        <ul>
          {view.rules.map((rule) => (
            <li key={rule.id}>
              <strong>{rule.id}</strong> · {rule.sourceAssetId} →{' '}
              {rule.targetAssetId} · {rule.protocol} ·{' '}
              <strong>{rule.action.toUpperCase()}</strong>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
