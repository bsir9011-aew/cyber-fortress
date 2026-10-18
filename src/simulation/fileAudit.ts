import { recordVendorOperation } from './vendorTelemetry';
import type { SimulationState } from '../domain/simulation';
import type {
  FileAccessEvent,
  FileAccessObservation,
  TelemetryState,
} from '../domain/telemetry';
import {
  canUseService,
  isAssetOnline,
  isSessionActive,
  networkAllows,
} from './access';
import { currentMinute } from './clock';
import { resolveLocalFileOperation } from './integrity';

/** Resolver źródła: serwer widzi jedynie żądania, które faktycznie dotarły. */
export function attemptFileAccess(
  state: SimulationState,
  sessionId: string,
  targetAssetId: string,
  operation: FileAccessEvent['operation'],
  volume: number | null,
  minute = currentMinute(state.clock),
) {
  const allowed = canUseService(
    state.world,
    state.access,
    sessionId,
    targetAssetId,
    'SMB',
    currentMinute(state.clock),
  );
  state = recordVendorOperation(
    state,
    sessionId,
    targetAssetId,
    'SMB',
    operation,
    volume,
    allowed,
  );
  const audit = state.telemetry.fileAudit;
  const session = state.access.sessions.find((s) => s.id === sessionId);
  if (
    !audit?.sensor.enabled ||
    !session ||
    targetAssetId !== audit.sensor.sourceAssetId ||
    minute < audit.sensor.coverageFromMinute ||
    !isSessionActive(session, currentMinute(state.clock)) ||
    !networkAllows(state.world, state.access, {
      sourceAssetId: session.gatewayAssetId,
      targetAssetId,
      protocol: 'SMB',
      accountId: session.accountId,
    })
  )
    return { state, allowed };
  const event: FileAccessEvent = {
    id: `FILE-${String(audit.sourceEvents.length + 1).padStart(4, '0')}`,
    minute,
    accountId: session.accountId,
    sessionId,
    targetAssetId,
    operation,
    outcome: allowed ? 'allowed' : 'denied',
    recordsRead: allowed && operation === 'read' ? volume : null,
  };
  return {
    allowed,
    state: {
      ...state,
      telemetry: {
        ...state.telemetry,
        fileAudit: { ...audit, sourceEvents: [...audit.sourceEvents, event] },
      },
    },
  };
}

/** Jedna modelowana próba dokumentów na część biznesu w rozliczanym przedziale. */
export function recordLegalFileActivity(
  state: SimulationState,
): SimulationState {
  if (state.branch) return state;
  if (state.integrity)
    return resolveLocalFileOperation(
      state,
      state.integrity.endpoint.id,
      'read',
      state.integrity.documents
        .filter((d) => d.status === 'correct')
        .slice(0, 2)
        .map((d) => d.id),
      currentMinute(state.clock) + state.clock.turnMinutes,
    ).state;
  if (!state.telemetry.fileAudit) return state;
  let next = state;
  for (const work of state.process.additionalWork ?? []) {
    if (state.vendor && work.id === 'cargo-link-integration') continue;
    for (const service of work.services.filter((s) => s.protocol === 'SMB')) {
      const session = state.access.sessions.find(
        (s) =>
          s.accountId === work.accountId &&
          isSessionActive(s, currentMinute(state.clock)),
      );
      if (session)
        next = attemptFileAccess(
          next,
          session.id,
          service.targetAssetId,
          'read',
          work.capacity,
          currentMinute(state.clock) + state.clock.turnMinutes,
        ).state;
    }
  }
  return next;
}
export function collectFileTelemetry(state: SimulationState): TelemetryState {
  const audit = state.telemetry.fileAudit;
  if (!audit) return state.telemetry;
  const minute = currentMinute(state.clock);
  const { sensor } = audit;
  const records = audit.records.filter(
    (r) => r.minute >= minute - sensor.retentionMinutes,
  );
  if (sensor.enabled && isAssetOnline(state.world, sensor.sourceAssetId)) {
    for (const event of audit.sourceEvents.slice(audit.processedSourceCount)) {
      if (
        event.targetAssetId === sensor.sourceAssetId &&
        event.minute >=
          Math.max(
            sensor.coverageFromMinute,
            minute - sensor.retentionMinutes,
          ) &&
        event.minute <= minute
      )
        records.push({
          ...event,
          sensorId: sensor.id,
          capturedAtMinute: minute,
          availableAtMinute: minute + sensor.delayMinutes,
        });
    }
  }
  return {
    ...state.telemetry,
    fileAudit: {
      ...audit,
      records,
      processedSourceCount: audit.sourceEvents.length,
    },
  };
}
export function readFileAccess(
  state: SimulationState,
  id: string,
): FileAccessObservation | null {
  const audit = state.telemetry.fileAudit;
  if (
    !audit?.sensor.enabled ||
    !isAssetOnline(state.world, audit.sensor.sourceAssetId)
  )
    return null;
  const minute = currentMinute(state.clock);
  return {
    id,
    observedAtMinute: minute,
    sensorId: audit.sensor.id,
    sourceAssetId: audit.sensor.sourceAssetId,
    windowStartMinute: Math.max(
      audit.sensor.coverageFromMinute,
      minute - audit.sensor.retentionMinutes,
    ),
    windowEndMinute: minute - audit.sensor.delayMinutes,
    records: audit.records
      .filter(
        (r) =>
          r.availableAtMinute <= minute &&
          r.minute >= minute - audit.sensor.retentionMinutes,
      )
      .map((r) => ({ ...r })),
  };
}
