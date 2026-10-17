import { describe, it, expect } from 'vitest';
import activeV1 from './fixtures/sprint6-active-v1.json?raw';
import legalV1 from './fixtures/sprint6-legal-v1.json?raw';
import blockedV2 from './fixtures/sprint7-blocked-v2.json?raw';
import recoveryV2 from './fixtures/sprint7-recovery-v2.json?raw';
import headquartersV3 from './fixtures/sprint8-headquarters-v3.json?raw';
import pendingV3 from './fixtures/sprint8-restore-pending-v3.json?raw';
import {
  createCurrentGameSave,
  readCurrentGameSave,
  serializeCurrentGameSave,
  isCurrentCampaignCommand,
  isCurrentRecordedCommand,
  CURRENT_GAME_SAVE_KEY,
} from './gameSaveV4';
import {
  readCurrentGameSave as readV3,
  isCurrentCampaignCommand as isV3Command,
  CURRENT_GAME_SAVE_KEY as V3_KEY,
} from './gameSaveV3';
import { SAVE_KEY } from './localStorage';
import { GAME_SAVE_KEY } from './gameSave';
import {
  loadCurrentGameState,
  storeCurrentGameState,
} from './resilienceGameStorage';
import {
  applyCampaignSession,
  createStrategicSession,
} from '../application/gameSession';
import type { StrategicSession } from '../application/gameSession';
import type { CampaignCommand } from '../domain/campaign';
import { sameJson } from './saveFormat';
import { hour, turn, fund, hq } from '../testSupport/resilience';
const date = '2026-10-17T12:00:00.000Z';
const apply = (s: StrategicSession, ...cs: CampaignCommand[]) =>
  cs.reduce((s, c) => applyCampaignSession(s, c, date), s);
