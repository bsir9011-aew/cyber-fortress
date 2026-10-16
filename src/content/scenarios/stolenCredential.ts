import type { ScenarioDefinition } from '../../domain/scenario';
import { referenceScenario } from './reference';

export const stolenCredentialScenario: ScenarioDefinition = {
  ...referenceScenario,
  id: 'nexus-stolen-credential',
  name: 'Przejęte poświadczenie bez tunelu',
  kind: 'stolen-credential',
  explanation:
    'Przeciwnik znał wersję 1 poświadczenia magazyn-07, lecz na początku nie posiadał żadnego tunelu. Nie było sukcesu ani S-19 z 13:58. Pierwsze logowanie zaplanowano na 14:15. Odrzucenie starej wersji lub nowych logowań mogło zapobiec uzyskaniu dostępu bez wyłączania legalnego SMB.',
  process: {
    ...referenceScenario.process,
    remoteCapacity: 8,
    additionalWork: [
      {
        id: 'shipping-files',
        name: 'Dokumenty wysyłkowe FS-01',
        capacity: 6,
        accountId: 'file-team',
        services: [
          { targetAssetId: 'erp', protocol: 'HTTPS' },
          { targetAssetId: 'fs-01', protocol: 'SMB' },
        ],
      },
    ],
  },
  access: {
    ...referenceScenario.access,
    identities: [
      ...referenceScenario.access.identities,
      { id: 'file-operators', name: 'Zespół dokumentów wysyłkowych' },
    ],
    accounts: [
      ...referenceScenario.access.accounts,
      {
        id: 'file-team',
        identityId: 'file-operators',
        loginStatus: 'enabled',
        credentialVersion: 1,
        mfaPolicy: 'not-required',
      },
    ],
    sessions: [
      referenceScenario.access.sessions.find(
        (session) => session.id === 'B-01',
      )!,
      {
        id: 'F-01',
        accountId: 'file-team',
        gatewayAssetId: 'vpn',
        status: 'active',
        startedAtMinute: 840,
        expiresAtMinute: 960,
      },
    ],
    permissions: [
      ...referenceScenario.access.permissions,
      { accountId: 'file-team', targetAssetId: 'erp', protocol: 'HTTPS' },
      { accountId: 'file-team', targetAssetId: 'fs-01', protocol: 'SMB' },
    ],
  },
  telemetry: {
    ...referenceScenario.telemetry,
    sourceEvents: [
      ...referenceScenario.telemetry.sourceEvents.filter(
        (event) => event.outcome === 'failure',
      ),
      {
        id: 'AUTH-0053',
        minute: 840,
        sourceAssetId: 'vpn',
        accountId: 'dispatch-team',
        outcome: 'success',
        sessionId: 'B-01',
      },
      {
        id: 'AUTH-0054',
        minute: 840,
        sourceAssetId: 'vpn',
        accountId: 'file-team',
        outcome: 'success',
        sessionId: 'F-01',
      },
    ],
  },
  initialSessionOrigins: { 'B-01': 'legitimate', 'F-01': 'legitimate' },
  legitimateBehaviors: [
    ...referenceScenario.legitimateBehaviors,
    {
      id: 'file-operators',
      accountId: 'file-team',
      credentialPolicy: 'managed-current',
      credentialVersion: 1,
      reconnectDelayTurns: 0,
      sessionIdPrefix: 'F-reconnect',
    },
  ],
  attacker: {
    ...referenceScenario.attacker!,
    id: 'nexus-credential-theft',
    initialSessionId: null,
    firstAuthenticationTurn: 3,
  },
  witnesses: [
    {
      accountId: 'magazyn-07',
      speaker: 'Marta',
      referencedMinute: 837,
      text: 'Jestem dziś w biurze. Nie uruchamiałam sesji zdalnej i nie rozpoznaję tych prób logowania. Dokumenty przez VPN obsługuje osobny zespół file-team.',
    },
  ],
};
