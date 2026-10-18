import type { BranchTaskAction } from '../domain/branch';
export const branchLabels: Record<BranchTaskAction['type'], string> = {
  'inspect-branch-links': 'Sprawdź połączenia oddziału',
  'inspect-branch-gateway-logs': 'Przeanalizuj logi bram EAST',
  'confirm-branch-requirements': 'Potwierdź wymagania oddziału',
  'activate-branch-route': 'Przełącz trasę oddziału',
  'repair-branch-link': 'Napraw łącze podstawowe',
  'set-branch-smb-scope': 'Zmień zakres SMB oddziału',
  'set-branch-account-restriction': 'Zmień autoryzację SMB konta',
};
export const smbScopeLabels = {
  none: 'brak SMB',
  documents: 'grupa dokumentowa',
  all: 'wszystkie konta EAST',
};
