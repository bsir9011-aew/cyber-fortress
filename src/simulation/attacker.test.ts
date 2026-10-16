import { describe, expect, it } from 'vitest';
import { createInitialSimulation } from '../application/createInitialSimulation';
import { selectPlayerView } from '../application/selectPlayerView';
import { simulationReducer } from '../application/simulationReducer';
import { nexusAttack } from '../content/nexusAttack';
import type {
  SimulationCommand,
  SimulationState,
  TaskAction,
} from '../domain/simulation';
import { canUseService, issueVpnSession } from './access';
import {
  createInitialAttacker,
  selectAttackerAction,
  stepAttacker,
} from './attacker';
import { currentMinute } from './clock';
import { taskSpecs } from './tasks';

const advance = (state: SimulationState) =>
  simulationReducer(state, { type: 'advance-turn' });
function until(state: SimulationState, turn: number): SimulationState {
  let next = state;
  while (next.clock.turn < turn) next = advance(next);
  return next;
}
function schedule(state: SimulationState, action: TaskAction): SimulationState {
  const next = simulationReducer(state, {
    type: 'schedule-task',
    workerId: taskSpecs[action.type].workerId,
    action,
  });
  expect(next.history.at(-1)?.kind).toBe('task-started');
  return next;
}
const smb = (action: 'allow' | 'deny'): TaskAction => ({
  type: 'set-network-rule',
  ruleId: 'R-SMB',
  action,
});
const vpn = (enabled: boolean): TaskAction => ({
  type: 'set-vpn',
  assetId: 'vpn',
  enabled,
});
const study = () =>
  advance(
    schedule(createInitialSimulation(), { type: 'inspect-vpn-sessions' }),
  );
const exposed = (state: SimulationState) =>
  state.hidden.attacker.transfer.exposedRecords;
const attempts = (state: SimulationState) =>
  state.hidden.attacker.privateHistory;
const terminate = (state: SimulationState) =>
  advance(schedule(state, { type: 'terminate-session', sessionId: 'S-19' }));

describe('bazowy harmonogram i rozliczenie transferu', () => {
  it('bez obrony wykonuje rekonesans, start i porcje 400/800/800 dokładnie w chwilach GDD', () => {
    let state = createInitialSimulation();
    const before = structuredClone(state);
    expect(selectAttackerAction(state.hidden.attacker, 1)).toBeNull();
    expect(stepAttacker(state)).toBe(state);
    expect(state).toEqual(before);
    const totals: number[] = [];
    for (let turn = 1; turn <= 6; turn += 1) {
      state = advance(state);
      totals.push(exposed(state));
    }
    expect(totals).toEqual([0, 0, 0, 400, 1200, 2000]);
    expect(
      attempts(state).map((event) => [
        event.minute,
        event.action,
        event.outcome,
        event.copiedRecords,
      ]),
    ).toEqual([
      [850, 'reconnaissance', 'reconnaissance-confirmed', 0],
      [855, 'start-transfer', 'transfer-started', 0],
      [860, 'transfer', 'records-copied', 400],
      [865, 'transfer', 'records-copied', 800],
      [870, 'transfer', 'records-copied', 800],
    ]);
    expect(state.hidden.attacker).toMatchObject({
      status: 'completed',
      nextAction: null,
    });
    expect(until(state, 18).hidden.attacker).toEqual(state.hidden.attacker);
  });

  it('blokuje SMB przed rekonesansem i nie narusza HTTPS do ERP', () => {
    const state = until(schedule(createInitialSimulation(), smb('deny')), 18);
    expect(exposed(state)).toBe(0);
    expect(state.hidden.attacker.status).toBe('blocked');
    expect(attempts(state).map((event) => [event.turn, event.outcome])).toEqual(
      [
        [2, 'access-denied'],
        [4, 'access-denied'],
        [6, 'access-denied'],
      ],
    );
    expect(
      canUseService(
        state.world,
        state.access,
        'B-01',
        'erp',
        'HTTPS',
        currentMinute(state.clock),
      ),
    ).toBe(true);
    expect(state.business).toMatchObject({
      totalReceived: 360,
      totalProcessed: 360,
      backlog: 0,
    });
  });

  it('zmiana ukończona o 14:25 zatrzymuje porcję z 14:25, ale nie cofa 400 rekordów z 14:20', () => {
    let state = until(createInitialSimulation(), 3);
    state = schedule(state, smb('deny'));
    state = advance(state);
    expect(exposed(state)).toBe(400);
    const before = state.hidden.attacker.privateHistory[2];
    state = advance(state);
    expect(currentMinute(state.clock)).toBe(865);
    expect(exposed(state)).toBe(400);
    expect(attempts(state).at(-1)).toMatchObject({
      minute: 865,
      action: 'transfer',
      outcome: 'access-denied',
      copiedRecords: 0,
    });
    expect(attempts(state)[2]).toEqual(before);
    state = until(state, 18);
    expect(exposed(state)).toBe(400);
    expect(state.business).toMatchObject({ totalProcessed: 360, backlog: 0 });
  });

  it('po odzyskaniu SMB ponawia jedną porcję, bez zaległych przydziałów transferu', () => {
    let state = until(
      schedule(until(createInitialSimulation(), 3), smb('deny')),
      5,
    );
    expect(exposed(state)).toBe(400);
    state = schedule(state, smb('allow'));
    state = advance(state);
    expect(exposed(state)).toBe(400);
    state = advance(state);
    expect(currentMinute(state.clock)).toBe(875);
    expect(exposed(state)).toBe(1200);
    expect(attempts(state).at(-1)?.copiedRecords).toBe(800);
    state = advance(state);
    expect(exposed(state)).toBe(2000);
    expect(
      attempts(state)
        .filter((event) => event.copiedRecords > 0)
        .map((event) => event.minute),
    ).toEqual([860, 875, 880]);
  });
});

