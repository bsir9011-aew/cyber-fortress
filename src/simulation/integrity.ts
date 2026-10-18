import { assessErpAvailability } from './recoveryAccess';
import type {
  IntegrityDefinition,
  IntegrityState,
  IntegrityTaskAction,
  IntegrityThreatState,
  LocalOperation,
  ShippingDocument,
} from '../domain/integrity';
import type {
  CommandRejection,
  EmployeeTask,
  SimulationState,
  TaskAction,
} from '../domain/simulation';
import { canUseLocalService, isAssetOnline, networkAllows } from './access';
import { currentMinute } from './clock';
import { matchingBackupTest, preparedRestoreTurns } from './backupReadiness';
import {
  captureEndpointOperation,
  readEndpointTelemetry,
} from './endpointTelemetry';

export const integrityActionTypes = [
  'inspect-documents',
  'inspect-backups',
  'verify-backup',
  'restore-documents',
  'reconcile-documents',
  'examine-endpoint',
  'isolate-endpoint',
  'restrict-endpoint-writes',
  'reconnect-endpoint',
] as const;
export function isIntegrityAction(
  action: TaskAction,
): action is IntegrityTaskAction {
  return (integrityActionTypes as readonly string[]).includes(action.type);
}
export const documentCounts = (documents: readonly ShippingDocument[]) => ({
  total: documents.length,
  correct: documents.filter((d) => d.status === 'correct').length,
  damaged: documents.filter((d) => d.status === 'damaged').length,
  reconcile: documents.filter((d) => d.status === 'reconcile').length,
  recovered: documents.filter((d) => d.recovered).length,
});
export function validateIntegrityDefinition(d: IntegrityDefinition): boolean {
  const unique = (ids: readonly string[]) =>
    ids.length > 0 &&
    new Set(ids).size === ids.length &&
    ids.every((id) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(id));
  return (
    unique(d.documentIds) &&
    unique(d.backups.map((b) => b.id)) &&
    d.documentIds.length === 100 &&
    (!d.legitimateModifications ||
      (!d.attack.compromised &&
        Number.isSafeInteger(d.legitimateModifications.chunkSize) &&
        d.legitimateModifications.chunkSize > 0 &&
        d.legitimateModifications.chunkSize <= 100 &&
        d.legitimateModifications.turns.every(
          (t, i, turns) =>
            Number.isSafeInteger(t) &&
            t >= 1 &&
            t <= 18 &&
            t > (turns[i - 1] ?? 0),
        ))) &&
    Number.isSafeInteger(d.initialDamage) &&
    d.initialDamage >= 0 &&
    d.initialDamage <= d.documentIds.length &&
    Number.isSafeInteger(d.attack.chunkSize) &&
    d.attack.chunkSize > 0 &&
    d.attack.turns.every(
      (t, i) =>
        Number.isSafeInteger(t) &&
        t >= 1 &&
        t <= 18 &&
        t > (d.attack.turns[i - 1] ?? 0),
    ) &&
    Number.isSafeInteger(d.reconcileTurns) &&
    d.reconcileTurns > 0 &&
    d.backups.every(
      (b) =>
        unique(b.documentIds) &&
        b.documentIds.every((id) => d.documentIds.includes(id)) &&
        b.damagedIds.every((id) => b.documentIds.includes(id)) &&
        Number.isSafeInteger(b.minute) &&
        b.minute >= 0 &&
        b.minute < 840 &&
        Number.isSafeInteger(b.restoreTurns) &&
        b.restoreTurns > 0 &&
        b.restoreTurns <= 18 &&
        !(b.previouslyVerified && b.damagedIds.length > 0),
    )
  );
}

