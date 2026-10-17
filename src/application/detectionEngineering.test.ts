import { describe, expect, it } from 'vitest';
import { createStrategicSession, currentOperation } from './gameSession';
import type { StrategicSession } from './gameSession';
import type { CampaignCommand } from '../domain/campaign';
import {
  campaign,
  finish,
  install,
  prepare,
  startM02,
  advance,
  job,
  simulation,
  sessionDate,
  reportDate,
} from '../testSupport/aar';
import {
  budgetBalance,
  campaignReducer,
  createCampaign,
} from './campaignReducer';
import {
  DETECTION_FAMILY_ID,
  legalModificationScenario,
  slowModificationScenario,
  selectDetectionScenario,
} from '../content/scenarios/detection';
import { createAfterActionReport } from './createAfterActionReport';
import { renderAfterActionMarkdown } from './afterActionMarkdown';
import { validateAfterActionReport } from './validateAfterActionReport';
import {
  createCurrentGameSave,
  readCurrentGameSave,
  serializeCurrentGameSave,
  isCurrentCampaignCommand,
  CURRENT_GAME_SAVE_KEY,
} from '../persistence/gameSaveV5';
import {
  readCurrentGameSave as readV4,
  CURRENT_GAME_SAVE_KEY as V4_KEY,
} from '../persistence/gameSaveV4';
import {
  loadCurrentGameState,
  storeCurrentGameState,
} from '../persistence/resilienceGameStorage';
import pendingV4 from '../persistence/fixtures/sprint9-restore-pending-v4.json?raw';
import { selectStrategyView } from './selectStrategyView';
import { selectDetectionReview } from './selectDetectionReview';
import { selectIntegrityReport } from './selectIntegrityReport';
const unknown: CampaignCommand = {
  type: 'start-detection-incident',
  familyId: DETECTION_FAMILY_ID,
};
const tuning = (
  threshold = 2,
  windowMinutes: 5 | 10 | 20 = 5,
): CampaignCommand => ({
  type: 'configure-endpoint-detection',
  endpointId: 'pakowanie-03',
  threshold,
  windowMinutes,
});
function headquarters(id = legalModificationScenario.id) {
  const initialSeed = [0, 1, 2].find(
    (seed) => selectDetectionScenario(DETECTION_FAMILY_ID, seed + 2).id === id,
  )!;
  let s = createStrategicSession(
    'detection-campaign',
    sessionDate,
    initialSeed,
  );
  s = campaign(
    finish(
      campaign(prepare(s), { type: 'start-incident' }),
    ) as StrategicSession,
    { type: 'return-headquarters' },
  );
  s = campaign(
    finish(startM02(s)) as StrategicSession,
    { type: 'return-headquarters' },
    { type: 'accept-resilience-funding' },
  );
  return install(s, ['endpoint-edr']);
}
function roundtrip(s: StrategicSession) {
  const result = serializeCurrentGameSave(createCurrentGameSave(s, reportDate));
  expect(result.ok, result.ok ? '' : result.error).toBe(true);
  if (!result.ok) throw Error(result.error);
  const loaded = readCurrentGameSave(result.value);
  if (!loaded.ok || loaded.value.session.kind !== 'campaign')
    throw Error('Import failed');
  return loaded.value.session;
}
describe('hourly detection work and campaign persistence', () => {
  it('activates only after one analyst hour, with no payment and no parallel analyst assignment', () => {
    let s = headquarters();
    s = campaign(
      s,
      { type: 'plan-project', projectId: 'backup-resilience' },
      { type: 'reserve-project', projectId: 'backup-resilience' },
    );
    const before = budgetBalance(s.campaign);
    s = campaign(s, tuning());
    expect(s.campaign.posture.endpointCoverage!.detection.threshold).toBe(10);
    expect(s.campaign.detectionChanges?.[0]?.completedHour).toBeNull();
    s = roundtrip(s);
    s = campaign(s, {
      type: 'assign-work',
      projectId: 'backup-resilience',
      workerId: 'analyst',
    });
    expect(s.campaign.decisions.at(-1)!.result).toBe('rejected');
    s = campaign(s, {
      type: 'assign-work',
      projectId: 'backup-resilience',
      workerId: 'administrator',
    });
    expect(s.campaign.decisions.at(-1)!.result).toBe('applied');
    const ledgerAfterAdmin = s.campaign.budget.ledger;
    s = campaign(s, { type: 'advance-preparation' });
    expect(s.campaign.posture.endpointCoverage!.detection).toMatchObject({
      threshold: 2,
      windowMinutes: 5,
      counting: 'unique-documents-v2',
    });
    expect(s.campaign.detectionChanges![0]!.completedHour).toBe(3);
    expect(s.campaign.budget.ledger).toEqual(ledgerAfterAdmin);
    expect(budgetBalance(s.campaign).available).toBe(before.available); // Reserved money paid for backup, tuning is free.
    expect(roundtrip(s)).toEqual(s);
  });
  it('rejects tuning without EDR, after window, for invalid target or values, and when analyst is occupied', () => {
    expect(
      campaignReducer(createCampaign(), tuning()).decisions.at(-1)!.result,
    ).toBe('rejected');
    const s = headquarters();
    for (const c of [
      { ...tuning(), endpointId: 'missing' },
      tuning(1),
      tuning(31),
      tuning(2.5),
      { ...tuning(), windowMinutes: 15 },
    ] as CampaignCommand[])
      expect(campaign(s, c).campaign.decisions.at(-1)!.result).toBe('rejected');
    expect(
      campaign(prepare(s), tuning()).campaign.decisions.at(-1)!.result,
    ).toBe('rejected');
    let busy = campaign(
      s,
      { type: 'plan-project', projectId: 'backup-resilience' },
      { type: 'reserve-project', projectId: 'backup-resilience' },
      {
        type: 'assign-work',
        projectId: 'backup-resilience',
        workerId: 'analyst',
      },
    );
    busy = campaign(busy, tuning());
    expect(busy.campaign.decisions.at(-1)!.result).toBe('rejected');
    expect(busy.campaign.detectionChanges).toBeUndefined();
    const running = campaign(s, tuning());
    expect(campaign(running, tuning(3)).campaign.detectionChanges).toHaveLength(
      1,
    );
    const incident = campaign(prepare(s), unknown);
    expect(campaign(incident, tuning()).campaign.decisions.at(-1)!.result).toBe(
      'rejected',
    );
  });
  it('inherits tuning across missions, retains old alerts, and never retroactively regenerates them', () => {
    let s = headquarters();
    s = campaign(s, tuning(6, 10), { type: 'advance-preparation' });
    s = campaign(prepare(s), unknown);
    const complete = finish(s) as StrategicSession;
    const firstAlerts = JSON.stringify(
      complete.campaign.incident!.telemetry.endpoint!.alerts,
    );
    s = campaign(complete, { type: 'return-headquarters' }, tuning(30, 20), {
      type: 'advance-preparation',
    });
    expect(s.campaign.posture.endpointCoverage!.detection.threshold).toBe(30);
    expect(
      JSON.stringify(complete.campaign.incident!.telemetry.endpoint!.alerts),
    ).toBe(firstAlerts);
    s = campaign(prepare(roundtrip(s)), unknown);
    expect(
      s.campaign.incident!.telemetry.endpoint!.coverage.detection.threshold,
    ).toBe(30);
    expect(s.campaign.incident!.telemetry.endpoint!.alerts).toHaveLength(0);
    expect(roundtrip(s)).toEqual(s);
  });
  it('unknown cases require completed M01 and prep, but never require a sensor', () => {
    const empty = createCampaign();
    expect(
      campaignReducer(
        { ...empty, preparation: { ...empty.preparation, hour: 4 } },
        unknown,
      ).phase,
    ).toBe('preparation');
    let s = createStrategicSession('no-edr', sessionDate);
    s = campaign(
      finish(
        campaign(prepare(s), { type: 'start-incident' }),
      ) as StrategicSession,
      { type: 'return-headquarters' },
    );
    expect(campaign(s, unknown).campaign.phase).toBe('preparation');
    s = campaign(prepare(s), unknown);
    expect(s.campaign.phase).toBe('incident');
    expect(s.campaign.incident!.telemetry.endpoint).toBeUndefined();
    expect(currentOperation(s)!.commands).toHaveLength(0);
    expect(roundtrip(s)).toEqual(s);
    expect(
      selectStrategyView((finish(s) as StrategicSession).campaign)
        .eligibleForFunding,
    ).toBe(true);
  });
});
describe('V5 exact command replay and existing V1–V4 readers', () => {
  it.each([
    { ...unknown, familyId: 'other' },
    { ...unknown, extra: 1 },
    { ...tuning(), threshold: NaN },
    { ...tuning(), threshold: 1 },
    { ...tuning(), threshold: 31 },
    { ...tuning(), threshold: 2.5 },
    { ...tuning(), threshold: '2' },
    { ...tuning(), endpointId: 'other' },
    { ...tuning(), windowMinutes: 15 },
    { ...tuning(), extra: 1 },
  ])('rejects malformed new command %j', (c) =>
    expect(isCurrentCampaignCommand(c)).toBe(false),
  );
  it('does not relabel V4 commands as V5; imports original V4 unchanged', () => {
    const old = readV4(pendingV4),
      next = readCurrentGameSave(pendingV4);
    expect(old.ok).toBe(true);
    expect(next.ok).toBe(true);
    if (!old.ok || !next.ok) return;
    expect(next.value.session).toEqual(old.value.session);
    expect(next.value.schemaVersion).toBe(5);
    const save = createCurrentGameSave(
      campaign(headquarters(), tuning()),
      reportDate,
    );
    expect(
      readV4(
        JSON.stringify({
          ...save,
          schemaVersion: 4,
          engineVersion: '9.0.0',
          contentVersion: 'nexus-resilience-1',
        }),
      ).ok,
    ).toBe(false);
  });
  it('unknown scenario and pending investigation continue identically after import', () => {
    let s = campaign(headquarters(slowModificationScenario.id), tuning(3, 20), {
      type: 'advance-preparation',
    });
    s = campaign(prepare(s), unknown);
    s = advance(s, 4) as StrategicSession;
    s = campaign(s, {
      type: 'incident-command',
      command: {
        type: 'schedule-task',
        workerId: 'analyst',
        action: { type: 'inspect-edr-telemetry' },
      },
    });
    expect(currentOperation(s)!.commands).toHaveLength(5);
    expect(finish(roundtrip(s))).toEqual(finish(s));
    const save = JSON.parse(
      JSON.stringify(createCurrentGameSave(s, reportDate)),
    );
    save.session.campaign.posture.endpointCoverage.detection.threshold = 30;
    expect(readCurrentGameSave(JSON.stringify(save)).ok).toBe(false);
  });
  it('V5 storage preserves original V4 bytes and does not fall back from a corrupt newer save', () => {
    const data = new Map([[V4_KEY, pendingV4]]);
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
      removeItem: (k: string) => {
        data.delete(k);
      },
    };
    expect(loadCurrentGameState(storage).fourthRaw).toBe(pendingV4);
    expect(data.has(CURRENT_GAME_SAVE_KEY)).toBe(false);
    expect(storeCurrentGameState(storage, headquarters(), reportDate).ok).toBe(
      true,
    );
    expect(data.get(V4_KEY)).toBe(pendingV4);
    expect(data.has(CURRENT_GAME_SAVE_KEY)).toBe(true);
    data.set(CURRENT_GAME_SAVE_KEY, '{}');
    expect(loadCurrentGameState(storage).result.ok).toBe(false);
    expect(data.get(V4_KEY)).toBe(pendingV4);
  });
});
describe('AAR separates decision-time signals from post-mission detection truth', () => {
  it('exports central tuning, FP evidence, real isolation cost and later classification, without judgment', () => {
    let s = campaign(headquarters(), tuning(6, 10), {
      type: 'advance-preparation',
    });
    s = campaign(prepare(s), unknown);
    let g = advance(s, 2);
    g = job(g, { type: 'inspect-edr-telemetry' });
    g = job(g, { type: 'isolate-endpoint', endpointId: 'pakowanie-03' });
    const done = finish(g);
    const aar = createAfterActionReport(done, undefined, reportDate);
    expect(aar.ok, aar.ok ? '' : aar.error).toBe(true);
    if (!aar.ok) return;
    const r = aar.value;
    expect(r.gameVersion.engine).toBe('11.0.0');
    expect(r.campaignContext!.detectionChanges?.[0]).toMatchObject({
      threshold: 6,
      completedHour: 3,
    });
    const isolation = r.playerDecisions.find(
      (d) => d.action.type === 'isolate-endpoint',
    )!;
    expect(isolation.knownAtDecision.alertIds.length).toBeGreaterThan(0);
    expect(
      isolation.knownAtDecision.evidenceIds.some((id) => id.includes('-edr')),
    ).toBe(true);
    expect(JSON.stringify(isolation.knownAtDecision)).not.toContain(
      'classification',
    );
    expect(JSON.stringify(isolation.knownAtDecision)).not.toContain(
      'falsePositive',
    );
    expect(JSON.stringify(r.securityConsequences.detectionReview)).toContain(
      'falsePositiveAlertIds',
    );
    expect(r.groundTruth.finalState.documents!.damaged).toBe(0);
    expect(r.businessConsequences.finalBacklog).toBeGreaterThan(0);
    expect(validateAfterActionReport(r).ok).toBe(true);
    const md = renderAfterActionMarkdown(r);
    expect(md).toContain('Detection Engineering');
    expect(md).toContain('Zmiany reguły w Centrali');
    expect(md).toContain('nie stanowi oceny racjonalności');
    expect(createAfterActionReport(s, undefined, reportDate).ok).toBe(false);
  });
  it('keeps triggering events immutable and recognizes harmful continuations in the same detected series, including UI/AAR', () => {
    const s = campaign(
      prepare(
        campaign(headquarters(slowModificationScenario.id), tuning(2, 20), {
          type: 'advance-preparation',
        }),
      ),
      unknown,
    );
    let g = advance(s, 3); // A: modify at 14:10, alert after delivery at 14:15.
    const firstAlert = structuredClone(
      simulation(g).telemetry.endpoint!.alerts[0]!,
    );
    expect(simulation(g).telemetry.endpoint!.alerts).toHaveLength(1);
    g = advance(g, 2); // B: modify at 14:20, observed at 14:25 in the same series.
    expect(simulation(g).telemetry.endpoint!.alerts).toHaveLength(1);
    expect(simulation(g).telemetry.endpoint!.alerts[0]!.eventIds).toEqual(
      firstAlert.eventIds,
    );
    const done = finish(g),
      state = simulation(done);
    const before = JSON.stringify(state);
    const review = selectDetectionReview(state)!;
    const a = review.sourceOperations.find((o) => o.minute === 850)!;
    const b = review.sourceOperations.find((o) => o.minute === 860)!;
    expect(a.detectionStatus).toBe('alert-trigger');
    expect(a.alertIds).toEqual([firstAlert.id]);
    expect(b.detectionStatus).toBe('detected-series');
    expect(b.alertIds).toEqual([]);
    expect(b.detectedSeriesAlertIds).toEqual([firstAlert.id]);
    expect(b.missedReason).toBeNull();
    expect(review.undetectedHarmfulOperationIds).not.toContain(b.id);
    expect(review.undetectedHarmfulOperationIds).toHaveLength(0);
    expect(review.alerts).toHaveLength(1);
    expect(review.alerts[0]!.eventIds).toEqual(firstAlert.eventIds);
    expect(review.alerts[0]!.continuationOperationIds).toContain(b.id);
    const late = review.sourceOperations.find((o) => o.minute === 930)!;
    expect(late.detectionStatus).toBe('not-delivered-in-time');
    expect(late.detectedSeriesAlertIds).toEqual([]);
    expect(review.notDeliveredInTimeOperationIds).toEqual([late.id]);
    expect(review.outsideCoverageOperationIds).toEqual([]);
    expect(selectIntegrityReport(state)!.detectionReview).toEqual(review);
    const aar = createAfterActionReport(done, undefined, reportDate);
    expect(aar.ok, aar.ok ? '' : aar.error).toBe(true);
    if (!aar.ok) return;
    expect(aar.value.securityConsequences.detectionReview).toEqual(review);
    expect(renderAfterActionMarkdown(aar.value)).toContain('detected-series');
    expect(JSON.stringify(state)).toBe(before);
  });
  it('exports real harmful operations and missed signals independently from acquired evidence', () => {
    const s = campaign(
      prepare(
        campaign(headquarters(slowModificationScenario.id), tuning(30, 20), {
          type: 'advance-preparation',
        }),
      ),
      unknown,
    );
    const done = finish(s);
    const aar = createAfterActionReport(done, undefined, reportDate);
    expect(aar.ok, aar.ok ? '' : aar.error).toBe(true);
    if (!aar.ok) return;
    const review = aar.value.securityConsequences.detectionReview as {
      undetectedHarmfulOperationIds: string[];
      alerts: unknown[];
    };
    expect(review.alerts).toHaveLength(0);
    expect(review.undetectedHarmfulOperationIds).toHaveLength(8);
    expect(aar.value.groundTruth.finalState.documents!.damaged).toBe(18);
    expect(simulation(done).hidden.scenario.id).toBe(
      slowModificationScenario.id,
    );
    expect(validateAfterActionReport(aar.value).ok).toBe(true);
  });
});
