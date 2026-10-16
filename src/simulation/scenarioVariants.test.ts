import { describe, expect, it } from 'vitest';
import { createScenarioRun } from '../application/scenarioSelectors';
import { selectPlayerView } from '../application/selectPlayerView';
import { selectMissionReport } from '../application/selectMissionReport';
import { simulationReducer } from '../application/simulationReducer';
import type { SimulationState, TaskAction } from '../domain/simulation';
import { businessAvailability } from './business';
import { canUseService } from './access';
import {
  detectVpnAlerts,
  availableAuthenticationRecords,
  updateTelemetry,
} from './telemetry';
import { updateNarrative } from './narrative';
import { taskSpecs } from './tasks';

const advance = (state: SimulationState) =>
  simulationReducer(state, { type: 'advance-turn' });
function until(state: SimulationState, turn: number) {
  while (state.clock.turn < turn) state = advance(state);
  return state;
}
function schedule(state: SimulationState, action: TaskAction) {
  return simulationReducer(state, {
    type: 'schedule-task',
    workerId: taskSpecs[action.type].workerId,
    action,
  });
}
const logs: TaskAction = { type: 'inspect-auth-logs' };
const contact: TaskAction = {
  type: 'contact-account-owner',
  accountId: 'magazyn-07',
};
const smb: TaskAction = {
  type: 'set-network-rule',
  ruleId: 'R-SMB',
  action: 'deny',
};
const block: TaskAction = { type: 'block-account', accountId: 'magazyn-07' };

export type VariantPolicy =
  | 'observe'
  | 'always-smb'
  | 'block-logins'
  | 'investigate';
/** Polityka investigate używa tylko uzyskanych dowodów, nie identyfikatora wariantu. */
export function playVariant(
  seed: number,
  policy: VariantPolicy,
): SimulationState {
  let state = createScenarioRun('unknown', seed);
  if (policy === 'always-smb') state = schedule(state, smb);
  if (policy === 'block-logins') state = schedule(state, block);
  if (policy === 'investigate') {
    state = advance(schedule(state, logs));
    state = advance(schedule(state, contact));
    const owner = state.knowledge.ownerStatements.at(-1)!;
    const accountLogins = state.knowledge.authObservations
      .at(-1)!
      .records.filter(
        (record) =>
          record.accountId === owner.accountId && record.outcome === 'success',
      );
    if (!owner.text.includes('laptopa zastępczego')) {
      const sessionId = accountLogins.at(-1)?.sessionId;
      if (sessionId)
        state = advance(
          schedule(state, { type: 'terminate-session', sessionId }),
        );
      state = schedule(state, block);
    }
  }
  return until(state, 18);
}

