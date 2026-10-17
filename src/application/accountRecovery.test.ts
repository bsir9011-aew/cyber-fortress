import { describe, expect, it } from 'vitest';
import type { CampaignCommand, CampaignState } from '../domain/campaign';
import type { SimulationState, TaskAction } from '../domain/simulation';
import { canUseService, issueVpnSession } from '../simulation/access';
import { businessAvailability } from '../simulation/business';
import { currentMinute } from '../simulation/clock';
import { taskRejection } from '../simulation/tasks';
import { assessThreatAccess } from '../simulation/threatAssessment';
import { campaignReducer, createCampaign } from './campaignReducer';
import { createScenarioRun } from './scenarioSelectors';
import { selectPlayerView } from './selectPlayerView';
import { simulationReducer } from './simulationReducer';

const accountId = 'magazyn-07';
const unblock: TaskAction = { type: 'unblock-account', accountId };
const block: TaskAction = { type: 'block-account', accountId };
const advance = (s: SimulationState) =>
  simulationReducer(s, { type: 'advance-turn' });
const schedule = (
  s: SimulationState,
  action: TaskAction,
  workerId: 'administrator' | 'analyst' = 'administrator',
) => simulationReducer(s, { type: 'schedule-task', workerId, action });
const account = (s: SimulationState) =>
  s.access.accounts.find((a) => a.id === accountId)!;
const step = (s: CampaignState, ...commands: CampaignCommand[]) =>
  commands.reduce(campaignReducer, s);
const hour: CampaignCommand = { type: 'advance-preparation' };
const turn: CampaignCommand = {
  type: 'incident-command',
  command: { type: 'advance-turn' },
};
const order = (action: TaskAction): CampaignCommand => ({
  type: 'incident-command',
  command: { type: 'schedule-task', workerId: 'administrator', action },
});
const begin = (s: CampaignState) =>
  step(s, hour, hour, hour, hour, { type: 'start-incident' });
function finish(s: CampaignState) {
  while (s.phase === 'incident') s = step(s, turn);
  return s;
}
function blockedA() {
  return step(begin(createCampaign(0)), order(block), turn);
}
function legalB() {
  return begin(step(finish(blockedA()), { type: 'return-headquarters' }));
}

