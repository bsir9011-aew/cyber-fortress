import { describe, expect, it } from 'vitest';
import { createInitialSimulation } from '../application/createInitialSimulation';
import { selectPlayerView } from '../application/selectPlayerView';
import { selectMissionReport } from '../application/selectMissionReport';
import { simulationReducer } from '../application/simulationReducer';
import { nexusTelemetry } from '../content/nexusIncident';
import { nexusAttack } from '../content/nexusAttack';
import type {
  SimulationCommand,
  SimulationState,
  TaskAction,
} from '../domain/simulation';
import { createInitialAttacker } from './attacker';
import {
  availableAuthenticationRecords,
  detectVpnAlerts,
  updateTelemetry,
} from './telemetry';
import { deriveNarrative } from './narrative';
import { taskSpecs } from './tasks';

const advance = (state: SimulationState) =>
  simulationReducer(state, { type: 'advance-turn' });
function until(state: SimulationState, turn: number): SimulationState {
  while (state.clock.turn < turn) state = advance(state);
  return state;
}
function schedule(state: SimulationState, action: TaskAction): SimulationState {
  return simulationReducer(state, {
    type: 'schedule-task',
    workerId: taskSpecs[action.type].workerId,
    action,
  });
}
const logs: TaskAction = { type: 'inspect-auth-logs' };
const sessions: TaskAction = { type: 'inspect-vpn-sessions' };
const contact: TaskAction = {
  type: 'contact-account-owner',
  accountId: 'magazyn-07',
};
const denySmb: TaskAction = {
  type: 'set-network-rule',
  ruleId: 'R-SMB',
  action: 'deny',
};
const terminate: TaskAction = { type: 'terminate-session', sessionId: 'S-19' };
const block: TaskAction = { type: 'block-account', accountId: 'magazyn-07' };
const resetCredential: TaskAction = {
  type: 'reset-credential',
  accountId: 'magazyn-07',
};
const vpn = (enabled: boolean): TaskAction => ({
  type: 'set-vpn',
  assetId: 'vpn',
  enabled,
});

function withFreshSensor(
  overrides: Partial<typeof nexusTelemetry.authenticationSensor>,
): SimulationState {
  const state = createInitialSimulation();
  return updateTelemetry({
    ...state,
    telemetry: {
      ...structuredClone(nexusTelemetry),
      authenticationSensor: {
        ...nexusTelemetry.authenticationSensor,
        ...overrides,
      },
    },
    incident: { ...state.incident, alerts: [] },
  });
}

