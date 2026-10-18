import type {
  SimulationState,
  ProcessAvailability,
} from '../domain/simulation';
import { assessErpAvailability, manualEligible } from './recoveryAccess';
import { branchWorkAvailability } from './branchAccess';
import {
  canUseLocalService,
  canUseService,
  networkAllows,
  isAssetOnline,
} from './access';
import { currentMinute } from './clock';
/** M06 uses the existing settlement once. Four bounded contributions share the ERP and FS predicates. */
export function finaleBusinessAvailability(
  s: SimulationState,
): ProcessAvailability {
  const erp = assessErpAvailability(s),
    r = s.recovery!,
    i = s.integrity!;
  const functional =
    erp.host &&
    erp.processRunning &&
    erp.database &&
    erp.storage &&
    erp.databasePath &&
    erp.consistent;
  const coverage =
    (s.hidden.scenario.recovery!.records.length - erp.missingRecordIds.length) /
    s.hidden.scenario.recovery!.records.length;
  const correct =
    i.documents.filter((d) => d.status === 'correct').length /
    i.documents.length;
  const documentPath =
    isAssetOnline(s.world, 'fs-01') &&
    networkAllows(s.world, s.access, {
      sourceAssetId: 'workstations',
      targetAssetId: 'fs-01',
      protocol: 'SMB',
      accountId: 'warehouse-team',
    }) &&
    s.access.permissions.some(
      (p) =>
        p.accountId === 'warehouse-team' &&
        p.targetAssetId === 'fs-01' &&
        p.protocol === 'SMB',
    );
  const packing =
    canUseLocalService(s.world, s.access, i.endpoint, 'fs-01', 'SMB', 'read') &&
    canUseLocalService(
      s.world,
      s.access,
      i.endpoint,
      erp.target,
      'HTTPS',
      'read',
    );
  const localErp =
    functional && erp.localPath
      ? Math.floor(
          ((packing ? 4 : 2) + (documentPath ? 4 * correct : 0)) * coverage,
        )
      : 0;
  // Prepared manifests are a bounded substitute for local ERP work, never an extra fifth contribution.
  const local = r.manualActive
    ? Math.min(8, manualEligible(s).length)
    : localErp;
  const remote = functional && erp.remotePath ? Math.floor(8 * coverage) : 0;
  const east = branchWorkAvailability(s).capacity;
  const cargoSession = s.access.sessions.find(
    (x) =>
      x.accountId === 'cargo-link-operator' &&
      s.hidden.sessionOrigins[x.id] === 'legitimate' &&
      canUseService(
        s.world,
        s.access,
        x.id,
        'carrier-api',
        'HTTPS',
        currentMinute(s.clock),
      ),
  );
  const cargoPath =
    cargoSession &&
    networkAllows(s.world, s.access, {
      sourceAssetId: 'carrier-api',
      targetAssetId: erp.target,
      protocol: 'HTTPS',
      accountId: cargoSession.accountId,
    }) &&
    s.access.permissions.some(
      (p) =>
        p.accountId === cargoSession.accountId &&
        p.targetAssetId === erp.target &&
        p.protocol === 'HTTPS',
    );
  const cargo =
    functional &&
    cargoPath &&
    (!s.hidden.scenario.vendor!.requiresFiles ||
      canUseService(
        s.world,
        s.access,
        cargoSession!.id,
        'fs-01',
        'SMB',
        currentMinute(s.clock),
      ))
      ? Math.floor(3 * coverage)
      : 0;
  const contributions = [
    {
      id: r.manualActive ? 'manual-shipping' : 'hq-local',
      name: r.manualActive
        ? 'Centrala — manifesty zamiast ERP (do 8)'
        : 'Centrala lokalna (do 8)',
      capacity: local,
      available: local > 0,
    },
    {
      id: 'remote-dispatch',
      name: 'Zdalni dyspozytorzy (do 8)',
      capacity: remote,
      available: remote > 0,
    },
    {
      id: 'east-branch',
      name: 'NEXUS EAST (do 3)',
      capacity: east,
      available: east > 0,
    },
    {
      id: 'cargo-link-integration',
      name: 'CARGO-LINK (do 3)',
      capacity: cargo,
      available: cargo > 0,
    },
  ];
  const capacity = contributions.reduce((n, x) => n + x.capacity, 0);
  return {
    capacity,
    localAvailable: local > 0,
    remoteAvailable: remote > 0,
    status:
      capacity === 22
        ? 'available'
        : capacity === 0
          ? 'unavailable'
          : 'degraded',
    contributions,
  };
}
