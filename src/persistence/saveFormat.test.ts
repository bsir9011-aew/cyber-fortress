import { describe, expect, it } from 'vitest';
import {
  applyOperationCommand,
  createOperationSession,
} from '../application/operationSession';
import type {
  OperationSession,
  RecordedCommand,
} from '../application/operationSession';
import { selectMissionReport } from '../application/selectMissionReport';
import { selectPlayerView } from '../application/selectPlayerView';
import {
  createSave,
  MAX_COMMANDS,
  MAX_SAVE_BYTES,
  readSave,
  serializeSave,
  toOperationSession,
} from './saveFormat';
import {
  appendAttempt,
  HISTORY_LIMIT,
  readHistory,
  summarizeAttempt,
} from './attemptHistory';
import {
  clearAttemptHistory,
  HISTORY_KEY,
  loadAttemptHistory,
  loadLocalSave,
  SAVE_KEY,
  storeAttemptHistory,
  storeLocalSave,
} from './localStorage';
import type { StorageAdapter } from './localStorage';

const date = '2026-10-16T12:00:00.000Z';
const later = '2026-10-16T13:00:00.000Z';
const initial = (seed = 0) =>
  createOperationSession('unknown', seed, 'attempt-001', date);
const advance: RecordedCommand = { type: 'advance-turn' };
const logs: RecordedCommand = {
  type: 'schedule-task',
  workerId: 'analyst',
  action: { type: 'inspect-auth-logs' },
};
const sessions: RecordedCommand = {
  type: 'schedule-task',
  workerId: 'analyst',
  action: { type: 'inspect-vpn-sessions' },
};
const deny: RecordedCommand = {
  type: 'schedule-task',
  workerId: 'administrator',
  action: { type: 'set-network-rule', ruleId: 'R-SMB', action: 'deny' },
};
const vpnOff: RecordedCommand = {
  type: 'schedule-task',
  workerId: 'administrator',
  action: { type: 'set-vpn', assetId: 'vpn-gateway', enabled: false },
};
const apply = (state: OperationSession, ...commands: RecordedCommand[]) =>
  commands.reduce((s, c) => applyOperationCommand(s, c, date), state);
function until(state: OperationSession, turn: number) {
  while (state.simulation.clock.turn < turn) state = apply(state, advance);
  return state;
}
function roundtrip(session: OperationSession) {
  const encoded = serializeSave(createSave(session, later));
  if (!encoded.ok) throw new Error(encoded.error);
  const decoded = readSave(encoded.value);
  if (!decoded.ok) throw new Error(decoded.error);
  return toOperationSession(decoded.value);
}
function memory() {
  const data = new Map<string, string>();
  const store: StorageAdapter = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
  return { store, data };
}

