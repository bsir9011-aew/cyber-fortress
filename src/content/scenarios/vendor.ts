import type { ScenarioDefinition } from '../../domain/scenario';
import { referenceScenario } from './reference';
export const VENDOR_FAMILY_ID = 'nexus-vendor-access-v1' as const;
export const VENDOR_ACCOUNT_ID = 'cargo-link-operator' as const;
const base = referenceScenario;
/** Infrastructure is shared by all variants; it grants no exception on its own. */
export const vendorWorld = {
  ...base.world,
  teams: [...base.world.teams, { id: 'cargo-link', name: 'CARGO-LINK' }],
  assets: [
    ...base.world.assets,
    {
      id: 'cargo-link',
      name: 'CARGO-LINK',
      kind: 'external-network' as const,
      zoneId: 'external',
      ownerTeamId: 'cargo-link',
      status: 'online' as const,
      protocols: ['VPN'],
      description:
        'Zewnętrzny operator transportowy. Wydzielona tożsamość cargo-link-operator.',
      businessRole: 'Uzgodniona integracja wysyłek NEXUS.',
    },
    {
      id: 'carrier-api',
      name: 'CARGO-LINK Integration Gateway',
      kind: 'server' as const,
      zoneId: 'dmz',
      ownerTeamId: 'it',
      status: 'online' as const,
      protocols: ['HTTPS'],
      description:
        'Fikcyjna usługa pośrednicząca NEXUS dla operacji integracji CARGO-LINK przez HTTPS.',
      businessRole:
        '6 zamówień przepustowości zależy od realizacji uzgodnionego zlecenia dostawcy.',
    },
  ],
  connections: [
    ...base.world.connections,
    {
      id: 'cargo-vpn',
      sourceAssetId: 'cargo-link',
      targetAssetId: 'vpn',
      kind: 'network' as const,
      protocol: 'VPN',
      label: 'Tożsamość dostawcy',
      description:
        'Połączenie z bramą wymaga odrębnego uwierzytelnienia; linia na mapie nie wydaje sesji.',
    },
    {
      id: 'vpn-carrier-api',
      sourceAssetId: 'vpn',
      targetAssetId: 'carrier-api',
      kind: 'network' as const,
      protocol: 'HTTPS',
      label: 'Integracja dostawcy',
      description:
        'Uzgodniona ścieżka HTTPS. Wymaga sesji, ACL, uprawnienia i ważnego wyjątku.',
    },
    {
      id: 'carrier-dispatch',
      sourceAssetId: 'carrier-api',
      targetAssetId: 'erp',
      kind: 'business-dependency' as const,
      label: 'Realizacja przewozów',
      description:
        'Uzgodnione partie integracji uwalniają przewozy; sam dostęp do API nie udziela bezpośredniego dostępu do ERP.',
    },
  ],
};
export function selectVendorScenario(
  familyId: string,
  seed: number,
): ScenarioDefinition {
  if (familyId !== VENDOR_FAMILY_ID || !Number.isSafeInteger(seed) || seed < 0)
    throw new Error('Invalid vendor family/seed');
  let hash = 2166136261;
  for (const c of familyId)
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const variant = ((hash % 3) + (seed % 3)) % 3;
  const requiresFiles = variant === 1;
  const abusive = variant === 2;
  return {
    ...base,
    id: [
      'nexus-vendor-standard',
      'nexus-vendor-documents',
      'nexus-vendor-abuse',
    ][variant]!,
    name: 'Dostawca na godzinę',
    kind: 'third-party-access',
    familyId: VENDOR_FAMILY_ID,
    vendor: {
      familyId: VENDOR_FAMILY_ID,
      requiresFiles,
      requiredBatches: requiresFiles ? 12 : 6,
    },
    explanation: requiresFiles
      ? 'Legalne zlecenie CARGO-LINK obejmowało 12 partii, każda wymagała HTTPS oraz odczytu dokumentacji przewozowej przez SMB. Samo API nie wystarczało. Odmowa SMB nie potwierdzała napastnika.'
      : abusive
        ? 'Legalne zlecenie obejmowało 6 partii HTTPS. Osobny sprawca posiadał poświadczenie dostawcy w wersji 1 i próbował wydać nową sesję oraz odczytywać FS-01. Nie posiadał drugiego składnika. Szeroki wyjątek mógł udostępnić mu rzeczywistą drogę SMB.'
        : 'Legalne zlecenie CARGO-LINK obejmowało 6 partii HTTPS. SMB nie było potrzebne. Po zakończeniu partii przewozy mogły trwać bez dalszego dostępu dostawcy; dłuższy wyjątek nie dawał dodatkowej wydajności.',
    world: vendorWorld,
    process: {
      ...base.process,
      localCapacity: 8,
      remoteCapacity: 8,
      additionalWork: [
        {
          id: 'cargo-link-integration',
          name: 'Integracja CARGO-LINK',
          capacity: 6,
          accountId: VENDOR_ACCOUNT_ID,
          services: [{ targetAssetId: 'carrier-api', protocol: 'HTTPS' }],
        },
      ],
    },
    access: {
      ...base.access,
      sessions: [],
      vendorAuthorization: { accountId: VENDOR_ACCOUNT_ID, exception: null },
      identities: [
        ...base.access.identities,
        { id: 'cargo-link', name: 'Operator CARGO-LINK' },
      ],
      accounts: [
        ...base.access.accounts,
        {
          id: VENDOR_ACCOUNT_ID,
          identityId: 'cargo-link',
          loginStatus: 'enabled',
          credentialVersion: 1,
          mfaPolicy: 'not-required',
        },
      ],
      permissions: [
        ...base.access.permissions,
        {
          accountId: VENDOR_ACCOUNT_ID,
          targetAssetId: 'carrier-api',
          protocol: 'HTTPS',
        },
        {
          accountId: VENDOR_ACCOUNT_ID,
          targetAssetId: 'fs-01',
          protocol: 'SMB',
        },
      ],
      rules: [
        {
          id: 'CARGO-TUNNEL',
          sourceAssetId: 'cargo-link',
          targetAssetId: 'vpn',
          protocol: 'VPN',
          accountIds: [VENDOR_ACCOUNT_ID],
          priority: 0,
          action: 'allow',
        },
        {
          id: 'CARGO-API',
          sourceAssetId: 'vpn',
          targetAssetId: 'carrier-api',
          protocol: 'HTTPS',
          accountIds: [VENDOR_ACCOUNT_ID],
          priority: 0,
          action: 'allow',
        },
        {
          id: 'CARGO-SMB',
          sourceAssetId: 'vpn',
          targetAssetId: 'fs-01',
          protocol: 'SMB',
          accountIds: [VENDOR_ACCOUNT_ID],
          priority: 0,
          action: 'allow',
        },
        ...base.access.rules,
      ],
    },
    telemetry: {
      ...base.telemetry,
      sourceEvents: [],
      processedSourceCount: 0,
      authenticationRecords: [],
    },
    legitimateBehaviors: [
      ...base.legitimateBehaviors,
      {
        id: 'cargo-link',
        accountId: VENDOR_ACCOUNT_ID,
        credentialPolicy: 'managed-current',
        credentialVersion: 1,
        reconnectDelayTurns: 1,
        sessionIdPrefix: 'CARGO',
      },
    ],
    authenticationPrelude: [
      {
        actorId: 'dispatch',
        minute: 840,
        credentialVersion: 1,
        requestedSessionId: 'B-01',
      },
      {
        actorId: 'cargo-link',
        minute: 840,
        credentialVersion: 1,
        requestedSessionId: 'CARGO-01',
      },
    ],
    initialSessionOrigins: {},
    witnesses: [],
    attacker: abusive
      ? {
          id: 'cargo-credential-abuse',
          accountId: VENDOR_ACCOUNT_ID,
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
    goals: { ...base.goals, requireThreatContainment: abusive },
    briefing: {
      title: 'Misja 03 — Dostawca na godzinę',
      message:
        'CARGO-LINK ma dziś przygotować przewozy NEXUS. Zespół prosi o tymczasowy dostęp z wydzielonego konta do carrier-api; nie uzgodniono jeszcze potrzeby plików. Sprawdź rzeczywiste operacje, dobierz zakres i termin oraz zweryfikuj cofnięcie uprawnień. Dokumentacja zlecenia obejmuje do 12 partii; zakończone partie uwalniają dalsze wysyłki bez stałego połączenia. Do 15:30 zamykamy 360 zamówień.',
      analystHint:
        'Bada operacje CARGO-LINK (5 min), uwierzytelnienia i sesje. Audyt FS-01 jest osobnym źródłem tylko po wdrożeniu. Odmowa nie rozstrzyga legalności.',
    },
  };
}
