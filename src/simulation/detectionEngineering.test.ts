import { describe, expect, it } from 'vitest';
import type { EndpointRecord } from '../domain/resilience';
import { pilotEndpointCoverage } from '../content/endpointCoverage';
import {
  detectEndpointAlerts,
  collectEndpointTelemetry,
} from './endpointTelemetry';
import {
  createDetectionIncident,
  createIntegrityIncident,
} from '../application/prepareCampaignIncident';
import { createCampaign } from '../application/campaignReducer';
import {
  selectDetectionScenario,
  DETECTION_FAMILY_ID,
  legalModificationScenario,
  slowModificationScenario,
} from '../content/scenarios/detection';
import { integrityScenario } from '../content/scenarios/integrity';
import { resolveLocalFileOperation } from './integrity';
import { simulationReducer } from '../application/simulationReducer';
import { selectIntegrityView } from '../application/selectIntegrityView';
import { selectDetectionReview } from '../application/selectDetectionReview';

const coverage = {
  ...pilotEndpointCoverage,
  detection: {
    ...pilotEndpointCoverage.detection,
    counting: 'unique-documents-v2' as const,
  },
};
const rule = coverage.detection;
const posture = { ...createCampaign().posture, endpointCoverage: coverage };
const seedFor = (id: string) =>
  [0, 1, 2].find(
    (seed) => selectDetectionScenario(DETECTION_FAMILY_ID, seed).id === id,
  )!;
const start = (id: string, threshold = 10, windowMinutes = 10) =>
  createDetectionIncident(
    seedFor(id),
    {
      ...posture,
      endpointCoverage: {
        ...coverage,
        detection: { ...rule, threshold, windowMinutes },
      },
    },
    DETECTION_FAMILY_ID,
  );
