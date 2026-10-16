import { useEffect, useReducer, useRef, useState } from 'react';
import { createInitialSimulation } from '../application/createInitialSimulation';
import { selectPlayerView } from '../application/selectPlayerView';
import { selectMissionReport } from '../application/selectMissionReport';
import { simulationReducer } from '../application/simulationReducer';
import type { SimulationCommand } from '../domain/simulation';
import {
  getConnectionLayer,
  selectLayerConnections,
} from '../application/infrastructureSelectors';
import type { MapLayer } from '../application/infrastructureSelectors';
import { nexusLogistics } from '../content/organization';
import { InfrastructureInspector } from './InfrastructureInspector';
import { InfrastructureMap } from './InfrastructureMap';
import { connectionLabels, layers } from './infrastructurePresentation';
import type { MapSelection } from './infrastructurePresentation';
import { BusinessPanel } from './BusinessPanel';
import { OperationsPanel } from './OperationsPanel';
import { SimulationEventLog } from './SimulationEventLog';
import { SimulationTimeBar } from './SimulationTimeBar';
import { InvestigationPanel } from './InvestigationPanel';
import { MissionBriefing } from './MissionBriefing';
import { MissionReportPanel } from './MissionReportPanel';
import { NarrativeFeed } from './NarrativeFeed';
import { eventLabel } from './simulationPresentation';
import './simulation.css';
import './mission.css';

type Context = 'cases' | 'operations' | 'architecture';
const contexts: { id: Context; label: string; number: string }[] = [
  { id: 'cases', label: 'Sprawy', number: '01' },
  { id: 'operations', label: 'Operacje', number: '02' },
  { id: 'architecture', label: 'Architektura', number: '03' },
];

