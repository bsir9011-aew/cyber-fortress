import { CURRENT_GAME_SAVE_KEY as CURRENT_KEY } from '../persistence/gameSaveV9';
import { describe, it, expect } from 'vitest';
import type { GameSession, StrategicSession } from './gameSession';
import { currentOperation, createStrategicSession } from './gameSession';
import {
  campaign,
  prepare,
  finish,
  advance,
  job,
  order,
  simulation,
  sessionDate,
  reportDate,
} from '../testSupport/aar';
import { recoveryHeadquarters, startRecovery } from '../testSupport/recovery';
import { budgetBalance } from './campaignReducer';
import { createRecoveryIncident } from './prepareCampaignIncident';
import { selectPlayerView } from './selectPlayerView';
import { selectRecoveryReport } from './selectRecoveryReport';
import {
  createAfterActionReport,
  campaignAarMissionId,
} from './createAfterActionReport';
import { renderAfterActionMarkdown } from './afterActionMarkdown';
import { validateAfterActionReport } from './validateAfterActionReport';
import { assessErpAvailability } from '../simulation/recoveryAccess';
import {
  createCurrentGameSave,
  readCurrentGameSave,
  serializeCurrentGameSave,
  isCurrentCampaignCommand,
  isCurrentRecordedCommand,
} from '../persistence/gameSaveV7';
import {
  createCurrentGameSave as saveV6,
  readCurrentGameSave as readV6,
  CURRENT_GAME_SAVE_KEY as V6,
} from '../persistence/gameSaveV6';
import { createCurrentGameSave as saveV5 } from '../persistence/gameSaveV5';
import {
  loadCurrentGameState,
  storeCurrentGameState,
} from '../persistence/resilienceGameStorage';
function roundtrip(g: GameSession) {
  const encoded = serializeCurrentGameSave(
    createCurrentGameSave(g, reportDate),
  );
  expect(encoded.ok, encoded.ok ? '' : encoded.error).toBe(true);
  if (!encoded.ok) throw Error(encoded.error);
  const read = readCurrentGameSave(encoded.value);
  if (!read.ok) throw Error(read.error);
  expect(read.value.session).toEqual(g);
  return read.value.session;
}
function bPath(): GameSession {
  let g: GameSession = startRecovery(recoveryHeadquarters(1));
  g = advance(
    order(order(g, { type: 'inspect-erp-backups' }), {
      type: 'start-manual-shipping',
    }),
  );
  g = advance(
    order(order(g, { type: 'restore-erp-backup', backupId: 'ERP-1320' }), {
      type: 'inspect-erp-database',
    }),
    2,
  );
  g = job(g, { type: 'close-manual-shipping' });
  g = job(g, { type: 'reconcile-erp-records' });
  g = job(g, { type: 'inspect-erp-consistency' });
  return finish(g);
}
describe('M04 campaign and historical contracts', () => {
  it('unlocks only after a completed M03, including failed M03, without new funding or projects', () => {
    const first = campaign(
      prepare(createStrategicSession('fresh', sessionDate)),
      { type: 'start-recovery-incident', familyId: 'nexus-erp-recovery-v1' },
    );
    expect(first.campaign.phase).toBe('preparation');
    const hq = recoveryHeadquarters(1);
    expect(hq.campaign.history.at(-1)?.vendor).toBeDefined();
    expect(hq.campaign.history.at(-1)?.vendor?.completedBatches).toBe(0);
    const g = startRecovery(hq);
    expect(g.campaign.incident?.recovery).toBeDefined();
    expect(g.campaign.incident?.hidden.scenario.recovery?.cause).toBe(
      'database-corruption',
    );
    expect(budgetBalance(g.campaign)).toEqual(budgetBalance(hq.campaign));
    expect(g.campaign.projects).toEqual(hq.campaign.projects);
    expect(g.campaign.funding).toEqual(hq.campaign.funding);
    expect(currentOperation(g)?.commands).toEqual([]);
  });
  it('repeats M04 after any result and preserves investment, balance, previous reports and inherited access controls', () => {
    let g = startRecovery();
    const original = g.campaign.history;
    g = campaign(finish(g) as StrategicSession, {
      type: 'return-headquarters',
    });
    const budget = budgetBalance(g.campaign);
    expect(g.campaign.history.slice(0, 3)).toEqual(original);
    expect(g.campaign.history.at(-1)?.recovery?.goalMet).toBe(false);
    const repeated = startRecovery(g);
    expect(repeated.campaign.incident?.recovery).toBeDefined();
    expect(budgetBalance(repeated.campaign)).toEqual(budget);
    const posture = {
      ...g.campaign.posture,
      remoteAccess: true,
      segmentation: true,
      accountOverrides: {
        'dispatch-team': {
          loginStatus: 'blocked' as const,
          credentialVersion: 2,
        },
      },
      ruleOverrides: { 'R-LOCAL': 'deny' as const },
    };
    let s = createRecoveryIncident(0, posture, 'nexus-erp-recovery-v1');
    expect(
      s.access.accounts.find((a) => a.id === 'dispatch-team'),
    ).toMatchObject({
      loginStatus: 'blocked',
      credentialVersion: 2,
      mfaPolicy: 'required',
    });
    expect(s.telemetry.endpoint).toBeUndefined();
    expect(s.hidden.scenario.backupReadiness).toBeUndefined();
    s = simulation(
      job(
        { ...repeated, campaign: { ...repeated.campaign, incident: s } },
        { type: 'restart-erp-service' },
      ),
    );
    expect(assessErpAvailability(s).capacity).toBe(0);
  });
  it.each(['diagnosis', 'restore', 'manual'] as const)(
    'resumes %s through deterministic V7 replay',
    (stage) => {
      let g: GameSession = startRecovery(recoveryHeadquarters(1));
      if (stage === 'diagnosis') g = order(g, { type: 'inspect-erp-database' });
      if (stage === 'restore')
        g = advance(
          order(job(g, { type: 'inspect-erp-backups' }), {
            type: 'restore-erp-backup',
            backupId: 'ERP-1320',
          }),
        );
      if (stage === 'manual')
        g = advance(job(g, { type: 'start-manual-shipping' }), 2);
      expect(finish(roundtrip(g))).toEqual(finish(g));
    },
  );
  it('imports real V5/V6 journals unchanged, preserves original bytes, and never falls back over broken current saves', () => {
    const g = recoveryHeadquarters();
    const v6 = JSON.stringify(saveV6(g, reportDate)),
      v5 = JSON.stringify(
        saveV5(createStrategicSession('v5', sessionDate), reportDate),
      );
    for (const text of [v5, v6]) {
      const parsed = readCurrentGameSave(text);
      expect(parsed.ok).toBe(true);
      if (parsed.ok)
        expect(parsed.value.session).toEqual(JSON.parse(text).session);
    }
    expect(readV6(v6).ok).toBe(true);
    const map = new Map([[V6, v6]]);
    const storage = {
      removeItem: (k: string) => {
        map.delete(k);
      },
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const loaded = loadCurrentGameState(storage);
    expect(loaded.sixthRaw).toBe(v6);
    expect(loaded.result).toEqual({ ok: true, value: g });
    expect(storeCurrentGameState(storage, g, reportDate).ok).toBe(true);
    expect(map.get(V6)).toBe(v6);
    expect(JSON.parse(map.get(CURRENT_KEY)!).schemaVersion).toBe(9);
    map.set(CURRENT_KEY, 'broken');
    expect(loadCurrentGameState(storage).result.ok).toBe(false);
    expect(map.get(V6)).toBe(v6);
  });
  it('strict command validation and replay reject forged state or parameters without touching source bytes', () => {
    expect(
      isCurrentCampaignCommand({
        type: 'start-recovery-incident',
        familyId: 'nexus-erp-recovery-v1',
      }),
    ).toBe(true);
    expect(
      isCurrentCampaignCommand({
        type: 'start-recovery-incident',
        familyId: 'nexus-vendor-access-v1',
      }),
    ).toBe(false);
    for (const action of [
      { type: 'restore-erp-backup', backupId: 'FS-1350' },
      { type: 'restart-erp-service', enabled: true },
      { type: ['restart-erp-service'] },
      { type: 'restore-erp-backup', backupId: ['ERP-1320'] },
    ])
      expect(
        isCurrentRecordedCommand({
          type: 'schedule-task',
          workerId: 'administrator',
          action,
        }),
      ).toBe(false);
    expect(
      isCurrentRecordedCommand({
        type: 'schedule-task',
        workerId: 'analyst',
        action: { type: 'restart-erp-service' },
      }),
    ).toBe(false);
    expect(
      isCurrentCampaignCommand({
        type: 'incident-command',
        command: {
          type: 'schedule-task',
          workerId: 'administrator',
          action: { type: ['restart-erp-service'] },
        },
      }),
    ).toBe(false);
    const g = startRecovery();
    const saved = createCurrentGameSave(g, reportDate);
    const original = JSON.stringify(saved);
    const forged = JSON.parse(original);
    forged.session.campaign.incident.recovery.primary.processRunning = true;
    expect(readCurrentGameSave(JSON.stringify(forged)).ok).toBe(false);
    expect(JSON.stringify(saved)).toBe(original);
  });
  it('AAR and UI agree; decisions retain prior observations, actual cause and real effects without hindsight scoring', () => {
    const g = bPath(),
      state = simulation(g),
      r = selectRecoveryReport(state)!;
    expect(r.goalMet).toBe(true);
    const result = createAfterActionReport(g, undefined, reportDate);
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const aar = result.value;
    expect(aar.scenario.family).toBe('M04');
    expect(aar.gameVersion.engine).toBe('13.0.0');
    expect(aar.finalOutcome.allObjectivesMet).toBe(r.goalMet);
    expect(aar.securityConsequences.erpRecovery).toEqual(r);
    expect(validateAfterActionReport(aar).ok).toBe(true);
    const restore = aar.playerDecisions.find(
      (d) => d.action.type === 'restore-erp-backup',
    )!;
    expect(restore.knownAtDecision.configuration.erpRecovery).toEqual(
      selectPlayerView(
        simulation(
          advance(
            order(
              order(startRecovery(recoveryHeadquarters(1)), {
                type: 'inspect-erp-backups',
              }),
              { type: 'start-manual-shipping' },
            ),
          ),
        ),
      ).recovery,
    );
    expect(restore.actualStateAtDecision.erpRecovery).toMatchObject({
      consistent: false,
    });
    expect(
      restore.knownAtDecision.configuration.erpRecovery,
    ).not.toHaveProperty('cause');
    expect(restore.expectedEffect).toBe(null);
    expect(
      aar.timeline.some(
        (t) => t.kind === 'erp-task-result' && t.status === 'succeeded',
      ),
    ).toBe(true);
    expect(
      aar.knownEvidence.some((e) => e.kind === 'erp-recovery-observation'),
    ).toBe(true);
    const md = renderAfterActionMarkdown(aar);
    expect(md).toContain('Misja 04 — Service Recovery');
    expect(md).toContain('ERP-1320');
    expect(md).toContain('reconciledRecordIds');
    const hq = campaign(g as StrategicSession, { type: 'return-headquarters' });
    expect(
      createAfterActionReport(
        hq,
        campaignAarMissionId(hq.attemptId, 4),
        reportDate,
      ),
    ).toEqual(result);
  });
  it('failed restart records failure without grading rationality or leaking future diagnostic facts', () => {
    const g = finish(
      job(startRecovery(recoveryHeadquarters(1)), {
        type: 'restart-erp-service',
      }),
    );
    const result = createAfterActionReport(g, undefined, reportDate);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const d = result.value.playerDecisions[0]!;
    expect(d.knownAtDecision.configuration.erpRecovery).toMatchObject({
      observations: [],
    });
    expect(d.actualStateAtDecision.erpRecovery).toMatchObject({
      consistent: false,
    });
    expect(d.status).toBe('completed');
    expect(
      result.value.timeline.find((t) => t.kind === 'erp-task-result')?.status,
    ).toBe('failed');
    expect(result.value.finalOutcome.allObjectivesMet).toBe(false);
  });
});
