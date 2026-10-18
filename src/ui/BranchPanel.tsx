import type { BranchView } from '../application/selectBranchView';
import type { SimulationCommand } from '../domain/simulation';
import { smbScopeLabels } from '../content/branchLabels';
import { formatMinute } from '../simulation/clock';
import { actionLabel } from './simulationPresentation';
const outcomes = {
  succeeded: 'wykonano',
  partial: 'częściowy efekt',
  failed: 'niepowodzenie',
};
export function BranchPanel({ view: v }: { view: BranchView }) {
  return (
    <section
      className="vendor-card branch-card"
      aria-label="Centrum operacyjne NEXUS EAST"
    >
      <p className="eyebrow">Misja 05 / The New Branch</p>
      <h2>Oddział na granicy</h2>
      <p>
        Aktywna trasa:{' '}
        <strong>
          {v.route === 'primary'
            ? 'podstawowa site-to-site'
            : 'zapasowa HTTPS-only'}
        </strong>
        . ERP {v.architecture.erpEnabled ? 'wdrożone' : 'niewdrożone'} · SMB{' '}
        {smbScopeLabels[v.architecture.smbScope]}. Backup{' '}
        {v.architecture.backupPrepared ? 'przygotowany' : 'nieprzygotowany'}.
      </p>
      <p>
        Tunel {v.tunnel.id}: {v.tunnel.localGatewayAssetId} →{' '}
        {v.tunnel.peerAssetId}. Nie jest sesją VPN pracownika. Konto z wydanym
        lokalnym kontekstem nadal wymaga ACL i nadania zasobowego. Ograniczenie
        konta EAST odbiera bieżącą autoryzację SMB; nie blokuje logowania, nie
        zmienia hasła, MFA ani ERP.
      </p>
      <p>
        Wyznaczona grupa dokumentowa: east-documents. Wstrzymana autoryzacja
        SMB: {v.architecture.restrictedAccountIds.join(', ') || 'brak'}.
        Monitoring:{' '}
        {v.sensor.enabled
          ? 'wdrożony od ' + formatMinute(v.sensor.coverageFromMinute)
          : 'niewdrożony; wcześniejszych przepływów nie odzyskasz wstecz'}
        .
      </p>
      {!v.smbConfigurationMatches && (
        <p className="decision-warning">
          Bieżąca reguła lub nadania SMB różnią się od wdrożonego zakresu.
          Sprawdź reguły albo ponownie zastosuj wybrany zakres zadaniem
          administratora (10 min).
        </p>
      )}
      {!v.observations.length && (
        <p>
          Przyczyna nieustalona. Zbadaj połączenia, potwierdź potrzeby oddziału
          i pobierz dostępne dowody. Sama odmowa lub przepływ SMB nie dowodzi
          nadużycia.
        </p>
      )}
      {v.observations.map((o) => (
        <details open key={o.id}>
          <summary>
            {formatMinute(o.minute)} · {o.source} ·{' '}
            {o.assertion === 'human-statement'
              ? 'relacja zespołu'
              : 'obserwacja'}
          </summary>
          <p>{o.text}</p>
          {o.records.length > 0 && (
            <ul>
              {o.records.map((r) => (
                <li key={r.id}>
                  {formatMinute(r.minute)} · {r.sourceAssetId} / {r.accountId} /{' '}
                  {r.contextId} → {r.gatewayAssetId} → {r.targetAssetId}/
                  {r.protocol} ·{' '}
                  {r.outcome === 'allowed'
                    ? 'przekazano do usługi'
                    : 'odrzucono na drodze'}
                  .
                </li>
              ))}
            </ul>
          )}
        </details>
      ))}
      {v.results
        .filter((t) => !v.observations.some((o) => o.taskId === t.taskId))
        .map((t) => (
          <article key={t.taskId}>
            <strong>
              {formatMinute(t.minute)} · {actionLabel(t.action)} ·{' '}
              {outcomes[t.outcome]}
            </strong>
            <p>{t.text}</p>
          </article>
        ))}
      <p className="source-note">
        Obserwacje są migawkami z czasu pobrania. Monitor bramy nie widzi treści
        szyfrowanej ani uprawnień wewnątrz usługi. Audyt FS-01 jest osobnym
        źródłem po wdrożeniu. EDR pakowanie-03 i Backup Resilience nie obejmują
        tej sieci.
      </p>
    </section>
  );
}
export function BranchOperations({
  view: v,
  onCommand,
}: {
  view: BranchView;
  onCommand: (c: SimulationCommand) => void;
}) {
  return (
    <section aria-label="Zadania NEXUS EAST">
      <h3>Diagnoza i zmiana architektury</h3>
      <div className="operation-actions">
        {v.actions.map((a) => (
          <button
            key={JSON.stringify(a.action)}
            disabled={!!a.rejection}
            title={
              a.rejection
                ? 'Wymaga wolnego wykonawcy, czasu i spełnienia warunków operacji.'
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
        Efekty po ukończeniu. Naprawa nie przełącza trasy automatycznie.
        Zapasowa droga nie obsługuje SMB. Przywrócenie autoryzacji nadal
        przejętego kontekstu może wznowić odczyt danych.
      </p>
    </section>
  );
}
