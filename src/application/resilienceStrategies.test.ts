import { it, expect } from 'vitest';
import { runResilienceStrategy } from '../testSupport/resilienceStrategies';
import type { StrategyId } from '../testSupport/resilienceStrategies';
import { sameJson } from '../persistence/saveFormat';
const ids: StrategyId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
it.each(ids)(
  'pełny deterministyczny przebieg strategii %s od kampanii',
  (id) => {
    const a = runResilienceStrategy(id),
      b = runResilienceStrategy(id);
    expect(sameJson(a.state, b.state)).toBe(true);
    expect(a.result).toEqual(b.result);
    expect(a.state.clock.turn).toBe(18);
    expect(a.result.budget.available).toBeGreaterThanOrEqual(0);
    expect(a.result.funding?.allocations).toHaveLength(1);
    if (['B', 'C', 'D', 'E'].includes(id)) {
      expect(a.report.goalMet).toBe(true);
      expect(a.result.correct).toBe(100);
    } else {
      expect(a.report.goalMet).toBe(false);
      expect(a.result.sourceHasWrite).toBe(true);
    }
  },
);
it('ręczna reakcja przewyższa ignorowany EDR; zakup sam nie daje bezpieczeństwa', () => {
  const manual = runResilienceStrategy('B'),
    ignored = runResilienceStrategy('F'),
    plain = runResilienceStrategy('A');
  expect(manual.result.processed).toBeGreaterThan(ignored.result.processed);
  expect(ignored.result.correct).toBe(plain.result.correct);
  expect(ignored.result.processed).toBe(plain.result.processed);
  expect(ignored.report.investments.edr?.firstEvidenceMinute).toBeNull();
});
it('wykorzystana telemetria przyspiesza dowód i kontrolę bez zmiany zakresu kopii', () => {
  const manual = runResilienceStrategy('B').result,
    edr = runResilienceStrategy('C').result;
  expect(edr.firstEvidenceMinute).toBe(845);
  expect(manual.firstEvidenceMinute).toBe(850);
  expect(edr.rtoMinutes).toBeLessThan(manual.rtoMinutes!);
  expect(edr.rpoMinutes).toBe(manual.rpoMinutes);
});
it('testowana kopia skraca czas restore i RTO, nie zmienia jej RPO ani nie zatrzymuje źródła', () => {
  const backup = runResilienceStrategy('D').result,
    both = runResilienceStrategy('E').result,
    uncontained = runResilienceStrategy('G').result;
  expect(backup.restoreMinutes).toBe(10);
  expect(backup.rpoMinutes).toBe(10);
  expect(both.rtoMinutes).toBeLessThan(backup.rtoMinutes!);
  expect(uncontained.restoreMinutes).toBe(10);
  expect(uncontained.damaged).toBeGreaterThan(0);
  expect(uncontained.sourceHasWrite).toBe(true);
});
