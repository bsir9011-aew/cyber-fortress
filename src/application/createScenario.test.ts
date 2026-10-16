import { describe, expect, it } from 'vitest';
import { scenarioCatalog } from '../content/scenarios';
import { referenceScenario } from '../content/scenarios/reference';
import { legitimateScenario } from '../content/scenarios/legitimate';
import { stolenCredentialScenario } from '../content/scenarios/stolenCredential';
import type { ScenarioDefinition } from '../domain/scenario';
import { createScenario, validateScenario } from './createScenario';
import { createInitialSimulation } from './createInitialSimulation';
import {
  createScenarioRun,
  nextRun,
  selectScenario,
} from './scenarioSelectors';
import { scenarioReducer } from './scenarioReducer';
import { simulationReducer } from './simulationReducer';

describe('konfiguracja i inicjalizacja wariantów', () => {
  it('domyślne wejście zachowuje dokładny wariant referencyjny', () => {
    const state = createInitialSimulation();
    expect(state).toEqual(
      createScenario(referenceScenario, { mode: 'training', seed: 0 }),
    );
    expect(state.hidden.scenario.id).toBe('nexus-reference');
    expect(state.hidden.attacker.currentSessionId).toBe('S-19');
    expect(state.process.remoteCapacity).toBe(14);
    expect(state.process.additionalWork).toBeUndefined();
  });

  it.each(scenarioCatalog)(
    '$id: poprawne referencje, niezależne kopie i niezmienny punkt startowy',
    (definition) => {
      expect(validateScenario(definition)).toEqual([]);
      const before = structuredClone(definition);
      const state = createScenario(definition);
      const second = createScenario(definition);
      const advanced = simulationReducer(state, { type: 'advance-turn' });
      expect(advanced.hidden.scenario).toEqual(before);
      expect(definition).toEqual(before);
      expect(second).toEqual(state);
      expect(second.world.assets).not.toBe(state.world.assets);
      expect(second.hidden.scenario).not.toBe(state.hidden.scenario);
      expect(second.telemetry.sourceEvents).not.toBe(
        state.telemetry.sourceEvents,
      );
      expect(state).toEqual(createScenario(definition));
    },
  );

  it('legalny wariant rozstrzyga wszystkie próby przez usługę i nie ma przeciwnika', () => {
    const state = createScenario(legitimateScenario);
    expect(state.hidden.attacker).toBeNull();
    expect(legitimateScenario.attacker).toBeNull();
    expect(legitimateScenario.access.sessions).toEqual([]);
    expect(legitimateScenario.telemetry.sourceEvents).toEqual([]);
    expect(
      state.telemetry.sourceEvents.filter(
        (event) => event.outcome === 'failure',
      ),
    ).toHaveLength(52);
    expect(state.access.sessions.map((session) => session.id)).toEqual([
      'S-19',
      'B-01',
    ]);
    expect(state.hidden.sessionOrigins).toEqual({
      'S-19': 'legitimate',
      'B-01': 'legitimate',
    });
    const changedPrelude = {
      ...legitimateScenario,
      authenticationPrelude: legitimateScenario.authenticationPrelude.map(
        (attempt, index) =>
          index === 0 ? { ...attempt, credentialVersion: 1 } : attempt,
      ),
    };
    const changed = createScenario(changedPrelude);
    expect(changed.telemetry.sourceEvents[0]?.outcome).toBe('success');
    expect(changed.access.sessions[0]?.id).toBe('M-failed-1');
    expect(changed.incident.alerts[0]?.failureCount).toBe(51);
  });

  it('wariant nowego logowania nie otrzymuje S-19, sukcesu z 13:58 ani cudzej sesji', () => {
    const state = createScenario(stolenCredentialScenario);
    expect(state.hidden.attacker?.currentSessionId).toBeNull();
    expect(state.hidden.attacker?.nextAction).toEqual({
      kind: 'authenticate',
      dueTurn: 3,
    });
    expect(state.access.sessions.map((session) => session.id)).toEqual([
      'B-01',
      'F-01',
    ]);
    expect(
      state.telemetry.sourceEvents.some(
        (event) =>
          event.sessionId === 'S-19' ||
          (event.minute === 838 && event.outcome === 'success'),
      ),
    ).toBe(false);
  });

  it('wybór jest powtarzalny, trening zawsze referencyjny, kolejny numer przechodzi po katalogu', () => {
    for (let seed = 0; seed < 9; seed += 1) {
      expect(selectScenario('training', seed)).toBe(referenceScenario);
      expect(selectScenario('unknown', seed)).toBe(scenarioCatalog[seed % 3]);
      expect(createScenarioRun('unknown', seed)).toEqual(
        createScenarioRun('unknown', seed),
      );
    }
    expect(nextRun({ mode: 'training', seed: 0 })).toEqual({
      mode: 'unknown',
      seed: 1,
    });
    expect(nextRun({ mode: 'unknown', seed: 1 })).toEqual({
      mode: 'unknown',
      seed: 2,
    });
  });

  it.each([
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('odrzuca niepoprawny seed %s', (seed) => {
    expect(() => createScenarioRun('unknown', seed)).toThrow(
      'Invalid scenario selection',
    );
  });

  it('powtórka zachowuje wariant, seed i cały stan początkowy, nowy incydent czyści poprzednią grę', () => {
    let state = createScenarioRun('unknown', 1);
    state = scenarioReducer(state, {
      type: 'schedule-task',
      workerId: 'analyst',
      action: { type: 'inspect-auth-logs' },
    });
    state = scenarioReducer(state, { type: 'advance-turn' });
    state = scenarioReducer(state, {
      type: 'set-hypothesis',
      hypothesis: 'unusual-legitimate-session',
    });
    expect(state.knowledge.authObservations).toHaveLength(1);
    expect(scenarioReducer(state, { type: 'reset' })).toEqual(
      createScenarioRun('unknown', 1),
    );
    const next = nextRun(state.run);
    const fresh = scenarioReducer(state, { type: 'start-run', ...next });
    expect(fresh).toEqual(createScenarioRun('unknown', 2));
    expect(fresh.hidden.attacker?.currentSessionId).toBeNull();
    expect(fresh.clock.turn).toBe(0);
    expect(fresh.business.totalReceived).toBe(0);
    expect(fresh.knowledge).toEqual({
      sessionObservation: null,
      authObservations: [],
      ownerStatements: [],
    });
    expect(fresh.tasks).toEqual([]);
    expect(fresh.history).toEqual([]);
    expect(fresh.hidden.decisionHistory).toEqual([]);
    expect(fresh.incident.hypothesis).toBe('insufficient-evidence');
    expect(fresh.incident.messages).toHaveLength(1);
  });
});

describe('odrzucanie niespójnych konfiguracji', () => {
  const invalid: readonly [
    string,
    (definition: ScenarioDefinition) => ScenarioDefinition,
  ][] = [
    [
      'konto bez tożsamości',
      (d) => ({
        ...d,
        access: {
          ...d.access,
          accounts: d.access.accounts.map((a, i) =>
            i === 0 ? { ...a, identityId: 'missing' } : a,
          ),
        },
      }),
    ],
    [
      'sesja bez konta',
      (d) => ({
        ...d,
        access: {
          ...d.access,
          sessions: d.access.sessions.map((s, i) =>
            i === 0 ? { ...s, accountId: 'missing' } : s,
          ),
        },
      }),
    ],
    [
      'sesja bez bramy',
      (d) => ({
        ...d,
        access: {
          ...d.access,
          sessions: d.access.sessions.map((s, i) =>
            i === 0 ? { ...s, gatewayAssetId: 'missing' } : s,
          ),
        },
      }),
    ],
    [
      'reguła bez źródła',
      (d) => ({
        ...d,
        access: {
          ...d.access,
          rules: d.access.rules.map((r, i) =>
            i === 0 ? { ...r, sourceAssetId: 'missing' } : r,
          ),
        },
      }),
    ],
    [
      'reguła bez usługi',
      (d) => ({
        ...d,
        access: {
          ...d.access,
          rules: d.access.rules.map((r, i) =>
            i === 0 ? { ...r, protocol: 'missing' } : r,
          ),
        },
      }),
    ],
    [
      'uprawnienie bez konta',
      (d) => ({
        ...d,
        access: {
          ...d.access,
          permissions: [
            { accountId: 'missing', targetAssetId: 'erp', protocol: 'HTTPS' },
          ],
        },
      }),
    ],
    [
      'uprawnienie bez zasobu',
      (d) => ({
        ...d,
        access: {
          ...d.access,
          permissions: [
            {
              accountId: 'magazyn-07',
              targetAssetId: 'missing',
              protocol: 'SMB',
            },
          ],
        },
      }),
    ],
    [
      'proces bez konta',
      (d) => ({ ...d, process: { ...d.process, remoteAccountId: 'missing' } }),
    ],
    [
      'część procesu bez usługi',
      (d) => ({
        ...d,
        process: {
          ...d.process,
          additionalWork: [
            {
              id: 'bad',
              name: 'Bad',
              accountId: 'dispatch-team',
              capacity: 6,
              services: [{ targetAssetId: 'missing', protocol: 'SMB' }],
            },
          ],
        },
      }),
    ],
    [
      'świadek bez konta',
      (d) => ({
        ...d,
        witnesses: [{ ...d.witnesses[0]!, accountId: 'missing' }],
      }),
    ],
    [
      'źródło z nieistniejącym sukcesem',
      (d) => ({
        ...d,
        telemetry: {
          ...d.telemetry,
          sourceEvents: [
            {
              id: 'AUTH-bad',
              accountId: 'magazyn-07',
              sourceAssetId: 'vpn',
              minute: 838,
              outcome: 'success',
              sessionId: 'S-99',
            },
          ],
        },
      }),
    ],
    [
      'sensor bez źródła',
      (d) => ({
        ...d,
        telemetry: {
          ...d.telemetry,
          authenticationSensor: {
            ...d.telemetry.authenticationSensor,
            sourceAssetId: 'missing',
          },
        },
      }),
    ],
    [
      'zduplikowane konto',
      (d) => ({
        ...d,
        access: {
          ...d.access,
          accounts: [...d.access.accounts, d.access.accounts[0]!],
        },
      }),
    ],
    [
      'nieznany początkowy tunel',
      (d) => ({ ...d, attacker: { ...d.attacker!, initialSessionId: 'S-99' } }),
    ],
    [
      'niezgodne cele',
      (d) => ({ ...d, goals: { ...d.goals, maxFinalBacklog: 99 } }),
    ],
    [
      'ujemna wydajność',
      (d) => ({ ...d, process: { ...d.process, localCapacity: -1 } }),
    ],
  ];
  it.each(invalid)('%s', (_, mutate) => {
    const definition = mutate(referenceScenario);
    expect(validateScenario(definition).length).toBeGreaterThan(0);
    expect(() => createScenario(definition)).toThrow('Invalid scenario');
  });

  it('odrzuca wstępną próbę nieistniejącego legalnego aktora i sprzeczną definicję braku ataku', () => {
    expect(() =>
      createScenario({
        ...legitimateScenario,
        authenticationPrelude: [
          {
            actorId: 'missing',
            minute: 838,
            credentialVersion: 1,
            requestedSessionId: 'S-19',
          },
        ],
      }),
    ).toThrow('Unknown prelude actor');
    expect(() =>
      createScenario({
        ...legitimateScenario,
        attacker: referenceScenario.attacker,
      }),
    ).toThrow('Scenario truth disagrees with actors');
    const { firstAuthenticationTurn, ...withoutAuthenticationTurn } =
      stolenCredentialScenario.attacker!;
    expect(firstAuthenticationTurn).toBe(3);
    expect(() =>
      createScenario({
        ...stolenCredentialScenario,
        attacker: withoutAuthenticationTurn,
      }),
    ).toThrow('Missing first authentication turn');
  });
});