export function App() {
  const [simulation, dispatch] = useReducer(
    simulationReducer,
    undefined,
    createInitialSimulation,
  );
  const view = selectPlayerView(simulation);
  const report = selectMissionReport(simulation);
  const { world } = view;
  const [briefing, setBriefing] = useState(true);
  const [context, setContext] = useState<Context>('cases');
  const [layer, setLayer] = useState<MapLayer>('network');
  const [selection, setSelection] = useState<MapSelection>(null);
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const visibleConnections = selectLayerConnections(world, layer);
  const activeLayer = layers.find((item) => item.id === layer)!;
  const relationKinds = [
    ...new Set(visibleConnections.map((connection) => connection.kind)),
  ];
  const latestMessage = view.messages
    .filter((message) => message.source !== 'briefing')
    .at(-1);
  const lastEvent = view.history.at(-1);
  const evidenceCount =
    view.authObservations.length +
    view.ownerStatements.length +
    (view.sessionObservation ? 1 : 0);

  useEffect(() => {
    if (!briefing) headingRef.current?.focus();
  }, [briefing, context, view.finished]);

  function select(value: MapSelection) {
    if (value?.kind === 'connection') {
      const connection = world.connections.find((item) => item.id === value.id);
      if (connection) setLayer(getConnectionLayer(connection.kind));
    }
    setSelection(value);
  }
  function changeLayer(next: MapLayer) {
    setLayer(next);
    if (selection?.kind === 'connection') setSelection(null);
  }
  function onCommand(command: SimulationCommand) {
    if (command.type === 'reset') {
      setSelection(null);
      setLayer('network');
      setContext('cases');
      setBriefing(true);
      setAttempt((value) => value + 1);
    }
    dispatch(command);
  }

  return (
    <div className="app-shell mission-shell">
      <a className="skip-link" href="#main">
        Przejdź do misji
      </a>
      <header className="topbar">
        <a
          className="brand"
          href="#main"
          aria-label="FORTRESS LAB — misja NEXUS Logistics"
        >
          <span className="brand-mark" aria-hidden="true">
            ⬡
          </span>
          <span>
            FORTRESS <span className="accent">LAB</span>
            <small>CYBER DEFENSE SIMULATION</small>
          </span>
        </a>
        <div className="topbar-organization">
          <span className="organization-mark" aria-hidden="true">
            N
          </span>
          <div>
            <small>Organizacja</small>
            <strong>{nexusLogistics.name}</strong>
          </div>
        </div>
        <span className="version">
          DEV 0.2 <span>· First Playable Incident</span>
        </span>
      </header>
      {briefing ? (
        <MissionBriefing onStart={() => setBriefing(false)} />
      ) : (
        <>
          <SimulationTimeBar view={view} onCommand={onCommand} />
          {report ? (
            <main id="main" className="report-workspace">
              <h1 ref={headingRef} tabIndex={-1} className="sr-only">
                Raport po zakończeniu misji
              </h1>
              <MissionReportPanel
                report={report}
                onReplay={() => onCommand({ type: 'reset' })}
              />
            </main>
          ) : (
            <>
              <div
                className="mission-objective-bar"
                aria-label="Cele i stan misji"
              >
                <div>
                  <span className="eyebrow">Ostatnie okno wysyłkowe</span>
                  <strong>Chroń dane. Dowieź wysyłki.</strong>
                </div>
                <div>
                  <small>Sprawa 01</small>
                  <button onClick={() => setContext('cases')}>
                    Nietypowe logowania VPN →
                  </button>
                </div>
                <div>
                  <small>Obsłużone / przyjęte</small>
                  <strong>
                    {view.business.totalProcessed} /{' '}
                    {view.business.totalReceived}
                  </strong>
                </div>
                <div>
                  <small>Zaległe / limit o 15:30</small>
                  <strong
                    className={view.business.backlog > 40 ? 'warning-text' : ''}
                  >
                    {view.business.backlog} / 40
                  </strong>
                </div>
                <div>
                  <small>Zdalny ERP</small>
                  <strong>
                    {view.availability.remoteAvailable
                      ? 'Dostępny'
                      : 'Niedostępny'}
                  </strong>
                </div>
              </div>
              <nav className="context-nav" aria-label="Konteksty misji">
                {contexts.map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={context === item.id}
                    onClick={() => setContext(item.id)}
                  >
                    <span>{item.number}</span>
                    {item.label}
                    {item.id === 'cases' && (
                      <small>{evidenceCount} dowodów</small>
                    )}
                  </button>
                ))}
              </nav>
              <div className={`mission-layout context-${context}`}>
                {context === 'architecture' && (
                  <aside className="sidebar" aria-label="Warstwy mapy">
                    <p className="eyebrow muted">Infrastruktura</p>
                    <nav aria-label="Warstwy infrastruktury">
                      {layers.map((item, index) => (
                        <button
                          key={item.id}
                          className={`layer-button${layer === item.id ? ' active' : ''}`}
                          aria-pressed={layer === item.id}
                          onClick={() => changeLayer(item.id)}
                        >
                          <span className="layer-number">0{index + 1}</span>
                          <span>{item.name}</span>
                          <span className="layer-count">
                            {selectLayerConnections(world, item.id).length}
                          </span>
                        </button>
                      ))}
                    </nav>
                    <p className="sidebar-note">
                      Linia opisuje relację. Dostęp wymaga także reguły, sesji i
                      uprawnienia.
                    </p>
                  </aside>
                )}
                <main id="main" className="main-workspace">
                  <div className="page-heading">
                    <div>
                      <p className="eyebrow">NEXUS / Misja 01</p>
                      <h1 ref={headingRef} tabIndex={-1}>
                        {context === 'cases'
                          ? 'Zrozum sygnał. Podejmij decyzję.'
                          : context === 'operations'
                            ? 'Firma nie może czekać.'
                            : 'Poznaj drogę do zasobu.'}
                      </h1>
                      <p>
                        {context === 'cases'
                          ? 'To Ty decydujesz, kiedy masz wystarczająco dużo informacji.'
                          : context === 'operations'
                            ? 'Obserwuj wpływ swoich zmian na pracę zespołu.'
                            : 'Ta sama infrastruktura obsługuje ludzi i ogranicza dostęp.'}
                      </p>
                    </div>
                  </div>
                  <div className="mission-feedback" role="status">
                    <span className="feedback-mark" aria-hidden="true">
                      {latestMessage ? latestMessage.speaker[0] : 'i'}
                    </span>
                    <p>
                      {latestMessage ? (
                        <>
                          <strong>{latestMessage.speaker}:</strong>{' '}
                          {latestMessage.text}
                        </>
                      ) : (
                        'Zleć pierwsze badanie lub zmianę dostępu. Analityk i administrator mogą pracować równolegle. Potem przejdź o 5 minut dalej.'
                      )}
                    </p>
                  </div>
                  {lastEvent?.kind === 'command-rejected' && (
                    <p className="command-feedback" role="alert">
                      {eventLabel(lastEvent)}
                    </p>
                  )}
                  {context === 'cases' && (
                    <>
                      <InvestigationPanel view={view} onCommand={onCommand} />
                      <NarrativeFeed view={view} />
                    </>
                  )}
                  {context === 'operations' && (
                    <>
                      <BusinessPanel view={view} />
                      <NarrativeFeed view={view} />
                      <SimulationEventLog view={view} />
                    </>
                  )}
                  {context === 'architecture' && (
                    <>
                      {layer === 'telemetry' && (
                        <section
                          className="configuration-evidence sensor-coverage"
                          aria-label="Pokrycie sensorów"
                        >
                          <h2>Lokalne sensory VPN</h2>
                          <p>
                            <strong>VPN Authentication</strong> · źródło{' '}
                            {view.sensors.authentication.sourceAssetId} ·{' '}
                            {view.sensors.authentication.enabled
                              ? 'włączony'
                              : 'wyłączony'}{' '}
                            · retencja{' '}
                            {view.sensors.authentication.retentionMinutes} min ·
                            opóźnienie{' '}
                            {view.sensors.authentication.delayMinutes} min.
                          </p>
                          <p>
                            <strong>VPN Active Sessions</strong> · odczyt
                            aktywnych tuneli podczas badania · retencja 0 ·
                            opóźnienie 0. Odczyt obu źródeł wymaga dostępnej
                            bramy.
                          </p>
                          <button
                            className="reset-button"
                            onClick={() => setContext('cases')}
                          >
                            Przejdź do pozyskanych dowodów →
                          </button>
                        </section>
                      )}
                      <section
                        className="map-panel"
                        aria-labelledby="map-title"
                      >
                        <div className="map-panel-heading">
                          <div>
                            <span className="eyebrow muted">
                              Mapa organizacji
                            </span>
                            <h2 id="map-title">{activeLayer.name}</h2>
                          </div>
                          <span className="map-counter">
                            {world.assets.length} zasobów <span> / </span>{' '}
                            {visibleConnections.length} relacji
                          </span>
                        </div>
                        <div className="layer-summary">
                          <span className={`layer-dot layer-${layer}`} />
                          <p>{activeLayer.description}</p>
                          <button
                            className="clear-selection"
                            onClick={() => setSelection(null)}
                            disabled={!selection}
                          >
                            Wyczyść wybór <span aria-hidden="true">×</span>
                          </button>
                        </div>
                        {visibleConnections.length === 0 && (
                          <div className="empty-layer" role="status">
                            <span aria-hidden="true">◎</span>
                            <div>
                              <strong>Brak relacji w tej warstwie</strong>
                              <p>{activeLayer.emptyMessage}</p>
                            </div>
                          </div>
                        )}
                        <InfrastructureMap
                          world={world}
                          connections={visibleConnections}
                          selection={selection}
                          onSelect={select}
                        />
                        <div className="map-legend" aria-label="Legenda mapy">
                          {relationKinds.map((kind) => (
                            <span key={kind}>
                              <i className={`legend-line kind-${kind}`} />
                              {connectionLabels[kind]} →
                            </span>
                          ))}
                          <span>
                            <i className="legend-node" />
                            Wybrany zasób
                          </span>
                          <span>
                            <i className="legend-related" />
                            Powiązany zasób
                          </span>
                        </div>
                      </section>
                      <div className="map-guidance">
                        <span aria-hidden="true">⌖</span>
                        <p>
                          Wybierz zasób lub relację, aby otworzyć inspektor.
                          Warstwy rozdzielają rodzaje zależności.
                        </p>
                        <span className="keyboard-hint">Tab · Enter</span>
                      </div>
                      <BusinessPanel view={view} />
                    </>
                  )}
                </main>
                <aside className="right-column" aria-label="Decyzje i zasoby">
                  <OperationsPanel
                    key={attempt}
                    view={view}
                    onCommand={onCommand}
                  />
                  {context === 'architecture' && (
                    <InfrastructureInspector
                      world={world}
                      selection={selection}
                      onSelect={select}
                      networkRules={view.rules}
                    />
                  )}
                </aside>
              </div>
              <nav className="mobile-decision-dock" aria-label="Skróty misji">
                <a href="#main">Sprawa i dowody ↑</a>
                <a href="#team-actions">Zleć zadanie ↓</a>
              </nav>
            </>
          )}
        </>
      )}
      <footer className="app-footer">
        <span>
          FORTRESS LAB <span className="muted">/</span> NEXUS Logistics
        </span>
        <span>
          First Playable Incident <span className="footer-dot" /> Sprint 4B
        </span>
      </footer>
    </div>
  );
}
