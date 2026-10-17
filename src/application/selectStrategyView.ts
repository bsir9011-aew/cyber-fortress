import {
  endpointAgentAvailable,
  endpointChannelAvailable,
} from '../simulation/endpointTelemetry';
import { integrityScenario } from '../content/scenarios/integrity';
import type { CampaignState } from '../domain/campaign';
import { referenceScenario } from '../content/scenarios/reference';
import { projectDefinition } from '../content/securityProjects';
import { budgetBalance } from './campaignReducer';

/** Jawne fakty firmy; brak bieżącego/planowanego wariantu, hidden i planów aktorów. */
export function selectStrategyView(state: CampaignState) {
  const world = {
    ...referenceScenario.world,
    assets: referenceScenario.world.assets.map((a) => ({
      ...a,
      status: state.posture.assetOverrides[a.id] ?? a.status,
    })),
  };
  const coverage = state.posture.endpointCoverage;
  const endpoint = {
    ...integrityScenario.integrity!.endpoint,
    ...state.posture.endpointOverrides?.['pakowanie-03'],
  };
  return {
    organization: { name: 'NEXUS Logistics', employees: 120, computers: 94 },
    budget: budgetBalance(state),
    ledger: state.budget.ledger,
    preparation: state.preparation,
    work: state.work,
    posture: state.posture,
    resilience: {
      coverage,
      backup: state.posture.backupReadiness,
      agentOnline: coverage
        ? endpointAgentAvailable(world, endpoint, coverage)
        : false,
      deliveryAvailable: coverage
        ? endpointChannelAvailable(world, endpoint, coverage)
        : false,
    },
    projects: state.projects.map((project) => ({
      ...projectDefinition(project.id),
      ...project,
    })),
    funding: state.funding ?? null,
    eligibleForFunding: state.history.some(
      (r) => r.scenarioId === 'nexus-last-clean-copy',
    ),
    lastDecision: state.decisions.at(-1) ?? null,
    world,
    // Raporty tylko zakończonych misji wolno ujawnić w centrali.
    history: state.history,
  };
}