describe('pełny zapis i deterministyczne wznowienie', () => {
  it.each([0, 1, 2])(
    'odczytuje identyczny stan początkowy wariantu %i',
    (seed) => {
      const session = initial(seed);
      expect(roundtrip(session)).toEqual(session);
      expect(session.simulation.hidden.attacker === null).toBe(seed === 1);
    },
  );
  it('14:25: zachowuje badanie, aktywną dziesięciominutową zmianę, sesje, biznes i prywatną historię', () => {
    let session = apply(initial(), logs, advance, sessions, advance);
    session = until(session, 4);
    session = apply(session, deny, advance);
    const resumed = roundtrip(session);
    expect(resumed).toEqual(session);
    expect(resumed.simulation.clock.turn).toBe(5);
    expect(resumed.simulation.tasks.at(-1)).toMatchObject({
      status: 'running',
      startTurn: 4,
      dueTurn: 6,
    });
    expect(resumed.simulation.hidden.attacker?.transfer.exposedRecords).toBe(
      1200,
    );
    expect(
      resumed.simulation.knowledge.authObservations[0]?.records.length,
    ).toBe(54);
    expect(
      resumed.simulation.knowledge.sessionObservation?.sessions.map(
        (s) => s.id,
      ),
    ).toContain('S-19');
    const next = apply(resumed, advance);
    expect(next.simulation.tasks.at(-1)?.status).toBe('completed');
    expect(next.simulation.hidden.attacker?.transfer.exposedRecords).toBe(1200);
    expect(
      next.simulation.access.rules.find((r) => r.id === 'R-SMB')?.action,
    ).toBe('deny');
  });
  it('zachowuje niezerową kolejkę po odcięciu działalności', () => {
    const id = initial().simulation.access.vpnAssetId;
    const s = until(
      apply(initial(), {
        ...vpnOff,
        action: { type: 'set-vpn', assetId: id, enabled: false },
      }),
      5,
    );
    expect(s.simulation.business.backlog).toBeGreaterThan(0);
    expect(roundtrip(s).simulation.business).toEqual(s.simulation.business);
  });
  it.each([0, 1, 2])(
    'wariant %i: ta sama sekwencja z przerwą i bez daje identyczny autorytatywny stan',
    (seed) => {
      const commands: RecordedCommand[] = [
        logs,
        advance,
        sessions,
        advance,
        {
          type: 'schedule-task',
          workerId: 'analyst',
          action: { type: 'contact-account-owner', accountId: 'magazyn-07' },
        },
        advance,
        { type: 'set-hypothesis', hypothesis: 'existing-tunnel-access' },
        advance,
        deny,
        advance,
        ...Array.from({ length: 13 }, () => advance),
      ];
      const continuous = apply(initial(seed), ...commands);
      const checkpoint = apply(initial(seed), ...commands.slice(0, 10));
      const resumed = apply(roundtrip(checkpoint), ...commands.slice(10));
      expect(resumed.simulation).toEqual(continuous.simulation);
      expect(resumed.commands).toEqual(continuous.commands);
      expect(selectMissionReport(resumed.simulation)).toEqual(
        selectMissionReport(continuous.simulation),
      );
      expect(resumed.simulation.telemetry.sourceEvents).toEqual(
        continuous.simulation.telemetry.sourceEvents,
      );
      expect(resumed.simulation.hidden.attacker).toEqual(
        continuous.simulation.hidden.attacker,
      );
      expect(resumed.simulation.hidden.decisionHistory).toEqual(
        continuous.simulation.hidden.decisionHistory,
      );
      expect(resumed.simulation.history).toEqual(continuous.simulation.history);
      expect(resumed.simulation.knowledge).toEqual(
        continuous.simulation.knowledge,
      );
    },
  );
  it('nie wykonuje logowania ani tury podczas samego odczytu lub eksportu', () => {
    const s = until(initial(2), 3);
    expect(s.simulation.hidden.attacker?.authenticationAttempts).toBe(1);
    expect(roundtrip(roundtrip(s))).toEqual(s);
    expect(s.simulation.hidden.attacker?.authenticationAttempts).toBe(1);
  });
  it('nie gubi odrzuconych komend i hipotezy z dziennika', () => {
    const s = apply(
      initial(),
      logs,
      logs,
      { type: 'set-hypothesis', hypothesis: 'unusual-legitimate-session' },
      advance,
    );
    expect(
      s.simulation.history.some((e) => e.kind === 'command-rejected'),
    ).toBe(true);
    expect(roundtrip(s)).toEqual(s);
  });
  it('przywraca kontekst, warstwę, wybór mapy i zakończony briefing bez wpływu na świat', () => {
    const s = initial();
    const session: OperationSession = {
      ...s,
      uiState: {
        briefing: false,
        context: 'architecture',
        layer: 'network',
        selection: { kind: 'asset', id: s.simulation.access.vpnAssetId },
      },
    };
    expect(roundtrip(session)).toEqual(session);
    expect(selectPlayerView(roundtrip(session).simulation)).toEqual(
      selectPlayerView(s.simulation),
    );
  });
  it('po odczycie i ponownym zapisie aktualizuje metadane bez pól ze starej koperty', () => {
    const save = createSave(roundtrip(initial()), later);
    expect(save.savedAt).toBe(later);
    expect(readSave(JSON.stringify(save)).ok).toBe(true);
  });
});

