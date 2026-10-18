import type { WorkerId } from './simulation';
export type BranchSmbScope = 'none' | 'documents' | 'all';
export interface BranchArchitecture {
  readonly erpEnabled: boolean;
  readonly smbScope: BranchSmbScope;
  readonly backupPrepared: boolean;
  readonly monitoring: boolean;
  /** Current SMB service authorization, independent of account login/MFA. */
  readonly restrictedAccountIds: readonly string[];
}
export type BranchArchitectureChange =
  | { readonly component: 'erp'; readonly enabled: boolean }
  | { readonly component: 'smb'; readonly scope: BranchSmbScope }
  | { readonly component: 'backup'; readonly enabled: boolean }
  | { readonly component: 'monitoring'; readonly enabled: boolean };
export interface BranchPreparationWork {
  readonly id: string;
  readonly change: BranchArchitectureChange;
  readonly workerId: WorkerId;
  readonly remainingHours: number;
  readonly status: 'running' | 'paused' | 'completed';
  readonly segments: readonly {
    readonly window: number;
    readonly startHour: number;
    readonly hoursWorked: number;
  }[];
  readonly completedWindow: number | null;
  readonly completedHour: number | null;
}
export interface BranchDefinition {
  readonly familyId: 'nexus-east-branch-v1';
  readonly kind: 'link-failure' | 'document-dependency' | 'compromised-context';
  readonly architecture: BranchArchitecture;
  readonly requiresDocuments: boolean;
  readonly documentsFromTurn: number;
  readonly linkFailureTurn: number | null;
  readonly repairable: boolean;
  readonly compromisedContextId: string | null;
  readonly firstProbeTurn: number;
  readonly firstReadTurn: number;
  readonly documentAccountIds: readonly string[];
}
/** A site-to-site transport, never a personal VpnSession. */
export interface BranchTunnel {
  readonly id: 'EAST-S2S';
  readonly localGatewayAssetId: 'east-gateway';
  readonly linkAssetId: 'east-primary-link';
  readonly peerAssetId: 'firewall';
  readonly authenticated: boolean;
  readonly authorized: boolean;
}
export interface BranchContext {
  readonly id: string;
  readonly accountId: string;
  readonly authenticated: boolean;
  readonly issuedAtMinute: number | null;
  readonly lastAttemptTurn: number;
  readonly authenticationReason:
    | 'authenticated'
    | 'account-blocked'
    | 'source-unavailable'
    | 'mfa-required';
}
export type BranchRoute = 'primary' | 'backup';
export interface BranchAccessChecks {
  readonly route: BranchRoute;
  readonly path: readonly string[];
  readonly topologyExists: boolean;
  readonly infrastructureAvailable: boolean;
  readonly tunnelAuthenticated: boolean;
  readonly tunnelAuthorized: boolean;
  readonly contextAuthenticated: boolean;
  readonly accountExists: boolean;
  readonly networkAllowed: boolean;
  readonly permissionAllowed: boolean;
  readonly serviceAuthorized: boolean;
  readonly reachedService: boolean;
  readonly allowed: boolean;
}
export interface BranchOperation {
  readonly id: string;
  readonly minute: number;
  readonly contextId: string;
  readonly accountId: string;
  readonly sourceAssetId: 'east-workstations';
  readonly gatewayAssetId: string;
  readonly targetAssetId: string;
  readonly protocol: 'HTTPS' | 'SMB';
  readonly operation: 'work' | 'list' | 'open' | 'read';
  readonly origin: 'legitimate' | 'unauthorized';
  readonly recordsRead: number | null;
  readonly checks: BranchAccessChecks;
}
/** Gateway metadata cannot reveal encrypted application content or read volume. */
export interface BranchGatewayRecord {
  readonly id: string;
  readonly minute: number;
  readonly contextId: string;
  readonly accountId: string;
  readonly sourceAssetId: 'east-workstations';
  readonly gatewayAssetId: string;
  readonly targetAssetId: string;
  readonly protocol: 'HTTPS' | 'SMB';
  readonly route: BranchRoute;
  readonly outcome: 'allowed' | 'denied';
  readonly reason:
    | 'forwarded-to-service'
    | 'transport-or-authentication-denied';
}
export interface BranchObservation {
  readonly id: string;
  readonly taskId: string;
  readonly minute: number;
  readonly source: string;
  readonly assertion: 'observation' | 'human-statement';
  readonly text: string;
  readonly assetStatuses: Readonly<Record<string, 'online' | 'offline'>>;
  readonly records: readonly BranchGatewayRecord[];
}
export type BranchTaskAction =
  | { readonly type: 'inspect-branch-links' }
  | { readonly type: 'inspect-branch-gateway-logs' }
  | { readonly type: 'confirm-branch-requirements' }
  | { readonly type: 'activate-branch-route'; readonly route: BranchRoute }
  | { readonly type: 'repair-branch-link' }
  | { readonly type: 'set-branch-smb-scope'; readonly scope: BranchSmbScope }
  | {
      readonly type: 'set-branch-account-restriction';
      readonly accountId: string;
      readonly restricted: boolean;
    };
export interface BranchTaskResult {
  readonly taskId: string;
  readonly minute: number;
  readonly action: BranchTaskAction;
  readonly outcome: 'succeeded' | 'partial' | 'failed';
  readonly text: string;
}
export interface BranchState {
  readonly architecture: BranchArchitecture;
  readonly tunnel: BranchTunnel;
  readonly backupAuthenticated: boolean;
  readonly backupAuthorized: boolean;
  readonly contexts: readonly BranchContext[];
  readonly activeRoute: BranchRoute;
  readonly faultApplied: boolean;
  readonly primaryFault: boolean;
  readonly operations: readonly BranchOperation[];
  readonly gatewayRecords: readonly BranchGatewayRecord[];
  readonly sensor: {
    readonly enabled: boolean;
    readonly coverageFromMinute: number;
    readonly retentionMinutes: 120;
    readonly delayMinutes: 0;
  };
  readonly observations: readonly BranchObservation[];
  readonly results: readonly BranchTaskResult[];
  readonly transitions: readonly {
    readonly minute: number;
    readonly route: BranchRoute;
    readonly primaryAvailable: boolean;
    readonly backupAvailable: boolean;
    readonly branchCapacity: number;
    readonly documentService: boolean;
    readonly fileAccessAccountIds: readonly string[];
  }[];
  readonly events: readonly {
    readonly minute: number;
    readonly kind:
      | 'link-failed'
      | 'link-repaired'
      | 'route-changed'
      | 'policy-changed'
      | 'authorization-changed';
    readonly taskId: string | null;
    readonly text: string;
  }[];
}
