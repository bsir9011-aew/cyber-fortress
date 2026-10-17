import type { ScenarioDefinition } from '../../domain/scenario';
import { referenceScenario } from './reference';

const documentIds = Array.from(
  { length: 100 },
  (_, i) => `DOC-${String(i + 1).padStart(3, '0')}`,
);
/** Mission family 02 is deliberately outside the historical seed catalog. */
export const integrityScenario: ScenarioDefinition = {
  ...referenceScenario,
  id: 'nexus-last-clean-copy',
  name: 'Ostatnia czysta kopia',
  kind: 'local-integrity',
  explanation:
    'Na pakowanie-03 przejęto lokalny kontekst packing-local z prawem SMB read/modify do FS-01. Proces zmieniał treść dokumentów bez zmiany ERP. Nie potrzebował VPN ani uprawnień administratora domeny. Izolacja i zakaz zapisu ograniczają źródło, odtworzenie i uzgodnienie naprawiają dane. Kompromitacja nie jest automatycznie usuwana.',
  world: {
    ...referenceScenario.world,
    connections: [
      ...referenceScenario.world.connections,
      {
        id: 'local-shipping-smb',
        sourceAssetId: 'workstations',
        targetAssetId: 'fs-01',
        kind: 'network',
        protocol: 'SMB',
        label: 'Dokumenty lokalne',
        description:
          'Lokalna praca z dokumentami; pakowanie-03 jest jedną z 94 stacji.',
      },
    ],
  },
  access: {
    ...referenceScenario.access,
    identities: [
      ...referenceScenario.access.identities,
      { id: 'packing', name: 'Stanowisko pakowania' },
      { id: 'warehouse', name: 'Pozostałe stanowiska magazynu' },
    ],
    accounts: [
      ...referenceScenario.access.accounts,
      {
        id: 'packing-local',
        identityId: 'packing',
        loginStatus: 'enabled',
        credentialVersion: 1,
        mfaPolicy: 'not-required',
      },
      {
        id: 'warehouse-team',
        identityId: 'warehouse',
        loginStatus: 'enabled',
        credentialVersion: 1,
        mfaPolicy: 'not-required',
      },
    ],
    permissions: [
      ...referenceScenario.access.permissions,
      { accountId: 'warehouse-team', targetAssetId: 'fs-01', protocol: 'SMB' },
    ],
    sessions: [],
    rules: [
      ...referenceScenario.access.rules,
      {
        id: 'R-LOCAL-SMB',
        sourceAssetId: 'workstations',
        targetAssetId: 'fs-01',
        protocol: 'SMB',
        priority: 30,
        action: 'allow',
      },
    ],
  },
  telemetry: {
    ...referenceScenario.telemetry,
    sourceEvents: [],
    processedSourceCount: 0,
    authenticationRecords: [],
  },
  initialSessionOrigins: {},
  authenticationPrelude: [
    {
      actorId: 'dispatch',
      minute: 840,
      credentialVersion: 1,
      requestedSessionId: 'B-01',
    },
  ],
  attacker: null,
  witnesses: [],
  goals: { ...referenceScenario.goals, requireThreatContainment: true },
  briefing: {
    title: 'Ostatnia czysta kopia',
    message:
      'ERP działa, FS-01 odpowiada, ale dokumenty wysyłkowe nie zgadzają się z zamówieniami. Zespół pakowanie-03 zgłasza rozbieżności od 13:55. To relacja pracowników, nie potwierdzenie przyczyny. Do 15:30 musimy przywrócić poprawne dokumenty i zamknąć wysyłki.',
    analystHint:
      'Porównuje dokumenty z ERP, bada dziennik stacji i punkty odtworzenia. Audyt FS-01 jest dostępny tylko po wdrożeniu projektu.',
  },
  integrity: {
    endpoint: {
      id: 'pakowanie-03',
      assetId: 'workstations',
      accountId: 'packing-local',
      isolated: false,
      writesRestricted: false,
      businessCapacity: 2,
      permissions: [
        { assetId: 'fs-01', protocol: 'SMB', operations: ['read', 'modify'] },
        { assetId: 'erp', protocol: 'HTTPS', operations: ['read'] },
      ],
    },
    datasetAssetId: 'fs-01',
    businessReadAccountId: 'warehouse-team',
    documentIds,
    initialDamage: 12,
    attack: {
      compromised: true,
      turns: [2, 4, 6, 8, 10, 12, 14, 16, 18],
      chunkSize: 20,
    },
    backups: [
      {
        id: 'FS-1320',
        minute: 800,
        documentIds: documentIds.slice(0, 80),
        damagedIds: [],
        previouslyVerified: true,
        available: true,
        restoreTurns: 2,
      },
      {
        id: 'FS-1350',
        minute: 830,
        documentIds,
        damagedIds: [],
        previouslyVerified: false,
        available: true,
        restoreTurns: 3,
      },
    ],
    reconcileTurns: 2,
  },
};