describe('podobny alert i rozróżnialne dowody', () => {
  it('trzy warianty generują identyczny alert, a A i B mają nawet identyczne początkowe logi', () => {
    const states = [0, 1, 2].map((seed) => createScenarioRun('unknown', seed));
    expect(states[0]!.incident.alerts).toEqual(states[1]!.incident.alerts);
    expect(states[1]!.incident.alerts).toEqual(states[2]!.incident.alerts);
    expect(states[0]!.telemetry.sourceEvents).toEqual(
      states[1]!.telemetry.sourceEvents,
    );
    for (const state of states) {
      const records = availableAuthenticationRecords(state.telemetry, 840);
      expect(detectVpnAlerts(records, 840, [])).toEqual(state.incident.alerts);
      expect(state.incident.alerts[0]?.failureCount).toBe(52);
    }
  });

  it.each([0, 1, 2])(
    'wariant %i: relacja właścicielki pochodzi z konfiguracji i pojawia się dopiero po zadaniu',
    (seed) => {
      const state = createScenarioRun('unknown', seed);
      const started = schedule(state, contact);
      expect(started.knowledge.ownerStatements).toEqual([]);
      const done = advance(started);
      expect(done.knowledge.ownerStatements[0]).toMatchObject({
        ...state.hidden.scenario.witnesses[0],
        kind: 'human-statement',
        observedAtMinute: 845,
      });
      expect(
        done.incident.messages.find((message) => message.speaker === 'Marta')
          ?.text,
      ).toBe(state.hidden.scenario.witnesses[0]?.text);
    },
  );

  it('relacje A/B/C różnią się faktami, a C nie pokazuje sukcesu lub tunelu S-19', () => {
    const states = [0, 1, 2].map((seed) =>
      advance(schedule(createScenarioRun('unknown', seed), contact)),
    );
    expect(
      new Set(states.map((state) => state.knowledge.ownerStatements[0]?.text))
        .size,
    ).toBe(3);
    expect(states[1]!.knowledge.ownerStatements[0]?.text).toContain(
      'laptopa zastępczego',
    );
    const c = advance(schedule(states[2]!, logs));
    expect(
      c.knowledge.authObservations[0]?.records.some(
        (record) => record.sessionId === 'S-19',
      ),
    ).toBe(false);
    expect(c.clock.turn).toBe(2);
    expect(
      c.access.sessions.some((session) => session.accountId === 'magazyn-07'),
    ).toBe(false);
  });

  it.each([0, 1, 2])(
    'wariant %i: tryb nieznany nie ujawnia typu, planu lub prywatnej prawdy przez 17 tur',
    (seed) => {
      let state = simulationReducer(
        schedule(createScenarioRun('unknown', seed), logs),
        { type: 'set-hypothesis', hypothesis: 'unusual-legitimate-session' },
      );
      for (let turn = 0; turn < 18; turn += 1) {
        const view = selectPlayerView(state);
        // Wartość jawnej hipotezy nie jest prywatnym typem scenariusza.
        const text = JSON.stringify(view).replaceAll(
          'unusual-legitimate-session',
          'public-hypothesis',
        );
        expect(view.run).toEqual({ mode: 'unknown', seed });
        expect(selectMissionReport(state)).toBeNull();
        for (const secret of [
          'nexus-reference',
          'nexus-legitimate',
          'nexus-stolen-credential',
          'legitimate-session',
          'stolen-credential',
          'unauthorized-session',
          'hidden',
          'attacker',
          'sessionOrigins',
          'firstAuthenticationTurn',
          'exposedRecords',
          'isMalicious',
        ])
          expect(text).not.toContain(secret);
        const alternate = {
          ...state,
          hidden: {
            ...state.hidden,
            scenario: {
              ...state.hidden.scenario,
              id: 'secret-id',
              name: 'secret-name',
              kind: 'legitimate-session' as const,
            },
            sessionOrigins: {},
            attacker: null,
          },
        };
        expect(selectPlayerView(alternate)).toEqual(view);
        expect(updateTelemetry(alternate).incident.alerts).toEqual(
          state.incident.alerts,
        );
        expect(updateNarrative(alternate).incident.messages).toEqual(
          updateNarrative(state).incident.messages,
        );
        state = advance(state);
      }
      expect(selectMissionReport(state)?.scenario.id).toBe(
        state.hidden.scenario.id,
      );
    },
  );
});