describe('źródło → sensor → dostępna obserwacja → alert', () => {
  it('modeluje dokładnie 52 błędy przed 14:00 i sukces 13:58 wydający S-19', () => {
    const state = createInitialSimulation();
    const history = state.telemetry.sourceEvents;
    expect(
      history.filter(
        (event) => event.minute < 840 && event.outcome === 'failure',
      ),
    ).toHaveLength(52);
    expect(
      history.filter(
        (event) =>
          event.accountId === 'magazyn-07' && event.outcome === 'success',
      ),
    ).toEqual([
      {
        id: 'AUTH-0053',
        minute: 838,
        sourceAssetId: 'vpn',
        accountId: 'magazyn-07',
        outcome: 'success',
        sessionId: 'S-19',
      },
    ]);
    expect(history.find((event) => event.sessionId === 'B-01')).toMatchObject({
      minute: 840,
      accountId: 'dispatch-team',
    });
    expect(new Set(history.map((event) => event.id)).size).toBe(history.length);
  });

  it('detektor działa wyłącznie na zarejestrowanych polach, bez prywatnej prawdy', () => {
    const state = createInitialSimulation();
    const records = availableAuthenticationRecords(state.telemetry, 840);
    const alert = detectVpnAlerts(records, 840, []);
    expect(alert).toEqual(state.incident.alerts);
    expect(alert[0]).toMatchObject({
      failureCount: 52,
      assessment: 'requires-investigation',
      minute: 840,
      sensorId: 'vpn-auth',
    });
    const alternate = {
      ...state,
      hidden: {
        ...state.hidden,
        attacker: createInitialAttacker({
          ...nexusAttack,
          accountId: 'inne-konto',
        }),
        sessionOrigins: {},
      },
    };
    expect(updateTelemetry(alternate).incident.alerts).toEqual(
      state.incident.alerts,
    );
    expect(detectVpnAlerts([], 840, [])).toEqual([]);
  });

  it('brak pokrycia nie usuwa ataku, ale usuwa telemetrię i alert', () => {
    const state = withFreshSensor({ enabled: false });
    expect(state.telemetry.sourceEvents).toHaveLength(54);
    expect(state.telemetry.authenticationRecords).toEqual([]);
    expect(state.incident.alerts).toEqual([]);
    expect(until(state, 18).hidden.attacker.transfer.exposedRecords).toBe(2000);
    const rejected = schedule(state, logs);
    expect(rejected.history.at(-1)).toMatchObject({
      reason: 'source-unavailable',
    });
  });

  it('sensor o innym źródle nie rejestruje logowań VPN', () => {
    const state = withFreshSensor({ sourceAssetId: 'firewall' });
    expect(state.telemetry.authenticationRecords).toEqual([]);
    expect(state.incident.alerts).toEqual([]);
  });

  it('uwzględnia retencję oraz czas rozpoczęcia pokrycia', () => {
    const expired = withFreshSensor({ retentionMinutes: 1 });
    expect(expired.telemetry.authenticationRecords).toHaveLength(1);
    expect(expired.incident.alerts).toEqual([]);
    const tooLate = withFreshSensor({ coverageFromMinute: 839 });
    expect(tooLate.telemetry.authenticationRecords).toHaveLength(1);
    expect(tooLate.incident.alerts).toEqual([]);
  });

  it('opóźniony zapis nie zasila detekcji ani badań przed dostępnością', () => {
    let state = withFreshSensor({ delayMinutes: 5 });
    expect(state.telemetry.authenticationRecords).toHaveLength(54);
    expect(availableAuthenticationRecords(state.telemetry, 840)).toEqual([]);
    expect(state.incident.alerts).toEqual([]);
    state = advance(schedule(state, logs));
    expect(state.incident.alerts[0]?.failureCount).toBe(37);
    // Okno detekcji przesuwa się: starsze 15 błędów wypada z 20 minut.
    expect(state.knowledge.authObservations[0]?.records).toHaveLength(54);
    expect(state.knowledge.authObservations[0]?.windowEndMinute).toBe(840);
  });

  it('ponowne włączenie sensora nie odzyskuje zdarzeń z braku pokrycia', () => {
    const state = withFreshSensor({ enabled: false });
    const enabled = updateTelemetry({
      ...state,
      telemetry: {
        ...state.telemetry,
        authenticationSensor: {
          ...state.telemetry.authenticationSensor,
          enabled: true,
        },
      },
    });
    expect(enabled.telemetry.authenticationRecords).toEqual([]);
    expect(enabled.incident.alerts).toEqual([]);
  });

  it('reguła ma próg 20, okno 20 minut i jeden alert na konto oraz źródło', () => {
    const records =
      createInitialSimulation().telemetry.authenticationRecords.filter(
        (event) => event.outcome === 'failure',
      );
    expect(detectVpnAlerts(records.slice(0, 19), 840, [])).toEqual([]);
    expect(detectVpnAlerts(records.slice(0, 20), 840, [])).toHaveLength(1);
    expect(detectVpnAlerts(records, 861, [])).toEqual([]);
    const alert = detectVpnAlerts(records, 840, []);
    expect(detectVpnAlerts(records, 840, alert)).toEqual(alert);
    for (const secret of ['sessionId', 'exposedRecords', 'confirmedCompromise'])
      expect(alert[0]).not.toHaveProperty(secret);
  });
});

