import type { InfrastructureAsset, InfrastructureConnection } from './infrastructure';

/** Minimalny stan; kolejne etapy dodadzą czas, sesje i wiedzę gracza. */
export interface WorldState {
  readonly organizationId: string;
  readonly assets: readonly InfrastructureAsset[];
  readonly connections: readonly InfrastructureConnection[];
}
