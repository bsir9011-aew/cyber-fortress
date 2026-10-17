import type { VendorView } from '../application/selectVendorView';
import type { SimulationCommand } from '../domain/simulation';
import { formatMinute } from '../simulation/clock';
import { actionLabel } from './simulationPresentation';
export function VendorPanel({ view: v }: { view: VendorView }) {
  const e = v.exception;
  return (
    <section className="vendor-card" aria-label="Operacje CARGO-LINK">
      <p className="eyebrow">Sprawa 03 / dostęp podmiotu zewnętrznego</p>
      <h2>CARGO-LINK — zlecenie i obserwacje</h2>
      <p>
        Tożsamość {v.accountId}.{' '}
        {e
          ? `${e.approvalId}: ${e.scope === 'api-only' ? 'tylko carrier-api / HTTPS' : 'carrier-api / HTTPS oraz FS-01 / SMB'}; od ${formatMinute(e.validFromMinute)} do ${formatMinute(e.expiresAtMinute)}. Stan: ${e.status === 'revoked' ? 'cofnięty' : v.expired ? 'wygasły' : 'aktywny'}.`
          : 'Brak zatwierdzonego wyjątku.'}
      </p>
      <p>
        Wygaśnięcie lub cofnięcie odbiera autoryzację usługową. Nie kończy
        sesji, nie blokuje konta i nie zmienia poświadczenia. Zakończone partie
        integracji nadal mogą wspierać wysyłki.
      </p>
      {!v.observations.length && (
        <p>
          Nie pobrano obserwacji. Sprawdź operacje CARGO-LINK; denied samo nie
          określa, czy próba była legalna. EDR na pakowanie-03 nie obejmuje
          urządzenia dostawcy.
        </p>
      )}
      {v.observations.map((o) => (
        <details open key={o.id}>
          <summary>
            {o.id} · pobrano {formatMinute(o.observedAtMinute)} ·{' '}
            {o.records.length} operacji
          </summary>
          <p>
            Źródło: {o.source}. Faktyczne próby rejestrowane na bramie VPN,
            retencja 120 min, bez opóźnienia; to migawka z chwili badania.
          </p>
          <ul>
            {o.records.map((r) => (
              <li key={r.id}>
                {formatMinute(r.minute)} · {r.accountId} · sesja {r.sessionId} →{' '}
                {r.targetAssetId} / {r.protocol} · {r.operation} · {r.outcome}.
                Ścieżka: {r.accessChecks.topologyExists ? 'tak' : 'nie'};
                usługa: {r.accessChecks.serviceAvailable ? 'tak' : 'nie'};
                sesja: {r.accessChecks.sessionActive ? 'tak' : 'nie'}; ACL:{' '}
                {r.accessChecks.networkAllowed ? 'allow' : 'deny'}; uprawnienie:{' '}
                {r.accessChecks.permissionAllowed ? 'tak' : 'nie'}; wyjątek:{' '}
                {r.accessChecks.exceptionAllowed ? 'tak' : 'nie'}.
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
export function VendorOperations({
  view: v,
  onCommand,
}: {
  view: VendorView;
  onCommand: (c: SimulationCommand) => void;
}) {
  return (
    <section className="vendor-actions" aria-label="Zadania dostawcy">
      <h3>Zbadaj i dostosuj wyjątek</h3>
      <div className="operation-actions">
        {v.actions.map((a) => (
          <button
            key={a.action.type}
            disabled={!!a.rejection}
            title={
              a.rejection
                ? 'Wymaga wolnego wykonawcy, ważnego zatwierdzenia, odpowiedniego zakresu i czasu przed terminem.'
                : undefined
            }
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
        Zmiana działa po ukończeniu zadania. Rozszerzenie trwa 10 min, zachowuje
        pierwotny termin i wymaga nadal ważnego wyjątku. Cofniętego lub
        wygasłego zatwierdzenia nie można przywrócić w incydencie.
      </p>
    </section>
  );
}
