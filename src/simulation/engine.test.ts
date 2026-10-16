import { describe, expect, it } from 'vitest';
import { createInitialSimulation } from '../application/createInitialSimulation';
import { selectPlayerView } from '../application/selectPlayerView';
import { simulationReducer } from '../application/simulationReducer';
import type {
  SimulationCommand,
  ReferenceSimulationState as SimulationState,
  TaskAction,
} from '../domain/simulation';
import { canUseService, issueVpnSession } from './access';
import { businessAvailability } from './business';
import { currentMinute } from './clock';
import { taskSpecs } from './tasks';

const advance = (state: SimulationState) =>
  simulationReducer(state, { type: 'advance-turn' });
const run = (state: SimulationState, turns: number) =>
  Array.from({ length: turns }).reduce<SimulationState>(
    (value) => advance(value),
    state,
  );
const schedule = (state: SimulationState, action: TaskAction) =>
  simulationReducer(state, {
    type: 'schedule-task',
    workerId: taskSpecs[action.type].workerId,
    action,
  });
const vpnAction = (enabled: boolean): TaskAction => ({
  type: 'set-vpn',
  assetId: 'vpn',
  enabled,
});
const observe = () =>
  advance(
    schedule(createInitialSimulation(), { type: 'inspect-vpn-sessions' }),
  );

function offline(state: SimulationState, assetId: string): SimulationState {
  return {
    ...state,
    world: {
      ...state.world,
      assets: state.world.assets.map((asset) =>
        asset.id === assetId ? { ...asset, status: 'offline' } : asset,
      ),
    },
  };
}

function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
}

