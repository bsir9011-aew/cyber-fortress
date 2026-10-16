import type { SimulationState } from '../domain/simulation';

/** Referencyjny wariant GDD, bez planera i transferu danych napastnika. */
export const nexusSimulation: Pick<
  SimulationState,
  'clock' | 'process' | 'access' | 'hidden'
> = {
  clock: { startMinute: 14 * 60, turnMinutes: 5, turnLimit: 18, turn: 0 },
  process: {
    id: 'dispatch',
    name: 'Obsługa zamówień',
    ordersPerTurn: 20,
    localCapacity: 8,
    remoteCapacity: 14,
    maxFinalBacklog: 40,
    erpAssetId: 'erp',
    workstationAssetId: 'workstations',
    remoteAccountId: 'dispatch-team',
    protocol: 'HTTPS',
  },
  access: {
    vpnAssetId: 'vpn',
    identityAssetId: 'ad',
    sessionLifetimeMinutes: 120,
    identities: [
      { id: 'marta', name: 'Marta' },
      { id: 'dispatchers', name: 'Zespół zdalnych dyspozytorów' },
    ],
    accounts: [
      {
        id: 'magazyn-07',
        identityId: 'marta',
        loginStatus: 'enabled',
        credentialVersion: 1,
        mfaPolicy: 'not-required',
      },
      {
        id: 'dispatch-team',
        identityId: 'dispatchers',
        loginStatus: 'enabled',
        credentialVersion: 1,
        mfaPolicy: 'not-required',
      },
    ],
    sessions: [
      {
        id: 'S-19',
        accountId: 'magazyn-07',
        gatewayAssetId: 'vpn',
        status: 'active',
        startedAtMinute: 13 * 60 + 58,
        expiresAtMinute: 16 * 60,
      },
      {
        id: 'B-01',
        accountId: 'dispatch-team',
        gatewayAssetId: 'vpn',
        status: 'active',
        startedAtMinute: 14 * 60,
        expiresAtMinute: 16 * 60,
      },
    ],
    rules: [
      {
        id: 'R-ERP',
        sourceAssetId: 'vpn',
        targetAssetId: 'erp',
        protocol: 'HTTPS',
        priority: 10,
        action: 'allow',
      },
      {
        id: 'R-SMB',
        sourceAssetId: 'vpn',
        targetAssetId: 'fs-01',
        protocol: 'SMB',
        priority: 20,
        action: 'allow',
      },
      {
        id: 'R-LOCAL',
        sourceAssetId: 'workstations',
        targetAssetId: 'erp',
        protocol: 'HTTPS',
        priority: 30,
        action: 'allow',
      },
    ],
    permissions: [
      { accountId: 'magazyn-07', targetAssetId: 'fs-01', protocol: 'SMB' },
      { accountId: 'dispatch-team', targetAssetId: 'erp', protocol: 'HTTPS' },
    ],
  },
  hidden: { sessionOrigins: { 'S-19': 'unauthorized', 'B-01': 'legitimate' } },
};