describe('utrata tunelu i własne próby uwierzytelnienia', () => {
  it('zakończenie S-19 odbiera tunel, lecz poprawne znane poświadczenie pozwala zalogować się ponownie', () => {
    let state = terminate(study());
    expect(
      state.access.sessions.find((session) => session.id === 'S-19')?.status,
    ).toBe('terminated');
    expect(state.hidden.attacker.currentSessionId).toBeNull();
    expect(attempts(state).at(-1)).toMatchObject({
      turn: 2,
      outcome: 'session-lost',
      sessionId: 'S-19',
    });
    expect(state.hidden.attacker.nextAction).toEqual({
      kind: 'authenticate',
      dueTurn: 4,
    });
    state = advance(state);
    expect(state.hidden.attacker.currentSessionId).toBeNull();
    state = advance(state);
    expect(state.hidden.attacker.authenticationAttempts).toBe(1);
    expect(state.hidden.attacker.currentSessionId).toBe('S-20');
    expect(exposed(state)).toBe(0);
    expect(attempts(state).at(-1)).toMatchObject({
      action: 'authenticate',
      outcome: 'authentication-accepted',
      minute: 860,
    });
    state = until(state, 18);
    expect(exposed(state)).toBe(2000);
    expect(
      state.access.sessions.find((session) => session.id === 'S-19')?.status,
    ).toBe('terminated');
    expect(
      attempts(state)
        .filter((event) => event.copiedRecords > 0)
        .map((event) => event.minute),
    ).toEqual([875, 880, 885]);
  });

  it('sama blokada nowych logowań nie unieważnia aktywnego tunelu ani nie zatrzymuje odczytu', () => {
    const state = until(
      advance(
        schedule(study(), { type: 'block-account', accountId: 'magazyn-07' }),
      ),
      18,
    );
    expect(
      state.access.accounts.find((account) => account.id === 'magazyn-07')
        ?.loginStatus,
    ).toBe('blocked');
    expect(
      state.access.sessions.find((session) => session.id === 'S-19')?.status,
    ).toBe('active');
    expect(exposed(state)).toBe(2000);
    expect(state.hidden.attacker.authenticationAttempts).toBe(0);
  });

  it.each(['block-first', 'terminate-first'] as const)(
    'blokada konta i zakończenie tunelu zatrzymują ponowne użycie hasła (%s)',
    (order) => {
      let state = study();
      const block: TaskAction = {
        type: 'block-account',
        accountId: 'magazyn-07',
      };
      const end: TaskAction = { type: 'terminate-session', sessionId: 'S-19' };
      state = advance(schedule(state, order === 'block-first' ? block : end));
      state = advance(schedule(state, order === 'block-first' ? end : block));
      state = until(state, 18);
      expect(exposed(state)).toBe(0);
      expect(state.hidden.attacker.status).toBe('blocked');
      expect(state.hidden.attacker.authenticationAttempts).toBe(2);
      expect(
        attempts(state)
          .filter((event) => event.action === 'authenticate')
          .every((event) => event.outcome === 'authentication-rejected'),
      ).toBe(true);
      expect(
        state.access.sessions.some(
          (session) =>
            session.accountId === 'magazyn-07' && session.status === 'active',
        ),
      ).toBe(false);
    },
  );

  it('reset poświadczenia sam nie niszczy starej sesji, a przeciwnik nie poznaje nowej wersji', () => {
    const state = until(
      schedule(study(), { type: 'reset-credential', accountId: 'magazyn-07' }),
      18,
    );
    expect(
      state.access.accounts.find((account) => account.id === 'magazyn-07')
        ?.credentialVersion,
    ).toBe(2);
    expect(state.hidden.attacker.definition.stolenCredentialVersion).toBe(1);
    expect(exposed(state)).toBe(2000);
  });

  it('reset ukończony na granicy próby logowania odrzuca stare poświadczenie', () => {
    let state = terminate(study());
    state = until(
      schedule(state, { type: 'reset-credential', accountId: 'magazyn-07' }),
      4,
    );
    expect(
      state.access.accounts.find((account) => account.id === 'magazyn-07')
        ?.credentialVersion,
    ).toBe(2);
    expect(attempts(state).at(-1)).toMatchObject({
      turn: 4,
      action: 'authenticate',
      outcome: 'authentication-rejected',
    });
    expect(state.access.sessions.some((session) => session.id === 'S-20')).toBe(
      false,
    );
    state = until(state, 18);
    expect(state.hidden.attacker.definition.stolenCredentialVersion).toBe(1);
    expect(state.hidden.attacker.status).toBe('blocked');
    expect(exposed(state)).toBe(0);
  });

  it('wyłączenie VPN przerywa kolejne porcje oraz obniża wydajność biznesową', () => {
    let state = until(createInitialSimulation(), 4);
    expect(exposed(state)).toBe(400);
    state = advance(schedule(state, vpn(false)));
    expect(exposed(state)).toBe(400);
    expect(attempts(state).at(-1)?.outcome).toBe('session-lost');
    state = until(state, 18);
    expect(exposed(state)).toBe(400);
    expect(state.hidden.attacker.status).toBe('blocked');
    expect(state.business).toMatchObject({
      totalReceived: 360,
      totalProcessed: 204,
      backlog: 156,
    });
  });

  it('przywrócenie VPN nie odtwarza sesji napastnika przed zaplanowaną próbą logowania', () => {
    let state = advance(schedule(createInitialSimulation(), vpn(false)));
    state = advance(schedule(state, vpn(true)));
    expect(state.hidden.attacker.currentSessionId).toBeNull();
    expect(state.hidden.attacker.authenticationAttempts).toBe(0);
    state = advance(state);
    expect(
      state.access.sessions.some(
        (session) =>
          session.accountId === 'magazyn-07' && session.status === 'active',
      ),
    ).toBe(false);
    state = advance(state);
    expect(state.hidden.attacker.currentSessionId).toBe('S-20');
    expect(state.hidden.attacker.authenticationAttempts).toBe(1);
    expect(exposed(state)).toBe(0);
  });

  it('nie przejmuje cudzego aktywnego tunelu tego samego konta i nadaje świeżemu tunelowi wolny ID', () => {
    let state = terminate(study());
    const issued = issueVpnSession(
      state.world,
      state.access,
      { sessionId: 'S-20', accountId: 'magazyn-07', credentialVersion: 1 },
      currentMinute(state.clock),
    );
    expect(issued.ok).toBe(true);
    if (!issued.ok) throw new Error('Expected test session');
    state = until({ ...state, access: issued.access }, 4);
    expect(state.hidden.attacker.currentSessionId).toBe('S-21');
    expect(
      state.access.sessions.filter((session) => session.id === 'S-20'),
    ).toHaveLength(1);
    expect(state.hidden.sessionOrigins['S-21']).toBe('unauthorized');
  });
});

