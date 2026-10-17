import { describe, expect, it } from 'vitest';
import { campaignReducer, createCampaign } from './campaignReducer';
import type { CampaignCommand, CampaignState } from '../domain/campaign';
import { selectScenario, createScenarioRun } from './scenarioSelectors';
import { selectStrategyView } from './selectStrategyView';
import { simulationReducer } from './simulationReducer';
import { scenarioCatalog } from '../content/scenarios';
const step = (s: CampaignState, ...cs: CampaignCommand[]) =>
  cs.reduce(campaignReducer, s);
const hour: CampaignCommand = { type: 'advance-preparation' };
const turn: CampaignCommand = {
  type: 'incident-command',
  command: { type: 'advance-turn' },
};
const prepare = (s: CampaignState) => step(s, hour, hour, hour, hour);
function finish(s: CampaignState) {
  while (s.phase === 'incident') s = step(s, turn);
  return s;
}
function headquarters() {
  return step(
    finish(step(prepare(createCampaign()), { type: 'start-incident' })),
    { type: 'return-headquarters' },
  );
}

describe('rodziny misji i trwała kampania', () => {
  it('nie dokłada nowej rodziny do historycznego katalogu i mapowania seedów', () => {
    expect(scenarioCatalog.map((d) => d.id)).toEqual([
      'nexus-reference',
      'nexus-legitimate',
      'nexus-stolen-credential',
    ]);
    for (const seed of [
      0,
      1,
      2,
      3,
      4,
      5,
      13,
      100,
      1001,
      Number.MAX_SAFE_INTEGER - 1,
    ]) {
      expect(selectScenario('unknown', seed)).toBe(scenarioCatalog[seed % 3]);
      expect(createScenarioRun('unknown', seed).integrity).toBeUndefined();
    }
  });
  it.each([0, 1, 2])(
    'stary wariant %i zachowuje dokładny wynik bez nowych komend',
    (seed) => {
      let s = createScenarioRun('unknown', seed);
      for (let t = 0; t < 18; t++)
        s = simulationReducer(s, { type: 'advance-turn' });
      expect(s.business).toMatchObject({
        totalReceived: 360,
        totalProcessed: 360,
        backlog: 0,
      });
      expect(s.hidden.attacker?.transfer.exposedRecords ?? 0).toBe(
        seed === 1 ? 0 : 2000,
      );
      expect(Object.hasOwn(s, 'integrity')).toBe(false);
      expect(Object.hasOwn(s.hidden, 'integrityThreat')).toBe(false);
    },
  );
  it('blokuje nową misję przed pierwszym incydentem i przed końcem przygotowania', () => {
    const locked = step(prepare(createCampaign()), {
      type: 'start-integrity-incident',
    });
    expect(locked.incident).toBeNull();
    expect(locked.decisions.at(-1)?.result).toBe('rejected');
    const early = step(headquarters(), { type: 'start-integrity-incident' });
    expect(early.incident).toBeNull();
  });
  it('odblokowuje Misję 02 już po jednym incydencie, ze świeżą wiedzą i licznikiem', () => {
    const hq = headquarters();
    const s = step(prepare(hq), { type: 'start-integrity-incident' });
    expect(s.phase).toBe('incident');
    expect(s.incident!.hidden.scenario.id).toBe('nexus-last-clean-copy');
    expect(s.incident!.incident.alerts).toEqual([]);
    expect(s.incident!.knowledge.authObservations).toEqual([]);
    expect(s.incident!.integrity!.observations).toEqual([]);
    expect(s.incident!.business.totalReceived).toBe(0);
    expect(s.incident!.hidden.attacker).toBeNull();
    expect(s.budget).toEqual(hq.budget);
    expect(s.history).toEqual(hq.history);
  });
  it('przenosi projekty, konta i reguły na nową rodzinę bez magicznego rozszerzania VPN', () => {
    let s = createCampaign();
    s = step(
      s,
      { type: 'plan-project', projectId: 'remote-access' },
      { type: 'reserve-project', projectId: 'remote-access' },
      {
        type: 'assign-work',
        projectId: 'remote-access',
        workerId: 'administrator',
      },
    );
    s = step(
      prepare(s),
      { type: 'start-incident' },
      {
        type: 'incident-command',
        command: {
          type: 'schedule-task',
          workerId: 'administrator',
          action: { type: 'block-account', accountId: 'magazyn-07' },
        },
      },
      turn,
      {
        type: 'incident-command',
        command: {
          type: 'schedule-task',
          workerId: 'administrator',
          action: { type: 'set-network-rule', ruleId: 'R-SMB', action: 'deny' },
        },
      },
      turn,
      turn,
    );
    const hq = step(finish(s), { type: 'return-headquarters' });
    s = step(prepare(hq), { type: 'start-integrity-incident' });
    expect(s.projects).toEqual(hq.projects);
    expect(s.budget).toEqual(hq.budget);
    expect(
      s.incident!.access.accounts.find((a) => a.id === 'magazyn-07'),
    ).toMatchObject({ loginStatus: 'blocked', mfaPolicy: 'required' });
    expect(s.incident!.access.rules.find((r) => r.id === 'R-SMB')?.action).toBe(
      'deny',
    );
    s = step(s, turn, turn);
    expect(
      s.incident!.integrity!.documents.filter((d) => d.status === 'damaged'),
    ).toHaveLength(32);
  });
  it('utrwala izolację hosta i nie przedstawia jej jako oczyszczenia kompromitacji', () => {
    let s = step(
      prepare(headquarters()),
      { type: 'start-integrity-incident' },
      {
        type: 'incident-command',
        command: {
          type: 'schedule-task',
          workerId: 'administrator',
          action: { type: 'isolate-endpoint', endpointId: 'pakowanie-03' },
        },
      },
      turn,
    );
    s = step(finish(s), { type: 'return-headquarters' });
    expect(s.posture.endpointOverrides?.['pakowanie-03']).toEqual({
      isolated: true,
      writesRestricted: false,
    });
    const oldFamily = step(prepare(s), { type: 'start-incident' });
    expect(oldFamily.incident!.integrity).toBeUndefined();
    const next = step(prepare(s), { type: 'start-integrity-incident' });
    expect(next.incident!.integrity!.endpoint.isolated).toBe(true);
    expect(next.incident!.hidden.integrityThreat!.compromised).toBe(true);
    expect(
      next.incident!.integrity!.documents.every((d) => d.status === 'correct'),
    ).toBe(true);
    expect(selectStrategyView(s).history.at(-1)?.integrity).toMatchObject({
      damaged: 12,
      endpointIsolated: true,
    });
  });
});
