import { describe, expect, it } from 'vitest';
import activeFixture from './fixtures/sprint6-active-v1.json?raw';
import legalFixture from './fixtures/sprint6-legal-v1.json?raw';
import {
  applyCampaignSession,
  createStandalone,
  createStrategicSession,
  currentOperation,
} from '../application/gameSession';
import type { GameSession, StrategicSession } from '../application/gameSession';
import { applyOperationCommand } from '../application/operationSession';
import type { CampaignCommand } from '../domain/campaign';
import {
  createGameSave,
  MAX_GAME_BYTES,
  MAX_GAME_COMMANDS,
  readGameSave,
  serializeGameSave,
  GAME_SAVE_KEY,
} from './gameSave';
import { loadGameState, storeGameState } from './gameStorage';
import { SAVE_KEY } from './localStorage';
import type { StorageAdapter } from './localStorage';
import { createSave, readSave, sameJson } from './saveFormat';
const date = '2026-10-17T05:00:00.000Z';
const later = '2026-10-17T06:00:00.000Z';
const fixture = (name: string) =>
  name === 'sprint6-active-v1.json' ? activeFixture : legalFixture;
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
  return { data, store };
}
function roundtrip<T extends GameSession>(game: T): T {
  const text = serializeGameSave(createGameSave(game, later));
  if (!text.ok) throw new Error(text.error);
  const loaded = readGameSave(text.value);
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.value.session as T;
}
const apply = (g: StrategicSession, ...cs: CampaignCommand[]) =>
  cs.reduce((s, c) => applyCampaignSession(s, c, date), g);
const hour: CampaignCommand = { type: 'advance-preparation' };
const turn: CampaignCommand = {
  type: 'incident-command',
  command: { type: 'advance-turn' },
};
const plan: CampaignCommand[] = [
  { type: 'plan-project', projectId: 'file-visibility' },
  { type: 'reserve-project', projectId: 'file-visibility' },
  { type: 'assign-work', projectId: 'file-visibility', workerId: 'analyst' },
  {
    type: 'assign-work',
    projectId: 'file-visibility',
    workerId: 'administrator',
  },
];
function finish(g: StrategicSession) {
  while (g.campaign.phase === 'incident') g = apply(g, turn);
  return g;
}

describe('FortressSaveV2 — jeden autorytatywny stan', () => {
  it.each([0, 1, 2])(
    'zapisuje kampanię seed %i przed zakupem i w środku wdrożenia',
    (seed) => {
      const g = createStrategicSession('campaign-test', date, seed);
      expect(roundtrip(g)).toEqual(g);
      const working = apply(g, ...plan, hour, hour);
      expect(roundtrip(working)).toEqual(working);
      expect(working.campaign.projects[1]!.remaining).toEqual({
        administrator: 0,
        analyst: 2,
      });
      expect(apply(roundtrip(working), hour, hour)).toEqual(
        apply(working, hour, hour),
      );
    },
  );
  it.each([0, 1, 2])(
    'eksport/import w środku incydentu seed %i zachowuje cały przyszły przebieg i następne okno',
    (seed) => {
      let g = apply(
        createStrategicSession('campaign-test', date, seed),
        ...plan,
        hour,
        hour,
        hour,
        hour,
        { type: 'start-incident' },
      );
      g = apply(
        g,
        turn,
        turn,
        turn,
        turn,
        {
          type: 'incident-command',
          command: {
            type: 'schedule-task',
            workerId: 'analyst',
            action: { type: 'inspect-file-access' },
          },
        },
        turn,
      );
      expect(currentOperation(g)!.simulation).toBe(g.campaign.incident);
      const loaded = roundtrip(g);
      expect(loaded.campaign).toEqual(g.campaign);
      expect(finish(loaded)).toEqual(finish(g));
      const next: CampaignCommand[] = [
        { type: 'return-headquarters' },
        hour,
        hour,
        hour,
        hour,
        { type: 'start-incident' },
        turn,
      ];
      expect(apply(roundtrip(finish(g)), ...next)).toEqual(
        apply(finish(g), ...next),
      );
    },
  );
  it('samodzielny incydent V2 zachowuje dotychczasową deterministyczność', () => {
    let g = createStandalone('unknown', 2, 'standalone-test', date);
    if (g.kind !== 'incident') throw new Error();
    g = {
      ...g,
      operation: applyOperationCommand(
        g.operation,
        { type: 'advance-turn' },
        date,
      ),
    };
    expect(roundtrip(g)).toEqual(g);
  });
  it('wczytanie nie wykonuje pracy, tury ani nowego uwierzytelnienia', () => {
    const g = apply(
      createStrategicSession('campaign-test', date),
      ...plan,
      hour,
      hour,
      hour,
      hour,
      { type: 'start-incident' },
      turn,
      turn,
      turn,
    );
    expect(roundtrip(roundtrip(g))).toEqual(g);
    expect(g.campaign.incident!.clock.turn).toBe(3);
  });
  it('zachowuje zakładkę centrali, mapę i aktywny wybór', () => {
    const g: StrategicSession = {
      ...createStrategicSession('campaign-test', date),
      headquartersTab: 'map',
      uiState: {
        briefing: true,
        context: 'cases',
        layer: 'identity',
        selection: { kind: 'asset', id: 'ad' },
      },
    };
    expect(roundtrip(g)).toEqual(g);
  });
  it('pozostała praca przechodzi przez import i kolejne okno bez drugiej płatności', () => {
    let g = apply(
      createStrategicSession('campaign-test', date),
      hour,
      hour,
      ...plan,
      hour,
      hour,
      { type: 'start-incident' },
    );
    g = apply(finish(g), { type: 'return-headquarters' });
    const before = g.campaign.budget;
    const after = apply(
      roundtrip(g),
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'analyst',
      },
      hour,
      hour,
    );
    expect(after.campaign.posture.fileVisibility).toBe(true);
    expect(after.campaign.budget).toEqual(before);
  });
});

