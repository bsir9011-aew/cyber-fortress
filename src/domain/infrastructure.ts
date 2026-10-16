export type AssetId = string;

export type AssetKind =
  | 'external-network'
  | 'network-device'
  | 'server'
  | 'workstation'
  | 'cloud-service';

/** Dostępność zasobu nie opisuje jego bezpieczeństwa ani wiedzy gracza. */
export type AssetStatus = 'online' | 'offline';

export interface InfrastructureAsset {
  readonly id: AssetId;
  readonly name: string;
  readonly kind: AssetKind;
  readonly zoneId: string;
  readonly ownerTeamId: string;
  readonly status: AssetStatus;
  readonly protocols: readonly string[];
}

export type ConnectionKind =
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'business-dependency'
  | 'observation';

/** Relacja skierowana source → target; sama linia nie udziela dostępu. */
export interface InfrastructureConnection {
  readonly id: string;
  readonly sourceAssetId: AssetId;
  readonly targetAssetId: AssetId;
  readonly kind: ConnectionKind;
}
