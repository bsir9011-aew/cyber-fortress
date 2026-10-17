import { describe, expect, it } from 'vitest';
import { createCampaign } from '../application/campaignReducer';
import { createVendorIncident } from '../application/prepareCampaignIncident';
import {
  selectVendorScenario,
  VENDOR_FAMILY_ID,
} from '../content/scenarios/vendor';
import type {
  VendorApproval,
  VendorExpiry,
  VendorScope,
} from '../domain/vendor';
import type { SecurityPosture } from '../domain/campaign';
import { canUseService, isSessionActive } from './access';
import { advance, order } from '../testSupport/resilience';
import { simulationReducer } from '../application/simulationReducer';
import { businessAvailability } from './business';
import { selectPlayerView } from '../application/selectPlayerView';
import { selectVendorReport } from '../application/selectVendorReport';
import { selectVendorView } from '../application/selectVendorView';
const posture = createCampaign().posture;
const approval = (
  scope: VendorScope = 'api-only',
  expiresAtMinute: VendorExpiry = 930,
): VendorApproval => ({
  id: 'CARGO-APPROVAL-1',
  scope,
  expiresAtMinute,
  window: 3,
  startHour: 0,
  completedHour: 1,
  usedInWindow: 3,
});
function start(
  variant: 'standard' | 'documents' | 'abuse',
  scope: VendorScope | null = 'api-only',
  expiry: VendorExpiry = 930,
  p: SecurityPosture = posture,
) {
  const seed = [0, 1, 2].find(
    (seed) =>
      selectVendorScenario(VENDOR_FAMILY_ID, seed).id ===
      `nexus-vendor-${variant}`,
  )!;
  return createVendorIncident(
    seed,
    p,
    VENDOR_FAMILY_ID,
    scope ? approval(scope, expiry) : undefined,
  );
}
const use = (
  s: ReturnType<typeof start>,
  target = 'carrier-api',
  protocol = 'HTTPS',
  minute = 840,
) => canUseService(s.world, s.access, 'CARGO-01', target, protocol, minute);
const inspect = (s: ReturnType<typeof start>) =>
  advance(order(s, { type: 'inspect-vendor-operations' }));
