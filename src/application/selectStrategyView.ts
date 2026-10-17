import type { CampaignState } from '../domain/campaign';
import { referenceScenario } from '../content/scenarios/reference';
import { securityProjects } from '../content/securityProjects';
import { budgetBalance } from './campaignReducer';

/** Jawne fakty firmy; brak bieżącego/planowanego wariantu, hidden i planów aktorów. */
export function selectStrategyView(state: CampaignState) {
  return {
    organization: { name: 'NEXUS Logistics', employees: 120, computers: 94 },
    budget: budgetBalance(state),
    ledger: state.budget.ledger,
    preparation: state.preparation,
    work: state.work,
    posture: state.posture,
    projects: securityProjects.map((definition) => ({
      ...definition,
      ...state.projects.find((p) => p.id === definition.id)!,
    })),
    lastDecision: state.decisions.at(-1) ?? null,
    world: {
      ...referenceScenario.world,
      assets: referenceScenario.world.assets.map((a) => ({
        ...a,
        status: state.posture.assetOverrides[a.id] ?? a.status,
      })),
    },
    // Raporty tylko zakończonych misji wolno ujawnić w centrali.
    history: state.history,
  };
}