describe('warunki każdej porcji i ograniczona wiedza', () => {
  const conditions: readonly [
    string,
    (state: SimulationState) => SimulationState,
  ][] = [
    [
      'zakończona sesja',
      (state) => ({
        ...state,
        access: {
          ...state.access,
          sessions: state.access.sessions.map((session) =>
            session.id === 'S-19'
              ? { ...session, status: 'terminated' }
              : session,
          ),
        },
      }),
    ],
    [
      'wygaśnięcie na granicy',
      (state) => ({
        ...state,
        access: {
          ...state.access,
          sessions: state.access.sessions.map((session) =>
            session.id === 'S-19'
              ? { ...session, expiresAtMinute: 860 }
              : session,
          ),
        },
      }),
    ],
    [
      'brak sesji',
      (state) => ({
        ...state,
        access: {
          ...state.access,
          sessions: state.access.sessions.filter(
            (session) => session.id !== 'S-19',
          ),
        },
      }),
    ],
    [
      'nieprawidłowy właściciel tunelu',
      (state) => ({
        ...state,
        access: {
          ...state.access,
          sessions: state.access.sessions.map((session) =>
            session.id === 'S-19'
              ? { ...session, accountId: 'dispatch-team' }
              : session,
          ),
        },
      }),
    ],
    [
      'wyłączona brama',
      (state) => ({
        ...state,
        world: {
          ...state.world,
          assets: state.world.assets.map((asset) =>
            asset.id === 'vpn' ? { ...asset, status: 'offline' } : asset,
          ),
        },
      }),
    ],
    [
      'niedostępny serwer',
      (state) => ({
        ...state,
        world: {
          ...state.world,
          assets: state.world.assets.map((asset) =>
            asset.id === 'fs-01' ? { ...asset, status: 'offline' } : asset,
          ),
        },
      }),
    ],
    [
      'brak usługi SMB',
      (state) => ({
        ...state,
        world: {
          ...state.world,
          assets: state.world.assets.map((asset) =>
            asset.id === 'fs-01' ? { ...asset, protocols: [] } : asset,
          ),
        },
      }),
    ],
    [
      'brak topologii',
      (state) => ({
        ...state,
        world: {
          ...state.world,
          connections: state.world.connections.filter(
            (connection) => connection.id !== 'vpn-files',
          ),
        },
      }),
    ],
    [
      'brak dopuszczającej polityki',
      (state) => ({
        ...state,
        access: {
          ...state.access,
          rules: state.access.rules.filter((rule) => rule.id !== 'R-SMB'),
        },
      }),
    ],
    [
      'brak uprawnienia',
      (state) => ({
        ...state,
        access: {
          ...state.access,
          permissions: state.access.permissions.filter(
            (permission) => permission.accountId !== 'magazyn-07',
          ),
        },
      }),
    ],
  ];
  it.each(conditions)(
    'nie dostarcza porcji, gdy warunek przestaje działać: %s',
    (_name, change) => {
      const state = advance(change(until(createInitialSimulation(), 3)));
      expect(exposed(state)).toBe(0);
      expect(attempts(state).at(-1)?.copiedRecords).toBe(0);
      expect(['access-denied', 'session-lost']).toContain(
        attempts(state).at(-1)?.outcome,
      );
    },
  );

  it('nie poznaje zmiany reguły do następnej własnej próby i nie zna przyczyny odmowy', () => {
    let state = until(createInitialSimulation(), 3);
    const priorKnowledge = structuredClone(state.hidden.attacker.knowledge);
    const priorPlan = selectAttackerAction(state.hidden.attacker, 4);
    state = {
      ...state,
      access: {
        ...state.access,
        rules: state.access.rules.map((rule) =>
          rule.id === 'R-SMB' ? { ...rule, action: 'deny' } : rule,
        ),
      },
    };
    expect(state.hidden.attacker.knowledge).toEqual(priorKnowledge);
    expect(selectAttackerAction(state.hidden.attacker, 4)).toEqual(priorPlan);
    state = advance(state);
    expect(state.hidden.attacker.knowledge.lastAccess).toEqual({
      turn: 4,
      allowed: false,
    });
    const actorInformation = JSON.stringify(state.hidden.attacker);
    for (const detail of [
      'R-SMB',
      'permissions',
      'account-blocked',
      'invalid-credential',
    ])
      expect(actorInformation).not.toContain(detail);
  });

  it('odmowa po trzech nieudanych akcjach zatrzymuje próby, a backoff nie zależy od renderowania', () => {
    const state = until(schedule(createInitialSimulation(), smb('deny')), 18);
    expect(attempts(state).map((event) => event.turn)).toEqual([2, 4, 6]);
    expect(state.hidden.attacker).toMatchObject({
      status: 'blocked',
      consecutiveFailures: 3,
      nextAction: null,
    });
    for (let i = 0; i < 50; i += 1) selectPlayerView(state);
    expect(attempts(state)).toHaveLength(3);
  });
});

