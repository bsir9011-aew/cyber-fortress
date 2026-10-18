import type { GameplayExperience } from '../application/gameplay/cockpit';
import type { MissionReport } from '../application/selectMissionReport';
import { DecisionCockpit } from './DecisionCockpit';
import { MissionConclusion } from './MissionConclusion';
import { DeferredDetails } from './GameplayHelp';
import { useState } from 'react';
import type { PlayerView } from '../application/selectPlayerView';
import type { FinaleReport } from '../application/selectFinaleReport';
import type { SimulationCommand } from '../domain/simulation';
import type { GameSession } from '../application/gameSession';
import type { CrisisHypothesis } from '../domain/finale';
import { SimulationTimeBar } from './SimulationTimeBar';
import { OperationsPanel } from './OperationsPanel';
import { BusinessPanel } from './BusinessPanel';
import { InfrastructureMap } from './InfrastructureMap';
import { InfrastructureInspector } from './InfrastructureInspector';
import { AfterActionExport } from './AfterActionExport';
import { formatMinute } from '../simulation/clock';
import { actionLabel } from './simulationPresentation';
import type { MapSelection } from './infrastructurePresentation';
const hypotheses: Record<CrisisHypothesis, string> = {
  'insufficient-evidence': 'Za mało dowodów',
  'operational-failure': 'Awaria operacyjna',
  'security-incident': 'Incydent bezpieczeństwa',
  'multiple-independent-events': 'Kilka niezależnych zdarzeń',
};
const outcomes: Record<string, string> = {
  'full-success': 'Pełny sukces',
  'operational-success-with-security-breach':
    'Sukces operacyjny z naruszeniem bezpieczeństwa',
  'contained-with-business-unavailable':
    'Zagrożenie ograniczone, działalność niedostępna',
  'partial-recovery': 'Częściowe odzyskanie',
  'operational-failure': 'Porażka operacyjna',
};
export function FinaleWorkspace({
  view: v,
  experience,
  fullReport,
  report: r,
  game,
  onCommand,
  onHeadquarters,
  onMenu,
}: {
  view: PlayerView;
  experience: GameplayExperience;
  fullReport: MissionReport | null;
  report: FinaleReport | null;
  game: GameSession;
  onCommand: (c: SimulationCommand) => void;
  onHeadquarters: () => void;
  onMenu: () => void;
}) {
  const [tab, setTab] = useState<'overview' | 'investigation' | 'architecture'>(
    'overview',
  );
  const [selection, setSelection] = useState<MapSelection>(null);
  const f = v.finale!;
  const latest = v.history.at(-1);
  return (
    <div className="finale-workspace">
      <header className="finale-header">
        <div>
          <p className="eyebrow">FORTRESS LAB · M06 / THE PERFECT STORM</p>
          <h1>{r ? 'NEXUS LOGISTICS — CAMPAIGN DEBRIEF' : 'Kryzys w NEXUS'}</h1>
        </div>
        <button onClick={onMenu}>Menu</button>
      </header>
      <DecisionCockpit experience={experience} />
      <SimulationTimeBar view={v} onCommand={onCommand} canReset={false} />
      {r ? (
        <>
          {fullReport && (
            <MissionConclusion
              report={fullReport}
              decisions={experience.decisions}
              onContinue={onHeadquarters}
            />
          )}
          <DeferredDetails title="Szczegóły techniczne i pełny debrief kampanii">
            {() => (
              <>
                <section className="vendor-card">
                  <p className="eyebrow">
                    Pierwszy rozdział ukończony · możesz ponowić finał w
                    kolejnym oknie
                  </p>
                  <h2>{outcomes[r.outcome]}</h2>
                  <p>{r.explanation}</p>
                  <dl className="business-metrics">
                    <div>
                      <dt>Confidentiality</dt>
                      <dd>{r.exposedRecords} odczytanych rekordów</dd>
                    </div>
                    <div>
                      <dt>Integrity</dt>
                      <dd>
                        {r.documents.correct}/{r.documents.total} poprawnych
                      </dd>
                    </div>
                    <div>
                      <dt>Availability</dt>
                      <dd>
                        {r.servicesMet
                          ? 'Użyteczne kluczowe procesy'
                          : 'Pozostały ograniczenia'}
                      </dd>
                    </div>
                    <div>
                      <dt>Business Continuity</dt>
                      <dd>
                        {r.business.totalProcessed}/{r.business.totalReceived}{' '}
                        zamówień · zaległe {r.business.backlog}
                      </dd>
                    </div>
                  </dl>
                  <p>
                    Uszkodzone: {r.documents.damaged}. Do uzgodnienia:{' '}
                    {r.documents.reconcile}. Szkodliwy dostęp nadal możliwy:{' '}
                    {r.remainingAccess ? 'tak' : 'nie'}. Ręczne wysyłki:{' '}
                    {r.manualProcessed}, nieuzgodnione: {r.pendingOrders.length}
                    . ERP: {r.erp.instance}, proces{' '}
                    {r.erp.processRunning ? 'działa' : 'zatrzymany'}, storage{' '}
                    {r.erp.storage ? 'dostępny' : 'niedostępny'}.
                  </p>
                  <p>
                    Operational Confidence:{' '}
                    {!r.verification.erpRequired &&
                    !r.verification.documentsRequired
                      ? 'nie wykonano odzyskiwania wymagającego końcowej weryfikacji'
                      : r.confidenceMet
                        ? 'ostatni stan potwierdzony'
                        : 'brak aktualnej weryfikacji'}
                    . Zakończono{' '}
                    {
                      r.tasks.filter(
                        (t) =>
                          t.status === 'completed' && t.workerId === 'analyst',
                      ).length
                    }{' '}
                    badań i działań analityka. Wygaszenie wyjątku CARGO-LINK o
                    15:30 nie unieważnia poprawnej pracy ostatniego przedziału.
                  </p>
                  <p>
                    FS-01: {r.serviceStatus.fsOnline ? 'online' : 'offline'} ·
                    trasa EAST: {r.serviceStatus.branchRoute} · wyjątek
                    CARGO-LINK: {r.serviceStatus.vendorException}.
                  </p>
                  <h3>Ostatni rozliczony przedział</h3>
                  <ul>
                    {r.business.lastReport?.contributions?.map((c) => (
                      <li key={c.id}>
                        {c.name}: {c.capacity}/turę ·{' '}
                        {c.available ? 'użyteczny' : 'niedostępny'}
                      </li>
                    ))}
                  </ul>
                  <button className="primary-button" onClick={onHeadquarters}>
                    Wróć do Centrali — kolejna próba
                  </button>
                </section>
                <div className="finale-debrief-grid">
                  <section className="vendor-card">
                    <h2>Dziedzictwo kampanii</h2>
                    {r.usedControls.length ? (
                      r.usedControls.map((c) => (
                        <details key={c.control}>
                          <summary>{c.control} — rzeczywiste zdarzenia</summary>
                          <ul>
                            {c.facts.map((x, n) => (
                              <li key={n}>{x}</li>
                            ))}
                          </ul>
                        </details>
                      ))
                    ) : (
                      <p>
                        Brak zarejestrowanego użycia zabezpieczeń w tym
                        przebiegu.
                      </p>
                    )}
                    <h3>Luki w architekturze</h3>
                    <ul>
                      {r.gaps.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    <h3>Niepozyskane dowody</h3>
                    <ul>
                      {r.missingEvidence.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    <h3>Niewykorzystane możliwości</h3>
                    <ul>
                      {r.unusedCapabilities.map((x) => (
                        <li key={x}>
                          {x} Nie symulowano alternatywnego wyniku.
                        </li>
                      ))}
                    </ul>
                    <h3>Pozostałe ryzyko i brakujące potwierdzenia</h3>
                    <ul>
                      {r.residualRisk.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    <p>
                      Źródła nieobjęte pokryciem lub niepobrane nie potwierdzają
                      braku zdarzeń.
                    </p>
                  </section>
                  <section className="vendor-card">
                    <h2>Kluczowe zdarzenia i decyzje</h2>
                    {r.events.map((e, n) => (
                      <p key={n}>
                        {formatMinute(e.minute)} · {e.assetId}: {e.fact}
                      </p>
                    ))}
                    {r.tasks.map((t) => (
                      <p key={t.id}>
                        {formatMinute(840 + t.startTurn * 5)} →{' '}
                        {formatMinute(840 + t.dueTurn * 5)} · {t.workerId} ·{' '}
                        {actionLabel(t.action)} · {t.status}
                      </p>
                    ))}
                    <h3>Hipotezy gracza</h3>
                    {r.hypotheses.map((h, n) => (
                      <p key={n}>
                        {formatMinute(h.minute)} · {hypotheses[h.hypothesis]} ·{' '}
                        {h.observationIds.length} dostępnych wpisów. Nie jest
                        potwierdzeniem przyczyny.
                      </p>
                    ))}
                  </section>
                </div>
              </>
            )}
          </DeferredDetails>
          <AfterActionExport game={game} />
        </>
      ) : (
        <>
          <p className="source-note">
            Jedna kolejka zamówień, jeden administrator i jeden analityk. Czas
            płynie dopiero po „Następne 5 minut”.
          </p>
          <nav className="finale-tabs" aria-label="Centrum kryzysowe">
            {(['overview', 'investigation', 'architecture'] as const).map(
              (t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                >
                  {
                    {
                      overview: 'Przegląd i biznes',
                      investigation: 'Dochodzenie i korelacja',
                      architecture: 'Architektura',
                    }[t]
                  }
                </button>
              ),
            )}
          </nav>
          <div className="finale-grid">
            <main>
              {tab === 'overview' && (
                <>
                  <section className="vendor-card">
                    <h2>Okno wysyłkowe NEXUS</h2>
                    <p>{v.briefing.message}</p>
                    <h3>Ostatnie zaobserwowane sygnały</h3>
                    {f.timeline.slice(-4).map((o) => (
                      <p key={o.id}>
                        {formatMinute(o.eventMinute)} · {o.source}: {o.fact} ·{' '}
                        {o.result}
                      </p>
                    ))}
                    {!f.timeline.length && (
                      <p>
                        Nie pozyskano jeszcze dowodów. Zleć badanie; status
                        hosta nie potwierdza działania aplikacji.
                      </p>
                    )}
                  </section>
                  <BusinessPanel view={v} experience={experience} />
                </>
              )}
              {tab === 'investigation' && (
                <section className="vendor-card">
                  <h2>Wspólna oś czasu obserwacji</h2>
                  <label htmlFor="crisis-hypothesis">
                    Robocza ocena sytuacji
                  </label>
                  <select
                    id="crisis-hypothesis"
                    value={f.hypothesis}
                    onChange={(e) =>
                      onCommand({
                        type: 'set-crisis-hypothesis',
                        hypothesis: e.target.value as CrisisHypothesis,
                      })
                    }
                  >
                    {Object.entries(hypotheses).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p>
                    Hipoteza nie zmienia świata. AAR zapisze dostępną wiedzę w
                    chwili wyboru. Brak dowodu nie oznacza bezpieczeństwa.
                  </p>
                  {f.timeline.map((o) => (
                    <article className="finale-observation" key={o.id}>
                      <strong>
                        {formatMinute(o.eventMinute)} · {o.source} · {o.assetId}
                      </strong>
                      <p>{o.fact}</p>
                      <p>
                        Wynik: {o.result} · udostępniono{' '}
                        {formatMinute(o.availableAtMinute)}
                      </p>
                      <small>{o.limitation}</small>
                    </article>
                  ))}
                  {!f.timeline.length && (
                    <p>Oś czasu zawiera wyłącznie pozyskane informacje.</p>
                  )}
                </section>
              )}
              {tab === 'architecture' && (
                <section className="vendor-card">
                  <h2>Jedna infrastruktura, odrębne zależności</h2>
                  <p>
                    Centrala i VPN → aktywna instancja ERP → baza/storage.
                    Lokalny SMB: pakowanie-03 → FS-01. EAST: site-to-site →
                    firewall → ERP/FS-01 lub przygotowany backup HTTPS → ERP.
                    CARGO-LINK: VPN → carrier-api → aktywne ERP. Standby ma
                    własny storage i starsze dane.
                  </p>
                  <p>
                    Aktywne ERP: {v.recovery!.activeInstance}. Trasa EAST:{' '}
                    {v.branch!.route}. SMB: {v.branch!.architecture.smbScope}.
                    Wyjątek CARGO-LINK: {v.vendor!.exception?.scope ?? 'brak'}.
                    EDR: {v.integrity!.edr ? 'pakowanie-03' : 'brak'}. Audyt
                    FS-01: {v.fileSensor?.enabled ? 'wdrożony' : 'brak'}.
                  </p>
                  <InfrastructureMap
                    world={v.world}
                    connections={v.world.connections}
                    selection={selection}
                    onSelect={setSelection}
                  />
                  <InfrastructureInspector
                    world={v.world}
                    experience={experience}
                    selection={selection}
                    onSelect={setSelection}
                    networkRules={v.rules}
                    endpoint={v.integrity?.endpoint}
                    vendor={v.vendor ?? undefined}
                  />
                </section>
              )}
              {latest?.kind === 'command-rejected' && (
                <p role="alert" className="strategy-error">
                  Nie zlecono zadania: {latest.reason}. Sprawdź pracownika, czas
                  i warunki.
                </p>
              )}
            </main>
            <aside>
              <OperationsPanel
                view={v}
                actions={experience.actions}
                focusAssetId={
                  selection?.kind === 'asset' ? selection.id : undefined
                }
                onCommand={onCommand}
              />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
