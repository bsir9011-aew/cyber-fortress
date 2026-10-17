import type {
  EndpointAlert,
  EndpointCoverage,
  EndpointEvent,
  EndpointObservation,
  EndpointRecord,
  EndpointTelemetry,
} from '../domain/resilience';
import type { LocalEndpoint, LocalOperationRecord } from '../domain/integrity';
import type { WorldState } from '../domain/world';
import type { SimulationState } from '../domain/simulation';
import { isAssetOnline } from './access';
import { currentMinute } from './clock';

export function endpointAgentAvailable(
  world: WorldState,
  endpoint: LocalEndpoint,
  coverage: EndpointCoverage,
) {
  return (
    coverage.agentAvailable &&
    coverage.endpointId === endpoint.id &&
    isAssetOnline(world, endpoint.assetId)
  );
}
/** Explicit abstract management channel; endpoint isolation cuts this path too. */
export function endpointChannelAvailable(
  world: WorldState,
  endpoint: LocalEndpoint,
  coverage: EndpointCoverage,
) {
  return (
    endpointAgentAvailable(world, endpoint, coverage) &&
    coverage.collectorAvailable &&
    !endpoint.isolated
  );
}
export function captureEndpointOperation(
  telemetry: EndpointTelemetry,
  world: WorldState,
  endpoint: LocalEndpoint,
  operation: LocalOperationRecord,
  targetAssetId: string,
): EndpointTelemetry {
  const c = telemetry.coverage;
  if (
    !endpointAgentAvailable(world, endpoint, c) ||
    c.endpointId !== operation.endpointId ||
    !c.operations.includes(operation.operation) ||
    operation.minute < telemetry.coverageFromMinute
  )
    return telemetry;
  const event: EndpointEvent = {
    id: `EDR-${String(telemetry.nextEventNumber).padStart(4, '0')}`,
    sensorId: c.sensorId,
    source: 'fortress-endpoint-agent',
    endpointId: operation.endpointId,
    accountId: operation.accountId,
    minute: operation.minute,
    capturedAtMinute: operation.minute,
    operation: operation.operation,
    targetAssetId,
    protocol: 'SMB',
    outcome: operation.outcome,
    documentIds: [...operation.documentIds],
  };
  return {
    ...telemetry,
    nextEventNumber: telemetry.nextEventNumber + 1,
    localEvents: [...telemetry.localEvents, event],
    records: endpointChannelAvailable(world, endpoint, c)
      ? [
          ...telemetry.records,
          {
            ...event,
            collectorId: c.collectorId,
            deliveredAtMinute: event.minute,
            availableAtMinute: event.minute + c.delayMinutes,
          },
        ]
      : telemetry.records,
  };
}
export function availableEndpointRecords(
  telemetry: EndpointTelemetry,
  minute: number,
) {
  const c = telemetry.coverage;
  return telemetry.records.filter(
    (r) =>
      r.sensorId === c.sensorId &&
      r.endpointId === c.endpointId &&
      r.collectorId === c.collectorId &&
      r.availableAtMinute <= minute &&
      r.deliveredAtMinute <= minute &&
      r.minute >=
        Math.max(telemetry.coverageFromMinute, minute - c.retentionMinutes) &&
      r.minute <= minute,
  );
}
/** Observable records eligible for the rule's source-time window. */
export function endpointDetectionRecords(
  records: readonly EndpointRecord[],
  rule: EndpointCoverage['detection'],
  minute: number,
): readonly EndpointRecord[] {
  return [...new Map(records.map((r) => [r.id, r])).values()].filter(
    (r) =>
      r.operation === rule.operation &&
      r.outcome === 'allowed' &&
      r.availableAtMinute <= minute &&
      r.deliveredAtMinute <= minute &&
      r.minute <= minute &&
      r.minute >= minute - rule.windowMinutes,
  );
}
/** Same series test for the live detector and its read-only debrief projection. */
export function continuesEndpointSeries(
  records: readonly EndpointRecord[],
  cursor: number,
  windowMinutes: number,
): boolean {
  return records.some((r) => r.minute <= cursor + windowMinutes);
}
/** Detector has no input for compromise, planner, actor origin or private world. */
export function detectEndpointAlerts(
  records: readonly EndpointRecord[],
  rule: EndpointCoverage['detection'],
  minute: number,
  existing: readonly EndpointAlert[],
): readonly EndpointAlert[] {
  const groups = new Map<string, EndpointRecord[]>();
  for (const r of endpointDetectionRecords(records, rule, minute)) {
    const key = `${r.sensorId}:${r.endpointId}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const alerts = [...existing];
  for (const group of groups.values()) {
    const first = group[0]!;
    const modern = rule.counting === 'unique-documents-v2';
    const count = modern
      ? new Set(group.flatMap((r) => r.documentIds)).size
      : group.reduce((n, r) => n + new Set(r.documentIds).size, 0);
    const previousIndex =
      alerts
        .map((a, index) => ({ a, index }))
        .reverse()
        .find(
          ({ a }) =>
            a.ruleId === rule.id &&
            a.endpointId === first.endpointId &&
            a.sensorId === first.sensorId,
        )?.index ?? -1;
    const previous = alerts[previousIndex];
    const lastActivity = Math.max(...group.map((r) => r.minute));
    if (previous) {
      if (!modern) continue;
      const cursor =
        previous.lastSeriesActivityMinute ?? previous.windowEndMinute;
      // A new series needs a gap strictly greater than the declared window.
      // Keep its cursor separate from the original alert's triggering evidence.
      if (continuesEndpointSeries(group, cursor, rule.windowMinutes)) {
        alerts[previousIndex] = {
          ...previous,
          lastSeriesActivityMinute: Math.max(cursor, lastActivity),
        };
        continue;
      }
    }
    if (count < rule.threshold) continue;
    alerts.push({
      id: `AL-${rule.id}-${first.endpointId}${modern ? `-${alerts.length + 1}` : ''}`,
      ...(modern
        ? {
            lastSeriesActivityMinute: lastActivity,
            threshold: rule.threshold,
            windowMinutes: rule.windowMinutes,
            counting: rule.counting,
          }
        : {}),
      ruleId: rule.id,
      name: rule.name,
      sensorId: first.sensorId,
      endpointId: first.endpointId,
      minute,
      windowStartMinute: minute - rule.windowMinutes,
      windowEndMinute: minute,
      modificationCount: count,
      eventIds: group.map((r) => r.id),
      assessment: 'requires-investigation',
    });
  }
  return alerts;
}
export function collectEndpointTelemetry(
  state: SimulationState,
): SimulationState['telemetry'] {
  const telemetry = state.telemetry.endpoint;
  const endpoint = state.integrity?.endpoint;
  if (!telemetry || !endpoint) return state.telemetry;
  const minute = currentMinute(state.clock);
  const c = telemetry.coverage;
  const localEvents = telemetry.localEvents.filter(
    (e) => e.minute >= minute - c.retentionMinutes,
  );
  const records = telemetry.records.filter(
    (r) => r.minute >= minute - c.retentionMinutes,
  );
  const delivered = new Set(records.map((r) => r.id));
  if (endpointChannelAvailable(state.world, endpoint, c))
    for (const event of localEvents) {
      if (!delivered.has(event.id) && event.minute <= minute)
        records.push({
          ...event,
          collectorId: c.collectorId,
          deliveredAtMinute: minute,
          availableAtMinute: minute + c.delayMinutes,
        });
    }
  const next: EndpointTelemetry = { ...telemetry, localEvents, records };
  return {
    ...state.telemetry,
    endpoint: {
      ...next,
      alerts:
        c.detection.counting && !c.collectorAvailable
          ? telemetry.alerts
          : detectEndpointAlerts(
              availableEndpointRecords(next, minute),
              c.detection,
              minute,
              telemetry.alerts,
            ),
    },
  };
}
export function readEndpointTelemetry(
  state: Pick<SimulationState, 'clock' | 'telemetry'>,
  id: string,
): EndpointObservation | null {
  const e = state.telemetry.endpoint;
  if (!e?.coverage.collectorAvailable) return null;
  const minute = currentMinute(state.clock);
  return {
    id,
    source: 'remote-collector',
    collectorId: e.coverage.collectorId,
    sensorId: e.coverage.sensorId,
    observedAtMinute: minute,
    windowStartMinute: Math.max(
      e.coverageFromMinute,
      minute - e.coverage.retentionMinutes,
    ),
    windowEndMinute: minute - e.coverage.delayMinutes,
    records: availableEndpointRecords(e, minute).map((r) => ({
      ...r,
      documentIds: [...r.documentIds],
    })),
  };
}
