import type { AccessState, NetworkRule } from './access';
import type { WorldState } from './world';
import type { AttackerState } from './attack';

export interface SimulationClock {
  readonly startMinute: number;
  readonly turnMinutes: number;
  readonly turnLimit: number;
  readonly turn: number;
}

export interface BusinessProcess {
  readonly id: string;
  readonly name: string;
  readonly ordersPerTurn: number;
  readonly localCapacity: number;
  readonly remoteCapacity: number;
  readonly maxFinalBacklog: number;
  readonly erpAssetId: string;
  readonly workstationAssetId: string;
  readonly remoteAccountId: string;
  readonly protocol: string;
}

export interface ProcessAvailability {
  readonly capacity: number;
  readonly localAvailable: boolean;
  readonly remoteAvailable: boolean;
  readonly status: 'available' | 'degraded' | 'unavailable';
}

export interface BusinessReport extends ProcessAvailability {
  readonly turn: number;
  readonly received: number;
  readonly processed: number;
  readonly backlog: number;
}

export interface BusinessState {
  readonly totalReceived: number;
  readonly totalProcessed: number;
  readonly backlog: number;
  readonly lastReport: BusinessReport | null;
}

export type WorkerId = 'analyst' | 'administrator';
export type TaskAction =
  | { readonly type: 'inspect-vpn-sessions' }
  | { readonly type: 'inspect-auth-logs' }
  | { readonly type: 'terminate-session'; readonly sessionId: string }
  | { readonly type: 'block-account'; readonly accountId: string }
  | { readonly type: 'reset-credential'; readonly accountId: string }
  | {
      readonly type: 'set-vpn';
      readonly assetId: string;
      readonly enabled: boolean;
    }
  | {
      readonly type: 'set-network-rule';
      readonly ruleId: string;
      readonly action: NetworkRule['action'];
    };

export interface EmployeeTask {
  readonly id: string;
  readonly workerId: WorkerId;
  readonly action: TaskAction;
  readonly startTurn: number;
  readonly dueTurn: number;
  readonly status: 'running' | 'completed';
}

export type SimulationCommand =
  | { readonly type: 'advance-turn' }
  | {
      readonly type: 'schedule-task';
      readonly workerId: WorkerId;
      readonly action: TaskAction;
    }
  | { readonly type: 'reset' };

/** Odczyt bramy, bez pochodzenia sesji i wersji poświadczeń. */
export interface ObservedSession {
  readonly id: string;
  readonly accountId: string;
  readonly gatewayAssetId: string;
  readonly startedAtMinute: number;
}

export interface SessionObservation {
  readonly observedAtMinute: number;
  readonly sessions: readonly ObservedSession[];
}

export interface PlayerKnowledge {
  readonly sessionObservation: SessionObservation | null;
}

export type CommandRejection =
  | 'simulation-finished'
  | 'worker-busy'
  | 'wrong-worker'
  | 'unknown-target'
  | 'target-not-observed'
  | 'invalid-state'
  | 'source-unavailable'
  | 'outside-time-window'
  | 'invalid-command';

interface EventBase {
  readonly id: string;
  readonly minute: number;
}
export type SimulationEventData =
  | { readonly kind: 'command-rejected'; readonly reason: CommandRejection }
  | {
      readonly kind:
        'task-started' | 'task-completed' | 'configuration-changed';
      readonly task: EmployeeTask;
    }
  | { readonly kind: 'business-report'; readonly report: BusinessReport }
  | { readonly kind: 'sessions-observed'; readonly count: number }
  | { readonly kind: 'research-unavailable' }
  | { readonly kind: 'simulation-finished'; readonly success: boolean };

export type SimulationEvent = EventBase & SimulationEventData;

export interface SimulationState {
  readonly world: WorldState;
  readonly clock: SimulationClock;
  readonly process: BusinessProcess;
  readonly access: AccessState;
  readonly business: BusinessState;
  readonly tasks: readonly EmployeeTask[];
  readonly knowledge: PlayerKnowledge;
  /** Dziennik potwierdzeń działań i raportów biznesowych, nie log uwierzytelnień. */
  readonly history: readonly SimulationEvent[];
  readonly hidden: {
    readonly attacker: AttackerState;
    readonly sessionOrigins: Readonly<
      Record<string, 'unauthorized' | 'legitimate'>
    >;
  };
}
