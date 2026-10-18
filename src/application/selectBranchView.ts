import { branchSmbConfigurationMatches } from '../content/scenarios/branch';
import type { SimulationState } from '../domain/simulation';
import type { BranchTaskAction } from '../domain/branch';
import { branchTaskSpecs } from '../simulation/branch';
import { taskRejection } from '../simulation/tasks';
export function selectBranchView(s: SimulationState) {
  const b = s.branch;
  if (!b) return null;
  const actions: BranchTaskAction[] = [
    { type: 'inspect-branch-links' },
    { type: 'inspect-branch-gateway-logs' },
    { type: 'confirm-branch-requirements' },
    { type: 'activate-branch-route', route: 'backup' },
    { type: 'activate-branch-route', route: 'primary' },
    { type: 'repair-branch-link' },
    ...(['none', 'documents', 'all'] as const).map((scope) => ({
      type: 'set-branch-smb-scope' as const,
      scope,
    })),
    ...b.contexts.map((c) => ({
      type: 'set-branch-account-restriction' as const,
      accountId: c.accountId,
      restricted: !b.architecture.restrictedAccountIds.includes(c.accountId),
    })),
  ];
  return {
    architecture: b.architecture,
    smbConfigurationMatches: branchSmbConfigurationMatches(
      s.access,
      b.architecture,
    ),
    route: b.activeRoute,
    tunnel: {
      id: b.tunnel.id,
      localGatewayAssetId: b.tunnel.localGatewayAssetId,
      peerAssetId: b.tunnel.peerAssetId,
    },
    accounts: b.contexts.map((c) => c.accountId),
    sensor: b.sensor,
    observations: b.observations,
    results: b.results,
    actions: actions.map((action) => ({
      action,
      ...branchTaskSpecs[action.type],
      rejection: taskRejection(
        s,
        branchTaskSpecs[action.type].workerId,
        action,
      ),
    })),
  };
}
export function selectKnownBranchWorld(s: SimulationState) {
  if (!s.branch) return s.world;
  const known = Object.assign(
    {},
    ...s.branch.observations.map((o) => o.assetStatuses),
  ) as Record<string, 'online' | 'offline'>;
  return {
    ...s.world,
    assets: s.world.assets.map((a) =>
      a.id === 'east-primary-link'
        ? { ...a, status: known[a.id] ?? ('unknown' as const) }
        : a,
    ),
  };
}
export type BranchView = NonNullable<ReturnType<typeof selectBranchView>>;
