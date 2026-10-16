import type { AttackDefinition } from '../domain/attack';

export const nexusAttack: AttackDefinition = {
  id: 'nexus-data-theft',
  accountId: 'magazyn-07',
  stolenCredentialVersion: 1,
  initialSessionId: 'S-19',
  knownGatewayAssetId: 'vpn',
  targetAssetId: 'fs-01',
  protocol: 'SMB',
  recordLimit: 2000,
  chunkSizes: [400, 800, 800],
  firstReconnaissanceTurn: 2,
  retryDelayTurns: 2,
  maxConsecutiveFailures: 3,
};