/** Server resolver: route first, operation permission second, then actual data. */
export function resolveLocalFileOperation(
  state: SimulationState,
  endpointId: string,
  operation: LocalOperation,
  ids: readonly string[],
  minute = currentMinute(state.clock),
  effect: 'damage' | 'preserve' = 'damage',
) {
  const integrity = state.integrity;
  if (!integrity || endpointId !== integrity.endpoint.id || ids.length === 0)
    return { state, allowed: false, modifiedIds: [] as readonly string[] };
  const config = state.hidden.scenario.integrity!;
  const endpoint = integrity.endpoint;
  const validScope =
    new Set(ids).size === ids.length &&
    ids.every((id) => integrity.documents.some((d) => d.id === id));
  const allowed =
    validScope &&
    canUseLocalService(
      state.world,
      state.access,
      endpoint,
      config.datasetAssetId,
      'SMB',
      operation,
    );
  const modifiedIds =
    allowed && operation === 'modify' && effect === 'damage'
      ? ids.filter((id) =>
          integrity.documents.some(
            (d) => d.id === id && d.status === 'correct',
          ),
        )
      : [];
  const record = {
    minute,
    endpointId,
    accountId: endpoint.accountId,
    operation,
    documentIds: ids,
    outcome: allowed ? ('allowed' as const) : ('denied' as const),
  };
  const documents = integrity.documents.map((d) =>
    modifiedIds.includes(d.id)
      ? { ...d, status: 'damaged' as const, everDamaged: true }
      : allowed &&
          operation === 'modify' &&
          effect === 'preserve' &&
          ids.includes(d.id)
        ? { ...d, generation: d.generation + 1 }
        : d,
  );
  let next: SimulationState = {
    ...state,
    integrity: {
      ...integrity,
      documents,
      revision:
        integrity.revision +
        (modifiedIds.length ||
        (allowed && operation === 'modify' && effect === 'preserve')
          ? 1
          : 0),
      verifiedRecoveryMinute: modifiedIds.length
        ? null
        : integrity.verifiedRecoveryMinute,
      operationRecords: [...integrity.operationRecords, record],
    },
  };
  const audit = state.telemetry.fileAudit;
  if (next.telemetry.endpoint)
    next = {
      ...next,
      telemetry: {
        ...next.telemetry,
        endpoint: captureEndpointOperation(
          next.telemetry.endpoint,
          state.world,
          endpoint,
          record,
          config.datasetAssetId,
        ),
      },
    };
  const reached =
    !endpoint.isolated &&
    isAssetOnline(state.world, endpoint.assetId) &&
    networkAllows(state.world, state.access, {
      sourceAssetId: endpoint.assetId,
      accountId: endpoint.accountId,
      targetAssetId: config.datasetAssetId,
      protocol: 'SMB',
    });
  if (
    audit?.sensor.enabled &&
    reached &&
    validScope &&
    audit.sensor.sourceAssetId === config.datasetAssetId &&
    minute >= audit.sensor.coverageFromMinute
  ) {
    next = {
      ...next,
      telemetry: {
        ...next.telemetry,
        fileAudit: {
          ...audit,
          sourceEvents: [
            ...audit.sourceEvents,
            {
              id: `FILE-${String(audit.sourceEvents.length + 1).padStart(4, '0')}`,
              minute,
              accountId: endpoint.accountId,
              sessionId: null,
              endpointId,
              targetAssetId: config.datasetAssetId,
              operation,
              outcome: record.outcome,
              recordsRead: allowed && operation === 'read' ? ids.length : null,
              documentIds: record.documentIds,
            },
          ],
        },
      },
    };
  }
  return { state: next, allowed, modifiedIds };
}

export function initializeIntegrity(state: SimulationState): SimulationState {
  const d = state.hidden.scenario.integrity;
  if (!d) return state;
  const integrity: IntegrityState = {
    endpoint: d.endpoint,
    documents: d.documentIds.map((id) => ({
      id,
      status: 'correct',
      generation: 0,
      everDamaged: false,
      recovered: false,
    })),
    revision: 0,
    backups: d.backups.map((b) => ({
      id: b.id,
      verification: matchingBackupTest(b, state.hidden.scenario.backupReadiness)
        ? state.hidden.scenario.backupReadiness!.integrity === 'damaged'
          ? 'damaged'
          : 'clean'
        : b.previouslyVerified
          ? 'clean'
          : 'unknown',
      verifiedAtMinute: b.previouslyVerified ? b.minute : null,
    })),
    backupInventoryMinute: null,
    observations: [],
    endpointObservations: [],
    operationRecords: [],
    recoveries: [],
    recoveryStartedMinute: null,
    verifiedRecoveryMinute: null,
    reconciledIds: [],
    decisions: [],
    hypothesis: 'insufficient-evidence',
  };
  const next: SimulationState = {
    ...state,
    integrity,
    hidden: {
      ...state.hidden,
      integrityThreat: {
        compromised: d.attack.compromised,
        nextIndex: 0,
        history: [],
      },
    },
  };
  return d.attack.compromised
    ? resolveLocalFileOperation(
        next,
        d.endpoint.id,
        'modify',
        d.documentIds.slice(0, d.initialDamage),
        state.clock.startMinute - 5,
      ).state
    : next;
}

