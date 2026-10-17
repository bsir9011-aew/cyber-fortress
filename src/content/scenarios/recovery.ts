import type { ScenarioDefinition } from '../../domain/scenario';
import type { ErpDataset, ErpRecord } from '../../domain/recovery';
import type {
  InfrastructureAsset,
  InfrastructureConnection,
} from '../../domain/infrastructure';
import { referenceScenario as base } from './reference';
export const RECOVERY_FAMILY_ID = 'nexus-erp-recovery-v1' as const;
const minutes = [
  ...Array.from({ length: 18 }, (_, i) => 780 + i),
  805,
  815,
  825,
  831,
  833,
  835,
];
export const erpRecords: readonly ErpRecord[] = minutes.map((minute, i) => ({
  id: `ERP-TX-${String(i + 1).padStart(3, '0')}`,
  minute,
  summary: `Zatwierdzone zlecenie magazynowe ${i + 1}`,
}));
const subset = (minute: number) =>
  erpRecords.filter((r) => r.minute <= minute).map((r) => r.id);
const assets: readonly InfrastructureAsset[] = [
  ['erp-db', 'ERP Database', 'internal', 'SQL'],
  ['erp-storage', 'ERP Storage', 'internal', 'BLOCK'],
  ['erp-backups', 'ERP Backups', 'internal', 'HTTPS'],
  ['erp-standby', 'ERP Standby', 'cloud', 'HTTPS'],
  ['standby-storage', 'Standby Storage', 'cloud', 'BLOCK'],
].map(([id, name, zoneId, protocol]) => ({
  id: id!,
  name: name!,
  zoneId: zoneId!,
  kind: 'server',
  ownerTeamId: 'it',
  status: 'online',
  protocols: [protocol!],
  description: 'Zasób planu ciągłości ERP; bieżący stan wymaga badania.',
}));
const routes: readonly InfrastructureConnection[] = [
  ['erp', 'erp-db', 'SQL'],
  ['erp-db', 'erp-storage', 'BLOCK'],
  ['erp-backups', 'erp-storage', 'BLOCK'],
  ['erp-standby', 'standby-storage', 'BLOCK'],
  ['workstations', 'erp-standby', 'HTTPS'],
  ['vpn', 'erp-standby', 'HTTPS'],
  ['workstations', 'erp-backups', 'HTTPS'],
].map(([source, target, protocol]) => ({
  id: `DR-${source}-${target}`,
  sourceAssetId: source!,
  targetAssetId: target!,
  kind: 'network',
  protocol: protocol!,
  label: protocol!,
  description:
    'Udokumentowana zależność ERP. Wymaga dostępnych zasobów i reguły dostępu.',
}));
const dataset = (
  minute: number | null,
  backupId: string | null,
): ErpDataset => ({
  processRunning: true,
  recordIds: subset(minute ?? 840),
  corruptRecordIds: [],
  postedOrderIds: [],
  recoveryPointMinute: minute,
  backupId,
});
/** Stable family mapping; existing scenario selection and seeds are untouched. */
export function selectRecoveryScenario(
  familyId: string,
  seed: number,
): ScenarioDefinition {
  if (
    familyId !== RECOVERY_FAMILY_ID ||
    !Number.isSafeInteger(seed) ||
    seed < 0
  )
    throw new Error('Invalid recovery family/seed');
  const cause = (
    ['service-failure', 'database-corruption', 'storage-outage'] as const
  )[seed % 3]!;
  const corrupt =
    cause === 'database-corruption' ? ['ERP-TX-012', 'ERP-TX-020'] : [];
  return {
    ...base,
    id: `nexus-erp-${cause}`,
    name: 'ERP nie odpowiada',
    kind: 'erp-recovery',
    familyId: RECOVERY_FAMILY_ID,
    explanation:
      cause === 'service-failure'
        ? 'Host był dostępny, ale proces aplikacji ERP zatrzymał się. Baza i storage pozostały poprawne. Restart był wystarczający.'
        : cause === 'database-corruption'
          ? 'Baza ERP była niespójna. Kopia 13:50 zawierała już uszkodzone zapisy. Restart nie naprawiał danych; czysta starsza kopia wymagała uzgodnienia późniejszych zapisów.'
          : 'Awaria primary storage odcięła bazę oraz repozytorium kopii współdzielące ten dysk. Niezależny standby miał własny storage i starszy zbiór danych.',
    world: {
      ...base.world,
      assets: [...base.world.assets, ...assets].map((a) =>
        a.id === 'erp-storage' && cause === 'storage-outage'
          ? { ...a, status: 'offline' }
          : a,
      ),
      connections: [...base.world.connections, ...routes],
    },
    process: { ...base.process },
    access: {
      ...base.access,
      sessions: [],
      rules: [
        ...base.access.rules,
        ...routes.map((c, i) => ({
          id: c.id,
          sourceAssetId: c.sourceAssetId,
          targetAssetId: c.targetAssetId,
          protocol: c.protocol!,
          priority: 50 + i,
          action: 'allow' as const,
        })),
      ],
      identities: [
        ...base.access.identities,
        { id: 'warehouse', name: 'Magazyn' },
      ],
      accounts: [
        ...base.access.accounts,
        {
          id: 'erp-warehouse',
          identityId: 'warehouse',
          loginStatus: 'enabled',
          credentialVersion: 1,
          mfaPolicy: 'not-required',
        },
      ],
      permissions: [
        ...base.access.permissions,
        { accountId: 'erp-warehouse', targetAssetId: 'erp', protocol: 'HTTPS' },
        {
          accountId: 'erp-warehouse',
          targetAssetId: 'erp-standby',
          protocol: 'HTTPS',
        },
        {
          accountId: 'dispatch-team',
          targetAssetId: 'erp-standby',
          protocol: 'HTTPS',
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
    goals: { ...base.goals, recordPool: 24, requireThreatContainment: false },
    recovery: {
      familyId: RECOVERY_FAMILY_ID,
      cause,
      records: erpRecords,
      primary: {
        ...dataset(null, null),
        processRunning: cause !== 'service-failure',
        corruptRecordIds: corrupt,
      },
      standby: dataset(820, 'STANDBY-1340'),
      backups: [
        {
          id: 'ERP-1320',
          minute: 800,
          repositoryAssetId: 'erp-backups',
          storageAssetId: 'erp-storage',
          recordIds: subset(800),
          corruptRecordIds: [],
          restoreTurns: 2,
          previouslyVerified: true,
        },
        {
          id: 'ERP-1350',
          minute: 830,
          repositoryAssetId: 'erp-backups',
          storageAssetId: 'erp-storage',
          recordIds: subset(830),
          corruptRecordIds: corrupt,
          restoreTurns: 3,
          previouslyVerified: false,
        },
      ],
      rtoMinutes: 30,
      rpoMinutes: 15,
      reconciliationSource: {
        assetId: 'workstations',
        recordIds: erpRecords.map((r) => r.id),
      },
      manualManifestLimit: 180,
    },
    briefing: {
      title: 'Misja 04 — ERP nie odpowiada',
      message:
        '14:00. Magazyn nie może obsługiwać zleceń w ERP. Do 15:30 wpłynie 360 zamówień. Zbadaj aplikację, bazę i storage. Wybierz restart, odtworzenie lub niezależny standby. RTO: 30 min; RPO: 15 min. Przygotowane lokalnie manifesty obejmują pierwsze 180 zamówień. Tryb ręczny realizuje do 10 na turę i wymaga późniejszego zamknięcia oraz uzgodnienia.',
      analystHint:
        'Badanie usługi 5 min; bazy/storage 10 min; inwentarz kopii 5 min; magazyn 5 min; weryfikacja wybranej kopii i spójności po 10 min. Status online hosta nie potwierdza działania ERP.',
    },
  };
}
