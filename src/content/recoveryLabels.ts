import type { RecoveryTaskAction } from '../domain/recovery';
export const recoveryLabels: Record<RecoveryTaskAction['type'], string> = {
  'inspect-erp-service': 'Zbadaj usługę ERP',
  'inspect-erp-database': 'Zbadaj bazę i storage',
  'inspect-erp-backups': 'Sprawdź kopie ERP',
  'contact-warehouse-operations': 'Skontaktuj się z magazynem',
  'verify-erp-backup': 'Zweryfikuj kopię ERP',
  'inspect-erp-consistency': 'Sprawdź spójność ERP',
  'reconcile-erp-records': 'Uzgodnij zapisy i wysyłki',
  'restart-erp-service': 'Uruchom ponownie usługę ERP',
  'restore-erp-backup': 'Odtwórz bazę ERP',
  'switch-erp-standby': 'Przełącz na niezależny standby',
  'start-manual-shipping': 'Uruchom obsługę ręczną',
  'close-manual-shipping': 'Zamknij obsługę ręczną',
};