describe('vendor exception is mandatory service authorization', () => {
  it('narrow scope permits HTTPS, rejects SMB, and expiration denies the same live session without changing identity', () => {
    const s = start('standard', 'api-only', 870);
    expect(use(s, 'carrier-api', 'HTTPS', 865)).toBe(true);
    expect(use(s, 'fs-01', 'SMB', 865)).toBe(false);
    expect(use(s, 'carrier-api', 'HTTPS', 870)).toBe(false);
    expect(
      isSessionActive(s.access.sessions.find((x) => x.id === 'CARGO-01')!, 870),
    ).toBe(true);
    const end = advance(s, 6);
    expect(end.access.vendorAuthorization!.exception!.status).toBe('expired');
    expect(end.access.accounts).toEqual(s.access.accounts);
    expect(end.access.sessions).toEqual(s.access.sessions);
  });
  it('wide scope permits both services but cannot override real topology, availability, account, ACL, permission or session checks', () => {
    const s = start('documents', 'api-and-files');
    expect(use(s)).toBe(true);
    expect(use(s, 'fs-01', 'SMB')).toBe(true);
    for (const gate of [
      'topology',
      'source-path',
      'service',
      'acl',
      'permission',
      'account',
      'session',
    ] as const) {
      const changed = {
        ...s,
        world: {
          ...s.world,
          connections: s.world.connections.filter((c) =>
            gate === 'topology'
              ? c.id !== 'vpn-files'
              : gate === 'source-path'
                ? c.id !== 'cargo-vpn'
                : true,
          ),
          assets: s.world.assets.map((a) =>
            gate === 'service' && a.id === 'fs-01'
              ? { ...a, status: 'offline' as const }
              : a,
          ),
        },
        access: {
          ...s.access,
          permissions: s.access.permissions.filter(
            (p) =>
              gate !== 'permission' ||
              p.accountId !== 'cargo-link-operator' ||
              p.protocol !== 'SMB',
          ),
          accounts: s.access.accounts.filter(
            (a) => gate !== 'account' || a.id !== 'cargo-link-operator',
          ),
          sessions: s.access.sessions.map((x) =>
            gate === 'session' && x.id === 'CARGO-01'
              ? { ...x, status: 'terminated' as const }
              : x,
          ),
          rules: s.access.rules.map((r) =>
            gate === 'acl' && r.id === 'CARGO-SMB'
              ? { ...r, action: 'deny' as const }
              : r,
          ),
        },
      };
      expect(use(changed, 'fs-01', 'SMB'), gate).toBe(false);
    }
  });
  it('no grant and expired grant deny even a higher-priority generic allow and all base permissions', () => {
    const withoutMetadata = start('standard', 'api-and-files');
    const accessWithoutMetadata = { ...withoutMetadata.access };
    delete accessWithoutMetadata.vendorAuthorization;
    expect(use({ ...withoutMetadata, access: accessWithoutMetadata })).toBe(
      false,
    );
    for (const s of [
      start('standard', null),
      start('standard', 'api-and-files', 870),
    ]) {
      const changed = {
        ...s,
        access: {
          ...s.access,
          rules: [
            {
              id: 'generic',
              sourceAssetId: 'vpn',
              targetAssetId: 'fs-01',
              protocol: 'SMB',
              priority: -1,
              action: 'allow' as const,
            },
            ...s.access.rules,
          ],
        },
      };
      expect(use(changed, 'fs-01', 'SMB', 870)).toBe(false);
      expect(use(changed, 'carrier-api', 'HTTPS', 870)).toBe(false);
    }
  });
});
describe('real vendor work, attack and evidence', () => {
  it('no exception removes 6 capacity, while completed HTTPS work needs no perpetual access or extra-long reward', () => {
    const blocked = advance(start('standard', null), 18);
    expect(blocked.business.totalProcessed).toBe(288);
    expect(blocked.business.backlog).toBe(72);
    const short = advance(start('standard', 'api-only', 870), 18),
      long = advance(start('standard', 'api-only', 930), 18);
    expect(short.vendor!.completedBatches).toBe(6);
    expect(short.business.totalProcessed).toBe(360);
    expect(long.business).toEqual(short.business);
    expect(short.vendor!.operations).toHaveLength(6);
    expect(use(short, 'carrier-api', 'HTTPS', 930)).toBe(false);
    expect(businessAvailability(short).capacity).toBe(22);
  });
  it('legal SMB dependency differs from abuse: narrow blocks required documents, wide completes 12 batches, short window interrupts them', () => {
    const narrow = advance(start('documents', 'api-only'), 18);
    const wide = advance(start('documents', 'api-and-files', 900), 18);
    const short = advance(start('documents', 'api-and-files', 870), 18);
    expect(
      narrow.vendor!.operations.some(
        (o) =>
          o.protocol === 'SMB' &&
          o.outcome === 'denied' &&
          o.origin === 'legitimate',
      ),
    ).toBe(true);
    expect(narrow.vendor!.completedBatches).toBe(0);
    expect(narrow.business.backlog).toBe(72);
    expect(wide.vendor!.completedBatches).toBe(12);
    expect(wide.business.backlog).toBe(0);
    expect(short.vendor!.completedBatches).toBe(6);
    expect(short.business.backlog).toBe(48);
    expect(selectVendorReport(wide)!.summary.exposedRecords).toBe(0);
  });
  it('abuse uses real new authentication and SMB permissions; earlier reads remain after expiry', () => {
    const narrow = advance(start('abuse', 'api-only'), 18),
      wide = advance(start('abuse', 'api-and-files'), 18),
      short = advance(start('abuse', 'api-and-files', 870), 18);
    expect(narrow.hidden.attacker!.authenticationAttempts).toBe(1);
    expect(
      narrow.vendor!.operations.some(
        (o) => o.origin === 'unauthorized' && o.outcome === 'denied',
      ),
    ).toBe(true);
    expect(narrow.hidden.attacker!.transfer.exposedRecords).toBe(0);
    expect(wide.hidden.attacker!.transfer.exposedRecords).toBe(2000);
    expect(short.hidden.attacker!.transfer.exposedRecords).toBe(400);
    expect(selectVendorReport(short)!.summary.accessAfterDeadline).toBe(false);
  });
  it('inherited MFA applies to supplier login; attacker never obtains the legitimate second factor', () => {
    const s = advance(
      start('abuse', 'api-and-files', 930, { ...posture, remoteAccess: true }),
      18,
    );
    expect(
      s.access.accounts.find((a) => a.id === 'cargo-link-operator')!.mfaPolicy,
    ).toBe('required');
    expect(s.access.sessions.some((x) => x.id === 'CARGO-01')).toBe(true);
    expect(
      s.telemetry.sourceEvents.some(
        (e) =>
          e.accountId === 'cargo-link-operator' && e.reason === 'mfa-required',
      ),
    ).toBe(true);
    expect(s.hidden.attacker!.transfer.exposedRecords).toBe(0);
    expect(
      s.access.sessions.filter(
        (x) => s.hidden.sessionOrigins[x.id] === 'unauthorized',
      ),
    ).toHaveLength(0);
  });
  it('investigation copies real monitor facts with no future operations or origin labels; EDR is not external coverage', () => {
    const s = inspect(
      start('documents', 'api-only', 930, {
        ...posture,
        endpointCoverage: {
          endpointId: 'pakowanie-03',
          sensorId: 'edr',
          agentAvailable: true,
          collectorId: 'collector',
          collectorAvailable: true,
          operations: ['modify'],
          delayMinutes: 5,
          retentionMinutes: 120,
          detection: {
            id: 'd',
            name: 'd',
            operation: 'modify',
            threshold: 10,
            windowMinutes: 10,
          },
        },
      }),
    );
    const observation = s.vendor!.observations[0]!;
    expect(observation.records).toHaveLength(2);
    expect(
      observation.records.every(
        (r) => r.minute <= observation.observedAtMinute,
      ),
    ).toBe(true);
    expect(JSON.stringify(observation)).not.toContain('origin');
    expect(s.telemetry.endpoint).toBeUndefined();
    const later = advance(s, 2);
    expect(later.vendor!.observations[0]).toEqual(observation);
    const view = selectPlayerView(later);
    expect(JSON.stringify(view)).not.toContain('requiresFiles');
    expect(JSON.stringify(view)).not.toContain('nexus-vendor-documents');
    expect(JSON.stringify(view)).not.toContain(
      later.hidden.scenario.explanation,
    );
    expect(selectVendorReport(later)).toBeNull();
  });
  it('FS-01 audit receives actual supplier reads with its own capture delay and retention', () => {
    let s = start('documents', 'api-and-files', 930, {
      ...posture,
      fileVisibility: true,
    });
    s = advance(order(s, { type: 'inspect-file-access' }));
    expect(s.knowledge.fileObservations![0]!.records).toHaveLength(0);
    s = advance(order(s, { type: 'inspect-file-access' }));
    const records = s.knowledge.fileObservations![1]!.records;
    expect(
      records.some(
        (r) => r.accountId === 'cargo-link-operator' && r.outcome === 'allowed',
      ),
    ).toBe(true);
    expect(records.every((r) => r.availableAtMinute <= 850)).toBe(true);
  });
});
describe('controlled incident reactions', () => {
  it('narrowing takes 10 minutes, preserves HTTPS and sessions, and respects administrator exclusivity', () => {
    let s = start('documents', 'api-and-files');
    const identity = s.access.accounts,
      sessions = s.access.sessions;
    s = order(s, {
      type: 'narrow-vendor-exception',
      approvalId: 'CARGO-APPROVAL-1',
    });
    expect(use(s, 'fs-01', 'SMB')).toBe(true);
    s = simulationReducer(s, {
      type: 'schedule-task',
      workerId: 'administrator',
      action: {
        type: 'revoke-vendor-exception',
        approvalId: 'CARGO-APPROVAL-1',
      },
    });
    expect(s.history.at(-1)).toMatchObject({
      kind: 'command-rejected',
      reason: 'worker-busy',
    });
    s = advance(s);
    expect(use(s, 'fs-01', 'SMB', 845)).toBe(true);
    s = advance(s);
    expect(use(s, 'fs-01', 'SMB', 850)).toBe(false);
    expect(use(s, 'carrier-api', 'HTTPS', 850)).toBe(true);
    expect(s.access.accounts).toEqual(identity);
    expect(s.access.sessions).toEqual(sessions);
    expect(advance(s, 16).business.backlog).toBeGreaterThan(0);
  });
  it('reactive expansion takes real time, preserves deadline, and enables legitimate document work', () => {
    let s = inspect(start('documents', 'api-only'));
    s = order(s, {
      type: 'expand-vendor-exception',
      approvalId: 'CARGO-APPROVAL-1',
    });
    expect(use(s, 'fs-01', 'SMB', 845)).toBe(false);
    s = advance(s, 2);
    expect(use(s, 'fs-01', 'SMB', 855)).toBe(true);
    expect(s.access.vendorAuthorization!.exception!.expiresAtMinute).toBe(930);
    const end = advance(s, 15);
    expect(end.vendor!.completedBatches).toBe(12);
    expect(end.business.backlog).toBe(0);
  });
  it('revocation costs one turn and never resets accounts or revives terminated sessions', () => {
    let s = start('standard', 'api-and-files');
    const original = s.access;
    s = advance(
      order(s, {
        type: 'revoke-vendor-exception',
        approvalId: 'CARGO-APPROVAL-1',
      }),
    );
    expect(use(s, 'carrier-api', 'HTTPS', 845)).toBe(false);
    expect(use(s, 'fs-01', 'SMB', 845)).toBe(false);
    expect(s.access.sessions).toEqual(original.sessions);
    expect(s.access.accounts).toEqual(original.accounts);
    expect(
      selectVendorView(s)!
        .actions.filter((a) => 'approvalId' in a.action)
        .every((a) => a.rejection !== null),
    ).toBe(true);
  });
  it('rejects nonexistent, redundant, expired and impossible-to-complete changes', () => {
    for (const [s, action] of [
      [
        start('standard', null),
        { type: 'revoke-vendor-exception', approvalId: 'CARGO-APPROVAL-1' },
      ],
      [
        start('standard'),
        { type: 'revoke-vendor-exception', approvalId: 'missing' },
      ],
      [
        start('standard'),
        { type: 'narrow-vendor-exception', approvalId: 'CARGO-APPROVAL-1' },
      ],
      [
        advance(start('standard', 'api-and-files', 870), 6),
        { type: 'narrow-vendor-exception', approvalId: 'CARGO-APPROVAL-1' },
      ],
      [
        advance(start('standard', 'api-and-files', 870), 5),
        { type: 'revoke-vendor-exception', approvalId: 'CARGO-APPROVAL-1' },
      ],
    ] as const) {
      const next = simulationReducer(s, {
        type: 'schedule-task',
        workerId: 'administrator',
        action,
      });
      expect(next.tasks).toHaveLength(0);
      expect(next.history.at(-1)?.kind).toBe('command-rejected');
    }
  });
});
