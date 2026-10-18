import type { RecoveryView } from '../application/selectRecoveryView';
import type { SimulationCommand } from '../domain/simulation';
import { formatMinute } from '../simulation/clock';
import { actionLabel } from './simulationPresentation';
export function RecoveryPanel({ view: v }: { view: RecoveryView }) {
  return (
    <section
      className="vendor-card recovery-card"
      aria-label="Centrum odzyskiwania ERP"
    >
      <p className="eyebrow">Misja 04 / Blackout Protocol</p>
      <h2>Centrum odzyskiwania ERP</h2>
      <p>
        Instancja: <strong>{v.activeInstance}</strong>. Obsługa ręczna:{' '}
        {v.manualActive ? 'aktywna' : 'zamknięta'}. RTO {v.rtoMinutes} min · RPO{' '}
        {v.rpoMinutes} min.
      </p>
      <p>
        Aktywna droga ERP: workstations / VPN →{' '}
        {v.activeInstance === 'primary'
          ? 'ERP → ERP Database → ERP Storage'
          : 'ERP Standby → Standby Storage'}
        . Obsługa ręczna korzysta z lokalnych manifestów zamiast tej drogi.
      </p>
      <p>
        Ręcznie wysłano {v.manualProcessed}; wysyłki do uzgodnienia z aktualną
        bazą: {v.pendingOrders}. Potwierdzenie spójności:{' '}
        {v.confidence ? 'aktualne' : 'wymaga kontroli'}.
      </p>
      <p>
        Host, proces, baza, storage, droga użytkownika i poprawne dane są
        osobnymi zależnościami. Badania zapisują migawkę z chwili wykonania.
        Projekt backupu FS-01 oraz EDR pakowanie-03 nie obejmują ERP.
      </p>
      {!v.observations.length && (
        <p>
          Przyczyna nieustalona. Zleć badanie usługi, bazy i storage lub
          inwentarza kopii.
        </p>
      )}
      {v.backups.length > 0 && (
        <div className="recovery-backups">
          <h3>Znane kopie ERP</h3>
          {v.backups.map((b) => (
            <article key={b.id}>
              <strong>
                {b.id} · {formatMinute(b.minute)}
              </strong>
              <p>
                {b.available
                  ? 'Dostępna w chwili badania'
                  : 'Niedostępna w chwili badania'}{' '}
                · odtworzenie {b.restoreTurns * 5} min · {b.recordIds.length}{' '}
                zapisów · integralność{' '}
                {b.verified === null
                  ? 'niezweryfikowana'
                  : b.verified
                    ? 'potwierdzona'
                    : 'błędy'}
              </p>
              <details>
                <summary>Zapisy w kopii</summary>
                <p>{b.recordIds.join(', ')}</p>
              </details>
            </article>
          ))}
        </div>
      )}
      <h3>Obserwacje i wyniki</h3>
      {v.observations.map((o) => (
        <details key={o.id} open>
          <summary>
            {formatMinute(o.minute)} · {o.source}
          </summary>
          <p>{o.text}</p>
        </details>
      ))}
      {v.results
        .filter((t) => !v.observations.some((o) => o.taskId === t.taskId))
        .map((t) => (
          <article key={t.taskId}>
            <strong>
              {formatMinute(t.minute)} · {actionLabel(t.action)} · {t.outcome}
            </strong>
            <p>{t.text}</p>
          </article>
        ))}
    </section>
  );
}
export function RecoveryOperations({
  view: v,
  onCommand,
}: {
  view: RecoveryView;
  onCommand: (c: SimulationCommand) => void;
}) {
  return (
    <section aria-label="Zadania odzyskiwania ERP">
      <h3>Diagnoza i odzyskiwanie</h3>
      <div className="operation-actions">
        {v.actions.map((a) => (
          <button
            key={
              a.action.type + ('backupId' in a.action ? a.action.backupId : '')
            }
            disabled={!!a.rejection}
            title={a.rejection ? `Warunek operacji: ${a.rejection}` : undefined}
            onClick={() =>
              onCommand({
                type: 'schedule-task',
                workerId: a.workerId,
                action: a.action,
              })
            }
          >
            {actionLabel(a.action)} · {a.turns * 5} min
          </button>
        ))}
      </div>
      <p className="source-note">
        Efekt po zakończeniu. Niezweryfikowana kopia może zawierać błędy.
        Starsza może utracić późniejsze zapisy.{' '}
        {v.finale
          ? 'Tryb ręczny zastępuje tylko lokalną część pracy ERP (do 8/turę)'
          : 'Tryb ręczny zastępuje ERP'}{' '}
        i wymaga zamknięcia oraz uzgodnienia. Jedna osoba wykonuje jedno
        zadanie.
      </p>
    </section>
  );
}
