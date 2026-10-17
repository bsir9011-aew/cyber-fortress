import { describe, expect, it } from 'vitest';
import type { SimulationState, TaskAction } from '../domain/simulation';
import type { SecurityPosture } from '../domain/campaign';
import { createIntegrityIncident } from '../application/prepareCampaignIncident';
import { createCampaign } from '../application/campaignReducer';
import {
  createScenario,
  validateScenario,
} from '../application/createScenario';
import { simulationReducer } from '../application/simulationReducer';
import { selectIntegrityReport } from '../application/selectIntegrityReport';
import { selectPlayerView } from '../application/selectPlayerView';
import { integrityScenario } from '../content/scenarios/integrity';
import { businessAvailability } from './business';
import { canUseLocalService } from './access';
import {
  documentCounts,
  resolveLocalFileOperation,
  selectLocalThreatAction,
} from './integrity';
import { taskRejection, taskSpecs } from './tasks';
import { readFileAccess } from './fileAudit';

const endpointId = 'pakowanie-03';
const isolate: TaskAction = { type: 'isolate-endpoint', endpointId };
const examine: TaskAction = { type: 'examine-endpoint', endpointId };
const restrict: TaskAction = { type: 'restrict-endpoint-writes', endpointId };
const reconnect: TaskAction = { type: 'reconnect-endpoint', endpointId };
const inspect: TaskAction = { type: 'inspect-documents' };
const inventory: TaskAction = { type: 'inspect-backups' };
const restore = (backupId = 'FS-1320'): TaskAction => ({
  type: 'restore-documents',
  backupId,
});
const verify = (backupId = 'FS-1350'): TaskAction => ({
  type: 'verify-backup',
  backupId,
});
const reconcile: TaskAction = { type: 'reconcile-documents' };
const initial = (posture: Partial<SecurityPosture> = {}) =>
  createIntegrityIncident(0, { ...createCampaign().posture, ...posture });
const turn = (s: SimulationState) =>
  simulationReducer(s, { type: 'advance-turn' });
function advance(s: SimulationState, n = 1) {
  for (let i = 0; i < n; i++) s = turn(s);
  return s;
}
function order(s: SimulationState, action: TaskAction) {
  return simulationReducer(s, {
    type: 'schedule-task',
    workerId: taskSpecs[action.type].workerId,
    action,
  });
}
function job(s: SimulationState, action: TaskAction) {
  const pending = order(s, action);
  expect(pending.tasks.length).toBe(s.tasks.length + 1);
  return advance(pending, pending.tasks.at(-1)!.dueTurn - pending.clock.turn);
}
function finish(s: SimulationState) {
  return advance(s, 18 - s.clock.turn);
}
function repair(backup: 'old' | 'new', connect = true) {
  let s = advance(order(order(initial(), inspect), isolate), 2);
  s = job(s, inventory);
  if (backup === 'new') s = job(s, verify());
  s = order(
    order(s, restore(backup === 'old' ? 'FS-1320' : 'FS-1350')),
    examine,
  );
  s = advance(s, backup === 'old' ? 2 : 3);
  s = order(s, restrict);
  if (backup === 'old') s = order(s, reconcile);
  else s = order(s, inspect);
  s = advance(s, 2);
  if (connect) s = order(s, reconnect);
  if (backup === 'old') s = order(s, inspect);
  s = advance(s, backup === 'old' ? 2 : 1);
  return finish(s);
}

