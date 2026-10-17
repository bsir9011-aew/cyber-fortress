import { describe, it, expect } from 'vitest';
import {
  createIntegrityIncident,
  prepareCampaignDefinition,
} from '../application/prepareCampaignIncident';
import {
  campaignReducer,
  createCampaign,
} from '../application/campaignReducer';
import { createScenario } from '../application/createScenario';
import { selectIntegrityView } from '../application/selectIntegrityView';
import { selectIntegrityReport } from '../application/selectIntegrityReport';
import { integrityScenario } from '../content/scenarios/integrity';
import { pilotEndpointCoverage } from '../content/endpointCoverage';
import type { EndpointCoverage, EndpointRecord } from '../domain/resilience';
import type { SecurityPosture } from '../domain/campaign';
import { resolveLocalFileOperation } from './integrity';
import {
  availableEndpointRecords,
  collectEndpointTelemetry,
  detectEndpointAlerts,
  readEndpointTelemetry,
} from './endpointTelemetry';
import { testBackupProcedure, preparedRestoreTurns } from './backupReadiness';
import { taskRejection, taskSpecs } from './tasks';
import {
  advance,
  job,
  finish,
  isolate,
  restrict,
  examine,
  edr,
  inventory,
  restore,
  verify,
  deployed,
  reserve,
  reviewed,
  fund,
  assign,
  hour,
} from '../testSupport/resilience';
const initial = (extra: Partial<SecurityPosture> = {}) =>
  createIntegrityIncident(0, { ...createCampaign().posture, ...extra });
const covered = (changes: Partial<EndpointCoverage> = {}) =>
  initial({ endpointCoverage: { ...pilotEndpointCoverage, ...changes } });
const ready = () =>
  initial({
    backupReadiness: deployed(['backup-resilience']).posture.backupReadiness!,
  });
const record = (changes: Partial<EndpointRecord> = {}): EndpointRecord => ({
  id: 'event-1',
  sensorId: 'sensor',
  source: 'fortress-endpoint-agent',
  endpointId: 'pakowanie-03',
  accountId: 'packing-local',
  minute: 840,
  capturedAtMinute: 840,
  deliveredAtMinute: 840,
  availableAtMinute: 845,
  collectorId: 'collector',
  operation: 'modify',
  targetAssetId: 'fs-01',
  protocol: 'SMB',
  outcome: 'allowed',
  documentIds: Array.from({ length: 10 }, (_, n) => `DOC-${n + 1}`),
  ...changes,
});
const rule = pilotEndpointCoverage.detection;