describe('czas i bilans działalności', () => {
  it('18 tur to 90 minut i 360 obsłużonych zamówień bez bankowania wydajności', () => {
    let state = createInitialSimulation();
    for (let turn = 1; turn <= 18; turn += 1) {
      state = advance(state);
      expect(state.business).toMatchObject({
        totalReceived: turn * 20,
        totalProcessed: turn * 20,
        backlog: 0,
      });
      expect(state.business.lastReport).toMatchObject({
        received: 20,
        processed: 20,
        capacity: 22,
      });
    }
    expect(currentMinute(state.clock)).toBe(15 * 60 + 30);
    expect(state.history.at(-1)).toMatchObject({
      kind: 'simulation-finished',
      success: true,
    });
  });

  it('odczyt i planowanie nie przesuwają czasu ani nie zmieniają stanu wejściowego', () => {
    const state = createInitialSimulation();
    const before = structuredClone(state);
    freezeDeep(state);
    for (let i = 0; i < 100; i += 1) {
      expect(selectPlayerView(state).minute).toBe(840);
      expect(businessAvailability(state).capacity).toBe(22);
    }
    const planned = schedule(state, vpnAction(false));
    expect(planned.clock.turn).toBe(0);
    expect(state).toEqual(before);
    expect(() => advance(planned)).not.toThrow();
  });

  it('zmiana o 14:15 nie wpływa wstecznie na przedział 14:10–14:15', () => {
    let state = advance(schedule(createInitialSimulation(), vpnAction(false)));
    expect(state.business.lastReport?.processed).toBe(20);
    expect(businessAvailability(state).capacity).toBe(8);
    state = advance(state);
    expect(state.business.backlog).toBe(12);
    state = advance(schedule(state, vpnAction(true)));
    expect(currentMinute(state.clock)).toBe(855);
    expect(state.business.lastReport).toMatchObject({
      processed: 8,
      backlog: 24,
      remoteAvailable: false,
    });
    expect(businessAvailability(state).capacity).toBe(22);
    expect(advance(state).business.lastReport).toMatchObject({
      processed: 22,
      backlog: 22,
    });
  });

  it('6 początkowych tur bez VPN daje 72 zaległości, a 12 kolejnych sprawnych tur kończy się 48', () => {
    let state = offline(createInitialSimulation(), 'vpn');
    state = run(state, 5);
    state = advance(schedule(state, vpnAction(true)));
    expect(state.business.backlog).toBe(72);
    state = run(state, 12);
    expect(state.business).toMatchObject({
      totalReceived: 360,
      totalProcessed: 312,
      backlog: 48,
    });
    expect(state.history.at(-1)).toMatchObject({
      kind: 'simulation-finished',
      success: false,
    });
  });

  it('ERP niedostępny zatrzymuje oba kanały; samo przywrócenie VPN nie naprawia ERP', () => {
    let state = offline(offline(createInitialSimulation(), 'erp'), 'vpn');
    state = advance(schedule(state, vpnAction(true)));
    expect(businessAvailability(state).capacity).toBe(0);
    expect(advance(state).business.lastReport).toMatchObject({
      processed: 0,
      backlog: 40,
    });
  });

  it('brak HTTPS po zmianie reguły ogranicza pracę, lecz SMB pozostaje osobnym przepływem', () => {
    let state = schedule(createInitialSimulation(), {
      type: 'set-network-rule',
      ruleId: 'R-ERP',
      action: 'deny',
    });
    state = advance(state);
    expect(businessAvailability(state).capacity).toBe(22);
    state = advance(state);
    expect(state.business.totalProcessed).toBe(40);
    expect(businessAvailability(state).capacity).toBe(8);
    expect(
      canUseService(
        state.world,
        state.access,
        'S-19',
        'fs-01',
        'SMB',
        currentMinute(state.clock),
      ),
    ).toBe(true);
    expect(advance(state).business.backlog).toBe(12);
  });

  it('nie produkuje ujemnej kolejki, nadmiarowych zamówień ani dziewiętnastej tury', () => {
    let state = createInitialSimulation();
    for (let turn = 0; turn < 28; turn += 1) {
      if (turn === 1) state = schedule(state, vpnAction(false));
      if (turn === 7) state = schedule(state, vpnAction(true));
      state = advance(state);
      expect(state.clock.turn).toBeLessThanOrEqual(18);
      expect(state.business.backlog).toBeGreaterThanOrEqual(0);
      expect(state.business.totalProcessed).toBeLessThanOrEqual(
        state.business.totalReceived,
      );
      expect(state.business.backlog + state.business.totalProcessed).toBe(
        state.business.totalReceived,
      );
      expect(state.business.totalReceived).toBeLessThanOrEqual(360);
    }
    expect(state.history.at(-1)).toMatchObject({
      kind: 'command-rejected',
      reason: 'simulation-finished',
    });
  });

  it.each([40, 41])(
    'ocenia dokładną granicę celu: %i zaległości na koniec',
    (finalBacklog) => {
      const base = run(createInitialSimulation(), 17);
      const backlog = finalBacklog + 2;
      const state = advance({
        ...base,
        business: {
          ...base.business,
          backlog,
          totalProcessed: base.business.totalReceived - backlog,
        },
      });
      expect(state.business.backlog).toBe(finalBacklog);
      expect(state.history.at(-1)).toMatchObject({
        kind: 'simulation-finished',
        success: finalBacklog <= 40,
      });
    },
  );
});

