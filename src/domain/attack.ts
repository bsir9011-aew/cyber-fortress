export type AttackAction =
  | 'reconnaissance'
  | 'start-transfer'
  | 'transfer'
  | 'authenticate';

export interface AttackDefinition {
  readonly id: string;
  readonly accountId: string;
  readonly stolenCredentialVersion: number;
  readonly initialSessionId: string | null;
  readonly firstAuthenticationTurn?: number;
  readonly knownGatewayAssetId: string;
  /** Jedyny trop scenariusza, nie wiedza o całym grafie infrastruktury. */
  readonly targetAssetId: string;
  readonly protocol: string;
  readonly recordLimit: number;
  readonly chunkSizes: readonly number[];
  readonly firstReconnaissanceTurn: number;
  readonly retryDelayTurns: number;
  readonly maxConsecutiveFailures: number;
}

export interface PlannedAttackAction {
  readonly kind: AttackAction;
  readonly dueTurn: number;
}

export type AttackOutcome =
  | 'reconnaissance-confirmed'
  | 'transfer-started'
  | 'records-copied'
  | 'session-lost'
  | 'access-denied'
  | 'authentication-accepted'
  | 'authentication-rejected';

export interface PrivateAttackEvent {
  readonly id: string;
  readonly turn: number;
  readonly minute: number;
  readonly action: AttackAction;
  readonly outcome: AttackOutcome;
  readonly sessionId: string | null;
  readonly copiedRecords: number;
  readonly totalExposedRecords: number;
}

export interface AttackerState {
  readonly definition: AttackDefinition;
  readonly status: 'active' | 'completed' | 'blocked';
  readonly currentSessionId: string | null;
  readonly knowledge: {
    readonly reconnaissanceConfirmed: boolean;
    /** Wynik własnej ostatniej próby; nie jest aktualizowany zmianą reguły. */
    readonly lastAccess: {
      readonly turn: number;
      readonly allowed: boolean;
    } | null;
    readonly lastAuthentication: 'accepted' | 'rejected' | null;
  };
  readonly transfer: {
    readonly started: boolean;
    readonly nextChunkIndex: number;
    readonly exposedRecords: number;
  };
  readonly consecutiveFailures: number;
  readonly authenticationAttempts: number;
  readonly nextAction: PlannedAttackAction | null;
  readonly privateHistory: readonly PrivateAttackEvent[];
}
