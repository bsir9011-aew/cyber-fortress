export type AssetId = string;

export type AssetKind =
  | 'external-network'
  | 'network-device'
  | 'server'
  | 'workstation'
  | 'cloud-service';

/** Physical scenarios use online/offline; unknown is reserved for the public knowledge projection. */
export type AssetStatus = 'online' | 'offline' | 'unknown';

export interface InfrastructureAsset {
  readonly id: AssetId;
  readonly name: string;
  readonly kind: AssetKind;
  readonly zoneId: string;
  readonly ownerTeamId: string;
  readonly status: AssetStatus;
  readonly protocols: readonly string[];
  readonly description: string;
  readonly businessRole?: string;
}

export interface InfrastructureZone {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface InfrastructureTeam {
  readonly id: string;
  readonly name: string;
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
  readonly label: string;
  readonly description: string;
  readonly protocol?: string;
}