describe('Misja 02 — lokalny dostęp i rzeczywista integralność', () => {
  it('waliduje scenariusz, modeluje 100 dokumentów i członka istniejących 94 stacji', () => {
    expect(validateScenario(integrityScenario)).toEqual([]);
    const s = initial();
    expect(s.world.assets).toHaveLength(9);
    expect(s.integrity!.endpoint.assetId).toBe('workstations');
    expect(s.access.sessions.map((v) => v.id)).toEqual(['B-01']);
    expect(s.hidden.attacker).toBeNull();
    expect(documentCounts(s.integrity!.documents)).toMatchObject({
      total: 100,
      correct: 88,
      damaged: 12,
      reconcile: 0,
    });
  });
  it('planner zależy tylko od harmonogramu i własnego stanu, nie decyzji gracza', () => {
    const s = initial();
    expect(
      selectLocalThreatAction(
        s.hidden.integrityThreat!,
        integrityScenario.integrity!.attack,
        1,
      ),
    ).toBeNull();
    expect(
      selectLocalThreatAction(
        s.hidden.integrityThreat!,
        integrityScenario.integrity!.attack,
        2,
      ),
    ).toEqual({ count: 20 });
    expect(
      selectLocalThreatAction(
        { ...s.hidden.integrityThreat!, compromised: false },
        integrityScenario.integrity!.attack,
        2,
      ),
    ).toBeNull();
  });
  it.each([
    'offline-endpoint',
    'offline-server',
    'missing-route',
    'missing-permission',
    'isolated',
    'writes-restricted',
    'missing-identity',
  ] as const)('brak warunku %s blokuje faktyczną modyfikację', (condition) => {
    let s = initial({ fileVisibility: true });
    if (condition === 'offline-endpoint' || condition === 'offline-server')
      s = {
        ...s,
        world: {
          ...s.world,
          assets: s.world.assets.map((a) =>
            a.id === (condition === 'offline-server' ? 'fs-01' : 'workstations')
              ? { ...a, status: 'offline' }
              : a,
          ),
        },
      };
    if (condition === 'missing-route')
      s = {
        ...s,
        world: {
          ...s.world,
          connections: s.world.connections.filter(
            (c) => c.id !== 'local-shipping-smb',
          ),
        },
      };
    if (
      condition === 'missing-permission' ||
      condition === 'isolated' ||
      condition === 'writes-restricted'
    )
      s = {
        ...s,
        integrity: {
          ...s.integrity!,
          endpoint: {
            ...s.integrity!.endpoint,
            ...(condition === 'missing-permission'
              ? { permissions: [] }
              : condition === 'isolated'
                ? { isolated: true }
                : { writesRestricted: true }),
          },
        },
      };
    if (condition === 'missing-identity')
      s = {
        ...s,
        access: {
          ...s.access,
          accounts: s.access.accounts.filter((a) => a.id !== 'packing-local'),
        },
      };
    const before = s.integrity!.documents;
    const result = resolveLocalFileOperation(s, endpointId, 'modify', [
      'DOC-020',
    ]);
    expect(result.allowed).toBe(false);
    expect(result.state.integrity!.documents).toEqual(before);
    if (
      [
        'offline-endpoint',
        'offline-server',
        'missing-route',
        'isolated',
      ].includes(condition)
    )
      expect(result.state.telemetry.fileAudit!.sourceEvents).toEqual(
        s.telemetry.fileAudit!.sourceEvents,
      );
    else
      expect(
        result.state.telemetry.fileAudit!.sourceEvents.at(-1)?.outcome,
      ).toBe('denied');
  });
  it('nie zwiększa uszkodzeń dwukrotnie dla tej samej generacji, odrzuca zły zakres', () => {
    let s = initial();
    s = resolveLocalFileOperation(s, endpointId, 'modify', ['DOC-020']).state;
    const before = s.integrity!.documents;
    s = resolveLocalFileOperation(s, endpointId, 'modify', ['DOC-020']).state;
    expect(s.integrity!.documents).toEqual(before);
    expect(
      resolveLocalFileOperation(s, endpointId, 'modify', ['unknown']).allowed,
    ).toBe(false);
    expect(
      resolveLocalFileOperation(s, endpointId, 'modify', ['DOC-021', 'DOC-021'])
        .allowed,
    ).toBe(false);
  });
  it('izolacja ma czas, odcina tylko stację i nie przywraca danych', () => {
    const s = initial();
    const pending = order(s, isolate);
    expect(pending.integrity!.endpoint.isolated).toBe(false);
    const isolated = turn(pending);
    expect(isolated.integrity!.endpoint.isolated).toBe(true);
    expect(isolated.integrity!.documents).toEqual(s.integrity!.documents);
    expect(isolated.world).toEqual(s.world);
    expect(businessAvailability(isolated).capacity).toBe(
      businessAvailability(s).capacity - 2,
    );
    expect(documentCounts(finish(isolated).integrity!.documents).damaged).toBe(
      12,
    );
    expect(isolated.hidden.integrityThreat!.compromised).toBe(true);
  });
  it('ponowne podłączenie wymaga izolacji, badania i ograniczenia zapisu; nie oczyszcza hosta', () => {
    let s = initial();
    expect(taskRejection(s, 'administrator', reconnect)).toBe('invalid-state');
    s = job(s, isolate);
    expect(taskRejection(s, 'administrator', restrict)).toBe('invalid-state');
    expect(taskRejection(s, 'administrator', reconnect)).toBe('invalid-state');
    s = job(s, examine);
    s = job(s, restrict);
    s = job(s, reconnect);
    expect(s.integrity!.endpoint).toMatchObject({
      isolated: false,
      writesRestricted: true,
    });
    expect(s.hidden.integrityThreat!.compromised).toBe(true);
    expect(
      canUseLocalService(
        s.world,
        s.access,
        s.integrity!.endpoint,
        'fs-01',
        'SMB',
        'read',
      ),
    ).toBe(true);
    expect(
      canUseLocalService(
        s.world,
        s.access,
        s.integrity!.endpoint,
        'fs-01',
        'SMB',
        'modify',
      ),
    ).toBe(false);
  });
  it('zachowuje warunki celu, wykonawcy, zajętości oraz czasu operacji', () => {
    const s = initial();
    expect(taskRejection(s, 'analyst', isolate)).toBe('wrong-worker');
    expect(
      taskRejection(s, 'administrator', {
        type: 'isolate-endpoint',
        endpointId: 'unknown',
      }),
    ).toBe('unknown-target');
    expect(taskRejection(order(s, isolate), 'administrator', isolate)).toBe(
      'worker-busy',
    );
    expect(taskRejection(order(s, inspect), 'analyst', inventory)).toBe(
      'worker-busy',
    );
    expect(taskRejection(s, 'administrator', restore())).toBe(
      'target-not-observed',
    );
    const late = { ...job(s, inventory), clock: { ...s.clock, turn: 16 } };
    const verified = {
      ...late,
      integrity: {
        ...late.integrity!,
        backups: late.integrity!.backups.map((b) => ({
          ...b,
          verification: 'clean' as const,
        })),
      },
    };
    expect(taskRejection(verified, 'administrator', restore('FS-1350'))).toBe(
      'outside-time-window',
    );
    expect(order(finish(s), isolate).tasks).toEqual(finish(s).tasks);
  });
  it('online nie oznacza poprawności, a uszkodzenia zmieniają przepustowość bez kary punktowej', () => {
    const s = advance(initial(), 4);
    expect(s.world.assets.find((a) => a.id === 'fs-01')?.status).toBe('online');
    expect(documentCounts(s.integrity!.documents).damaged).toBe(52);
    expect(businessAvailability(s).capacity).toBe(
      8 + Math.floor((14 * 48) / 100),
    );
    expect(s.business.backlog).toBeGreaterThan(0);
  });
});

