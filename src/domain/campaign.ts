import type { VendorApproval, VendorExpiry, VendorScope } from './vendor';
import type { Account } from './access';
import type { IntegrityMissionSummary } from './integrity';
import type { AssetStatus } from './infrastructure';
import type {
  BackupReadiness,
  CampaignFunding,
  EndpointCoverage,
  DetectionConfigurationWork,
} from './resilience';
import type {
  SimulationState,
  WorkerId,
  SimulationCommand,
} from './simulation';

export type ProjectId =
  | 'remote-access'
  | 'file-visibility'
  | 'segmentation'
  | 'endpoint-edr'
  | 'backup-resilience';
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
  readonly endpointCoverage?: EndpointCoverage;
  readonly backupReadiness?: BackupReadiness;
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
  readonly vendor?: {
    readonly approvalId: string | null;
    readonly approvedScope: VendorScope | null;
    readonly expiresAtMinute: number | null;
    readonly completedBatches: number;
    readonly requiredBatches: number;
    readonly exposedRecords: number;
  };
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
  readonly vendorApprovals?: readonly VendorApproval[];
  readonly detectionChanges?: readonly DetectionConfigurationWork[];
  readonly funding?: CampaignFunding;
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
  | {
      readonly type: 'prepare-vendor-exception';
      readonly scope: VendorScope;
      readonly expiresAtMinute: VendorExpiry;
    }
  | {
      readonly type: 'start-vendor-incident';
      readonly familyId: 'nexus-vendor-access-v1';
    }
  | {
      readonly type: 'configure-endpoint-detection';
      readonly endpointId: 'pakowanie-03';
      readonly threshold: number;
      readonly windowMinutes: 5 | 10 | 20;
    }
  | {
      readonly type: 'start-detection-incident';
      readonly familyId: 'nexus-integrity-detection-v1';
    }
  | { readonly type: 'accept-resilience-funding' }
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