describe('uzyskanie nowego tunelu i warunki każdej porcji', () => {
  it('C czeka do 14:15, tworzy S-20 przez logowanie, a dane kopiuje dopiero w następnych etapach', () => {
    let state = until(createScenarioRun('unknown', 2), 2);
    expect(state.hidden.attacker?.privateHistory).toEqual([]);
    expect(state.access.sessions.some((session) => session.id === 'S-20')).toBe(
      false,
    );
    state = advance(state);
    expect(state.hidden.attacker?.privateHistory).toMatchObject([
      {
        minute: 855,
        outcome: 'authentication-accepted',
        copiedRecords: 0,
        sessionId: 'S-20',
      },
    ]);
    expect(
      state.access.sessions.find((session) => session.id === 'S-20'),
    ).toMatchObject({ accountId: 'magazyn-07', startedAtMinute: 855 });
    expect(state.telemetry.sourceEvents.at(-1)).toMatchObject({
      minute: 855,
      outcome: 'success',
      sessionId: 'S-20',
    });
    expect(until(state, 5).hidden.attacker?.transfer.exposedRecords).toBe(0);
    const final = until(state, 18);
    expect(
      final.hidden.attacker?.privateHistory
        .filter((event) => event.copiedRecords > 0)
        .map((event) => [event.minute, event.copiedRecords]),
    ).toEqual([
      [870, 400],
      [875, 800],
      [880, 800],
    ]);
  });

  it.each([
    ['blokada konta', block],
    [
      'reset wersji',
      { type: 'reset-credential', accountId: 'magazyn-07' } as const,
    ],
    [
      'wyłączenie usługi',
      { type: 'set-vpn', assetId: 'vpn', enabled: false } as const,
    ],
  ])(
    'C: %s przed pierwszą próbą uniemożliwia uzyskanie tunelu',
    (_, action) => {
      const state = until(
        schedule(createScenarioRun('unknown', 2), action),
        18,
      );
      expect(state.hidden.attacker?.currentSessionId).toBeNull();
      expect(state.hidden.attacker?.transfer.exposedRecords).toBe(0);
      expect(state.hidden.attacker?.authenticationAttempts).toBe(3);
      expect(state.hidden.attacker?.definition.stolenCredentialVersion).toBe(1);
      expect(
        state.access.sessions.some((session) => session.id === 'S-20'),
      ).toBe(false);
      expect(
        state.hidden.attacker?.privateHistory.map((event) => event.turn),
      ).toEqual([3, 5, 7]);
    },
  );

  it('C: blokada ukończona dokładnie o 14:15 wyprzedza pierwsze logowanie', () => {
    const state = advance(
      schedule(until(createScenarioRun('unknown', 2), 2), block),
    );
    expect(state.clock.turn).toBe(3);
    expect(state.hidden.attacker?.privateHistory[0]?.outcome).toBe(
      'authentication-rejected',
    );
  });

  const losses: readonly [
    string,
    (state: SimulationState) => SimulationState,
  ][] = [
    [
      'sesja',
      (s) => ({
        ...s,
        access: {
          ...s.access,
          sessions: s.access.sessions.map((x) =>
            x.id === 'S-20' ? { ...x, status: 'terminated' } : x,
          ),
        },
      }),
    ],
    [
      'ważność',
      (s) => ({
        ...s,
        access: {
          ...s.access,
          sessions: s.access.sessions.map((x) =>
            x.id === 'S-20' ? { ...x, expiresAtMinute: 875 } : x,
          ),
        },
      }),
    ],
    [
      'reguła SMB',
      (s) => ({
        ...s,
        access: {
          ...s.access,
          rules: s.access.rules.map((r) =>
            r.id === 'R-SMB' ? { ...r, action: 'deny' } : r,
          ),
        },
      }),
    ],
    [
      'uprawnienie',
      (s) => ({
        ...s,
        access: {
          ...s.access,
          permissions: s.access.permissions.filter(
            (p) => p.accountId !== 'magazyn-07',
          ),
        },
      }),
    ],
    [
      'serwer',
      (s) => ({
        ...s,
        world: {
          ...s.world,
          assets: s.world.assets.map((a) =>
            a.id === 'fs-01' ? { ...a, status: 'offline' } : a,
          ),
        },
      }),
    ],
    [
      'topologia',
      (s) => ({
        ...s,
        world: {
          ...s.world,
          connections: s.world.connections.filter((c) => c.id !== 'vpn-files'),
        },
      }),
    ],
    [
      'protokół',
      (s) => ({
        ...s,
        world: {
          ...s.world,
          assets: s.world.assets.map((a) =>
            a.id === 'fs-01' ? { ...a, protocols: [] } : a,
          ),
        },
      }),
    ],
  ];
  it.each(losses)(
    'C: brak warunku %s zatrzymuje następną porcję, zachowując pierwsze 400',
    (_, remove) => {
      const first = until(createScenarioRun('unknown', 2), 6);
      expect(first.hidden.attacker?.transfer.exposedRecords).toBe(400);
      const next = advance(remove(first));
      expect(next.hidden.attacker?.transfer.exposedRecords).toBe(400);
      expect(next.hidden.attacker?.privateHistory.at(-1)?.copiedRecords).toBe(
        0,
      );
    },
  );
});