describe('czas pozyskania i granice wiedzy', () => {
  it('badanie logów trwa jedną turę i rezerwuje jedynego analityka', () => {
    const started = schedule(createInitialSimulation(), logs);
    expect(started.tasks[0]).toMatchObject({
      workerId: 'analyst',
      startTurn: 0,
      dueTurn: 1,
      status: 'running',
    });
    expect(started.knowledge.authObservations).toEqual([]);
    expect(selectPlayerView(started).authObservations).toEqual([]);
    expect(schedule(started, contact).history.at(-1)).toMatchObject({
      reason: 'worker-busy',
    });
    const done = advance(started);
    expect(done.knowledge.authObservations[0]).toMatchObject({
      observedAtMinute: 845,
      sensorId: 'vpn-auth',
      retentionMinutes: 120,
      windowEndMinute: 845,
    });
    expect(done.knowledge.authObservations[0]?.records).toHaveLength(54);
  });

  it('otwieranie i ponowne odczytanie projekcji nie pozyskuje dowodów ani nie przesuwa czasu', () => {
    const state = createInitialSimulation();
    for (let i = 0; i < 50; i += 1) selectPlayerView(state);
    expect(state.clock.turn).toBe(0);
    expect(state.knowledge).toEqual({
      sessionObservation: null,
      authObservations: [],
      ownerStatements: [],
    });
  });

  it('badanie nie ujawnia pochodzenia S-19, wersji hasła ani wyniku kopiowania', () => {
    const state = advance(schedule(createInitialSimulation(), logs));
    const publicData = JSON.stringify(selectPlayerView(state));
    expect(publicData).toContain('S-19');
    for (const secret of [
      'unauthorized',
      'sessionOrigins',
      'credentialVersion',
      'stolenCredentialVersion',
      'exposedRecords',
      'privateHistory',
      'records-copied',
    ])
      expect(publicData).not.toContain(secret);
  });

  it('badanie sesji wymaga działającego sensora i nie zastępuje logu historycznego', () => {
    const base = createInitialSimulation();
    const absent = {
      ...base,
      telemetry: {
        ...base.telemetry,
        sessionSensor: { ...base.telemetry.sessionSensor, enabled: false },
      },
    };
    expect(schedule(absent, sessions).history.at(-1)).toMatchObject({
      reason: 'source-unavailable',
    });
    const wrongSource = {
      ...base,
      telemetry: {
        ...base.telemetry,
        sessionSensor: {
          ...base.telemetry.sessionSensor,
          sourceAssetId: 'firewall',
        },
      },
    };
    expect(schedule(wrongSource, sessions).history.at(-1)).toMatchObject({
      reason: 'source-unavailable',
    });
    const done = advance(schedule(base, sessions));
    expect(
      done.knowledge.sessionObservation?.sessions.map((session) => session.id),
    ).toEqual(['S-19', 'B-01']);
    expect(done.knowledge.authObservations).toEqual([]);
  });

  it('zniknięcie źródła na granicy badania nie tworzy fikcyjnego wyniku', () => {
    const state = advance(
      schedule(schedule(createInitialSimulation(), logs), vpn(false)),
    );
    expect(state.knowledge.authObservations).toEqual([]);
    expect(state.history.at(-1)).toMatchObject({
      kind: 'research-unavailable',
    });
    expect(state.business.totalProcessed).toBe(20);
  });

  it('kontakt z Martą kosztuje 5 minut i tworzy dowód typu relacja człowieka', () => {
    const started = schedule(createInitialSimulation(), contact);
    expect(started.knowledge.ownerStatements).toEqual([]);
    expect(started.tasks[0]?.dueTurn).toBe(1);
    const done = advance(started);
    expect(done.knowledge.ownerStatements[0]).toMatchObject({
      kind: 'human-statement',
      speaker: 'Marta',
      accountId: 'magazyn-07',
      observedAtMinute: 845,
      referencedMinute: 838,
    });
    expect(done.knowledge.authObservations).toEqual([]);
    expect(
      done.incident.messages.some(
        (message) =>
          message.speaker === 'Marta' && message.source === 'human-statement',
      ),
    ).toBe(true);
  });

  it('Marta odpowiada także bez VPN; nieznane konto lub właściciel nie są wymyślane', () => {
    const offline = advance(schedule(createInitialSimulation(), vpn(false)));
    expect(
      advance(schedule(offline, contact)).knowledge.ownerStatements,
    ).toHaveLength(1);
    expect(
      schedule(offline, {
        type: 'contact-account-owner',
        accountId: 'nieznane',
      }).history.at(-1),
    ).toMatchObject({ reason: 'target-not-observed' });
    const observed = advance(schedule(createInitialSimulation(), sessions));
    expect(
      schedule(observed, {
        type: 'contact-account-owner',
        accountId: 'dispatch-team',
      }).history.at(-1),
    ).toMatchObject({ reason: 'unknown-target' });
  });

  it('ponowne badanie ujawnia nowe logowanie, poprzednia migawka pozostaje niezmieniona', () => {
    let state = advance(schedule(createInitialSimulation(), logs));
    const first = structuredClone(state.knowledge.authObservations[0]);
    state = advance(schedule(state, terminate));
    state = until(state, 4);
    expect(state.telemetry.sourceEvents.at(-1)).toMatchObject({
      accountId: 'magazyn-07',
      outcome: 'success',
      sessionId: 'S-20',
      minute: 860,
    });
    expect(state.knowledge.authObservations).toEqual([first]);
    state = advance(schedule(state, logs));
    expect(state.knowledge.authObservations[1]?.records.at(-1)?.sessionId).toBe(
      'S-20',
    );
    expect(state.knowledge.authObservations[0]).toEqual(first);
  });

  it('zapisuje także odrzucone uwierzytelnienie przez istniejącą usługę', () => {
    let state = advance(schedule(createInitialSimulation(), logs));
    state = advance(schedule(state, terminate));
    state = advance(schedule(state, block));
    state = until(state, 4);
    expect(state.telemetry.sourceEvents.at(-1)).toMatchObject({
      minute: 860,
      accountId: 'magazyn-07',
      outcome: 'failure',
      sessionId: null,
    });
    expect(state.knowledge.authObservations[0]?.records).toHaveLength(54);
  });

  it('log historyczny pozwala wskazać S-19 do istniejącej komendy zakończenia', () => {
    const known = advance(schedule(createInitialSimulation(), logs));
    expect(known.knowledge.sessionObservation).toBeNull();
    const done = advance(schedule(known, terminate));
    expect(
      done.access.sessions.find((session) => session.id === 'S-19')?.status,
    ).toBe('terminated');
    expect(done.hidden.attacker.privateHistory.at(-1)?.outcome).toBe(
      'session-lost',
    );
  });

  it('hipoteza jest bezpłatną notatką, nie zmienia świata ani nie otrzymuje oceny', () => {
    const base = createInitialSimulation();
    const changed = simulationReducer(base, {
      type: 'set-hypothesis',
      hypothesis: 'compromised-credential',
    });
    expect(changed.clock).toEqual(base.clock);
    expect(changed.hidden).toEqual(base.hidden);
    expect(changed.telemetry).toEqual(base.telemetry);
    expect(changed.incident.hypothesis).toBe('compromised-credential');
    expect(until(changed, 18).hidden.attacker).toEqual(
      until(base, 18).hidden.attacker,
    );
  });
});