describe('niezaufane pliki V2', () => {
  it.each(['{bad', 'null', '[]', '1'])(
    'odrzuca %s bez zmiany bieżącej gry',
    (text) => {
      const g = createStrategicSession('campaign-test', date);
      const copy = structuredClone(g);
      expect(readGameSave(text).ok).toBe(false);
      expect(g).toEqual(copy);
    },
  );
  it.each(['schemaVersion', 'engineVersion', 'contentVersion'])(
    'odrzuca nieznaną wersję %s',
    (key) => {
      expect(
        readGameSave(
          JSON.stringify({
            ...createGameSave(
              createStrategicSession('campaign-test', date),
              date,
            ),
            [key]: 99,
          }),
        ).ok,
      ).toBe(false);
    },
  );
  it.each([
    (g: StrategicSession) => ({
      ...g,
      campaign: {
        ...g.campaign,
        budget: { ...g.campaign.budget, total: 999999 },
      },
    }),
    (g: StrategicSession) => ({
      ...g,
      campaign: {
        ...g.campaign,
        posture: { ...g.campaign.posture, remoteAccess: true },
      },
    }),
    (g: StrategicSession) => ({
      ...g,
      campaign: {
        ...g.campaign,
        preparation: { ...g.campaign.preparation, hour: 10 },
      },
    }),
    (g: StrategicSession) => ({
      ...g,
      commands: [{ type: 'reserve-project', projectId: 'unknown' }],
    }),
    (g: StrategicSession) => ({
      ...g,
      commands: [
        {
          type: 'assign-work',
          projectId: 'remote-access',
          workerId: ['administrator'],
        },
      ],
    }),
    (g: StrategicSession) => ({
      ...g,
      missionMetadata: {
        attemptId: 'forged',
        createdAt: date,
        completedAt: null,
      },
    }),
    (g: StrategicSession) => ({ ...g, headquartersTab: ['map'] }),
    (g: StrategicSession) => ({ ...g, uiState: {} }),
    (g: StrategicSession) => ({
      ...g,
      commands: Array.from({ length: MAX_GAME_COMMANDS + 1 }, () => hour),
    }),
  ])('odrzuca podmieniony stan, konfigurację lub komendy #%#', (mutate) => {
    const g = createStrategicSession('campaign-test', date);
    const copy = structuredClone(g);
    expect(
      readGameSave(
        JSON.stringify({ ...createGameSave(g, later), session: mutate(g) }),
      ).ok,
    ).toBe(false);
    expect(g).toEqual(copy);
  });
  it('odrzuca zły identyfikator bieżącej misji, termin zadania i ukryty licznik', () => {
    const g = apply(
      createStrategicSession('campaign-test', date),
      hour,
      hour,
      hour,
      hour,
      { type: 'start-incident' },
    );
    expect(
      readGameSave(
        JSON.stringify(
          createGameSave(
            {
              ...g,
              missionMetadata: {
                ...g.missionMetadata!,
                attemptId: 'foreign-mission',
              },
            },
            later,
          ),
        ),
      ).ok,
    ).toBe(false);
    const changed = {
      ...g,
      campaign: {
        ...g.campaign,
        incident: {
          ...g.campaign.incident!,
          hidden: { ...g.campaign.incident!.hidden, attacker: null },
        },
      },
    };
    expect(
      readGameSave(JSON.stringify(createGameSave(changed, later))).ok,
    ).toBe(false);
  });
  it('odrzuca nadmierny rozmiar i nie uruchamia obcych komend', () => {
    expect(readGameSave(' '.repeat(MAX_GAME_BYTES + 1)).ok).toBe(false);
    expect(
      readGameSave(
        JSON.stringify({
          ...createGameSave(
            createStrategicSession('campaign-test', date),
            later,
          ),
          extra: { constructor: { polluted: true } },
        }),
      ).ok,
    ).toBe(false);
    expect(Object.hasOwn({}, 'polluted')).toBe(false);
  });
});

