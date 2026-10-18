import { branchLabels } from '../../content/branchLabels';
import { recoveryLabels } from '../../content/recoveryLabels';
import type { AarDecision } from '../../domain/afterActionReport';
const actions: Record<AarDecision['action']['type'], string> = {
  ...recoveryLabels,
  ...branchLabels,
  'approve-emergency-vendor-access': 'Awaryjne zatwierdzenie CARGO-LINK',
  'set-crisis-hypothesis': 'Robocza ocena kryzysu',
  'inspect-vendor-operations': 'Sprawdzenie operacji CARGO-LINK',
  'revoke-vendor-exception': 'Cofnięcie wyjątku dostawcy',
  'narrow-vendor-exception': 'Ograniczenie wyjątku do HTTPS',
  'expand-vendor-exception': 'Rozszerzenie wyjątku o SMB',
  'inspect-documents': 'Porównanie dokumentów z ERP',
  'inspect-backups': 'Inwentaryzacja kopii',
  'verify-backup': 'Weryfikacja kopii',
  'restore-documents': 'Odtworzenie dokumentów',
  'reconcile-documents': 'Uzgodnienie dokumentów z ERP',
  'examine-endpoint': 'Badanie lokalnego dziennika',
  'isolate-endpoint': 'Izolacja endpointu',
  'restrict-endpoint-writes': 'Ograniczenie zapisu endpointu',
  'reconnect-endpoint': 'Kontrolowane podłączenie endpointu',
  'inspect-edr-telemetry': 'Pobranie telemetrii EDR',
  'inspect-vpn-sessions': 'Odczyt sesji VPN',
  'inspect-auth-logs': 'Pobranie logów uwierzytelnienia',
  'inspect-file-access': 'Pobranie audytu FS-01',
  'contact-account-owner': 'Rozmowa z właścicielką konta',
  'terminate-session': 'Zakończenie tunelu',
  'block-account': 'Blokada nowych logowań',
  'unblock-account': 'Przywrócenie nowych logowań',
  'reset-credential': 'Reset poświadczenia',
  'set-vpn': 'Zmiana dostępności VPN',
  'set-network-rule': 'Zmiana reguły sieciowej',
  'set-hypothesis': 'Zmiana hipotezy VPN',
  'set-integrity-hypothesis': 'Zmiana hipotezy integralności',
};
export const aarActionLabel = (d: AarDecision) =>
  `${actions[d.action.type]}${d.target.id ? ` · ${d.target.id}` : ''}`;
export const aarClock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