/** Planner sees its own deterministic timetable, never the defender world. */
export function selectLocalThreatAction(
  threat: IntegrityThreatState,
  plan: IntegrityDefinition['attack'],
  turn: number,
): { readonly count: number } | null {
  return threat.compromised &&
    (plan.turns[threat.nextIndex] ?? Infinity) <= turn
    ? { count: plan.chunkSize }
    : null;
}
export function stepIntegrityThreat(state: SimulationState): SimulationState {
  const threat = state.hidden.integrityThreat;
  const d = state.hidden.scenario.integrity;
  if (!threat || !d || !state.integrity) return state;
  const legal = d.legitimateModifications;
  if (legal?.turns.includes(state.clock.turn)) {
    const index = legal.turns.indexOf(state.clock.turn);
    const offset = (index * legal.chunkSize) % d.documentIds.length;
    const ids = d.documentIds.slice(offset, offset + legal.chunkSize);
    return resolveLocalFileOperation(
      state,
      d.endpoint.id,
      'modify',
      ids,
      currentMinute(state.clock),
      'preserve',
    ).state;
  }
  const action = selectLocalThreatAction(threat, d.attack, state.clock.turn);
  if (!action) return state;
  // A repaired generation becomes eligible again; already damaged IDs are skipped.
  const ids = state.integrity.documents
    .filter((doc) => doc.status === 'correct')
    .slice(0, action.count)
    .map((doc) => doc.id);
  const resolved = ids.length
    ? resolveLocalFileOperation(state, d.endpoint.id, 'modify', ids)
    : {
        state,
        modifiedIds: [] as readonly string[],
        allowed: canUseLocalService(
          state.world,
          state.access,
          state.integrity.endpoint,
          d.datasetAssetId,
          'SMB',
          'modify',
        ),
      };
  return {
    ...resolved.state,
    hidden: {
      ...resolved.state.hidden,
      integrityThreat: {
        ...threat,
        nextIndex: threat.nextIndex + 1,
        history: [
          ...threat.history,
          {
            turn: state.clock.turn,
            outcome: !resolved.allowed
              ? 'access-denied'
              : resolved.modifiedIds.length
                ? 'modified'
                : 'no-new-documents',
            documentIds: resolved.modifiedIds,
          },
        ],
      },
    },
  };
}

export function integrityTaskTurns(
  state: SimulationState,
  action: TaskAction,
): number | undefined {
  if (action.type === 'restore-documents') {
    const backup = state.hidden.scenario.integrity?.backups.find(
      (b) => b.id === action.backupId,
    );
    return backup
      ? preparedRestoreTurns(backup, state.hidden.scenario.backupReadiness)
      : undefined;
  }
  if (action.type === 'reconcile-documents')
    return state.hidden.scenario.integrity?.reconcileTurns;
  return undefined;
}
/** In the finale FS comparison/reconstruction queries the real, complete active ERP through the local analyst path. */
function erpDocumentSourceAvailable(state: SimulationState) {
  if (!state.finale) return true;
  const a = assessErpAvailability(state);
  return a.localAvailable && a.missingRecordIds.length === 0;
}
export function integrityTaskRejection(
  state: SimulationState,
  action: IntegrityTaskAction,
): CommandRejection | null {
  const i = state.integrity;
  const d = state.hidden.scenario.integrity;
  if (!i || !d) return 'unknown-target';
  if (
    state.finale &&
    ['inspect-documents', 'reconcile-documents'].includes(action.type) &&
    !erpDocumentSourceAvailable(state)
  )
    return 'source-unavailable';
  if ('endpointId' in action) {
    if (action.endpointId !== i.endpoint.id) return 'unknown-target';
    if (action.type === 'isolate-endpoint' && i.endpoint.isolated)
      return 'invalid-state';
    if (
      action.type === 'restrict-endpoint-writes' &&
      (!i.endpoint.isolated ||
        i.endpoint.writesRestricted ||
        (!i.endpointObservations.some(
          (o) => o.endpointId === action.endpointId,
        ) &&
          !state.telemetry.endpoint?.observations.some((o) =>
            o.records.some((r) => r.endpointId === action.endpointId),
          )))
    )
      return 'invalid-state';
    if (
      action.type === 'reconnect-endpoint' &&
      (!i.endpoint.isolated || !i.endpoint.writesRestricted)
    )
      return 'invalid-state';
    return null;
  }
  if ('backupId' in action) {
    const backup = d.backups.find((b) => b.id === action.backupId);
    if (!backup) return 'unknown-target';
    if (i.backupInventoryMinute === null) return 'target-not-observed';
    if (!backup.available) return 'source-unavailable';
    if (
      action.type === 'restore-documents' &&
      i.backups.find((b) => b.id === action.backupId)?.verification !== 'clean'
    )
      return 'invalid-state';
  }
  if (
    ['inspect-documents', 'restore-documents', 'reconcile-documents'].includes(
      action.type,
    ) &&
    (!isAssetOnline(state.world, d.datasetAssetId) ||
      (!state.finale && !isAssetOnline(state.world, state.process.erpAssetId)))
  )
    return 'source-unavailable';
  if (
    action.type === 'reconcile-documents' &&
    !i.documents.some((doc) => doc.status === 'reconcile')
  )
    return 'invalid-state';
  if (
    action.type === 'reconcile-documents' &&
    state.tasks.some(
      (t) => t.action.type === 'restore-documents' && t.status === 'running',
    )
  )
    return 'invalid-state';
  if (
    action.type === 'restore-documents' &&
    state.tasks.some(
      (t) => t.action.type === 'reconcile-documents' && t.status === 'running',
    )
  )
    return 'invalid-state';
  return null;
}

