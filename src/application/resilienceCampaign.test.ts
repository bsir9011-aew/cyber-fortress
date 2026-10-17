import { describe, it, expect } from 'vitest';
import {
  campaignReducer,
  createCampaign,
  budgetBalance,
} from './campaignReducer';
import { createCampaignIncident } from './prepareCampaignIncident';
import { selectStrategyView } from './selectStrategyView';
import {
  assign,
  deployed,
  finishCampaign,
  fund,
  hour,
  hq,
  nextMission,
  prepare,
  reserve,
  reviewed,
  workHour,
} from '../testSupport/resilience';

describe('Etap II: jawna jednorazowa alokacja i rzeczywiste wdrożenia', () => {
  it('zachowuje historyczny stan początkowy: 80000, trzy projekty, brak alokacji', () => {
    const s = createCampaign();
    expect(s.budget.total).toBe(80000);
    expect(s.projects).toHaveLength(3);
    expect(s.funding).toBeUndefined();
    expect(budgetBalance(s).available).toBe(68000);
    expect(campaignReducer(s, fund).budget).toEqual(s.budget);
    expect(
      campaignReducer(s, { type: 'plan-project', projectId: 'endpoint-edr' })
        .projects,
    ).toEqual(s.projects);
  });
  it('sam M01, start M02 i raport poza centralą nie przyznają transzy', () => {
    const first = campaignReducer(
      finishCampaign(nextMission(createCampaign(), 'start-incident')),
      hq,
    );
    expect(selectStrategyView(first).eligibleForFunding).toBe(false);
    expect(campaignReducer(first, fund).funding).toBeUndefined();
    const active = nextMission(first);
    expect(campaignReducer(active, fund).budget.total).toBe(80000);
    expect(
      campaignReducer(finishCampaign(active), fund).funding,
    ).toBeUndefined();
  });
  it('przyjmuje transzę również po porażce, zachowując wcześniejsze rezerwacje i wydatki', () => {
    const old = reserve(reviewed(), 'file-visibility');
    expect(old.history.at(-1)?.integrity?.correct).toBe(0);
    const next = campaignReducer(old, fund);
    expect(next.budget.total).toBe(105000);
    expect(next.budget.ledger).toEqual(old.budget.ledger);
    expect(next.projects.slice(0, 3)).toEqual(old.projects);
    expect(next.projects.slice(3).map((p) => p.status)).toEqual([
      'available',
      'available',
    ]);
    expect(next.funding).toEqual({
      initialAllocation: 80000,
      allocations: [
        {
          id: 'board-resilience-ii',
          source: 'integrity-risk-review',
          amount: 25000,
          window: 3,
          reportNumber: 2,
        },
      ],
    });
  });
  it('kolejne komendy i powtórzona M02 nie dublują alokacji ani katalogu', () => {
    let s = campaignReducer(reviewed(), fund);
    s = campaignReducer(s, fund);
    s = campaignReducer(finishCampaign(nextMission(s)), hq);
    s = campaignReducer(s, fund);
    expect(s.budget.total).toBe(105000);
    expect(s.funding?.allocations).toHaveLength(1);
    expect(s.projects).toHaveLength(5);
  });
  it('przy 60000 wydatków pozostaje 45000 i wystarcza na jeden nowy projekt', () => {
    let s = createCampaign();
    for (const id of ['remote-access', 'file-visibility'] as const)
      s = reserve(s, id);
    s = assign(
      assign(s, 'remote-access', 'administrator'),
      'file-visibility',
      'analyst',
    );
    s = prepare(s);
    s = assign(
      campaignReducer(finishCampaign(nextMission(s, 'start-incident')), hq),
      'file-visibility',
      'administrator',
    );
    s = campaignReducer(finishCampaign(nextMission(s)), hq);
    s = campaignReducer(s, fund);
    expect(budgetBalance(s)).toMatchObject({ spent: 60000, available: 45000 });
    s = reserve(reserve(s, 'endpoint-edr'), 'backup-resilience');
    expect(budgetBalance(s).available).toBe(21000);
    expect(s.projects.find((p) => p.id === 'backup-resilience')?.status).toBe(
      'planned',
    );
    expect(s.decisions.at(-1)?.result).toBe('rejected');
  });
  it.each([
    ['endpoint-edr', 2, 2, 24000],
    ['backup-resilience', 3, 2, 28000],
  ] as const)(
    '%s wymaga obu wykonawców i pełnych godzin',
    (id, admin, analyst, cost) => {
      let s = reserve(campaignReducer(reviewed(), fund), id);
      expect(s.projects.find((p) => p.id === id)?.remaining).toEqual({
        administrator: admin,
        analyst,
      });
      s = assign(s, id, 'administrator');
      for (let n = 0; n < admin; n++) s = campaignReducer(s, hour);
      expect(s.projects.find((p) => p.id === id)?.status).toBe('in-progress');
      expect(s.posture.endpointCoverage).toBeUndefined();
      expect(s.posture.backupReadiness).toBeUndefined();
      expect(budgetBalance(s).spent).toBe(12000 + cost);
      const complete = deployed([id]);
      expect(complete.projects.find((p) => p.id === id)?.status).toBe(
        'completed',
      );
      expect(
        complete.budget.ledger.filter(
          (e) =>
            e.kind === 'payment' &&
            e.projectId === id &&
            e.result === 'applied',
        ),
      ).toHaveLength(1);
    },
  );
  it('obie inwestycje: 5 godzin admina, częściowa praca i pojedyncza płatność', () => {
    let s = reserve(
      reserve(campaignReducer(reviewed(), fund), 'endpoint-edr'),
      'backup-resilience',
    );
    for (let n = 0; n < 4; n++)
      s = workHour(s, ['endpoint-edr', 'backup-resilience']);
    expect(s.posture.endpointCoverage?.endpointId).toBe('pakowanie-03');
    expect(s.posture.backupReadiness).toBeUndefined();
    expect(
      s.projects.find((p) => p.id === 'backup-resilience')?.remaining,
    ).toEqual({ administrator: 1, analyst: 0 });
    const before = budgetBalance(s);
    s = campaignReducer(finishCampaign(nextMission(s)), hq);
    s = workHour(s, ['backup-resilience']);
    expect(s.posture.backupReadiness?.restoreTestPassed).toBe(true);
    expect(budgetBalance(s)).toEqual(before);
    expect(
      s.work
        .filter((w) => w.projectId === 'backup-resilience')
        .reduce((n, w) => n + w.hoursWorked, 0),
    ).toBe(5);
    expect(
      s.budget.ledger.filter(
        (e) => e.projectId === 'backup-resilience' && e.kind === 'payment',
      ),
    ).toHaveLength(1);
    expect(budgetBalance(s).available).toBe(41000);
  });
  it('dziedziczy gotowość, ale odświeża dowody, zadania i uszkodzenia kolejnej M02', () => {
    let s = deployed(['endpoint-edr', 'backup-resilience']);
    const posture = s.posture;
    s = campaignReducer(finishCampaign(nextMission(s)), hq);
    const next = nextMission(s);
    expect(
      next.history.filter((r) => r.scenarioId !== 'nexus-last-clean-copy'),
    ).toHaveLength(1);
    expect(next.posture).toEqual({
      ...posture,
      endpointOverrides: s.posture.endpointOverrides,
    });
    expect(next.incident?.telemetry.endpoint?.observations).toEqual([]);
    expect(next.incident?.tasks).toEqual([]);
    expect(
      next.incident?.integrity?.documents.filter((d) => d.status === 'damaged'),
    ).toHaveLength(12);
    expect(next.incident?.telemetry.endpoint?.alerts).toHaveLength(1);
  });
});

it.each([0, 1, 2])(
  'nowe przygotowanie nie zmienia historycznego świata M01 seed %i',
  (seed) => {
    const baseline = createCampaignIncident(seed, createCampaign().posture);
    const completed = deployed(['endpoint-edr', 'backup-resilience']).posture;
    expect(
      createCampaignIncident(seed, {
        ...createCampaign().posture,
        endpointCoverage: completed.endpointCoverage!,
        backupReadiness: completed.backupReadiness!,
      }),
    ).toEqual(baseline);
  },
);
