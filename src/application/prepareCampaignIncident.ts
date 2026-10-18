import type { SecurityPosture } from '../domain/campaign';
import type { ScenarioDefinition } from '../domain/scenario';
import type { AuthenticationEvent } from '../domain/telemetry';
import type { AccessState, NetworkRule } from '../domain/access';
import { selectScenario } from './scenarioSelectors';
import { createScenario } from './createScenario';
import { issueVpnSession } from '../simulation/access';
import type { VendorApproval } from '../domain/vendor';
import type { BranchArchitecture } from '../domain/branch';
import { selectBranchScenario } from '../content/scenarios/branch';
import { selectRecoveryScenario } from '../content/scenarios/recovery';
import { selectVendorScenario } from '../content/scenarios/vendor';
import { selectDetectionScenario } from '../content/scenarios/detection';
import { integrityScenario } from '../content/scenarios/integrity';

/** Trwałe polityki nakładamy przed wszystkimi modelowanymi logowaniami. */
export function prepareCampaignDefinition(
  base: ScenarioDefinition,
  posture: SecurityPosture,
): ScenarioDefinition {
  const changed =
    (base.integrity && (posture.endpointCoverage || posture.backupReadiness)) ||
    (base.integrity && posture.endpointOverrides) ||
    posture.remoteAccess ||
    posture.fileVisibility ||
    posture.segmentation ||
    Object.keys(posture.ruleOverrides).length ||
    Object.keys(posture.accountOverrides).length ||
    Object.keys(posture.assetOverrides).length;
  if (!changed) return base;
  const source = structuredClone(base);
  const world = {
    ...source.world,
    assets: source.world.assets.map((a) => ({
      ...a,
      status: posture.assetOverrides[a.id] ?? a.status,
    })),
  };
  const legal = source.legitimateBehaviors.map((b) => ({
    ...b,
    ...(posture.remoteAccess ? { secondFactorVersion: 1 } : {}),
  }));
  const documentedFiles = new Set(
    (source.process.additionalWork ?? [])
      .filter((w) =>
        w.services.some(
          (s) => s.targetAssetId === 'fs-01' && s.protocol === 'SMB',
        ),
      )
      .map((w) => w.accountId),
  );
  const accounts = source.access.accounts.map((a) => ({
    ...a,
    ...posture.accountOverrides[a.id],
    ...(posture.remoteAccess
      ? { mfaPolicy: 'required' as const, secondFactorVersion: 1 }
      : {}),
  }));
  const segmented: NetworkRule[] = posture.segmentation
    ? [
        {
          id: 'SEG-ERP-WORK',
          sourceAssetId: 'vpn',
          targetAssetId: 'erp',
          protocol: 'HTTPS',
          priority: 1,
          action: 'allow',
          accountIds: ['dispatch-team', 'magazyn-07', 'file-team'].filter(
            (id) => accounts.some((a) => a.id === id),
          ),
        },
        {
          id: 'SEG-ERP-DENY',
          sourceAssetId: 'vpn',
          targetAssetId: 'erp',
          protocol: 'HTTPS',
          priority: 2,
          action: 'deny',
        },
        {
          id: 'SEG-SMB-DOCUMENTS',
          sourceAssetId: 'vpn',
          targetAssetId: 'fs-01',
          protocol: 'SMB',
          priority: 1,
          action: 'allow',
          accountIds: (posture.segmentationScope === 'file-team'
            ? ['file-team']
            : ['file-team', 'magazyn-07']
          ).filter((id) => accounts.some((a) => a.id === id)),
        },
        {
          id: 'SEG-SMB-DENY',
          sourceAssetId: 'vpn',
          targetAssetId: 'fs-01',
          protocol: 'SMB',
          priority: 2,
          action: 'deny',
        },
      ]
    : [];
  let access: AccessState = {
    ...source.access,
    accounts,
    sessions: [] as typeof source.access.sessions,
    rules: [...segmented, ...source.access.rules].map((r) => ({
      ...r,
      action: posture.ruleOverrides[r.id] ?? r.action,
    })),
    permissions: source.access.permissions.filter(
      (p) =>
        !(
          posture.remoteAccess &&
          p.accountId === 'magazyn-07' &&
          p.targetAssetId === 'fs-01' &&
          p.protocol === 'SMB' &&
          !documentedFiles.has(p.accountId)
        ),
    ),
  };
  type Request = {
    minute: number;
    accountId: string;
    credentialVersion: number;
    sessionId: string;
    secondFactorVersion?: number;
  };
  const requests: Request[] = source.telemetry.sourceEvents.map(
    (event, index) => {
      const actor = legal.find((a) => a.accountId === event.accountId);
      const account = accounts.find((a) => a.id === event.accountId)!;
      return {
        minute: event.minute,
        accountId: event.accountId,
        sessionId: event.sessionId ?? `PRE-${index}`,
        credentialVersion:
          event.outcome === 'failure'
            ? 0
            : actor?.credentialPolicy === 'managed-current'
              ? account.credentialVersion
              : (actor?.credentialVersion ??
                source.access.accounts.find((a) => a.id === event.accountId)!
                  .credentialVersion),
        ...(actor?.secondFactorVersion === undefined
          ? {}
          : { secondFactorVersion: actor.secondFactorVersion }),
      };
    },
  );
  for (const attempt of source.authenticationPrelude) {
    const actor = legal.find((a) => a.id === attempt.actorId)!;
    requests.push({
      minute: attempt.minute,
      accountId: actor.accountId,
      sessionId: attempt.requestedSessionId,
      credentialVersion:
        attempt.credentialVersion === actor.credentialVersion &&
        actor.credentialPolicy === 'managed-current'
          ? accounts.find((a) => a.id === actor.accountId)!.credentialVersion
          : attempt.credentialVersion,
      ...(actor.secondFactorVersion === undefined
        ? {}
        : { secondFactorVersion: actor.secondFactorVersion }),
    });
  }
  const events: AuthenticationEvent[] = [];
  const origins: Record<string, 'legitimate' | 'unauthorized'> = {};
  for (const request of requests.sort((a, b) => a.minute - b.minute)) {
    const result = issueVpnSession(world, access, request, request.minute);
    if (result.ok) {
      access = result.access;
      origins[result.session.id] =
        source.initialSessionOrigins[result.session.id] ?? 'legitimate';
    }
    if (
      world.assets.some(
        (a) => a.id === access.vpnAssetId && a.status === 'online',
      )
    )
      events.push({
        id: `AUTH-${String(events.length + 1).padStart(4, '0')}`,
        minute: request.minute,
        sourceAssetId: access.vpnAssetId,
        accountId: request.accountId,
        outcome: result.ok ? 'success' : 'failure',
        sessionId: result.ok ? result.session.id : null,
        ...(!result.ok ? { reason: result.reason } : {}),
      });
  }
  const prevented =
    source.attacker?.initialSessionId &&
    !access.sessions.some((s) => s.id === source.attacker!.initialSessionId);
  return {
    ...source,
    world,
    access,
    legitimateBehaviors: legal,
    briefing:
      events.length || source.integrity || source.recovery || source.branch
        ? source.briefing
        : {
            ...source.briefing,
            message:
              'Do 15:30 musimy zamknąć wysyłki. Odziedziczona dostępność usług nie pozwala zebrać początkowych logów VPN. Sprawdź dokumentację, przywróć wymagane przepływy i pozyskaj dostępne dowody; brak odczytu nie dowodzi braku zagrożenia.',
          },
    initialSessionOrigins: origins,
    authenticationPrelude: [],
    attacker: prevented
      ? {
          ...source.attacker!,
          initialSessionId: null,
          firstAuthenticationTurn: 1,
        }
      : source.attacker,
    explanation: prevented
      ? 'Planowana próba uzyskania S-19 przed oknem incydentu nie wydała tunelu. Logowanie rozstrzygnięto według odziedziczonej polityki i posiadanego materiału uwierzytelniającego. Typ scenariusza nie został podmieniony.'
      : source.explanation,
    telemetry: {
      ...source.telemetry,
      authenticationReasons: true,
      sourceEvents: events,
      processedSourceCount: 0,
      authenticationRecords: [],
      ...(source.integrity && posture.endpointCoverage
        ? {
            endpoint: {
              coverage: structuredClone(posture.endpointCoverage),
              coverageFromMinute: source.clock.startMinute - 5,
              nextEventNumber: 1,
              localEvents: [],
              records: [],
              alerts: [],
              observations: [],
            },
          }
        : {}),
      ...(posture.fileVisibility
        ? {
            fileAudit: {
              sensor: {
                id: 'fs-01-audit',
                sourceAssetId: 'fs-01',
                enabled: true,
                coverageFromMinute: source.clock.startMinute,
                retentionMinutes: 120,
                delayMinutes: 5,
              },
              sourceEvents: [],
              records: [],
              processedSourceCount: 0,
            },
          }
        : {}),
    },
    ...(source.integrity && posture.backupReadiness
      ? { backupReadiness: structuredClone(posture.backupReadiness) }
      : {}),
    ...(source.integrity
      ? {
          integrity: {
            ...source.integrity,
            endpoint: {
              ...source.integrity.endpoint,
              ...posture.endpointOverrides?.[source.integrity.endpoint.id],
            },
          },
        }
      : {}),
  };
}
export function createIntegrityIncident(
  seed: number,
  posture: SecurityPosture,
) {
  return createScenario(prepareCampaignDefinition(integrityScenario, posture), {
    mode: 'unknown',
    seed,
  });
}
export function createCampaignIncident(seed: number, posture: SecurityPosture) {
  return createScenario(
    prepareCampaignDefinition(selectScenario('unknown', seed), posture),
    { mode: 'unknown', seed },
  );
}

