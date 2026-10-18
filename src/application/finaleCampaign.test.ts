import { describe, expect, it } from 'vitest';
import {
  branchHeadquarters,
  prepareBranch,
  startBranch,
} from '../testSupport/branch';
import {
  finaleHeadquarters,
  startFinale,
  playFinale,
} from '../testSupport/finale';
import {
  campaign,
  prepare,
  finish,
  advance,
  command,
  job,
  reportDate,
  sessionDate,
  simulation,
} from '../testSupport/aar';
import type { StrategicSession } from './gameSession';
import { createStrategicSession } from './gameSession';
import { createAfterActionReport } from './createAfterActionReport';
import { renderAfterActionMarkdown } from './afterActionMarkdown';
import { validateAfterActionReport } from './validateAfterActionReport';
import {
  createCurrentGameSave,
  readCurrentGameSave,
  isCurrentCampaignCommand,
  isCurrentRecordedCommand,
  CURRENT_GAME_SAVE_KEY as V9,
} from '../persistence/gameSaveV9';
import {
  createCurrentGameSave as createV8,
  readCurrentGameSave as readV8,
  CURRENT_GAME_SAVE_KEY as V8,
} from '../persistence/gameSaveV8';
import {
  loadCurrentGameState,
  storeCurrentGameState,
} from '../persistence/resilienceGameStorage';
import { selectPlayerView } from './selectPlayerView';
import { selectFinaleReport } from './selectFinaleReport';
import { sameJson } from '../persistence/saveFormat';
describe('M06 campaign, replay and one after action review', () => {
  it('unlocks after completed M05 including failure, never before, without additional funding', () => {
    const locked = campaign(
      prepare(createStrategicSession('locked', sessionDate)),
      { type: 'start-finale-incident', familyId: 'nexus-campaign-finale-v1' },
    );
    expect(locked.campaign.phase).toBe('preparation');
    const hq = campaign(
      finish(
        startBranch(prepareBranch(branchHeadquarters(1), 'none')),
      ) as StrategicSession,
      { type: 'return-headquarters' },
    );
    expect(hq.campaign.history.at(-1)!.branch!.goalMet).toBe(false);
    const total = hq.campaign.budget.total;
    const g = campaign(prepare(hq), {
      type: 'start-finale-incident',
      familyId: 'nexus-campaign-finale-v1',
    });
    expect(g.campaign.incident!.finale).toBeTruthy();
    expect(g.campaign.budget.total).toBe(total);
    expect(g.campaign.projects).toEqual(hq.campaign.projects);
  });
  it.each([0, 1, 2])(
    'plays a complete successful variant %i and validates one M06 AAR with decisions/known truth',
    (variant) => {
      const g = playFinale(startFinale(variant), variant) as StrategicSession;
      expect(selectFinaleReport(g.campaign.incident!)!.goalMet).toBe(true);
      expect(g.campaign.chapterOneCompleted).toBe(true);
      expect(g.campaign.history.at(-1)!.finale!.goalMet).toBe(true);
      const aar = createAfterActionReport(g, undefined, reportDate);
      expect(aar.ok, aar.ok ? '' : JSON.stringify(aar)).toBe(true);
      if (!aar.ok) return;
      expect(aar.value.scenario.family).toBe('M06');
      expect(aar.value.finalOutcome.allObjectivesMet).toBe(true);
      expect(validateAfterActionReport(aar.value).ok).toBe(true);
      expect(renderAfterActionMarkdown(aar.value)).toContain(
        'CAMPAIGN DEBRIEF',
      );
      expect(
        aar.value.playerDecisions.every(
          (d) =>
            d.knownAtDecision.configuration.assets.find(
              (a) => a.id === 'erp-storage',
            )?.status !== 'offline' || d.knownAtDecision.evidenceIds.length > 0,
        ),
      ).toBe(true);
      expect(aar.value.groundTruth.finalState.campaignFinale).toBeTruthy();
      expect(
        readCurrentGameSave(
          JSON.stringify(createCurrentGameSave(g, reportDate)),
        ).ok,
      ).toBe(true);
    },
  );
  it('keeps prior attempts and permits retries after failure or success', () => {
    let g = finish(startFinale(1)) as StrategicSession;
    const history = g.campaign.history;
    g = campaign(g, { type: 'return-headquarters' });
    expect(g.campaign.chapterOneCompleted).toBe(true);
    g = campaign(prepare(g), {
      type: 'start-finale-incident',
      familyId: 'nexus-campaign-finale-v1',
    });
    expect(g.campaign.phase).toBe('incident');
    expect(g.campaign.history).toEqual(history);
    g = finish(g) as StrategicSession;
    expect(g.campaign.history.length).toBe(history.length + 1);
  });
  it('consumes only a fresh completed current-window exception and never reuses M03/M06 approval', () => {
    let g = startFinale(1);
    const used = g.campaign.vendorApprovals!.at(-1)!;
    expect(used.usedInWindow).toBe(g.campaign.preparation.number);
    expect(
      simulation(g).access.vendorAuthorization!.exception?.approvalId,
    ).toBe(used.id);
    g = campaign(finish(g) as StrategicSession, {
      type: 'return-headquarters',
    });
    g = campaign(prepare(g), {
      type: 'start-finale-incident',
      familyId: 'nexus-campaign-finale-v1',
    });
    expect(simulation(g).access.vendorAuthorization!.exception).toBeNull();
  });
  it('journals two pending jobs during ERP outage, isolated endpoint and FS restore, without changing replay', () => {
    let g = startFinale();
    g = job(g, {
      type: 'examine-endpoint',
      endpointId: 'pakowanie-03',
    }) as StrategicSession;
    g = command(g, {
      type: 'schedule-task',
      workerId: 'administrator',
      action: { type: 'isolate-endpoint', endpointId: 'pakowanie-03' },
    }) as StrategicSession;
    g = job(g, { type: 'inspect-backups' }) as StrategicSession;
    g = job(g, {
      type: 'verify-backup',
      backupId: 'FS-1350',
    }) as StrategicSession;
    g = command(g, {
      type: 'schedule-task',
      workerId: 'administrator',
      action: { type: 'restore-documents', backupId: 'FS-1350' },
    }) as StrategicSession;
    g = command(g, {
      type: 'schedule-task',
      workerId: 'analyst',
      action: { type: 'inspect-erp-database' },
    }) as StrategicSession;
    expect(simulation(g).recovery!.primary.processRunning).toBe(false);
    expect(simulation(g).integrity!.endpoint.isolated).toBe(true);
    expect(
      simulation(g).tasks.filter((t) => t.status === 'running'),
    ).toHaveLength(2);
    const raw = JSON.stringify(createCurrentGameSave(g, reportDate)),
      load = readCurrentGameSave(raw);
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    expect(sameJson(load.value.session, g)).toBe(true);
    expect(sameJson(finish(load.value.session), finish(g))).toBe(true);
  });
  it('replays standby, manual orders, active EAST backup and narrowed vendor access', () => {
    let g = startFinale(2);
    g = job(g, { type: 'start-manual-shipping' }) as StrategicSession;
    g = job(g, { type: 'switch-erp-standby' }) as StrategicSession;
    g = job(g, {
      type: 'activate-branch-route',
      route: 'backup',
    }) as StrategicSession;
    const raw = JSON.stringify(createCurrentGameSave(g, reportDate));
    expect(simulation(g).branch!.activeRoute).toBe('backup');
    expect(
      simulation(g).recovery!.orders.some((o) => o.fulfilledBy === 'manual'),
    ).toBe(true);
    const load = readCurrentGameSave(raw);
    expect(load.ok).toBe(true);
    if (load.ok) expect(sameJson(load.value.session, g)).toBe(true);
  });
  it('preserves V8 originals and refuses a corrupt V9 instead of silently replacing current play', () => {
    const g = finaleHeadquarters(1),
      raw = JSON.stringify(createV8(g, reportDate));
    expect(readV8(raw).ok).toBe(true);
    const data = new Map([[V8, raw]]),
      storage = {
        removeItem: (k: string) => {
          data.delete(k);
        },
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => {
          data.set(k, v);
        },
      };
    const loaded = loadCurrentGameState(storage);
    expect(loaded.result.ok).toBe(true);
    expect(loaded.eighthRaw).toBe(raw);
    expect(storeCurrentGameState(storage, g, reportDate).ok).toBe(true);
    expect(data.get(V8)).toBe(raw);
    expect(JSON.parse(data.get(V9)!).schemaVersion).toBe(9);
    data.set(V9, 'broken');
    expect(loadCurrentGameState(storage).result.ok).toBe(false);
    const before = JSON.stringify(g);
    expect(readCurrentGameSave('{"schemaVersion":9}').ok).toBe(false);
    expect(JSON.stringify(g)).toBe(before);
  });
  it('rejects tampering, invalid worker, unknown keys and invalid hypothesis/approval journal data', () => {
    expect(
      isCurrentCampaignCommand({
        type: 'start-finale-incident',
        familyId: 'other',
      }),
    ).toBe(false);
    expect(
      isCurrentCampaignCommand({
        type: 'start-finale-incident',
        familyId: 'nexus-campaign-finale-v1',
        variant: 'crossfire',
      }),
    ).toBe(false);
    const action = {
      type: 'approve-emergency-vendor-access',
      scope: 'api-only',
      expiresAtMinute: 930,
      justification: 'Zlecenia kryzysowe NEXUS',
    };
    expect(
      isCurrentRecordedCommand({
        type: 'schedule-task',
        workerId: 'analyst',
        action,
      }),
    ).toBe(false);
    expect(
      isCurrentRecordedCommand({
        type: 'schedule-task',
        workerId: 'administrator',
        action: { ...action, expiresAtMinute: 940 },
      }),
    ).toBe(false);
    expect(
      isCurrentRecordedCommand({
        type: 'set-crisis-hypothesis',
        hypothesis: 'cascade',
      }),
    ).toBe(false);
    const save = createCurrentGameSave(startFinale(), reportDate);
    const modified = structuredClone(save) as any;
    modified.session.campaign.incident.business.totalProcessed = 100;
    expect(readCurrentGameSave(JSON.stringify(modified)).ok).toBe(false);
  });
  it('hypothesis AAR preserves the knowledge at decision, not later private cause', () => {
    let g = startFinale(1);
    g = advance(g, 3) as StrategicSession;
    g = command(g, {
      type: 'set-crisis-hypothesis',
      hypothesis: 'operational-failure',
    }) as StrategicSession;
    g = job(g, { type: 'inspect-auth-logs' }) as StrategicSession;
    g = finish(g) as StrategicSession;
    const aar = createAfterActionReport(g, undefined, reportDate);
    expect(aar.ok, aar.ok ? '' : JSON.stringify(aar)).toBe(true);
    if (!aar.ok) return;
    const d = aar.value.playerDecisions.find(
      (d) => d.action.type === 'set-crisis-hypothesis',
    )!;
    expect(d.knownAtDecision.hypotheses.crisis).toBe('insufficient-evidence');
    expect(d.knownAtDecision.configuration.campaignFinale).not.toHaveProperty(
      'variant',
    );
    expect(d.actualStateAtDecision.campaignFinale).toHaveProperty(
      'definition.variant',
      'false-lead',
    );
    expect(d.knownAtDecision.evidenceIds).not.toContain('T-0001-auth');
    expect(selectPlayerView(simulation(g)).finale!.hypothesis).toBe(
      'operational-failure',
    );
  });
  it('exports the recorded emergency approval justification without inventing expected effects', () => {
    let g = startFinale(1, false);
    g = job(g, {
      type: 'approve-emergency-vendor-access',
      scope: 'api-only',
      expiresAtMinute: 930,
      justification: 'Awaryjna realizacja przewozów NEXUS',
    }) as StrategicSession;
    g = finish(g) as StrategicSession;
    const a = createAfterActionReport(g, undefined, reportDate);
    expect(a.ok, a.ok ? '' : JSON.stringify(a)).toBe(true);
    if (!a.ok) return;
    const d = a.value.playerDecisions.find(
      (d) => d.action.type === 'approve-emergency-vendor-access',
    )!;
    expect(d.intentRecorded).toBe(true);
    expect(d.expectedEffect).toBeNull();
    expect(d.action).toHaveProperty(
      'justification',
      'Awaryjna realizacja przewozów NEXUS',
    );
  });
});
