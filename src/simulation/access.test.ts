import { describe, expect, it } from 'vitest';
import { createInitialSimulation } from '../application/createInitialSimulation';
import {
  canUseService,
  isSessionActive,
  issueVpnSession,
  networkAllows,
} from './access';

describe('topologia, polityka, sesja i uprawnienie', () => {
  it('wymaga wszystkich czterech warunków zamiast samej linii na mapie', () => {
    const { world, access } = createInitialSimulation();
    const flow = {
      sourceAssetId: 'vpn',
      targetAssetId: 'fs-01',
      protocol: 'SMB',
    };
    expect(networkAllows(world, access, flow)).toBe(true);
    expect(canUseService(world, access, 'S-19', 'fs-01', 'SMB', 840)).toBe(
      true,
    );
    expect(networkAllows(world, { ...access, rules: [] }, flow)).toBe(false);
    expect(networkAllows({ ...world, connections: [] }, access, flow)).toBe(
      false,
    );
    expect(
      canUseService(
        world,
        { ...access, permissions: [] },
        'S-19',
        'fs-01',
        'SMB',
        840,
      ),
    ).toBe(false);
    expect(canUseService(world, access, 'unknown', 'fs-01', 'SMB', 840)).toBe(
      false,
    );
    expect(canUseService(world, access, 'S-19', 'erp', 'HTTPS', 840)).toBe(
      false,
    );
  });

  it('blokada SMB pozostawia HTTPS i pracę legalnej sesji do ERP', () => {
    const { world, access } = createInitialSimulation();
    const changed = {
      ...access,
      rules: access.rules.map((rule) =>
        rule.id === 'R-SMB' ? { ...rule, action: 'deny' as const } : rule,
      ),
    };
    expect(canUseService(world, changed, 'S-19', 'fs-01', 'SMB', 840)).toBe(
      false,
    );
    expect(canUseService(world, changed, 'B-01', 'erp', 'HTTPS', 840)).toBe(
      true,
    );
  });

  it('każde użycie istniejącego tunelu ponownie ocenia politykę', () => {
    const { world, access } = createInitialSimulation();
    expect(canUseService(world, access, 'B-01', 'erp', 'HTTPS', 840)).toBe(
      true,
    );
    const changed = {
      ...access,
      rules: access.rules.map((rule) =>
        rule.id === 'R-ERP' ? { ...rule, action: 'deny' as const } : rule,
      ),
    };
    expect(canUseService(world, changed, 'B-01', 'erp', 'HTTPS', 845)).toBe(
      false,
    );
    expect(
      changed.sessions.find((session) => session.id === 'B-01')?.status,
    ).toBe('active');
  });

  it('wybiera regułę według priorytetu i stabilnego ID, nie kolejności tablicy', () => {
    const { world, access } = createInitialSimulation();
    const base = access.rules[0]!;
    const allow = { ...base, id: 'Z', priority: 1, action: 'allow' as const };
    const deny = { ...base, id: 'A', priority: 1, action: 'deny' as const };
    const flow = {
      sourceAssetId: 'vpn',
      targetAssetId: 'erp',
      protocol: 'HTTPS',
    };
    expect(
      networkAllows(world, { ...access, rules: [allow, deny] }, flow),
    ).toBe(false);
    expect(
      networkAllows(world, { ...access, rules: [deny, allow] }, flow),
    ).toBe(false);
    expect(
      networkAllows(
        world,
        { ...access, rules: [{ ...allow, priority: 0 }, deny] },
        flow,
      ),
    ).toBe(true);
  });

  it('odmawia przy niedostępnej usłudze lub braku oferowanego protokołu', () => {
    const { world, access } = createInitialSimulation();
    for (const id of ['vpn', 'erp']) {
      const offline = {
        ...world,
        assets: world.assets.map((asset) =>
          asset.id === id ? { ...asset, status: 'offline' as const } : asset,
        ),
      };
      expect(canUseService(offline, access, 'B-01', 'erp', 'HTTPS', 840)).toBe(
        false,
      );
    }
    const noService = {
      ...world,
      assets: world.assets.map((asset) =>
        asset.id === 'erp' ? { ...asset, protocols: [] } : asset,
      ),
    };
    expect(canUseService(noService, access, 'B-01', 'erp', 'HTTPS', 840)).toBe(
      false,
    );
  });
});

