import { describe, it, expect } from 'vitest';
import {
  selectRecoveryScenario,
  RECOVERY_FAMILY_ID as family,
} from '../content/scenarios/recovery';
import {
  createScenario,
  validateScenario,
} from '../application/createScenario';
import { selectPlayerView } from '../application/selectPlayerView';
import {
  selectRecoveryReport,
  recoveryOutcome,
} from '../application/selectRecoveryReport';
import { advance, job, order, finish } from '../testSupport/resilience';
import { businessAvailability } from './business';
import { assessErpAvailability, pendingErpOrderIds } from './recoveryAccess';
import { taskRejection } from './tasks';
import type { SimulationState } from '../domain/simulation';
const start = (seed = 0) =>
  createScenario(selectRecoveryScenario(family, seed), {
    mode: 'unknown',
    seed,
  });
const inventory = { type: 'inspect-erp-backups' } as const;
const old = { type: 'restore-erp-backup', backupId: 'ERP-1320' } as const;
const recent = { type: 'restore-erp-backup', backupId: 'ERP-1350' } as const;
const restart = { type: 'restart-erp-service' } as const;
const reconcile = { type: 'reconcile-erp-records' } as const;
const check = { type: 'inspect-erp-consistency' } as const;
const manual = { type: 'start-manual-shipping' } as const;
const close = { type: 'close-manual-shipping' } as const;
const offline = (s: SimulationState, id: string): SimulationState => ({
  ...s,
  world: {
    ...s.world,
    assets: s.world.assets.map((a) =>
      a.id === id ? { ...a, status: 'offline' } : a,
    ),
  },
});
function conservation(s: SimulationState) {
  const orders = s.recovery!.orders,
    fulfilled = orders.filter((o) => o.fulfilledBy !== null);
  expect(orders).toHaveLength(s.business.totalReceived);
  expect(fulfilled).toHaveLength(s.business.totalProcessed);
  expect(new Set(orders.map((o) => o.id)).size).toBe(orders.length);
  expect(s.business.totalReceived).toBe(
    s.business.totalProcessed + s.business.backlog,
  );
  expect(orders.filter((o) => !o.fulfilledBy)).toHaveLength(s.business.backlog);
}
describe('M04 — actual dependencies and deterministic data', () => {
  it('defines valid stable variants without altering the family after decisions', () => {
    for (let seed = 0; seed < 3; seed++) {
      const d = selectRecoveryScenario(family, seed);
      expect(validateScenario(d)).toEqual([]);
      expect(d).toEqual(selectRecoveryScenario(family, seed));
      expect(d.recovery?.records).toHaveLength(24);
      for (const b of d.recovery!.backups)
        expect(b.recordIds).toEqual(
          d
            .recovery!.records.filter((r) => r.minute <= b.minute)
            .map((r) => r.id),
        );
    }
  });
  it('host online is not ERP; process never recovers spontaneously, and restart works only at completion', () => {
    let s = start();
    expect(assessErpAvailability(s)).toMatchObject({
      host: true,
      processRunning: false,
      useful: false,
    });
    expect(assessErpAvailability(advance(s, 3)).useful).toBe(false);
    s = order(s, restart);
    s = advance(s);
    expect(businessAvailability(s).capacity).toBe(0);
    s = advance(s);
    expect(s.business.totalProcessed).toBe(0);
    expect(businessAvailability(s).capacity).toBe(22);
    s = job(s, check);
    const r = selectRecoveryReport(finish(s))!;
    expect(r.goalMet).toBe(true);
    expect(r.businessContinuity.backlog).toBe(8);
    expect(r.serviceRecovery.actualRtoMinutes).toBe(10);
  });
  it('restart does not repair corrupt database records', () => {
    const s = job(start(1), restart);
    expect(s.recovery?.primary.corruptRecordIds).toEqual([
      'ERP-TX-012',
      'ERP-TX-020',
    ]);
    expect(assessErpAvailability(s).useful).toBe(false);
    expect(s.recovery?.results.at(-1)?.outcome).toBe('failed');
  });
  it('storage outage gates restart, inventory and restore, never auto-heals', () => {
    let s = job(start(2), restart);
    expect(assessErpAvailability(s).storage).toBe(false);
    s = job(s, inventory);
    expect(taskRejection(s, 'administrator', old)).toBe('source-unavailable');
    s = advance(s, 3);
    expect(assessErpAvailability(s).storage).toBe(false);
    expect(s.recovery?.primary.recordIds).toHaveLength(24);
  });
  it('rechecks physical backup and target prerequisites at completion', () => {
    let s = job(start(1), inventory);
    s = order(s, old);
    s = offline(s, 'erp-storage');
    s = advance(s, 2);
    expect(s.recovery?.results.at(-1)?.outcome).toBe('failed');
    expect(s.recovery?.primary.backupId).toBe(null);
    expect(s.recovery?.primary.corruptRecordIds).toHaveLength(2);
  });
  it('new corrupt snapshot remains corrupt after verification and restore', () => {
    let s = job(start(1), inventory);
    s = job(s, { type: 'verify-erp-backup', backupId: 'ERP-1350' });
    expect(s.recovery?.observations.at(-1)?.backups[0]?.verified).toBe(false);
    s = job(s, inventory);
    expect(
      selectPlayerView(s).recovery?.backups.find((b) => b.id === 'ERP-1350')
        ?.verified,
    ).toBe(false);
    s = job(s, recent);
    expect(s.recovery?.results.at(-1)?.outcome).toBe('partial');
    expect(s.recovery?.primary.recordIds).toHaveLength(21);
    expect(businessAvailability(s).capacity).toBe(0);
  });
  it('old restore replaces the dataset and does not invent later records or erase historical evidence', () => {
    let s = job(start(1), inventory);
    const observation = s.recovery!.observations[0];
    s = job(s, old);
    expect(s.recovery?.primary.recordIds).toEqual(
      selectRecoveryScenario(family, 1).recovery!.backups[0]!.recordIds,
    );
    expect(assessErpAvailability(s).missingRecordIds).toEqual([
      'ERP-TX-019',
      'ERP-TX-020',
      'ERP-TX-021',
      'ERP-TX-022',
      'ERP-TX-023',
      'ERP-TX-024',
    ]);
    expect(businessAvailability(s).capacity).toBe(16);
    expect(recoveryOutcome(s).goalMet).toBe(false);
    expect(s.recovery?.observations[0]).toEqual(observation);
  });
  it('unnecessary restore loses newer committed records and ERP shipment acknowledgements, never shipments', () => {
    let s = job(start(), restart);
    s = job(s, inventory);
    const processed = s.business.totalProcessed;
    expect(processed).toBe(22);
    s = job(s, old);
    expect(s.business.totalProcessed).toBe(processed + 44);
    expect(s.recovery?.primary.recordIds).toHaveLength(18);
    expect(pendingErpOrderIds(s)).toHaveLength(66);
    conservation(s);
    s = job(s, reconcile);
    expect(s.recovery?.primary.recordIds).toHaveLength(24);
    expect(pendingErpOrderIds(s)).toEqual([]);
    conservation(s);
  });
  it('standby changes real user route and has its own older data, with primary still broken', () => {
    let s = job(start(2), { type: 'switch-erp-standby' });
    expect(assessErpAvailability(s)).toMatchObject({
      instance: 'standby',
      target: 'erp-standby',
      storage: true,
      useful: true,
    });
    expect(s.recovery?.standby.recordIds).toHaveLength(20);
    expect(s.recovery?.primary.recordIds).toHaveLength(24);
    expect(s.world.assets.find((a) => a.id === 'erp-storage')?.status).toBe(
      'offline',
    );
    s = {
      ...s,
      access: {
        ...s.access,
        rules: s.access.rules.map((r) =>
          r.targetAssetId === 'erp-standby' ? { ...r, action: 'deny' } : r,
        ),
      },
    };
    expect(businessAvailability(s).capacity).toBe(0);
  });
  it('RPO provenance, missing records and actual RTO are distinct from order counters', () => {
    let s = job(start(1), inventory);
    s = job(s, old);
    let r = recoveryOutcome(s);
    expect(r.serviceRecovery.actualRtoMinutes).toBe(15);
    expect(r.dataRecovery.actualRpoMinutes).toBe(40);
    expect(r.dataRecovery.missingRecordIds).toHaveLength(6);
    expect(r.businessContinuity.received).toBe(60);
    expect(r.businessContinuity.processed).toBe(0);
    s = job(s, reconcile);
    r = recoveryOutcome(s);
    expect(r.dataRecovery.missingRecordIds).toEqual([]);
    expect(r.dataRecovery.actualRpoMinutes).toBe(40);
    expect(r.dataRecovery.rpoMet).toBe(false);
  });
});
describe('M04 — single order ledger and controlled recovery', () => {
  it('manual mode works without ERP, starts after five minutes, and is exclusive after restart', () => {
    let s = job(start(), manual);
    expect(s.business.totalProcessed).toBe(0);
    s = advance(s);
    expect(s.business.totalProcessed).toBe(10);
    expect(s.recovery?.primary.processRunning).toBe(false);
    s = job(s, restart);
    expect(assessErpAvailability(s).capacity).toBe(22);
    expect(businessAvailability(s).capacity).toBe(10);
    expect(s.business.totalProcessed).toBe(30);
    expect(pendingErpOrderIds(s)).toHaveLength(30);
    conservation(s);
    s = job(s, close);
    expect(businessAvailability(s).capacity).toBe(22);
    expect(taskRejection(s, 'analyst', reconcile)).toBe(null);
    s = job(s, reconcile);
    expect(pendingErpOrderIds(s)).toEqual([]);
    conservation(s);
  });
  it('manual work uses finite prepared manifests, never creates data, and remains pending until reconciliation', () => {
    const s = finish(job(start(1), manual));
    expect(s.business.totalProcessed).toBe(170);
    expect(s.business.backlog).toBe(190);
    expect(
      s.recovery?.orders.filter((o) => o.fulfilledBy === 'manual'),
    ).toHaveLength(170);
    expect(s.recovery?.primary.corruptRecordIds).toHaveLength(2);
    expect(pendingErpOrderIds(s)).toHaveLength(170);
    expect(selectRecoveryReport(s)?.goalMet).toBe(false);
    conservation(s);
  });
  it('exhausts only the prepared manifest scope even while further orders keep arriving', () => {
    const initial = start(1);
    const small = {
      ...initial,
      hidden: {
        ...initial.hidden,
        scenario: {
          ...initial.hidden.scenario,
          recovery: {
            ...initial.hidden.scenario.recovery!,
            manualManifestLimit: 20,
          },
        },
      },
    };
    const s = advance(job(small, manual), 5);
    expect(s.business.totalReceived).toBe(120);
    expect(s.business.totalProcessed).toBe(20);
    expect(businessAvailability(s).capacity).toBe(0);
    conservation(s);
  });
  it('respects available local manifests and reconciliation source at completion', () => {
    let s = job(start(1), inventory);
    s = job(s, old);
    s = order(s, reconcile);
    s = offline(s, 'workstations');
    s = advance(s, 2);
    expect(s.recovery?.results.at(-1)?.outcome).toBe('failed');
    expect(assessErpAvailability(s).missingRecordIds).toHaveLength(6);
    expect(
      businessAvailability(offline(job(start(1), manual), 'workstations'))
        .capacity,
    ).toBe(0);
  });
  it('reconstructs only represented records from the correct source', () => {
    let s = job(job(start(1), inventory), old);
    s = {
      ...s,
      hidden: {
        ...s.hidden,
        scenario: {
          ...s.hidden.scenario,
          recovery: {
            ...s.hidden.scenario.recovery!,
            reconciliationSource: {
              assetId: 'workstations',
              recordIds: ['ERP-TX-019'],
            },
          },
        },
      },
    };
    s = job(s, reconcile);
    expect(assessErpAvailability(s).missingRecordIds).toHaveLength(5);
    expect(s.recovery?.results.at(-1)?.outcome).toBe('partial');
  });
  it('requires source and actual complete data for verification, invalidated by later restore', () => {
    let s = job(job(start(), restart), check);
    expect(s.recovery?.verifiedRevision).toBe(s.recovery?.revision);
    s = job(job(s, inventory), old);
    expect(s.recovery?.verifiedRevision).toBe(null);
    s = job(s, check);
    expect(s.recovery?.results.at(-1)?.outcome).toBe('partial');
  });
  it('shared workers, operation prerequisites and deadline prevent impossible or concurrent work', () => {
    let s = start(1);
    expect(taskRejection(s, 'administrator', old)).toBe('target-not-observed');
    expect(
      taskRejection(s, 'administrator', {
        type: 'restore-erp-backup',
        backupId: 'FS-1350',
      }),
    ).toBe('unknown-target');
    s = order(s, restart);
    expect(taskRejection(s, 'administrator', manual)).toBe('worker-busy');
    expect(taskRejection(s, 'analyst', restart)).toBe('wrong-worker');
    s = advance(s, 17);
    expect(taskRejection(s, 'administrator', restart)).toBe(
      'outside-time-window',
    );
    expect(taskRejection(start(), 'administrator', close)).toBe(
      'invalid-state',
    );
    expect(taskRejection(job(start(), manual), 'analyst', reconcile)).toBe(
      'invalid-state',
    );
  });
  it('has a feasible full B path with manual work, clean copy, source reconciliation and verification', () => {
    let s = advance(order(order(start(1), inventory), manual));
    s = advance(order(order(s, old), { type: 'inspect-erp-database' }), 2);
    s = job(s, close);
    s = job(s, reconcile);
    s = job(s, check);
    s = finish(s);
    const r = selectRecoveryReport(s)!;
    expect(r.goalMet).toBe(true);
    expect(r.businessContinuity.backlog).toBe(34);
    expect(r.businessContinuity.manualProcessed).toBe(30);
    expect(r.dataRecovery.rpoMet).toBe(false);
    conservation(s);
  });
  it('has a feasible C path while shared storage stays offline', () => {
    let s = advance(
      order(order(start(2), { type: 'inspect-erp-database' }), {
        type: 'switch-erp-standby',
      }),
      3,
    );
    s = job(s, reconcile);
    s = job(s, check);
    const r = selectRecoveryReport(finish(s))!;
    expect(r.goalMet).toBe(true);
    expect(r.businessContinuity.backlog).toBe(40);
    expect(r.serviceRecovery.instance).toBe('standby');
  });
  it('does not disclose cause through initial projection or actions and withholds final truth', () => {
    const views = [0, 1, 2].map((seed) => {
      const v = selectPlayerView(start(seed));
      return { ...v, run: { ...v.run, seed: 0 } };
    });
    expect(views[0]).toEqual(views[1]);
    expect(views[1]).toEqual(views[2]);
    expect(
      views[2]!.world.assets.find((a) => a.id === 'erp-storage')?.status,
    ).toBe('unknown');
    expect(selectRecoveryReport(start(2))).toBe(null);
    expect(JSON.stringify(views[2])).not.toContain('storage-outage');
    const s = job(start(2), { type: 'inspect-erp-database' });
    expect(
      selectPlayerView(s).world.assets.find((a) => a.id === 'erp-storage')
        ?.status,
    ).toBe('offline');
  });
});
