import type { SimulationState } from '../domain/simulation';
import type {
  AuthenticationObservation,
  AuthenticationRecord,
  TelemetryState,
  VpnAlert,
} from '../domain/telemetry';
import { isAssetOnline } from './access';
import type { SessionIssueResult } from './access';
import { currentMinute } from './clock';

/** Wywoływane przy rzeczywistej próbie w usłudze, nie na podstawie etykiety aktora. */
export function recordAuthentication(
  state: SimulationState,
  accountId: string,
  result: SessionIssueResult,
): SimulationState {
  if (!isAssetOnline(state.world, state.access.vpnAssetId)) return state;
  return {
    ...state,
    telemetry: {
      ...state.telemetry,
      sourceEvents: [
        ...state.telemetry.sourceEvents,
        {
          id: `AUTH-${String(state.telemetry.sourceEvents.length + 1).padStart(4, '0')}`,
          minute: currentMinute(state.clock),
          sourceAssetId: state.access.vpnAssetId,
          accountId,
          outcome: result.ok ? 'success' : 'failure',
          sessionId: result.ok ? result.session.id : null,
        },
      ],
    },
  };
}

export function collectAuthenticationTelemetry(
  state: SimulationState,
): TelemetryState {
  const telemetry = state.telemetry;
  const sensor = telemetry.authenticationSensor;
  const minute = currentMinute(state.clock);
  const records = telemetry.authenticationRecords.filter(
    (event) => event.minute >= minute - sensor.retentionMinutes,
  );
  if (sensor.enabled && isAssetOnline(state.world, sensor.sourceAssetId)) {
    for (const event of telemetry.sourceEvents.slice(
      telemetry.processedSourceCount,
    )) {
      if (
        event.sourceAssetId !== sensor.sourceAssetId ||
        event.minute <
          Math.max(
            sensor.coverageFromMinute,
            minute - sensor.retentionMinutes,
          ) ||
        event.minute > minute
      )
        continue;
      records.push({
        ...event,
        sensorId: sensor.id,
        capturedAtMinute: minute,
        availableAtMinute: minute + sensor.delayMinutes,
      });
    }
  }
  return {
    ...telemetry,
    processedSourceCount: telemetry.sourceEvents.length,
    authenticationRecords: records,
  };
}

/** Dostępne wejście detektora i badania; nie oznacza jeszcze wiedzy gracza. */
export function availableAuthenticationRecords(
  telemetry: TelemetryState,
  minute: number,
): readonly AuthenticationRecord[] {
  const sensor = telemetry.authenticationSensor;
  return telemetry.authenticationRecords.filter(
    (record) =>
      record.sensorId === sensor.id &&
      record.availableAtMinute <= minute &&
      record.minute >=
        Math.max(sensor.coverageFromMinute, minute - sensor.retentionMinutes),
  );
}

/** Detektor nie przyjmuje SimulationState, hidden ani pochodzenia sesji. */
export function detectVpnAlerts(
  records: readonly AuthenticationRecord[],
  minute: number,
  existing: readonly VpnAlert[],
): readonly VpnAlert[] {
  const windowStartMinute = minute - 20;
  const groups = new Map<string, AuthenticationRecord[]>();
  for (const record of records) {
    if (
      record.outcome !== 'failure' ||
      record.minute < windowStartMinute ||
      record.minute > minute ||
      record.availableAtMinute > minute
    )
      continue;
    const key = `${record.sensorId}:${record.accountId}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  const alerts = [...existing];
  for (const failures of groups.values()) {
    const first = failures[0]!;
    if (
      failures.length < 20 ||
      alerts.some(
        (alert) =>
          alert.sensorId === first.sensorId &&
          alert.accountId === first.accountId,
      )
    )
      continue;
    alerts.push({
      id: `AL-${first.sensorId}-${first.accountId}`,
      minute,
      ruleId: 'vpn-auth-failures',
      sensorId: first.sensorId,
      accountId: first.accountId,
      windowStartMinute,
      windowEndMinute: minute,
      failureCount: failures.length,
      assessment: 'requires-investigation',
    });
  }
  return alerts;
}

export function updateTelemetry(state: SimulationState): SimulationState {
  const telemetry = collectAuthenticationTelemetry(state);
  const minute = currentMinute(state.clock);
  return {
    ...state,
    telemetry,
    incident: {
      ...state.incident,
      alerts: detectVpnAlerts(
        availableAuthenticationRecords(telemetry, minute),
        minute,
        state.incident.alerts,
      ),
    },
  };
}

export function readAuthenticationLogs(
  state: SimulationState,
  id: string,
): AuthenticationObservation | null {
  const sensor = state.telemetry.authenticationSensor;
  if (!sensor.enabled || !isAssetOnline(state.world, sensor.sourceAssetId))
    return null;
  const minute = currentMinute(state.clock);
  return {
    id,
    observedAtMinute: minute,
    sensorId: sensor.id,
    sourceAssetId: sensor.sourceAssetId,
    windowStartMinute: Math.max(
      sensor.coverageFromMinute,
      minute - sensor.retentionMinutes,
    ),
    windowEndMinute: minute - sensor.delayMinutes,
    retentionMinutes: sensor.retentionMinutes,
    delayMinutes: sensor.delayMinutes,
    records: availableAuthenticationRecords(state.telemetry, minute).map(
      (record) => ({ ...record }),
    ),
  };
}
