import { it, expect } from 'vitest';
import failure from '../../docs/aar-examples/01-m01-failure.json?raw';
import businessCost from '../../docs/aar-examples/02-m01-success-business-cost.json?raw';
import partial from '../../docs/aar-examples/03-m02-isolation-without-recovery.json?raw';
import schema from '../../docs/fortress-aar-v1.schema.json';
import { createAfterActionReport } from './createAfterActionReport';
import { validateAfterActionReport } from './validateAfterActionReport';
import { playAarScenario } from '../testSupport/aar';
import type { AarScenarioId } from '../testSupport/aar';
import type { FortressAfterActionReportV1 } from '../domain/afterActionReport';
it.each([
  ['B', failure],
  ['C', businessCost],
  ['D', partial],
] as const)(
  'przykład %s jest dokładnie wynikiem prawdziwego replay, zgodnym z kontraktem',
  (id, text) => {
    const report = JSON.parse(text) as FortressAfterActionReportV1;
    const expected = createAfterActionReport(
      playAarScenario(id as AarScenarioId),
      undefined,
      report.generatedAt,
    );
    expect(expected.ok).toBe(true);
    if (!expected.ok) return;
    expect(report).toEqual(expected.value);
    expect(Object.keys(report).sort()).toEqual([...schema.required].sort());
    expect(validateAfterActionReport(report).ok).toBe(true);
  },
);
