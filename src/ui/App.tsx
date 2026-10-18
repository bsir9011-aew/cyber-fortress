import { GameplayHelp } from './GameplayHelp';
import { useState } from 'react';
import type { ScenarioMode } from '../domain/scenario';
import { usePersistentOperations } from './usePersistentOperations';
import { PersistenceToolbar } from './PersistenceToolbar';
import { AttemptHistory } from './AttemptHistory';
import { ScenarioSelection } from './ScenarioSelection';
import { MissionWorkspace } from './MissionWorkspace';
import { Headquarters } from './Headquarters';
import './simulation.css';
import './mission.css';
import './scenario.css';
import './persistence.css';
import './strategy.css';
import './integrity.css';
import './gameplay.css';

export function App() {
  const operations = usePersistentOperations();
  const { game, session } = operations;
  const [menu, setMenu] = useState(true);
  function confirmReplace() {
    return (
      !(operations.active || operations.hasSave) ||
      window.confirm(
        'Nowa gra zastąpi bieżącą grę i zapis V9. Oryginały V1/V2/V3/V4/V5/V6/V7/V8 oraz historia prób pozostaną. Kontynuować?',
      )
    );
  }
  function start(mode: ScenarioMode, seed: number) {
    if (confirmReplace()) {
      operations.start(mode, seed);
      setMenu(false);
    }
  }
  return (
    <div className="app-shell mission-shell">
      <a className="skip-link" href="#main">
        Przejdź do gry
      </a>
      <header className="topbar">
        <a
          className="brand"
          href="#main"
          aria-label="FORTRESS LAB — NEXUS Logistics"
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
            <strong>NEXUS Logistics</strong>
          </div>
        </div>
        <span className="version">
          DEV 0.2 <span>· Decision Cockpit</span>
        </span>
      </header>
      <GameplayHelp />
      <PersistenceToolbar
        game={game}
        legacyRaw={operations.legacyRaw}
        previousRaw={operations.previousRaw}
        thirdRaw={operations.thirdRaw}
        fourthRaw={operations.fourthRaw}
        fifthRaw={operations.fifthRaw}
        sixthRaw={operations.sixthRaw}
        seventhRaw={operations.seventhRaw}
        eighthRaw={operations.eighthRaw}
        canExport={operations.canResume}
        status={operations.saveStatus}
        error={operations.saveError}
        onRetry={operations.retrySave}
        onHistory={() => operations.setHistoryVisible(true)}
        onImport={(save) => {
          if (
            !window.confirm(
              'Import zastąpi bieżącą grę i zapis V9. Oryginały V1/V2/V3/V4/V5/V6/V7/V8 oraz historia pozostaną. Kontynuować?',
            )
          )
            return;
          operations.restore(save);
          setMenu(false);
        }}
      />
      {operations.historyVisible ? (
        <AttemptHistory
          game={game}
          entries={operations.history}
          error={operations.historyError}
          onBack={() => operations.setHistoryVisible(false)}
          onClear={() => {
            if (
              window.confirm(
                'Usunąć historię samodzielnych prób? Bieżąca gra oraz kampania pozostaną.',
              )
            )
              operations.clearHistory();
          }}
          onRetry={operations.retryHistory}
          onReplay={(entry) => start(entry.mode, entry.seed)}
        />
      ) : menu ? (
        <>
          {operations.canResume && (
            <section className="resume-card" aria-label="Wznowienie rozgrywki">
              <div>
                <p className="eyebrow">Świat czeka na Twoją decyzję</p>
                <h1>
                  Kontynuuj{' '}
                  {game.kind === 'campaign' ? 'kampanię' : 'rozgrywkę'}
                </h1>
                <p>
                  {game.kind === 'campaign' &&
                  game.campaign.phase === 'preparation'
                    ? `Centrala · okno ${game.campaign.preparation.number} · rozliczono ${game.campaign.preparation.hour} / 4 h.`
                    : session
                      ? `Tura ${session.simulation.clock.turn} / 18 · czas świata stoi podczas nieobecności.`
                      : ''}
                </p>
              </div>
              <button
                className="advance-button"
                autoFocus
                onClick={() => {
                  operations.resume();
                  setMenu(false);
                }}
              >
                Kontynuuj rozgrywkę
              </button>
            </section>
          )}
          <ScenarioSelection
            autoFocus={!operations.canResume}
            onSelect={(mode) => start(mode, mode === 'training' ? 0 : 1)}
            onStrategy={() => {
              if (confirmReplace()) {
                operations.startCampaign();
                setMenu(false);
              }
            }}
          />
        </>
      ) : game.kind === 'campaign' && game.campaign.phase === 'preparation' ? (
        <Headquarters
          session={game}
          onCommand={operations.campaignCommand}
          onTab={operations.headquartersTab}
          onUi={operations.updateUi}
          onMenu={() => setMenu(true)}
        />
      ) : session ? (
        <MissionWorkspace
          key={session.attemptId}
          operations={operations}
          session={session}
          onMenu={() => setMenu(true)}
        />
      ) : null}
      <footer className="app-footer">
        <span>FORTRESS LAB / NEXUS Logistics</span>
        <span>
          After Action Review <span className="footer-dot" /> Rozdział I ·
          M01–M06
        </span>
      </footer>
    </div>
  );
}
