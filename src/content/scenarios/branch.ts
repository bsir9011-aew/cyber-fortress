import type { BranchArchitecture, BranchSmbScope } from '../../domain/branch';
import type { ScenarioDefinition } from '../../domain/scenario';
import type { WorldState } from '../../domain/world';
import type { AccessState } from '../../domain/access';
import { referenceScenario as base } from './reference';
export const BRANCH_FAMILY_ID = 'nexus-east-branch-v1' as const;
export const branchAccountIds = ['east-operator', 'east-documents'] as const;
export const documentAccountIds = ['east-documents'] as const;
export const defaultBranchArchitecture: BranchArchitecture = {
  erpEnabled: false,
  smbScope: 'none',
  backupPrepared: false,
  monitoring: false,
  restrictedAccountIds: [],
};
export const branchWorld: WorldState = {
  ...base.world,
  zones: [
    ...base.world.zones,
    {
      id: 'east',
      name: 'NEXUS EAST',
      description:
        '12 pracowników i 8 komputerów przeniesionych z centrali; nadal 120/94 w całej firmie.',
    },
  ],
  assets: [
    ...base.world.assets.map((a) =>
      a.id === 'firewall'
        ? { ...a, protocols: [...a.protocols, 'S2S'] }
        : a.id === 'workstations'
          ? {
              ...a,
              description:
                '86 stacji centrali; 8 przeniesiono do NEXUS EAST. Cała organizacja nadal posiada 94 komputery.',
            }
          : a,
    ),
    ...[
      [
        'east-workstations',
        'EAST Workstations',
        'workstation',
        ['HTTPS', 'SMB'],
      ],
      [
        'east-gateway',
        'EAST Gateway',
        'network-device',
        ['S2S', 'HTTPS', 'SMB'],
      ],
      ['east-primary-link', 'EAST Primary Link', 'network-device', ['S2S']],
      [
        'east-backup-gateway',
        'EAST Backup Gateway',
        'network-device',
        ['HTTPS'],
      ],
    ].map(([id, name, kind, protocols]) => ({
      id: id as string,
      name: name as string,
      kind: kind as 'workstation' | 'network-device',
      protocols: protocols as string[],
      zoneId: 'east',
      ownerTeamId: 'it',
      status: 'online' as const,
      description:
        'Zasób oddziału NEXUS EAST. Dostęp wymaga rzeczywistej trasy, uwierzytelnienia, ACL i uprawnienia.',
    })),
  ],
  connections: [
    ...base.world.connections,
    ...[
      ['EAST-LAN-ERP', 'east-workstations', 'east-gateway', 'HTTPS'],
      ['EAST-LAN-SMB', 'east-workstations', 'east-gateway', 'SMB'],
      ['EAST-S2S-LOCAL', 'east-gateway', 'east-primary-link', 'S2S'],
      ['EAST-S2S-PEER', 'east-primary-link', 'firewall', 'S2S'],
      ['EAST-ERP', 'firewall', 'erp', 'HTTPS'],
      ['EAST-SMB', 'firewall', 'fs-01', 'SMB'],
      ['EAST-BACKUP-LAN', 'east-workstations', 'east-backup-gateway', 'HTTPS'],
      ['EAST-BACKUP-ERP', 'east-backup-gateway', 'erp', 'HTTPS'],
    ].map(([id, source, target, protocol]) => ({
      id: id!,
      sourceAssetId: source!,
      targetAssetId: target!,
      protocol: protocol!,
      kind: 'network' as const,
      label: protocol!,
      description:
        protocol === 'S2S'
          ? 'Tunel site-to-site między bramami; nie jest osobistą sesją VPN.'
          : 'Droga usługowa oddziału. HTTPS-only backup nie zapewnia SMB.',
    })),
  ],
};
/** ACL and explicit resource grants are distinct effects of commissioning. */
export function configureBranchAccess(
  access: AccessState,
  architecture: BranchArchitecture,
): AccessState {
  const scope: BranchSmbScope = architecture.smbScope;
  return {
    ...access,
    rules: access.rules.map((r) =>
      r.id === 'EAST-ERP' || r.id === 'EAST-BACKUP-ERP'
        ? { ...r, action: architecture.erpEnabled ? 'allow' : 'deny' }
        : r.id === 'EAST-SMB'
          ? {
              ...r,
              action: scope === 'none' ? 'deny' : 'allow',
              accountIds:
                scope === 'all' ? branchAccountIds : documentAccountIds,
            }
          : r,
    ),
    permissions: [
      ...access.permissions.filter(
        (p) => !branchAccountIds.some((id) => id === p.accountId),
      ),
      ...branchAccountIds.flatMap((accountId) => [
        ...(architecture.erpEnabled
          ? [{ accountId, targetAssetId: 'erp', protocol: 'HTTPS' }]
          : []),
        ...(accountId === 'east-documents' || scope === 'all'
          ? [{ accountId, targetAssetId: 'fs-01', protocol: 'SMB' }]
          : []),
      ]),
    ],
  };
}
export function selectBranchScenario(
  familyId: string,
  seed: number,
  architecture: BranchArchitecture = defaultBranchArchitecture,
): ScenarioDefinition {
  if (familyId !== BRANCH_FAMILY_ID || !Number.isSafeInteger(seed) || seed < 0)
    throw new Error('Invalid branch family/seed');
  const kind = (
    ['link-failure', 'document-dependency', 'compromised-context'] as const
  )[seed % 3]!;
  const access = configureBranchAccess(
    {
      ...base.access,
      sessions: [],
      identities: [
        ...base.access.identities,
        { id: 'east-staff', name: 'Pracownicy NEXUS EAST' },
      ],
      accounts: [
        ...base.access.accounts,
        ...branchAccountIds.map((id) => ({
          id,
          identityId: 'east-staff',
          loginStatus: 'enabled' as const,
          credentialVersion: 1,
          mfaPolicy: 'not-required' as const,
        })),
      ],
      rules: [
        ...base.access.rules,
        ...branchWorld.connections
          .filter((c) => c.id.startsWith('EAST-'))
          .map((c, i) => ({
            id: c.id,
            sourceAssetId: c.sourceAssetId,
            targetAssetId: c.targetAssetId,
            protocol: c.protocol!,
            priority: 50 + i,
            action: 'allow' as const,
            accountIds: branchAccountIds,
          })),
      ],
    },
    architecture,
  );
  return {
    ...base,
    id: `nexus-east-${kind}`,
    name: 'Oddział na granicy',
    kind: 'branch-architecture',
    familyId: BRANCH_FAMILY_ID,
    world: branchWorld,
    access,
    process: {
      ...base.process,
      localCapacity: 8,
      remoteCapacity: 8,
      additionalWork: [
        {
          id: 'east-branch',
          name: 'NEXUS EAST — 12 osób / 8 przeniesionych stacji',
          capacity: 6,
          accountId: 'east-operator',
          accessMode: 'branch-context',
          services: [{ targetAssetId: 'erp', protocol: 'HTTPS' }],
        },
      ],
    },
    telemetry: {
      ...base.telemetry,
      sourceEvents: [],
      processedSourceCount: 0,
      authenticationRecords: [],
    },
    authenticationPrelude: [
      {
        actorId: 'dispatch',
        minute: 840,
        credentialVersion: 1,
        requestedSessionId: 'B-01',
      },
    ],
    initialSessionOrigins: {},
    attacker: null,
    witnesses: [],
    goals: { ...base.goals, requireThreatContainment: false },
    explanation:
      kind === 'link-failure'
        ? 'O 14:20 wystąpiła naprawialna awaria fizycznego łącza podstawowego EAST. ERP i FS-01 w centrali pozostały dostępne. Przygotowany backup zapewniał tylko HTTPS i do 3 zamówień/turę; naprawa i wybór trasy były osobnymi działaniami.'
        : kind === 'document-dependency'
          ? 'Od 14:10 cztery z sześciu zleceń oddziału wymagały dokumentów FS-01 z konta east-documents. Dwa zlecenia potrzebowały tylko ERP. Wąska reguła i uprawnienie grupy dokumentowej wystarczały; szeroki dostęp sam nie stanowił incydentu.'
          : 'Przejęty został istniejący, uwierzytelniony lokalny kontekst east-documents. Nie była to sesja osobistego VPN ani nowe logowanie skradzionym hasłem. Od 14:20 kontekst próbował SMB, a od 14:30 odczytu danych. MFA tunelu i reset hasła nie odbierały bieżącej autoryzacji tego kontekstu.',
    branch: {
      familyId: BRANCH_FAMILY_ID,
      kind,
      architecture,
      requiresDocuments: kind === 'document-dependency',
      documentsFromTurn: 2,
      linkFailureTurn: kind === 'link-failure' ? 4 : null,
      repairable: true,
      compromisedContextId: kind === 'compromised-context' ? 'EAST-DOC' : null,
      firstProbeTurn: 4,
      firstReadTurn: 6,
      documentAccountIds,
    },
    briefing: {
      title: 'Misja 05 — Oddział na granicy',
      message:
        'NEXUS EAST rozpoczyna wysyłki: 12 pracowników i 8 stacji przeniesiono z centrali (firma nadal ma 120 osób i 94 urządzenia). Centrala wnosi 8 lokalnych i 8 zdalnych zamówień, oddział do 6 na turę. Sprawdź rzeczywiste potrzeby dokumentowe, łączność i przepływy. Przygotowany backup zapewnia tylko ERP/HTTPS i do 3/turę. Nie gwarantuje pracy z dokumentami. Cel 15:30: użyteczna pełna obsługa oddziału, najwyżej 40 zaległych i brak nieuprawnionego odczytu.',
      analystHint:
        'Badanie łączy, odczyt monitoringu i potwierdzenie potrzeb oddziału zajmują po 5 min. Monitoring musi zostać wdrożony wcześniej; metadane bramy nie pokazują treści szyfrowanej transmisji ani człowieka za kontem.',
    },
  };
}

/** Compare the declared SMB deployment with current public ACL and resource grants. */
export function branchSmbConfigurationMatches(
  access: AccessState,
  architecture: BranchArchitecture,
): boolean {
  const expected = configureBranchAccess(access, architecture);
  const actualRule = access.rules.find((r) => r.id === 'EAST-SMB'),
    expectedRule = expected.rules.find((r) => r.id === 'EAST-SMB');
  if (!actualRule || !expectedRule || actualRule.action !== expectedRule.action)
    return false;
  const actualAccounts = actualRule.accountIds ?? [],
    expectedAccounts = expectedRule.accountIds ?? [];
  if (
    actualAccounts.length !== expectedAccounts.length ||
    !actualAccounts.every((id) => expectedAccounts.includes(id))
  )
    return false;
  return branchAccountIds.every(
    (accountId) =>
      access.permissions.some(
        (p) =>
          p.accountId === accountId &&
          p.targetAssetId === 'fs-01' &&
          p.protocol === 'SMB',
      ) ===
      expected.permissions.some(
        (p) =>
          p.accountId === accountId &&
          p.targetAssetId === 'fs-01' &&
          p.protocol === 'SMB',
      ),
  );
}