describe('nowe sesje i wersje poświadczeń', () => {
  const request = {
    sessionId: 'S-new',
    accountId: 'magazyn-07',
    credentialVersion: 1,
  };

  it('wydaje nową sesję bez modyfikowania poprzedniego stanu', () => {
    const { world, access } = createInitialSimulation();
    const result = issueVpnSession(world, access, request, 845);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected issued session');
    expect(result.session).toMatchObject({
      id: 'S-new',
      status: 'active',
      startedAtMinute: 845,
      expiresAtMinute: 965,
    });
    expect(result.access.sessions).toHaveLength(access.sessions.length + 1);
    expect(access.sessions).toHaveLength(2);
    expect(issueVpnSession(world, result.access, request, 845)).toEqual({
      ok: false,
      reason: 'invalid-request',
    });
  });

  it('zablokowane konto zachowuje stary tunel, lecz nie uzyskuje nowego', () => {
    const { world, access } = createInitialSimulation();
    const blocked = {
      ...access,
      accounts: access.accounts.map((account) => ({
        ...account,
        loginStatus: 'blocked' as const,
      })),
    };
    expect(canUseService(world, blocked, 'S-19', 'fs-01', 'SMB', 845)).toBe(
      true,
    );
    expect(issueVpnSession(world, blocked, request, 845)).toEqual({
      ok: false,
      reason: 'account-blocked',
    });
  });

  it('reset wersji odrzuca stare poświadczenie i zachowuje już wydany tunel', () => {
    const { world, access } = createInitialSimulation();
    const changed = {
      ...access,
      accounts: access.accounts.map((account) => ({
        ...account,
        credentialVersion: 2,
      })),
    };
    expect(issueVpnSession(world, changed, request, 845)).toEqual({
      ok: false,
      reason: 'invalid-credential',
    });
    expect(
      issueVpnSession(world, changed, { ...request, credentialVersion: 2 }, 845)
        .ok,
    ).toBe(true);
    expect(canUseService(world, changed, 'S-19', 'fs-01', 'SMB', 845)).toBe(
      true,
    );
  });

  it('zakończenie sesji nie zabrania kolejnego logowania', () => {
    const { world, access } = createInitialSimulation();
    const changed = {
      ...access,
      sessions: access.sessions.map((session) => ({
        ...session,
        status: 'terminated' as const,
      })),
    };
    expect(canUseService(world, changed, 'S-19', 'fs-01', 'SMB', 845)).toBe(
      false,
    );
    expect(issueVpnSession(world, changed, request, 845).ok).toBe(true);
  });

  it('nie wydaje sesji bez bramy, tożsamości lub obsługi wymaganego MFA', () => {
    const { world, access } = createInitialSimulation();
    expect(
      issueVpnSession(world, access, { ...request, accountId: 'unknown' }, 845)
        .ok,
    ).toBe(false);
    for (const id of ['vpn', 'ad']) {
      const offline = {
        ...world,
        assets: world.assets.map((asset) =>
          asset.id === id ? { ...asset, status: 'offline' as const } : asset,
        ),
      };
      expect(issueVpnSession(offline, access, request, 845)).toEqual({
        ok: false,
        reason: 'service-unavailable',
      });
    }
    const mfa = {
      ...access,
      accounts: access.accounts.map((account) => ({
        ...account,
        mfaPolicy: 'required' as const,
      })),
    };
    expect(issueVpnSession(world, mfa, request, 845)).toEqual({
      ok: false,
      reason: 'mfa-required',
    });
  });

  it('przestrzega początku i wygaśnięcia sesji, włącznie z granicą czasu', () => {
    const session = createInitialSimulation().access.sessions[0]!;
    expect(isSessionActive(session, session.startedAtMinute - 1)).toBe(false);
    expect(isSessionActive(session, session.startedAtMinute)).toBe(true);
    expect(isSessionActive(session, session.expiresAtMinute - 1)).toBe(true);
    expect(isSessionActive(session, session.expiresAtMinute)).toBe(false);
  });
});