describe('EDR: zdarzenia fizyczne, ograniczone pokrycie i dochodzenie', () => {
  it('bez projektu nie ma sensora, alertów ani działania EDR; pozostaje dziennik 10 min', () => {
    const s = initial();
    expect(s.telemetry.endpoint).toBeUndefined();
    expect(selectIntegrityView(s)?.edr).toBeNull();
    expect(taskRejection(s, 'analyst', edr)).toBe('source-unavailable');
    expect(taskSpecs[examine.type].turns).toBe(2);
    expect(job(s, examine).integrity?.endpointObservations).toHaveLength(1);
  });
  it('agent rejestruje rzeczywiste dopuszczone modify ze źródłem, kontem, celem i zakresem', () => {
    const s = covered();
    const event = s.telemetry.endpoint!.localEvents[0]!;
    expect(event).toMatchObject({
      endpointId: 'pakowanie-03',
      accountId: 'packing-local',
      source: 'fortress-endpoint-agent',
      minute: 835,
      capturedAtMinute: 835,
      targetAssetId: 'fs-01',
      operation: 'modify',
      outcome: 'allowed',
    });
    expect(event.documentIds).toHaveLength(12);
    expect(s.telemetry.endpoint?.alerts[0]?.assessment).toBe(
      'requires-investigation',
    );
    expect(s.integrity?.endpoint.isolated).toBe(false);
  });
  it.each([
    { agentAvailable: false },
    { operations: ['read'] as const },
    { endpointId: 'other-host' },
  ])('zdarzenia poza pokryciem %j nie są przechwytywane', (changes) => {
    expect(covered(changes).telemetry.endpoint?.localEvents).toEqual([]);
    expect(covered(changes).telemetry.endpoint?.alerts).toEqual([]);
  });
  it('offline endpoint nie generuje zdarzeń agenta', () => {
    const s = initial({
      endpointCoverage: pilotEndpointCoverage,
      assetOverrides: { workstations: 'offline' },
    });
    expect(s.telemetry.endpoint?.localEvents).toEqual([]);
    expect(selectIntegrityView(s)?.edr).toMatchObject({
      agentOnline: false,
      deliveryAvailable: false,
    });
  });
  it('początek pokrycia jest respektowany bez retrospektywnego skanu', () => {
    const s = covered();
    const e = {
      ...s.telemetry.endpoint!,
      coverageFromMinute: 845,
      localEvents: [],
      records: [],
      alerts: [],
    };
    const before = { ...s, telemetry: { ...s.telemetry, endpoint: e } };
    expect(
      resolveLocalFileOperation(
        before,
        'pakowanie-03',
        'modify',
        ['DOC-050'],
        840,
      ).state.telemetry.endpoint?.localEvents,
    ).toEqual([]);
  });
  it('ta sama rzeczywista operacja i prywatna klasyfikacja legalna/złośliwa dają te same rekordy', () => {
    const s = covered();
    const benign = {
      ...s,
      hidden: {
        ...s.hidden,
        integrityThreat: {
          ...s.hidden.integrityThreat!,
          compromised: false,
          nextIndex: 8,
        },
      },
    };
    const act = (v: typeof s) =>
      resolveLocalFileOperation(v, 'pakowanie-03', 'modify', ['DOC-080'], 840)
        .state.telemetry.endpoint;
    expect(act(s)).toEqual(act(benign));
  });
  it.each([
    ['dokładny próg', [record()], 845, 1],
    ['poniżej progu', [record({ documentIds: ['DOC-001'] })], 845, 0],
    ['opóźnienie', [record()], 844, 0],
    ['przyszłe dostarczenie', [record({ deliveredAtMinute: 850 })], 845, 0],
    ['poza oknem', [record({ minute: 834 })], 845, 0],
    ['granica okna', [record({ minute: 835 })], 845, 1],
    ['odmowa', [record({ outcome: 'denied' })], 845, 0],
    ['odczyt', [record({ operation: 'read' })], 845, 0],
    ['przyszłe zdarzenie', [record({ minute: 846 })], 845, 0],
    [
      'powtórzone ID',
      [
        record({ documentIds: ['DOC-001'] }),
        record({ documentIds: ['DOC-001'] }),
      ],
      845,
      0,
    ],
    [
      'różne stacje',
      [
        record({ documentIds: ['a', 'b', 'c', 'd', 'e'] }),
        record({
          id: 'event-2',
          endpointId: 'other',
          documentIds: ['a', 'b', 'c', 'd', 'e'],
        }),
      ],
      845,
      0,
    ],
  ] as const)('detektor: %s', (_name, records, minute, count) => {
    expect(detectEndpointAlerts(records, rule, minute, [])).toHaveLength(count);
  });
  it('legalny burst może spełnić próg; alert nie deklaruje kompromitacji', () => {
    const alerts = detectEndpointAlerts([record()], rule, 845, []);
    expect(alerts[0]).toMatchObject({
      modificationCount: 10,
      assessment: 'requires-investigation',
      eventIds: ['event-1'],
    });
    expect(detectEndpointAlerts([record()], rule, 845, alerts)).toEqual(alerts);
    expect(
      detectEndpointAlerts([record()], { ...rule, threshold: 11 }, 845, []),
    ).toEqual([]);
  });
  it('5-min badanie daje dowód dopiero po ukończeniu; bez automatycznej izolacji i naprawy', () => {
    const s = covered();
    const next = job(s, edr);
    expect(next.clock.turn).toBe(1);
    expect(next.telemetry.endpoint?.observations[0]?.records[0]?.minute).toBe(
      835,
    );
    expect(next.telemetry.endpoint?.observations[0]?.observedAtMinute).toBe(
      845,
    );
    expect(next.integrity?.endpoint.isolated).toBe(false);
    expect(
      next.integrity?.documents.filter((d) => d.status === 'damaged'),
    ).toHaveLength(12);
    expect(taskRejection(s, 'administrator', edr)).toBe('wrong-worker');
    expect(taskRejection(advance(s, 18), 'analyst', edr)).toBe(
      'outside-time-window',
    );
  });
  it('izolacja buforuje nowe rzeczywiste próby lokalnie; zdalne pobranie widzi tylko kolektor', () => {
    let s = job(covered(), isolate);
    expect(selectIntegrityView(s)?.edr).toMatchObject({
      agentOnline: true,
      deliveryAvailable: false,
    });
    const before = s.telemetry.endpoint!.records.length;
    s = resolveLocalFileOperation(
      s,
      'pakowanie-03',
      'modify',
      ['DOC-080'],
      845,
    ).state;
    const event = s.telemetry.endpoint!.localEvents.at(-1)!;
    expect(event).toMatchObject({ minute: 845, outcome: 'denied' });
    expect(s.telemetry.endpoint?.records).toHaveLength(before);
    const observed = readEndpointTelemetry(s, 'remote')!;
    expect(observed.records.some((r) => r.id === event.id)).toBe(false);
    expect(observed.records.some((r) => r.minute === 835)).toBe(true);
    expect(
      job(s, examine)
        .integrity?.endpointObservations.at(-1)
        ?.records.some((r) => r.minute === 845),
    ).toBe(true);
  });
  it('puste pobranie EDR nie zastępuje dowodu wymaganego przy ograniczaniu zapisu', () => {
    const s = job(job(covered({ agentAvailable: false }), isolate), edr);
    expect(s.telemetry.endpoint?.observations.at(-1)?.records).toEqual([]);
    expect(taskRejection(s, 'administrator', restrict)).toBe('invalid-state');
  });
  it('niedostępny kolektor blokuje badanie i dostarczanie; agent nadal przechwytuje', () => {
    const s = covered({ collectorAvailable: false });
    expect(s.telemetry.endpoint?.localEvents).toHaveLength(1);
    expect(s.telemetry.endpoint?.records).toEqual([]);
    expect(readEndpointTelemetry(s, 'remote')).toBeNull();
    expect(taskRejection(s, 'analyst', edr)).toBe('source-unavailable');
  });
  it('rekord spoza retencji nie jest dostępny i nie powraca po ponownym połączeniu', () => {
    let s = covered({ retentionMinutes: 5 });
    s = advance(s, 2);
    expect(
      availableEndpointRecords(s.telemetry.endpoint!, 850).some(
        (r) => r.minute === 835,
      ),
    ).toBe(false);
    expect(
      s.telemetry.endpoint?.localEvents.some((r) => r.minute === 835),
    ).toBe(false);
    const old = covered({ collectorAvailable: false, retentionMinutes: 5 });
    const later = {
      ...old,
      clock: { ...old.clock, turn: 3 },
      telemetry: {
        ...old.telemetry,
        endpoint: {
          ...old.telemetry.endpoint!,
          coverage: {
            ...old.telemetry.endpoint!.coverage,
            collectorAvailable: true,
          },
        },
      },
    };
    expect(collectEndpointTelemetry(later).endpoint?.records).toEqual([]);
  });
  it('bufor dostarcza po odzyskaniu drogi, z nowym czasem dostarczenia i opóźnieniem', () => {
    const s = covered({ collectorAvailable: false });
    const now = {
      ...s,
      clock: { ...s.clock, turn: 1 },
      telemetry: {
        ...s.telemetry,
        endpoint: {
          ...s.telemetry.endpoint!,
          coverage: {
            ...s.telemetry.endpoint!.coverage,
            collectorAvailable: true,
          },
        },
      },
    };
    const next = collectEndpointTelemetry(now).endpoint!;
    expect(next.records[0]).toMatchObject({
      minute: 835,
      deliveredAtMinute: 845,
      availableAtMinute: 850,
    });
    expect(availableEndpointRecords(next, 845)).toEqual([]);
    expect(availableEndpointRecords(next, 850)).toHaveLength(1);
  });
  it('identyfikatory nie powtarzają się po wygaśnięciu starszych zdarzeń', () => {
    const s = advance(covered({ retentionMinutes: 5 }), 10);
    const ids = [
      ...s.telemetry.endpoint!.localEvents.map((e) => e.id),
      ...s.telemetry.endpoint!.observations.flatMap((o) =>
        o.records.map((r) => r.id),
      ),
    ];
    expect(s.telemetry.endpoint!.nextEventNumber).toBeGreaterThan(
      s.telemetry.endpoint!.localEvents.length + 1,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('aktywny widok nie ujawnia bufora, przyszłych operacji, prywatnego planu ani kompromitacji', () => {
    const s = covered();
    const view = selectIntegrityView(s)!;
    expect(view.edr?.observations).toEqual([]);
    const encoded = JSON.stringify(view);
    for (const word of [
      'compromised',
      'localEvents',
      'nextIndex',
      'initialDamage',
      'attack',
      'documents',
      'hidden',
    ])
      expect(encoded).not.toContain(`"${word}"`);
    const changed = {
      ...s,
      hidden: {
        ...s.hidden,
        integrityThreat: {
          ...s.hidden.integrityThreat!,
          compromised: false,
          nextIndex: 9,
        },
      },
    };
    expect(selectIntegrityView(changed)).toEqual(view);
  });
});

describe('Backup Resilience: test konkretnej kopii, rzeczywiste predykaty odtworzenia', () => {
  const definition = integrityScenario.integrity!;
  const copy = definition.backups.find((b) => b.id === 'FS-1350')!;
  it('bez programu FS-1350 pozostaje niezbadana, restore 15 min, RPO 10 min', () => {
    const s = job(initial(), inventory),
      b = selectIntegrityView(s)!.backups.find((b) => b.id === 'FS-1350')!;
    expect(b).toMatchObject({
      verification: 'unknown',
      restoreTurns: 3,
      rpoMinutes: 10,
    });
    expect(taskRejection(s, 'administrator', restore)).toBe('invalid-state');
    expect(
      job(s, verify).integrity?.backups.find((b) => b.id === 'FS-1350')
        ?.verification,
    ).toBe('clean');
  });
  it('przygotowana FS-1350 ma wynik testu, restore 10 min i niezmienione RPO', () => {
    const s = job(ready(), inventory),
      b = selectIntegrityView(s)!.backups.find((b) => b.id === 'FS-1350')!;
    expect(b).toMatchObject({
      verification: 'clean',
      restoreTurns: 2,
      rpoMinutes: 10,
      count: 100,
    });
    const restored = job(s, restore);
    expect(restored.clock.turn - s.clock.turn).toBe(2);
    expect(restored.integrity?.recoveries.at(-1)?.missingDocuments).toBe(0);
  });
  it.each(['reserve', 'paid', 'one-worker'] as const)(
    'etap %s nie wykonuje testu',
    (stage) => {
      let s = reserve(campaignReducer(reviewed(), fund), 'backup-resilience');
      if (stage !== 'reserve')
        s = assign(s, 'backup-resilience', 'administrator');
      if (stage === 'one-worker')
        for (let n = 0; n < 3; n++) s = campaignReducer(s, hour);
      expect(s.posture.backupReadiness).toBeUndefined();
      const incident = createIntegrityIncident(0, s.posture);
      expect(
        incident.integrity?.backups.find((b) => b.id === 'FS-1350')
          ?.verification,
      ).toBe('unknown');
      expect(
        selectIntegrityView(job(incident, inventory))?.backups.find(
          (b) => b.id === 'FS-1350',
        )?.restoreTurns,
      ).toBe(3);
    },
  );
  it.each(['damaged', 'unavailable', 'fs-offline', 'erp-offline'] as const)(
    'test %s nie uznaje kopii za czystą',
    (kind) => {
      const d = {
        ...definition,
        backups: definition.backups.map((b) =>
          b.id === copy.id
            ? {
                ...b,
                damagedIds: kind === 'damaged' ? ['DOC-001'] : [],
                available: kind !== 'unavailable',
              }
            : b,
        ),
      };
      const world = {
        ...integrityScenario.world,
        assets: integrityScenario.world.assets.map((a) =>
          a.id ===
          (kind === 'fs-offline'
            ? 'fs-01'
            : kind === 'erp-offline'
              ? 'erp'
              : 'none')
            ? { ...a, status: 'offline' as const }
            : a,
        ),
      };
      const result = testBackupProcedure(d, world, 'erp', 3, 3);
      expect(result.restoreTestPassed).toBe(false);
      expect(result.integrity).toBe(
        kind === 'damaged' ? 'damaged' : 'unavailable',
      );
      expect(
        preparedRestoreTurns(d.backups.find((b) => b.id === copy.id)!, result),
      ).toBe(3);
      const scenario = { ...integrityScenario, integrity: d };
      const s = createScenario(
        prepareCampaignDefinition(scenario, {
          ...createCampaign().posture,
          backupReadiness: result,
        }),
        { mode: 'unknown', seed: 0 },
      );
      expect(
        s.integrity?.backups.find((b) => b.id === copy.id)?.verification,
      ).toBe(kind === 'damaged' ? 'damaged' : 'unknown');
    },
  );
  it('wynik starszej innej kopii nie weryfikuje aktualnej zawartości', () => {
    const readiness = deployed(['backup-resilience']).posture.backupReadiness!;
    const dirty = {
      ...integrityScenario,
      integrity: {
        ...definition,
        backups: definition.backups.map((b) =>
          b.id === copy.id ? { ...b, damagedIds: ['DOC-001'] } : b,
        ),
      },
    };
    const s = createScenario(
      prepareCampaignDefinition(dirty, {
        ...createCampaign().posture,
        backupReadiness: readiness,
      }),
      { mode: 'unknown', seed: 0 },
    );
    expect(
      s.integrity?.backups.find((b) => b.id === copy.id)?.verification,
    ).toBe('unknown');
    expect(preparedRestoreTurns(dirty.integrity.backups[1]!, readiness)).toBe(
      3,
    );
  });
  it.each(['fs-01', 'erp'])('restore wymaga dostępnej usługi %s', (id) => {
    const s = job(
      initial({
        backupReadiness: deployed(['backup-resilience']).posture
          .backupReadiness!,
        assetOverrides: { [id]: 'offline' },
      }),
      inventory,
    );
    expect(taskRejection(s, 'administrator', restore)).toBe(
      'source-unavailable',
    );
  });
  it('restore nie ogranicza źródła; ponowne uszkodzenie po przygotowanej kopii', () => {
    const s = finish(job(job(ready(), inventory), restore));
    const report = selectIntegrityReport(s)!;
    expect(report.summary.sourceHasWrite).toBe(true);
    expect(report.summary.damaged).toBeGreaterThan(0);
    expect(report.goalMet).toBe(false);
  });
  it('FS-1320 nadal ma 80 dokumentów i wymaga uzgodnienia pozostałych 20', () => {
    const s = job(job(job(ready(), isolate), inventory), {
      type: 'restore-documents',
      backupId: 'FS-1320',
    });
    expect(
      s.integrity?.documents.filter((d) => d.status === 'reconcile'),
    ).toHaveLength(20);
    expect(s.integrity?.recoveries.at(-1)?.missingDocuments).toBe(20);
  });
});
