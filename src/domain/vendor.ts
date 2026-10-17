export type VendorScope = 'api-only' | 'api-and-files';
export type VendorExpiry = 870 | 900 | 930;
export interface VendorApproval {
  readonly id: string;
  readonly scope: VendorScope;
  readonly expiresAtMinute: VendorExpiry;
  readonly window: number;
  readonly startHour: number;
  readonly completedHour: number | null;
  readonly usedInWindow: number | null;
}
export interface VendorException {
  readonly approvalId: string;
  readonly scope: VendorScope;
  readonly validFromMinute: number;
  readonly expiresAtMinute: VendorExpiry;
  readonly status: 'active' | 'revoked' | 'expired';
}
/** Mandatory account-specific authorization, in addition to ACL and resource permissions. */
export interface VendorAuthorization {
  readonly accountId: 'cargo-link-operator';
  readonly exception: VendorException | null;
}
export interface VendorAccessChecks {
  readonly topologyExists: boolean;
  readonly serviceAvailable: boolean;
  readonly accountExists: boolean;
  readonly sessionActive: boolean;
  readonly networkAllowed: boolean;
  readonly permissionAllowed: boolean;
  readonly exceptionAllowed: boolean;
}
export interface VendorOperation {
  readonly id: string;
  readonly minute: number;
  readonly accountId: string;
  readonly sessionId: string;
  readonly targetAssetId: string;
  readonly protocol: 'HTTPS' | 'SMB';
  readonly operation: 'integrate' | 'list' | 'open' | 'read' | 'modify';
  readonly outcome: 'allowed' | 'denied';
  readonly recordsRead: number | null;
  readonly source: 'nexus-vpn-access-monitor';
  readonly accessChecks: VendorAccessChecks;
}
export interface VendorObservation {
  readonly id: string;
  readonly observedAtMinute: number;
  readonly source: 'nexus-vpn-access-monitor';
  readonly records: readonly VendorOperation[];
}
export interface VendorState {
  /** Private operations; the player receives only explicit observation snapshots. */
  readonly operations: readonly (VendorOperation & {
    readonly origin: 'legitimate' | 'unauthorized' | 'unclassified';
  })[];
  readonly observations: readonly VendorObservation[];
  readonly completedBatches: number;
  readonly accessChanges: readonly {
    readonly minute: number;
    readonly kind:
      | 'activated'
      | 'revoked'
      | 'narrowed'
      | 'expanded'
      | 'expired';
    readonly taskId: string | null;
    readonly exception: VendorException;
  }[];
}
export interface VendorDefinition {
  readonly familyId: 'nexus-vendor-access-v1';
  readonly requiresFiles: boolean;
  readonly requiredBatches: number;
}
export type VendorTaskAction =
  | { readonly type: 'inspect-vendor-operations' }
  | { readonly type: 'revoke-vendor-exception'; readonly approvalId: string }
  | { readonly type: 'narrow-vendor-exception'; readonly approvalId: string }
  | { readonly type: 'expand-vendor-exception'; readonly approvalId: string };
