import type { ScenarioDefinition } from '../../domain/scenario';
import { nexusInfrastructure } from '../nexusInfrastructure';
import { nexusSimulation } from '../nexusSimulation';
import { nexusAttack } from '../nexusAttack';
import {
  nexusBriefing,
  nexusOwnerAccount,
  nexusTelemetry,
} from '../nexusIncident';

export const referenceScenario: ScenarioDefinition = {
  id: 'nexus-reference',
  name: 'Przejęty tunel',
  kind: 'unauthorized-session',
  explanation:
    'Przeciwnik użył wcześniej przejętego poświadczenia i uzyskał S-19 o 13:58. Błędy logowania uzasadniały alert, lecz nie dowodziły sposobu zdobycia hasła. Marta zaprzeczyła uruchomieniu sesji. Istniejący tunel zachowywał dostęp mimo blokady nowych logowań lub resetu.',
  world: nexusInfrastructure,
  clock: nexusSimulation.clock,
  process: nexusSimulation.process,
  access: nexusSimulation.access,
  telemetry: nexusTelemetry,
  initialSessionOrigins: nexusSimulation.hidden.sessionOrigins,
  authenticationPrelude: [],
  legitimateBehaviors: [
    {
      id: 'dispatch',
      accountId: 'dispatch-team',
      credentialPolicy: 'managed-current',
      credentialVersion: 1,
      reconnectDelayTurns: 0,
      sessionIdPrefix: 'B-reconnect',
    },
  ],
  attacker: nexusAttack,
  witnesses: [nexusOwnerAccount],
  goals: {
    recordPool: 2000,
    maxExposedRecords: 0,
    maxFinalBacklog: 40,
    requireThreatContainment: true,
  },
  briefing: nexusBriefing,
};
