import { describe, it, expect } from 'vitest';
import { createCampaign, campaignReducer } from '../campaignReducer';
import { createScenarioRun } from '../scenarioSelectors';
import {
  createIntegrityIncident,
  createRecoveryIncident,
  createVendorIncident,
  createBranchIncident,
  createFinaleIncident,
} from '../prepareCampaignIncident';
import { simulationReducer } from '../simulationReducer';
import { selectPlayerView } from '../selectPlayerView';
import { selectGameplayExperience, businessContributions } from './cockpit';
import {
  selectCampaignCommand,
  preparationPreview,
  preparationTeam,
} from './campaignExperience';
import { selectRecordedCampaignHistory, reportResult } from './campaignHistory';
import { taskRejection, taskSpecs } from '../../simulation/tasks';
import { createAfterActionReport } from '../createAfterActionReport';
import { currentOperation } from '../gameSession';
import type { StrategicSession } from '../gameSession';
import type { SimulationState, TaskAction } from '../../domain/simulation';
import { defaultBranchArchitecture } from '../../content/scenarios/branch';
import { pilotEndpointCoverage } from '../../content/endpointCoverage';
import {
  finaleHeadquarters,
  startFinale,
  playFinale,
} from '../../testSupport/finale';
import {
  campaign,
  prepare,
  finish,
  reportDate,
  sessionDate,
  order,
} from '../../testSupport/aar';
import { createStrategicSession } from '../gameSession';
import {
  readCurrentGameSave,
  createCurrentGameSave,
} from '../../persistence/gameSaveV9';
const posture = createCampaign().posture;
const architecture = {
  ...defaultBranchArchitecture,
  erpEnabled: true,
  smbScope: 'documents' as const,
  backupPrepared: true,
  monitoring: true,
};
const finale = (seed = 0) =>
  createFinaleIncident(seed, posture, 'nexus-campaign-finale-v1', architecture);
const advance = (s: SimulationState, n = 1) => {
  for (let i = 0; i < n; i++)
    s = simulationReducer(s, { type: 'advance-turn' });
  return s;
};
const schedule = (s: SimulationState, action: TaskAction) =>
  simulationReducer(s, {
    type: 'schedule-task',
    workerId: taskSpecs[action.type].workerId,
    action,
  });