export function createDetectionIncident(
  seed: number,
  posture: SecurityPosture,
  familyId: string,
) {
  const coverage = posture.endpointCoverage;
  return createScenario(
    prepareCampaignDefinition(selectDetectionScenario(familyId, seed), {
      ...posture,
      ...(coverage
        ? {
            endpointCoverage: {
              ...coverage,
              detection: {
                ...coverage.detection,
                name: 'Unusual Document Modification Activity',
                counting: 'unique-documents-v2',
              },
            },
          }
        : {}),
    }),
    { mode: 'unknown', seed },
  );
}

export function createVendorIncident(
  seed: number,
  posture: SecurityPosture,
  familyId: string,
  approval: VendorApproval | undefined,
) {
  const base = selectVendorScenario(familyId, seed);
  return createScenario(
    prepareCampaignDefinition(
      {
        ...base,
        access: {
          ...base.access,
          vendorAuthorization: {
            accountId: 'cargo-link-operator',
            exception: approval
              ? {
                  approvalId: approval.id,
                  scope: approval.scope,
                  validFromMinute: base.clock.startMinute,
                  expiresAtMinute: approval.expiresAtMinute,
                  status: 'active',
                }
              : null,
          },
        },
      },
      posture,
    ),
    { mode: 'unknown', seed },
  );
}

export function createRecoveryIncident(
  seed: number,
  posture: SecurityPosture,
  familyId: string,
) {
  return createScenario(
    prepareCampaignDefinition(selectRecoveryScenario(familyId, seed), posture),
    { mode: 'unknown', seed },
  );
}

export function createBranchIncident(
  seed: number,
  posture: SecurityPosture,
  familyId: string,
  architecture: BranchArchitecture,
) {
  return createScenario(
    prepareCampaignDefinition(
      selectBranchScenario(familyId, seed, architecture),
      posture,
    ),
    { mode: 'unknown', seed },
  );
}
