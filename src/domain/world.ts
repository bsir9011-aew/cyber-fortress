import type {
  InfrastructureAsset,
  InfrastructureConnection,
  InfrastructureTeam,
  InfrastructureZone,
} from './infrastructure';

/** Fakty scenariusza; przyszła wiedza gracza pozostanie osobnym modelem. */
export interface WorldState {
  readonly organizationId: string;
  readonly zones: readonly InfrastructureZone[];
  readonly teams: readonly InfrastructureTeam[];
  readonly assets: readonly InfrastructureAsset[];
  readonly connections: readonly InfrastructureConnection[];
}