describe('kopie, uzgodnienie i badanie dowodów', () => {
  it('odtworzenie starszej kopii pozostawia dokładnie 20 późniejszych dokumentów do uzgodnienia', () => {
    let s = job(order(initial(), isolate), inventory);
    const before = s.integrity!.documents;
    const pending = order(s, restore());
    expect(pending.integrity!.documents).toEqual(before);
    expect(pending.tasks.at(-1)!.dueTurn - pending.clock.turn).toBe(2);
    s = advance(pending, 2);
    expect(documentCounts(s.integrity!.documents)).toMatchObject({
      correct: 80,
      damaged: 0,
      reconcile: 20,
      recovered: 12,
    });
    expect(
      s
        .integrity!.documents.filter((d) => d.status === 'reconcile')
        .map((d) => d.id),
    ).toEqual(integrityScenario.integrity!.documentIds.slice(80));
    s = job(s, reconcile);
    expect(documentCounts(s.integrity!.documents)).toMatchObject({
      correct: 100,
      damaged: 0,
      reconcile: 0,
    });
    expect(s.integrity!.reconciledIds).toHaveLength(20);
    expect(s.integrity!.verifiedRecoveryMinute).toBeNull();
    s = job(s, inspect);
    expect(s.integrity!.verifiedRecoveryMinute).toBe(
      s.clock.startMinute + s.clock.turn * 5,
    );
  });
  it('nowsza kopia wymaga badania, odtwarza 100 dokumentów i trwa 3 tury', () => {
    let s = job(order(initial(), isolate), inventory);
    expect(taskRejection(s, 'administrator', restore('FS-1350'))).toBe(
      'invalid-state',
    );
    s = job(s, verify());
    const pending = order(s, restore('FS-1350'));
    expect(pending.tasks.at(-1)!.dueTurn - pending.clock.turn).toBe(3);
    s = advance(pending, 3);
    expect(documentCounts(s.integrity!.documents)).toMatchObject({
      correct: 100,
      reconcile: 0,
    });
    expect(s.integrity!.recoveries[0]?.missingDocuments).toBe(0);
    expect(s.hidden.integrityThreat!.compromised).toBe(true);
  });
  it('weryfikacja ujawnia wadliwą kopię zamiast gwarantować jej poprawność', () => {
    const base = structuredClone(integrityScenario);
    const definition = {
      ...base,
      integrity: {
        ...base.integrity!,
        backups: base.integrity!.backups.map((b) =>
          b.id === 'FS-1350' ? { ...b, damagedIds: ['DOC-001'] } : b,
        ),
      },
    };
    let s = createScenario(definition);
    s = job(job(s, inventory), verify());
    expect(
      s.integrity!.backups.find((b) => b.id === 'FS-1350')?.verification,
    ).toBe('damaged');
    expect(taskRejection(s, 'administrator', restore('FS-1350'))).toBe(
      'invalid-state',
    );
  });
  it('samo odtworzenie nie usuwa przyczyny i pozwala ponownie uszkodzić nową generację', () => {
    let s = job(job(initial(), inventory), verify());
    s = job(s, restore('FS-1350'));
    expect(s.hidden.integrityThreat!.compromised).toBe(true);
    // Restore completes at turn 6, before the turn-6 hostile operation.
    expect(documentCounts(s.integrity!.documents).damaged).toBe(20);
    expect(
      s.integrity!.documents.find((d) => d.id === 'DOC-001'),
    ).toMatchObject({ generation: 1, status: 'damaged', recovered: true });
    expect(s.integrity!.verifiedRecoveryMinute).toBeNull();
  });
  it('dowód porównania obejmuje jawny zakres/czas i nie ujawnia sprawcy', () => {
    const s = job(initial(), inspect);
    const o = s.integrity!.observations[0]!;
    expect(o).toMatchObject({
      minute: 850,
      correct: 68,
      damaged: 32,
      reconcile: 0,
    });
    expect(o.scope).toHaveLength(100);
    expect(JSON.stringify(o)).not.toContain('compromised');
    expect(selectPlayerView(initial()).integrity!.observations).toEqual([]);
    expect(selectPlayerView(initial()).integrity!.backups).toEqual([]);
  });
  it('audyt pokazuje docierające read/modify i lokalny podmiot, bez fikcyjnej sesji lub klasyfikacji', () => {
    const s = advance(initial({ fileVisibility: true }), 3);
    const o = readFileAccess(s, 'audit-proof')!;
    const modified = o.records.filter((r) => r.operation === 'modify');
    expect(modified).toHaveLength(1);
    expect(modified[0]).toMatchObject({
      minute: 850,
      endpointId,
      accountId: 'packing-local',
      sessionId: null,
      outcome: 'allowed',
    });
    expect(modified[0]!.documentIds).toHaveLength(20);
    expect(o.records.some((r) => r.operation === 'read')).toBe(true);
    for (const key of ['compromised', 'unauthorized', 'malicious', 'nextIndex'])
      expect(JSON.stringify(o)).not.toContain(key);
  });
  it('brak audytu nie usuwa uszkodzeń ani nie tworzy telemetrii plikowej', () => {
    const a = advance(initial(), 4);
    const b = advance(initial({ fileVisibility: true }), 4);
    expect(a.integrity!.documents).toEqual(b.integrity!.documents);
    expect(a.telemetry.fileAudit).toBeUndefined();
    expect(readFileAccess(a, 'missing')).toBeNull();
    expect(
      b.telemetry.fileAudit!.sourceEvents.some((e) => e.operation === 'modify'),
    ).toBe(true);
  });
  it('puste porcje nie wytwarzają fikcyjnych operacji audytu po uszkodzeniu całego zbioru', () => {
    const s = finish(initial({ fileVisibility: true }));
    expect(s.hidden.integrityThreat!.history.at(-1)?.outcome).toBe(
      'no-new-documents',
    );
    expect(s.telemetry.fileAudit!.sourceEvents).toHaveLength(15);
    expect(
      s.telemetry.fileAudit!.sourceEvents.every(
        (e) => (e.documentIds?.length ?? 0) > 0,
      ),
    ).toBe(true);
  });
  it.each([
    { remoteAccess: true },
    { segmentation: true },
    { ruleOverrides: { 'R-SMB': 'deny' as const } },
    {
      accountOverrides: {
        'magazyn-07': { loginStatus: 'blocked' as const, credentialVersion: 2 },
      },
    },
  ])(
    'zabezpieczenie drogi VPN nie blokuje lokalnych modyfikacji: %j',
    (posture) => {
      const s = advance(initial(posture), 4);
      expect(documentCounts(s.integrity!.documents).damaged).toBe(52);
      expect(
        s.hidden.integrityThreat!.history.every(
          (h) => h.outcome === 'modified',
        ),
      ).toBe(true);
    },
  );
  it('rzeczywista odmowa lokalnego SMB działa, niezależnie od MFA', () => {
    const s = finish(
      initial({ remoteAccess: true, ruleOverrides: { 'R-LOCAL-SMB': 'deny' } }),
    );
    expect(documentCounts(s.integrity!.documents).damaged).toBe(0);
    expect(
      s.hidden.integrityThreat!.history.every(
        (h) => h.outcome === 'access-denied',
      ),
    ).toBe(true);
    expect(businessAvailability(s).capacity).toBe(6);
  });
  it('samo odebranie prawa odczytu pozostałym stanowiskom także ogranicza rzeczywisty biznes', () => {
    const start = initial();
    const s = {
      ...start,
      access: {
        ...start.access,
        permissions: start.access.permissions.filter(
          (p) => p.accountId !== 'warehouse-team',
        ),
      },
    };
    expect(businessAvailability(s).capacity).toBe(8);
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
  it('reset odtwarza identyczne dane, kopie, aktora, zadania i wiedzę', () => {
    const start = initial({ fileVisibility: true });
    const played = job(job(start, isolate), inventory);
    expect(simulationReducer(played, { type: 'reset' })).toEqual(start);
  });
  it('aktywna projekcja nie ujawnia dokumentów, kompromitacji, treści kopii ani planu', () => {
    const s = advance(initial({ fileVisibility: true }), 4);
    const view = selectPlayerView(s);
    for (const secret of [
      'compromised',
      'nextIndex',
      'initialDamage',
      'damagedIds',
      'everDamaged',
      'operationRecords',
      'chunkSize',
      'threatHistory',
    ])
      expect(JSON.stringify(view)).not.toContain(secret);
    expect(view.integrity!.observations).toEqual([]);
    expect(selectIntegrityReport(s)).toBeNull();
  });
});

describe('pełne strategie i bilans Misji 02', () => {
  it('analiza decyzji pokazuje fakty znane przy zleceniu, bez późniejszych dowodów', () => {
    const report = selectIntegrityReport(repair('old'))!;
    expect(report.decisions[0]!.knownEvidence).toEqual([]);
    const restoreDecision = report.decisions.find(
      (d) =>
        report.actions.find((t) => t.id === d.taskId)?.action.type ===
        'restore-documents',
    )!;
    expect(
      restoreDecision.knownEvidence.some(
        (e) =>
          e.source === 'Porównanie ERP / FS-01' &&
          e.summary.startsWith('88 poprawnych, 12 uszkodzonych'),
      ),
    ).toBe(true);
    expect(
      restoreDecision.knownEvidence.some((e) =>
        e.summary.includes('100 poprawnych'),
      ),
    ).toBe(false);
  });
  it('raport odróżnia odzyskaną integralność od późniejszej niedostępności usługi', () => {
    const restored = repair('old');
    const offline = {
      ...restored,
      world: {
        ...restored.world,
        assets: restored.world.assets.map((a) =>
          a.id === 'fs-01' ? { ...a, status: 'offline' as const } : a,
        ),
      },
    };
    const report = selectIntegrityReport(offline)!;
    expect(report.summary).toMatchObject({
      correct: 100,
      damaged: 0,
      serviceOnline: false,
      dataAvailable: false,
      verified: true,
    });
    expect(report.goalMet).toBe(false);
  });
  const strategies = [
    ['A brak reakcji', () => finish(initial())],
    ['B wczesna izolacja', () => finish(job(initial(), isolate))],
    [
      'C sam backup',
      () =>
        finish(
          job(job(job(initial(), inventory), verify()), restore('FS-1350')),
        ),
    ],
    ['D starsza + uzgodnienie + podłączenie', () => repair('old')],
    ['D nowsza + weryfikacja + podłączenie', () => repair('new')],
    [
      'E starsza bez uzgodnienia',
      () => finish(job(job(order(initial(), isolate), inventory), restore())),
    ],
    [
      'E zbędne wyłączenie VPN po odzyskaniu danych',
      () =>
        job(repairBeforeEnd(), {
          type: 'set-vpn',
          assetId: 'vpn',
          enabled: false,
        }),
    ],
  ] as const;
  function repairBeforeEnd() {
    let s = advance(order(order(initial(), inspect), isolate), 2);
    s = job(s, inventory);
    s = advance(order(order(s, restore()), examine), 2);
    s = advance(order(order(s, restrict), reconcile), 2);
    return advance(order(order(s, reconnect), inspect), 2);
  }
  it.each(strategies)(
    '%s — dokumenty i biznes pozostają zbilansowane',
    (name, run) => {
      let s = run();
      s = finish(s);
      const report = selectIntegrityReport(s)!;
      const c = report.summary;
      expect(c.correct + c.damaged + c.reconcile).toBe(100);
      expect(c.recovered).toBeLessThanOrEqual(100);
      expect(s.business.totalProcessed + s.business.backlog).toBe(360);
      expect(s.business.totalReceived).toBe(360);
      if (name.startsWith('D ')) expect(report.goalMet).toBe(true);
      else expect(report.goalMet).toBe(false);
      const expected = {
        'A brak reakcji': [0, 100, 0, 206, 154, null, null],
        'B wczesna izolacja': [88, 12, 0, 326, 34, null, null],
        'C sam backup': [0, 100, 0, 250, 110, 10, null],
        'D starsza + uzgodnienie + podłączenie': [100, 0, 0, 360, 0, 40, 45],
        'D nowsza + weryfikacja + podłączenie': [100, 0, 0, 360, 0, 10, 50],
        'E starsza bez uzgodnienia': [80, 0, 20, 311, 49, 40, null],
        'E zbędne wyłączenie VPN po odzyskaniu danych': [
          100, 0, 0, 254, 106, 40, 45,
        ],
      };
      expect([
        c.correct,
        c.damaged,
        c.reconcile,
        s.business.totalProcessed,
        s.business.backlog,
        c.rpoMinutes,
        c.rtoMinutes,
      ]).toEqual(expected[name]);
    },
  );
  it.each([
    {},
    { remoteAccess: true },
    { segmentation: true },
    { fileVisibility: true },
  ])(
    'F brak reakcji z inwestycją %j zachowuje skalę lokalnego uszkodzenia',
    (posture) => {
      const s = finish(initial(posture));
      expect(documentCounts(s.integrity!.documents).damaged).toBe(100);
      expect(s.business.totalProcessed).toBe(
        finish(initial()).business.totalProcessed,
      );
    },
  );
});
