import type { CampaignFunding } from './resilience';
import type { Account, NetworkRule, VpnSession } from './access';
import type { ThreatAccessAssessment } from './incident';
import type {
  BusinessReport,
  BusinessState,
  EmployeeTask,
  ProcessAvailability,
  TaskAction,
} from './simulation';
import type { IntegrityMissionSummary } from './integrity';
import type {
  PreparationWork,
  SecurityPosture,
  SecurityProject,
  BudgetOperation,
} from './campaign';

export const MAX_AAR_BYTES = 2 * 1024 * 1024;
export const MAX_AAR_DECISIONS = 256;

/** Portable JSON facts, never executable instructions. */
export type AarData =
  | null
  | boolean
  | number
  | string
  | readonly AarData[]
  | { readonly [key: string]: AarData };
export interface AarTime {
  readonly minute: number;
  readonly turn: number | null;
}
export interface AarEvidence {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
  readonly obtainedAt: AarTime;
  readonly obtainedByCommand: number;
  readonly taskId: string | null;
  readonly assertion: 'signal' | 'observation' | 'human-statement' | 'message';
  readonly details: AarData;
}
export interface KnownAtDecision {
  readonly asOfCommand: number;
  readonly at: AarTime;
  readonly evidenceIds: readonly string[];
  readonly alertIds: readonly string[];
  readonly knownSessionIds: readonly string[];
  readonly sessions:
    | readonly {
        readonly id: string;
        readonly accountId: string;
        readonly gatewayAssetId: string;
        readonly startedAtMinute: number;
      }[]
    | null;
  readonly hypotheses: {
    readonly vpn: string;
    readonly integrity: string | null;
  };
  readonly configuration: {
    readonly assets: readonly {
      readonly id: string;
      readonly name: string;
      readonly status: string;
    }[];
    readonly networkRules: readonly NetworkRule[];
    readonly knownAccounts: readonly {
      readonly id: string;
      readonly blocked: boolean;
    }[];
    readonly sensors: AarData;
    readonly endpoint: AarData;
    readonly backupReadiness: AarData;
  };
  readonly business: BusinessState;
  readonly pendingTasks: readonly EmployeeTask[];
  readonly sourceLimitations: readonly string[];
  readonly unknowns: readonly string[];
}
export interface AarActualState {
  readonly threatAccess: ThreatAccessAssessment;
  readonly accounts: readonly Account[];
  readonly sessions: readonly (VpnSession & {
    readonly origin: 'legitimate' | 'unauthorized' | 'unclassified';
  })[];
  readonly serviceAccess: readonly {
    readonly sessionId: string;
    readonly targetAssetId: string;
    readonly protocol: string;
    readonly allowed: boolean;
  }[];
  readonly exposedRecords: number;
  readonly endpoint: AarData;
  readonly documents: {
    readonly total: number;
    readonly correct: number;
    readonly damaged: number;
    readonly reconcile: number;
    readonly recovered: number;
  } | null;
  readonly availability: ProcessAvailability;
}
export interface AarTimelineEntry {
  readonly id: string;
  readonly at: AarTime;
  readonly phase:
    | 'initial'
    | 'command'
    | 'interval-settlement'
    | 'task-completion'
    | 'actor-resolution'
    | 'telemetry'
    | 'observation'
    | 'finish';
  readonly kind: string;
  readonly source: string;
  readonly status: string;
  readonly commandOrdinal: number | null;
  readonly decisionId: string | null;
  readonly taskId: string | null;
  readonly evidenceId: string | null;
  readonly details: AarData;
}
export interface AarDecision {
  readonly id: string;
  readonly commandOrdinal: number;
  readonly issuedAt: AarTime;
  readonly completedAt: AarTime | null;
  readonly workerId: string | null;
  readonly action:
    | TaskAction
    | {
        readonly type: 'set-hypothesis' | 'set-integrity-hypothesis';
        readonly hypothesis: string;
      };
  readonly target: {
    readonly kind: string;
    readonly id: string | null;
    readonly resourceIds: readonly string[];
    readonly flow: AarData;
  };
  readonly taskId: string | null;
  readonly status: 'completed' | 'running' | 'rejected' | 'recorded';
  readonly rejection: string | null;
  readonly knownAtDecision: KnownAtDecision;
  readonly actualStateAtDecision: AarActualState;
  readonly expectedEffect: null;
  readonly intentRecorded: false;
  readonly actualEffect: {
    readonly scope: 'completion-boundary-including-concurrent-events';
    readonly boundaryState: AarActualState;
    readonly immediateAccessImpact: AarData;
    readonly eventIds: readonly string[];
  } | null;
  readonly subsequentConsequences: {
    readonly afterEventId: string;
    readonly throughEventId: string;
    readonly includesOtherCauses: true;
    readonly finalSecurityRef: 'securityConsequences';
    readonly finalBusinessRef: 'businessConsequences';
  };
}
export interface AarCampaignContext {
  readonly missionNumber: number;
  readonly preparationWindow: number;
  readonly budgetAtStart: {
    readonly total: number;
    readonly spent: number;
    readonly reserved: number;
    readonly available: number;
  };
  readonly funding: CampaignFunding | null;
  readonly projects: readonly (SecurityProject & {
    readonly name: string;
    readonly costPLN: number;
    readonly mechanism: string;
    readonly limitation: string;
  })[];
  readonly work: readonly PreparationWork[];
  readonly investmentLedger: readonly BudgetOperation[];
  readonly posture: SecurityPosture;
  readonly detectionChanges?: readonly import('./resilience').DetectionConfigurationWork[];
}
export interface FortressAfterActionReportV1 {
  readonly format: 'FORTRESS_AAR';
  readonly schemaVersion: 1;
  readonly reportId: string;
  readonly missionId: string;
  readonly generatedAt: string;
  readonly gameVersion: {
    readonly application: '0.2.0';
    readonly engine: '9.0.0' | '11.0.0';
    readonly reportGenerator: '1.0.0' | '1.1.0';
  };
  readonly fieldGuide: Readonly<Record<string, string>>;
  readonly organization: {
    readonly name: 'NEXUS Logistics';
    readonly employees: 120;
    readonly computers: 94;
  };
  readonly scenario: {
    readonly id: string;
    readonly family: 'M01' | 'M02';
    readonly variantFamilyId?: 'nexus-integrity-detection-v1';
    readonly name: string;
    readonly kind: string;
    readonly mode: string;
    readonly seed: number;
    readonly startMinute: number;
    readonly endMinute: number;
    readonly turnMinutes: number;
    readonly turnLimit: number;
  };
  readonly campaignContext: AarCampaignContext | null;
  readonly missionObjectives: AarData;
  readonly finalOutcome: {
    readonly confidentialityMet: boolean | null;
    readonly continuityMet: boolean;
    readonly containmentMet: boolean | null;
    readonly integrityMet: boolean | null;
    readonly allObjectivesMet: boolean;
  };
  readonly timeline: readonly AarTimelineEntry[];
  readonly playerDecisions: readonly AarDecision[];
  readonly knownEvidence: readonly AarEvidence[];
  readonly groundTruth: {
    readonly explanation: string;
    readonly initialState: AarActualState;
    readonly finalState: AarActualState;
    readonly authentication: AarData;
    readonly vpnThreat: AarData;
    readonly vpnAttackerActivity: AarData;
    readonly localOperations: AarData;
    readonly localThreatAttempts: AarData;
    readonly telemetry: AarData;
    readonly backups: AarData;
  };
  readonly securityConsequences: {
    readonly exposedRecords: number;
    readonly containment: ThreatAccessAssessment & {
      readonly required: boolean;
      readonly goalMet: boolean | null;
      readonly retryBudgetExhausted: boolean;
      readonly stoppedOnlyByRetryBudget: boolean;
    };
    readonly integrity: IntegrityMissionSummary | null;
    readonly investmentUse: AarData;
    readonly detectionReview?: AarData;
  };
  readonly businessConsequences: {
    readonly ordersReceived: number;
    readonly ordersProcessed: number;
    readonly finalBacklog: number;
    readonly peakBacklog: number;
    readonly perTurn: readonly BusinessReport[];
    readonly capacityTransitions: readonly {
      readonly at: AarTime;
      readonly intervalStartMinute: number;
      readonly previousCapacity: number | null;
      readonly capacity: number;
    }[];
  };
  readonly lessonsContext: {
    readonly hypothesesAreUnverified: true;
    readonly reasoningQuestions: readonly string[];
    readonly replay: AarData;
  };
  readonly limitations: readonly string[];
  readonly provenance: {
    readonly method: 'validated-command-replay';
    readonly commandCount: number;
    readonly ordering: string;
    readonly sourceMap: Readonly<Record<string, string>>;
  };
}
