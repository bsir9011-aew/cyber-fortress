import { branchLabels, smbScopeLabels } from './branchLabels';
import { recoveryLabels } from './recoveryLabels';
import { isBranchAction } from '../simulation/branch';
import { isRecoveryAction } from '../simulation/recovery';
import type { TaskAction } from '../domain/simulation';
export function actionLabel(action: TaskAction): string {
  if (isBranchAction(action))
    return (
      branchLabels[action.type] +
      ('route' in action
        ? ` · ${action.route === 'backup' ? 'zapasowa' : 'podstawowa'}`
        : 'scope' in action
          ? ` · ${smbScopeLabels[action.scope]}`
          : 'restricted' in action
            ? ` · ${action.accountId} · ${action.restricted ? 'ogranicz' : 'przywróć'}`
            : '')
    );
  if (isRecoveryAction(action))
    return (
      recoveryLabels[action.type] +
      ('backupId' in action ? ` · ${action.backupId}` : '')
    );
  switch (action.type) {
    case 'approve-emergency-vendor-access':
      return 'Awaryjnie zatwierdź CARGO-LINK';
    case 'inspect-vendor-operations':
      return 'Sprawdź operacje CARGO-LINK';
    case 'revoke-vendor-exception':
      return 'Cofnij wyjątek dostawcy';
    case 'narrow-vendor-exception':
      return 'Ogranicz wyjątek do carrier-api / HTTPS';
    case 'expand-vendor-exception':
      return 'Rozszerz wyjątek o FS-01 / SMB';

    case 'inspect-documents':
      return 'Porównanie dokumentów z ERP';
    case 'inspect-backups':
      return 'Sprawdzenie punktów odtworzenia';
    case 'verify-backup':
      return `Weryfikacja kopii ${action.backupId}`;
    case 'restore-documents':
      return `Odtworzenie dokumentów z ${action.backupId}`;
    case 'reconcile-documents':
      return 'Uzgodnienie brakujących dokumentów z ERP';
    case 'inspect-edr-telemetry':
      return 'Pobierz telemetrię EDR';
    case 'examine-endpoint':
      return `Badanie stacji ${action.endpointId}`;
    case 'isolate-endpoint':
      return `Izolacja stacji ${action.endpointId}`;
    case 'restrict-endpoint-writes':
      return `Ograniczenie zapisu stacji ${action.endpointId}`;
    case 'reconnect-endpoint':
      return `Kontrolowane podłączenie ${action.endpointId}`;
    case 'inspect-vpn-sessions':
      return 'Sprawdzenie aktywnych sesji VPN';
    case 'inspect-file-access':
      return 'Pobranie audytu FS-01';
    case 'inspect-auth-logs':
      return 'Pobranie logów uwierzytelnienia';
    case 'contact-account-owner':
      return `Rozmowa z właścicielką konta ${action.accountId}`;
    case 'terminate-session':
      return `Zakończenie sesji ${action.sessionId}`;
    case 'block-account':
      return `Blokada nowych logowań: ${action.accountId}`;
    case 'unblock-account':
      return `Przywrócenie nowych logowań: ${action.accountId}`;
    case 'reset-credential':
      return `Reset poświadczenia: ${action.accountId}`;
    case 'set-vpn':
      return action.enabled ? 'Włączenie VPN' : 'Wyłączenie VPN';
    case 'set-network-rule':
      return `${action.action === 'allow' ? 'Dopuszczenie' : 'Blokada'} przepływu: ${action.ruleId}`;
  }
}
