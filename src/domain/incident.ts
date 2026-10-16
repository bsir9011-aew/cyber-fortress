import type { TaskAction } from './simulation';
import type { VpnAlert } from './telemetry';

export type IncidentHypothesis =
  | 'insufficient-evidence'
  | 'compromised-credential'
  | 'unusual-legitimate-session'
  | 'existing-tunnel-access';

export interface OwnerStatement {
  readonly id: string;
  readonly kind: 'human-statement';
  readonly accountId: string;
  readonly speaker: string;
  readonly observedAtMinute: number;
  readonly referencedMinute: number;
  readonly text: string;
}

export interface NarrativeMessage {
  readonly id: string;
  readonly minute: number;
  readonly speaker: 'Ewa' | 'Bartek' | 'Analityk' | 'Marta';
  readonly text: string;
  readonly source:
    | 'briefing'
    | 'business'
    | 'task'
    | 'configuration'
    | 'human-statement';
  readonly referenceId: string;
}

export interface IncidentState {
  readonly alerts: readonly VpnAlert[];
  readonly hypothesis: IncidentHypothesis;
  readonly messages: readonly NarrativeMessage[];
}

/** Wyłącznie diagnoza po rozgrywce, nigdy wejście detektora lub narracji. */
export interface ThreatAccessAssessment {
  readonly applicable: boolean;
  readonly activeSessionIds: readonly string[];
  readonly usableSessionIds: readonly string[];
  readonly stolenCredentialStillCurrent: boolean;
  readonly newAuthenticationAllowed: boolean;
  readonly accessAfterNewAuthentication: boolean;
  readonly targetAccessCutOff: boolean;
  readonly accountContained: boolean;
}

export interface DecisionRecord {
  readonly taskId: string;
  readonly action: TaskAction;
  readonly orderedAtMinute: number;
  readonly completedAtMinute: number | null;
  readonly knownThen: {
    readonly alertIds: readonly string[];
    readonly authObservationMinute: number | null;
    readonly authRecordCount: number;
    readonly sessionObservationMinute: number | null;
    readonly sessionIds: readonly string[];
    readonly ownerStatementMinute: number | null;
    readonly hypothesis: IncidentHypothesis;
  };
  readonly impact: {
    readonly before: ThreatAccessAssessment;
    readonly after: ThreatAccessAssessment;
    readonly remoteCapacityBefore: number;
    readonly remoteCapacityAfter: number;
    readonly exposedRecordsAtCompletion: number;
    readonly changedCapabilities: boolean;
  } | null;
}