describe('kontrolowane przywracanie konta', () => {
  it('zajmuje administratora przez pełną turę; nie daje efektu przy zleceniu', () => {
    const blocked = advance(schedule(createScenarioRun('training', 0), block));
    const pending = schedule(blocked, unblock);
    expect(account(pending).loginStatus).toBe('blocked');
    expect(pending.clock).toEqual(blocked.clock);
    expect(pending.tasks.at(-1)).toMatchObject({
      workerId: 'administrator',
      startTurn: 1,
      dueTurn: 2,
      status: 'running',
    });
    expect(taskRejection(pending, 'administrator', unblock)).toBe(
      'worker-busy',
    );
    const done = advance(pending);
    expect(account(done)).toEqual({
      ...account(blocked),
      loginStatus: 'enabled',
    });
    expect(done.tasks.at(-1)?.status).toBe('completed');
    expect(
      done.incident.messages.some((m) =>
        m.text.includes('Przywróciłem nowe logowania'),
      ),
    ).toBe(true);
    expect(taskRejection(done, 'administrator', unblock)).toBe('invalid-state');
  });

  it('nie przywraca zakończonego tunelu, lecz przywraca rzeczywistą możliwość użycia skradzionego hasła', () => {
    let s = schedule(
      createScenarioRun('training', 0),
      { type: 'inspect-vpn-sessions' },
      'analyst',
    );
    s = advance(schedule(s, block));
    s = advance(schedule(s, { type: 'terminate-session', sessionId: 'S-19' }));
    const oldTunnel = s.access.sessions.find((v) => v.id === 'S-19')!;
    expect(oldTunnel.status).toBe('terminated');
    expect(assessThreatAccess(s)).toMatchObject({
      newAuthenticationAllowed: false,
      accountContained: true,
    });
    s = advance(schedule(s, unblock));
    expect(s.access.sessions.find((v) => v.id === 'S-19')).toEqual(oldTunnel);
    expect(
      canUseService(
        s.world,
        s.access,
        'S-19',
        'fs-01',
        'SMB',
        currentMinute(s.clock),
      ),
    ).toBe(false);
    expect(assessThreatAccess(s)).toMatchObject({
      stolenCredentialStillCurrent: true,
      newAuthenticationAllowed: true,
      accessAfterNewAuthentication: true,
      accountContained: false,
    });
    const fresh = issueVpnSession(
      s.world,
      s.access,
      { sessionId: 'stolen-password-retry', accountId, credentialVersion: 1 },
      currentMinute(s.clock),
    );
    expect(fresh.ok).toBe(true);
    if (!fresh.ok) throw new Error();
    expect(
      canUseService(
        s.world,
        fresh.access,
        fresh.session.id,
        'fs-01',
        'SMB',
        currentMinute(s.clock),
      ),
    ).toBe(true);
    expect(
      s.hidden.decisionHistory.at(-1)?.impact?.after.newAuthenticationAllowed,
    ).toBe(true);
    for (let i = 0; i < 6; i++) s = advance(s);
    expect(s.hidden.attacker!.authenticationAttempts).toBeGreaterThan(0);
    expect(
      s.access.sessions.some(
        (v) =>
          v.id !== oldTunnel.id &&
          s.hidden.sessionOrigins[v.id] === 'unauthorized',
      ),
    ).toBe(true);
    expect(s.hidden.attacker!.transfer.exposedRecords).toBeGreaterThan(0);
    expect(s.access.sessions.find((v) => v.id === oldTunnel.id)).toEqual(
      oldTunnel,
    );
  });

  it.each(['not-required', 'required'] as const)(
    'zachowuje zmienione poświadczenie oraz politykę MFA %s',
    (mfaPolicy) => {
      let s = createScenarioRun('training', 0);
      s = {
        ...s,
        access: {
          ...s.access,
          accounts: s.access.accounts.map((a) =>
            a.id === accountId
              ? { ...a, mfaPolicy, secondFactorVersion: 7 }
              : a,
          ),
        },
      };
      s = advance(schedule(s, block));
      s = advance(
        advance(schedule(s, { type: 'reset-credential', accountId })),
      );
      const before = account(s);
      expect(before.credentialVersion).toBe(2);
      s = advance(schedule(s, unblock));
      expect(account(s)).toEqual({ ...before, loginStatus: 'enabled' });
      const probe = (credentialVersion: number, secondFactorVersion?: number) =>
        issueVpnSession(
          s.world,
          s.access,
          {
            sessionId: 'new-probe',
            accountId,
            credentialVersion,
            ...(secondFactorVersion === undefined
              ? {}
              : { secondFactorVersion }),
          },
          currentMinute(s.clock),
        );
      expect(probe(1)).toEqual({ ok: false, reason: 'invalid-credential' });
      if (mfaPolicy === 'required')
        expect(probe(2)).toEqual({ ok: false, reason: 'mfa-required' });
      else expect(probe(2).ok).toBe(true);
      expect(probe(2, 7).ok).toBe(true);
    },
  );

  it('odrzuca nieistniejące, niewskazane i już odblokowane konto oraz złego wykonawcę', () => {
    const s = createScenarioRun('training', 0);
    expect(
      taskRejection(s, 'administrator', {
        type: 'unblock-account',
        accountId: '',
      }),
    ).toBe('target-not-observed');
    expect(
      taskRejection(s, 'administrator', {
        type: 'unblock-account',
        accountId: 'unknown',
      }),
    ).toBe('target-not-observed');
    expect(
      taskRejection(s, 'administrator', {
        type: 'unblock-account',
        accountId: 'dispatch',
      }),
    ).toBe('target-not-observed');
    expect(taskRejection(s, 'administrator', unblock)).toBe('invalid-state');
    expect(taskRejection(s, 'analyst', unblock)).toBe('wrong-worker');
    const missing = {
      ...s,
      access: {
        ...s.access,
        accounts: s.access.accounts.filter((a) => a.id !== accountId),
      },
    };
    expect(taskRejection(missing, 'administrator', unblock)).toBe(
      'unknown-target',
    );
    const rejected = schedule(missing, unblock);
    expect(rejected.access).toEqual(missing.access);
    expect(rejected.tasks).toEqual(missing.tasks);
  });

  it('odrzuca operację poza oknem i po zakończeniu misji', () => {
    let s = advance(schedule(createScenarioRun('training', 0), block));
    expect(
      taskRejection(
        { ...s, clock: { ...s.clock, turn: 18 } },
        'administrator',
        unblock,
      ),
    ).toBe('outside-time-window');
    while (s.clock.turn < 18) s = advance(s);
    const rejected = schedule(s, unblock);
    expect(account(rejected).loginStatus).toBe('blocked');
    expect(rejected.tasks).toEqual(s.tasks);
    expect(rejected.history.at(-1)).toMatchObject({
      kind: 'command-rejected',
      reason: 'simulation-finished',
    });
  });

  it('pokazuje do odblokowania tylko zablokowane konta znane graczowi', () => {
    let s = createScenarioRun('training', 0);
    expect(selectPlayerView(s).blockedKnownAccountIds).toEqual([]);
    s = advance(schedule(s, block));
    expect(selectPlayerView(s).blockedKnownAccountIds).toEqual([accountId]);
    const unseen = { ...s, incident: { ...s.incident, alerts: [] } };
    expect(selectPlayerView(unseen).blockedKnownAccountIds).toEqual([]);
    expect(taskRejection(unseen, 'administrator', unblock)).toBe(
      'target-not-observed',
    );
  });
});