function finish(s: StrategicSession) {
  while (s.campaign.phase === 'incident') s = apply(s, turn);
  return s;
}
function prepare(s: StrategicSession) {
  while (s.campaign.preparation.hour < 4) s = apply(s, hour);
  return s;
}
function funded() {
  let s = apply(
    finish(
      apply(prepare(createStrategicSession('resilience-v4', date)), {
        type: 'start-incident',
      }),
    ),
    hq,
  );
  s = apply(
    finish(apply(prepare(s), { type: 'start-integrity-incident' })),
    hq,
    fund,
  );
  return s;
}
function roundtrip(s: StrategicSession) {
  const encoded = serializeCurrentGameSave(createCurrentGameSave(s, date));
  if (!encoded.ok) throw new Error(encoded.error);
  const parsed = readCurrentGameSave(encoded.value);
  if (!parsed.ok || parsed.value.session.kind !== 'campaign')
    throw new Error('Roundtrip failed');
  return parsed.value.session;
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
describe('FortressSaveV4: dokładny replay V1–V4 i niezależne klucze', () => {
  it.each([
    ['V1 active', activeV1],
    ['V1 legal', legalV1],
    ['V2 blocked', blockedV2],
    ['V2 recovery', recoveryV2],
    ['V3 headquarters', headquartersV3],
    ['V3 restore pending', pendingV3],
  ])(
    'migruje rzeczywisty historyczny eksport %s bez zmiany świata',
    (_name, text) => {
      const old = readV3(text);
      const next = readCurrentGameSave(text);
      expect(old.ok).toBe(true);
      expect(next.ok).toBe(true);
      if (!old.ok || !next.ok) return;
      expect(sameJson(next.value.session, old.value.session)).toBe(true);
      if (JSON.parse(text).schemaVersion === 3)
        expect(sameJson(next.value.session, JSON.parse(text).session)).toBe(
          true,
        );
      if (next.value.session.kind === 'campaign') {
        expect(next.value.session.campaign.funding).toBeUndefined();
        expect(next.value.session.campaign.projects).toHaveLength(3);
      }
    },
  );
  it('nowe komendy są dozwolone tylko w nowym kontrakcie', () => {
    expect(isCurrentCampaignCommand(fund)).toBe(true);
    expect(isV3Command(fund)).toBe(false);
    for (const type of ['plan-project', 'reserve-project', 'cancel-project'])
      for (const projectId of ['endpoint-edr', 'backup-resilience']) {
        expect(isCurrentCampaignCommand({ type, projectId })).toBe(true);
        expect(isV3Command({ type, projectId })).toBe(false);
      }
    expect(
      isCurrentRecordedCommand({
        type: 'schedule-task',
        workerId: 'analyst',
        action: { type: 'inspect-edr-telemetry' },
      }),
    ).toBe(true);
  });
  it.each([
    { type: 'accept-resilience-funding', amount: 25000 },
    { type: ['reserve-project'], projectId: 'endpoint-edr' },
    { type: 'assign-work', projectId: 'endpoint-edr', workerId: 'outsider' },
    { type: 'reserve-project', projectId: 'board-resilience-ii' },
    { type: 'reserve-project', projectId: 'endpoint-edr', extra: 1 },
    {
      type: 'incident-command',
      command: {
        type: 'schedule-task',
        workerId: 'administrator',
        action: { type: 'inspect-edr-telemetry' },
      },
    },
    {
      type: 'incident-command',
      command: {
        type: 'schedule-task',
        workerId: 'analyst',
        action: { type: 'inspect-edr-telemetry', endpointId: 'pakowanie-03' },
      },
    },
  ])('odrzuca niepoprawną komendę %j', (value) =>
    expect(isCurrentCampaignCommand(value)).toBe(false),
  );
  it('ponowny import i odrzucenie drugiej alokacji nie zwiększają salda', () => {
    const first = roundtrip(funded());
    const second = roundtrip(apply(first, fund));
    expect(second.campaign.budget.total).toBe(105000);
    expect(second.campaign.funding?.allocations).toHaveLength(1);
    expect(second.campaign.decisions.at(-1)?.result).toBe('rejected');
    expect(roundtrip(second)).toEqual(second);
  });
  it('zapis aktywnego wdrożenia zachowuje pozostałe godziny, rezerwacje i pojedynczą płatność', () => {
    let s = funded();
    s = apply(
      s,
      { type: 'plan-project', projectId: 'endpoint-edr' },
      { type: 'reserve-project', projectId: 'endpoint-edr' },
      {
        type: 'assign-work',
        projectId: 'endpoint-edr',
        workerId: 'administrator',
      },
      hour,
    );
    expect(roundtrip(s)).toEqual(s);
    const next = apply(
      roundtrip(s),
      { type: 'assign-work', projectId: 'endpoint-edr', workerId: 'analyst' },
      hour,
      hour,
    );
    expect(next.campaign.posture.endpointCoverage?.endpointId).toBe(
      'pakowanie-03',
    );
    expect(roundtrip(next)).toEqual(next);
  });
  it('wczytanie w trakcie M02 i badania EDR zachowuje identyczny dalszy przebieg', () => {
    let s = funded();
    s = apply(
      s,
      { type: 'plan-project', projectId: 'endpoint-edr' },
      { type: 'reserve-project', projectId: 'endpoint-edr' },
      {
        type: 'assign-work',
        projectId: 'endpoint-edr',
        workerId: 'administrator',
      },
      { type: 'assign-work', projectId: 'endpoint-edr', workerId: 'analyst' },
      hour,
      hour,
    );
    s = apply(
      prepare(s),
      { type: 'start-integrity-incident' },
      {
        type: 'incident-command',
        command: {
          type: 'schedule-task',
          workerId: 'analyst',
          action: { type: 'inspect-edr-telemetry' },
        },
      },
    );
    expect(roundtrip(s)).toEqual(s);
    expect(finish(roundtrip(s))).toEqual(finish(s));
  });
  it.each([
    'total',
    'allocation',
    'duplicate',
    'projects',
    'work',
    'catalog',
    'funding-command',
  ] as const)('odrzuca podmianę %s', (kind) => {
    const save = JSON.parse(
      JSON.stringify(createCurrentGameSave(funded(), date)),
    );
    const c = save.session.campaign;
    if (kind === 'total') c.budget.total += 25000;
    if (kind === 'allocation') c.funding.allocations[0].amount = 50000;
    if (kind === 'duplicate')
      c.funding.allocations.push(c.funding.allocations[0]);
    if (kind === 'projects') c.projects[3].status = 'completed';
    if (kind === 'work') c.projects[4].remaining.administrator = 0;
    if (kind === 'catalog') c.projects.pop();
    if (kind === 'funding-command')
      save.session.commands = save.session.commands.filter(
        (v: CampaignCommand) => v.type !== 'accept-resilience-funding',
      );
    expect(readCurrentGameSave(JSON.stringify(save)).ok).toBe(false);
  });
  it('odczyt V3 nie zapisuje automatycznie; zapis V4 zostawia trzy oryginały bajt w bajt', () => {
    const m = memory();
    m.data.set(SAVE_KEY, activeV1);
    m.data.set(GAME_SAVE_KEY, blockedV2);
    m.data.set(V3_KEY, pendingV3);
    const boot = loadCurrentGameState(m.storage);
    expect(boot.result.ok).toBe(true);
    expect(m.data.has(CURRENT_GAME_SAVE_KEY)).toBe(false);
    expect(boot.thirdRaw).toBe(pendingV3);
    expect(boot.previousRaw).toBe(blockedV2);
    expect(boot.legacyRaw).toBe(activeV1);
    expect(storeCurrentGameState(m.storage, funded(), date).ok).toBe(true);
    expect(m.data.get(SAVE_KEY)).toBe(activeV1);
    expect(m.data.get(GAME_SAVE_KEY)).toBe(blockedV2);
    expect(m.data.get(V3_KEY)).toBe(pendingV3);
    const restarted = loadCurrentGameState(m.storage);
    expect(
      restarted.result.ok &&
        restarted.result.value?.kind === 'campaign' &&
        restarted.result.value.campaign.budget.total,
    ).toBe(105000);
  });
  it('uszkodzony V4 nie powoduje cichego cofnięcia do starszej kampanii', () => {
    const m = memory();
    m.data.set(V3_KEY, headquartersV3);
    m.data.set(CURRENT_GAME_SAVE_KEY, '{}');
    expect(loadCurrentGameState(m.storage).result.ok).toBe(false);
    expect(m.data.get(V3_KEY)).toBe(headquartersV3);
  });
  it('brak localStorage lub quota nie niszczy gry i zgłasza błąd', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadCurrentGameState(storage).result.ok).toBe(false);
    expect(storeCurrentGameState(storage, funded(), date).ok).toBe(false);
  });
});

