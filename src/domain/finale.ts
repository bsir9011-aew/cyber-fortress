import type { VendorExpiry, VendorScope } from './vendor';
export type FinaleVariant = 'crossfire' | 'false-lead' | 'cascade';
export type CrisisHypothesis =
  | 'operational-failure'
  | 'security-incident'
  | 'multiple-independent-events'
  | 'insufficient-evidence';
export interface FinaleDefinition {
  readonly familyId: 'nexus-campaign-finale-v1';
  readonly variant: FinaleVariant;
  readonly faultTurn: number;
}
export interface FinaleObservation {
  readonly id: string;
  readonly eventMinute: number;
  readonly availableAtMinute: number;
  readonly source: string;
  readonly assetId: string;
  readonly fact: string;
  readonly result: string;
  readonly limitation: string;
}
export interface FinaleState {
  readonly faultInjected: boolean;
  readonly observations: readonly FinaleObservation[];
  readonly hypothesis: CrisisHypothesis;
  readonly events: readonly {
    readonly minute: number;
    readonly assetId: string;
    readonly fact: string;
  }[];
  readonly hypotheses: readonly {
    readonly minute: number;
    readonly hypothesis: CrisisHypothesis;
    readonly observationIds: readonly string[];
  }[];
  readonly approvals: readonly {
    readonly taskId: string;
    readonly minute: number;
    readonly justification: string;
    readonly outcome: 'activated' | 'failed';
  }[];
}
export type FinaleTaskAction = {
  readonly type: 'approve-emergency-vendor-access';
  readonly scope: VendorScope;
  readonly expiresAtMinute: VendorExpiry;
  readonly justification: string;
};