describe('zadania i granice tury', () => {
  it('odrzuca pracę zajętego administratora, ale dopuszcza równoległego analityka', () => {
    const first = schedule(createInitialSimulation(), vpnAction(false));
    const rejected = schedule(first, {
      type: 'set-network-rule',
      ruleId: 'R-SMB',
      action: 'deny',
    });
    expect(rejected.tasks).toHaveLength(1);
    expect(rejected.history.at(-1)).toMatchObject({
      kind: 'command-rejected',
      reason: 'worker-busy',
    });
    expect(
      schedule(first, { type: 'inspect-vpn-sessions' }).tasks,
    ).toHaveLength(2);
    expect(first.world.assets.find((asset) => asset.id === 'vpn')?.status).toBe(
      'online',
    );
  });

  it('nie przydziela analitykowi drugiego badania przed ukończeniem pierwszego', () => {
    const state = schedule(createInitialSimulation(), {
      type: 'inspect-vpn-sessions',
    });
    const rejected = schedule(state, { type: 'inspect-vpn-sessions' });
    expect(rejected.tasks).toHaveLength(1);
    expect(rejected.history.at(-1)).toMatchObject({
      kind: 'command-rejected',
      reason: 'worker-busy',
    });
  });

  it('reset poświadczenia trwa dwie tury i nie niszczy aktywnej sesji', () => {
    const initial = observe();
    const started = schedule(initial, {
      type: 'reset-credential',
      accountId: 'magazyn-07',
    });
    const midway = advance(started);
    expect(midway.access.accounts[0]?.credentialVersion).toBe(1);
    const done = advance(midway);
    expect(done.access.accounts[0]?.credentialVersion).toBe(2);
    expect(
      canUseService(
        done.world,
        done.access,
        'S-19',
        'fs-01',
        'SMB',
        currentMinute(done.clock),
      ),
    ).toBe(true);
    expect(
      issueVpnSession(
        done.world,
        done.access,
        { sessionId: 'attempt', accountId: 'magazyn-07', credentialVersion: 1 },
        currentMinute(done.clock),
      ),
    ).toMatchObject({ ok: false, reason: 'invalid-credential' });
  });

  it('blokada konta pozostawia tunel, a zakończenie tunelu nie blokuje konta', () => {
    const state = observe();
    const blocked = advance(
      schedule(state, { type: 'block-account', accountId: 'magazyn-07' }),
    );
    expect(blocked.access.accounts[0]?.loginStatus).toBe('blocked');
    expect(blocked.access.sessions[0]?.status).toBe('active');
    const terminated = advance(
      schedule(state, { type: 'terminate-session', sessionId: 'S-19' }),
    );
    expect(terminated.access.sessions[0]?.status).toBe('terminated');
    expect(terminated.access.accounts[0]?.loginStatus).toBe('enabled');
    expect(
      issueVpnSession(
        terminated.world,
        terminated.access,
        { sessionId: 'new', accountId: 'magazyn-07', credentialVersion: 1 },
        currentMinute(terminated.clock),
      ).ok,
    ).toBe(true);
  });

  it('wyłącza tunele i przywraca tylko legalny zespół po włączeniu bramy', () => {
    let state = advance(schedule(createInitialSimulation(), vpnAction(false)));
    expect(
      state.access.sessions.every((session) => session.status === 'terminated'),
    ).toBe(true);
    state = advance(schedule(state, vpnAction(true)));
    expect(
      state.access.sessions.find((session) => session.id === 'S-19')?.status,
    ).toBe('terminated');
    expect(
      state.access.sessions.some(
        (session) =>
          session.accountId === 'dispatch-team' && session.status === 'active',
      ),
    ).toBe(true);
    expect(businessAvailability(state).capacity).toBe(22);
  });

  it('legalny zespół nie obchodzi blokady konta podczas ponownego logowania', () => {
    let state = advance(
      schedule(observe(), {
        type: 'block-account',
        accountId: 'dispatch-team',
      }),
    );
    expect(businessAvailability(state).capacity).toBe(22);
    state = advance(schedule(state, vpnAction(false)));
    state = advance(schedule(state, vpnAction(true)));
    expect(businessAvailability(state).capacity).toBe(8);
  });

  it('zmiana administracyjna wyprzedza obserwację na tej samej granicy czasu', () => {
    let state = schedule(createInitialSimulation(), {
      type: 'inspect-vpn-sessions',
    });
    state = advance(schedule(state, vpnAction(false)));
    expect(state.knowledge.sessionObservation).toBeNull();
    const events = state.history.filter((event) => event.minute === 845);
    expect(events[0]?.kind).toBe('business-report');
    expect(
      events.findIndex((event) => event.kind === 'configuration-changed'),
    ).toBeLessThan(
      events.findIndex((event) => event.kind === 'research-unavailable'),
    );
  });

  it('waliduje wykonawcę, cele, nieznane komendy i czas zakończenia pracy', () => {
    const state = createInitialSimulation();
    const commands: [SimulationCommand, string][] = [
      [
        {
          type: 'schedule-task',
          workerId: 'analyst',
          action: vpnAction(false),
        },
        'wrong-worker',
      ],
      [
        {
          type: 'schedule-task',
          workerId: 'administrator',
          action: { type: 'set-vpn', assetId: 'erp', enabled: false },
        },
        'unknown-target',
      ],
      [
        {
          type: 'schedule-task',
          workerId: 'administrator',
          action: { type: 'terminate-session', sessionId: 'S-19' },
        },
        'target-not-observed',
      ],
      [
        {
          type: 'schedule-task',
          workerId: 'analyst',
          action: { type: 'inspect-auth-logs' },
        },
        'source-unavailable',
      ],
      [
        { type: 'unexpected' } as unknown as SimulationCommand,
        'invalid-command',
      ],
      [
        {
          type: 'schedule-task',
          workerId: 'administrator',
          action: null,
        } as unknown as SimulationCommand,
        'invalid-command',
      ],
    ];
    for (const [command, reason] of commands) {
      // Od 4B źródło istnieje domyślnie; ten sam przypadek nadal sprawdza jego brak.
      const input =
        reason === 'source-unavailable'
          ? {
              ...state,
              telemetry: {
                ...state.telemetry,
                authenticationSensor: {
                  ...state.telemetry.authenticationSensor,
                  enabled: false,
                },
              },
            }
          : state;
      const result = simulationReducer(input, command);
      expect(result.tasks).toHaveLength(0);
      expect(result.history.at(-1)).toMatchObject({
        kind: 'command-rejected',
        reason,
      });
      expect(result.clock.turn).toBe(0);
    }
    const late = run(state, 17);
    expect(
      schedule(late, {
        type: 'set-network-rule',
        ruleId: 'R-SMB',
        action: 'deny',
      }).history.at(-1),
    ).toMatchObject({ reason: 'outside-time-window' });
  });
});

