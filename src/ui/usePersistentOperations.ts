import { useEffect, useRef, useState } from 'react';
import { applyOperationCommand } from '../application/operationSession';
import type {
  RecordedCommand,
  SavedUiState,
} from '../application/operationSession';
import {
  applyCampaignSession,
  createStandalone,
  createStrategicSession,
  currentOperation,
} from '../application/gameSession';
import type { GameSession, HeadquartersTab } from '../application/gameSession';
import type { ScenarioMode } from '../domain/scenario';
import type { CampaignCommand } from '../domain/campaign';
import type { FortressSaveV8 } from '../persistence/gameSaveV8';
import {
  loadCurrentGameState as loadGameState,
  storeCurrentGameState as storeGameState,
} from '../persistence/resilienceGameStorage';
import { appendAttempt, summarizeAttempt } from '../persistence/attemptHistory';
import {
  browserStorage,
  clearAttemptHistory,
  loadAttemptHistory,
  storeAttemptHistory,
} from '../persistence/localStorage';
const storage = browserStorage();
const now = () => new Date().toISOString();
const fresh = (mode: ScenarioMode, seed: number) =>
  createStandalone(mode, seed, crypto.randomUUID(), now());

export function usePersistentOperations() {
  const [boot] = useState(() => ({
    game: loadGameState(storage),
    history: loadAttemptHistory(storage),
  }));
  const loaded = boot.game.result.ok ? boot.game.result.value : null;
  const [game, setGame] = useState<GameSession>(
    () => loaded ?? fresh('training', 0),
  );
  const session = currentOperation(game);
  const [active, setActive] = useState(false);
  const [hasSave, setHasSave] = useState(
    Boolean(loaded) || !boot.game.result.ok,
  );
  const [history, setHistory] = useState(() =>
    boot.history.ok ? (boot.history.value?.attempts ?? []) : [],
  );
  const [clearedAt, setClearedAt] = useState(() =>
    boot.history.ok ? (boot.history.value?.clearedAt ?? null) : null,
  );
  const historyCorrupt = useRef(
    !boot.history.ok && boot.history.code !== 'storage-unavailable',
  );
  const [historyError, setHistoryError] = useState(
    boot.history.ok ? '' : boot.history.error,
  );
  const [saveStatus, setSaveStatus] = useState(
    loaded
      ? 'Zapisano.'
      : boot.game.result.ok
        ? 'Brak zapisu.'
        : 'Zapis nie powiódł się.',
  );
  const [saveError, setSaveError] = useState(
    boot.game.result.ok ? '' : boot.game.result.error,
  );
  const [historyVisible, setHistoryVisible] = useState(false);
  const lastWritten = useRef<GameSession | null>(null);
  useEffect(() => {
    if (!active || game === lastWritten.current) return;
    const result = storeGameState(storage, game, now());
    setSaveStatus(result.ok ? 'Zapisano.' : 'Zapis nie powiódł się.');
    setSaveError(result.ok ? '' : result.error);
    if (result.ok) {
      lastWritten.current = game;
      setHasSave(true);
    }
  }, [game, active]);
  useEffect(() => {
    if (!active || game.kind !== 'incident' || historyCorrupt.current) return;
    const entry = summarizeAttempt(game.operation);
    if (!entry || (clearedAt && entry.completedAt <= clearedAt)) return;
    const next = appendAttempt(history, entry);
    if (next === history) return;
    setHistory(next);
    const result = storeAttemptHistory(storage, {
      schemaVersion: 1,
      attempts: next,
      clearedAt,
    });
    setHistoryError(result.ok ? '' : result.error);
  }, [game, active, history, clearedAt]);
  function start(mode: ScenarioMode, seed: number) {
    setGame(fresh(mode, seed));
    setActive(true);
    setHistoryVisible(false);
  }
  function startCampaign() {
    setGame(createStrategicSession(crypto.randomUUID(), now()));
    setActive(true);
    setHistoryVisible(false);
  }
  function updateUi(patch: Partial<SavedUiState>) {
    setGame((g) =>
      g.kind === 'incident'
        ? {
            ...g,
            operation: {
              ...g.operation,
              uiState: { ...g.operation.uiState, ...patch },
            },
          }
        : { ...g, uiState: { ...g.uiState, ...patch } },
    );
  }
  function command(command: RecordedCommand) {
    const date = now();
    setGame((g) =>
      g.kind === 'incident'
        ? { ...g, operation: applyOperationCommand(g.operation, command, date) }
        : applyCampaignSession(g, { type: 'incident-command', command }, date),
    );
  }
  function campaignCommand(command: CampaignCommand) {
    const date = now();
    setGame((g) =>
      g.kind === 'campaign' ? applyCampaignSession(g, command, date) : g,
    );
  }
  function headquartersTab(tab: HeadquartersTab) {
    setGame((g) =>
      g.kind === 'campaign' ? { ...g, headquartersTab: tab } : g,
    );
  }
  function restore(save: FortressSaveV8) {
    setGame(save.session);
    setActive(true);
    setHistoryVisible(false);
  }
  function clearHistory() {
    const date = now();
    const result = clearAttemptHistory(storage, date);
    if (!result.ok) {
      setHistoryError(result.error);
      return;
    }
    setHistory([]);
    setClearedAt(date);
    setHistoryError('');
    historyCorrupt.current = false;
  }
  function retrySave() {
    lastWritten.current = null;
    setGame((g) => ({ ...g }));
  }
  function retryHistory() {
    if (historyCorrupt.current) return;
    const r = storeAttemptHistory(storage, {
      schemaVersion: 1,
      attempts: history,
      clearedAt,
    });
    setHistoryError(r.ok ? '' : r.error);
  }
  return {
    game,
    session,
    active,
    hasSave,
    legacyRaw: boot.game.legacyRaw,
    previousRaw: boot.game.previousRaw,
    thirdRaw: boot.game.thirdRaw,
    fourthRaw: boot.game.fourthRaw,
    fifthRaw: boot.game.fifthRaw,
    sixthRaw: boot.game.sixthRaw,
    seventhRaw: boot.game.seventhRaw,
    canResume: active || Boolean(loaded),
    saveStatus,
    saveError,
    history,
    historyError,
    historyVisible,
    setHistoryVisible,
    start,
    startCampaign,
    updateUi,
    command,
    campaignCommand,
    headquartersTab,
    restore,
    clearHistory,
    retrySave,
    retryHistory,
    resume: () => {
      setActive(true);
      setHistoryVisible(false);
    },
  };
}
export type PersistentOperations = ReturnType<typeof usePersistentOperations>;