describe('aktualizacja Sprintu 6 i oryginały V1', () => {
  it.each(['sprint6-active-v1.json', 'sprint6-legal-v1.json'])(
    'prawdziwy fixture ze źródeł d1c3d56: %s odtwarza identyczny świat',
    (name) => {
      const text = fixture(name);
      const old = readSave(text);
      const migrated = readGameSave(text);
      expect(old.ok).toBe(true);
      expect(migrated.ok).toBe(true);
      if (!old.ok || !migrated.ok) throw new Error();
      expect(currentOperation(migrated.value.session)).toEqual(
        old.value
          ? {
              attemptId: old.value.attemptId,
              createdAt: old.value.createdAt,
              completedAt: old.value.completedAt,
              commands: old.value.commands,
              simulation: old.value.simulation,
              uiState: old.value.uiState,
            }
          : null,
      );
      expect(roundtrip(migrated.value.session)).toEqual(migrated.value.session);
    },
  );
  it('odczyt i świadome wznowienie do V2 nigdy nie zmieniają bajtów klucza V1', () => {
    const text = fixture('sprint6-active-v1.json');
    const { store, data } = memory();
    data.set(SAVE_KEY, text);
    const boot = loadGameState(store);
    expect(boot.result.ok).toBe(true);
    expect(data.has(GAME_SAVE_KEY)).toBe(false);
    expect(boot.legacyRaw).toBe(text);
    if (!boot.result.ok || !boot.result.value) throw new Error();
    expect(storeGameState(store, boot.result.value, later).ok).toBe(true);
    expect(data.get(SAVE_KEY)).toBe(text);
    expect(data.has(GAME_SAVE_KEY)).toBe(true);
    expect(loadGameState(store).result).toEqual(boot.result);
    expect(data.get(SAVE_KEY)).toBe(text);
  });
  it('nieobsługiwanego V1 nie udaje migracji; zachowuje oryginał do eksportu', () => {
    const { store, data } = memory();
    const text = JSON.stringify({
      ...JSON.parse(fixture('sprint6-active-v1.json')),
      engineVersion: 'unknown',
    });
    data.set(SAVE_KEY, text);
    const boot = loadGameState(store);
    expect(boot.result.ok).toBe(false);
    expect(boot.legacyRaw).toBe(text);
    expect(data.get(SAVE_KEY)).toBe(text);
    expect(
      storeGameState(store, createStrategicSession('new-campaign', date), later)
        .ok,
    ).toBe(true);
    expect(data.get(SAVE_KEY)).toBe(text);
  });
  it('po V1 i V2 wykonuje te same komendy do identycznego finału', () => {
    const legacy = readSave(fixture('sprint6-active-v1.json'));
    const migrated = readGameSave(fixture('sprint6-active-v1.json'));
    if (
      !legacy.ok ||
      !migrated.ok ||
      migrated.value.session.kind !== 'incident'
    )
      throw new Error();
    let a = legacy.value.simulation;
    let b = migrated.value.session.operation;
    for (let i = 5; i < 18; i++) {
      a = simulationReducerForFixture(a);
      b = applyOperationCommand(b, { type: 'advance-turn' }, date);
    }
    expect(sameJson(a, b.simulation)).toBe(true);
    expect(readSave(JSON.stringify(createSave(b, later))).ok).toBe(true);
  });
  it('uszkodzony V2 nie jest maskowany automatycznym powrotem do starego V1', () => {
    const { store, data } = memory();
    const old = fixture('sprint6-active-v1.json');
    data.set(SAVE_KEY, old);
    data.set(GAME_SAVE_KEY, 'broken');
    expect(loadGameState(store).result.ok).toBe(false);
    expect(loadGameState(store).legacyRaw).toBe(old);
    expect(data.get(GAME_SAVE_KEY)).toBe('broken');
  });
  it('SecurityError i QuotaExceededError nie niszczą gry ani oryginalnego zapisu', () => {
    const s = createStrategicSession('campaign-test', date);
    const denied: StorageAdapter = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(loadGameState(denied).result.ok).toBe(false);
    expect(storeGameState(denied, s, later).ok).toBe(false);
    expect(roundtrip(s)).toEqual(s);
  });
});
import { simulationReducer } from '../application/simulationReducer';
import type { SimulationState } from '../domain/simulation';
function simulationReducerForFixture(s: SimulationState) {
  return simulationReducer(s, { type: 'advance-turn' });
}
