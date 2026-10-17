import { describe, expect, it } from 'vitest';
import {
  budgetBalance,
  campaignReducer,
  createCampaign,
} from './campaignReducer';
import type {
  CampaignCommand,
  CampaignState,
  ProjectId,
} from '../domain/campaign';
import { createScenarioRun } from './scenarioSelectors';
import { simulationReducer } from './simulationReducer';
import { selectStrategyView } from './selectStrategyView';
import { selectPlayerView } from './selectPlayerView';
import {
  canUseService,
  issueVpnSession,
  networkAllows,
} from '../simulation/access';
import { attemptFileAccess, readFileAccess } from '../simulation/fileAudit';
import { updateTelemetry } from '../simulation/telemetry';
import { projectDefinition } from '../content/securityProjects';
const step = (s: CampaignState, ...cs: CampaignCommand[]) =>
  cs.reduce(campaignReducer, s);
const hour: CampaignCommand = { type: 'advance-preparation' };
const turn: CampaignCommand = {
  type: 'incident-command',
  command: { type: 'advance-turn' },
};
function reserve(s: CampaignState, projectId: ProjectId) {
  return step(
    s,
    { type: 'plan-project', projectId },
    { type: 'reserve-project', projectId },
  );
}
function invest(seed: number, project?: ProjectId) {
  let s = createCampaign(seed);
  if (project) {
    s = reserve(s, project);
    for (const workerId of ['administrator', 'analyst'] as const)
      if (projectDefinition(project).hours[workerId])
        s = step(s, { type: 'assign-work', projectId: project, workerId });
  }
  return step(s, hour, hour, hour, hour, { type: 'start-incident' });
}
function finish(s: CampaignState) {
  while (s.phase === 'incident') s = step(s, turn);
  return s;
}
function next(s: CampaignState) {
  return step(s, { type: 'return-headquarters' }, hour, hour, hour, hour, {
    type: 'start-incident',
  });
}