function record(id: string, minute: number, docs: string[]): EndpointRecord {
  return {
    id,
    minute,
    documentIds: docs,
    operation: 'modify',
    outcome: 'allowed',
    endpointId: coverage.endpointId,
    sensorId: coverage.sensorId,
    accountId: 'packing-local',
    source: 'fortress-endpoint-agent',
    targetAssetId: 'fs-01',
    protocol: 'SMB',
    capturedAtMinute: minute,
    deliveredAtMinute: minute,
    availableAtMinute: minute + 5,
    collectorId: coverage.collectorId,
  };
}
const docs = (n: number) => Array.from({ length: n }, (_, i) => `DOC-${i}`);
const next = (s: ReturnType<typeof start>, n = 1) => {
  for (let i = 0; i < n; i++)
    s = simulationReducer(s, { type: 'advance-turn' });
  return s;
};
describe('Detection Engineering: observable sliding windows', () => {
  it('counts unique document IDs, requires threshold and waits for delivery delay', () => {
    const events = [record('1', 840, docs(6)), record('2', 845, docs(6))];
    expect(detectEndpointAlerts(events, rule, 850, [])).toHaveLength(0);
    expect(
      detectEndpointAlerts(events, { ...rule, threshold: 6 }, 844, []),
    ).toHaveLength(0);
    const alerts = detectEndpointAlerts(
      events,
      { ...rule, threshold: 6 },
      850,
      [],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.modificationCount).toBe(6);
    expect(
      detectEndpointAlerts(
        [...events, ...events],
        { ...rule, threshold: 6 },
        850,
        [],
      )[0]!.modificationCount,
    ).toBe(6);
  });
  it.each([5, 10, 20])(
    'respects the inclusive %i-minute source window',
    (windowMinutes) => {
      const e = record('1', 840, docs(10));
      expect(
        detectEndpointAlerts(
          [e],
          { ...rule, windowMinutes },
          840 + windowMinutes,
          [],
        ),
      ).toHaveLength(1);
      expect(
        detectEndpointAlerts(
          [e],
          { ...rule, windowMinutes },
          841 + windowMinutes,
          [],
        ),
      ).toHaveLength(0);
    },
  );
  it('ignores read, denied and not-yet-delivered operations', () => {
    const e = record('1', 840, docs(30));
    for (const changed of [
      { ...e, operation: 'read' as const },
      { ...e, outcome: 'denied' as const },
      { ...e, deliveredAtMinute: 851 },
      { ...e, availableAtMinute: 851 },
    ])
      expect(detectEndpointAlerts([changed], rule, 850, [])).toHaveLength(0);
  });
  it('deduplicates a continuous series but rearms after a quiet window', () => {
    const a = record('1', 840, docs(12));
    let alerts = detectEndpointAlerts([a], rule, 845, []);
    const b = record('2', 845, docs(12));
    alerts = detectEndpointAlerts([a, b], rule, 850, alerts);
    alerts = detectEndpointAlerts([b], rule, 855, alerts);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.eventIds).toEqual(['1']); // Original triggering evidence stays immutable.
    const c = record('3', 870, docs(12));
    alerts = detectEndpointAlerts([c], rule, 875, alerts);
    expect(alerts).toHaveLength(2);
    expect(new Set(alerts.map((a) => a.id)).size).toBe(2);
  });
  it('collector filters scope, retention and future records before detection', () => {
    const s = start(legalModificationScenario.id);
    const e = record('1', 835, docs(30));
    const bad = [
      { ...e, id: 'wrong-sensor', sensorId: 'other' },
      { ...e, id: 'wrong-endpoint', endpointId: 'other' },
      { ...e, id: 'wrong-collector', collectorId: 'other' },
      { ...e, id: 'expired', minute: 700 },
      { ...e, id: 'future', minute: 845 },
    ];
    const altered = {
      ...s,
      telemetry: {
        ...s.telemetry,
        endpoint: { ...s.telemetry.endpoint!, records: bad },
      },
    };
    expect(collectEndpointTelemetry(altered).endpoint!.alerts).toHaveLength(0);
  });
});
describe('new integrity cases use real effects and preserve historical cases', () => {
  it('family selection is explicit, deterministic, and covers three cases', () => {
    expect(
      new Set(
        [0, 1, 2].map(
          (seed) => selectDetectionScenario(DETECTION_FAMILY_ID, seed).id,
        ),
      ).size,
    ).toBe(3);
    expect(
      selectDetectionScenario(DETECTION_FAMILY_ID, Number.MAX_SAFE_INTEGER),
    ).toEqual(
      selectDetectionScenario(DETECTION_FAMILY_ID, Number.MAX_SAFE_INTEGER),
    );
    expect(() => selectDetectionScenario('unknown', 0)).toThrow();
    const seed = seedFor(integrityScenario.id);
    const old = createIntegrityIncident(seed, posture);
    const unknown = start(integrityScenario.id);
    expect(unknown.integrity).toEqual(old.integrity);
    expect(unknown.hidden.integrityThreat).toEqual(old.hidden.integrityThreat);
    expect(next(unknown, 18).business).toEqual(next(old, 18).business);
    expect(next(unknown, 18).integrity?.documents).toEqual(
      next(old, 18).integrity?.documents,
    );
  });
  it('legal SMB modifications create FP signals without damaging data or penalizing business', () => {
    const s = next(start(legalModificationScenario.id), 18);
    expect(
      s.integrity!.documents.every(
        (d) => d.status === 'correct' && !d.everDamaged,
      ),
    ).toBe(true);
    expect(
      s.integrity!.operationRecords.some(
        (o) => o.operation === 'modify' && o.outcome === 'allowed',
      ),
    ).toBe(true);
    expect(s.hidden.integrityThreat!.compromised).toBe(false);
    expect(s.integrity!.documents.some((d) => d.generation > 0)).toBe(true);
    expect(s.business.totalProcessed).toBe(360);
    expect(s.business.backlog).toBe(0);
    const review = selectDetectionReview(s)!;
    expect(review.falsePositiveAlertIds).toHaveLength(3);
    expect(review.undetectedHarmfulOperationIds).toHaveLength(0);
  });
  it('low-and-slow produces real damage and no high-threshold alert; tuning exposes it', () => {
    const high = next(start(slowModificationScenario.id, 30, 20), 18);
    const low = next(start(slowModificationScenario.id, 2, 5), 18);
    expect(
      high.integrity!.documents.filter((d) => d.status === 'damaged'),
    ).toHaveLength(18);
    expect(high.telemetry.endpoint!.alerts).toHaveLength(0);
    expect(
      selectDetectionReview(high)!.undetectedHarmfulOperationIds,
    ).toHaveLength(9);
    expect(low.telemetry.endpoint!.alerts.length).toBeGreaterThan(0);
    expect(low.integrity!.documents).toEqual(high.integrity!.documents); // Detection alone never contains.
    expect(low.business).toEqual(high.business);
  });
  it.each([
    'isolated',
    'writesRestricted',
    'permission',
    'network',
    'missing-account',
  ] as const)(
    'real access control %s prevents both legal and harmful writes',
    (gate) => {
      for (const id of [
        legalModificationScenario.id,
        slowModificationScenario.id,
      ]) {
        const s = start(id);
        const endpoint = {
          ...s.integrity!.endpoint,
          isolated: gate === 'isolated',
          writesRestricted: gate === 'writesRestricted',
          permissions:
            gate === 'permission' ? [] : s.integrity!.endpoint.permissions,
        };
        const blocked = {
          ...s,
          integrity: { ...s.integrity!, endpoint },
          access: {
            ...s.access,
            rules: s.access.rules.map((r) =>
              gate === 'network' && r.id === 'R-LOCAL-SMB'
                ? { ...r, action: 'deny' as const }
                : r,
            ),
            accounts: s.access.accounts.filter(
              (a) => gate !== 'missing-account' || a.id !== 'packing-local',
            ),
          },
        };
        const result = resolveLocalFileOperation(
          blocked,
          endpoint.id,
          'modify',
          ['DOC-001'],
          840,
          id === legalModificationScenario.id ? 'preserve' : 'damage',
        );
        expect(result.allowed).toBe(false);
        expect(result.state.integrity!.documents).toEqual(
          s.integrity!.documents,
        );
      }
    },
  );
  it('sensor absence removes telemetry, not the local operation or manual investigation', () => {
    const seed = seedFor(slowModificationScenario.id);
    let s = createDetectionIncident(
      seed,
      createCampaign().posture,
      DETECTION_FAMILY_ID,
    );
    s = simulationReducer(s, {
      type: 'schedule-task',
      workerId: 'analyst',
      action: { type: 'examine-endpoint', endpointId: 'pakowanie-03' },
    });
    s = next(s, 4);
    expect(s.telemetry.endpoint).toBeUndefined();
    expect(
      s.integrity!.documents.filter((d) => d.status === 'damaged'),
    ).toHaveLength(4);
    expect(
      s.integrity!.endpointObservations[0]!.records.some(
        (r) => r.operation === 'modify',
      ),
    ).toBe(true);
  });
  it('hidden compromise never changes the detector or ongoing public evidence', () => {
    const s = next(start(legalModificationScenario.id), 2);
    const changed = {
      ...s,
      hidden: {
        ...s.hidden,
        integrityThreat: { ...s.hidden.integrityThreat!, compromised: true },
      },
    };
    expect(collectEndpointTelemetry(s)).toEqual(
      collectEndpointTelemetry(changed),
    );
    expect(selectIntegrityView(s)).toEqual(selectIntegrityView(changed));
    expect(selectDetectionReview(s)).toBeNull();
    const visible = JSON.stringify(selectIntegrityView(s));
    expect(visible).not.toContain('classification');
    expect(visible).not.toContain('falsePositive');
    expect(visible).not.toContain('compromised');
  });
  it('isolating after a legal alert creates a real capacity loss and backlog', () => {
    let s = next(start(legalModificationScenario.id), 2);
    expect(s.telemetry.endpoint!.alerts).toHaveLength(1);
    s = simulationReducer(s, {
      type: 'schedule-task',
      workerId: 'administrator',
      action: { type: 'isolate-endpoint', endpointId: 'pakowanie-03' },
    });
    s = next(s, 16);
    expect(s.integrity!.documents.every((d) => d.status === 'correct')).toBe(
      true,
    );
    expect(s.business.backlog).toBe(30);
    expect(s.business.totalProcessed).toBe(330);
    expect(selectDetectionReview(s)!.business.reducedPackingTurns).toBe(15);
  });
});
