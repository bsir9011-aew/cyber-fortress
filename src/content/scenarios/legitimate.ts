import type { ScenarioDefinition } from '../../domain/scenario';
import { referenceScenario } from './reference';

export const legitimateScenario: ScenarioDefinition = {
  ...referenceScenario,
  id: 'nexus-legitimate',
  name: 'Legalna sesja z laptopa zastępczego',
  kind: 'legitimate-session',
  explanation:
    'Alert poprawnie wykrył wiele odmów uwierzytelnienia. Próby pochodziły z legalnego klienta Marty używającego nieaktualnych ustawień; po ich poprawieniu o 13:58 powstała jej sesja S-19. W tym wariancie nie było napastnika ani skradzionego poświadczenia. Relację Marty należało zestawić z historycznym sukcesem, aktywnym tunelem i udokumentowaną rolą w obsłudze plików.',
  process: {
    ...referenceScenario.process,
    remoteCapacity: 8,
    additionalWork: [
      {
        id: 'shipping-files',
        name: 'Dokumenty wysyłkowe FS-01',
        capacity: 6,
        accountId: 'magazyn-07',
        services: [
          { targetAssetId: 'erp', protocol: 'HTTPS' },
          { targetAssetId: 'fs-01', protocol: 'SMB' },
        ],
      },
    ],
  },
  access: {
    ...referenceScenario.access,
    sessions: [],
    permissions: [
      ...referenceScenario.access.permissions,
      { accountId: 'magazyn-07', targetAssetId: 'erp', protocol: 'HTTPS' },
    ],
  },
  telemetry: {
    ...referenceScenario.telemetry,
    sourceEvents: [],
    authenticationRecords: [],
    processedSourceCount: 0,
  },
  initialSessionOrigins: {},
  legitimateBehaviors: [
    ...referenceScenario.legitimateBehaviors,
    {
      id: 'marta-client',
      accountId: 'magazyn-07',
      credentialPolicy: 'fixed',
      credentialVersion: 1,
      reconnectDelayTurns: 1,
      sessionIdPrefix: 'M-reconnect',
    },
  ],
  authenticationPrelude: [
    ...Array.from({ length: 52 }, (_, index) => ({
      actorId: 'marta-client',
      minute: 13 * 60 + 40 + Math.floor(index / 3),
      credentialVersion: 0,
      requestedSessionId: `M-failed-${index + 1}`,
    })),
    {
      actorId: 'marta-client',
      minute: 838,
      credentialVersion: 1,
      requestedSessionId: 'S-19',
    },
    {
      actorId: 'dispatch',
      minute: 840,
      credentialVersion: 1,
      requestedSessionId: 'B-01',
    },
  ],
  attacker: null,
  goals: { ...referenceScenario.goals, requireThreatContainment: false },
  witnesses: [
    {
      accountId: 'magazyn-07',
      speaker: 'Marta',
      referencedMinute: 838,
      text: 'O 13:58 zalogowałam się z laptopa zastępczego. Klient miał zapisane stare ustawienia uwierzytelniania; poprawiłam je. Przygotowuję przez VPN dokumenty wysyłkowe na FS-01.',
    },
  ],
};
