import { CURRENT_GAME_SAVE_KEY } from '../persistence/gameSaveV7';
import { describe, expect, it } from 'vitest';
import { createStrategicSession, currentOperation } from './gameSession';
import type { StrategicSession } from './gameSession';
import {
  campaign,
  prepare,
  startM02,
  finish,
  advance,
  job,
  order,
  simulation,
  sessionDate,
  reportDate,
} from '../testSupport/aar';
import {
  createCampaign,
  campaignReducer,
  budgetBalance,
} from './campaignReducer';
import type { CampaignCommand } from '../domain/campaign';
import {
  selectVendorScenario,
  VENDOR_FAMILY_ID,
} from '../content/scenarios/vendor';
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
} from '../persistence/gameSaveV6';
import {
  createCurrentGameSave as saveV5,
  readCurrentGameSave as readV5,
  CURRENT_GAME_SAVE_KEY as V5_KEY,
} from '../persistence/gameSaveV5';
import {
  loadCurrentGameState,
  storeCurrentGameState,
} from '../persistence/resilienceGameStorage';
import { selectVendorReport } from './selectVendorReport';
import { selectVendorView } from './selectVendorView';
import { selectPlayerView } from './selectPlayerView';
const start: CampaignCommand = {
  type: 'start-vendor-incident',
  familyId: VENDOR_FAMILY_ID,
};
const grant: CampaignCommand = {
  type: 'prepare-vendor-exception',
  scope: 'api-only',
  expiresAtMinute: 930,
};
function headquarters(variant = 'documents') {
  const seed = [0, 1, 2].find(
    (seed) =>
      selectVendorScenario(VENDOR_FAMILY_ID, seed + 2).id ===
      `nexus-vendor-${variant}`,
  )!;
  let s = createStrategicSession('vendor-campaign', sessionDate, seed);
  s = campaign(
    finish(
      campaign(prepare(s), { type: 'start-incident' }),
    ) as StrategicSession,
    { type: 'return-headquarters' },
  );
  return campaign(finish(startM02(s)) as StrategicSession, {
    type: 'return-headquarters',
  });
}
function launch(
  variant = 'documents',
  scope: 'api-only' | 'api-and-files' = 'api-only',
) {
  const s = campaign(
    headquarters(variant),
    { type: 'prepare-vendor-exception', scope, expiresAtMinute: 930 },
    { type: 'advance-preparation' },
  );
  return campaign(prepare(s), start);
}
function roundtrip(s: StrategicSession) {
  const encoded = serializeCurrentGameSave(
    createCurrentGameSave(s, reportDate),
  );
  expect(encoded.ok, encoded.ok ? '' : encoded.error).toBe(true);
  if (!encoded.ok) throw Error(encoded.error);
  const loaded = readCurrentGameSave(encoded.value);
  if (!loaded.ok || loaded.value.session.kind !== 'campaign')
    throw Error('Roundtrip failed');
  return loaded.value.session;
}
describe('one-mission supplier approval', () => {
  it('requires completed M02, takes a real administrator hour, is free and does not add a project/funding', () => {
    expect(
      campaignReducer(createCampaign(), grant).decisions.at(-1)!.result,
    ).toBe('rejected');
    let s = headquarters();
    const budget = budgetBalance(s.campaign),
      projects = s.campaign.projects;
    s = campaign(s, grant);
    expect(s.campaign.vendorApprovals![0]!.completedHour).toBeNull();
    expect(s.campaign.preparation.hour).toBe(0);
    expect(s.campaign.incident).toBeNull();
    expect(roundtrip(s)).toEqual(s);
    s = campaign(
      s,
      { type: 'plan-project', projectId: 'remote-access' },
      { type: 'reserve-project', projectId: 'remote-access' },
      {
        type: 'assign-work',
        projectId: 'remote-access',
        workerId: 'administrator',
      },
    );
    expect(s.campaign.decisions.at(-1)!.result).toBe('rejected');
    // Rejected concurrent work did not pay; undo the reversible project reservation before comparison.
    s = campaign(
      s,
      { type: 'cancel-project', projectId: 'remote-access' },
      { type: 'advance-preparation' },
    );
    expect(s.campaign.vendorApprovals![0]!.completedHour).toBe(1);
    expect(budgetBalance(s.campaign)).toEqual(budget);
    expect(s.campaign.projects).toEqual(projects);
    expect(s.campaign.funding).toBeUndefined();
    s = campaign(prepare(s), start);
    expect(s.campaign.vendorApprovals![0]!.usedInWindow).toBe(3);
    expect(
      s.campaign.incident!.access.vendorAuthorization!.exception!.approvalId,
    ).toBe('CARGO-APPROVAL-1');
  });
  it('rejects a busy administrator and invalid or redundant preparation; an analyst can work in parallel', () => {
    let s = campaign(
      headquarters(),
      { type: 'plan-project', projectId: 'file-visibility' },
      { type: 'reserve-project', projectId: 'file-visibility' },
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'administrator',
      },
    );
    expect(campaign(s, grant).campaign.decisions.at(-1)!.result).toBe(
      'rejected',
    );
    s = campaign(
      headquarters(),
      grant,
      { type: 'plan-project', projectId: 'file-visibility' },
      { type: 'reserve-project', projectId: 'file-visibility' },
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'analyst',
      },
    );
    expect(s.campaign.decisions.at(-1)!.result).toBe('applied');
    expect(campaign(s, grant).campaign.vendorApprovals).toHaveLength(1);
    expect(
      campaign(prepare(headquarters()), grant).campaign.decisions.at(-1)!
        .result,
    ).toBe('rejected');
    for (const c of [
      { ...grant, scope: 'all' },
      { ...grant, expiresAtMinute: 890 },
    ])
      expect(
        campaign(headquarters(), c as CampaignCommand).campaign.decisions.at(
          -1,
        )!.result,
      ).toBe('rejected');
  });
  it('preserves approval history but consumes grants once; unrelated missions do not activate or perpetuate them', () => {
    let s = finish(launch('standard')) as StrategicSession;
    expect(
      selectVendorReport(s.campaign.incident!)!.summary.activeSessionCount,
    ).toBe(1);
    s = campaign(s, { type: 'return-headquarters' });
    expect(s.campaign.vendorApprovals![0]!.usedInWindow).toBe(3);
    s = campaign(prepare(s), start);
    expect(
      s.campaign.incident!.access.vendorAuthorization!.exception,
    ).toBeNull();
    expect(roundtrip(s)).toEqual(s);
    const unused = campaign(
      prepare(campaign(headquarters('standard'), grant)),
      { type: 'start-incident' },
    );
    expect(unused.campaign.incident!.vendor).toBeUndefined();
    const next = campaign(
      prepare(
        campaign(finish(unused) as StrategicSession, {
          type: 'return-headquarters',
        }),
      ),
      start,
    );
    expect(
      next.campaign.incident!.access.vendorAuthorization!.exception,
    ).toBeNull();
  });
  it('allows start without a grant, but only after M02 and the complete preparation window', () => {
    expect(campaign(headquarters(), start).campaign.phase).toBe('preparation');
    const s = campaign(prepare(headquarters()), start);
    expect(s.campaign.phase).toBe('incident');
    expect(s.campaign.incident!.vendor).toBeDefined();
    expect(
      s.campaign.incident!.access.vendorAuthorization!.exception,
    ).toBeNull();
    expect(
      (finish(s) as StrategicSession).campaign.incident!.business.backlog,
    ).toBe(72);
  });
});
describe('V6 replay and AAR for a distinct third mission family', () => {
  it('replays a pending reaction, observations and the remainder identically', () => {
    let g = job(launch(), { type: 'inspect-vendor-operations' });
    g = order(g, {
      type: 'expand-vendor-exception',
      approvalId: 'CARGO-APPROVAL-1',
    });
    const s = g as StrategicSession;
    expect(currentOperation(s)!.commands).toHaveLength(3);
    expect(roundtrip(s)).toEqual(s);
    expect(finish(roundtrip(s))).toEqual(finish(s));
    const tampered = JSON.parse(
      JSON.stringify(createCurrentGameSave(s, reportDate)),
    );
    tampered.session.campaign.incident.access.vendorAuthorization.exception.expiresAtMinute = 900;
    expect(readCurrentGameSave(JSON.stringify(tampered)).ok).toBe(false);
  });
  it('reads a genuine V5 command contract without changing its world and keeps original localStorage bytes', () => {
    const s = campaign(headquarters(), { type: 'start-integrity-incident' }); // rejected outside prep closure is still a valid historical journal entry.
    const text = JSON.stringify(saveV5(s, reportDate));
    expect(readV5(text).ok).toBe(true);
    const imported = readCurrentGameSave(text);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.session).toEqual(s);
    expect(imported.value.schemaVersion).toBe(6);
    const data = new Map([[V5_KEY, text]]),
      storage = {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => {
          data.set(k, v);
        },
        removeItem: (k: string) => {
          data.delete(k);
        },
      };
    expect(loadCurrentGameState(storage).fifthRaw).toBe(text);
    expect(storeCurrentGameState(storage, launch(), reportDate).ok).toBe(true);
    expect(data.get(V5_KEY)).toBe(text);
    expect(data.has(CURRENT_GAME_SAVE_KEY)).toBe(true);
    data.set(CURRENT_GAME_SAVE_KEY, '{}');
    expect(loadCurrentGameState(storage).result.ok).toBe(false);
    expect(data.get(V5_KEY)).toBe(text);
  });
  it.each([
    { ...start, familyId: 'unknown' },
    { ...start, extra: true },
    { ...grant, scope: 'all' },
    { ...grant, expiresAtMinute: 870.5 },
    { ...grant, expiresAtMinute: '870' },
    {
      type: 'incident-command',
      command: {
        type: 'schedule-task',
        workerId: 'analyst',
        action: {
          type: 'revoke-vendor-exception',
          approvalId: 'CARGO-APPROVAL-1',
        },
      },
    },
    {
      type: 'incident-command',
      command: {
        type: 'schedule-task',
        workerId: 'administrator',
        action: { type: 'expand-vendor-exception', approvalId: 'missing' },
      },
    },
  ])('rejects malformed versioned command %j', (c) =>
    expect(isCurrentCampaignCommand(c)).toBe(false),
  );
  it('accepts only the exact new action fields; V5 cannot masquerade as a journal of M03', () => {
    expect(isCurrentCampaignCommand(grant)).toBe(true);
    expect(isCurrentCampaignCommand(start)).toBe(true);
    expect(
      isCurrentRecordedCommand({
        type: 'schedule-task',
        workerId: 'analyst',
        action: { type: 'inspect-vendor-operations' },
      }),
    ).toBe(true);
    expect(
      isCurrentRecordedCommand({
        type: 'schedule-task',
        workerId: 'analyst',
        action: { type: 'inspect-vendor-operations', actor: 'attacker' },
      }),
    ).toBe(false);
    const save = createCurrentGameSave(launch(), reportDate);
    expect(
      readV5(
        JSON.stringify({
          ...save,
          schemaVersion: 5,
          engineVersion: '11.0.0',
          contentVersion: 'nexus-detection-1',
        }),
      ).ok,
    ).toBe(false);
  });
  it('exports observed decisions, real access changes, classified operations and business consequences as M03', () => {
    let g = job(launch(), { type: 'inspect-vendor-operations' });
    const known = selectVendorView(simulation(g))!.observations[0]!;
    g = job(g, {
      type: 'expand-vendor-exception',
      approvalId: 'CARGO-APPROVAL-1',
    });
    const done = finish(g);
    const result = createAfterActionReport(done, undefined, reportDate);
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const r = result.value;
    expect(r.scenario.family).toBe('M03');
    expect(r.scenario.variantFamilyId).toBe(VENDOR_FAMILY_ID);
    expect(r.gameVersion.engine).toBe('12.0.0');
    expect(r.campaignContext!.vendorApprovals![0]).toMatchObject({
      id: 'CARGO-APPROVAL-1',
      completedHour: 1,
    });
    const decision = r.playerDecisions.find(
      (d) => d.action.type === 'expand-vendor-exception',
    )!;
    expect(decision.issuedAt.minute).toBe(845);
    expect(decision.completedAt!.minute).toBe(855);
    expect(decision.knownAtDecision.evidenceIds).toContain('K-T-0001-vendor');
    expect(JSON.stringify(decision.knownAtDecision)).not.toContain(
      'requiresFiles',
    );
    expect(JSON.stringify(decision.knownAtDecision)).not.toContain('origin');
    const evidence = r.knownEvidence.find((e) => e.id === 'K-T-0001-vendor')!;
    expect(evidence.details).toEqual(known);
    expect(r.securityConsequences.vendorAccess).toEqual(
      selectVendorReport(simulation(done)),
    );
    expect(r.finalOutcome.vendorWorkMet).toBe(true);
    expect(r.finalOutcome.allObjectivesMet).toBe(true);
    expect(r.businessConsequences.finalBacklog).toBe(0);
    expect(validateAfterActionReport(r).ok).toBe(true);
    expect(renderAfterActionMarkdown(r)).toContain('Misja 03');
    expect(createAfterActionReport(launch(), undefined, reportDate).ok).toBe(
      false,
    );
    const later = campaign(
      done as StrategicSession,
      { type: 'return-headquarters' },
      grant,
      { type: 'advance-preparation' },
    );
    const previous = createAfterActionReport(
      later,
      campaignAarMissionId(later.attemptId, 3),
      reportDate,
    );
    expect(previous.ok).toBe(true);
    if (previous.ok) expect(previous.value).toEqual(r);
  });
  it('unknown variant choice stays fixed when the defender changes scope; active UI omits private truth', () => {
    const narrow = launch('abuse', 'api-only'),
      wide = launch('abuse', 'api-and-files');
    expect(narrow.campaign.incident!.hidden.scenario.id).toBe(
      wide.campaign.incident!.hidden.scenario.id,
    );
    expect(narrow.campaign.incident!.hidden.attacker!.definition).toEqual(
      wide.campaign.incident!.hidden.attacker!.definition,
    );
    const view = selectPlayerView(simulation(advance(narrow, 3)));
    expect(JSON.stringify(view)).not.toContain('nexus-vendor-abuse');
    expect(JSON.stringify(view)).not.toContain('stolenCredentialVersion');
    expect(JSON.stringify(view)).not.toContain('origin');
  });
});
