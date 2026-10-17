import type { LocalOperation } from './integrity';

export interface DetectionConfigurationWork {
  readonly id: string;
  readonly endpointId: 'pakowanie-03';
  readonly threshold: number;
  readonly windowMinutes: 5 | 10 | 20;
  readonly window: number;
  readonly startHour: number;
  readonly completedHour: number | null;
}

export interface FundingAllocation {
  readonly id: 'board-resilience-ii';
  readonly source: 'integrity-risk-review';
  readonly amount: 25000;
  readonly window: number;
  readonly reportNumber: number;
}
export interface CampaignFunding {
  readonly initialAllocation: 80000;
  readonly allocations: readonly FundingAllocation[];
}
export interface EndpointCoverage {
  readonly endpointId: string;
  readonly sensorId: string;
  readonly agentAvailable: boolean;
  readonly collectorId: string;
  readonly collectorAvailable: boolean;
  readonly operations: readonly LocalOperation[];
  readonly retentionMinutes: number;
  readonly delayMinutes: number;
  readonly detection: {
    /** Absent on historical V4 rules: retain their original detector. */
    readonly counting?: 'unique-documents-v2';
    readonly id: string;
    readonly name: string;
    readonly operation: 'modify';
    readonly threshold: number;
    readonly windowMinutes: number;
  };
}
export interface BackupReadiness {
  readonly backupId: string;
  readonly testedAt: { readonly window: number; readonly hour: number };
  readonly snapshotSignature: string;
  readonly checkedDocumentIds: readonly string[];
  readonly integrity: 'clean' | 'damaged' | 'unavailable';
  readonly restoreTestPassed: boolean;
  readonly testedRestoreTurns: number;
}
export interface EndpointEvent {
  readonly id: string;
  readonly sensorId: string;
  readonly source: 'fortress-endpoint-agent';
  readonly endpointId: string;
  readonly accountId: string;
  readonly minute: number;
  readonly operation: LocalOperation;
  readonly targetAssetId: string;
  readonly protocol: 'SMB';
  readonly outcome: 'allowed' | 'denied';
  readonly documentIds: readonly string[];
  readonly capturedAtMinute: number;
}
export interface EndpointRecord extends EndpointEvent {
  readonly deliveredAtMinute: number;
  readonly availableAtMinute: number;
  readonly collectorId: string;
}
export interface EndpointAlert {
  readonly id: string;
  readonly ruleId: string;
  readonly name: string;
  readonly sensorId: string;
  readonly endpointId: string;
  readonly minute: number;
  readonly windowStartMinute: number;
  readonly windowEndMinute: number;
  /** Deduplication cursor derived only from delivered observable records. */
  readonly lastSeriesActivityMinute?: number;
  readonly threshold?: number;
  readonly windowMinutes?: number;
  readonly counting?: 'unique-documents-v2';
  readonly modificationCount: number;
  readonly eventIds: readonly string[];
  readonly assessment: 'requires-investigation';
}
export interface EndpointObservation {
  readonly id: string;
  readonly source: 'remote-collector';
  readonly collectorId: string;
  readonly sensorId: string;
  readonly observedAtMinute: number;
  readonly windowStartMinute: number;
  readonly windowEndMinute: number;
  readonly records: readonly EndpointRecord[];
}
export interface EndpointTelemetry {
  readonly coverage: EndpointCoverage;
  readonly coverageFromMinute: number;
  readonly nextEventNumber: number;
  readonly localEvents: readonly EndpointEvent[];
  readonly records: readonly EndpointRecord[];
  readonly alerts: readonly EndpointAlert[];
  readonly observations: readonly EndpointObservation[];
}