describe('odzyskiwanie dostępu między misjami kampanii', () => {
  it('A blokada → legalne B → zadanie przywrócenia → nowe logowanie i odzyskanie wydajności → trwały stan enabled', () => {
    let s = legalB();
    expect(s.incident!.hidden.scenario.kind).toBe('legitimate-session');
    expect(s.incident!.hidden.attacker).toBeNull();
    expect(account(s.incident!).loginStatus).toBe('blocked');
    expect(s.incident!.access.sessions.some((v) => v.id === 'S-19')).toBe(
      false,
    );
    expect(businessAvailability(s.incident!).capacity).toBe(16);
    s = step(s, order(unblock));
    expect(account(s.incident!).loginStatus).toBe('blocked');
    s = step(s, turn);
    expect(account(s.incident!).loginStatus).toBe('enabled');
    expect(s.incident!.business.lastReport?.capacity).toBe(16);
    expect(businessAvailability(s.incident!).capacity).toBe(16);
    s = step(s, turn);
    const fresh = s.incident!.access.sessions.find(
      (v) => v.accountId === accountId && v.status === 'active',
    )!;
    expect(fresh.id).not.toBe('S-19');
    expect(fresh.startedAtMinute).toBe(850);
    expect(
      s.incident!.telemetry.sourceEvents.some(
        (e) => e.sessionId === fresh.id && e.outcome === 'success',
      ),
    ).toBe(true);
    expect(
      canUseService(
        s.incident!.world,
        s.incident!.access,
        fresh.id,
        'fs-01',
        'SMB',
        850,
      ),
    ).toBe(true);
    expect(businessAvailability(s.incident!).capacity).toBe(22);
    s = step(s, turn);
    expect(s.incident!.business.lastReport?.capacity).toBe(22);
    s = finish(s);
    expect(s.history.at(-1)).toMatchObject({
      processed: 360,
      backlog: 0,
      minimumCapacity: 16,
      fullCapacity: 22,
    });
    s = step(s, { type: 'return-headquarters' });
    expect(s.posture.accountOverrides[accountId]).toEqual({
      loginStatus: 'enabled',
      credentialVersion: 1,
    });
    expect(account(begin(s).incident!).loginStatus).toBe('enabled');
  });

  it('blokada nie znika przy przejściu do B, końcu B ani przy starcie C bez jawnej operacji', () => {
    let s = legalB();
    expect(s.posture.accountOverrides[accountId]).toEqual({
      loginStatus: 'blocked',
      credentialVersion: 1,
    });
    s = finish(s);
    expect(account(s.incident!).loginStatus).toBe('blocked');
    expect(s.history.at(-1)).toMatchObject({ processed: 288, backlog: 72 });
    s = step(s, { type: 'return-headquarters' });
    expect(s.posture.accountOverrides[accountId]?.loginStatus).toBe('blocked');
    s = begin(s);
    expect(account(s.incident!).loginStatus).toBe('blocked');
    expect(
      s.incident!.access.sessions.some((v) => v.accountId === accountId),
    ).toBe(false);
  });

  it('samo odblokowanie nie omija odziedziczonej odmowy SMB ani nie przyznaje pełnej wydajności', () => {
    let s = step(
      blockedA(),
      order({ type: 'set-network-rule', ruleId: 'R-SMB', action: 'deny' }),
      turn,
      turn,
    );
    s = begin(step(finish(s), { type: 'return-headquarters' }));
    s = step(s, order(unblock), turn, turn, turn);
    expect(account(s.incident!).loginStatus).toBe('enabled');
    const fresh = s.incident!.access.sessions.find(
      (v) => v.accountId === accountId && v.status === 'active',
    )!;
    expect(fresh).toBeDefined();
    expect(
      canUseService(
        s.incident!.world,
        s.incident!.access,
        fresh.id,
        'fs-01',
        'SMB',
        currentMinute(s.incident!.clock),
      ),
    ).toBe(false);
    expect(businessAvailability(s.incident!).capacity).toBe(16);
    expect(finish(s).history.at(-1)).toMatchObject({
      processed: 288,
      backlog: 72,
    });
  });
});
