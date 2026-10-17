import type { ProjectId } from '../domain/campaign';
import type { WorkerId } from '../domain/simulation';
export interface ProjectDefinition {
  readonly id: ProjectId;
  readonly name: string;
  readonly totalCost: number;
  readonly remainingCost: number;
  readonly hours: Readonly<Record<WorkerId, number>>;
  readonly scope: string;
  readonly effect: string;
  readonly limitation: string;
  readonly business: string;
  readonly assetIds: readonly string[];
}
export const securityProjects: readonly ProjectDefinition[] = [
  {
    id: 'remote-access',
    name: 'Uporządkowanie dostępu zdalnego',
    totalCost: 32000,
    remainingCost: 20000,
    hours: { administrator: 4, analyst: 0 },
    scope:
      'Grupa 61 kont VPN; modelowane magazyn-07, dispatch-team i file-team. AD i brama VPN.',
    effect:
      'Nowe logowania wymagają zarejestrowanego drugiego składnika. Usuwamy nadmiarowy SMB magazyn-07 tylko tam, gdzie konto nie ma udokumentowanego zadania plikowego.',
    limitation:
      'MFA nie kończy wcześniej wydanych tuneli. Nie obejmuje innych usług tożsamości. Pilotaż 12 000 zł jest już opłacony.',
    business:
      'Modelowani legalni klienci otrzymują własny drugi składnik. Uprawnienie wymagane do dokumentów pozostaje; HTTPS ERP jest sprawdzany osobno.',
    assetIds: ['vpn', 'ad', 'fs-01'],
  },
  {
    id: 'file-visibility',
    name: 'Widoczność dostępu do plików',
    totalCost: 28000,
    remainingCost: 28000,
    hours: { administrator: 2, analyst: 4 },
    scope:
      'Audyt usługi SMB na FS-01. Retencja 120 min, dostarczenie 5 min po zebraniu.',
    effect:
      'Rejestruje list/open/read, konto, sesję, wynik i mierzony wolumen odczytu. Analityk może pozyskać dowód podczas misji.',
    limitation:
      'Nie blokuje dostępu, nie nadaje uprawnień i nie klasyfikuje ludzi. Nie widzi prób zatrzymanych wcześniej w sieci.',
    business:
      'Obserwuje także legalne odczyty dokumentów; badanie zajmuje analitykowi 5 min.',
    assetIds: ['fs-01', 'vpn'],
  },
  {
    id: 'segmentation',
    name: 'Rozdzielenie ruchu VPN',
    totalCost: 30000,
    remainingCost: 30000,
    hours: { administrator: 4, analyst: 0 },
    scope:
      'Reguły podmiotowe VPN → ERP/HTTPS i FS-01/SMB. Pierwsza pasująca reguła; domyślna odmowa.',
    effect:
      'HTTPS dopuszcza modelowane konta robocze. SMB dopuszcza wybraną grupę dokumentów i odrzuca pozostałe konta, również w istniejących tunelach.',
    limitation:
      'Przejęte konto należące do dozwolonej grupy zachowuje dostęp. Reguła nie rozpoznaje człowieka za kontem.',
    business:
      'Wykluczenie magazyn-07 może odebrać 6 zamówień na turę, gdy Marta obsługuje dokumenty. Szersza grupa zachowuje ten dostęp także dla osoby używającej jej konta.',
    assetIds: ['vpn', 'erp', 'fs-01'],
  },
];
/** Only the explicit stage-II command adds these definitions to a campaign. */
export const resilienceProjects: readonly ProjectDefinition[] = [
  {
    id: 'endpoint-edr',
    name: 'Endpoint Detection & Response — Pilotaż',
    totalCost: 24000,
    remainingCost: 24000,
    hours: { administrator: 2, analyst: 2 },
    scope:
      'Wyłącznie pakowanie-03: jedna z 94 stacji. Agent i modelowany kolektor, read/modify SMB, retencja 120 min, opóźnienie 5 min.',
    effect:
      'Rejestruje rzeczywiste operacje. Detekcja: co najmniej 10 dopuszczonych modyfikacji dokumentów w 10 min. Analityk pobiera dowód z kolektora w 5 min.',
    limitation:
      'Alert to sygnał do zbadania. Nie izoluje i nie oczyszcza stacji. Izolacja przerywa nowe dostarczenia; lokalny dziennik nadal wymaga analizy 10 min.',
    business:
      'Szybsze rozpoznanie może ułatwić wcześniejszą decyzję. Niewykorzystane narzędzie nie zatrzymuje uszkadzania ani nie naprawia danych.',
    assetIds: ['workstations'],
  },
  {
    id: 'backup-resilience',
    name: 'Backup Resilience — Weryfikacja i test odtwarzania',
    totalCost: 28000,
    remainingCost: 28000,
    hours: { administrator: 3, analyst: 2 },
    scope:
      'Istniejący punkt FS-1350 i procedura odtworzenia FS-01. Nie tworzy nowych ani późniejszych dokumentów.',
    effect:
      'Po ukończeniu pracy obu osób wykonuje modelowany test zawartości i procedury. Zgodna, dostępna kopia otrzymuje udokumentowany wynik; przetestowany restore trwa 10 zamiast 15 min.',
    limitation:
      'Sam zakup nie sprawdza kopii. Kopia uszkodzona lub niedostępna nie staje się czysta. RPO pozostaje 10 min. Nadal trzeba ograniczyć źródło zmian.',
    business:
      'Oszczędza pracę weryfikacji podczas incydentu i czas administratora. Aktywne źródło może ponownie uszkodzić odtworzony zbiór.',
    assetIds: ['fs-01'],
  },
];
export const projectDefinition = (id: ProjectId) =>
  [...securityProjects, ...resilienceProjects].find((p) => p.id === id)!;
