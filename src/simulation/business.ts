import { vendorWorkAvailable } from './vendor';
import type {
  BusinessState,
  ProcessAvailability,
  SimulationState,
} from '../domain/simulation';
import {
  canUseService,
  networkAllows,
  canUseLocalService,
  isAssetOnline,
} from './access';
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
    available:
      state.vendor && work.id === 'cargo-link-integration'
        ? vendorWorkAvailable(state)
        : access.sessions.some(
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
  if (state.integrity) {
    const i = state.integrity;
    const fs = state.hidden.scenario.integrity!.datasetAssetId;
    const packing =
      canUseLocalService(world, access, i.endpoint, fs, 'SMB', 'read') &&
      canUseLocalService(
        world,
        access,
        i.endpoint,
        process.erpAssetId,
        process.protocol,
        'read',
      );
    const correct = i.documents.filter((d) => d.status === 'correct').length;
    const reader = state.hidden.scenario.integrity!.businessReadAccountId;
    const documentPath =
      isAssetOnline(world, fs) &&
      networkAllows(world, access, {
        sourceAssetId: process.workstationAssetId,
        targetAssetId: fs,
        protocol: 'SMB',
        accountId: reader,
      }) &&
      access.permissions.some(
        (p) =>
          p.accountId === reader &&
          p.targetAssetId === fs &&
          p.protocol === 'SMB',
      );
    const documentCapacity =
      remoteAvailable && documentPath
        ? Math.floor((process.remoteCapacity * correct) / i.documents.length)
        : 0;
    const capacity =
      (localAvailable
        ? process.localCapacity - (packing ? 0 : i.endpoint.businessCapacity)
        : 0) + documentCapacity;
    return {
      localAvailable,
      remoteAvailable,
      capacity,
      status:
        capacity === 0
          ? 'unavailable'
          : capacity === process.localCapacity + process.remoteCapacity
            ? 'available'
            : 'degraded',
      contributions: [
        {
          id: 'packing-station',
          name: 'pakowanie-03 — legalna praca lokalna',
          available: packing && localAvailable,
          capacity: i.endpoint.businessCapacity,
        },
        {
          id: 'correct-documents',
          name: 'Poprawne dokumenty FS-01 — lokalna droga',
          available: documentPath && correct === i.documents.length,
          capacity: process.remoteCapacity,
        },
      ],
    };
  }
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