describe('budżet i rzeczywiste wdrożenia', () => {
  it('80 000 łącznie, pilotaż 12 000, dostępne 68 000; A pozostało 20 000', () => {
    const s = createCampaign();
    expect(budgetBalance(s)).toEqual({
      total: 80000,
      spent: 12000,
      reserved: 0,
      available: 68000,
    });
    expect(s.budget.ledger[0]).toMatchObject({
      projectId: 'remote-access',
      kind: 'prior-expense',
      amount: 12000,
      result: 'applied',
      stage: 'preparation',
    });
    expect(projectDefinition('remote-access')).toMatchObject({
      totalCost: 32000,
      remainingCost: 20000,
    });
  });
  it('planowanie nie rezerwuje i nie aktywuje; rezerwacja nie wydaje ani nie aktywuje', () => {
    const planned = step(createCampaign(), {
      type: 'plan-project',
      projectId: 'remote-access',
    });
    expect(budgetBalance(planned).available).toBe(68000);
    const s = reserve(createCampaign(), 'remote-access');
    expect(budgetBalance(s)).toEqual({
      total: 80000,
      spent: 12000,
      reserved: 20000,
      available: 48000,
    });
    expect(s.posture.remoteAccess).toBe(false);
  });
  it('nie finansuje wszystkich trzech projektów i nie schodzi poniżej zera', () => {
    const s = reserve(
      reserve(reserve(createCampaign(), 'remote-access'), 'file-visibility'),
      'segmentation',
    );
    expect(budgetBalance(s)).toEqual({
      total: 80000,
      spent: 12000,
      reserved: 48000,
      available: 20000,
    });
    expect(s.budget.ledger.at(-1)).toMatchObject({
      result: 'rejected',
      projectId: 'segmentation',
      amount: 30000,
    });
  });
  it('anulowanie rezerwacji oddaje tylko rezerwę, a nie wcześniejsze 12 000', () => {
    const s = step(reserve(createCampaign(), 'remote-access'), {
      type: 'cancel-project',
      projectId: 'remote-access',
    });
    expect(budgetBalance(s).available).toBe(68000);
    expect(budgetBalance(s).spent).toBe(12000);
  });
  it('start pracy płaci raz; kolejny wykonawca projektu B nie pobiera drugiej opłaty', () => {
    const s = step(
      reserve(createCampaign(), 'file-visibility'),
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'analyst',
      },
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'administrator',
      },
    );
    expect(budgetBalance(s)).toEqual({
      total: 80000,
      spent: 40000,
      reserved: 0,
      available: 40000,
    });
    expect(s.budget.ledger.filter((e) => e.kind === 'payment')).toHaveLength(1);
    expect(s.posture.fileVisibility).toBe(false);
  });
  it('wykonawca nie robi dwóch prac naraz; różni wykonawcy pracują równolegle', () => {
    const s = step(
      reserve(reserve(createCampaign(), 'remote-access'), 'file-visibility'),
      {
        type: 'assign-work',
        projectId: 'remote-access',
        workerId: 'administrator',
      },
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'administrator',
      },
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'analyst',
      },
      hour,
    );
    expect(s.work.filter((w) => w.status === 'running')).toHaveLength(2);
    expect(
      s.projects.find((p) => p.id === 'remote-access')!.remaining.administrator,
    ).toBe(3);
    expect(
      s.projects.find((p) => p.id === 'file-visibility')!.remaining,
    ).toEqual({ administrator: 2, analyst: 3 });
    expect(s.decisions.some((d) => d.reason.includes('zajęty'))).toBe(true);
  });
  it('B potrzebuje ukończenia obu wykonawców, nie tylko 2 godzin administratora', () => {
    const a = step(
      reserve(createCampaign(), 'file-visibility'),
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'administrator',
      },
      hour,
      hour,
    );
    expect(a.posture.fileVisibility).toBe(false);
    expect(a.projects[1]!.remaining).toEqual({ administrator: 0, analyst: 4 });
    const b = step(
      a,
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'analyst',
      },
      hour,
      hour,
    );
    expect(b.posture.fileVisibility).toBe(false);
    expect(b.projects[1]!.remaining.analyst).toBe(2);
    const c = finish(step(b, { type: 'start-incident' }));
    const d = step(
      c,
      { type: 'return-headquarters' },
      {
        type: 'assign-work',
        projectId: 'file-visibility',
        workerId: 'analyst',
      },
      hour,
      hour,
    );
    expect(d.posture.fileVisibility).toBe(true);
    expect(budgetBalance(d).spent).toBe(40000);
  });
  it('A aktywuje się po czterech godzinach; pilotaż i płatność nie są dublowane', () => {
    let s = step(
      reserve(createCampaign(), 'remote-access'),
      {
        type: 'assign-work',
        projectId: 'remote-access',
        workerId: 'administrator',
      },
      hour,
      hour,
      hour,
    );
    expect(s.posture.remoteAccess).toBe(false);
    s = step(s, hour);
    expect(s.posture.remoteAccess).toBe(true);
    expect(budgetBalance(s).spent).toBe(32000);
    s = step(
      s,
      { type: 'reserve-project', projectId: 'remote-access' },
      { type: 'cancel-project', projectId: 'remote-access' },
    );
    expect(budgetBalance(s).spent).toBe(32000);
    expect(s.projects[0]!.status).toBe('completed');
  });
  it('misja nie startuje przed końcem przygotowania; brak inwestycji jest dopuszczalny', () => {
    expect(step(createCampaign(), { type: 'start-incident' }).phase).toBe(
      'preparation',
    );
    expect(invest(0).phase).toBe('incident');
  });
});

