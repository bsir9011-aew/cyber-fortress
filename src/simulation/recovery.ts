import type {
  RecoveryObservation,
  RecoveryTaskAction,
  RecoveryTaskResult,
  RecoveryState,
} from '../domain/recovery';
import type {
  BusinessState,
  CommandRejection,
  EmployeeTask,
  SimulationState,
  TaskAction,
} from '../domain/simulation';
import { isAssetOnline, networkAllows } from './access';
import { currentMinute } from './clock';
import {
  assessErpAvailability,
  pendingErpOrderIds,
  manualEligible,
  recoveryBusinessAvailability,
} from './recoveryAccess';
export const recoveryTaskSpecs = {
  'inspect-erp-service': { workerId: 'analyst', turns: 1 },
  'inspect-erp-database': { workerId: 'analyst', turns: 2 },
  'inspect-erp-backups': { workerId: 'analyst', turns: 1 },
  'contact-warehouse-operations': { workerId: 'analyst', turns: 1 },
  'verify-erp-backup': { workerId: 'analyst', turns: 2 },
  'inspect-erp-consistency': { workerId: 'analyst', turns: 2 },
  'reconcile-erp-records': { workerId: 'analyst', turns: 2 },
  'restart-erp-service': { workerId: 'administrator', turns: 2 },
  'restore-erp-backup': { workerId: 'administrator', turns: 2 },
  'switch-erp-standby': { workerId: 'administrator', turns: 3 },
  'start-manual-shipping': { workerId: 'administrator', turns: 1 },
  'close-manual-shipping': { workerId: 'administrator', turns: 1 },
} as const;
export const isRecoveryAction = (a: TaskAction): a is RecoveryTaskAction =>
  Object.hasOwn(recoveryTaskSpecs, a.type);