export function applyIntegrityTask(
  state: SimulationState,
  task: EmployeeTask,
): SimulationState {
  const i = state.integrity;
  const d = state.hidden.scenario.integrity;
  if (!i || !d) return state;
  const action = task.action;
  if (
    state.finale &&
    action.type === 'reconcile-documents' &&
    !erpDocumentSourceAvailable(state)
  )
    return state;
  if (
    action.type === 'isolate-endpoint' ||
    action.type === 'restrict-endpoint-writes' ||
    action.type === 'reconnect-endpoint'
  )
    return {
      ...state,
      integrity: {
        ...i,
        endpoint: {
          ...i.endpoint,
          ...(action.type === 'restrict-endpoint-writes'
            ? { writesRestricted: true }
            : { isolated: action.type === 'isolate-endpoint' }),
        },
      },
    };
  if (action.type === 'restore-documents') {
    const backup = d.backups.find((b) => b.id === action.backupId)!;
    // Recheck physical prerequisites at completion; a failed job does not conjure data.
    if (
      !backup.available ||
      !isAssetOnline(state.world, d.datasetAssetId) ||
      i.backups.find((b) => b.id === backup.id)?.verification !== 'clean'
    )
      return state;
    const documents = i.documents.map((doc) => ({
      ...doc,
      status: !backup.documentIds.includes(doc.id)
        ? ('reconcile' as const)
        : backup.damagedIds.includes(doc.id)
          ? ('damaged' as const)
          : ('correct' as const),
      generation: doc.generation + 1,
      recovered:
        doc.recovered ||
        (doc.status === 'damaged' &&
          backup.documentIds.includes(doc.id) &&
          !backup.damagedIds.includes(doc.id)),
    }));
    return {
      ...state,
      integrity: {
        ...i,
        documents,
        revision: i.revision + 1,
        verifiedRecoveryMinute: null,
        recoveries: [
          ...i.recoveries,
          {
            backupId: backup.id,
            orderedAtMinute:
              state.clock.startMinute +
              task.startTurn * state.clock.turnMinutes,
            completedAtMinute: currentMinute(state.clock),
            missingDocuments: d.documentIds.length - backup.documentIds.length,
          },
        ],
      },
    };
  }
  if (action.type === 'reconcile-documents') {
    if (
      (!state.finale &&
        !isAssetOnline(state.world, state.process.erpAssetId)) ||
      !isAssetOnline(state.world, d.datasetAssetId)
    )
      return state;
    return {
      ...state,
      integrity: {
        ...i,
        reconciledIds: [
          ...new Set([
            ...i.reconciledIds,
            ...i.documents
              .filter((doc) => doc.status === 'reconcile')
              .map((doc) => doc.id),
          ]),
        ],
        revision: i.revision + 1,
        verifiedRecoveryMinute: null,
        documents: i.documents.map((doc) =>
          doc.status === 'reconcile'
            ? {
                ...doc,
                status: 'correct',
                generation: doc.generation + 1,
                recovered: doc.recovered || doc.everDamaged,
              }
            : doc,
        ),
      },
    };
  }
  return state;
}