describe('niezmienność, granice i prywatność', () => {
  it('wykonuje najwyżej jedną akcję w turze, bez mutacji wejściowych encji', () => {
    const state = until(createInitialSimulation(), 3);
    const due = { ...state, clock: { ...state.clock, turn: 4 } };
    const before = structuredClone(due);
    const freeze = (value: unknown): void => {
      if (value && typeof value === 'object') {
        Object.freeze(value);
        Object.values(value).forEach(freeze);
      }
    };
    freeze(due);
    const once = stepAttacker(due);
    expect(exposed(once)).toBe(400);
    expect(stepAttacker(once)).toBe(once);
    expect(due).toEqual(before);
  });

  it('ogranicza ostatnią porcję do celu nawet przy większej zdefiniowanej porcji', () => {
    const initial = createInitialSimulation();
    const attacker = createInitialAttacker({
      ...nexusAttack,
      chunkSizes: [3000],
    });
    const state = until(
      { ...initial, hidden: { ...initial.hidden, attacker } },
      18,
    );
    expect(exposed(state)).toBe(2000);
    expect(
      attempts(state)
        .filter((event) => event.copiedRecords > 0)
        .map((event) => event.copiedRecords),
    ).toEqual([2000]);
  });

  it('nie przekracza limitu rekordów, nie cofa ujawnienia ani nie wykonuje akcji po końcu scenariusza', () => {
    const policies = [0, 1, 2, 3, 4, 5, 6];
    for (const commandTurn of policies) {
      let state = createInitialSimulation();
      let previous = 0;
      for (let turn = 0; turn < 18; turn += 1) {
        if (turn === commandTurn) state = schedule(state, smb('deny'));
        state = advance(state);
        expect(exposed(state)).toBeGreaterThanOrEqual(previous);
        expect(exposed(state)).toBeLessThanOrEqual(2000);
        expect(
          attempts(state).filter((event) => event.turn === state.clock.turn)
            .length,
        ).toBeLessThanOrEqual(1);
        previous = exposed(state);
      }
      const before = structuredClone(state.hidden);
      expect(advance(state).hidden).toEqual(before);
      expect(state.clock.turn).toBe(18);
    }
  });

  it('reset odtwarza również plan, wiedzę, licznik transferu i prywatną historię', () => {
    const final = until(createInitialSimulation(), 18);
    const reset = simulationReducer(final, { type: 'reset' });
    expect(exposed(final)).toBe(2000);
    expect(reset).toEqual(createInitialSimulation());
    expect(reset.hidden.attacker).not.toBe(final.hidden.attacker);
    expect(reset.hidden.attacker.privateHistory).toEqual([]);
    expect(reset.hidden.attacker.definition.chunkSizes).not.toBe(
      nexusAttack.chunkSizes,
    );
  });

  it('koniec okna ucina także aktywny plan, który dopiero czeka na pierwszą porcję', () => {
    const initial = createInitialSimulation();
    const attacker = createInitialAttacker({
      ...nexusAttack,
      firstReconnaissanceTurn: 17,
    });
    const state = until(
      { ...initial, hidden: { ...initial.hidden, attacker } },
      18,
    );
    expect(state.hidden.attacker).toMatchObject({
      status: 'active',
      nextAction: { kind: 'transfer', dueTurn: 19 },
    });
    expect(exposed(state)).toBe(0);
    expect(advance(state).hidden).toEqual(state.hidden);
    expect(advance(state).clock.turn).toBe(18);
  });

  it('identyczna sekwencja komend daje identyczną historię prywatną i wynik', () => {
    const commands: SimulationCommand[] = [
      {
        type: 'schedule-task',
        workerId: 'analyst',
        action: { type: 'inspect-vpn-sessions' },
      },
      { type: 'advance-turn' },
      {
        type: 'schedule-task',
        workerId: 'administrator',
        action: { type: 'terminate-session', sessionId: 'S-19' },
      },
      ...Array.from({ length: 17 }, (): SimulationCommand => ({
        type: 'advance-turn',
      })),
    ];
    const play = () =>
      commands.reduce(simulationReducer, createInitialSimulation());
    expect(play()).toEqual(play());
    expect(exposed(play())).toBe(2000);
  });

  it('bieżący widok i publiczna historia nie zawierają wyników ani zdarzeń napastnika, także po zakończeniu', () => {
    let state = createInitialSimulation();
    for (let turn = 0; turn <= 18; turn += 1) {
      const view = selectPlayerView(state);
      const publicInformation = JSON.stringify(view);
      for (const secret of [
        'nexus-data-theft',
        'attacker',
        'privateHistory',
        'exposedRecords',
        'records-copied',
        'authentication-accepted',
        'unauthorized',
        'S-19',
      ])
        expect(publicInformation).not.toContain(secret);
      if (turn < 18) state = advance(state);
    }
    expect(exposed(state)).toBe(2000);
    // Kontrfaktycznie inna prywatna prawda nie zmienia publicznego widoku.
    const alternate = {
      ...state,
      hidden: { ...state.hidden, attacker: createInitialAttacker(nexusAttack) },
    };
    expect(selectPlayerView(alternate)).toEqual(selectPlayerView(state));
  });

  it('ukończone badanie ujawnia neutralne pola nowego tunelu, lecz nie jego pochodzenie ani wynik transferu', () => {
    let state = until(terminate(study()), 4);
    expect(state.hidden.attacker.currentSessionId).toBe('S-20');
    expect(
      state.knowledge.sessionObservation?.sessions.some(
        (session) => session.id === 'S-20',
      ),
    ).toBe(false);
    state = advance(schedule(state, { type: 'inspect-vpn-sessions' }));
    const view = JSON.stringify(selectPlayerView(state));
    expect(view).toContain('S-20');
    for (const secret of [
      'unauthorized',
      'attacker',
      'exposedRecords',
      'reconnaissance-confirmed',
    ])
      expect(view).not.toContain(secret);
    expect(state.knowledge.sessionObservation?.observedAtMinute).toBe(865);
  });

  it.each([
    { retryDelayTurns: 0 },
    { chunkSizes: [] },
    { chunkSizes: [400] },
    { chunkSizes: [-1, 2001] },
  ])('odrzuca niespójne limity lub porcje scenariusza: %j', (override) => {
    expect(() =>
      createInitialAttacker({ ...nexusAttack, ...override }),
    ).toThrow('Invalid attack definition');
  });
});

