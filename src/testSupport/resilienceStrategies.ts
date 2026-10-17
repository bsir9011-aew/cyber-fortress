import { budgetBalance } from '../application/campaignReducer';
import { selectIntegrityReport } from '../application/selectIntegrityReport';
import {
  advance,
  deployed,
  edr,
  examine,
  finish,
  inspect,
  inventory,
  isolate,
  job,
  nextMission,
  order,
  reconnect,
  restore,
  restrict,
} from './resilience';
import type { ProjectId } from '../domain/campaign';
export type StrategyId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export const strategyNames: Record<StrategyId, string> = {
  A: 'Bez inwestycji i reakcji',
  B: 'Ręczna reakcja, FS-1320 i uzgodnienie',
  C: 'EDR wykorzystany, FS-1320 i uzgodnienie',
  D: 'Backup wykorzystany, ręczne dochodzenie',
  E: 'EDR i Backup wykorzystane',
  F: 'EDR, alert zignorowany',
  G: 'Backup bez ograniczenia źródła',
};
export function runResilienceStrategy(id: StrategyId) {
  const projects: ProjectId[] =
    id === 'C' || id === 'F'
      ? ['endpoint-edr']
      : id === 'D' || id === 'G'
        ? ['backup-resilience']
        : id === 'E'
          ? ['endpoint-edr', 'backup-resilience']
          : [];
  const campaign = nextMission(deployed(projects));
  let s = campaign.incident!;
  if (id === 'B' || id === 'C' || id === 'D' || id === 'E') {
    s =
      id === 'C' || id === 'E'
        ? advance(order(order(job(s, edr), isolate), inventory))
        : job(advance(order(order(s, isolate), examine), 2), inventory);
    s = job(
      s,
      id === 'D' || id === 'E'
        ? restore
        : { type: 'restore-documents', backupId: 'FS-1320' },
    );
    s = advance(
      order(
        order(s, restrict),
        id === 'B' || id === 'C' ? { type: 'reconcile-documents' } : inspect,
      ),
      2,
    );
    s =
      id === 'B' || id === 'C'
        ? advance(order(order(s, reconnect), inspect), 2)
        : job(s, reconnect);
  }
  if (id === 'G') s = job(job(job(s, inventory), restore), inspect);
  s = finish(s);
  const report = selectIntegrityReport(s)!;
  const firstEDR = report.investments.edr?.firstEvidenceMinute ?? null;
  const firstLocal = report.investments.firstLocalEvidenceMinute;
  const evidence = [firstEDR, firstLocal].filter(
    (m): m is number => m !== null,
  );
  const firstIsolation = s.tasks.find(
    (t) => t.action.type === 'isolate-endpoint' && t.status === 'completed',
  );
  return {
    state: s,
    report,
    result: {
      strategy: id,
      name: strategyNames[id],
      seed: s.run.seed,
      firstEvidenceMinute: evidence.length ? Math.min(...evidence) : null,
      firstIsolationMinute: firstIsolation
        ? s.clock.startMinute + firstIsolation.dueTurn * s.clock.turnMinutes
        : null,
      ...report.summary,
      processed: s.business.totalProcessed,
      backlog: s.business.backlog,
      restoreMinutes: report.investments.restoreMinutes,
      funding: campaign.funding,
      budget: budgetBalance(campaign),
      projects,
    },
  };
}