describe('walidacja niezaufanego JSON', () => {
  it.each([
    { type: 'set-hypothesis', hypothesis: ['compromised-credential'] },
    {
      type: 'schedule-task',
      workerId: ['analyst'],
      action: { type: 'inspect-auth-logs' },
    },
    {
      type: 'schedule-task',
      workerId: 'administrator',
      action: { type: 'set-network-rule', ruleId: 'R-SMB', action: ['deny'] },
    },
  ])('odrzuca tablicę udającą wartość enum: %j', (command) => {
    const s = apply(initial(), command as unknown as RecordedCommand);
    expect(readSave(JSON.stringify(createSave(s, later))).ok).toBe(false);
  });
  it.each(['context', 'layer'])(
    'odrzuca tablicę udającą pole UI %s',
    (field) => {
      const save = createSave(initial(), later);
      expect(
        readSave(
          JSON.stringify({
            ...save,
            uiState: {
              ...save.uiState,
              [field]: [save.uiState[field as 'context' | 'layer']],
            },
          }),
        ).ok,
      ).toBe(false);
    },
  );
  it.each(['', '{bad', 'null', '[]', '42'])(
    'odrzuca niepoprawny JSON lub dokument %s',
    (text) => expect(readSave(text).ok).toBe(false),
  );
  it.each([
    'schemaVersion',
    'engineVersion',
    'contentVersion',
    'scenarioVersion',
  ])('odrzuca niezgodną wersję %s', (field) => {
    expect(
      readSave(JSON.stringify({ ...createSave(initial(), later), [field]: 99 }))
        .ok,
    ).toBe(false);
  });
  const mutations: [
    string,
    (save: ReturnType<typeof createSave>) => unknown,
  ][] = [
    [
      'brak wiedzy',
      (s) => ({ ...s, simulation: { ...s.simulation, knowledge: undefined } }),
    ],
    [
      'ujemna tura',
      (s) => ({
        ...s,
        simulation: {
          ...s.simulation,
          clock: { ...s.simulation.clock, turn: -1 },
        },
      }),
    ],
    [
      'tura powyżej limitu',
      (s) => ({
        ...s,
        simulation: {
          ...s.simulation,
          clock: { ...s.simulation.clock, turn: 19 },
        },
      }),
    ],
    [
      'niespójne liczniki',
      (s) => ({
        ...s,
        simulation: {
          ...s.simulation,
          business: { ...s.simulation.business, backlog: 999 },
        },
      }),
    ],
    ['nieznany scenariusz', (s) => ({ ...s, scenarioId: 'missing' })],
    [
      'zmieniona sesja',
      (s) => ({
        ...s,
        simulation: {
          ...s.simulation,
          access: { ...s.simulation.access, sessions: [] },
        },
      }),
    ],
    [
      'obce konto',
      (s) => ({
        ...s,
        simulation: {
          ...s.simulation,
          access: { ...s.simulation.access, accounts: [{ id: 'missing' }] },
        },
      }),
    ],
    [
      'brak przeciwnika',
      (s) => ({
        ...s,
        simulation: {
          ...s.simulation,
          hidden: { ...s.simulation.hidden, attacker: null },
        },
      }),
    ],
    [
      'niepoprawny seed',
      (s) => ({
        ...s,
        simulation: { ...s.simulation, run: { mode: 'unknown', seed: -1 } },
      }),
    ],
    [
      'nieznana komenda',
      (s) => ({ ...s, commands: [{ type: 'eval', code: 'x' }] }),
    ],
    ['reset w komendach', (s) => ({ ...s, commands: [{ type: 'reset' }] })],
    [
      'brak pola komendy',
      (s) => ({
        ...s,
        commands: [{ type: 'schedule-task', workerId: 'analyst' }],
      }),
    ],
    ['fałszywe zakończenie', (s) => ({ ...s, completedAt: date })],
    [
      'nieznany wybór UI',
      (s) => ({
        ...s,
        uiState: { ...s.uiState, selection: { kind: 'asset', id: 'missing' } },
      }),
    ],
    ['brak pola UI', (s) => ({ ...s, uiState: {} })],
    [
      'za dużo komend',
      (s) => ({
        ...s,
        commands: Array.from({ length: MAX_COMMANDS + 1 }, () => advance),
      }),
    ],
    ['nieprawidłowa data', (s) => ({ ...s, savedAt: 'yesterday' })],
    ['obce pole', (s) => ({ ...s, extra: true })],
  ];
  it.each(mutations)(
    'odrzuca: %s; oryginał pozostaje nietknięty',
    (_name, mutate) => {
      const s = until(apply(initial(), logs, advance), 5);
      const before = structuredClone(s);
      expect(readSave(JSON.stringify(mutate(createSave(s, later)))).ok).toBe(
        false,
      );
      expect(s).toEqual(before);
      expect(roundtrip(s)).toEqual(before);
    },
  );
  it('odrzuca nadmierny rozmiar przed parsowaniem', () =>
    expect(readSave(' '.repeat(MAX_SAVE_BYTES + 1)).ok).toBe(false));
  it('odrzuca zbyt głęboki dokument bez przepełnienia stosu', () => {
    const s = createSave(initial(), later);
    expect(
      readSave(
        JSON.stringify({
          ...s,
          nested: JSON.parse('['.repeat(100) + '0' + ']'.repeat(100)),
        }),
      ).ok,
    ).toBe(false);
  });
  it('odrzuca klucze prototypu i nie wykonuje zawartości pliku', () => {
    const text = JSON.stringify(createSave(initial(), later)).replace(
      '"uiState":',
      '"__proto__":{"polluted":true},"uiState":',
    );
    expect(readSave(text).ok).toBe(false);
    expect(Object.hasOwn({}, 'polluted')).toBe(false);
  });
});

