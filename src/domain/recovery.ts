/** ERP recovery is independent of React, FS snapshots and endpoint telemetry. */
export type ErpInstanceId = 'primary' | 'standby';
export interface ErpRecord {
  readonly id: string;
  readonly minute: number;
  readonly summary: string;
}
export interface ErpDataset {
  readonly processRunning: boolean;
  readonly recordIds: readonly string[];
  readonly corruptRecordIds: readonly string[];
  readonly postedOrderIds: readonly string[];
  readonly recoveryPointMinute: number | null;
  readonly backupId: string | null;
}
export interface ErpBackup {
  readonly id: string;
  readonly minute: number;
  readonly repositoryAssetId: string;
  readonly storageAssetId: string;
  readonly recordIds: readonly string[];
  readonly corruptRecordIds: readonly string[];
  readonly restoreTurns: number;
  readonly previouslyVerified: boolean;
}
export interface RecoveryDefinition {
  readonly familyId: 'nexus-erp-recovery-v1';
  readonly cause: 'service-failure' | 'database-corruption' | 'storage-outage';
  readonly records: readonly ErpRecord[];
  readonly backups: readonly ErpBackup[];
  readonly primary: ErpDataset;
  readonly standby: ErpDataset;
  readonly rtoMinutes: number;
  readonly rpoMinutes: number;
  readonly reconciliationSource: {
    readonly assetId: string;
    readonly recordIds: readonly string[];
  };
  readonly manualManifestLimit: number;
}
export interface RecoveryOrder {
  readonly id: string;
  readonly receivedTurn: number;
  readonly fulfilledBy: 'manual' | 'erp' | null;
  readonly fulfilledAtMinute: number | null;
}
export interface RecoveryObservation {
  readonly id: string;
  readonly taskId: string;
  readonly minute: number;
  readonly source: string;
  readonly text: string;
  readonly assetStatuses: Readonly<Record<string, 'online' | 'offline'>>;
  readonly backups: readonly {
    readonly id: string;
    readonly minute: number;
    readonly available: boolean;
    readonly restoreTurns: number;
    readonly verified: boolean | null;
    readonly recordIds: readonly string[];
  }[];
}
export interface RecoveryTaskResult {
  readonly taskId: string;
  readonly minute: number;
  readonly action: RecoveryTaskAction;
  readonly outcome: 'succeeded' | 'partial' | 'failed';
  readonly text: string;
  readonly recordIds: readonly string[];
  readonly orderIds: readonly string[];
}
export interface RecoveryState {
  readonly activeInstance: ErpInstanceId;
  readonly primary: ErpDataset;
  readonly standby: ErpDataset;
  readonly manualActive: boolean;
  readonly orders: readonly RecoveryOrder[];
  readonly revision: number;
  readonly verifiedRevision: number | null;
  readonly observations: readonly RecoveryObservation[];
  readonly results: readonly RecoveryTaskResult[];
  readonly availability: readonly {
    readonly minute: number;
    readonly useful: boolean;
    readonly instance: ErpInstanceId;
    readonly capacity: number;
    readonly manual: boolean;
  }[];
}
export type RecoveryTaskAction =
  | { readonly type: 'inspect-erp-service' }
  | { readonly type: 'inspect-erp-database' }
  | { readonly type: 'inspect-erp-backups' }
  | { readonly type: 'contact-warehouse-operations' }
  | { readonly type: 'verify-erp-backup'; readonly backupId: string }
  | { readonly type: 'inspect-erp-consistency' }
  | { readonly type: 'reconcile-erp-records' }
  | { readonly type: 'restart-erp-service' }
  | { readonly type: 'restore-erp-backup'; readonly backupId: string }
  | { readonly type: 'switch-erp-standby' }
  | { readonly type: 'start-manual-shipping' }
  | { readonly type: 'close-manual-shipping' };
