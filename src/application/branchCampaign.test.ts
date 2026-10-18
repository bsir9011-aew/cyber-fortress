import { describe, it, expect } from 'vitest';
import type { GameSession, StrategicSession } from './gameSession';
import { createStrategicSession, currentOperation } from './gameSession';
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
import {
  branchHeadquarters,
  prepareBranch,
  startBranch,
} from '../testSupport/branch';
import { budgetBalance } from './campaignReducer';
import { createBranchIncident } from './prepareCampaignIncident';
import { selectStrategyView } from './selectStrategyView';
import { selectPlayerView } from './selectPlayerView';
import { selectBranchReport } from './selectBranchReport';
import { assessBranchAccess } from '../simulation/branchAccess';
import {
  createAfterActionReport,
  campaignAarMissionId,
} from './createAfterActionReport';
import { renderAfterActionMarkdown } from './afterActionMarkdown';
import { validateAfterActionReport } from './validateAfterActionReport';
import {
  createCurrentGameSave,
  readCurrentGameSave,
  serializeCurrentGameSave,
  isCurrentCampaignCommand,
  isCurrentRecordedCommand,
  CURRENT_GAME_SAVE_KEY as V8,
} from '../persistence/gameSaveV8';
import {
  createCurrentGameSave as saveV7,
  readCurrentGameSave as readV7,
  CURRENT_GAME_SAVE_KEY as V7,
} from '../persistence/gameSaveV7';
import {
  loadCurrentGameState,
  storeCurrentGameState,
} from '../persistence/resilienceGameStorage';
const erp = {
  type: 'prepare-branch-architecture',
  change: { component: 'erp', enabled: true },
} as const;
const monitoring = {
  type: 'prepare-branch-architecture',
  change: { component: 'monitoring', enabled: true },
} as const;
const backup = {
  type: 'prepare-branch-architecture',
  change: { component: 'backup', enabled: true },
} as const;
const docs = {
  type: 'prepare-branch-architecture',
  change: { component: 'smb', scope: 'documents' },
} as const;
const hour = { type: 'advance-preparation' } as const;
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
describe('EAST preparation shares the existing workers and hours', () => {
  it('unlocks after any completed M04, including failure, without new funding or headcount', () => {
    const fresh = campaign(
      prepare(createStrategicSession('new', sessionDate)),
      { type: 'start-branch-incident', familyId: 'nexus-east-branch-v1' },
    );
    expect(fresh.campaign.phase).toBe('preparation');
    const hq = branchHeadquarters();
    expect(hq.campaign.history.at(-1)?.recovery?.goalMet).toBe(false);
    const g = prepareBranch(hq);
    expect(budgetBalance(g.campaign)).toEqual(budgetBalance(hq.campaign));
    expect(g.campaign.projects).toEqual(hq.campaign.projects);
    expect(g.campaign.funding).toEqual(hq.campaign.funding);
    expect(selectStrategyView(g.campaign).organization).toEqual({
      name: 'NEXUS Logistics',
      employees: 120,
      computers: 94,
    });
    expect(startBranch(g).campaign.incident?.branch).toBeDefined();
    expect(currentOperation(startBranch(g))?.commands).toEqual([]);
  });
  it('commissions only after work, runs admin/analyst in parallel, and respects the four-hour limit', () => {
    let g = branchHeadquarters();
    g = campaign(g, erp, monitoring);
    expect(g.campaign.branchArchitecture?.erpEnabled ?? false).toBe(false);
    expect(g.campaign.preparation.hour).toBe(0);
    g = campaign(g, hour);
    expect(g.campaign.branchArchitecture).toMatchObject({
      erpEnabled: true,
      monitoring: true,
      smbScope: 'none',
      backupPrepared: false,
    });
    g = campaign(g, docs, hour, backup, hour);
    expect(g.campaign.branchArchitecture?.backupPrepared).toBe(false);
    expect(g.campaign.branchWork?.at(-1)?.remainingHours).toBe(1);
    g = campaign(g, hour);
    expect(g.campaign.branchArchitecture?.backupPrepared).toBe(true);
    expect(g.campaign.preparation.hour).toBe(4);
    expect(
      g.campaign.branchWork
        ?.filter((w) => w.workerId === 'administrator')
        .reduce(
          (n, w) =>
            n + w.segments.reduce((n, segment) => n + segment.hoursWorked, 0),
          0,
        ),
    ).toBe(4);
    const denied = campaign(g, {
      type: 'prepare-branch-architecture',
      change: { component: 'smb', scope: 'all' },
    });
    expect(denied.campaign.decisions.at(-1)?.result).toBe('rejected');
    expect(denied.campaign.branchArchitecture?.smbScope).toBe('documents');
  });
  it('enforces worker exclusivity in both directions with existing paid projects and vendor approvals', () => {
    let g = branchHeadquarters();
    g = campaign(
      g,
      { type: 'plan-project', projectId: 'remote-access' },
      { type: 'reserve-project', projectId: 'remote-access' },
      erp,
    );
    for (const command of [
      {
        type: 'assign-work',
        projectId: 'remote-access',
        workerId: 'administrator',
      },
      {
        type: 'prepare-vendor-exception',
        scope: 'api-only',
        expiresAtMinute: 900,
      },
    ] as const)
      expect(campaign(g, command).campaign.decisions.at(-1)?.reason).toContain(
        'NEXUS EAST',
      );
    g = campaign(g, hour, {
      type: 'assign-work',
      projectId: 'remote-access',
      workerId: 'administrator',
    });
    const busy = campaign(g, backup);
    expect(busy.campaign.decisions.at(-1)?.result).toBe('rejected');
    expect(busy.campaign.branchWork).toEqual(g.campaign.branchWork);
  });
  it('advances branch work and a different worker’s existing project on the same clock', () => {
    let g = branchHeadquarters();
    g = campaign(
      g,
      { type: 'plan-project', projectId: 'file-visibility' },
      { type: 'reserve-project', projectId: 'file-visibility' },
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'analyst',
      },
      erp,
    );
    expect(campaign(g, monitoring).campaign.decisions.at(-1)?.result).toBe(
      'rejected',
    );
    g = campaign(g, hour);
    expect(g.campaign.branchArchitecture?.erpEnabled).toBe(true);
    expect(
      g.campaign.projects.find((p) => p.id === 'file-visibility')?.remaining
        .analyst,
    ).toBe(3);
    expect(g.campaign.preparation.hour).toBe(1);
  });
  it('pauses a two-hour backup at the window boundary and resumes without free work or replay loss', () => {
    let g = campaign(branchHeadquarters(), hour, hour, hour, backup, hour);
    expect(g.campaign.branchArchitecture?.backupPrepared).toBe(false);
    expect(g.campaign.branchWork?.at(-1)).toMatchObject({
      status: 'paused',
      remainingHours: 1,
    });
    g = roundtrip(g) as StrategicSession;
    g = campaign(finish(startBranch(g)) as StrategicSession, {
      type: 'return-headquarters',
    });
    g = campaign(g, backup);
    expect(g.campaign.branchArchitecture?.backupPrepared).toBe(false);
    g = campaign(g, hour);
    expect(g.campaign.branchArchitecture?.backupPrepared).toBe(true);
    expect(
      g.campaign.branchWork?.at(-1)?.segments.map((s) => s.hoursWorked),
    ).toEqual([1, 1]);
    expect(roundtrip(g)).toEqual(g);
  });
  it('retains deployed architecture and history, and later changes cost another real hour', () => {
    let g = prepareBranch();
    const initial = g.campaign.branchArchitecture,
      history = g.campaign.branchWork;
    g = campaign(finish(startBranch(g)) as StrategicSession, {
      type: 'return-headquarters',
    });
    expect(g.campaign.branchArchitecture).toEqual(initial);
    expect(g.campaign.branchWork).toEqual(history);
    const budget = budgetBalance(g.campaign);
    g = campaign(g, {
      type: 'prepare-branch-architecture',
      change: { component: 'smb', scope: 'all' },
    });
    expect(g.campaign.branchArchitecture?.smbScope).toBe('documents');
    g = campaign(g, hour);
    expect(g.campaign.branchArchitecture?.smbScope).toBe('all');
    expect(budgetBalance(g.campaign)).toEqual(budget);
    g = campaign(
      finish(
        job(startBranch(g), {
          type: 'set-network-rule',
          ruleId: 'EAST-SMB',
          action: 'deny',
        }),
      ) as StrategicSession,
      { type: 'return-headquarters' },
    );
    expect(g.campaign.posture.ruleOverrides['EAST-SMB']).toBe('deny');
    g = campaign(g, {
      type: 'prepare-branch-architecture',
      change: { component: 'smb', scope: 'all' },
    });
    expect(g.campaign.decisions.at(-1)?.result).toBe('applied');
    expect(g.campaign.posture.ruleOverrides['EAST-SMB']).toBe('deny');
    g = campaign(g, hour);
    expect(g.campaign.posture.ruleOverrides['EAST-SMB']).toBeUndefined();
  });
});
describe('EAST gameplay, evidence and versioned journals', () => {
  it('supports diagnosis, backup, repair and explicit return to primary through a real campaign', () => {
    let g: GameSession = startBranch();
    g = advance(g, 4);
    g = advance(
      order(order(g, { type: 'inspect-branch-links' }), {
        type: 'activate-branch-route',
        route: 'backup',
      }),
    );
    g = job(g, { type: 'repair-branch-link' });
    g = job(g, { type: 'activate-branch-route', route: 'primary' });
    g = finish(g);
    const r = selectBranchReport(simulation(g))!;
    expect(r.goalMet).toBe(true);
    expect(r.backupUse.activeIntervals).toBe(4);
    expect(r.business.backlog).toBe(0);
    expect(
      (g as StrategicSession).campaign.history.at(-1)?.branch?.goalMet,
    ).toBe(true);
  });
  it('monitoring and business evidence can support a timed SMB restriction before the first data read', () => {
    let g: GameSession = startBranch(prepareBranch(branchHeadquarters(2)));
    g = job(g, { type: 'confirm-branch-requirements' });
    g = advance(g, 3);
    g = job(g, { type: 'inspect-branch-gateway-logs' });
    const before = simulation(g);
    expect(
      before.branch?.observations
        .at(-1)
        ?.records.some((r) => r.protocol === 'SMB'),
    ).toBe(true);
    g = job(g, {
      type: 'set-branch-account-restriction',
      accountId: 'east-documents',
      restricted: true,
    });
    g = finish(g);
    const r = selectBranchReport(simulation(g))!;
    expect(r.goalMet).toBe(true);
    expect(r.exposedRecords).toBe(0);
    expect(r.remainingAccess).toBe(false);
    const hq = campaign(g as StrategicSession, { type: 'return-headquarters' });
    expect(hq.campaign.branchArchitecture?.restrictedAccountIds).toEqual([
      'east-documents',
    ]);
  });
  it('applies previous investment scopes without treating MFA, EDR or FS backup as network repair', () => {
    const base = branchHeadquarters().campaign.posture;
    const s = createBranchIncident(
      2,
      {
        ...base,
        remoteAccess: true,
        fileVisibility: true,
        segmentation: true,
        accountOverrides: {},
        ruleOverrides: {},
      },
      'nexus-east-branch-v1',
      {
        erpEnabled: true,
        smbScope: 'documents',
        backupPrepared: true,
        monitoring: true,
        restrictedAccountIds: [],
      },
    );
    expect(
      s.access.accounts.find((a) => a.id === 'east-documents')?.mfaPolicy,
    ).toBe('required');
    expect(
      s.branch?.contexts.find((c) => c.accountId === 'east-documents')
        ?.authenticated,
    ).toBe(true);
    expect(s.telemetry.fileAudit?.sensor.enabled).toBe(true);
    expect(s.telemetry.endpoint).toBeUndefined();
    expect(s.hidden.scenario.backupReadiness).toBeUndefined();
    expect(assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed).toBe(
      true,
    );
  });
  it.each(['preparation', 'diagnosis', 'repair', 'policy'] as const)(
    'replays V8 deterministically during %s',
    (stage) => {
      let g: GameSession =
        stage === 'preparation'
          ? campaign(branchHeadquarters(), erp, monitoring)
          : startBranch();
      if (stage === 'diagnosis') g = order(g, { type: 'inspect-branch-links' });
      if (stage === 'repair')
        g = advance(
          order(job(advance(g, 4), { type: 'inspect-branch-links' }), {
            type: 'repair-branch-link',
          }),
        );
      if (stage === 'policy')
        g = advance(order(g, { type: 'set-branch-smb-scope', scope: 'all' }));
      const resumed = roundtrip(g);
      expect(resumed).toEqual(g);
      if (stage !== 'preparation') expect(finish(resumed)).toEqual(finish(g));
    },
  );
  it('reads real V7 campaign journals, keeps original bytes, and does not fall back over a broken V8', () => {
    const g = branchHeadquarters(),
      raw = JSON.stringify(saveV7(g, reportDate));
    expect(readV7(raw).ok).toBe(true);
    const read = readCurrentGameSave(raw);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.value.session).toEqual(g);
    const data = new Map([[V7, raw]]),
      storage = {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => {
          data.set(k, v);
        },
        removeItem: (k: string) => {
          data.delete(k);
        },
      };
    expect(loadCurrentGameState(storage).seventhRaw).toBe(raw);
    expect(storeCurrentGameState(storage, g, reportDate).ok).toBe(true);
    expect(data.get(V7)).toBe(raw);
    expect(JSON.parse(data.get(V8)!).schemaVersion).toBe(8);
    data.set(V8, 'broken');
    expect(loadCurrentGameState(storage).result.ok).toBe(false);
    expect(data.get(V7)).toBe(raw);
  });
  it('strict import rejects malformed commands, forged preparation and changed hidden truth without mutation', () => {
    for (const change of [
      { component: ['erp'], enabled: true },
      { component: 'erp', enabled: 'true' },
      { component: 'smb', scope: ['all'] },
      { component: 'monitoring', enabled: true, free: true },
    ])
      expect(
        isCurrentCampaignCommand({
          type: 'prepare-branch-architecture',
          change,
        }),
      ).toBe(false);
    for (const action of [
      { type: ['repair-branch-link'] },
      { type: 'activate-branch-route', route: 'both' },
      {
        type: 'set-branch-account-restriction',
        accountId: 'dispatch-team',
        restricted: true,
      },
      { type: 'set-branch-smb-scope', scope: ['all'] },
    ])
      expect(
        isCurrentRecordedCommand({
          type: 'schedule-task',
          workerId: 'administrator',
          action,
        }),
      ).toBe(false);
    expect(
      isCurrentCampaignCommand({
        type: 'start-branch-incident',
        familyId: 'nexus-vendor-access-v1',
      }),
    ).toBe(false);
    const save = createCurrentGameSave(startBranch(), reportDate),
      original = JSON.stringify(save);
    const changed = JSON.parse(original);
    changed.session.campaign.incident.hidden.scenario.branch.requiresDocuments = true;
    expect(readCurrentGameSave(JSON.stringify(changed)).ok).toBe(false);
    expect(JSON.stringify(save)).toBe(original);
    const preparation = JSON.parse(
      JSON.stringify(
        createCurrentGameSave(
          campaign(branchHeadquarters(), backup, hour),
          reportDate,
        ),
      ),
    );
    preparation.session.campaign.branchArchitecture.backupPrepared = true;
    expect(readCurrentGameSave(JSON.stringify(preparation)).ok).toBe(false);
  });
  it('exports M05 AAR with prior knowledge, architecture preparation, actual flows and residual risk', () => {
    let g: GameSession = startBranch(prepareBranch(branchHeadquarters(2)));
    g = job(g, { type: 'confirm-branch-requirements' });
    g = advance(g, 3);
    g = job(g, { type: 'inspect-branch-gateway-logs' });
    const known = selectPlayerView(simulation(g)).branch;
    g = job(g, {
      type: 'set-branch-account-restriction',
      accountId: 'east-documents',
      restricted: true,
    });
    g = finish(g);
    const result = createAfterActionReport(g, undefined, reportDate);
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const aar = result.value,
      r = selectBranchReport(simulation(g))!;
    expect(aar.scenario.family).toBe('M05');
    expect(aar.scenario.variantFamilyId).toBe('nexus-east-branch-v1');
    expect(aar.gameVersion.engine).toBe('14.0.0');
    expect(aar.securityConsequences.branchAccess).toEqual(r);
    expect(aar.finalOutcome.allObjectivesMet).toBe(true);
    expect(aar.finalOutcome.containmentMet).toBe(true);
    expect(validateAfterActionReport(aar).ok).toBe(true);
    const decision = aar.playerDecisions.find(
      (d) => d.action.type === 'set-branch-account-restriction',
    )!;
    expect(decision.knownAtDecision.configuration.branchAccess).toEqual(known);
    expect(JSON.stringify(known)).not.toContain('compromised-context');
    expect(JSON.stringify(known)).not.toContain('origin');
    expect(decision.actualStateAtDecision.branchAccess).toMatchObject({
      compromisedContextId: 'EAST-DOC',
    });
    expect(decision.expectedEffect).toBe(null);
    expect(aar.campaignContext?.branchWork).toHaveLength(4);
    const md = renderAfterActionMarkdown(aar);
    expect(md).toContain('Misja 05 — architektura');
    expect(md).toContain('Przygotowanie architektury EAST');
    const hq = campaign(g as StrategicSession, { type: 'return-headquarters' });
    expect(
      createAfterActionReport(
        hq,
        campaignAarMissionId(hq.attemptId, 5),
        reportDate,
      ),
    ).toEqual(result);
  });
  it('reports legal broad SMB as exposure and unused capability, not an invented incident or counterfactual', () => {
    const g = finish(startBranch(prepareBranch(branchHeadquarters(1), 'all')));
    const result = createAfterActionReport(g, undefined, reportDate);
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.value.finalOutcome.allObjectivesMet).toBe(true);
    expect(result.value.finalOutcome.containmentMet).toBe(null);
    expect(result.value.securityConsequences.branchAccess).toMatchObject({
      exposedRecords: 0,
      unnecessaryFileAccess: ['east-operator'],
    });
  });
});