describe('presentation only campaign command and preparation', () => {
  it('shows six missions and preserves unlock and mandatory four-hour gates', () => {
    const s = createCampaign();
    expect(selectCampaignCommand(s).map((m) => m.status)).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
      'locked',
      'locked',
    ]);
    for (const m of selectCampaignCommand(s)) {
      expect(m.reason).toBeTruthy();
      expect(campaignReducer(s, m.command).phase).toBe('preparation');
    }
    const ready = prepare(createStrategicSession('ux', sessionDate)).campaign;
    for (const m of selectCampaignCommand(ready))
      expect(campaignReducer(ready, m.command).phase).toBe(
        m.reason ? 'preparation' : 'incident',
      );
  });
  it('counts actual attempts with finale priority over its component domains', () => {
    const g = finish(startFinale(1)) as StrategicSession;
    const rows = selectCampaignCommand(g.campaign);
    expect(rows.map((r) => r.attempts)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(rows.every((r) => r.status === 'completed')).toBe(true);
    expect(rows.every((r) => r.reason !== null)).toBe(true);
  });
  it('uses the real reducer for preparation validation and payment without writing a command', () => {
    let s = createCampaign();
    s = campaignReducer(s, {
      type: 'plan-project',
      projectId: 'remote-access',
    });
    s = campaignReducer(s, {
      type: 'reserve-project',
      projectId: 'remote-access',
    });
    const before = JSON.stringify(s);
    expect(
      preparationPreview(s, {
        type: 'assign-work',
        projectId: 'remote-access',
        workerId: 'administrator',
      }),
    ).toMatchObject({
      worker: 'administrator',
      hours: 4,
      payment: 20000,
      reservation: 0,
      inWindow: true,
      reason: null,
    });
    expect(JSON.stringify(s)).toBe(before);
    s = campaignReducer(s, {
      type: 'assign-work',
      projectId: 'remote-access',
      workerId: 'administrator',
    });
    expect(
      preparationPreview(s, {
        type: 'assign-work',
        projectId: 'remote-access',
        workerId: 'administrator',
      }).reason,
    ).toBeTruthy();
  });
  it('shows shared branch/vendor/detection/project workers and true carry-over', () => {
    let g = finaleHeadquarters(1);
    g = campaign(g, {
      type: 'prepare-branch-architecture',
      change: { component: 'backup', enabled: false },
    });
    expect(preparationTeam(g.campaign)[0]).toMatchObject({
      worker: 'administrator',
      name: 'EAST / backup',
      hours: 2,
      finishesNext: false,
    });
    const before = JSON.stringify(g);
    preparationPreview(g.campaign, {
      type: 'prepare-vendor-exception',
      scope: 'api-only',
      expiresAtMinute: 930,
    });
    expect(JSON.stringify(g)).toBe(before);
    let s = createCampaign();
    s = campaignReducer(s, {
      type: 'plan-project',
      projectId: 'remote-access',
    });
    s = campaignReducer(s, {
      type: 'reserve-project',
      projectId: 'remote-access',
    });
    s = campaignReducer(s, { type: 'advance-preparation' });
    s = campaignReducer(s, {
      type: 'assign-work',
      projectId: 'remote-access',
      workerId: 'administrator',
    });
    expect(preparationTeam(s)[0]!.continues).toBe(true);
  });
});
describe('decision actions and player knowledge', () => {
  it.each([
    createScenarioRun('training', 0),
    createIntegrityIncident(0, posture),
    finale(2),
  ])(
    'retains exact engine rejection codes and durations for all supported action choices',
    (s) => {
      const e = selectGameplayExperience(s);
      for (const a of e.actions) {
        expect(a.rejection).toBe(taskRejection(s, a.workerId, a.action));
        expect(a.turns).toBeGreaterThan(0);
        expect(a.reason === null).toBe(a.rejection === null);
      }
    },
  );
  it('explains worker busy, missing session, copy verification and backup route using public facts', () => {
    let s = schedule(finale(), { type: 'restart-erp-service' });
    let e = selectGameplayExperience(s);
    expect(
      e.actions.find((a) => a.action.type === 'activate-branch-route')!.reason,
    ).toContain('14:10');
    expect(
      selectGameplayExperience(finale()).actions.find(
        (a) => a.action.type === 'terminate-session',
      )!.reason,
    ).toContain('Nie zidentyfikowano');
    s = createBranchIncident(
      0,
      posture,
      'nexus-east-branch-v1',
      defaultBranchArchitecture,
    );
    expect(
      selectGameplayExperience(s).actions.find(
        (a) =>
          a.action.type === 'activate-branch-route' &&
          a.action.route === 'backup',
      )!.reason,
    ).toContain('Nie przygotowano');
    s = advance(
      schedule(createIntegrityIncident(0, posture), {
        type: 'inspect-backups',
      }),
    );
    expect(
      selectGameplayExperience(s).actions.find(
        (a) =>
          a.action.type === 'restore-documents' &&
          a.action.backupId === 'FS-1350',
      )!.reason,
    ).toContain('czystej kopii');
    expect(
      selectGameplayExperience(s).actions.find(
        (a) => a.action.type === 'restrict-endpoint-writes',
      )!.reason,
    ).toContain('odizoluj');
    s = advance(
      schedule(s, { type: 'isolate-endpoint', endpointId: 'pakowanie-03' }),
    );
    expect(
      selectGameplayExperience(s).actions.find(
        (a) => a.action.type === 'restrict-endpoint-writes',
      )!.reason,
    ).toContain('dziennik');
  });
  it('does not expose variant, attacker truth or undelivered events through the new cockpit', () => {
    const initial = [0, 1, 2].map((seed) => {
      const e = selectGameplayExperience(finale(seed));
      return {
        actions: e.actions,
        signals: e.signals,
        business: e.business,
        lastTurn: e.lastTurn,
      };
    });
    expect(initial[0]).toEqual(initial[1]);
    expect(initial[1]).toEqual(initial[2]);
    const s = advance(finale(2), 3),
      e = selectGameplayExperience(s);
    expect(
      e.player.world.assets.find((a) => a.id === 'erp-storage')!.status,
    ).toBe('unknown');
    expect(
      e.player.world.assets.find((a) => a.id === 'east-primary-link')!.status,
    ).toBe('unknown');
    expect(
      JSON.stringify({
        signals: e.signals,
        feedback: e.feedback,
        lastTurn: e.lastTurn,
      }),
    ).not.toMatch(/storage-outage|cascade|przejęt|Awaria primary storage/);
  });
  it('new EDR notices appear only after delivery, without classifying a legal operation as an attack', () => {
    let s = createFinaleIncident(
      1,
      { ...posture, endpointCoverage: pilotEndpointCoverage },
      'nexus-campaign-finale-v1',
      architecture,
    );
    s = advance(s, 2);
    expect(
      selectGameplayExperience(s).signals.some((r) => r.source === 'Alert EDR'),
    ).toBe(false);
    s = advance(s);
    const rows = selectGameplayExperience(s).signals.filter(
      (r) => r.source === 'Alert EDR',
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.text).toContain('nie potwierdza ataku');
  });
  it('reports failed ERP jobs and observes completion at the actual boundary', () => {
    let s = advance(finale(2), 3);
    s = schedule(s, { type: 'restart-erp-service' });
    expect(selectGameplayExperience(s).feedback).toEqual([]);
    s = advance(s);
    expect(selectGameplayExperience(s).feedback).toEqual([]);
    s = advance(s);
    const e = selectGameplayExperience(s);
    expect(e.feedback.at(-1)).toMatchObject({ status: 'failed', minute: 865 });
    expect(e.feedback.at(-1)!.text).toContain('storage');
    expect(e.lastTurn!.notices.some((n) => n.status === 'failed')).toBe(true);
  });
  it('retains completed research and a response in the conclusion, with only evidence known when ordered', () => {
    let s = createScenarioRun('training', 0);
    s = advance(schedule(s, { type: 'inspect-auth-logs' }));
    s = advance(
      schedule(s, { type: 'block-account', accountId: 'magazyn-07' }),
    );
    expect(selectGameplayExperience(s).decisions).toEqual([]);
    s = advance(s, 16);
    const before = JSON.stringify(s),
      decisions = selectGameplayExperience(s).decisions;
    expect(decisions.map((d) => d.task.action.type)).toEqual([
      'inspect-auth-logs',
      'block-account',
    ]);
    expect(
      decisions[0]!.known.some((o) => o.source === 'Uwierzytelnienia'),
    ).toBe(false);
    expect(
      decisions[1]!.known.some((o) => o.source === 'Uwierzytelnienia'),
    ).toBe(true);
    expect(
      decisions.every((d) =>
        d.known.every((o) => o.obtained <= d.orderedAtMinute),
      ),
    ).toBe(true);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('summarizes the actual settled interval and backlog delta, not the new boundary configuration', () => {
    let s = createScenarioRun('training', 0);
    s = schedule(s, { type: 'set-vpn', assetId: 'vpn', enabled: false });
    s = advance(s);
    const e = selectGameplayExperience(s);
    expect(e.lastTurn).toMatchObject({
      received: s.business.lastReport!.received,
      processed: s.business.lastReport!.processed,
      backlogChange: s.business.backlog,
    });
    s = advance(s);
    const x = selectGameplayExperience(s);
    expect(x.lastTurn!.backlogChange).toBe(
      s.business.lastReport!.received - s.business.lastReport!.processed,
    );
    expect(x.player.availability.capacity).toBe(
      s.business.lastReport!.capacity,
    );
  });
});
describe('business, real history and immutable journals', () => {
  const scenarios = [
    createScenarioRun('training', 0),
    createIntegrityIncident(0, posture),
    createVendorIncident(0, posture, 'nexus-vendor-access-v1', undefined),
    createRecoveryIncident(0, posture, 'nexus-erp-recovery-v1'),
    createBranchIncident(0, posture, 'nexus-east-branch-v1', architecture),
    finale(0),
    finale(1),
    finale(2),
  ];
  it.each(scenarios)(
    'process shares sum to the real ProcessAvailability in each family',
    (initial) => {
      let s = initial;
      for (let n = 0; n < 8; n++) {
        const v = selectPlayerView(s),
          rows = businessContributions(v);
        expect(rows.reduce((n, r) => n + r.current, 0)).toBe(
          v.availability.capacity,
        );
        expect(
          rows.every((r) => r.current >= 0 && r.current <= r.maximum),
        ).toBe(true);
        s = advance(s);
      }
    },
  );
  it('derives history details only from the actual journal, with the same goals as AAR', () => {
    const g = playFinale(startFinale(1), 1) as StrategicSession,
      before = JSON.stringify(g),
      rows = selectRecordedCampaignHistory(g);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.family)).toEqual([
      'M01',
      'M02',
      'M03',
      'M04',
      'M05',
      'M06',
    ]);
    const aar = createAfterActionReport(g, undefined, reportDate);
    expect(aar.ok).toBe(true);
    if (aar.ok)
      expect(rows.at(-1)!.detail!.result.met).toBe(
        aar.value.finalOutcome.allObjectivesMet,
      );
    expect(rows.at(-1)!.detail!.result).toEqual(
      reportResult(rows.at(-1)!.detail!.report),
    );
    expect(JSON.stringify(g)).toBe(before);
    const missing = selectRecordedCampaignHistory({ ...g, commands: [] });
    expect(missing.every((r) => r.detail === null)).toBe(true);
  });
  it('marks actual repeated families without alternative runs and never appends UI decisions', () => {
    let g = finish(startFinale(1)) as StrategicSession;
    g = campaign(g, { type: 'return-headquarters' });
    g = campaign(prepare(g), {
      type: 'start-finale-incident',
      familyId: 'nexus-campaign-finale-v1',
    });
    g = finish(g) as StrategicSession;
    const before = JSON.stringify(g);
    const rows = selectRecordedCampaignHistory(g);
    expect(rows.at(-1)!.repeat).toBe(true);
    expect(rows.filter((r) => r.family === 'M06')).toHaveLength(2);
    selectGameplayExperience(currentOperation(g)!.simulation);
    expect(JSON.stringify(g)).toBe(before);
    expect(
      readCurrentGameSave(JSON.stringify(createCurrentGameSave(g, reportDate)))
        .ok,
    ).toBe(true);
  });
  it('a queued task uses the original command journal with no presentation fields in persistence', () => {
    let g = startFinale();
    g = order(g, { type: 'inspect-erp-service' }) as StrategicSession;
    const before = JSON.stringify(g);
    const view = selectGameplayExperience(currentOperation(g)!.simulation);
    expect(view.actions.some((a) => a.rejection === 'worker-busy')).toBe(true);
    expect(JSON.stringify(g)).toBe(before);
    expect(g.commands.at(-1)).toEqual({
      type: 'incident-command',
      command: {
        type: 'schedule-task',
        workerId: 'analyst',
        action: { type: 'inspect-erp-service' },
      },
    });
    expect(
      readCurrentGameSave(JSON.stringify(createCurrentGameSave(g, reportDate)))
        .ok,
    ).toBe(true);
  });
});