export function observeIntegrityTask(
  state: SimulationState,
  task: EmployeeTask,
): SimulationState {
  const i = state.integrity;
  const d = state.hidden.scenario.integrity;
  if (!i || !d) return state;
  const minute = currentMinute(state.clock);
  const action = task.action;
  let next = i;
  if (
    action.type === 'inspect-documents' &&
    erpDocumentSourceAvailable(state) &&
    isAssetOnline(state.world, d.datasetAssetId) &&
    (state.finale || isAssetOnline(state.world, state.process.erpAssetId))
  ) {
    const counts = documentCounts(i.documents);
    next = {
      ...i,
      observations: [
        ...i.observations,
        {
          id: task.id,
          minute,
          revision: i.revision,
          scope: d.documentIds,
          correct: counts.correct,
          damaged: counts.damaged,
          reconcile: counts.reconcile,
        },
      ],
      verifiedRecoveryMinute:
        counts.correct === counts.total
          ? (i.verifiedRecoveryMinute ?? minute)
          : null,
    };
  }
  if (action.type === 'inspect-backups')
    next = { ...i, backupInventoryMinute: minute };
  if (action.type === 'verify-backup') {
    const backup = d.backups.find((b) => b.id === action.backupId)!;
    if (backup.available)
      next = {
        ...i,
        backups: i.backups.map((b) =>
          b.id === backup.id
            ? {
                ...b,
                verification: backup.damagedIds.length ? 'damaged' : 'clean',
                verifiedAtMinute: minute,
              }
            : b,
        ),
      };
  }
  if (action.type === 'examine-endpoint')
    next = {
      ...i,
      endpointObservations: [
        ...i.endpointObservations,
        {
          id: task.id,
          endpointId: i.endpoint.id,
          minute,
          isolated: i.endpoint.isolated,
          writesRestricted: i.endpoint.writesRestricted,
          records: i.operationRecords.map((r) => ({ ...r })),
        },
      ],
    };
  const counts = documentCounts(next.documents);
  next = {
    ...next,
    decisions: next.decisions.map((decision) =>
      decision.taskId !== task.id
        ? decision
        : {
            ...decision,
            completedAtMinute: minute,
            effect: `Stan po granicy tury: ${counts.correct} poprawnych; ${counts.damaged} uszkodzonych; ${counts.reconcile} do uzgodnienia; izolacja: ${next.endpoint.isolated ? 'tak' : 'nie'}; zapis ograniczony: ${next.endpoint.writesRestricted ? 'tak' : 'nie'}.`,
          },
    ),
  };
  const observation =
    action.type === 'inspect-edr-telemetry'
      ? readEndpointTelemetry(state, task.id)
      : null;
  return {
    ...state,
    integrity: next,
    ...(observation && state.telemetry.endpoint
      ? {
          telemetry: {
            ...state.telemetry,
            endpoint: {
              ...state.telemetry.endpoint,
              observations: [
                ...state.telemetry.endpoint.observations,
                observation,
              ],
            },
          },
        }
      : {}),
  };
}
export function rememberIntegrityDecision(
  state: SimulationState,
  task: EmployeeTask,
): SimulationState {
  const i = state.integrity;
  if (!i) return state;
  return {
    ...state,
    integrity: {
      ...i,
      recoveryStartedMinute:
        task.action.type === 'restore-documents'
          ? (i.recoveryStartedMinute ?? currentMinute(state.clock))
          : i.recoveryStartedMinute,
      decisions: [
        ...i.decisions,
        {
          taskId: task.id,
          orderedAtMinute: currentMinute(state.clock),
          knownObservationIds: [
            ...i.observations.map((o) => o.id),
            ...i.endpointObservations.map((o) => o.id),
            ...(state.telemetry.endpoint?.observations ?? []).map((o) => o.id),
            ...(state.knowledge.fileObservations ?? []).map((o) => o.id),
          ],
          backupInventoryMinute: i.backupInventoryMinute,
          assumption: i.hypothesis,
          completedAtMinute: null,
          effect: null,
        },
      ],
    },
  };
}