it('V4 odtwarza testowaną kopię i oba projekty również w aktywnym restore', () => {
  let s = funded();
  for (const projectId of ['endpoint-edr', 'backup-resilience'] as const)
    s = apply(
      s,
      { type: 'plan-project', projectId },
      { type: 'reserve-project', projectId },
    );
  for (const workerId of ['administrator', 'analyst'] as const)
    s = apply(s, { type: 'assign-work', projectId: 'endpoint-edr', workerId });
  s = apply(s, hour, hour);
  for (const workerId of ['administrator', 'analyst'] as const)
    s = apply(s, {
      type: 'assign-work',
      projectId: 'backup-resilience',
      workerId,
    });
  s = apply(s, hour, hour);
  expect(roundtrip(s)).toEqual(s);
  s = apply(
    finish(apply(s, { type: 'start-integrity-incident' })),
    hq,
    {
      type: 'assign-work',
      projectId: 'backup-resilience',
      workerId: 'administrator',
    },
    hour,
  );
  expect(s.campaign.posture.backupReadiness?.restoreTestPassed).toBe(true);
  s = apply(
    prepare(s),
    { type: 'start-integrity-incident' },
    {
      type: 'incident-command',
      command: {
        type: 'schedule-task',
        workerId: 'analyst',
        action: { type: 'inspect-backups' },
      },
    },
    turn,
    {
      type: 'incident-command',
      command: {
        type: 'schedule-task',
        workerId: 'administrator',
        action: { type: 'restore-documents', backupId: 'FS-1350' },
      },
    },
    turn,
  );
  expect(s.campaign.incident?.tasks.at(-1)?.status).toBe('running');
  expect(roundtrip(s)).toEqual(s);
  expect(finish(roundtrip(s))).toEqual(finish(s));
  const invalid = JSON.parse(JSON.stringify(createCurrentGameSave(s, date)));
  invalid.session.campaign.posture.backupReadiness.testedRestoreTurns = 1;
  expect(readCurrentGameSave(JSON.stringify(invalid)).ok).toBe(false);
});
