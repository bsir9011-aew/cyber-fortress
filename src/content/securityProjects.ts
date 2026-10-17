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
export const projectDefinition = (id: ProjectId) =>
  securityProjects.find((p) => p.id === id)!;
