import type { ScenarioDefinition } from '../../domain/scenario';
import type { BranchArchitecture } from '../../domain/branch';
import type { VendorApproval } from '../../domain/vendor';
import { integrityScenario } from './integrity';
import { selectVendorScenario } from './vendor';
import { selectRecoveryScenario } from './recovery';
import { selectBranchScenario, defaultBranchArchitecture } from './branch';
export const FINALE_FAMILY_ID = 'nexus-campaign-finale-v1' as const;
/** Compose declared infrastructure, not multiple independent simulations. First definition owns shared IDs. */
const unique = <T extends { readonly id: string }>(
  ...lists: readonly (readonly T[])[]
): T[] => [
  ...new Map(
    lists
      .flat()
      .reverse()
      .map((x) => [x.id, x]),
  ).values(),
];
export function selectFinaleScenario(
  familyId: string,
  seed: number,
  architecture: BranchArchitecture = defaultBranchArchitecture,
  approval?: VendorApproval,
): ScenarioDefinition {
  if (familyId !== FINALE_FAMILY_ID || !Number.isSafeInteger(seed) || seed < 0)
    throw new Error('Invalid finale family/seed');
  const variant = (['crossfire', 'false-lead', 'cascade'] as const)[seed % 3]!;
  const i = integrityScenario,
    r = selectRecoveryScenario('nexus-erp-recovery-v1', 0),
    v = selectVendorScenario('nexus-vendor-access-v1', 0),
    b = selectBranchScenario('nexus-east-branch-v1', 1, architecture);
  const extraRoutes = [
    ['firewall', 'erp-standby', 'HTTPS'],
    ['east-backup-gateway', 'erp-standby', 'HTTPS'],
    ['carrier-api', 'erp', 'HTTPS'],
    ['carrier-api', 'erp-standby', 'HTTPS'],
  ].map(([source, target, protocol], n) => ({
    id: `FIN-ROUTE-${n}`,
    sourceAssetId: source!,
    targetAssetId: target!,
    protocol: protocol!,
    kind: 'network' as const,
    label: protocol!,
    description:
      'Udokumentowana droga finału; ACL, uprawnienia i działanie usługi są niezależne.',
  }));
  const rules = extraRoutes.map((c, n) => ({
    id: c.id,
    sourceAssetId: c.sourceAssetId,
    targetAssetId: c.targetAssetId,
    protocol: c.protocol,
    priority: 10,
    action: (n < 2 && !architecture.erpEnabled ? 'deny' : 'allow') as
      | 'allow'
      | 'deny',
    ...(n < 2
      ? { accountIds: ['east-operator', 'east-documents'] }
      : { accountIds: ['cargo-link-operator'] }),
  }));
  return {
    ...r,
    familyId: FINALE_FAMILY_ID,
    kind: 'campaign-finale',
    id: `nexus-finale-${variant}`,
    name: 'Kryzys w NEXUS',
    finale: { familyId: FINALE_FAMILY_ID, variant, faultTurn: 3 },
    explanation:
      variant === 'crossfire'
        ? 'Dwa niezależne zdarzenia: lokalne modyfikacje dokumentów przez pakowanie-03 oraz zatrzymanie procesu ERP o 14:15. Baza i storage ERP pozostały poprawne. Lokalny SMB działa niezależnie od procesu ERP.'
        : variant === 'false-lead'
          ? 'Intensywne legalne modyfikacje pakowanie-03 nie uszkadzały dokumentów. Osobny sprawca od 14:10 próbował uwierzytelnienia poświadczeniem CARGO-LINK w wersji 1, bez drugiego składnika, a następnie dostępu SMB przez rzeczywiste zabezpieczenia.'
          : 'O 14:15 wystąpiły dwie niezależne awarie dostępności: primary storage ERP oraz podstawowe łącze EAST. Brak napastnika. Niezależny standby zawierał starsze dane; droga backupowa oddziału nie naprawiała ERP i nie przenosiła SMB.',
    world: {
      ...b.world,
      teams: unique(b.world.teams, v.world.teams),
      assets: unique(b.world.assets, r.world.assets, v.world.assets),
      connections: unique(
        b.world.connections,
        i.world.connections,
        r.world.connections,
        v.world.connections,
        extraRoutes,
      ),
    },
    access: {
      ...r.access,
      identities: unique(
        r.access.identities,
        i.access.identities,
        b.access.identities,
        v.access.identities,
      ),
      accounts: unique(
        r.access.accounts,
        i.access.accounts,
        b.access.accounts,
        v.access.accounts,
      ),
      permissions: [
        ...r.access.permissions,
        ...i.access.permissions,
        ...b.access.permissions,
        ...v.access.permissions,
        ...['east-operator', 'east-documents']
          .filter(() => architecture.erpEnabled)
          .map((accountId) => ({
            accountId,
            targetAssetId: 'erp-standby',
            protocol: 'HTTPS',
          })),
        {
          accountId: 'cargo-link-operator',
          targetAssetId: 'erp',
          protocol: 'HTTPS',
        },
        {
          accountId: 'cargo-link-operator',
          targetAssetId: 'erp-standby',
          protocol: 'HTTPS',
        },
      ].filter(
        (p, n, all) =>
          all.findIndex(
            (q) =>
              q.accountId === p.accountId &&
              q.targetAssetId === p.targetAssetId &&
              q.protocol === p.protocol,
          ) === n,
      ),
      rules: unique(
        b.access.rules,
        i.access.rules,
        r.access.rules,
        v.access.rules,
        rules,
      ),
      vendorAuthorization: {
        accountId: 'cargo-link-operator',
        exception: approval
          ? {
              approvalId: approval.id,
              scope: approval.scope,
              validFromMinute: 840,
              expiresAtMinute: approval.expiresAtMinute,
              status: 'active',
            }
          : null,
      },
    },
    process: {
      ...b.process,
      id: 'nexus-finale-shipping',
      name: 'Wspólne okno wysyłkowe NEXUS',
      additionalWork: [
        { ...b.process.additionalWork![0]!, capacity: 3 },
        { ...v.process.additionalWork![0]!, capacity: 3 },
      ],
    },
    legitimateBehaviors: v.legitimateBehaviors,
    authenticationPrelude: v.authenticationPrelude,
    integrity: {
      ...i.integrity!,
      initialDamage: 0,
      attack: {
        compromised: variant === 'crossfire',
        turns: [2, 4, 6, 8, 10, 12, 14, 16, 18],
        chunkSize: 20,
      },
      ...(variant === 'false-lead'
        ? {
            legitimateModifications: {
              turns: [2, 3, 4, 5, 6, 7],
              chunkSize: 20,
            },
          }
        : {}),
      endpoint: {
        ...i.integrity!.endpoint,
        permissions: [
          ...i.integrity!.endpoint.permissions,
          { assetId: 'erp-standby', protocol: 'HTTPS', operations: ['read'] },
        ],
      },
    },
    recovery: {
      ...r.recovery!,
      primary: { ...r.recovery!.primary, processRunning: true },
    },
    vendor: {
      familyId: 'nexus-vendor-access-v1',
      requiresFiles: false,
      requiredBatches: 18,
    },
    branch: {
      ...b.branch!,
      requiresDocuments: true,
      documentsFromTurn: 0,
      linkFailureTurn: variant === 'cascade' ? 3 : null,
      compromisedContextId: null,
    },
    attacker:
      variant === 'false-lead'
        ? {
            id: 'finale-vendor-abuse',
            accountId: 'cargo-link-operator',
            stolenCredentialVersion: 1,
            initialSessionId: null,
            firstAuthenticationTurn: 2,
            knownGatewayAssetId: 'vpn',
            targetAssetId: 'fs-01',
            protocol: 'SMB',
            recordLimit: 2000,
            chunkSizes: [400, 400, 400, 400, 400],
            firstReconnaissanceTurn: 3,
            retryDelayTurns: 2,
            maxConsecutiveFailures: 12,
          }
        : null,
    goals: {
      recordPool: 2000,
      maxExposedRecords: 0,
      maxFinalBacklog: 40,
      requireThreatContainment: variant !== 'cascade',
    },
    briefing: {
      title: 'Misja 06 — Kryzys w NEXUS',
      message:
        '14:00–15:30. Intensywne okno wysyłkowe: centrala 8, zdalni dyspozytorzy 8, EAST 3, CARGO-LINK 3; wspólne 20 nowych zamówień/turę, maksymalna wydajność 22. Docierają zgłoszenia niestabilności i wzmożonej pracy. Przyczyna nieustalona. Lokalny SMB, ERP, VPN i tunel EAST mają odrębne zależności. Zbierz dowody i rozdziel pracę jednego administratora oraz jednego analityka. Cel: brak naruszeń i nieuzgodnionych operacji, użyteczne usługi, do 40 zaległości. Trasa zapasowa EAST obsługuje tylko HTTPS; wymaga wcześniejszego przygotowania. Standby ERP wymaga uzgodnienia starszych danych. Brak wyjątku dostawcy można uzupełnić jawnym zadaniem 10 min.',
      analystHint:
        'Badanie ERP 5 min, bazy/storage 10 min, dokumentów 10 min, EDR 5 min (jeśli wdrożony), VPN i CARGO-LINK po 5 min, łącza EAST 5 min. Alert wymaga weryfikacji. Ustaw roboczą ocenę sytuacji na podstawie pozyskanych dowodów.',
    },
  };
}