export function recoveryTaskTurns(
  state: SimulationState,
  a: TaskAction,
): number | null {
  return a.type === 'restore-erp-backup'
    ? (state.hidden.scenario.recovery?.backups.find((b) => b.id === a.backupId)
        ?.restoreTurns ?? null)
    : null;
}
function backupAvailable(state: SimulationState, id: string) {
  const b = state.hidden.scenario.recovery?.backups.find((b) => b.id === id);
  return (
    !!b &&
    isAssetOnline(state.world, b.repositoryAssetId) &&
    isAssetOnline(state.world, b.storageAssetId) &&
    networkAllows(state.world, state.access, {
      sourceAssetId: b.repositoryAssetId,
      targetAssetId: b.storageAssetId,
      protocol: 'BLOCK',
    }) &&
    networkAllows(state.world, state.access, {
      sourceAssetId: 'workstations',
      targetAssetId: b.repositoryAssetId,
      protocol: 'HTTPS',
    })
  );
}
function sourceAvailable(state: SimulationState) {
  const d = state.hidden.scenario.recovery!;
  return (
    isAssetOnline(state.world, d.reconciliationSource.assetId) &&
    networkAllows(state.world, state.access, {
      sourceAssetId: d.reconciliationSource.assetId,
      targetAssetId: assessErpAvailability(state).target,
      protocol: 'HTTPS',
      accountId: 'erp-warehouse',
    })
  );
}
export function recoveryTaskRejection(
  state: SimulationState,
  a: RecoveryTaskAction,
): CommandRejection | null {
  const r = state.recovery;
  if (!r) return 'invalid-state';
  if ('backupId' in a) {
    if (
      !state.hidden.scenario.recovery?.backups.some((b) => b.id === a.backupId)
    )
      return 'unknown-target';
    const known = r.observations
      .flatMap((o) => o.backups)
      .reverse()
      .find((b) => b.id === a.backupId);
    if (!known) return 'target-not-observed';
    if (!known.available) return 'source-unavailable';
  }
  if (
    (a.type === 'start-manual-shipping' && r.manualActive) ||
    (a.type === 'close-manual-shipping' && !r.manualActive)
  )
    return 'invalid-state';
  const changes = [
    'restore-erp-backup',
    'switch-erp-standby',
    'restart-erp-service',
    'reconcile-erp-records',
  ];
  if (
    changes.includes(a.type) &&
    state.tasks.some(
      (t) => t.status === 'running' && changes.includes(t.action.type),
    )
  )
    return 'invalid-state';
  if (
    a.type === 'reconcile-erp-records' &&
    (r.manualActive || !assessErpAvailability(state).useful)
  )
    return 'invalid-state';
  return null;
}
function put(state: SimulationState, r: RecoveryState): SimulationState {
  return { ...state, recovery: r };
}
export function trackRecoveryAvailability(
  state: SimulationState,
): SimulationState {
  if (!state.recovery) return state;
  const a = assessErpAvailability(state),
    b = recoveryBusinessAvailability(state),
    r = state.recovery;
  const entry = {
    minute: currentMinute(state.clock),
    useful: a.useful,
    instance: r.activeInstance,
    capacity: b.capacity,
    manual: r.manualActive,
  };
  return put(state, {
    ...r,
    availability: [
      ...r.availability.filter((e) => e.minute !== entry.minute),
      entry,
    ],
  });
}
export function initializeRecovery(state: SimulationState): SimulationState {
  const d = state.hidden.scenario.recovery;
  if (!d) return state;
  return trackRecoveryAvailability(
    put(state, {
      activeInstance: 'primary',
      primary: d.primary,
      standby: d.standby,
      manualActive: false,
      orders: [],
      revision: 0,
      verifiedRevision: null,
      observations: [],
      results: [],
      availability: [],
    }),
  );
}
export function recordRecoveryBusiness(
  state: SimulationState,
  business: BusinessState,
): SimulationState {
  const r = state.recovery;
  if (!r) return state;
  const minute = currentMinute(state.clock) + state.clock.turnMinutes;
  const orders = [
    ...r.orders,
    ...Array.from({ length: state.process.ordersPerTurn }, (_, i) => ({
      id: `ORD-${String(r.orders.length + i + 1).padStart(3, '0')}`,
      receivedTurn: state.clock.turn + 1,
      fulfilledBy: null,
      fulfilledAtMinute: null,
    })),
  ];
  const eligible = r.manualActive
    ? manualEligible(state)
    : orders.filter((o) => o.fulfilledBy === null).map((o) => o.id);
  const selected = eligible.slice(0, business.lastReport!.processed);
  const mode = r.manualActive ? ('manual' as const) : ('erp' as const);
  return put(state, {
    ...r,
    orders: orders.map((o) =>
      selected.includes(o.id)
        ? { ...o, fulfilledBy: mode, fulfilledAtMinute: minute }
        : o,
    ),
    [r.activeInstance]: {
      ...r[r.activeInstance],
      postedOrderIds: r.manualActive
        ? r[r.activeInstance].postedOrderIds
        : [...r[r.activeInstance].postedOrderIds, ...selected],
    },
  });
}
export function applyRecoveryTask(
  state: SimulationState,
  task: EmployeeTask,
): SimulationState {
  const a = task.action;
  if (!state.recovery || !isRecoveryAction(a)) return state;
  let r = state.recovery;
  const d = state.hidden.scenario.recovery!,
    minute = currentMinute(state.clock);
  let outcome: RecoveryTaskResult['outcome'] = 'succeeded',
    text = '',
    recordIds: readonly string[] = [],
    orderIds: readonly string[] = [];
  let observation: RecoveryObservation | null = null;
  const statuses = (ids: readonly string[]) =>
    Object.fromEntries(
      ids.map((id) => [
        id,
        isAssetOnline(state.world, id)
          ? ('online' as const)
          : ('offline' as const),
      ]),
    );
  const observe = (
    source: string,
    description: string,
    assetIds: readonly string[] = [],
    backups: RecoveryObservation['backups'] = [],
  ) => {
    observation = {
      id: `DR-${task.id}`,
      taskId: task.id,
      minute,
      source,
      text: description,
      assetStatuses: statuses(assetIds),
      backups,
    };
    text = description;
  };
  const change = () => {
    r = { ...r, revision: r.revision + 1, verifiedRevision: null };
  };
  const failure = (reason: string) => {
    outcome = 'failed';
    text = reason;
  };
  switch (a.type) {
    case 'inspect-erp-service': {
      const p = assessErpAvailability(state);
      observe(
        'ERP service console',
        `Instancja ${p.instance}: host ${p.host ? 'online' : 'offline'}, proces ${p.processRunning ? 'uruchomiony' : 'zatrzymany'}. Test funkcji wysyłkowej: ${p.useful ? 'dostępny' : 'niedostępny'}. Stan procesu nie potwierdza spójności bazy.`,
        ['erp', 'erp-standby'],
      );
      break;
    }
    case 'inspect-erp-database': {
      const p = assessErpAvailability(state);
      observe(
        'ERP DB/storage console',
        `Baza ${p.database ? 'online' : 'offline'}, storage ${p.storage ? 'online' : 'offline'}, ścieżka aplikacja–baza ${p.databasePath ? 'dostępna' : 'niedostępna'}. ${p.databasePath ? `Kontrola integralności: ${p.consistent ? 'poprawna' : `błędy ${p.corruptRecordIds.join(', ')}`}.` : 'Brak dostępu do bazy; nie można ocenić jej spójności.'} Standby ma oddzielny storage i punkt 13:40.`,
        [
          'erp-db',
          'erp-storage',
          'erp-backups',
          'erp-standby',
          'standby-storage',
        ],
      );
      break;
    }
    case 'inspect-erp-backups':
    case 'verify-erp-backup': {
      const copies = d.backups.filter(
        (b) => a.type === 'inspect-erp-backups' || b.id === a.backupId,
      );
      const backups = copies.map((b) => ({
        id: b.id,
        minute: b.minute,
        available: backupAvailable(state, b.id),
        restoreTurns: b.restoreTurns,
        verified: backupAvailable(state, b.id)
          ? a.type === 'verify-erp-backup'
            ? b.corruptRecordIds.length === 0
            : b.previouslyVerified
              ? true
              : null
          : null,
        recordIds: b.recordIds,
      }));
      if (a.type === 'verify-erp-backup' && !backups[0]?.available)
        failure(
          'Kopia niedostępna: repozytorium, storage lub ścieżka odczytu nie działa.',
        );
      else if (a.type === 'verify-erp-backup' && backups[0]?.verified === false)
        failure(
          'Weryfikacja kopii wykazała niespójne zapisy; kopia nie została naprawiona.',
        );
      observe(
        'ERP backup inventory',
        text ||
          'Inwentarz ERP: repozytorium erp-backups współdzieli primary storage; odrębny standby zawiera kopię 13:40. Starsza kopia 13:20 ma wcześniejsze potwierdzenie integralności, nie gwarantuje kompletności.',
        ['erp-backups', 'erp-storage'],
        backups,
      );
      break;
    }
    case 'contact-warehouse-operations':
      observe(
        'Warehouse journal',
        `Lokalny dziennik na ${d.reconciliationSource.assetId} zawiera ${d.reconciliationSource.recordIds.length} zatwierdzonych zapisów: ${d.reconciliationSource.recordIds.join(', ')}. Manifesty ORD-001–ORD-${d.manualManifestLimit} pozwalają wysłać do 10 zamówień na turę. Rejestr wykonanych wysyłek jest niezależny od dysku ERP i musi zostać uzgodniony po zamknięciu trybu ręcznego.`,
        [d.reconciliationSource.assetId],
      );
      break;
    case 'inspect-erp-consistency': {
      const p = assessErpAvailability(state);
      if (
        !p.host ||
        !p.storage ||
        !p.database ||
        !p.databasePath ||
        !sourceAvailable(state)
      ) {
        failure('Kontrola niedostępna: brak dostępu do bazy.');
        observe('ERP consistency check', text);
        break;
      }
      const pending = pendingErpOrderIds(state);
      if (
        p.consistent &&
        p.missingRecordIds.length === 0 &&
        pending.length === 0
      ) {
        r = { ...r, verifiedRevision: r.revision };
        text =
          'Spójność i kompletność potwierdzone względem zatwierdzonego dziennika oraz rejestru wysyłek.';
      } else {
        outcome = 'partial';
        text = `Niespójne: ${p.corruptRecordIds.join(', ') || 'brak'}. Brakujące zapisy: ${p.missingRecordIds.join(', ') || 'brak'}. Nieuzgodnione wysyłki: ${pending.join(', ') || 'brak'}.`;
      }
      observe('ERP consistency check', text);
      break;
    }
    case 'restart-erp-service': {
      const p = assessErpAvailability(state);
      if (!p.host || !p.storage || !p.database || !p.databasePath)
        failure(
          'Restart nie przywrócił funkcji ERP: zależność bazy/storage niedostępna.',
        );
      else {
        r = {
          ...r,
          [r.activeInstance]: { ...r[r.activeInstance], processRunning: true },
        };
        change();
        text = 'Proces ERP uruchomiony; dane nie zostały zmienione.';
        if (!p.consistent)
          failure(
            'Proces działa, ale błędy bazy pozostają. Restart nie przywrócił funkcji ERP.',
          );
      }
      break;
    }
    case 'restore-erp-backup': {
      const b = d.backups.find((b) => b.id === a.backupId),
        p = assessErpAvailability(state);
      if (
        !b ||
        !backupAvailable(state, a.backupId) ||
        !p.host ||
        !p.storage ||
        !p.database ||
        !p.databasePath
      )
        failure(
          'Odtworzenie nie powiodło się: kopia, docelowy storage, baza lub ścieżka niedostępna.',
        );
      else {
        const before = r[r.activeInstance];
        recordIds = before.recordIds.filter((id) => !b.recordIds.includes(id));
        orderIds = before.postedOrderIds;
        r = {
          ...r,
          [r.activeInstance]: {
            processRunning: true,
            recordIds: [...b.recordIds],
            corruptRecordIds: [...b.corruptRecordIds],
            postedOrderIds: [],
            recoveryPointMinute: b.minute,
            backupId: b.id,
          },
        };
        change();
        text = `Odtworzono ${b.id}: ${b.recordIds.length} zapisów. Wycofane zapisy: ${recordIds.join(', ') || 'brak'}; potwierdzenia wysyłek do uzgodnienia: ${orderIds.length}.`;
        if (b.corruptRecordIds.length) {
          outcome = 'partial';
          text +=
            ' Kopia zawiera błędy integralności; funkcja ERP nadal niedostępna.';
        }
      }
      break;
    }
    case 'switch-erp-standby': {
      const targetState = {
          ...state,
          recovery: { ...r, activeInstance: 'standby' as const },
        },
        p = assessErpAvailability(targetState);
      if (!p.host || !p.storage || !p.databasePath)
        failure(
          'Standby niedostępny: host, własny storage lub połączenie nie działa.',
        );
      else {
        r = { ...r, activeInstance: 'standby' };
        change();
        text =
          'Ruch ERP skierowany do erp-standby, z własnym storage i zbiorem 13:40. Primary nie został naprawiony.';
        if (!p.useful) {
          outcome = 'partial';
          text +=
            ' Użytkownicy nadal nie mają użytecznego dostępu: sprawdź trasę, sesje i dane.';
        }
      }
      break;
    }
    case 'start-manual-shipping':
      if (!isAssetOnline(state.world, d.reconciliationSource.assetId))
        failure('Lokalne manifesty niedostępne.');
      else {
        r = { ...r, manualActive: true };
        text =
          'Uruchomiono obsługę ręczną: do 10/turę, tylko przygotowane manifesty; ERP nie obsługuje równolegle tej samej kolejki.';
      }
      break;
    case 'close-manual-shipping':
      r = { ...r, manualActive: false };
      text =
        'Obsługa ręczna zamknięta. Wysyłki pozostają w rejestrze do uzgodnienia; nie zostaną wysłane ponownie.';
      break;
    case 'reconcile-erp-records': {
      const p = assessErpAvailability(state);
      if (r.manualActive || !p.useful || !sourceAvailable(state)) {
        failure(
          'Uzgodnienie wymaga zamknięcia trybu ręcznego, poprawnej dostępnej bazy i niezależnego dziennika magazynu.',
        );
        break;
      }
      recordIds = p.missingRecordIds.filter((id) =>
        d.reconciliationSource.recordIds.includes(id),
      );
      orderIds = pendingErpOrderIds(state);
      const data = r[r.activeInstance];
      r = {
        ...r,
        [r.activeInstance]: {
          ...data,
          recordIds: [...data.recordIds, ...recordIds],
          postedOrderIds: [...data.postedOrderIds, ...orderIds],
        },
      };
      change();
      text = `Uzgodniono ${recordIds.length} rzeczywistych zapisów dziennika i ${orderIds.length} wykonanych wysyłek. Bez ponownego wysyłania zamówień.`;
      if (recordIds.length !== p.missingRecordIds.length) {
        outcome = 'partial';
        text += ' Źródło nie zawiera wszystkich brakujących zapisów.';
      }
      break;
    }
  }
  const result: RecoveryTaskResult = {
    taskId: task.id,
    minute,
    action: a,
    outcome,
    text,
    recordIds,
    orderIds,
  };
  return put(state, {
    ...r,
    results: [...r.results, result],
    observations: observation
      ? [...r.observations, observation]
      : r.observations,
  });
}

/** Research resolves in the existing observation phase, after actors and telemetry. */
export function observeRecoveryTask(
  state: SimulationState,
  task: EmployeeTask,
): SimulationState {
  return isRecoveryAction(task.action) &&
    task.workerId === 'analyst' &&
    task.action.type !== 'reconcile-erp-records'
    ? applyRecoveryTask(state, task)
    : state;
}
