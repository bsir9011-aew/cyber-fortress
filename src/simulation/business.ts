import type {
  BusinessState,
  ProcessAvailability,
  SimulationState,
} from '../domain/simulation';
import { canUseService, networkAllows } from './access';
import { currentMinute } from './clock';

export function isBusinessGoalMet(state: SimulationState): boolean {
  return state.business.backlog <= state.process.maxFinalBacklog;
}

export function businessAvailability(
  state: SimulationState,
): ProcessAvailability {
  const { world, access, process } = state;
  const localAvailable = networkAllows(world, access, {
    sourceAssetId: process.workstationAssetId,
    targetAssetId: process.erpAssetId,
    protocol: process.protocol,
  });
  const remoteAvailable = access.sessions.some(
    (session) =>
      session.accountId === process.remoteAccountId &&
      canUseService(
        world,
        access,
        session.id,
        process.erpAssetId,
        process.protocol,
        currentMinute(state.clock),
      ),
  );
  const contributions = (process.additionalWork ?? []).map((work) => ({
    id: work.id,
    name: work.name,
    capacity: work.capacity,
    available: access.sessions.some(
      (session) =>
        session.accountId === work.accountId &&
        work.services.every((service) =>
          canUseService(
            world,
            access,
            session.id,
            service.targetAssetId,
            service.protocol,
            currentMinute(state.clock),
          ),
        ),
    ),
  }));
  const capacity =
    (localAvailable ? process.localCapacity : 0) +
    (remoteAvailable ? process.remoteCapacity : 0) +
    contributions.reduce(
      (total, item) => total + (item.available ? item.capacity : 0),
      0,
    );
  return {
    localAvailable,
    remoteAvailable,
    capacity,
    status:
      capacity === 0
        ? 'unavailable'
        : localAvailable &&
            remoteAvailable &&
            contributions.every((item) => item.available)
          ? 'available'
          : 'degraded',
    ...(contributions.length ? { contributions } : {}),
  };
}

export function settleBusiness(state: SimulationState): BusinessState {
  const availability = businessAvailability(state);
  const received = state.process.ordersPerTurn;
  const availableOrders = state.business.backlog + received;
  const processed = Math.min(availableOrders, availability.capacity);
  const backlog = availableOrders - processed;
  return {
    totalReceived: state.business.totalReceived + received,
    totalProcessed: state.business.totalProcessed + processed,
    backlog,
    lastReport: {
      turn: state.clock.turn + 1,
      received,
      processed,
      backlog,
      ...availability,
    },
  };
}
