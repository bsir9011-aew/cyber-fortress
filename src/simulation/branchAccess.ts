import { assessErpAvailability } from './recoveryAccess';
import type { BranchAccessChecks, BranchRoute } from '../domain/branch';
import type { SimulationState } from '../domain/simulation';
import { isAssetOnline, networkAllows, selectNetworkRule } from './access';
export const branchContextDefinitions = [
  { id: 'EAST-OP', accountId: 'east-operator' },
  { id: 'EAST-DOC', accountId: 'east-documents' },
] as const;
function routeLegs(route: BranchRoute, target: string, protocol: string) {
  if (route === 'backup')
    return (target === 'erp' || target === 'erp-standby') &&
      protocol === 'HTTPS'
      ? [
          ['east-workstations', 'east-backup-gateway', 'HTTPS'],
          ['east-backup-gateway', target, 'HTTPS'],
        ]
      : [];
  if (
    !(
      ((target === 'erp' || target === 'erp-standby') &&
        protocol === 'HTTPS') ||
      (target === 'fs-01' && protocol === 'SMB')
    )
  )
    return [];
  return [
    ['east-workstations', 'east-gateway', protocol],
    ['east-gateway', 'east-primary-link', 'S2S'],
    ['east-primary-link', 'firewall', 'S2S'],
    ['firewall', target, protocol],
  ];
}
/** Finite declared routes, with account-scoped ACL on every leg; no IP routing or personal VPN shortcut. */
export function assessBranchAccess(
  s: SimulationState,
  contextId: string,
  target: string,
  protocol: string,
  route: BranchRoute = s.branch!.activeRoute,
): BranchAccessChecks {
  const b = s.branch!;
  const context = b.contexts.find((c) => c.id === contextId),
    account = s.access.accounts.find((a) => a.id === context?.accountId);
  const legs = routeLegs(route, target, protocol).map(
    ([sourceAssetId, targetAssetId, protocol]) => ({
      sourceAssetId: sourceAssetId!,
      targetAssetId: targetAssetId!,
      protocol: protocol!,
      ...(context ? { accountId: context.accountId } : {}),
    }),
  );
  const topologyExists =
    legs.length > 0 &&
    legs.every((l) =>
      s.world.connections.some(
        (c) =>
          c.kind === 'network' &&
          c.sourceAssetId === l.sourceAssetId &&
          c.targetAssetId === l.targetAssetId &&
          c.protocol === l.protocol,
      ),
    );
  const infrastructureAvailable =
    legs.length > 0 &&
    legs.every(
      (l) =>
        isAssetOnline(s.world, l.sourceAssetId) &&
        isAssetOnline(s.world, l.targetAssetId) &&
        s.world.assets.some(
          (a) => a.id === l.targetAssetId && a.protocols.includes(l.protocol),
        ),
    );
  const tunnelAuthenticated =
    route === 'primary'
      ? b.tunnel.authenticated &&
        b.tunnel.localGatewayAssetId === 'east-gateway' &&
        b.tunnel.linkAssetId === 'east-primary-link' &&
        b.tunnel.peerAssetId === 'firewall'
      : b.architecture.backupPrepared && b.backupAuthenticated;
  const tunnelAuthorized =
    route === 'primary'
      ? b.tunnel.authorized
      : b.architecture.backupPrepared && b.backupAuthorized;
  const networkAllowed =
    legs.length > 0 &&
    legs.every((l) => selectNetworkRule(s.access.rules, l)?.action === 'allow');
  const contextAuthenticated = !!context?.authenticated,
    accountExists = !!account;
  const permissionAllowed =
    !!account &&
    s.access.permissions.some(
      (p) =>
        p.accountId === account.id &&
        p.targetAssetId === target &&
        p.protocol === protocol,
    );
  const serviceAuthorized =
    protocol !== 'SMB' ||
    (!!account && !b.architecture.restrictedAccountIds.includes(account.id));
  const reachedService =
    topologyExists &&
    infrastructureAvailable &&
    tunnelAuthenticated &&
    tunnelAuthorized &&
    contextAuthenticated &&
    accountExists &&
    legs.every((l) => networkAllows(s.world, s.access, l));
  return {
    route,
    path: legs.length
      ? [legs[0]!.sourceAssetId, ...legs.map((l) => l.targetAssetId)]
      : [],
    topologyExists,
    infrastructureAvailable,
    tunnelAuthenticated,
    tunnelAuthorized,
    contextAuthenticated,
    accountExists,
    networkAllowed,
    permissionAllowed,
    serviceAuthorized,
    reachedService,
    allowed: reachedService && permissionAllowed && serviceAuthorized,
  };
}
export function branchWorkAvailability(s: SimulationState) {
  const b = s.branch!,
    d = s.hidden.scenario.branch!;
  if (s.finale && s.recovery && s.integrity) {
    const a = assessErpAvailability(s),
      functional =
        a.host &&
        a.processRunning &&
        a.database &&
        a.storage &&
        a.databasePath &&
        a.consistent;
    const erp = assessBranchAccess(s, 'EAST-OP', a.target, 'HTTPS').allowed,
      documentErp = assessBranchAccess(
        s,
        'EAST-DOC',
        a.target,
        'HTTPS',
      ).allowed,
      documents = assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed;
    const ratio =
        s.integrity.documents.filter((d) => d.status === 'correct').length /
        s.integrity.documents.length,
      coverage =
        (s.hidden.scenario.recovery!.records.length -
          a.missingRecordIds.length) /
        s.hidden.scenario.recovery!.records.length;
    const capacity = functional
      ? Math.min(
          (erp ? 1 : 0) +
            (documentErp && documents ? Math.floor(2 * ratio) : 0),
          Math.floor(3 * coverage),
        )
      : 0;
    return {
      capacity,
      erp,
      documentErp,
      documents,
      requiresDocuments: true,
      ready: capacity === 3,
    };
  }
  const erp = assessBranchAccess(s, 'EAST-OP', 'erp', 'HTTPS').allowed;
  const documentErp = assessBranchAccess(s, 'EAST-DOC', 'erp', 'HTTPS').allowed;
  const documents = assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed;
  const requiresDocuments =
    d.requiresDocuments && s.clock.turn >= d.documentsFromTurn;
  const basic = erp ? (requiresDocuments ? 2 : 4) : 0;
  const documentWork =
    documentErp && (!requiresDocuments || documents)
      ? requiresDocuments
        ? 4
        : 2
      : 0;
  const capacity = Math.min(
    b.activeRoute === 'backup' ? 3 : 6,
    basic + documentWork,
  );
  return {
    capacity,
    erp,
    documentErp,
    documents,
    requiresDocuments,
    ready: capacity === 6,
  };
}
/** Transport readiness stops at the peer/gateway; ERP health and grants are separate. */
export function branchTransportAvailable(
  s: SimulationState,
  route: BranchRoute,
) {
  const b = s.branch!,
    a = assessBranchAccess(s, 'EAST-OP', 'erp', 'HTTPS', route);
  const legs = routeLegs(route, 'erp', 'HTTPS').slice(0, -1);
  return (
    a.tunnelAuthenticated &&
    a.tunnelAuthorized &&
    b.contexts.some((c) =>
      legs.every(([sourceAssetId, targetAssetId, protocol]) =>
        networkAllows(s.world, s.access, {
          sourceAssetId: sourceAssetId!,
          targetAssetId: targetAssetId!,
          protocol: protocol!,
          accountId: c.accountId,
        }),
      ),
    )
  );
}
