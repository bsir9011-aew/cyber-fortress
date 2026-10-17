import { describe, expect, it } from 'vitest';
import activeV1 from './fixtures/sprint6-active-v1.json?raw';
import legalV1 from './fixtures/sprint6-legal-v1.json?raw';
import blockedV2 from './fixtures/sprint7-blocked-v2.json?raw';
import recoveryV2 from './fixtures/sprint7-recovery-v2.json?raw';
import {
  createCurrentGameSave,
  CURRENT_GAME_SAVE_KEY,
  isCurrentCampaignCommand,
  isCurrentRecordedCommand,
  readCurrentGameSave,
  serializeCurrentGameSave,
} from './gameSaveV3';
import { readGameSave, GAME_SAVE_KEY, isCampaignCommand } from './gameSave';
import { SAVE_KEY } from './localStorage';
import {
  loadCurrentGameState,
  storeCurrentGameState,
} from './currentGameStorage';
import {
  applyCampaignSession,
  currentOperation,
} from '../application/gameSession';
import type { StrategicSession } from '../application/gameSession';
import type { CampaignCommand } from '../domain/campaign';
import { sameJson } from './saveFormat';

const date = '2026-10-17T10:00:00.000Z';
const hour: CampaignCommand = { type: 'advance-preparation' };
const turn: CampaignCommand = {
  type: 'incident-command',
  command: { type: 'advance-turn' },
};
const apply = (g: StrategicSession, ...cs: CampaignCommand[]) =>
  cs.reduce((s, c) => applyCampaignSession(s, c, date), g);
function finish(g: StrategicSession) {
  while (g.campaign.phase === 'incident') g = apply(g, turn);
  return g;
}
function initial() {
  const loaded = readCurrentGameSave(blockedV2);
  if (!loaded.ok || loaded.value.session.kind !== 'campaign')
    throw new Error('Fixture failed');
  return apply(
    finish(loaded.value.session),
    { type: 'return-headquarters' },
    hour,
    hour,
    hour,
    hour,
    { type: 'start-integrity-incident' },
  );
}
const action = (
  type:
    | 'isolate-endpoint'
    | 'examine-endpoint'
    | 'inspect-backups'
    | 'verify-backup'
    | 'restore-documents',
): CampaignCommand => ({
  type: 'incident-command',
  command: {
    type: 'schedule-task',
    workerId:
      type === 'isolate-endpoint' || type === 'restore-documents'
        ? 'administrator'
        : 'analyst',
    action:
      type === 'verify-backup' || type === 'restore-documents'
        ? { type, backupId: 'FS-1350' }
        : type === 'isolate-endpoint' || type === 'examine-endpoint'
          ? { type, endpointId: 'pakowanie-03' }
          : { type },
  },
});
function roundtrip(g: StrategicSession) {
  const encoded = serializeCurrentGameSave(createCurrentGameSave(g, date));
  if (!encoded.ok) throw new Error(encoded.error);
  const read = readCurrentGameSave(encoded.value);
  if (!read.ok || read.value.session.kind !== 'campaign')
    throw new Error('Roundtrip rejected');
  return read.value.session;
}
function memory() {
  const data = new Map<string, string>();
  return {
    data,
    storage: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
      removeItem: (k: string) => {
        data.delete(k);
      },
    },
  };
}

