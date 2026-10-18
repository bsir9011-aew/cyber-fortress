import type { BranchDefinition } from './branch';
import type { RecoveryDefinition } from './recovery';
import type { VendorDefinition } from './vendor';
import type { AccessState } from './access';
import type { AttackDefinition } from './attack';
import type { BusinessProcess, SimulationClock } from './simulation';
import type { TelemetryState } from './telemetry';
import type { WorldState } from './world';
import type { IntegrityDefinition } from './integrity';
import type { BackupReadiness } from './resilience';

export type ScenarioMode = 'training' | 'unknown';
export interface RunIdentity {
  readonly mode: ScenarioMode;
  readonly seed: number;
}

export interface LegitimateBehavior {
  readonly secondFactorVersion?: number;
  readonly id: string;
  readonly accountId: string;
  readonly credentialPolicy: 'managed-current' | 'fixed';
  readonly credentialVersion: number;
  readonly reconnectDelayTurns: number;
  readonly sessionIdPrefix: string;
}

export interface LegitimateActorState {
  readonly id: string;
  readonly nextAuthenticationTurn: number | null;
}

export interface HistoricalAuthenticationAttempt {
  readonly actorId: string;
  readonly minute: number;
  readonly credentialVersion: number;
  readonly requestedSessionId: string;
}

export interface ScenarioDefinition {
  readonly familyId?:
    | 'nexus-integrity-detection-v1'
    | 'nexus-vendor-access-v1'
    | 'nexus-erp-recovery-v1'
    | 'nexus-east-branch-v1';
  readonly branch?: BranchDefinition;
  readonly recovery?: RecoveryDefinition;
  readonly vendor?: VendorDefinition;
  readonly backupReadiness?: BackupReadiness;
  readonly integrity?: IntegrityDefinition;
  readonly id: string;
  /** Prywatny opis, ujawniany dopiero w raporcie. */
  readonly name: string;
  readonly kind:
    | 'unauthorized-session'
    | 'legitimate-session'
    | 'stolen-credential'
    | 'local-integrity'
    | 'third-party-access'
    | 'erp-recovery'
    | 'branch-architecture';
  readonly explanation: string;
  readonly world: WorldState;
  readonly clock: Omit<SimulationClock, 'turn'>;
  readonly process: BusinessProcess;
  readonly access: AccessState;
  readonly telemetry: TelemetryState;
  readonly initialSessionOrigins: Readonly<
    Record<string, 'unauthorized' | 'legitimate'>
  >;
  /** Opcjonalne próby wstępne są rozstrzygane przez prawdziwy mechanizm logowania. */
  readonly authenticationPrelude: readonly HistoricalAuthenticationAttempt[];
  readonly legitimateBehaviors: readonly LegitimateBehavior[];
  readonly attacker: AttackDefinition | null;
  readonly witnesses: readonly {
    readonly accountId: string;
    readonly speaker: 'Marta';
    readonly referencedMinute: number;
    readonly text: string;
  }[];
  readonly goals: {
    readonly recordPool: number;
    readonly maxExposedRecords: number;
    readonly maxFinalBacklog: number;
    readonly requireThreatContainment: boolean;
  };
  readonly briefing: {
    readonly title: string;
    readonly message: string;
    readonly analystHint: string;
  };
}