describe('pełne ścieżki rozgrywki — ten sam stan początkowy, wyłącznie różne komendy', () => {
  it.each([
    {
      path: 'A — brak reakcji',
      blockTurn: null,
      expectedExposed: 2000,
      expectedStatus: 'completed',
    },
    {
      path: 'B — precyzyjna obrona SMB',
      blockTurn: 0,
      expectedExposed: 0,
      expectedStatus: 'blocked',
    },
    {
      path: 'C — spóźniona obrona SMB',
      blockTurn: 3,
      expectedExposed: 400,
      expectedStatus: 'blocked',
    },
  ])('$path', ({ path, blockTurn, expectedExposed, expectedStatus }) => {
    let state = createInitialSimulation();
    expect(state).toEqual(createInitialSimulation());
    for (let turn = 0; turn < 18; turn += 1) {
      if (turn === blockTurn) state = schedule(state, smb('deny'));
      state = advance(state);
    }
    expect(exposed(state)).toBe(expectedExposed);
    expect(state.hidden.attacker.status).toBe(expectedStatus);
    expect(state.business).toMatchObject({
      totalReceived: 360,
      totalProcessed: 360,
      backlog: 0,
    });
    expect(state.clock.turn).toBe(18);
    console.table([
      {
        path,
        turns: state.clock.turn,
        minute: currentMinute(state.clock),
        exposedRecords: exposed(state),
        processedOrders: state.business.totalProcessed,
        backlog: state.business.backlog,
        attackerStatus: state.hidden.attacker.status,
      },
    ]);
  });
});