describe('pełne przebiegi projekt × wariant', () => {
  const matrix: [number, ProjectId | undefined, number, number, number][] = [
    [0, undefined, 2000, 360, 0],
    [1, undefined, 0, 360, 0],
    [2, undefined, 2000, 360, 0],
    [0, 'remote-access', 0, 360, 0],
    [1, 'remote-access', 0, 360, 0],
    [2, 'remote-access', 0, 360, 0],
    [0, 'file-visibility', 2000, 360, 0],
    [1, 'file-visibility', 0, 360, 0],
    [2, 'file-visibility', 2000, 360, 0],
    [0, 'segmentation', 0, 360, 0],
    [1, 'segmentation', 0, 288, 72],
    [2, 'segmentation', 0, 360, 0],
  ];
  it.each(matrix)(
    'seed %i, %s → %i ujawnionych / %i obsłużonych / %i zaległych',
    (seed, project, exposed, processed, backlog) => {
      const s = finish(invest(seed, project));
      expect(s.history[0]).toMatchObject({
        exposedRecords: exposed,
        processed,
        backlog,
        fullCapacity: 22,
        minimumCapacity: backlog === 72 ? 16 : 22,
      });
      const balance = budgetBalance(s);
      expect(balance.total).toBe(
        balance.spent + balance.reserved + balance.available,
      );
    },
  );
  it.each([0, 1, 2])(
    'bez inwestycji wariant %i zachowuje pełny stan bazowego silnika',
    (seed) => {
      const c = invest(seed);
      expect(c.incident).toEqual(createScenarioRun('unknown', seed));
      let base = createScenarioRun('unknown', seed);
      for (let i = 0; i < 18; i++)
        base = simulationReducer(base, { type: 'advance-turn' });
      expect(finish(c).incident).toEqual(base);
    },
  );
  it('szeroka grupa C zachowuje pracę Marty, ale dopuszcza to samo przejęte konto', () => {
    let s = createCampaign();
    s = step(s, { type: 'set-segmentation-scope', scope: 'document-users' });
    s = reserve(s, 'segmentation');
    s = step(
      s,
      {
        type: 'assign-work',
        projectId: 'segmentation',
        workerId: 'administrator',
      },
      hour,
      hour,
      hour,
      hour,
      { type: 'start-incident' },
    );
    expect(finish(s).history[0]!.exposedRecords).toBe(2000);
    const b = finish(next(finish(s)));
    expect(b.history[1]).toMatchObject({
      exposedRecords: 0,
      processed: 360,
      backlog: 0,
    });
  });
  it('inwestycje, budżet i konfiguracja przechodzą dalej, stan incydentu nie', () => {
    const first = finish(invest(0, 'remote-access'));
    const second = next(first);
    expect(second.posture).toEqual(first.posture);
    expect(second.budget).toEqual(first.budget);
    expect(second.incident!.clock.turn).toBe(0);
    expect(second.incident!.tasks).toEqual([]);
    expect(second.incident!.knowledge.authObservations).toEqual([]);
    expect(second.incident!.hidden.attacker).toBeNull();
    expect(second.incident!.history).toEqual([]);
    expect(second.incident!.business.totalReceived).toBe(0);
  });
  it('rzeczywista ręczna zmiana reguły zostaje utrzymana bez ponownego zakupu', () => {
    let s = invest(0);
    s = step(s, {
      type: 'incident-command',
      command: {
        type: 'schedule-task',
        workerId: 'administrator',
        action: { type: 'set-network-rule', ruleId: 'R-SMB', action: 'deny' },
      },
    });
    s = next(finish(s));
    expect(s.incident!.access.rules.find((r) => r.id === 'R-SMB')!.action).toBe(
      'deny',
    );
    expect(budgetBalance(s).spent).toBe(12000);
    expect(finish(s).incident!.business.backlog).toBe(72);
  });
  it('kampania nie mutuje samodzielnego wariantu, konfiguracji ani poprzedniego stanu', () => {
    const s = createCampaign();
    const original = structuredClone(s);
    finish(invest(0, 'remote-access'));
    expect(s).toEqual(original);
    expect(
      createScenarioRun('unknown', 0).access.accounts.every(
        (a) => a.mfaPolicy === 'not-required',
      ),
    ).toBe(true);
  });
});

