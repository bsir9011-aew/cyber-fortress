import { describe, it, expect } from 'vitest';
import type { BranchArchitecture } from '../domain/branch';
import type { SimulationState } from '../domain/simulation';
import {
  BRANCH_FAMILY_ID as family,
  defaultBranchArchitecture,
  selectBranchScenario,
} from '../content/scenarios/branch';
import {
  createScenario,
  validateScenario,
} from '../application/createScenario';
import { selectPlayerView } from '../application/selectPlayerView';
import {
  selectBranchReport,
  branchOutcome,
} from '../application/selectBranchReport';
import { businessAvailability } from './business';
import {
  assessBranchAccess,
  branchWorkAvailability,
  branchTransportAvailable,
} from './branchAccess';
import { taskRejection } from './tasks';
import { advance, job, order, finish } from '../testSupport/resilience';
const architecture = (
  changes: Partial<BranchArchitecture> = {},
): BranchArchitecture => ({
  ...defaultBranchArchitecture,
  erpEnabled: true,
  monitoring: true,
  ...changes,
});
const start = (seed = 0, changes: Partial<BranchArchitecture> = {}) =>
  createScenario(selectBranchScenario(family, seed, architecture(changes)), {
    mode: 'unknown',
    seed,
  });
const offline = (s: SimulationState, id: string): SimulationState => ({
  ...s,
  world: {
    ...s.world,
    assets: s.world.assets.map((a) =>
      a.id === id ? { ...a, status: 'offline' } : a,
    ),
  },
});
const check = { type: 'inspect-branch-links' } as const;
const logs = { type: 'inspect-branch-gateway-logs' } as const;
const repair = { type: 'repair-branch-link' } as const;
const backup = { type: 'activate-branch-route', route: 'backup' } as const;
const restrict = {
  type: 'set-branch-account-restriction',
  accountId: 'east-documents',
  restricted: true,
} as const;
describe('EAST site-to-site authorization, without personal VPN sessions', () => {
  it('validates stable new variants and leaves existing personal VPN identities separate', () => {
    for (let seed = 0; seed < 3; seed++)
      expect(
        validateScenario(selectBranchScenario(family, seed, architecture())),
      ).toEqual([]);
    const s = start();
    expect(s.access.sessions.every((v) => !v.id.startsWith('EAST'))).toBe(true);
    expect(s.branch?.tunnel.id).toBe('EAST-S2S');
    expect(s.hidden.attacker).toBe(null);
  });
  it('enforces ERP commissioning, resource grants, scoped ACL and held identity independently', () => {
    const s = start(1, { smbScope: 'documents' });
    expect(assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed).toBe(
      true,
    );
    expect(assessBranchAccess(s, 'EAST-OP', 'fs-01', 'SMB').allowed).toBe(
      false,
    );
    expect(
      assessBranchAccess(
        start(1, { erpEnabled: false, smbScope: 'all' }),
        'EAST-OP',
        'erp',
        'HTTPS',
      ).allowed,
    ).toBe(false);
    expect(branchTransportAvailable(offline(s, 'erp'), 'primary')).toBe(true);
    expect(
      assessBranchAccess(offline(s, 'erp'), 'EAST-OP', 'erp', 'HTTPS').allowed,
    ).toBe(false);
    const noGrant = {
      ...s,
      access: {
        ...s.access,
        permissions: s.access.permissions.filter(
          (p) => p.accountId !== 'east-documents' || p.protocol !== 'SMB',
        ),
      },
    };
    expect(
      assessBranchAccess(noGrant, 'EAST-DOC', 'fs-01', 'SMB'),
    ).toMatchObject({
      networkAllowed: true,
      permissionAllowed: false,
      reachedService: true,
      allowed: false,
    });
    const denied = {
      ...s,
      access: {
        ...s.access,
        rules: s.access.rules.map((r) =>
          r.id === 'EAST-SMB' ? { ...r, action: 'deny' as const } : r,
        ),
      },
    };
    expect(
      assessBranchAccess(denied, 'EAST-DOC', 'fs-01', 'SMB'),
    ).toMatchObject({
      permissionAllowed: true,
      networkAllowed: false,
      reachedService: false,
      allowed: false,
    });
    expect(
      assessBranchAccess(
        {
          ...s,
          branch: {
            ...s.branch!,
            tunnel: { ...s.branch!.tunnel, authenticated: false },
          },
        },
        'EAST-DOC',
        'fs-01',
        'SMB',
      ).allowed,
    ).toBe(false);
    expect(
      assessBranchAccess(
        {
          ...s,
          branch: {
            ...s.branch!,
            contexts: s.branch!.contexts.map((c) => ({
              ...c,
              authenticated: false,
            })),
          },
        },
        'EAST-DOC',
        'fs-01',
        'SMB',
      ).allowed,
    ).toBe(false);
  });
  it('SMB all explicitly broadens grants; allow alone never creates a grant', () => {
    const broad = start(1, { smbScope: 'all' });
    expect(assessBranchAccess(broad, 'EAST-OP', 'fs-01', 'SMB').allowed).toBe(
      true,
    );
    const narrow = start(1, { smbScope: 'documents' });
    const aclOnly = {
      ...narrow,
      access: {
        ...narrow.access,
        rules: narrow.access.rules.map((r) =>
          r.id === 'EAST-SMB'
            ? { ...r, accountIds: ['east-operator', 'east-documents'] }
            : r,
        ),
      },
    };
    expect(
      assessBranchAccess(aclOnly, 'EAST-OP', 'fs-01', 'SMB'),
    ).toMatchObject({
      networkAllowed: true,
      permissionAllowed: false,
      allowed: false,
    });
  });
  it('can reapply the declared SMB scope after a manual ACL change, with a timed real effect', () => {
    let s = job(start(2), {
      type: 'set-network-rule',
      ruleId: 'EAST-SMB',
      action: 'allow',
    });
    expect(assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed).toBe(
      true,
    );
    expect(selectPlayerView(s).branch?.smbConfigurationMatches).toBe(false);
    s = order(s, { type: 'set-branch-smb-scope', scope: 'none' });
    s = advance(s);
    expect(assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed).toBe(
      true,
    );
    s = advance(s);
    expect(assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed).toBe(
      false,
    );
    expect(selectPlayerView(s).branch?.smbConfigurationMatches).toBe(true);
  });
  it('prepared backup has its own authentication and infrastructure, only HTTPS, and at most 3 capacity', () => {
    expect(taskRejection(start(), 'administrator', backup)).toBe(
      'invalid-state',
    );
    const s = job(start(0, { backupPrepared: true, smbScope: 'all' }), backup);
    expect(branchWorkAvailability(s).capacity).toBe(3);
    expect(businessAvailability(s).capacity).toBe(19);
    expect(assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB')).toMatchObject({
      topologyExists: false,
      allowed: false,
    });
    expect(
      assessBranchAccess(
        offline(s, 'east-backup-gateway'),
        'EAST-OP',
        'erp',
        'HTTPS',
      ).allowed,
    ).toBe(false);
    expect(
      assessBranchAccess(
        { ...s, branch: { ...s.branch!, backupAuthenticated: false } },
        'EAST-OP',
        'erp',
        'HTTPS',
      ).allowed,
    ).toBe(false);
    expect(
      assessBranchAccess(
        { ...s, branch: { ...s.branch!, backupAuthorized: false } },
        'EAST-OP',
        'erp',
        'HTTPS',
      ).allowed,
    ).toBe(false);
    expect(
      assessBranchAccess(
        { ...s, access: { ...s.access, permissions: [] } },
        'EAST-OP',
        'erp',
        'HTTPS',
      ).allowed,
    ).toBe(false);
  });
  it('documents require their actual path and account; backup HTTPS does not replace them', () => {
    let s = advance(start(1, { smbScope: 'none', backupPrepared: true }), 2);
    expect(branchWorkAvailability(s).capacity).toBe(2);
    expect(businessAvailability(s).capacity).toBe(18);
    s = job(s, { type: 'set-branch-smb-scope', scope: 'documents' });
    expect(branchWorkAvailability(s).capacity).toBe(6);
    s = job(s, backup);
    expect(branchWorkAvailability(s).capacity).toBe(2);
    const r = selectBranchReport(finish(s))!;
    expect(r.ready).toBe(false);
    expect(r.goalMet).toBe(false);
  });
  it('does not apply personal VPN segmentation to an independent branch path', () => {
    const s = start(1, { smbScope: 'documents' });
    const denied = {
      ...s,
      access: {
        ...s.access,
        sessions: [],
        rules: s.access.rules.map((r) =>
          r.sourceAssetId === 'vpn' ? { ...r, action: 'deny' as const } : r,
        ),
      },
    };
    expect(assessBranchAccess(denied, 'EAST-DOC', 'fs-01', 'SMB').allowed).toBe(
      true,
    );
    expect(branchWorkAvailability(denied).capacity).toBe(6);
  });
});
describe('EAST operational effects and actual exposure', () => {
  it('breaks only the primary physical link at 14:20, after settlement, and never self-repairs', () => {
    let s = advance(start(), 3);
    expect(businessAvailability(s).capacity).toBe(22);
    s = advance(s);
    expect(s.business.lastReport?.capacity).toBe(22);
    expect(businessAvailability(s).capacity).toBe(16);
    expect(s.world.assets.find((a) => a.id === 'erp')?.status).toBe('online');
    expect(
      assessBranchAccess(s, 'EAST-OP', 'erp', 'HTTPS').infrastructureAvailable,
    ).toBe(false);
    s = advance(s, 5);
    expect(businessAvailability(s).capacity).toBe(16);
    expect(
      s.branch?.events.filter((e) => e.kind === 'link-failed'),
    ).toHaveLength(1);
  });
  it('switches only after its task and repairs separately from selecting the primary route', () => {
    let s = advance(start(0, { backupPrepared: true }), 4);
    s = order(s, backup);
    expect(s.branch?.activeRoute).toBe('primary');
    s = advance(s);
    expect(s.branch?.activeRoute).toBe('backup');
    expect(s.business.lastReport?.capacity).toBe(16);
    s = job(s, check);
    s = order(s, repair);
    s = advance(s, 2);
    expect(
      s.world.assets.find((a) => a.id === 'east-primary-link')?.status,
    ).toBe('offline');
    s = advance(s);
    expect(
      s.world.assets.find((a) => a.id === 'east-primary-link')?.status,
    ).toBe('online');
    expect(s.branch?.activeRoute).toBe('backup');
    expect(businessAvailability(s).capacity).toBe(19);
    s = job(s, { type: 'activate-branch-route', route: 'primary' });
    expect(businessAvailability(s).capacity).toBe(22);
    expect(selectBranchReport(finish(s))?.goalMet).toBe(true);
  });
  it('repair does not cure another device, an unrepairable fault, ACL or an unprepared backup', () => {
    let s = job(advance(start(), 4), check);
    s = {
      ...s,
      hidden: {
        ...s.hidden,
        scenario: {
          ...s.hidden.scenario,
          branch: { ...s.hidden.scenario.branch!, repairable: false },
        },
      },
    };
    s = job(s, repair);
    expect(s.branch?.results.at(-1)?.outcome).toBe('failed');
    expect(businessAvailability(s).capacity).toBe(16);
    let other = job(advance(start(), 4), check);
    other = offline(other, 'east-gateway');
    other = job(other, repair);
    expect(businessAvailability(other).capacity).toBe(16);
    expect(other.branch?.architecture.backupPrepared).toBe(false);
  });
  it('there is no universally successful fixed SMB policy: documents are needed in B, but their held context is abused in C', () => {
    const noneB = selectBranchReport(finish(start(1)))!,
      narrowB = selectBranchReport(
        finish(start(1, { smbScope: 'documents' })),
      )!,
      narrowC = selectBranchReport(
        finish(start(2, { smbScope: 'documents' })),
      )!,
      noneC = selectBranchReport(finish(start(2)))!;
    expect(noneB.goalMet).toBe(false);
    expect(narrowB.goalMet).toBe(true);
    expect(narrowB.exposedRecords).toBe(0);
    expect(narrowC.exposedRecords).toBeGreaterThan(0);
    expect(narrowC.goalMet).toBe(false);
    expect(noneC.goalMet).toBe(true);
  });
  it('preserves proper business conservation and never adds capacity beyond 22', () => {
    const s = finish(start(1, { smbScope: 'all' }));
    expect(s.business.totalReceived).toBe(360);
    expect(s.business.totalProcessed + s.business.backlog).toBe(360);
    for (const e of s.history)
      if (e.kind === 'business-report') {
        expect(e.report.capacity).toBeLessThanOrEqual(22);
        expect(e.report.processed).toBeLessThanOrEqual(e.report.capacity);
      }
  });
  it('current SMB restriction blocks even an authenticated compromised context, preserves ERP and login/MFA, and restoring it restores risk', () => {
    let s = advance(start(2, { smbScope: 'documents' }), 4);
    const accounts = s.access.accounts,
      sessions = s.access.sessions;
    s = job(s, restrict);
    expect(s.access.accounts).toEqual(accounts);
    expect(s.access.sessions).toEqual(sessions);
    expect(assessBranchAccess(s, 'EAST-DOC', 'erp', 'HTTPS').allowed).toBe(
      true,
    );
    expect(assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed).toBe(
      false,
    );
    expect(branchOutcome(advance(s, 3)).exposedRecords).toBe(0);
    s = job(s, { ...restrict, restricted: false });
    expect(branchOutcome(s).exposedRecords).toBe(200);
    expect(branchOutcome(s).remainingAccess).toBe(true);
  });
  it('a personal account block or reset does not revoke an already issued local context', () => {
    let s = start(2, { smbScope: 'documents' });

    s = job(s, { type: 'block-account', accountId: 'east-documents' });
    s = job(s, { type: 'reset-credential', accountId: 'east-documents' });
    expect(assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed).toBe(
      true,
    );
  });
  it('obeys workers, deadlines, targets and precommissioned resources', () => {
    let s = order(start(), check);
    expect(taskRejection(s, 'analyst', logs)).toBe('worker-busy');
    expect(taskRejection(s, 'administrator', logs)).toBe('wrong-worker');
    expect(taskRejection(start(), 'administrator', repair)).toBe(
      'target-not-observed',
    );
    expect(
      taskRejection(start(), 'administrator', {
        ...restrict,
        accountId: 'dispatch-team',
      }),
    ).toBe('unknown-target');
    expect(taskRejection(advance(s, 16), 'administrator', repair)).toBe(
      'outside-time-window',
    );
  });
});
describe('EAST observability and server audit scope', () => {
  it('records no gateway telemetry without commissioning; observes only acquired immutable metadata with coverage and no encrypted payload', () => {
    const noSensor = advance(
      start(2, { smbScope: 'all', monitoring: false }),
      8,
    );
    expect(noSensor.branch?.gatewayRecords).toEqual([]);
    expect(noSensor.branch?.operations.length).toBeGreaterThan(0);
    expect(taskRejection(noSensor, 'analyst', logs)).toBe('source-unavailable');
    let s = job(advance(start(2, { smbScope: 'documents' }), 4), logs);
    const observation = s.branch!.observations[0]!;
    expect(observation.records.some((r) => r.protocol === 'SMB')).toBe(true);
    expect(JSON.stringify(observation)).not.toContain('origin');
    expect(JSON.stringify(observation)).not.toContain('recordsRead');
    expect(JSON.stringify(observation)).not.toContain('compromised');
    s = advance(s, 3);
    expect(s.branch?.observations[0]).toEqual(observation);
    expect(
      observation.records.every((r) => r.minute <= observation.minute),
    ).toBe(true);
    let late = start(1, { smbScope: 'documents' });
    late = {
      ...late,
      branch: {
        ...late.branch!,
        sensor: { ...late.branch!.sensor, coverageFromMinute: 900 },
      },
    };
    late = advance(late, 8);
    expect(late.branch?.gatewayRecords).toEqual([]);
  });
  it('FS-01 audit sees only requests reaching the server, distinguishes service denial from gateway forwarding, and retains its delay', () => {
    function audited(scope: 'documents' | 'none') {
      const s = start(1, { smbScope: scope });
      return {
        ...s,
        telemetry: {
          ...s.telemetry,
          fileAudit: {
            sensor: {
              id: 'fs-01-audit',
              sourceAssetId: 'fs-01',
              enabled: true,
              coverageFromMinute: 840,
              retentionMinutes: 120,
              delayMinutes: 5,
            },
            sourceEvents: [],
            records: [],
            processedSourceCount: 0,
          },
        },
      };
    }
    let s = advance(audited('documents'), 3);
    expect(
      s.telemetry.fileAudit?.sourceEvents.some(
        (e) =>
          e.accountId === 'east-documents' &&
          e.sessionId === null &&
          e.endpointId === 'EAST-DOC',
      ),
    ).toBe(true);
    expect(
      advance(audited('none'), 3).telemetry.fileAudit?.sourceEvents,
    ).toEqual([]);
    s = {
      ...s,
      access: {
        ...s.access,
        permissions: s.access.permissions.filter(
          (p) => p.accountId !== 'east-documents' || p.protocol !== 'SMB',
        ),
      },
    };
    s = advance(s);
    expect(
      s.branch?.gatewayRecords.filter((r) => r.protocol === 'SMB').at(-1)
        ?.outcome,
    ).toBe('allowed');
    expect(s.telemetry.fileAudit?.sourceEvents.at(-1)?.outcome).toBe('denied');
    s = job(s, { type: 'inspect-file-access' });
    const o = s.knowledge.fileObservations!.at(-1)!;
    expect(
      o.records.every((r) => r.availableAtMinute <= o.observedAtMinute),
    ).toBe(true);
    expect(o.records.some((r) => r.minute === o.observedAtMinute)).toBe(false);
  });
  it('initial public views do not reveal the private variant, and report truth is withheld until finish', () => {
    const views = [0, 1, 2].map((seed) => {
      const v = selectPlayerView(start(seed));
      return { ...v, run: { ...v.run, seed: 0 } };
    });
    expect(views[0]).toEqual(views[1]);
    expect(views[1]).toEqual(views[2]);
    expect(selectBranchReport(start(2))).toBe(null);
    const s = advance(start(), 4);
    expect(
      selectPlayerView(s).world.assets.find((a) => a.id === 'east-primary-link')
        ?.status,
    ).toBe('unknown');
    expect(
      selectPlayerView(job(s, check)).world.assets.find(
        (a) => a.id === 'east-primary-link',
      )?.status,
    ).toBe('offline');
  });
  it('diagnostics and monitoring are observations, not automatic blocking', () => {
    let s = start(2, { smbScope: 'documents' });
    s = job(s, { type: 'confirm-branch-requirements' });
    s = job(s, check);
    s = job(s, logs);
    s = advance(s, 4);
    expect(branchOutcome(s).exposedRecords).toBeGreaterThan(0);
    expect(
      s.branch?.observations.find((o) => o.source === 'NEXUS EAST operations')
        ?.assertion,
    ).toBe('human-statement');
  });
});