describe('legalne zależności i raport bez nieistniejącego przeciwnika', () => {
  it('tymczasowe SMB do wyczerpania prób nie spełnia celu ograniczenia po ponownym otwarciu', () => {
    const state = until(
      schedule(until(schedule(createScenarioRun('unknown', 2), smb), 8), {
        type: 'set-network-rule',
        ruleId: 'R-SMB',
        action: 'allow',
      }),
      18,
    );
    const report = selectMissionReport(state)!;
    expect(report.confidentiality.exposedRecords).toBe(0);
    expect(report.continuity).toMatchObject({
      processed: 344,
      backlog: 16,
      goalMet: true,
    });
    expect(report.containment).toMatchObject({
      required: true,
      goalMet: false,
      stoppedOnlyByRetryBudget: true,
      targetAccessCutOff: false,
    });
  });
  it.each([1, 2])(
    'wariant %i: SMB zmienia 22 → 16, a HTTPS pozostaje dostępny',
    (seed) => {
      const state = createScenarioRun('unknown', seed);
      expect(businessAvailability(state).capacity).toBe(22);
      const changed = until(schedule(state, smb), 2);
      expect(businessAvailability(changed)).toMatchObject({
        capacity: 16,
        remoteAvailable: true,
        contributions: [{ available: false, capacity: 6 }],
      });
      expect(
        canUseService(
          changed.world,
          changed.access,
          'B-01',
          'erp',
          'HTTPS',
          850,
        ),
      ).toBe(true);
      const settled = advance(changed);
      expect(settled.business.lastReport).toMatchObject({
        capacity: 16,
        received: 20,
        processed: 16,
        backlog: 4,
      });
      expect(
        settled.incident.messages.some((message) => message.id === 'ewa-files'),
      ).toBe(true);
    },
  );

  it('brak legalnego uprawnienia lub tunelu odbiera część 6 bez zmiany reguły SMB', () => {
    const state = createScenarioRun('unknown', 2);
    const noPermission = {
      ...state,
      access: {
        ...state.access,
        permissions: state.access.permissions.filter(
          (permission) =>
            !(
              permission.accountId === 'file-team' &&
              permission.protocol === 'SMB'
            ),
        ),
      },
    };
    const noSession = {
      ...state,
      access: {
        ...state.access,
        sessions: state.access.sessions.filter(
          (session) => session.id !== 'F-01',
        ),
      },
    };
    expect(businessAvailability(noPermission).capacity).toBe(16);
    expect(businessAvailability(noSession).capacity).toBe(16);
    expect(state.access.rules.find((rule) => rule.id === 'R-SMB')?.action).toBe(
      'allow',
    );
  });

  it('B: zakończenie legalnej sesji uruchamia jawne ponowne logowanie, nie proces ataku', () => {
    let state = advance(schedule(createScenarioRun('unknown', 1), logs));
    state = advance(
      schedule(state, { type: 'terminate-session', sessionId: 'S-19' }),
    );
    expect(state.hidden.attacker).toBeNull();
    expect(
      state.access.sessions.some((session) => session.id === 'M-reconnect-03'),
    ).toBe(false);
    state = advance(state);
    expect(
      state.access.sessions.find((session) => session.id === 'M-reconnect-03'),
    ).toMatchObject({ accountId: 'magazyn-07', status: 'active' });
    expect(state.hidden.sessionOrigins['M-reconnect-03']).toBe('legitimate');
    expect(state.telemetry.sourceEvents.at(-1)?.sessionId).toBe(
      'M-reconnect-03',
    );
    const report = selectMissionReport(until(state, 18))!;
    expect(report.legitimateActivity.reducedCapacityTurns).toBe(1);
    expect(report.confidentiality.events).toEqual([]);
  });

  it('B: blokada konta i zakończenie S-19 ograniczają legalne dokumenty — 64 zaległe', () => {
    let state = advance(
      schedule(schedule(createScenarioRun('unknown', 1), logs), block),
    );
    state = until(
      schedule(state, { type: 'terminate-session', sessionId: 'S-19' }),
      18,
    );
    expect(state.business).toMatchObject({
      totalReceived: 360,
      totalProcessed: 296,
      backlog: 64,
    });
    expect(state.hidden.attacker).toBeNull();
    expect(
      selectMissionReport(state)?.legitimateActivity.restrictedAccounts,
    ).toContain('magazyn-07');
  });

  it('B: raport nie wymyśla transferu, przejętego hasła, pokonanego napastnika ani budżetu prób', () => {
    const state = playVariant(1, 'always-smb');
    const report = selectMissionReport(state)!;
    expect(report.scenario.kind).toBe('legitimate-session');
    expect(report.confidentiality).toMatchObject({
      exposedRecords: 0,
      attackerStatus: null,
      events: [],
    });
    expect(report.containment).toMatchObject({
      applicable: false,
      retryBudgetExhausted: false,
      stoppedOnlyByRetryBudget: false,
      accountContained: false,
    });
    expect(report.legitimateActivity).toMatchObject({
      reducedCapacityTurns: 16,
      initialFailureCount: 52,
    });
    expect(report.moments[0]?.impact).toMatchObject({
      remoteCapacityBefore: 22,
      remoteCapacityAfter: 16,
    });
    expect(state.telemetry.sourceEvents).toHaveLength(54);
  });
});