describe('adapter localStorage i historia prób', () => {
  it('import wcześniejszego punktu tej samej próby aktualizuje wynik zamiast dublować ID', () => {
    const old = summarizeAttempt(until(initial(), 18))!;
    const newResult = {
      ...old,
      exposedRecords: 0,
      confidentialityMet: true,
      containmentMet: true,
      completedAt: later,
    };
    const history = appendAttempt([old], newResult);
    expect(history).toEqual([newResult]);
    expect(appendAttempt(history, newResult)).toBe(history);
  });
  it('sam odczyt przy inicjalizacji nigdy nie nadpisuje istniejącego zapisu', () => {
    const { store, data } = memory();
    const save = createSave(until(initial(), 5), later);
    storeLocalSave(store, save);
    const text = data.get(SAVE_KEY);
    expect(loadLocalSave(store)).toEqual({ ok: true, value: save });
    expect(loadLocalSave(store)).toEqual({ ok: true, value: save });
    expect(data.get(SAVE_KEY)).toBe(text);
  });
  it('brak zapisu jest poprawnym wynikiem', () =>
    expect(loadLocalSave(memory().store)).toEqual({ ok: true, value: null }));
  it('nie zastępuje starego zapisu, gdy nowy jest niespójny', () => {
    const { store, data } = memory();
    const save = createSave(initial(), later);
    storeLocalSave(store, save);
    const before = data.get(SAVE_KEY);
    expect(storeLocalSave(store, { ...save, scenarioId: 'missing' }).ok).toBe(
      false,
    );
    expect(data.get(SAVE_KEY)).toBe(before);
  });
  it.each(['SecurityError', 'QuotaExceededError'])(
    'obsługuje %s bez awarii ani naruszenia symulacji',
    (name) => {
      const store: StorageAdapter = {
        getItem: () => {
          throw new Error(name);
        },
        setItem: () => {
          throw new Error(name);
        },
        removeItem: () => {
          throw new Error(name);
        },
      };
      const session = initial();
      const before = structuredClone(session);
      expect(loadLocalSave(store).ok).toBe(false);
      expect(storeLocalSave(store, createSave(session, later)).ok).toBe(false);
      expect(loadAttemptHistory(store).ok).toBe(false);
      expect(clearAttemptHistory(store, later).ok).toBe(false);
      expect(roundtrip(session)).toEqual(before);
    },
  );
  it('archiwizuje zakończenie raz; reset zachowuje historię i identyczny wariant', () => {
    const completed = until(initial(2), 18);
    const entry = summarizeAttempt(completed)!;
    const history = appendAttempt([], entry);
    expect(appendAttempt(history, entry)).toBe(history);
    const replay = createOperationSession(
      completed.simulation.run.mode,
      completed.simulation.run.seed,
      'attempt-002',
      later,
    );
    expect(replay.simulation).toEqual(initial(2).simulation);
    expect(replay.commands).toEqual([]);
    expect(history).toHaveLength(1);
    const { store } = memory();
    storeAttemptHistory(store, {
      schemaVersion: 1,
      attempts: history,
      clearedAt: null,
    });
    expect(loadAttemptHistory(store)).toEqual({
      ok: true,
      value: { schemaVersion: 1, attempts: history, clearedAt: null },
    });
  });
  it('legalny wariant ma brak zastosowania ograniczenia i nie dostaje fałszywego zwycięstwa nad atakiem', () => {
    const s = until(initial(1), 18);
    const entry = summarizeAttempt(roundtrip(s));
    expect(entry).toMatchObject({
      containmentMet: null,
      exposedRecords: 0,
      continuityMet: true,
    });
    expect(s.simulation.hidden.attacker).toBeNull();
  });
  it('limit historii to 50; czyszczenie nie rusza aktywnego zapisu', () => {
    const entry = summarizeAttempt(until(initial(), 18))!;
    let entries = [entry];
    for (let i = 0; i < 60; i++)
      entries = [
        ...appendAttempt(entries, { ...entry, attemptId: `attempt-${i}` }),
      ];
    expect(entries).toHaveLength(HISTORY_LIMIT);
    const { store, data } = memory();
    storeLocalSave(store, createSave(initial(), later));
    const before = data.get(SAVE_KEY);
    expect(clearAttemptHistory(store, later).ok).toBe(true);
    expect(loadAttemptHistory(store)).toEqual({
      ok: true,
      value: { schemaVersion: 1, attempts: [], clearedAt: later },
    });
    expect(data.get(SAVE_KEY)).toBe(before);
  });
  it('uszkodzona historia nie niszczy poprawnego zapisu', () => {
    const { store, data } = memory();
    storeLocalSave(store, createSave(initial(), later));
    data.set(HISTORY_KEY, '{}');
    expect(loadAttemptHistory(store).ok).toBe(false);
    expect(loadLocalSave(store).ok).toBe(true);
    expect(
      readHistory(
        JSON.stringify({ schemaVersion: 99, attempts: [], clearedAt: null }),
      ).ok,
    ).toBe(false);
  });
});
