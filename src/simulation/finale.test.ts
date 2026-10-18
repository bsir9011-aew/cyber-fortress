import { testBackupProcedure } from './backupReadiness';
import { integrityScenario } from '../content/scenarios/integrity';
import { integrityTaskTurns } from './integrity';
import { assessThreatAccess } from './threatAssessment';
import { describe, expect, it } from 'vitest';
import { createFinaleIncident } from '../application/prepareCampaignIncident';
import { createCampaign } from '../application/campaignReducer';
import { simulationReducer } from '../application/simulationReducer';
import { selectPlayerView } from '../application/selectPlayerView';
import { selectMissionReport } from '../application/selectMissionReport';
import { selectFinaleReport } from '../application/selectFinaleReport';
import { selectFinaleTimeline } from './finaleTimeline';
import { businessAvailability } from './business';
import { assessBranchAccess } from './branchAccess';
import { canUseLocalService, canUseService } from './access';
import { taskRejection, taskSpecs } from './tasks';
import { pendingErpOrderIds } from './recoveryAccess';
import { pilotEndpointCoverage } from '../content/endpointCoverage';
import type {
  SimulationState,
  TaskAction,
  SimulationCommand,
} from '../domain/simulation';
import type { SecurityPosture } from '../domain/campaign';
import type { BranchArchitecture } from '../domain/branch';
export const architecture: BranchArchitecture = {
  erpEnabled: true,
  smbScope: 'documents',
  backupPrepared: true,
  monitoring: true,
  restrictedAccountIds: [],
};
export const posture: SecurityPosture = { ...createCampaign().posture };
export const make = (
  seed = 0,
  p = posture,
  a = architecture,
  scope: 'api-only' | 'api-and-files' = 'api-only',
) =>
  createFinaleIncident(seed, p, 'nexus-campaign-finale-v1', a, {
    id: 'FIN-PREP',
    window: 6,
    startHour: 0,
    completedHour: 1,
    usedInWindow: null,
    scope,
    expiresAtMinute: 930,
  });