describe('MFA, reguły podmiotowe i prywatność', () => {
  it('korekta wdrożonej segmentacji kosztuje godzinę administratora, bez drugiej płatności', () => {
    const first = finish(invest(0, 'segmentation'));
    const headquarters = step(first, { type: 'return-headquarters' });
    const updated = step(headquarters, {
      type: 'set-segmentation-scope',
      scope: 'document-users',
    });
    expect(updated.preparation.hour).toBe(1);
    expect(updated.work.at(-1)).toMatchObject({
      workerId: 'administrator',
      hoursWorked: 1,
      status: 'completed',
    });
    expect(updated.budget).toEqual(headquarters.budget);
    expect(updated.posture.segmentationScope).toBe('document-users');
  });
  it('hasło bez drugiego składnika nie wydaje sesji; prawidłowy składnik pozwala legalnie pracować', () => {
    const s = invest(0, 'remote-access').incident!;
    const request = {
      sessionId: 'MFA-test',
      accountId: 'dispatch-team',
      credentialVersion: 1,
    };
    expect(issueVpnSession(s.world, s.access, request, 840)).toEqual({
      ok: false,
      reason: 'mfa-required',
    });
    expect(
      issueVpnSession(
        s.world,
        s.access,
        { ...request, secondFactorVersion: 9 },
        840,
      ).ok,
    ).toBe(false);
    expect(
      issueVpnSession(
        s.world,
        s.access,
        { ...request, secondFactorVersion: 1 },
        840,
      ).ok,
    ).toBe(true);
  });
  it('włączenie MFA nie kończy istniejącego tunelu', () => {
    const s = createScenarioRun('unknown', 0);
    const access = {
      ...s.access,
      accounts: s.access.accounts.map((a) => ({
        ...a,
        mfaPolicy: 'required' as const,
        secondFactorVersion: 1,
      })),
    };
    expect(access.sessions).toBe(s.access.sessions);
    expect(canUseService(s.world, access, 'S-19', 'fs-01', 'SMB', 840)).toBe(
      true,
    );
  });
  it('MFA przed próbą 13:58 nie tworzy S-19 ani fikcyjnego sukcesu', () => {
    const s = invest(0, 'remote-access').incident!;
    expect(s.hidden.scenario.kind).toBe('unauthorized-session');
    expect(s.access.sessions.some((v) => v.id === 'S-19')).toBe(false);
    expect(s.telemetry.sourceEvents.some((e) => e.sessionId === 'S-19')).toBe(
      false,
    );
    expect(
      s.telemetry.sourceEvents.find((e) => e.minute === 838),
    ).toMatchObject({
      outcome: 'failure',
      reason: 'mfa-required',
      sessionId: null,
    });
    expect(s.access.sessions.some((v) => v.id === 'B-01')).toBe(true);
  });
  it('Marta w B przechodzi MFA własnym składnikiem i zachowuje potrzebny SMB', () => {
    const s = invest(1, 'remote-access').incident!;
    expect(s.access.sessions.find((v) => v.id === 'S-19')?.accountId).toBe(
      'magazyn-07',
    );
    expect(canUseService(s.world, s.access, 'S-19', 'fs-01', 'SMB', 840)).toBe(
      true,
    );
  });
  it('kolejne legalne logowania także muszą przedstawić rzeczywisty składnik', () => {
    let s = invest(2, 'remote-access');
    s = step(
      s,
      {
        type: 'incident-command',
        command: {
          type: 'schedule-task',
          workerId: 'administrator',
          action: { type: 'set-vpn', assetId: 'vpn', enabled: false },
        },
      },
      turn,
      {
        type: 'incident-command',
        command: {
          type: 'schedule-task',
          workerId: 'administrator',
          action: { type: 'set-vpn', assetId: 'vpn', enabled: true },
        },
      },
      turn,
    );
    expect(
      s.incident!.access.sessions.some(
        (v) => v.status === 'active' && v.accountId === 'file-team',
      ),
    ).toBe(true);
    expect(s.incident!.hidden.attacker!.authenticationAttempts).toBe(0);
    expect(finish(s).incident!.hidden.attacker!.transfer.exposedRecords).toBe(
      0,
    );
  });
  it('segmentacja rozstrzyga tożsamość, a nie pochodzenie sesji; HTTPS i SMB oddzielnie', () => {
    const s = invest(1, 'segmentation').incident!;
    expect(canUseService(s.world, s.access, 'S-19', 'fs-01', 'SMB', 840)).toBe(
      false,
    );
    expect(canUseService(s.world, s.access, 'S-19', 'erp', 'HTTPS', 840)).toBe(
      true,
    );
    expect(
      networkAllows(s.world, s.access, {
        sourceAssetId: 'vpn',
        targetAssetId: 'fs-01',
        protocol: 'SMB',
        accountId: 'unknown',
      }),
    ).toBe(false);
    const forged = {
      ...s,
      hidden: {
        ...s.hidden,
        sessionOrigins: { 'S-19': 'unauthorized' as const },
      },
    };
    expect(
      canUseService(forged.world, forged.access, 'S-19', 'fs-01', 'SMB', 840),
    ).toBe(false);
  });
  it('pierwsza reguła według priorytetu/ID, domyślna odmowa i stare reguły działają', () => {
    const s = createScenarioRun('unknown', 0);
    expect(canUseService(s.world, s.access, 'S-19', 'fs-01', 'SMB', 840)).toBe(
      true,
    );
    const rules = [
      {
        ...s.access.rules[1]!,
        id: 'a',
        priority: 0,
        action: 'deny' as const,
        accountIds: ['magazyn-07'],
      },
      ...s.access.rules,
    ];
    expect(
      canUseService(
        s.world,
        { ...s.access, rules },
        'S-19',
        'fs-01',
        'SMB',
        840,
      ),
    ).toBe(false);
  });
  it('centrala nie ujawnia typu ani planu przyszłego incydentu', () => {
    const a = selectStrategyView(createCampaign(0));
    const c = selectStrategyView(createCampaign(2));
    expect(a).toEqual(c);
    const text = JSON.stringify(a);
    for (const key of [
      'attacker',
      'privateHistory',
      'stolenCredentialVersion',
      'nextAction',
      'nextSeed',
      'nexus-reference',
      'nexus-stolen-credential',
    ])
      expect(text).not.toContain(key);
  });
});

