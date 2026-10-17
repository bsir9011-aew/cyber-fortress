import type { ScenarioDefinition } from '../../domain/scenario';
import { integrityScenario } from './integrity';

export const DETECTION_FAMILY_ID = 'nexus-integrity-detection-v1' as const;
const briefing = {
  title: 'Misja 02 — Nieznany przypadek',
  message:
    'Zespół pakowanie-03 prosi o sprawdzenie aktywności dokumentów wysyłkowych FS-01. ERP i serwer odpowiadają. Nie ustalono przyczyny ani poprawności aktualizacji. Do 15:30 zweryfikuj dane i zachowaj ciągłość wysyłek. Brak alertu nie zastępuje badania.',
  analystHint:
    'Porównaj dokumenty z ERP i lokalnym dziennikiem. Jeśli wdrożono sensor, sprawdź dostarczoną telemetrię i parametry reguły.',
};
const base = integrityScenario.integrity!;
export const legalModificationScenario: ScenarioDefinition = {
  ...integrityScenario,
  id: 'nexus-integrity-legal-batch',
  name: 'Nieznany przypadek FS-01',
  briefing,
  explanation:
    'Legalny proces na pakowanie-03 aktualizował dokumenty przez SMB, z prawidłowym uprawnieniem modify. Treść pozostała zgodna z ERP. Alert opisuje serię operacji, nie potwierdza incydentu. Izolacja odcięła także legalną pracę.',
  integrity: {
    ...base,
    endpoint: { ...base.endpoint, businessCapacity: 4 },
    initialDamage: 0,
    attack: { compromised: false, turns: [], chunkSize: 1 },
    legitimateModifications: { turns: [1, 2, 9, 10, 17], chunkSize: 12 },
  },
};
export const slowModificationScenario: ScenarioDefinition = {
  ...integrityScenario,
  id: 'nexus-integrity-low-and-slow',
  name: 'Nieznany przypadek FS-01',
  briefing,
  explanation:
    'Przejęty lokalny kontekst packing-local modyfikował małe partie po dwa dokumenty co dziesięć minut przez rzeczywistą ścieżkę SMB. Nie omijał sensora. Zbyt wysoki próg lub krótkie okno mogły nie wygenerować sygnału.',
  integrity: {
    ...base,
    initialDamage: 0,
    attack: {
      compromised: true,
      turns: [2, 4, 6, 8, 10, 12, 14, 16, 18],
      chunkSize: 2,
    },
  },
};
/** Separate versioned family. Historical M01 seed catalog and reference M02 are untouched. */
export function selectDetectionScenario(
  familyId: string,
  seed: number,
): ScenarioDefinition {
  if (
    familyId !== DETECTION_FAMILY_ID ||
    !Number.isSafeInteger(seed) ||
    seed < 0
  )
    throw new Error('Invalid detection family or seed');
  // FNV-1a of the explicit family, then modular seed addition without unsafe integers.
  let hash = 2166136261;
  for (const c of familyId)
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const index = ((hash % 3) + (seed % 3)) % 3;
  const selected =
    index === 0
      ? integrityScenario
      : index === 1
        ? legalModificationScenario
        : slowModificationScenario;
  return { ...selected, familyId: DETECTION_FAMILY_ID, briefing };
}