const advance = (s: SimulationState, n = 1) => {
  for (let k = 0; k < n; k++)
    s = simulationReducer(s, { type: 'advance-turn' });
  return s;
};
const finish = (s: SimulationState) => advance(s, 18 - s.clock.turn);
const schedule = (s: SimulationState, a: TaskAction) => {
  const c: SimulationCommand = {
    type: 'schedule-task',
    workerId: taskSpecs[a.type].workerId,
    action: a,
  };
  const n = simulationReducer(s, c);
  expect(n.tasks.length, `${a.type}: ${JSON.stringify(n.history.at(-1))}`).toBe(
    s.tasks.length + 1,
  );
  return n;
};
export function crossfireSuccess(s = make()) {
  s = schedule(s, { type: 'examine-endpoint', endpointId: 'pakowanie-03' });
  s = advance(s, 2);
  s = schedule(s, { type: 'isolate-endpoint', endpointId: 'pakowanie-03' });
  s = schedule(s, { type: 'inspect-backups' });
  s = advance(s);
  s = schedule(s, { type: 'restart-erp-service' });
  s = schedule(s, { type: 'verify-backup', backupId: 'FS-1350' });
  s = advance(s, 2);
  s = schedule(s, { type: 'restore-documents', backupId: 'FS-1350' });
  s = schedule(s, { type: 'inspect-erp-consistency' });
  s = advance(s, 3);
  s = schedule(s, {
    type: 'restrict-endpoint-writes',
    endpointId: 'pakowanie-03',
  });
  s = schedule(s, { type: 'inspect-documents' });
  s = advance(s, 2);
  s = schedule(s, { type: 'reconnect-endpoint', endpointId: 'pakowanie-03' });
  return finish(advance(s));
}
export function cascadeSuccess(s = make(2)) {
  s = schedule(s, { type: 'inspect-erp-database' });
  s = advance(s, 2);
  s = schedule(s, { type: 'start-manual-shipping' });
  s = advance(s);
  s = schedule(s, { type: 'switch-erp-standby' });
  s = schedule(s, { type: 'inspect-branch-links' });
  s = advance(s, 3);
  s = schedule(s, { type: 'close-manual-shipping' });
  s = advance(s);
  s = schedule(s, { type: 'repair-branch-link' });
  s = schedule(s, { type: 'reconcile-erp-records' });
  s = advance(s, 3);
  s = schedule(s, { type: 'inspect-erp-consistency' });
  return finish(advance(s, 2));
}
describe('M06 — one deterministic coordinated crisis', () => {
  it.each([0, 1, 2])(
    'composes real domains and preserves the single order ledger, variant %i',
    (seed) => {
      let s = make(seed);
      expect(
        s.integrity && s.recovery && s.vendor && s.branch && s.finale,
      ).toBeTruthy();
      expect(businessAvailability(s).capacity).toBe(22);
      for (let t = 0; t < 18; t++) {
        s = advance(s);
        expect(s.business.totalProcessed + s.business.backlog).toBe(
          s.business.totalReceived,
        );
        expect(s.recovery!.orders).toHaveLength(s.business.totalReceived);
        expect(
          s.recovery!.orders.filter((o) => o.fulfilledBy !== null),
        ).toHaveLength(s.business.totalProcessed);
        expect(s.business.lastReport!.capacity).toBeLessThanOrEqual(22);
      }
    },
  );
  it('has a feasible evidence-led crossfire strategy', () => {
    const s = crossfireSuccess();
    expect(selectFinaleReport(s)).toMatchObject({
      goalMet: true,
      outcome: 'full-success',
      exposedRecords: 0,
    });
  });
  it('has a feasible cascade strategy using manual substitution, independent standby and real EAST repair', () => {
    const s = cascadeSuccess();
    expect(selectFinaleReport(s)).toMatchObject({
      goalMet: true,
      outcome: 'full-success',
      confidenceMet: true,
    });
    expect(s.recovery!.activeInstance).toBe('standby');
    expect(pendingErpOrderIds(s)).toEqual([]);
  });
  it('has a full false-lead strategy without unnecessary containment or recovery verification', () => {
    const s = finish(make(1));
    expect(s.recovery!.verifiedRevision).toBeNull();
    expect(s.integrity!.verifiedRecoveryMinute).toBeNull();
    expect(selectFinaleReport(s)).toMatchObject({
      goalMet: true,
      outcome: 'full-success',
      confidenceMet: true,
      verification: { erpRequired: false, documentsRequired: false },
      documents: { correct: 100 },
      exposedRecords: 0,
    });
    expect(
      s.hidden.attacker!.privateHistory.some(
        (x) => x.outcome === 'access-denied',
      ),
    ).toBe(true);
  });
  it('continues local SMB while the ERP process is stopped', () => {
    let s = advance(make(), 4);
    expect(s.recovery!.primary.processRunning).toBe(false);
    expect(
      s.integrity!.documents.filter((d) => d.status === 'damaged').length,
    ).toBe(40);
    expect(
      canUseLocalService(
        s.world,
        s.access,
        s.integrity!.endpoint,
        'fs-01',
        'SMB',
        'modify',
      ),
    ).toBe(true);
  });
  it('executes both the legal local series and VPN adversary in false-lead', () => {
    const s = advance(make(1, posture, architecture, 'api-and-files'), 6);
    expect(s.integrity!.documents.every((d) => d.status === 'correct')).toBe(
      true,
    );
    expect(s.integrity!.operationRecords.length).toBeGreaterThan(0);
    expect(s.hidden.attacker!.transfer.exposedRecords).toBeGreaterThan(0);
    expect(selectMissionReport(finish(s))!.confidentiality.exposedRecords).toBe(
      2000,
    );
  });
  it('MFA blocks new stolen-credential authentication but not the legal second factor', () => {
    const s = finish(
      make(
        1,
        { ...posture, remoteAccess: true },
        architecture,
        'api-and-files',
      ),
    );
    expect(
      s.hidden.attacker!.privateHistory.every(
        (x) => x.outcome === 'authentication-rejected',
      ),
    ).toBe(true);
    expect(
      s.telemetry.sourceEvents.some(
        (x) =>
          x.reason === 'mfa-required' && x.accountId === 'cargo-link-operator',
      ),
    ).toBe(true);
    expect(s.business.backlog).toBe(0);
  });
  it('never grants a vendor exception implicitly; emergency approval consumes real administrator time', () => {
    let s = createFinaleIncident(
      1,
      posture,
      'nexus-campaign-finale-v1',
      architecture,
    );
    expect(businessAvailability(s).capacity).toBe(19);
    s = schedule(s, {
      type: 'approve-emergency-vendor-access',
      scope: 'api-only',
      expiresAtMinute: 930,
      justification: 'Przewozy w oknie kryzysowym',
    });
    expect(s.access.vendorAuthorization!.exception).toBeNull();
    expect(
      taskRejection(s, 'administrator', {
        type: 'isolate-endpoint',
        endpointId: 'pakowanie-03',
      }),
    ).toBe('worker-busy');
    s = advance(s);
    expect(s.access.vendorAuthorization!.exception).toBeNull();
    s = advance(s);
    expect(s.access.vendorAuthorization!.exception?.validFromMinute).toBe(850);
    expect(businessAvailability(s).capacity).toBe(22);
  });
  it('standby and EAST backup require an actual declared, authorized path; HTTPS does not enable SMB', () => {
    let s = make(2);
    s = schedule(s, { type: 'switch-erp-standby' });
    s = advance(s, 3);
    s = schedule(s, { type: 'activate-branch-route', route: 'backup' });
    s = advance(s);
    expect(
      assessBranchAccess(s, 'EAST-OP', 'erp-standby', 'HTTPS').allowed,
    ).toBe(true);
    expect(assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed).toBe(
      false,
    );
    const before = businessAvailability(s).capacity;
    s = {
      ...s,
      access: {
        ...s.access,
        permissions: s.access.permissions.filter(
          (p) =>
            !(
              p.accountId === 'east-operator' &&
              p.targetAssetId === 'erp-standby'
            ),
        ),
      },
    };
    expect(businessAvailability(s).capacity).toBeLessThan(before);
  });
  it('a working backup link does not restore failed ERP storage; restart and FS restore do not repair it', () => {
    let s = advance(make(2), 3);
    s = schedule(s, { type: 'activate-branch-route', route: 'backup' });
    s = advance(s);
    expect(assessBranchAccess(s, 'EAST-OP', 'erp', 'HTTPS').allowed).toBe(true);
    expect(businessAvailability(s).capacity).toBe(0);
    s = schedule(s, { type: 'restart-erp-service' });
    s = advance(s, 2);
    expect(s.recovery!.results.at(-1)!.outcome).toBe('failed');
    expect(businessAvailability(s).capacity).toBe(0);
  });
  it('one analyst cannot inspect two sources and ERP mutations conflict with reconciliation', () => {
    let s = schedule(make(), { type: 'inspect-documents' });
    expect(taskRejection(s, 'analyst', { type: 'inspect-erp-service' })).toBe(
      'worker-busy',
    );
    s = advance(s, 2);
    s = schedule(s, { type: 'reconcile-erp-records' });
    expect(
      taskRejection(s, 'administrator', { type: 'switch-erp-standby' }),
    ).toBe('invalid-state');
  });
  it('exposes no variant or private operations; initial information is identical for all variants', () => {
    const views = [0, 1, 2].map((n) => selectPlayerView(make(n)));
    expect(views[0]!.finale).toEqual(views[1]!.finale);
    expect(views[1]!.finale).toEqual(views[2]!.finale);
    const v = selectPlayerView(advance(make(2), 3));
    expect(v.world.assets.find((a) => a.id === 'erp-storage')!.status).toBe(
      'unknown',
    );
    expect(
      v.world.assets.find((a) => a.id === 'east-primary-link')!.status,
    ).toBe('unknown');
    expect(JSON.stringify(v.finale)).not.toMatch(
      /cascade|faultInjected|origin|privateHistory/,
    );
    expect(selectFinaleReport(advance(make(), 2))).toBeNull();
  });
  it('correlation includes only obtained observations, respecting delays and source limitations', () => {
    let s = advance(
      make(1, {
        ...posture,
        fileVisibility: true,
        endpointCoverage: pilotEndpointCoverage,
      }),
      3,
    );
    expect(
      selectFinaleTimeline(s).every(
        (r) =>
          r.source === 'EDR — alert' || r.source === 'Operacje — zgłoszenie',
      ),
    ).toBe(true);
    s = schedule(s, { type: 'inspect-file-access' });
    s = advance(s);
    const rows = selectFinaleTimeline(s);
    expect(rows.some((r) => r.source === 'Audyt FS-01')).toBe(true);
    expect(
      rows.every(
        (r) => r.eventMinute <= r.availableAtMinute && r.limitation.length > 0,
      ),
    ).toBe(true);
    s = simulationReducer(s, {
      type: 'set-crisis-hypothesis',
      hypothesis: 'multiple-independent-events',
    });
    expect(s.finale!.hypotheses.at(-1)!.observationIds).toEqual(
      rows.map((r) => r.id),
    );
  });
  it('bad priorities and missing architecture produce partial recovery rather than fabricated containment tasks', () => {
    const p = finish(make(2));
    expect(selectFinaleReport(p)!.goalMet).toBe(false);
    expect(selectFinaleReport(p)!.containmentMet).toBe(true);
    expect(selectFinaleReport(p)!.outcome).not.toBe('full-success');
    const f = finish(make(1, posture, { ...architecture, erpEnabled: false }));
    expect(selectFinaleReport(f)!.outcome).toBe(
      'contained-with-business-unavailable',
    );
  });
  it('session revocation and account blocking retain their different semantics', () => {
    let s = advance(make(1, posture, architecture, 'api-and-files'), 3);
    s = schedule(s, { type: 'inspect-vpn-sessions' });
    s = advance(s);
    s = schedule(s, {
      type: 'block-account',
      accountId: 'cargo-link-operator',
    });
    s = advance(s);
    const attacker = s.hidden.attacker!.currentSessionId!;
    expect(
      canUseService(s.world, s.access, attacker, 'fs-01', 'SMB', 865),
    ).toBe(true);
  });
  it('EDR uses inherited thresholds, produces a legal false positive, and never damages documents or changes capacity', () => {
    const sensitive = advance(
      make(1, { ...posture, endpointCoverage: pilotEndpointCoverage }),
      5,
    );
    const quiet = advance(
      make(1, {
        ...posture,
        endpointCoverage: {
          ...pilotEndpointCoverage,
          detection: { ...pilotEndpointCoverage.detection, threshold: 100 },
        },
      }),
      5,
    );
    expect(sensitive.telemetry.endpoint!.alerts.length).toBeGreaterThan(0);
    expect(quiet.telemetry.endpoint!.alerts).toEqual([]);
    expect(
      sensitive.integrity!.documents.every((d) => d.status === 'correct'),
    ).toBe(true);
    expect(sensitive.business).toEqual(quiet.business);
    expect(make(1).telemetry.endpoint).toBeUndefined();
  });
  it('EDR and FS audit cover the actual local path; VPN segmentation cannot block that local SMB', () => {
    const s = advance(
      make(0, {
        ...posture,
        segmentation: true,
        fileVisibility: true,
        endpointCoverage: pilotEndpointCoverage,
      }),
      4,
    );
    expect(
      s.hidden.integrityThreat!.history.some((h) => h.outcome === 'modified'),
    ).toBe(true);
    expect(
      s.telemetry.fileAudit!.records.some(
        (r) => r.endpointId === 'pakowanie-03' && r.operation === 'modify',
      ),
    ).toBe(true);
    expect(s.telemetry.endpoint!.alerts.length).toBeGreaterThan(0);
    expect(
      s.telemetry.endpoint!.localEvents.every(
        (r) => r.endpointId === 'pakowanie-03',
      ),
    ).toBe(true);
  });
  it('FS audit cannot invent a server event for a path denied at the ACL', () => {
    let s = make(0, { ...posture, fileVisibility: true });
    s = {
      ...s,
      access: {
        ...s.access,
        rules: s.access.rules.map((r) =>
          r.id === 'R-LOCAL-SMB' ? { ...r, action: 'deny' } : r,
        ),
      },
    };
    s = advance(s, 4);
    expect(s.integrity!.documents.every((d) => d.status === 'correct')).toBe(
      true,
    );
    expect(
      s.telemetry.fileAudit!.sourceEvents.some(
        (r) => r.endpointId === 'pakowanie-03',
      ),
    ).toBe(false);
  });
  it('prepared FS backup reduces only the real FS restore time, never repairs ERP storage', () => {
    const readiness = testBackupProcedure(
      integrityScenario.integrity!,
      integrityScenario.world,
      'erp',
      4,
      4,
    );
    const s = make(2, { ...posture, backupReadiness: readiness });
    expect(
      integrityTaskTurns(s, { type: 'restore-documents', backupId: 'FS-1350' }),
    ).toBe(2);
    expect(
      integrityTaskTurns(make(2), {
        type: 'restore-documents',
        backupId: 'FS-1350',
      }),
    ).toBe(3);
    expect(
      advance(s, 3).world.assets.find((a) => a.id === 'erp-storage')!.status,
    ).toBe('offline');
  });
  it('variant and private fault schedule depend only on seed, never on purchased controls', () => {
    for (const seed of [0, 1, 2]) {
      const a = make(seed),
        b = make(
          seed,
          {
            ...posture,
            remoteAccess: true,
            fileVisibility: true,
            segmentation: true,
            endpointCoverage: pilotEndpointCoverage,
          },
          { ...architecture, smbScope: 'none', backupPrepared: false },
        );
      expect(a.hidden.scenario.finale).toEqual(b.hidden.scenario.finale);
      expect(a.hidden.scenario.attacker).toEqual(b.hidden.scenario.attacker);
      expect(a.hidden.scenario.integrity!.attack).toEqual(
        b.hidden.scenario.integrity!.attack,
      );
    }
  });
  it('poor architecture is playable with partial recovery, and false lead admits a deliberate narrow-scope response', () => {
    let s = make(
      1,
      posture,
      { ...architecture, erpEnabled: false },
      'api-and-files',
    );
    s = advance(s);
    s = schedule(s, {
      type: 'narrow-vendor-exception',
      approvalId: 'FIN-PREP',
    });
    s = finish(advance(s, 2));
    expect(selectFinaleReport(s)!.outcome).toBe(
      'contained-with-business-unavailable',
    );
    expect(s.business.totalProcessed).toBeGreaterThanOrEqual(300);
    expect(s.hidden.attacker!.transfer.exposedRecords).toBe(0);
  });
  it('does not manufacture capability safety after the attacker exhausts transfers; a live session remains usable until authorization is removed', () => {
    let s = advance(make(1, posture, architecture, 'api-and-files'), 10);
    expect(assessThreatAccess(s).targetAccessCutOff).toBe(false);
    s = schedule(s, {
      type: 'narrow-vendor-exception',
      approvalId: 'FIN-PREP',
    });
    s = advance(s, 2);
    expect(assessThreatAccess(s).targetAccessCutOff).toBe(true);
    expect(s.hidden.attacker!.transfer.exposedRecords).toBe(2000);
  });
  it('retains previously acquired VPN snapshots after another read and keeps first disclosure time', () => {
    let s = schedule(make(1), { type: 'inspect-vpn-sessions' });
    s = advance(s);
    const ids = selectFinaleTimeline(s)
      .filter((r) => r.source === 'VPN')
      .map((r) => r.id);
    s = schedule(s, { type: 'inspect-vpn-sessions' });
    s = advance(s);
    expect(
      selectFinaleTimeline(s)
        .filter((r) => r.source === 'VPN')
        .map((r) => r.id),
    ).toEqual(expect.arrayContaining(ids));
  });
  it('conflicting ERP mutations and FS reconciliation cannot run concurrently in the finale', () => {
    let s = make();
    s = {
      ...s,
      integrity: {
        ...s.integrity!,
        documents: s.integrity!.documents.map((d, n) =>
          n === 0 ? { ...d, status: 'reconcile' } : d,
        ),
      },
    };
    s = schedule(s, { type: 'reconcile-documents' });
    expect(
      taskRejection(s, 'administrator', { type: 'switch-erp-standby' }),
    ).toBe('invalid-state');
  });
  it('preserves containment, grants and authentication as distinct predicates on the branch standby route', () => {
    let s = make(2);
    s = schedule(s, { type: 'switch-erp-standby' });
    s = advance(s, 3);
    s = schedule(s, { type: 'activate-branch-route', route: 'backup' });
    s = advance(s);
    const a = assessBranchAccess(s, 'EAST-OP', 'erp-standby', 'HTTPS');
    expect(a.tunnelAuthenticated && a.permissionAllowed && a.allowed).toBe(
      true,
    );
    s = { ...s, branch: { ...s.branch!, backupAuthenticated: false } };
    expect(
      assessBranchAccess(s, 'EAST-OP', 'erp-standby', 'HTTPS').allowed,
    ).toBe(false);
  });
  it('publishes failed recovery outcomes and known backup details on the common observation timeline', () => {
    let s = advance(make(2), 3);
    s = schedule(s, { type: 'restart-erp-service' });
    s = schedule(s, { type: 'inspect-erp-backups' });
    s = advance(s, 2);
    const rows = selectFinaleTimeline(s);
    expect(
      rows.some(
        (o) =>
          o.source === 'ERP — konsola zadania' &&
          o.result === 'failed' &&
          o.fact.includes('storage'),
      ),
    ).toBe(true);
    expect(
      rows.some(
        (o) => o.fact.includes('ERP-1350') && o.fact.includes('dostępna nie'),
      ),
    ).toBe(true);
  });
  it('FS comparison uses the complete active standby through real local access, independently of the failed primary host', () => {
    let s = schedule(make(1), { type: 'switch-erp-standby' });
    s = advance(s, 3);
    expect(taskRejection(s, 'analyst', { type: 'inspect-documents' })).toBe(
      'source-unavailable',
    );
    s = schedule(s, { type: 'reconcile-erp-records' });
    s = advance(s, 2);
    s = {
      ...s,
      world: {
        ...s.world,
        assets: s.world.assets.map((a) =>
          a.id === 'erp' ? { ...a, status: 'offline' } : a,
        ),
      },
    };
    s = schedule(s, { type: 'inspect-documents' });
    s = advance(s, 2);
    expect(s.integrity!.observations.at(-1)!.correct).toBe(100);
    s = {
      ...s,
      access: {
        ...s.access,
        permissions: s.access.permissions.filter(
          (p) =>
            !(
              p.accountId === 'erp-warehouse' &&
              p.targetAssetId === 'erp-standby'
            ),
        ),
      },
    };
    expect(businessAvailability(s).remoteAvailable).toBe(true);
    expect(taskRejection(s, 'analyst', { type: 'inspect-documents' })).toBe(
      'source-unavailable',
    );
  });
});
