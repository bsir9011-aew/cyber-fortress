export type LocalOperation = 'read' | 'modify';
export interface LocalEndpoint {
  readonly id: string;
  /** Logical member of the existing aggregate, never an extra computer. */
  readonly assetId: string;
  readonly accountId: string;
  readonly isolated: boolean;
  readonly writesRestricted: boolean;
  readonly businessCapacity: number;
  readonly permissions: readonly {
    readonly assetId: string;
    readonly protocol: string;
    readonly operations: readonly LocalOperation[];
  }[];
}
export interface ShippingDocument {
  readonly id: string;
  readonly status: 'correct' | 'damaged' | 'reconcile';
  readonly generation: number;
  readonly everDamaged: boolean;
  readonly recovered: boolean;
}
export interface BackupPoint {
  readonly id: string;
  readonly minute: number;
  readonly documentIds: readonly string[];
  readonly damagedIds: readonly string[];
  readonly previouslyVerified: boolean;
  readonly available: boolean;
  readonly restoreTurns: number;
}
export interface IntegrityDefinition {
  readonly endpoint: LocalEndpoint;
  readonly datasetAssetId: string;
  readonly businessReadAccountId: string;
  readonly documentIds: readonly string[];
  readonly initialDamage: number;
  readonly attack: {
    readonly compromised: boolean;
    readonly turns: readonly number[];
    readonly chunkSize: number;
  };
  readonly backups: readonly BackupPoint[];
  readonly reconcileTurns: number;
}
export interface DocumentObservation {
  readonly id: string;
  readonly minute: number;
  readonly revision: number;
  readonly scope: readonly string[];
  readonly correct: number;
  readonly damaged: number;
  readonly reconcile: number;
}
export interface LocalOperationRecord {
  readonly minute: number;
  readonly endpointId: string;
  readonly accountId: string;
  readonly operation: LocalOperation;
  readonly documentIds: readonly string[];
  readonly outcome: 'allowed' | 'denied';
}
export interface EndpointObservation {
  readonly id: string;
  readonly endpointId: string;
  readonly minute: number;
  readonly isolated: boolean;
  readonly writesRestricted: boolean;
  readonly records: readonly LocalOperationRecord[];
}
export interface IntegrityState {
  readonly endpoint: LocalEndpoint;
  readonly documents: readonly ShippingDocument[];
  readonly revision: number;
  readonly backups: readonly {
    readonly id: string;
    readonly verification: 'unknown' | 'clean' | 'damaged';
    readonly verifiedAtMinute: number | null;
  }[];
  readonly backupInventoryMinute: number | null;
  readonly observations: readonly DocumentObservation[];
  readonly endpointObservations: readonly EndpointObservation[];
  /** Local workstation log, disclosed only by an endpoint examination. */
  readonly operationRecords: readonly LocalOperationRecord[];
  readonly recoveries: readonly {
    readonly backupId: string;
    readonly orderedAtMinute: number;
    readonly completedAtMinute: number;
    readonly missingDocuments: number;
  }[];
  readonly recoveryStartedMinute: number | null;
  readonly verifiedRecoveryMinute: number | null;
  readonly reconciledIds: readonly string[];
  readonly decisions: readonly {
    readonly taskId: string;
    readonly orderedAtMinute: number;
    readonly knownObservationIds: readonly string[];
    readonly backupInventoryMinute: number | null;
    readonly assumption:
      | 'insufficient-evidence'
      | 'local-modification'
      | 'data-drift';
    readonly completedAtMinute: number | null;
    readonly effect: string | null;
  }[];
  readonly hypothesis:
    | 'insufficient-evidence'
    | 'local-modification'
    | 'data-drift';
}
export interface IntegrityThreatState {
  readonly compromised: boolean;
  readonly nextIndex: number;
  readonly history: readonly {
    readonly turn: number;
    readonly outcome: 'modified' | 'access-denied' | 'no-new-documents';
    readonly documentIds: readonly string[];
  }[];
}
export type IntegrityTaskAction =
  | { readonly type: 'inspect-documents' }
  | { readonly type: 'inspect-backups' }
  | { readonly type: 'verify-backup'; readonly backupId: string }
  | { readonly type: 'restore-documents'; readonly backupId: string }
  | { readonly type: 'reconcile-documents' }
  | { readonly type: 'examine-endpoint'; readonly endpointId: string }
  | { readonly type: 'isolate-endpoint'; readonly endpointId: string }
  | { readonly type: 'restrict-endpoint-writes'; readonly endpointId: string }
  | { readonly type: 'reconnect-endpoint'; readonly endpointId: string };

export interface IntegrityMissionSummary {
  readonly serviceOnline: boolean;
  readonly dataAvailable: boolean;
  readonly total: number;
  readonly correct: number;
  readonly damaged: number;
  readonly reconcile: number;
  readonly recovered: number;
  readonly everDamaged: number;
  readonly sourceHasWrite: boolean;
  readonly endpointIsolated: boolean;
  readonly writesRestricted: boolean;
  readonly backupId: string | null;
  readonly rpoMinutes: number | null;
  readonly rtoMinutes: number | null;
  readonly missingChanges: number;
  readonly reconstructed: number;
  readonly verified: boolean;
  readonly limitedDataMinutes: number;
  readonly peakBacklog: number;
}
