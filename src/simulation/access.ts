import type { AccessState, NetworkRule, VpnSession } from '../domain/access';
import type { WorldState } from '../domain/world';
import type { LocalEndpoint, LocalOperation } from '../domain/integrity';

/** A held local context is not a VPN session or a new authentication attempt. */
export function canUseLocalService(
  world: WorldState,
  access: AccessState,
  endpoint: LocalEndpoint,
  targetAssetId: string,
  protocol: string,
  operation: LocalOperation,
): boolean {
  return (
    !endpoint.isolated &&
    isAssetOnline(world, endpoint.assetId) &&
    access.accounts.some((a) => a.id === endpoint.accountId) &&
    !(operation === 'modify' && endpoint.writesRestricted) &&
    endpoint.permissions.some(
      (p) =>
        p.assetId === targetAssetId &&
        p.protocol === protocol &&
        p.operations.includes(operation),
    ) &&
    networkAllows(world, access, {
      sourceAssetId: endpoint.assetId,
      accountId: endpoint.accountId,
      targetAssetId,
      protocol,
    })
  );
}

export interface NetworkFlow {
  readonly accountId?: string;
  readonly sourceAssetId: string;
  readonly targetAssetId: string;
  readonly protocol: string;
}

export function selectNetworkRule(
  rules: readonly NetworkRule[],
  flow: NetworkFlow,
): NetworkRule | undefined {
  return [...rules]
    .sort(
      (a, b) =>
        a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .find(
      (rule) =>
        rule.sourceAssetId === flow.sourceAssetId &&
        rule.targetAssetId === flow.targetAssetId &&
        rule.protocol === flow.protocol &&
        (rule.accountIds === undefined ||
          (flow.accountId !== undefined &&
            rule.accountIds.includes(flow.accountId))),
    );
}

export function isAssetOnline(world: WorldState, assetId: string): boolean {
  return world.assets.some(
    (asset) => asset.id === assetId && asset.status === 'online',
  );
}

/** Topologia i reguły są niezależne. Pierwsza pasująca reguła, domyślnie odmowa. */
export function networkAllows(
  world: WorldState,
  access: AccessState,
  flow: NetworkFlow,
): boolean {
  if (
    !isAssetOnline(world, flow.sourceAssetId) ||
    !isAssetOnline(world, flow.targetAssetId)
  )
    return false;
  if (
    !world.assets.some(
      (asset) =>
        asset.id === flow.targetAssetId &&
        asset.protocols.includes(flow.protocol),
    )
  )
    return false;
  const topologyExists = world.connections.some(
    (connection) =>
      connection.kind === 'network' &&
      connection.sourceAssetId === flow.sourceAssetId &&
      connection.targetAssetId === flow.targetAssetId &&
      connection.protocol === flow.protocol,
  );
  if (!topologyExists) return false;
  const rule = selectNetworkRule(access.rules, flow);
  return rule?.action === 'allow';
}

export function isSessionActive(session: VpnSession, minute: number): boolean {
  return (
    session.status === 'active' &&
    session.startedAtMinute <= minute &&
    minute < session.expiresAtMinute
  );
}

/** LoginStatus i nowa wersja hasła nie cofają wcześniej wydanego tunelu. */
export function canUseService(
  world: WorldState,
  access: AccessState,
  sessionId: string,
  targetAssetId: string,
  protocol: string,
  minute: number,
): boolean {
  const session = access.sessions.find((item) => item.id === sessionId);
  if (!session || !isSessionActive(session, minute)) return false;
  if (
    !vendorExceptionAllows(
      access,
      session.accountId,
      targetAssetId,
      protocol,
      minute,
    )
  )
    return false;
  if (
    access.vendorAuthorization?.accountId === session.accountId &&
    !networkAllows(world, access, {
      sourceAssetId: 'cargo-link',
      targetAssetId: access.vpnAssetId,
      protocol: 'VPN',
      accountId: session.accountId,
    })
  )
    return false;
  if (!access.accounts.some((account) => account.id === session.accountId))
    return false;
  if (
    !networkAllows(world, access, {
      sourceAssetId: session.gatewayAssetId,
      accountId: session.accountId,
      targetAssetId,
      protocol,
    })
  )
    return false;
  return access.permissions.some(
    (permission) =>
      permission.accountId === session.accountId &&
      permission.targetAssetId === targetAssetId &&
      permission.protocol === protocol,
  );
}

export interface SessionRequest {
  readonly secondFactorVersion?: number;
  readonly sessionId: string;
  readonly accountId: string;
  readonly credentialVersion: number;
}

export type SessionIssueResult =
  | {
      readonly ok: true;
      readonly access: AccessState;
      readonly session: VpnSession;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'invalid-request'
        | 'service-unavailable'
        | 'account-blocked'
        | 'invalid-credential'
        | 'mfa-required';
    };

/** Wydaje tylko nowy tunel na skonfigurowanej bramie; bez generowania logów. */
export function issueVpnSession(
  world: WorldState,
  access: AccessState,
  request: SessionRequest,
  minute: number,
): SessionIssueResult {
  const account = access.accounts.find((item) => item.id === request.accountId);
  if (
    !account ||
    !request.sessionId.trim() ||
    access.sessions.some((item) => item.id === request.sessionId) ||
    !Number.isSafeInteger(minute) ||
    !Number.isSafeInteger(request.credentialVersion) ||
    !access.identities.some((identity) => identity.id === account.identityId)
  )
    return { ok: false, reason: 'invalid-request' };
  const authPath = world.connections.some(
    (connection) =>
      connection.kind === 'authentication' &&
      connection.sourceAssetId === access.vpnAssetId &&
      connection.targetAssetId === access.identityAssetId,
  );
  if (
    (access.vendorAuthorization?.accountId === account.id &&
      !networkAllows(world, access, {
        sourceAssetId: 'cargo-link',
        targetAssetId: access.vpnAssetId,
        protocol: 'VPN',
        accountId: account.id,
      })) ||
    !authPath ||
    !isAssetOnline(world, access.vpnAssetId) ||
    !isAssetOnline(world, access.identityAssetId)
  )
    return { ok: false, reason: 'service-unavailable' };
  if (account.loginStatus !== 'enabled')
    return { ok: false, reason: 'account-blocked' };
  if (account.credentialVersion !== request.credentialVersion)
    return { ok: false, reason: 'invalid-credential' };
  if (
    account.mfaPolicy === 'required' &&
    (account.secondFactorVersion === undefined ||
      !Number.isSafeInteger(account.secondFactorVersion) ||
      account.secondFactorVersion < 1 ||
      request.secondFactorVersion !== account.secondFactorVersion)
  )
    return { ok: false, reason: 'mfa-required' };
  const session: VpnSession = {
    id: request.sessionId,
    accountId: account.id,
    gatewayAssetId: access.vpnAssetId,
    status: 'active',
    startedAtMinute: minute,
    expiresAtMinute: minute + access.sessionLifetimeMinutes,
  };
  return {
    ok: true,
    session,
    access: { ...access, sessions: [...access.sessions, session] },
  };
}

/** Untimed legacy ACLs keep their meaning. A supplier always needs this explicit grant. */
export function vendorExceptionAllows(
  access: AccessState,
  accountId: string,
  targetAssetId: string,
  protocol: string,
  minute: number,
): boolean {
  const authorization = access.vendorAuthorization;
  if (accountId !== 'cargo-link-operator') return true;
  if (!authorization || authorization.accountId !== accountId) return false;
  const e = authorization.exception;
  return (
    !!e &&
    e.status === 'active' &&
    e.validFromMinute <= minute &&
    minute < e.expiresAtMinute &&
    ((targetAssetId === 'carrier-api' && protocol === 'HTTPS') ||
      (e.scope === 'api-and-files' &&
        targetAssetId === 'fs-01' &&
        protocol === 'SMB'))
  );
}