describe('pełne 18 tur — porównanie stałych i opartych na dowodach strategii', () => {
  const expected: readonly [number, VariantPolicy, number, number, number][] = [
    [0, 'observe', 2000, 360, 0],
    [1, 'observe', 0, 360, 0],
    [2, 'observe', 2000, 360, 0],
    [0, 'always-smb', 0, 360, 0],
    [1, 'always-smb', 0, 296, 64],
    [2, 'always-smb', 0, 296, 64],
    [0, 'block-logins', 2000, 360, 0],
    [1, 'block-logins', 0, 360, 0],
    [2, 'block-logins', 0, 360, 0],
    [0, 'investigate', 0, 360, 0],
    [1, 'investigate', 0, 360, 0],
    [2, 'investigate', 0, 360, 0],
  ];
  it.each(expected)(
    'seed %i / %s → ujawnione %i, obsłużone %i, zaległe %i',
    (seed, policy, exposed, processed, backlog) => {
      const state = playVariant(seed, policy);
      const report = selectMissionReport(state)!;
      expect(state.clock.turn).toBe(18);
      expect(report.confidentiality.exposedRecords).toBe(exposed);
      expect(report.continuity).toMatchObject({
        received: 360,
        processed,
        backlog,
        goalMet: backlog <= 40,
      });
      expect(state.business.totalReceived - state.business.totalProcessed).toBe(
        state.business.backlog,
      );
      expect(state.business.backlog).toBe(backlog);
      expect(playVariant(seed, policy)).toEqual(state);
      if (seed !== 1)
        expect(report.confidentiality.exposedRecords).toBe(
          state.hidden.attacker?.transfer.exposedRecords,
        );
      else expect(state.hidden.attacker).toBeNull();
      console.table([
        {
          seed,
          variant: report.scenario.kind,
          policy,
          exposed: report.confidentiality.exposedRecords,
          received: report.continuity.received,
          processed: report.continuity.processed,
          backlog: report.continuity.backlog,
          reducedCapacityTurns: report.legitimateActivity.reducedCapacityTurns,
        },
      ]);
    },
  );
});
