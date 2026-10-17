/** Zdarzenie wytworzone przez usługę. Nie zawiera pochodzenia sesji ani sekretów. */
export interface AuthenticationEvent {
  readonly reason?:
    | 'invalid-request'
    | 'service-unavailable'
    | 'account-blocked'
    | 'invalid-credential'
    | 'mfa-required';
  readonly id: string;
  readonly minute: number;
  readonly sourceAssetId: string;
  readonly accountId: string;
  readonly outcome: 'failure' | 'success';
  readonly sessionId: string | null;
}

export interface AuthenticationRecord extends AuthenticationEvent {
  readonly sensorId: string;
  readonly capturedAtMinute: number;
  readonly availableAtMinute: number;
}

export interface AuthenticationSensor {
  readonly id: string;
  readonly sourceAssetId: string;
  readonly enabled: boolean;
  readonly coverageFromMinute: number;
  readonly retentionMinutes: number;
  readonly delayMinutes: number;
}

export interface TelemetryState {
  readonly authenticationReasons?: true;
  readonly fileAudit?: FileAuditState;
  readonly authenticationSensor: AuthenticationSensor;
  /** Sensor migawkowy: bez historii, bez opóźnienia, tylko aktywne tunele bramy. */
  readonly sessionSensor: {
    readonly id: string;
    readonly sourceAssetId: string;
    readonly enabled: boolean;
    readonly retentionMinutes: 0;
    readonly delayMinutes: 0;
  };
  readonly sourceEvents: readonly AuthenticationEvent[];
  /** Przetworzenie źródła podczas braku pokrycia nie pozwala odzyskać go wstecz. */
  readonly processedSourceCount: number;
  readonly authenticationRecords: readonly AuthenticationRecord[];
}

export interface AuthenticationObservation {
  readonly id: string;
  readonly observedAtMinute: number;
  readonly sensorId: string;
  readonly sourceAssetId: string;
  readonly windowStartMinute: number;
  readonly windowEndMinute: number;
  readonly retentionMinutes: number;
  readonly delayMinutes: number;
  readonly records: readonly AuthenticationRecord[];
}

export interface VpnAlert {
  readonly id: string;
  readonly minute: number;
  readonly ruleId: 'vpn-auth-failures';
  readonly sensorId: string;
  readonly accountId: string;
  readonly windowStartMinute: number;
  readonly windowEndMinute: number;
  readonly failureCount: number;
  readonly assessment: 'requires-investigation';
}

export interface FileAccessEvent {
  readonly id: string;
  readonly minute: number;
  readonly accountId: string;
  readonly sessionId: string | null;
  readonly endpointId?: string;
  readonly documentIds?: readonly string[];
  readonly targetAssetId: string;
  readonly operation: 'list' | 'open' | 'read' | 'modify';
  readonly outcome: 'allowed' | 'denied';
  /** Liczba rekordów zmierzona przez usługę tylko przy skutecznym read. */
  readonly recordsRead: number | null;
}
export interface FileAccessRecord extends FileAccessEvent {
  readonly sensorId: string;
  readonly capturedAtMinute: number;
  readonly availableAtMinute: number;
}
export interface FileAuditState {
  readonly sensor: {
    readonly id: string;
    readonly sourceAssetId: string;
    readonly enabled: boolean;
    readonly coverageFromMinute: number;
    readonly retentionMinutes: number;
    readonly delayMinutes: number;
  };
  readonly sourceEvents: readonly FileAccessEvent[];
  readonly records: readonly FileAccessRecord[];
  readonly processedSourceCount: number;
}
export interface FileAccessObservation {
  readonly id: string;
  readonly observedAtMinute: number;
  readonly sensorId: string;
  readonly sourceAssetId: string;
  readonly windowStartMinute: number;
  readonly windowEndMinute: number;
  readonly records: readonly FileAccessRecord[];
}
