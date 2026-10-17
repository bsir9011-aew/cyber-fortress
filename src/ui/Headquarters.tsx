import { AfterActionExport } from './AfterActionExport';
import { campaignAarMissionId } from '../application/createAfterActionReport';
import { ResilienceStatus } from './ResilienceStatus';
import { useEffect, useRef, useState } from 'react';
import type {
  StrategicSession,
  HeadquartersTab,
} from '../application/gameSession';
import type { CampaignCommand, ProjectId } from '../domain/campaign';
import type { WorkerId } from '../domain/simulation';
import type { SavedUiState } from '../application/operationSession';
import { selectStrategyView } from '../application/selectStrategyView';
import { projectDefinition } from '../content/securityProjects';
import { InfrastructureMap } from './InfrastructureMap';
import { InfrastructureInspector } from './InfrastructureInspector';
import { selectLayerConnections } from '../application/infrastructureSelectors';
import { layers } from './infrastructurePresentation';
const money = (value: number) => value.toLocaleString('pl-PL') + ' zł';
const statuses = {
  available: 'Dostępny',
  planned: 'Zaplanowany · bez rezerwacji',
  reserved: 'Środki zarezerwowane',
  'in-progress': 'W realizacji',
  completed: 'Zakończony · aktywny',
};
const tabs: { id: HeadquartersTab; label: string }[] = [
  { id: 'overview', label: 'Firma i ryzyko' },
  { id: 'projects', label: 'Budżet i projekty' },
  { id: 'schedule', label: 'Plan pracy' },
  { id: 'posture', label: 'Stan zabezpieczeń' },
  { id: 'map', label: 'Mapa firmy' },
];
export function Headquarters({
  session,
  onCommand,
  onTab,
  onUi,
  onMenu,
}: {
  session: StrategicSession;
  onCommand: (command: CampaignCommand) => void;
  onTab: (tab: HeadquartersTab) => void;
  onUi: (patch: Partial<SavedUiState>) => void;
  onMenu: () => void;
}) {
  const view = selectStrategyView(session.campaign);
  const heading = useRef<HTMLHeadingElement>(null);
  const [assignment, setAssignment] = useState<Record<WorkerId, ProjectId>>({
    administrator: 'remote-access',
    analyst: 'file-visibility',
  });
  useEffect(
    () => heading.current?.focus(),
    [session.headquartersTab, session.campaign.preparation.number],
  );
  const showAsset = (id: string) => {
    onUi({ selection: { kind: 'asset', id } });
    onTab('map');
  };
  const activeWork = (worker: WorkerId) =>
    view.work.find(
      (w) =>
        w.window === view.preparation.number &&
        w.workerId === worker &&
        w.status === 'running',
    );
  const workName = (id: ProjectId) => projectDefinition(id).name;
  return (
    <main id="main" className="headquarters">
      <div className="hq-heading">
        <div>
          <p className="eyebrow">
            NEXUS / Strategia / Okno {view.preparation.number}
          </p>
          <h1 ref={heading} tabIndex={-1}>
            Centrala NEXUS<span>Przygotuj firmę na kolejną decyzję.</span>
          </h1>
          <p>
            Inwestujesz w zasady dostępu, ludzi i źródła wiedzy. Skutek
            zobaczysz w działającej organizacji.
          </p>
        </div>
        <button className="reset-button" onClick={onMenu}>
          Wybór trybu
        </button>
      </div>
      <section className="hq-budget" aria-label="Bilans budżetu">
        <div>
          <small>Budżet rozdziału</small>
          <strong data-testid="budget-total">{money(view.budget.total)}</strong>
        </div>
        <div>
          <small>Wydatki poniesione</small>
          <strong data-testid="budget-spent">{money(view.budget.spent)}</strong>
        </div>
        <div>
          <small>Zarezerwowane</small>
          <strong data-testid="budget-reserved">
            {money(view.budget.reserved)}
          </strong>
        </div>
        <div className="budget-available">
          <small>Dostępne środki</small>
          <strong data-testid="budget-available">
            {money(view.budget.available)}
          </strong>
        </div>
      </section>
      {view.eligibleForFunding && (
        <section
          className="resilience-funding"
          aria-label="Przegląd odporności — Etap II"
        >
          <p className="eyebrow">PRZEGLĄD ODPORNOŚCI — ETAP II</p>
          <h2>
            {view.funding
              ? 'Transza przyjęta · 25 000 zł'
              : 'Decyzja zarządu · 25 000 zł'}
          </h2>
          <p>
            Po incydencie integralności zarząd zwiększa środki na ograniczenie
            ryzyka. To finansowanie przeglądu, niezależne od wyniku misji.
            Historyczna alokacja Etapu I: 80 000 zł.
          </p>
          {view.funding ? (
            <p>
              Jednorazowa alokacja board-resilience-ii · przegląd raportu{' '}
              {view.funding.allocations[0]?.reportNumber}. Łączna pula: 105 000
              zł. Wydatki i rezerwacje pozostają w osobnym rejestrze.
            </p>
          ) : (
            <button
              className="primary-button"
              onClick={() => onCommand({ type: 'accept-resilience-funding' })}
            >
              Przyjmij finansowanie Etapu II — 25 000 zł
            </button>
          )}
          <p>
            EDR pomaga wcześniej zebrać dowody. Backup skraca odtworzenie
            sprawdzonej kopii. Zachowanie rezerwy pozostawia dotychczasowe
            możliwości. Oba projekty: 52 000 zł, 5 h administratora i 4 h
            analityka — potrzebne kolejne okno.
          </p>
        </section>
      )}
      <div className="hq-window">
        <div>
          <span className="eyebrow">Przygotowanie poza incydentem</span>
          <strong data-testid="preparation-time">
            {view.preparation.hour} / 4 h
          </strong>
          <p>
            Administrator i analityk mają oddzielne kanały pracy. Niewykonane
            godziny projektu przejdą do następnego okna.
          </p>
        </div>
        <div className="window-actions">
          <button
            className="secondary-button"
            disabled={view.preparation.hour === 4}
            onClick={() => onCommand({ type: 'advance-preparation' })}
          >
            Rozlicz godzinę pracy
          </button>
          <button
            className="primary-button"
            disabled={view.preparation.hour !== 4}
            onClick={() => onCommand({ type: 'start-incident' })}
          >
            Rozpocznij incydent →
          </button>
        </div>
      </div>
      {view.lastDecision?.result === 'rejected' && (
        <p className="strategy-error" role="alert">
          {view.lastDecision.reason}
        </p>
      )}
      <section
        className="integrity-mission-card"
        aria-label="Misja 02: Ostatnia czysta kopia"
      >
        <div>
          <p className="eyebrow">Nowy rozdział / Integralność i odzyskiwanie</p>
          <h2>02 — Ostatnia czysta kopia</h2>
          <p>
            ERP działa, ale dokumenty FS-01 nie zgadzają się z zamówieniami.
            Ustal źródło, ogranicz je i wybierz sposób odtworzenia. To osobna
            rodzina incydentu.
          </p>
          <p>
            {!view.history.length
              ? 'Dostępna po ukończeniu jednego incydentu Misji 01.'
              : view.preparation.hour !== 4
                ? 'Przed startem rozlicz cztery godziny przygotowania.'
                : 'Zachowasz budżet, inwestycje i trwałe zmiany. Dowody będą świeże.'}
          </p>
        </div>
        <button
          className="primary-button"
          disabled={
            !view.history.some(
              (r) => r.scenarioId !== 'nexus-last-clean-copy',
            ) || view.preparation.hour !== 4
          }
          onClick={() => onCommand({ type: 'start-integrity-incident' })}
        >
          Rozpocznij Misję 02 →
        </button>
      </section>
      <nav className="hq-tabs" aria-label="Konteksty centrali">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            aria-pressed={session.headquartersTab === tab.id}
            onClick={() => onTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {session.headquartersTab === 'overview' && (
        <>
          <section className="hq-overview">
            <article className="hq-company-card">
              <span className="eyebrow">Firma, za którą odpowiadasz</span>
              <h2>{view.organization.name}</h2>
              <div className="organization-scale">
                <span>
                  <strong>120</strong> pracowników
                </span>
                <span>
                  <strong>94</strong> komputery
                </span>
              </div>
              <p>
                Dziewięć modelowanych zasobów. Usługi VPN i AD wydają dostęp;
                ERP obsługuje zamówienia; dokumenty FS-01 mogą być potrzebne do
                wysyłek.
              </p>
              <button className="secondary-button" onClick={() => onTab('map')}>
                Poznaj zależności na mapie →
              </button>
            </article>
            <article>
              <span className="eyebrow">Przed Twoim pierwszym oknem</span>
              <h2>Pilotaż to początek, nie gotowa ochrona.</h2>
              <p>
                Zapłacono już <strong>12 000 zł</strong>. Pozostało{' '}
                <strong>68 000 zł</strong>. Trzy dalsze wdrożenia wymagają
                łącznie 78 000 zł i czasu zespołu.
              </p>
              <p>
                Sam zakup nie zmieni konfiguracji. Projekt zaczyna działać
                dopiero po ukończeniu pracy wszystkich wymaganych osób.
              </p>
              <button
                className="secondary-button"
                onClick={() => onTab('projects')}
              >
                Porównaj decyzje →
              </button>
            </article>
          </section>
          <section
            className="hq-services"
            aria-label="Dostępność kluczowych usług"
          >
            {view.world.assets
              .filter((a) => ['vpn', 'ad', 'erp', 'fs-01'].includes(a.id))
              .map((a) => (
                <button key={a.id} onClick={() => showAsset(a.id)}>
                  <strong>{a.name}</strong>
                  <span>
                    {a.status === 'online' ? 'Dostępny' : 'Niedostępny'} →
                  </span>
                </button>
              ))}
          </section>
          <section className="dependency-cards" aria-label="Znane zależności">
            <article>
              <h3>Dostęp zdalny</h3>
              <p>
                Poprawne hasło, wymagany drugi składnik i działające VPN/AD
                decydują o nowej sesji. Zmiana zasad logowania nie cofa już
                wydanych tuneli.
              </p>
              <button onClick={() => showAsset('vpn')}>Sprawdź VPN →</button>
            </article>
            <article>
              <h3>Ciągłość wysyłek</h3>
              <p>
                20 zamówień na turę. 8 obsługują stanowiska lokalne. Pozostałe
                wymagają zdalnego ERP; zależnie od przydziału dokumentów
                dodatkowe 6 wymaga również SMB.
              </p>
              <button onClick={() => showAsset('erp')}>Sprawdź ERP →</button>
            </article>
            <article>
              <h3>Widoczność plików</h3>
              <p>
                Logowanie VPN nie dowodzi odczytu danych. Audyt FS-01 dostarcza
                inne źródło, z własnym pokryciem i opóźnieniem; nie blokuje
                żądań.
              </p>
              <button onClick={() => showAsset('fs-01')}>
                Sprawdź FS-01 →
              </button>
            </article>
          </section>
          <section className="campaign-history">
            <h2>Zakończone operacje tej kampanii</h2>
            {!view.history.length ? (
              <p>
                Jeszcze żadnej. Możesz zachować rezerwę i przejść okno bez
                inwestycji.
              </p>
            ) : (
              view.history.map((r) => (
                <article key={r.number}>
                  <strong>
                    Operacja {r.number} · {r.name}
                  </strong>
                  <p>
                    {r.integrity
                      ? `${r.integrity.correct}/100 poprawnych dokumentów · ${r.integrity.damaged} uszkodzonych · ${r.integrity.reconcile} do uzgodnienia`
                      : `${r.exposedRecords} ujawnionych rekordów`}{' '}
                    · {r.processed} obsłużonych · {r.backlog} zaległych · wydano{' '}
                    {money(r.spent)}.
                  </p>
                  <p>
                    {r.containmentMet === null
                      ? 'Brak potwierdzonej złośliwej aktywności; ograniczenie zagrożenia nie dotyczy.'
                      : r.containmentMet
                        ? 'Cel ograniczenia dostępu osiągnięty.'
                        : 'Dostęp wymaga dalszej uwagi.'}
                  </p>
                  <details>
                    <summary>Raport szczegółowy tej operacji</summary>
                    <AfterActionExport
                      game={session}
                      missionId={campaignAarMissionId(
                        session.attemptId,
                        r.number,
                      )}
                      compact
                    />
                  </details>
                </article>
              ))
            )}
          </section>
        </>
      )}
      {session.headquartersTab === 'projects' && (
        <>
          <p className="hq-note">
            Najpierw porównaj zakres i zaplanuj projekt. Potwierdzenie rezerwuje
            środki. Przydział pierwszej pracy rozlicza płatność; zabezpieczenie
            aktywuje się po ukończeniu wszystkich godzin. Możesz zrezygnować
            przed rozpoczęciem, zachowując rezerwę.
          </p>
          <div className="project-grid">
            {view.projects.map((p) => (
              <article
                className={`security-project project-${p.id}`}
                key={p.id}
                aria-label={p.name}
              >
                {(p.id === 'endpoint-edr' || p.id === 'backup-resilience') && (
                  <p className="eyebrow">
                    Etap II · Projekt {p.id === 'endpoint-edr' ? 'D' : 'E'}
                  </p>
                )}
                <span className="project-status">{statuses[p.status]}</span>
                <h2>{p.name}</h2>
                <div className="project-price">
                  {money(p.remainingCost)}
                  <small>
                    {p.id === 'remote-access'
                      ? 'Do dopłaty · 32 000 zł łącznie, 12 000 zł już zapłacono'
                      : 'Pełny koszt wdrożenia'}
                  </small>
                </div>
                <p>
                  <strong>Praca:</strong> administrator {p.hours.administrator}{' '}
                  h
                  {p.hours.analyst > 0
                    ? ` + analityk ${p.hours.analyst} h`
                    : ''}
                  .
                </p>
                <p>
                  <strong>Zakres:</strong> {p.scope}
                </p>
                <p>{p.effect}</p>
                <p className="project-limitation">
                  <strong>Granica:</strong> {p.limitation}
                </p>
                <p>
                  <strong>Działalność:</strong> {p.business}
                </p>
                <p>
                  Pozostało: administrator {p.remaining.administrator} h ·
                  analityk {p.remaining.analyst} h.
                </p>
                <div className="project-asset-links">
                  {p.assetIds.map((id) => (
                    <button key={id} onClick={() => showAsset(id)}>
                      {id.toUpperCase()} →
                    </button>
                  ))}
                </div>
                <div className="project-actions">
                  {p.status === 'available' && (
                    <button
                      className="secondary-button"
                      disabled={view.preparation.hour === 4}
                      onClick={() =>
                        onCommand({ type: 'plan-project', projectId: p.id })
                      }
                    >
                      Zaplanuj projekt
                    </button>
                  )}
                  {p.status === 'planned' && (
                    <button
                      className="primary-button"
                      disabled={view.preparation.hour === 4}
                      onClick={() =>
                        onCommand({ type: 'reserve-project', projectId: p.id })
                      }
                    >
                      Potwierdź rezerwację {money(p.remainingCost)}
                    </button>
                  )}
                  {['planned', 'reserved'].includes(p.status) && (
                    <button
                      className="reset-button"
                      onClick={() =>
                        onCommand({ type: 'cancel-project', projectId: p.id })
                      }
                    >
                      Zrezygnuj bez wydatku
                    </button>
                  )}
                  {['reserved', 'in-progress'].includes(p.status) && (
                    <button
                      className="secondary-button"
                      onClick={() => onTab('schedule')}
                    >
                      Przydziel pracę →
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <details className="budget-ledger">
            <summary>Jawny rejestr budżetu ({view.ledger.length})</summary>
            <ul>
              {view.ledger.map((e) => (
                <li key={e.id}>
                  <strong>
                    {e.id} · {workName(e.projectId)}
                  </strong>
                  <span>
                    {
                      {
                        'prior-expense': 'Wydatek wcześniejszy',
                        reserve: 'Rezerwacja',
                        payment: 'Płatność',
                        release: 'Zwolnienie rezerwy',
                      }[e.kind]
                    }{' '}
                    · {money(e.amount)} · przygotowanie {e.window} ·{' '}
                    {e.result === 'applied' ? 'Zastosowano' : 'Odrzucono'}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
      {session.headquartersTab === 'schedule' && (
        <>
          <div className="worker-plan">
            {(['administrator', 'analyst'] as const).map((worker) => {
              const busy = activeWork(worker);
              const options = view.projects.filter(
                (p) =>
                  ['reserved', 'in-progress'].includes(p.status) &&
                  p.remaining[worker] > 0,
              );
              const chosen =
                options.find((p) => p.id === assignment[worker]) ?? options[0];
              return (
                <article key={worker} aria-label={`Plan: ${worker}`}>
                  <span className="eyebrow">
                    {worker === 'administrator'
                      ? 'Bartek · Administrator'
                      : 'Analityk'}
                  </span>
                  <h2>
                    {busy ? 'W trakcie wdrożenia' : 'Gotowy do przydziału'}
                  </h2>
                  <p>
                    {busy
                      ? `${workName(busy.projectId)} · pozostało ${view.projects.find((p) => p.id === busy.projectId)!.remaining[worker]} h`
                      : `Pozostało ${4 - view.preparation.hour} h w tym oknie.`}
                  </p>
                  <label htmlFor={`assign-${worker}`}>
                    Projekt dla{' '}
                    {worker === 'administrator'
                      ? 'administratora'
                      : 'analityka'}
                  </label>
                  <select
                    id={`assign-${worker}`}
                    value={chosen?.id ?? ''}
                    disabled={Boolean(busy) || !options.length}
                    onChange={(e) =>
                      setAssignment((a) => ({
                        ...a,
                        [worker]: e.target.value as ProjectId,
                      }))
                    }
                  >
                    {!options.length && (
                      <option value="">Brak zarezerwowanej pracy</option>
                    )}
                    {options.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name} · {p.remaining[worker]} h
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary-button"
                    disabled={
                      Boolean(busy) || !chosen || view.preparation.hour === 4
                    }
                    onClick={() =>
                      chosen &&
                      onCommand({
                        type: 'assign-work',
                        projectId: chosen.id,
                        workerId: worker,
                      })
                    }
                  >
                    Przydziel{' '}
                    {worker === 'administrator'
                      ? 'administratora'
                      : 'analityka'}
                  </button>
                </article>
              );
            })}
          </div>
          <section
            className="work-timeline"
            aria-label="Harmonogram czterech godzin"
          >
            <h2>Równoległe kanały pracy</h2>
            {(['administrator', 'analyst'] as const).map((worker) => (
              <div className="timeline-row" key={worker}>
                <strong>
                  {worker === 'administrator' ? 'Administrator' : 'Analityk'}
                </strong>
                {[0, 1, 2, 3].map((hour) => {
                  const w = view.work.find(
                    (w) =>
                      w.window === view.preparation.number &&
                      w.workerId === worker &&
                      w.startHour <= hour &&
                      hour <
                        w.startHour +
                          w.hoursWorked +
                          (w.status === 'running'
                            ? view.projects.find((p) => p.id === w.projectId)!
                                .remaining[worker]
                            : 0),
                  );
                  return (
                    <div
                      key={hour}
                      className={
                        w
                          ? hour < view.preparation.hour
                            ? 'work-done'
                            : 'work-planned'
                          : 'work-free'
                      }
                    >
                      <small>{hour + 1}. godzina okna</small>
                      <span>{w ? workName(w.projectId) : 'Wolne'}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
          <section className="preparation-progress">
            <h2>Praca przechodząca na kolejne okno</h2>
            {view.projects
              .filter((p) => p.status !== 'available')
              .map((p) => (
                <p key={p.id}>
                  <strong>{p.name}:</strong> {statuses[p.status]} · admin{' '}
                  {p.remaining.administrator} h, analityk {p.remaining.analyst}{' '}
                  h do zakończenia.
                </p>
              ))}
          </section>
        </>
      )}
      {session.headquartersTab === 'posture' && (
        <section className="posture-panel">
          <h2>Trwałe zabezpieczenia organizacji</h2>
          <ResilienceStatus {...view.resilience} />
          <article>
            <strong>
              MFA ·{' '}
              {view.posture.remoteAccess
                ? 'Wdrożone'
                : 'Poza pilotażem niewdrożone'}
            </strong>
            <p>
              {view.posture.remoteAccess
                ? 'Modelowane konta VPN wymagają drugiego składnika. Legalni klienci mają własny zarejestrowany składnik. Stare sesje nie są automatycznie unieważniane.'
                : 'Sam opłacony pilotaż nie rozszerza jeszcze wymogu na modelowane konta.'}
            </p>
          </article>
          <article>
            <strong>Uprawnienia</strong>
            <p>
              {view.posture.remoteAccess
                ? 'SMB magazyn-07 pozostaje tylko przy udokumentowanym zadaniu plikowym. Pozostałe nadmiarowe nadanie jest usuwane.'
                : 'Dotychczasowe nadania pozostają do weryfikacji.'}
            </p>
          </article>
          <article>
            <strong>
              Segmentacja ·{' '}
              {view.posture.segmentation ? 'Wdrożona' : 'Niewdrożona'}
            </strong>
            <label htmlFor="segmentation-scope">
              Grupa dopuszczona do FS-01/SMB
            </label>
            <select
              id="segmentation-scope"
              value={view.posture.segmentationScope}
              disabled={view.preparation.hour === 4}
              onChange={(e) =>
                onCommand({
                  type: 'set-segmentation-scope',
                  scope: e.target.value as 'file-team' | 'document-users',
                })
              }
            >
              <option value="file-team">Tylko file-team</option>
              <option value="document-users">
                file-team oraz magazyn-07 (Marta)
              </option>
            </select>
            <p>
              Wybrany zakres jest stosowany po ukończeniu projektu, przed
              kolejnym incydentem. Marta może potrzebować SMB do dokumentów;
              dopuszczenie jej konta obejmuje każdego, kto posiada jego sesję.
              Zmiana zakresu nie resetuje ukończonego projektu ani świata
              trwającej misji. Po wdrożeniu zmiana grupy zajmuje wolnemu
              administratorowi 1 h; równoległa praca analityka również posuwa
              się o godzinę.
            </p>
          </article>
          <article>
            <strong>
              Audyt FS-01 ·{' '}
              {view.posture.fileVisibility ? 'Aktywny' : 'Nieaktywny'}
            </strong>
            <p>
              Pokrycie: SMB na FS-01, list/open/read, retencja 120 min,
              dostarczenie 5 min po zebraniu. Brak zdarzenia nie jest dowodem
              braku aktywności.
            </p>
          </article>
          <article>
            <strong>Ręcznie utrzymane zmiany z poprzednich okien</strong>
            <p>
              {Object.keys(view.posture.ruleOverrides).length} zmian reguł ·{' '}
              {Object.keys(view.posture.accountOverrides).length} zmian kont ·{' '}
              {Object.keys(view.posture.assetOverrides).length} zmian
              dostępności. Sesje, alerty i liczniki incydentu nie przechodzą
              dalej.
            </p>
          </article>
        </section>
      )}
      {session.headquartersTab === 'map' && (
        <section className="hq-map">
          <nav className="map-layer-nav" aria-label="Warstwa mapy centrali">
            {layers.map((l) => (
              <button
                key={l.id}
                aria-pressed={session.uiState.layer === l.id}
                onClick={() => onUi({ layer: l.id, selection: null })}
              >
                {l.shortName}
              </button>
            ))}
          </nav>
          <ResilienceStatus {...view.resilience} />
          <div className="hq-map-layout">
            <InfrastructureMap
              world={view.world}
              resilience={view.resilience}
              connections={selectLayerConnections(
                view.world,
                session.uiState.layer,
              )}
              selection={session.uiState.selection}
              onSelect={(selection) => onUi({ selection })}
            />
            <InfrastructureInspector
              world={view.world}
              resilience={view.resilience}
              selection={session.uiState.selection}
              onSelect={(selection) => onUi({ selection })}
            />
          </div>
        </section>
      )}
    </main>
  );
}
