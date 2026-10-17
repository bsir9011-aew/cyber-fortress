import type { SimulationState } from '../domain/simulation';
import {
  assessErpAvailability,
  pendingErpOrderIds,
} from '../simulation/recoveryAccess';
import { currentMinute, isFinished } from '../simulation/clock';
export function recoveryOutcome(state: SimulationState) {
  const r = state.recovery!,
    d = state.hidden.scenario.recovery!,
    a = assessErpAvailability(state);
  const pendingOrderIds = pendingErpOrderIds(state),
    first = r.availability.find((t) => t.useful),
    lastLoss = [...r.availability]
      .reverse()
      .find((t) => !t.useful || t.instance !== r.activeInstance);
  const currentUsefulSince = a.useful
    ? (r.availability.find(
        (t) => t.useful && t.minute > (lastLoss?.minute ?? -1),
      )?.minute ?? null)
    : null;
  const confidence =
    r.verifiedRevision === r.revision &&
    a.consistent &&
    a.missingRecordIds.length === 0 &&
    pendingOrderIds.length === 0;
  const dataMet =
    a.consistent &&
    a.missingRecordIds.length === 0 &&
    pendingOrderIds.length === 0;
  return {
    useful: a.useful,
    missingRecordIds: a.missingRecordIds,
    pendingOrderIds,
    goalMet:
      a.useful &&
      dataMet &&
      confidence &&
      !r.manualActive &&
      state.business.backlog <= state.process.maxFinalBacklog &&
      currentUsefulSince !== null &&
      currentUsefulSince <= state.clock.startMinute + 90,
    serviceRecovery: {
      ...a,
      firstUsefulMinute: first?.minute ?? null,
      currentUsefulSince,
      rtoTargetMinutes: d.rtoMinutes,
      actualRtoMinutes: first ? first.minute - state.clock.startMinute : null,
      rtoMet: !!first && first.minute - state.clock.startMinute <= d.rtoMinutes,
      downtimeMinutes:
        r.availability.filter(
          (t) => !t.useful && t.minute < currentMinute(state.clock),
        ).length * state.clock.turnMinutes,
    },
    dataRecovery: {
      consistent: a.consistent,
      recoveryPointMinute: a.recoveryPointMinute,
      backupId: a.backupId,
      rpoTargetMinutes: d.rpoMinutes,
      actualRpoMinutes:
        a.recoveryPointMinute === null
          ? 0
          : state.clock.startMinute - a.recoveryPointMinute,
      rpoMet:
        a.recoveryPointMinute === null ||
        state.clock.startMinute - a.recoveryPointMinute <= d.rpoMinutes,
      missingRecordIds: a.missingRecordIds,
      corruptRecordIds: a.corruptRecordIds,
      records: d.records,
      currentRecordIds: r[r.activeInstance].recordIds,
      restoredSnapshotRecordIds:
        d.backups.find((b) => b.id === a.backupId)?.recordIds ??
        (a.backupId === d.standby.backupId ? d.standby.recordIds : []),
      pendingOrderIds,
      reconciledRecordIds: [
        ...new Set(
          r.results.flatMap((t) =>
            t.action.type === 'reconcile-erp-records' ? t.recordIds : [],
          ),
        ),
      ],
      reconciledOrderIds: [
        ...new Set(
          r.results.flatMap((t) =>
            t.action.type === 'reconcile-erp-records' ? t.orderIds : [],
          ),
        ),
      ],
      met: dataMet,
    },
    businessContinuity: {
      received: state.business.totalReceived,
      processed: state.business.totalProcessed,
      backlog: state.business.backlog,
      backlogLimit: state.process.maxFinalBacklog,
      manualProcessed: r.orders.filter((o) => o.fulfilledBy === 'manual')
        .length,
      manualActive: r.manualActive,
      manualMinutes:
        r.availability.filter(
          (t) => t.manual && t.minute < currentMinute(state.clock),
        ).length * state.clock.turnMinutes,
      unreconciledOrders: pendingOrderIds.length,
      orders: r.orders,
    },
    operationalConfidence: {
      verified: confidence,
      revision: r.revision,
      verifiedRevision: r.verifiedRevision,
      evidence: r.observations,
    },
  };
}
/** Private cause and complete history are revealed only after the deadline. */
export function selectRecoveryReport(state: SimulationState) {
  if (!state.recovery || !isFinished(state.clock)) return null;
  return {
    ...recoveryOutcome(state),
    cause: state.hidden.scenario.recovery!.cause,
    explanation: state.hidden.scenario.explanation,
    tasks: state.recovery.results,
    availability: state.recovery.availability,
  };
}
export type RecoveryReport = NonNullable<
  ReturnType<typeof selectRecoveryReport>
>;
