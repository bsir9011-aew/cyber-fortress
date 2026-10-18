import type { StrategicSession } from '../gameSession';
import type { MissionReport } from '../selectMissionReport';
import { selectMissionReport } from '../selectMissionReport';
import { createCampaign, campaignReducer } from '../campaignReducer';
import { missionFamily } from './campaignExperience';
import { sameJson } from '../../persistence/saveFormat';
export function reportResult(r: MissionReport) {
  const goals = r.finale
    ? ([
        ['Poufność', r.finale.confidentialityMet],
        ['Integralność', r.finale.integrityMet],
        ['Dostępność', r.finale.servicesMet],
        ['Ciągłość', r.finale.continuityMet],
        ['Uzgodnienie', r.finale.reconciliationMet],
        ['Operational Confidence', r.finale.confidenceMet],
      ] as const)
    : r.branch
      ? ([
          ['Gotowość EAST', r.branch.ready],
          ['Poufność', r.branch.exposedRecords === 0],
          ['Ciągłość', r.continuity.goalMet],
          ['Pozostały dostęp', !r.branch.remainingAccess],
        ] as const)
      : r.recovery
        ? ([
            ['Użyteczne ERP', r.recovery.useful],
            ['Odzyskanie danych', r.recovery.dataRecovery.met],
            ['Pewność operacyjna', r.recovery.operationalConfidence.verified],
            ['Ciągłość', r.continuity.goalMet],
          ] as const)
        : r.integrity
          ? ([
              [
                'Integralność',
                r.integrity.summary.correct === r.integrity.summary.total &&
                  r.integrity.summary.verified &&
                  r.integrity.summary.dataAvailable,
              ],
              ['Ograniczenie źródła', !r.integrity.summary.sourceHasWrite],
              ['Ciągłość', r.continuity.goalMet],
            ] as const)
          : ([
              ['Poufność', r.confidentiality.goalMet],
              ['Ograniczenie dostępu', r.containment.goalMet],
              ['Ciągłość', r.continuity.goalMet],
              ...(r.vendor
                ? [
                    [
                      'Praca dostawcy',
                      r.vendor.summary.completedBatches ===
                        r.vendor.summary.requiredBatches,
                    ] as const,
                  ]
                : []),
            ] as const);
  const met =
    r.finale?.goalMet ??
    r.branch?.goalMet ??
    r.recovery?.goalMet ??
    r.vendor?.goalMet ??
    r.integrity?.goalMet ??
    (r.confidentiality.goalMet &&
      r.continuity.goalMet &&
      r.containment.goalMet !== false);
  const label = r.finale
    ? {
        'full-success': 'Pełny sukces',
        'partial-recovery': 'Częściowe odzyskanie',
        'operational-failure': 'Porażka operacyjna',
        'contained-with-business-unavailable':
          'Zagrożenie ograniczone, działalność niedostępna',
        'operational-success-with-security-breach':
          'Sukces operacyjny z naruszeniem bezpieczeństwa',
      }[r.finale.outcome]
    : met
      ? 'Cele misji osiągnięte'
      : 'Nie wszystkie cele osiągnięte';
  return { met, label, goals };
}
/** Replays only the actual recorded campaign journal, once for completed attempts; never alternatives. Missing journals stay missing. */
export function selectRecordedCampaignHistory(g: StrategicSession) {
  const details = new Map<
    number,
    {
      result: ReturnType<typeof reportResult>;
      actions: Record<string, number>;
      architecture: unknown;
      report: MissionReport;
    }
  >();
  try {
    let s = createCampaign(g.initialSeed),
      architecture: unknown = null;
    for (const c of g.commands) {
      const next = campaignReducer(s, c);
      if (s.phase === 'preparation' && next.phase === 'incident')
        architecture = {
          branch: s.branchArchitecture ?? null,
          accountOverrides: s.posture.accountOverrides,
          ruleOverrides: s.posture.ruleOverrides,
          assetOverrides: s.posture.assetOverrides,
          segmentationScope: s.posture.segmentationScope,
        };
      if (next.history.length > s.history.length && next.incident) {
        const summary = next.history.at(-1)!,
          stored = g.campaign.history.find((r) => r.number === summary.number),
          r = selectMissionReport(next.incident);
        if (r && stored && sameJson(summary, stored)) {
          const actions: Record<string, number> = {};
          for (const t of next.incident.tasks.filter(
            (t) => t.status === 'completed',
          ))
            actions[t.action.type] = (actions[t.action.type] ?? 0) + 1;
          details.set(summary.number, {
            result: reportResult(r),
            actions,
            architecture,
            report: r,
          });
        }
      }
      s = next;
    }
  } catch {
    /* Incomplete older history is displayed without invented details. */
  }
  return g.campaign.history.map((r, n, all) => ({
    ...r,
    family: missionFamily(r),
    repeat: all.slice(0, n).some((p) => missionFamily(p) === missionFamily(r)),
    detail: details.get(r.number) ?? null,
  }));
}
