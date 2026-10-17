import { backupTestLabels } from './simulationPresentation';
import type { BackupReadiness, EndpointCoverage } from '../domain/resilience';
export interface ResilienceStatusProps {
  agentOnline?: boolean | undefined;
  deliveryAvailable?: boolean | undefined;
  coverage?: EndpointCoverage | undefined;
  backup?: BackupReadiness | undefined;
}
export function ResilienceStatus({
  coverage,
  backup,
  agentOnline,
  deliveryAvailable,
}: ResilienceStatusProps) {
  return (
    <section className="resilience-status" aria-label="Gotowość EDR i backup">
      <p>
        <strong>EDR · {coverage ? 'wdrożony' : 'niewdrożony'}</strong> ·
        pakowanie-03, 1 z 94 stacji.{' '}
        {coverage &&
          `Agent: ${agentOnline ? 'dostępny' : 'niedostępny'}; kolektor: ${coverage.collectorAvailable ? 'dostępny' : 'niedostępny'}; droga dostarczenia: ${deliveryAvailable ? 'dostępna' : 'niedostępna'}; opóźnienie ${coverage.delayMinutes} min; retencja ${coverage.retentionMinutes} min.`}
      </p>
      <p>
        <strong>FS-01 · Backup Resilience:</strong>{' '}
        {backup
          ? `${backup.backupId} — ${backupTestLabels[backup.integrity]}; zakres ${backup.checkedDocumentIds.length} dokumentów. Test odtworzenia: ${backup.restoreTestPassed ? 'zaliczony' : 'niezaliczony'}, okno ${backup.testedAt.window}, godzina ${backup.testedAt.hour}. Restore ${backup.testedRestoreTurns * 5} min przy zgodnej, dostępnej kopii.`
          : 'brak ukończonego testu programu; obowiązuje dotychczasowa weryfikacja kopii.'}
      </p>
    </section>
  );
}
