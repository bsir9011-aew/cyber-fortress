import { useEffect, useRef, useState } from 'react';
import {
  applyOperationCommand,
  createOperationSession,
} from '../application/operationSession';
import type {
  OperationSession,
  RecordedCommand,
  SavedUiState,
} from '../application/operationSession';
import type { ScenarioMode } from '../domain/scenario';
import { createSave, toOperationSession } from '../persistence/saveFormat';
import type { FortressSaveV1 } from '../persistence/saveFormat';
import { appendAttempt, summarizeAttempt } from '../persistence/attemptHistory';
import {
  browserStorage,
  clearAttemptHistory,
  loadAttemptHistory,
  loadLocalSave,
  storeAttemptHistory,
  storeLocalSave,
} from '../persistence/localStorage';

const storage = browserStorage();
const now = () => new Date().toISOString();
const fresh = (mode: ScenarioMode, seed: number) =>
  createOperationSession(mode, seed, crypto.randomUUID(), now());

/** Hydratacja jest leniwa. Zapis pozostaje wyłączony do świadomego startu/wznowienia. */
export function usePersistentOperations() {
  const [boot] = useState(() => ({
    save: loadLocalSave(storage),
    history: loadAttemptHistory(storage),
  }));
  const saved = boot.save.ok ? boot.save.value : null;
  const [session, setSession] = useState<OperationSession>(() =>
    saved ? toOperationSession(saved) : fresh('training', 0),
  );
  const [active, setActive] = useState(false);
  const [hasSave, setHasSave] = useState(Boolean(saved) || !boot.save.ok);
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
    saved
      ? 'Zapisano.'
      : boot.save.ok
        ? 'Brak zapisu.'
        : 'Zapis nie powiódł się.',
  );
  const [saveError, setSaveError] = useState(
    boot.save.ok ? '' : boot.save.error,
  );
  const [historyVisible, setHistoryVisible] = useState(false);
  const lastWritten = useRef<OperationSession | null>(null);

  useEffect(() => {
    if (!active || session === lastWritten.current) return;
    const result = storeLocalSave(storage, createSave(session, now()));
    setSaveStatus(result.ok ? 'Zapisano.' : 'Zapis nie powiódł się.');
    setSaveError(result.ok ? '' : result.error);
    if (result.ok) {
      lastWritten.current = session;
      setHasSave(true);
    }
  }, [session, active]);

  useEffect(() => {
    if (!active || historyCorrupt.current) return;
    const entry = summarizeAttempt(session);
    if (!entry || (clearedAt && entry.completedAt <= clearedAt)) return;
    const next = appendAttempt(history, entry);
    if (next === history) return;
    // Zachowujemy wynik w pamięci również przy braku miejsca na dysku.
    setHistory(next);
    const result = storeAttemptHistory(storage, {
      schemaVersion: 1,
      attempts: next,
      clearedAt,
    });
    setHistoryError(result.ok ? '' : result.error);
  }, [session, active, history, clearedAt]);

  function start(mode: ScenarioMode, seed: number) {
    setSession(fresh(mode, seed));
    setActive(true);
    setHistoryVisible(false);
  }
  function updateUi(patch: Partial<SavedUiState>) {
    setSession((current) => ({
      ...current,
      uiState: { ...current.uiState, ...patch },
    }));
  }
  function command(command: RecordedCommand) {
    const date = now();
    setSession((current) => applyOperationCommand(current, command, date));
  }
  function restore(save: FortressSaveV1) {
    // Nie kopiujemy pól formatu do sesji, aby kolejne eksporty miały jeden schemat.
    setSession(toOperationSession(save));
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
    setSession((current) => ({ ...current }));
  }
  function retryHistory() {
    if (historyCorrupt.current) return;
    const result = storeAttemptHistory(storage, {
      schemaVersion: 1,
      attempts: history,
      clearedAt,
    });
    setHistoryError(result.ok ? '' : result.error);
  }
  return {
    session,
    active,
    hasSave,
    canResume: active || Boolean(saved),
    saveStatus,
    saveError,
    history,
    historyError,
    historyVisible,
    setHistoryVisible,
    start,
    updateUi,
    command,
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