describe('reguły narracji i ujawnienie raportu', () => {
  it('Bartek potwierdza dopiero ukończoną zmianę, bez twierdzenia że zatrzymano atak', () => {
    const started = schedule(createInitialSimulation(), denySmb);
    expect(
      started.incident.messages.filter(
        (message) => message.speaker === 'Bartek',
      ),
    ).toEqual([]);
    const midway = advance(started);
    expect(
      midway.incident.messages.filter(
        (message) => message.speaker === 'Bartek',
      ),
    ).toEqual([]);
    const done = advance(midway);
    expect(
      done.incident.messages.find((message) => message.speaker === 'Bartek'),
    ).toMatchObject({ minute: 850, source: 'configuration' });
    expect(JSON.stringify(done.incident.messages)).not.toMatch(
      /atak zatrzymany|rekordów skopiowano|napastnik zablokowany/i,
    );
  });

  it('Ewa zgłasza rzeczywistą kolejkę, a później przywróconą obsługę', () => {
    let state = advance(schedule(createInitialSimulation(), vpn(false)));
    expect(state.business.backlog).toBe(0);
    expect(
      state.incident.messages.some((message) => message.id === 'ewa-queue'),
    ).toBe(false);
    state = advance(state);
    expect(state.business.backlog).toBe(12);
    expect(
      state.incident.messages.some((message) => message.id === 'ewa-queue'),
    ).toBe(true);
    state = advance(schedule(state, vpn(true)));
    expect(
      state.incident.messages.some((message) => message.id === 'ewa-restored'),
    ).toBe(true);
  });

  it('precyzyjna blokada otrzymuje feedback o faktycznie rozliczonej legalnej pracy', () => {
    const state = until(schedule(createInitialSimulation(), denySmb), 3);
    expect(state.business.totalProcessed).toBe(60);
    expect(
      state.incident.messages.find((message) => message.id === 'erp-T-0001'),
    ).toMatchObject({ speaker: 'Ewa', minute: 855, source: 'business' });
  });

  it('wiadomości i alerty nie powielają się w kolejnych turach', () => {
    let state = until(schedule(createInitialSimulation(), denySmb), 5);
    const count = state.incident.messages.length;
    state = until(state, 18);
    expect(state.incident.messages).toHaveLength(count);
    expect(
      new Set(state.incident.messages.map((message) => message.id)).size,
    ).toBe(count);
    expect(state.incident.alerts).toHaveLength(1);
  });

  it('narracja i publiczna projekcja nie zależą od kontrfaktycznej prawdy przeciwnika', () => {
    const state = until(advance(schedule(createInitialSimulation(), logs)), 5);
    const alternate = {
      ...state,
      hidden: {
        ...state.hidden,
        attacker: createInitialAttacker(nexusAttack),
        sessionOrigins: {},
      },
    };
    expect(selectPlayerView(alternate)).toEqual(selectPlayerView(state));
    const facts = {
      clock: state.clock,
      tasks: state.tasks,
      knowledge: state.knowledge,
      history: state.history,
      business: state.business,
      incident: state.incident,
      remoteAvailable: true,
    };
    expect(deriveNarrative(facts)).toEqual(state.incident.messages);
  });

  it('przez pierwsze 17 tur raport jest niedostępny, a projekcja nie zawiera prywatnych wyników', () => {
    let state = schedule(createInitialSimulation(), logs);
    for (let turn = 0; turn < 18; turn += 1) {
      expect(selectMissionReport(state)).toBeNull();
      const publicData = JSON.stringify(selectPlayerView(state));
      for (const secret of [
        'exposedRecords',
        'privateHistory',
        'decisionHistory',
        'sessionOrigins',
        'records-copied',
        'stolenCredentialVersion',
        'authenticationAttempts',
        'nextAction',
      ])
        expect(publicData).not.toContain(secret);
      state = advance(state);
    }
    expect(selectMissionReport(state)?.confidentiality.exposedRecords).toBe(
      2000,
    );
  });

  it('raport odróżnia wyczerpanie prób od rzeczywistego odcięcia dostępu', () => {
    let state = until(schedule(createInitialSimulation(), denySmb), 7);
    state = advance(schedule(state, { ...denySmb, action: 'allow' }));
    state = until(state, 18);
    const report = selectMissionReport(state)!;
    expect(report.confidentiality.exposedRecords).toBe(0);
    expect(report.containment).toMatchObject({
      retryBudgetExhausted: true,
      stoppedOnlyByRetryBudget: true,
      targetAccessCutOff: false,
      newAuthenticationAllowed: true,
      usableSessionIds: ['S-19'],
      accountContained: false,
    });
  });

  it('sam brak VPN nie oznacza zabezpieczenia nadal ważnego konta', () => {
    const report = selectMissionReport(
      until(schedule(createInitialSimulation(), vpn(false)), 18),
    )!;
    expect(report.containment).toMatchObject({
      targetAccessCutOff: true,
      activeSessionIds: [],
      newAuthenticationAllowed: false,
      stolenCredentialStillCurrent: true,
      accountContained: false,
    });
  });

  it('zakończenie tunelu i reset starego poświadczenia dają potwierdzone ograniczenie konta', () => {
    let state = advance(schedule(createInitialSimulation(), logs));
    state = advance(schedule(state, terminate));
    state = until(schedule(state, resetCredential), 18);
    expect(selectMissionReport(state)?.containment).toMatchObject({
      accountContained: true,
      targetAccessCutOff: true,
      stolenCredentialStillCurrent: false,
      newAuthenticationAllowed: false,
    });
  });

  it('analiza decyzji zachowuje ówczesną wiedzę i najwyżej trzy rzeczywiste zmiany możliwości', () => {
    let state = advance(schedule(createInitialSimulation(), logs));
    state = advance(schedule(state, terminate));
    state = advance(schedule(schedule(state, contact), block));
    state = until(schedule(state, resetCredential), 5);
    state = until(schedule(state, denySmb), 18);
    const report = selectMissionReport(state)!;
    expect(report.moments).toHaveLength(3);
    expect(report.actions).toHaveLength(4);
    expect(report.moments[0]?.knownThen).toMatchObject({
      authObservationMinute: 845,
      authRecordCount: 54,
      sessionObservationMinute: null,
      ownerStatementMinute: null,
    });
    expect(report.moments[2]?.knownThen.ownerStatementMinute).toBe(855);
    expect(
      report.moments.every((moment) => moment.impact?.changedCapabilities),
    ).toBe(true);
    expect(report.moments[0]?.impact?.exposedRecordsAtCompletion).toBe(0);
  });

  it('reset odtwarza źródła początkowe i czyści dowody, zadania, hipotezę, narrację oraz raport', () => {
    let state = advance(schedule(createInitialSimulation(), logs));
    state = advance(schedule(schedule(state, contact), terminate));
    state = simulationReducer(state, {
      type: 'set-hypothesis',
      hypothesis: 'compromised-credential',
    });
    state = until(state, 18);
    const reset = simulationReducer(state, { type: 'reset' });
    expect(reset).toEqual(createInitialSimulation());
    expect(reset.knowledge.authObservations).toEqual([]);
    expect(reset.hidden.decisionHistory).toEqual([]);
    expect(reset.tasks).toEqual([]);
    expect(reset.incident.messages).toHaveLength(1);
    expect(reset.incident.alerts).toHaveLength(1);
    expect(reset.telemetry.sourceEvents).toHaveLength(54);
    expect(selectMissionReport(reset)).toBeNull();
  });

  it('te same komendy odtwarzają identyczną telemetrię, dowody, narrację i raport', () => {
    const commands: SimulationCommand[] = [
      { type: 'schedule-task', workerId: 'analyst', action: logs },
      { type: 'advance-turn' },
      { type: 'schedule-task', workerId: 'administrator', action: terminate },
      { type: 'schedule-task', workerId: 'analyst', action: contact },
      ...Array.from(
        { length: 17 },
        (): SimulationCommand => ({ type: 'advance-turn' }),
      ),
    ];
    const play = () =>
      commands.reduce(simulationReducer, createInitialSimulation());
    expect(play()).toEqual(play());
    expect(selectMissionReport(play())).toEqual(selectMissionReport(play()));
  });
});