describe('audyt FS-01 jako źródło rzeczywistych prób', () => {
  it('projekt B obserwuje odczyt, nie zapobiega mu', () => {
    const s = finish(invest(0, 'file-visibility')).incident!;
    const events = s.telemetry.fileAudit!.sourceEvents;
    expect(events.map((e) => e.operation)).toEqual([
      'list',
      'open',
      'read',
      'read',
      'read',
    ]);
    expect(
      events
        .filter((e) => e.recordsRead !== null)
        .reduce((n, e) => n + e.recordsRead!, 0),
    ).toBe(2000);
    expect(s.hidden.attacker!.transfer.exposedRecords).toBe(2000);
  });
  it('bez wdrożenia nie istnieją źródło ani dowód; zlecenie jest odrzucane', () => {
    let s = invest(0).incident!;
    s = simulationReducer(s, {
      type: 'schedule-task',
      workerId: 'analyst',
      action: { type: 'inspect-file-access' },
    });
    expect(s.telemetry.fileAudit).toBeUndefined();
    expect(s.knowledge.fileObservations).toBeUndefined();
    expect(s.history.at(-1)).toMatchObject({
      kind: 'command-rejected',
      reason: 'source-unavailable',
    });
  });
  it('legalny B także wytwarza odczyty; zero klasyfikacji po ukrytej prawdzie', () => {
    const s = finish(invest(1, 'file-visibility')).incident!;
    expect(s.hidden.attacker).toBeNull();
    expect(s.telemetry.fileAudit!.sourceEvents).toHaveLength(18);
    expect(
      s.telemetry.fileAudit!.sourceEvents.every(
        (e) =>
          e.accountId === 'magazyn-07' &&
          e.operation === 'read' &&
          e.recordsRead === 6,
      ),
    ).toBe(true);
    for (const r of s.telemetry.fileAudit!.records)
      expect(Object.keys(r)).not.toContain('malicious');
  });
  it('dowód dostępny po opóźnieniu, nie ujawnia przyszłego read', () => {
    let s = invest(0, 'file-visibility').incident!;
    for (let i = 0; i < 4; i++)
      s = simulationReducer(s, { type: 'advance-turn' });
    const first = readFileAccess(s, 'test')!;
    expect(first.records.some((r) => r.operation === 'read')).toBe(false);
    s = simulationReducer(s, {
      type: 'schedule-task',
      workerId: 'analyst',
      action: { type: 'inspect-file-access' },
    });
    s = simulationReducer(s, { type: 'advance-turn' });
    expect(
      s.knowledge
        .fileObservations![0]!.records.filter((r) => r.operation === 'read')
        .map((r) => r.recordsRead),
    ).toEqual([400]);
    expect(
      selectPlayerView(s).fileObservations[0]!.records.some(
        (r) => r.recordsRead === 800,
      ),
    ).toBe(false);
  });
  it('serwer nie widzi żądania zatrzymanego w sieci, ale widzi odmowę uprawnienia', () => {
    const base = invest(0, 'file-visibility').incident!;
    const noPermission = {
      ...base,
      access: {
        ...base.access,
        permissions: base.access.permissions.filter(
          (p) => p.accountId !== 'magazyn-07',
        ),
      },
    };
    const denied = attemptFileAccess(
      noPermission,
      'S-19',
      'fs-01',
      'read',
      400,
    );
    expect(denied.allowed).toBe(false);
    expect(denied.state.telemetry.fileAudit!.sourceEvents[0]).toMatchObject({
      outcome: 'denied',
      recordsRead: null,
    });
    const blocked = {
      ...base,
      access: {
        ...base.access,
        rules: base.access.rules.map((r) =>
          r.id === 'R-SMB' ? { ...r, action: 'deny' as const } : r,
        ),
      },
    };
    expect(
      attemptFileAccess(blocked, 'S-19', 'fs-01', 'read', 400).state.telemetry
        .fileAudit!.sourceEvents,
    ).toEqual([]);
  });
  it('sensor nie odtwarza źródeł po braku pokrycia i nie czyta wyłączonego FS', () => {
    let s = invest(0, 'file-visibility').incident!;
    s = {
      ...s,
      telemetry: {
        ...s.telemetry,
        fileAudit: {
          ...s.telemetry.fileAudit!,
          sensor: { ...s.telemetry.fileAudit!.sensor, enabled: false },
        },
      },
    };
    expect(
      attemptFileAccess(s, 'S-19', 'fs-01', 'read', 400).state.telemetry
        .fileAudit!.sourceEvents,
    ).toEqual([]);
    const offline = {
      ...s,
      world: {
        ...s.world,
        assets: s.world.assets.map((a) =>
          a.id === 'fs-01' ? { ...a, status: 'offline' as const } : a,
        ),
      },
    };
    expect(readFileAccess(offline, 'x')).toBeNull();
    expect(updateTelemetry(offline).telemetry.fileAudit!.records).toEqual([]);
  });
  it('te same inwestycje, seedy i komendy dają identyczny autorytatywny stan', () => {
    expect(finish(next(finish(invest(0, 'file-visibility'))))).toEqual(
      finish(next(finish(invest(0, 'file-visibility')))),
    );
  });
  it('audyt nie dodaje uprawnień, a zmiana hidden nie zmienia pomiaru tej samej próby', () => {
    const s = invest(0, 'file-visibility').incident!;
    const a = attemptFileAccess(s, 'S-19', 'fs-01', 'read', 12);
    const b = attemptFileAccess(
      {
        ...s,
        hidden: {
          ...s.hidden,
          attacker: null,
          sessionOrigins: { 'S-19': 'legitimate' },
        },
      },
      'S-19',
      'fs-01',
      'read',
      12,
    );
    expect(a.state.telemetry).toEqual(b.state.telemetry);
    expect(a.state.access).toBe(s.access);
  });
});