describe('wiedza, deterministyczność i restart', () => {
  it('ujawnia konto wskazane przez alert, lecz sesje dopiero po badaniu, bez pochodzenia i wersji hasła', () => {
    const initial = createInitialSimulation();
    const publicBefore = JSON.stringify(selectPlayerView(initial));
    expect(publicBefore).not.toContain('S-19');
    expect(selectPlayerView(initial).alerts[0]?.accountId).toBe('magazyn-07');
    expect(initial.knowledge.authObservations).toEqual([]);
    const after = observe();
    const publicAfter = JSON.stringify(selectPlayerView(after));
    expect(publicAfter).toContain('S-19');
    for (const secret of [
      'unauthorized',
      'sessionOrigins',
      'credentialVersion',
      'mfaPolicy',
      'loginStatus',
    ])
      expect(publicAfter).not.toContain(secret);
    expect(after.knowledge.sessionObservation?.observedAtMinute).toBe(845);
    expect(initial.knowledge.sessionObservation).toBeNull();
  });

  it('zachowuje czas pozyskania obserwacji, zamiast aktualizować ją magicznie po logowaniu', () => {
    let state = observe();
    const snapshot = state.knowledge.sessionObservation;
    state = advance(schedule(state, vpnAction(false)));
    state = advance(schedule(state, vpnAction(true)));
    expect(state.knowledge.sessionObservation).toEqual(snapshot);
    expect(state.access.sessions.length).toBeGreaterThan(
      snapshot!.sessions.length,
    );
  });

  it('ta sama sekwencja komend daje identyczne stany, zadania i historię', () => {
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
        action: { type: 'set-network-rule', ruleId: 'R-SMB', action: 'deny' },
      },
      { type: 'advance-turn' },
      { type: 'advance-turn' },
      {
        type: 'schedule-task',
        workerId: 'administrator',
        action: vpnAction(false),
      },
      { type: 'advance-turn' },
      { type: 'advance-turn' },
    ];
    const play = () =>
      commands.reduce(simulationReducer, createInitialSimulation());
    expect(play()).toEqual(play());
  });

  it('reset odtwarza stan początkowy i nie współdzieli zagnieżdżonych danych', () => {
    const played = run(advance(schedule(observe(), vpnAction(false))), 17);
    const reset = simulationReducer(played, { type: 'reset' });
    const initial = createInitialSimulation();
    expect(reset).toEqual(initial);
    expect(reset.access.accounts).not.toBe(initial.access.accounts);
    expect(reset.world.assets).not.toBe(initial.world.assets);
    expect(reset.hidden).not.toBe(initial.hidden);
  });
});
