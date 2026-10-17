import type { Account } from './access';
import type { IntegrityMissionSummary } from './integrity';
import type { AssetStatus } from './infrastructure';
import type {
  SimulationState,
  WorkerId,
  SimulationCommand,
} from './simulation';

export type ProjectId = 'remote-access' | 'file-visibility' | 'segmentation';
export type SegmentationScope = 'file-team' | 'document-users';
export interface SecurityProject {
  readonly id: ProjectId;
  readonly status:
    | 'available'
    | 'planned'
    | 'reserved'
    | 'in-progress'
    | 'completed';
  readonly remaining: Readonly<Record<WorkerId, number>>;
}
export interface BudgetOperation {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly amount: number;
  readonly kind: 'prior-expense' | 'reserve' | 'payment' | 'release';
  readonly stage: 'preparation';
  readonly window: number;
  readonly result: 'applied' | 'rejected';
}
export interface SecurityBudget {
  readonly total: number;
  readonly ledger: readonly BudgetOperation[];
}
export interface SecurityPosture {
  readonly endpointOverrides?: Readonly<
    Record<
      string,
      { readonly isolated: boolean; readonly writesRestricted: boolean }
    >
  >;
  readonly remoteAccess: boolean;
  readonly fileVisibility: boolean;
  readonly segmentation: boolean;
  readonly segmentationScope: SegmentationScope;
  readonly ruleOverrides: Readonly<Record<string, 'allow' | 'deny'>>;
  readonly accountOverrides: Readonly<
    Record<string, Pick<Account, 'loginStatus' | 'credentialVersion'>>
  >;
  readonly assetOverrides: Readonly<Record<string, AssetStatus>>;
}
export interface PreparationWork {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly workerId: WorkerId;
  readonly window: number;
  readonly startHour: number;
  readonly hoursWorked: number;
  readonly status: 'running' | 'completed' | 'paused';
}
export interface CampaignMissionReport {
  readonly integrity?: IntegrityMissionSummary;
  readonly number: number;
  readonly seed: number;
  readonly scenarioId: string;
  readonly name: string;
  readonly exposedRecords: number;
  readonly processed: number;
  readonly backlog: number;
  readonly containmentMet: boolean | null;
  readonly spent: number;
  readonly activeProjects: readonly ProjectId[];
  readonly mfaRefusals: number;
  readonly fileEvidenceRecords: number;
  readonly reducedCapacityTurns: number;
  readonly minimumCapacity: number;
  readonly fullCapacity: number;
}
export interface CampaignState {
  readonly phase: 'preparation' | 'incident' | 'report';
  readonly budget: SecurityBudget;
  readonly projects: readonly SecurityProject[];
  readonly posture: SecurityPosture;
  readonly preparation: {
    readonly number: number;
    readonly hour: number;
    readonly limit: 4;
  };
  readonly work: readonly PreparationWork[];
  readonly nextSeed: number;
  readonly incident: SimulationState | null;
  readonly history: readonly CampaignMissionReport[];
  readonly decisions: readonly {
    readonly id: string;
    readonly window: number;
    readonly hour: number;
    readonly command: CampaignCommand['type'];
    readonly result: 'applied' | 'rejected';
    readonly reason: string;
  }[];
}
export type CampaignCommand =
  | { readonly type: 'plan-project'; readonly projectId: ProjectId }
  | { readonly type: 'reserve-project'; readonly projectId: ProjectId }
  | { readonly type: 'cancel-project'; readonly projectId: ProjectId }
  | {
      readonly type: 'assign-work';
      readonly projectId: ProjectId;
      readonly workerId: WorkerId;
    }
  | { readonly type: 'advance-preparation' }
  | {
      readonly type: 'set-segmentation-scope';
      readonly scope: SegmentationScope;
    }
  | { readonly type: 'start-incident' }
  | { readonly type: 'start-integrity-incident' }
  | {
      readonly type: 'incident-command';
      readonly command: Exclude<SimulationCommand, { type: 'reset' }>;
    }
  | { readonly type: 'return-headquarters' };
