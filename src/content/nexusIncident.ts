import type { AuthenticationEvent, TelemetryState } from '../domain/telemetry';

/** Jawne dane źródłowe scenariusza. Błędy nie dowodzą sposobu zdobycia hasła. */
export const nexusAuthenticationHistory: readonly AuthenticationEvent[] = [
  ...Array.from(
    { length: 52 },
    (_, index): AuthenticationEvent => ({
      id: `AUTH-${String(index + 1).padStart(4, '0')}`,
      minute: 13 * 60 + 40 + Math.floor(index / 3),
      sourceAssetId: 'vpn',
      accountId: 'magazyn-07',
      outcome: 'failure',
      sessionId: null,
    }),
  ),
  {
    id: 'AUTH-0053',
    minute: 13 * 60 + 58,
    sourceAssetId: 'vpn',
    accountId: 'magazyn-07',
    outcome: 'success',
    sessionId: 'S-19',
  },
  {
    id: 'AUTH-0054',
    minute: 14 * 60,
    sourceAssetId: 'vpn',
    accountId: 'dispatch-team',
    outcome: 'success',
    sessionId: 'B-01',
  },
];

export const nexusTelemetry: TelemetryState = {
  authenticationSensor: {
    id: 'vpn-auth',
    sourceAssetId: 'vpn',
    enabled: true,
    coverageFromMinute: 13 * 60 + 30,
    retentionMinutes: 120,
    delayMinutes: 0,
  },
  sessionSensor: {
    id: 'vpn-active-sessions',
    sourceAssetId: 'vpn',
    enabled: true,
    retentionMinutes: 0,
    delayMinutes: 0,
  },
  sourceEvents: nexusAuthenticationHistory,
  processedSourceCount: 0,
  authenticationRecords: [],
};

export const nexusOwnerAccount = {
  accountId: 'magazyn-07',
  speaker: 'Marta',
  referencedMinute: 13 * 60 + 58,
  text: 'O 13:58 byłam w biurze. Nie uruchamiałam wtedy sesji zdalnej na swoim koncie.',
} as const;

export const nexusBriefing = {
  title: 'Ostatnie okno wysyłkowe',
  message:
    'Do 15:30 musimy zamknąć wysyłki. Zdalni dyspozytorzy potrzebują ERP. Mamy sygnał nietypowych logowań VPN. Ustal, co się dzieje, i zabezpiecz dane. Jeśli odetniesz ludzi, potrzebuję planu przywrócenia pracy.',
  analystHint:
    'Możesz zbadać logi, odczytać aktywne sesje lub porozmawiać z właścicielką konta. Każde badanie zajmuje 5 minut pracy analityka.',
} as const;