export function playIncidentPath(
  path: 'A' | 'B' | 'C' | 'D' | 'E',
): SimulationState {
  let state = createInitialSimulation();
  if (path === 'B') {
    state = advance(schedule(state, logs)); // 14:05 — pierwszy dowód
    state = advance(schedule(state, sessions)); // 14:10 — migawka
    state = schedule(state, denySmb); // gotowe 14:20 przed pierwszą porcją
    state = advance(schedule(state, contact)); // 14:15 — relacja Marty
  }
  if (path === 'C') state = schedule(state, vpn(false)); // brak planu przywrócenia
  if (path === 'D') {
    state = advance(schedule(state, sessions));
    state = schedule(state, terminate); // 14:10, ponowne logowanie 14:20
  }
  if (path === 'E') {
    state = advance(schedule(state, logs));
    state = until(state, 3);
    state = schedule(state, denySmb); // 14:25 po pierwszych 400
  }
  return until(state, 18);
}

describe('pięć pełnych strategii misji — 18 tur', () => {
  it.each([
    ['A', 2000, 360, 0, false],
    ['B', 0, 360, 0, true],
    ['C', 0, 156, 204, true],
    ['D', 2000, 360, 0, false],
    ['E', 400, 360, 0, true],
  ] as const)(
    '%s: ujawnienie %i, obsłużone %i, zaległe %i',
    (path, exposed, processed, backlog, cutOff) => {
      const state = playIncidentPath(path);
      const report = selectMissionReport(state)!;
      expect(state.clock.turn).toBe(18);
      expect(report.confidentiality.exposedRecords).toBe(exposed);
      expect(report.confidentiality.exposedRecords).toBe(
        state.hidden.attacker.transfer.exposedRecords,
      );
      expect(report.continuity).toEqual({
        received: 360,
        processed,
        backlog,
        backlogLimit: 40,
        goalMet: backlog <= 40,
      });
      expect(report.containment.targetAccessCutOff).toBe(cutOff);
      expect(state.business.totalProcessed).toBe(processed);
      if (path === 'B' || path === 'E') {
        expect(
          state.access.rules.find((rule) => rule.id === 'R-ERP')?.action,
        ).toBe('allow');
        expect(report.containment.accountContained).toBe(false);
      }
      if (path === 'D')
        expect(report.containment.usableSessionIds).toEqual(['S-20']);
      console.table([
        {
          path,
          exposedRecords: exposed,
          received: report.continuity.received,
          processed: report.continuity.processed,
          backlog: report.continuity.backlog,
          targetAccessCutOff: report.containment.targetAccessCutOff,
          accountContained: report.containment.accountContained,
        },
      ]);
    },
  );
});