describe('V3 i bezpieczna migracja rzeczywistych zapisów', () => {
  it.each([activeV1, legalV1, blockedV2, recoveryV2])(
    'odczytuje dawną migawkę identycznie i zapisuje w V3 bez zmiany świata #%#',
    (raw) => {
      const old = readGameSave(raw);
      const migrated = readCurrentGameSave(raw);
      expect(old.ok).toBe(true);
      expect(migrated.ok).toBe(true);
      if (!old.ok || !migrated.ok) throw new Error();
      expect(migrated.value.session).toEqual(old.value.session);
      const next = serializeCurrentGameSave(
        createCurrentGameSave(migrated.value.session, date),
      );
      expect(next.ok).toBe(true);
      if (!next.ok) throw new Error();
      expect(readCurrentGameSave(next.value)).toEqual({
        ok: true,
        value: createCurrentGameSave(old.value.session, date),
      });
    },
  );
  it('nie zapisuje przy odczycie i nigdy nie usuwa ani nie nadpisuje bajtów V1/V2', () => {
    const { data, storage } = memory();
    data.set(SAVE_KEY, activeV1);
    data.set(GAME_SAVE_KEY, blockedV2);
    const loaded = loadCurrentGameState(storage);
    expect(data.has(CURRENT_GAME_SAVE_KEY)).toBe(false);
    expect(loaded.legacyRaw).toBe(activeV1);
    expect(loaded.previousRaw).toBe(blockedV2);
    expect(storeCurrentGameState(storage, initial(), date).ok).toBe(true);
    expect(data.get(SAVE_KEY)).toBe(activeV1);
    expect(data.get(GAME_SAVE_KEY)).toBe(blockedV2);
    expect(data.has(CURRENT_GAME_SAVE_KEY)).toBe(true);
  });
  it.each(['schemaVersion', 'engineVersion', 'contentVersion'])(
    'niezgodna wersja %s pozostawia oryginał do eksportu',
    (key) => {
      const { data, storage } = memory();
      const raw = JSON.stringify({ ...JSON.parse(blockedV2), [key]: 99 });
      data.set(GAME_SAVE_KEY, raw);
      const read = loadCurrentGameState(storage);
      expect(read.result.ok).toBe(false);
      expect(read.previousRaw).toBe(raw);
      expect(data.get(GAME_SAVE_KEY)).toBe(raw);
      expect(storeCurrentGameState(storage, initial(), date).ok).toBe(true);
      expect(data.get(GAME_SAVE_KEY)).toBe(raw);
    },
  );
  it('uszkodzony V3 nie powoduje cichego cofnięcia do V2', () => {
    const { data, storage } = memory();
    data.set(CURRENT_GAME_SAVE_KEY, '{bad');
    data.set(GAME_SAVE_KEY, blockedV2);
    expect(loadCurrentGameState(storage).result.ok).toBe(false);
    expect(data.get(CURRENT_GAME_SAVE_KEY)).toBe('{bad');
    expect(data.get(GAME_SAVE_KEY)).toBe(blockedV2);
  });
  it.each([0, 1, 2])(
    'zapis w %i turze odtwarzania zachowuje zadania, kopie, dokumenty i dalszy wynik',
    (offset) => {
      let g = apply(
        initial(),
        action('isolate-endpoint'),
        action('inspect-backups'),
        turn,
        action('verify-backup'),
        turn,
        turn,
        action('restore-documents'),
        action('examine-endpoint'),
      );
      for (let i = 0; i < offset; i++) g = apply(g, turn);
      const loaded = roundtrip(g);
      expect(loaded).toEqual(g);
      expect(currentOperation(loaded)!.simulation).toBe(
        loaded.campaign.incident,
      );
      expect(loaded.campaign.incident!.integrity!.documents).toEqual(
        g.campaign.incident!.integrity!.documents,
      );
      expect(
        loaded.campaign.incident!.tasks.some(
          (t) =>
            t.action.type === 'restore-documents' && t.status === 'running',
        ),
      ).toBe(true);
      expect(finish(loaded)).toEqual(finish(g));
      expect(roundtrip(finish(loaded))).toEqual(finish(g));
    },
  );
  it('nowe komendy są jawnie V3; nie poszerzają kontraktu dawnych V2', () => {
    expect(isCurrentCampaignCommand({ type: 'start-integrity-incident' })).toBe(
      true,
    );
    expect(isCampaignCommand({ type: 'start-integrity-incident' })).toBe(false);
    expect(isCurrentCampaignCommand(action('isolate-endpoint'))).toBe(true);
    expect(isCampaignCommand(action('isolate-endpoint'))).toBe(false);
    expect(
      isCurrentRecordedCommand({
        type: 'schedule-task',
        workerId: 'administrator',
        action: {
          type: 'restore-documents',
          backupId: 'FS-1350',
          instant: true,
        },
      }),
    ).toBe(false);
  });
  it.each([
    { type: 'restore-documents' },
    { type: 'restore-documents', backupId: ['FS-1350'] },
    { type: 'isolate-endpoint', endpointId: null },
    { type: 'isolate-endpoint', endpointId: '' },
    {
      type: 'reconnect-endpoint',
      endpointId: 'pakowanie-03',
      compromised: false,
    },
    { type: 'inspect-backups', backupId: 'FS-1350' },
  ])('odrzuca niepoprawną nową operację #%#', (operation) => {
    expect(
      isCurrentRecordedCommand({
        type: 'schedule-task',
        workerId: 'administrator',
        action: operation,
      }),
    ).toBe(false);
  });
  it.each(['documents', 'endpoint', 'backups', 'threat', 'tasks', 'decisions'])(
    'pełne odtworzenie odrzuca podmienione %s',
    (field) => {
      const g = apply(
        initial(),
        action('isolate-endpoint'),
        action('inspect-backups'),
        turn,
        action('verify-backup'),
        turn,
        turn,
        action('restore-documents'),
      );
      const before = structuredClone(g);
      const fake = structuredClone(createCurrentGameSave(g, date));
      const s = (fake.session as StrategicSession).campaign.incident!;
      const mutated = JSON.parse(JSON.stringify(s));
      if (field === 'documents')
        mutated.integrity.documents[0].status = 'correct';
      if (field === 'endpoint') mutated.integrity.endpoint.isolated = false;
      if (field === 'backups')
        mutated.integrity.backups[1].verifiedAtMinute = 1;
      if (field === 'threat')
        mutated.hidden.integrityThreat.compromised = false;
      if (field === 'tasks') mutated.tasks.at(-1).dueTurn = 3;
      if (field === 'decisions') mutated.integrity.decisions = [];
      const forgery = {
        ...fake,
        session: { ...g, campaign: { ...g.campaign, incident: mutated } },
      };
      expect(readCurrentGameSave(JSON.stringify(forgery)).ok).toBe(false);
      expect(sameJson(g, before)).toBe(true);
    },
  );
  it('nie akceptuje zmiany samej koperty V3 na V2', () => {
    const g = initial();
    const fake = {
      ...createCurrentGameSave(g, date),
      schemaVersion: 2,
      engineVersion: '7.0.0',
      contentVersion: 'nexus-strategy-1',
    };
    expect(readGameSave(JSON.stringify(fake)).ok).toBe(false);
  });
  it.each([
    { schemaVersion: 3, engineVersion: 'unknown' },
    { schemaVersion: 3, savedAt: 'tomorrow' },
    { schemaVersion: 3, contentVersion: 'unknown' },
    { schemaVersion: 4 },
    { schemaVersion: 3, extra: true },
  ])('odrzuca niezgodną kopertę V3 #%#', (change) => {
    expect(
      readCurrentGameSave(
        JSON.stringify({
          ...createCurrentGameSave(initial(), date),
          ...change,
        }),
      ).ok,
    ).toBe(false);
  });
  it('egzekwuje limity rozmiaru, liczby komend i niebezpiecznych kluczy', () => {
    expect(readCurrentGameSave(' '.repeat(8 * 1024 * 1024 + 1)).ok).toBe(false);
    const g = initial();
    expect(
      readCurrentGameSave(
        JSON.stringify(
          createCurrentGameSave(
            { ...g, commands: Array.from({ length: 10001 }, () => hour) },
            date,
          ),
        ),
      ).ok,
    ).toBe(false);
    const text = JSON.stringify(createCurrentGameSave(g, date));
    expect(
      readCurrentGameSave(
        text.replace(
          '"schemaVersion":3',
          '"schemaVersion":3,"__proto__":{"polluted":true}',
        ),
      ).ok,
    ).toBe(false);
    expect(Object.hasOwn({}, 'polluted')).toBe(false);
  });
  it('odmowa pamięci lub quota pozwala zachować i wyeksportować grę w pamięci', () => {
    const storage = {
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
    const g = initial();
    expect(loadCurrentGameState(storage).result.ok).toBe(false);
    expect(storeCurrentGameState(storage, g, date).ok).toBe(false);
    expect(roundtrip(g)).toEqual(g);
  });
});
