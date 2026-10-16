import { useReducer, useState } from 'react';
import { createInitialSimulation } from '../application/createInitialSimulation';
import { selectPlayerView } from '../application/selectPlayerView';
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
import './simulation.css';

export function App() {
  const [simulation, dispatch] = useReducer(
    simulationReducer,
    undefined,
    createInitialSimulation,
  );
  const view = selectPlayerView(simulation);
  const { world } = view;
  const [layer, setLayer] = useState<MapLayer>('network');
  const [selection, setSelection] = useState<MapSelection>(null);
  const visibleConnections = selectLayerConnections(world, layer);
  const activeLayer = layers.find((item) => item.id === layer)!;
  const relationKinds = [
    ...new Set(visibleConnections.map((connection) => connection.kind)),
  ];

  function select(value: MapSelection) {
    if (value?.kind === 'connection') {
      const connection = world.connections.find((item) => item.id === value.id);
      if (connection) setLayer(getConnectionLayer(connection.kind));
    }
    setSelection(value);
  }

  function changeLayer(next: MapLayer) {
    setLayer(next);
    // Zasób zachowuje kontekst; ukryta relacja nie pozostaje zaznaczona.
    if (selection?.kind === 'connection') setSelection(null);
  }

  function onCommand(command: SimulationCommand) {
    if (command.type === 'reset') {
      setSelection(null);
      setLayer('network');
    }
    dispatch(command);
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Przejdź do mapy
      </a>
      <header className="topbar">
        <a
          className="brand"
          href="#main"
          aria-label="FORTRESS LAB — mapa infrastruktury"
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
          DEV 0.2 <span>· Simulation Engine</span>
        </span>
      </header>

      <SimulationTimeBar view={view} onCommand={onCommand} />

      <div className="command-layout">
        <aside className="sidebar" aria-label="Warstwy i organizacja">
          <p className="eyebrow muted">Centrum dowodzenia</p>
          <div className="current-view">
            <span aria-hidden="true">⌘</span> Architektura{' '}
            <span className="current-indicator" />
          </div>
          <nav aria-label="Warstwy mapy">
            <p className="eyebrow muted">Warstwy infrastruktury</p>
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
          <section
            className="organization-card"
            aria-labelledby="organization-title"
          >
            <p className="eyebrow">Profil organizacji</p>
            <h2 id="organization-title">{nexusLogistics.name}</h2>
            <p>
              Logistyka opiera się na ludziach, usługach i dostępie do danych.
            </p>
            <dl>
              <div>
                <dt>Zasoby na mapie</dt>
                <dd>{world.assets.length.toString().padStart(2, '0')}</dd>
              </div>
              <div>
                <dt>Strefy</dt>
                <dd>{world.zones.length.toString().padStart(2, '0')}</dd>
              </div>
              <div>
                <dt>Relacje</dt>
                <dd>{world.connections.length.toString().padStart(2, '0')}</dd>
              </div>
            </dl>
          </section>
          <div className="sidebar-note">
            <span aria-hidden="true">◈</span>
            <p>
              Najpierw zrozum firmę.
              <br />
              Potem zdecyduj, jak ją chronić.
            </p>
          </div>
        </aside>

        <main id="main" className="main-workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Operacje / Architektura</p>
              <h1>Żywa infrastruktura</h1>
              <p>Poznaj systemy, które utrzymują firmę w ruchu.</p>
            </div>
            <span className="environment-badge">Środowisko symulowane</span>
          </div>
          <BusinessPanel view={view} />
          <section className="map-panel" aria-labelledby="map-title">
            <div className="map-panel-heading">
              <div>
                <span className="eyebrow muted">Mapa organizacji</span>
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
              Wybierz zasób lub relację, aby otworzyć inspektor. Przełączaj
              warstwy, aby poznawać różne zależności.
            </p>
            <span className="keyboard-hint">Tab · Enter</span>
          </div>
          <section className="exploration-note">
            <span className="note-marker" aria-hidden="true">
              i
            </span>
            <div>
              <h2>Jedna firma. Wiele zależności.</h2>
              <p>
                Połączenia pokazują komunikację i role usług. Ich obecność nie
                potwierdza uprawnień ani skuteczności zabezpieczeń.
              </p>
            </div>
          </section>
          <SimulationEventLog view={view} />
        </main>

        <div className="right-column">
          <OperationsPanel view={view} onCommand={onCommand} />
          <InfrastructureInspector
            world={world}
            selection={selection}
            onSelect={select}
            networkRules={view.rules}
          />
        </div>
      </div>
      <footer className="app-footer">
        <span>
          FORTRESS LAB <span className="muted">/</span> NEXUS Logistics
        </span>
        <span>
          Symulacja działalności <span className="footer-dot" /> Sprint 3
        </span>
      </footer>
    </div>
  );
}
