import type { IntegrityView } from '../application/selectIntegrityView';
import type { SimulationCommand } from '../domain/simulation';
import { formatMinute } from '../simulation/clock';
import { actionLabel, backupTestLabels } from './simulationPresentation';

export function IntegrityPanel({
  view,
  onCommand,
}: {
  view: IntegrityView;
  onCommand: (c: SimulationCommand) => void;
}) {
  const latest = view.observations.at(-1);
  return (
    <section className="integrity-panel" aria-label="Integralność dokumentów">
      <p className="eyebrow">Sprawa 02 / Integralność</p>
      <h2>Serwer odpowiada. Czy dokumentom można ufać?</h2>
      <div className="integrity-service">
        <span className={view.fsOnline ? 'status-online' : 'status-offline'}>
          FS-01: {view.fsOnline ? 'online' : 'offline'}
        </span>
        <span>Udokumentowany zbiór: {view.documentedTotal} dokumentów</span>
      </div>
      <blockquote>
        <strong>Zgłoszenie zespołu · 13:55</strong>
        <p>
          Na pakowanie-03 widzimy rozbieżności między dokumentami a ERP. Usługa
          działa, lecz część wysyłek wymaga sprawdzenia.
        </p>
        <small>Relacja człowieka; nie ustala przyczyny ani sprawcy.</small>
      </blockquote>
      <div className="integrity-route" aria-label="Dwie odrębne drogi dostępu">
        <span>
          pakowanie-03
          <br />
          <small>lokalny kontekst</small>
        </span>
        <b aria-hidden="true">→ SMB →</b>
        <span>
          FS-01
          <br />
          <small>dokumenty</small>
        </span>
      </div>
      <p className="source-note">
        Stacja jest jedną z istniejących 94. Jej lokalny kontekst nie wymaga
        nowego tunelu VPN. MFA i segmentacja VPN obejmują inną drogę.
      </p>
      <h3>Ostatnia kontrola spójności</h3>
      {latest ? (
        <>
          <p>
            Porównanie z ERP · {formatMinute(latest.minute)} · zakres{' '}
            {latest.scope.length} dokumentów · dowód {latest.id}. To migawka,
            nie podgląd na żywo.
          </p>
          <dl className="integrity-counts">
            <div>
              <dt>Poprawne</dt>
              <dd>{latest.correct}</dd>
            </div>
            <div>
              <dt>Uszkodzone</dt>
              <dd>{latest.damaged}</dd>
            </div>
            <div>
              <dt>Do uzgodnienia</dt>
              <dd>{latest.reconcile}</dd>
            </div>
          </dl>
          <p>
            Kontrola wykazuje zgodność danych, nie tożsamość osoby, która je
            zmieniła.
          </p>
        </>
      ) : (
        <p className="unknown-integrity">
          Nie zbadano. Status online nie potwierdza integralności. Zleć
          porównanie dokumentów z ERP.
        </p>
      )}
      {view.observations.length > 1 && (
        <details>
          <summary>
            Wcześniejsze kontrole ({view.observations.length - 1})
          </summary>
          {view.observations.slice(0, -1).map((o) => (
            <p key={o.id}>
              {formatMinute(o.minute)} · {o.correct} poprawnych / {o.damaged}{' '}
              uszkodzonych / {o.reconcile} do uzgodnienia · zakres{' '}
              {o.scope.length}.
            </p>
          ))}
        </details>
      )}
      <label htmlFor="integrity-hypothesis">Twoja robocza hipoteza</label>
      <select
        id="integrity-hypothesis"
        value={view.hypothesis}
        onChange={(e) =>
          onCommand({
            type: 'set-integrity-hypothesis',
            hypothesis: e.target.value as IntegrityView['hypothesis'],
          })
        }
      >
        <option value="insufficient-evidence">Za mało danych</option>
        <option value="data-drift">
          Niezgodność danych / proces uzgodnienia
        </option>
        <option value="local-modification">
          Modyfikacje z lokalnej stacji
        </option>
      </select>
      {view.edr && (
        <section className="edr-evidence" aria-label="Telemetria EDR">
          <h3>EDR · pilotaż pakowanie-03</h3>
          <p>
            1 z 94 stacji · fortress-endpoint-agent · agent{' '}
            {view.edr.agentOnline ? 'dostępny' : 'niedostępny'} · kolektor{' '}
            {view.edr.coverage.collectorAvailable ? 'dostępny' : 'niedostępny'}.
            Droga dostarczenia:{' '}
            {view.edr.deliveryAvailable ? 'dostępna' : 'niedostępna'}. Pokrycie:{' '}
            {view.edr.coverage.operations.join(', ')}. Opóźnienie{' '}
            {view.edr.coverage.delayMinutes} min, retencja{' '}
            {view.edr.coverage.retentionMinutes} min.
          </p>
          <p>
            Reguła {view.edr.coverage.detection.id}: ≥
            {view.edr.coverage.detection.threshold} modyfikacji /{' '}
            {view.edr.coverage.detection.windowMinutes} min z jednej stacji.
          </p>
          {view.edr.alerts.map((a) => (
            <blockquote key={a.id}>
              <strong>
                {formatMinute(a.minute)} · {a.name}
              </strong>
              <p>
                {a.modificationCount} zaobserwowanych modyfikacji ·{' '}
                {a.endpointId}. Wymaga dochodzenia; nie potwierdza ataku.
              </p>
            </blockquote>
          ))}
          {!view.edr.alerts.length && (
            <p>Brak dostępnego alertu. Nie dowodzi braku aktywności.</p>
          )}
          <p>
            Zleć pobranie telemetrii (5 min). Czyta wyłącznie zdalny kolektor.
            Izolacja odcina nowe dostarczenia; lokalny bufor agenta pozostaje
            poza tym odczytem. Badanie lokalnego dziennika trwa osobno 10 min.
          </p>
          {view.edr.observations.map((o) => (
            <details key={o.id} open>
              <summary>
                Dowód EDR {o.id} · pobrano {formatMinute(o.observedAtMinute)}
              </summary>
              <p>
                Źródło: {o.source} / {o.collectorId} / {o.sensorId}. Okno{' '}
                {formatMinute(o.windowStartMinute)}–
                {formatMinute(o.windowEndMinute)}. {o.records.length} rekordów.
              </p>
              <ul>
                {o.records.map((r) => (
                  <li key={r.id}>
                    {r.id} · zdarzenie {formatMinute(r.minute)} · przechwycono{' '}
                    {formatMinute(r.capturedAtMinute)} · dostarczono{' '}
                    {formatMinute(r.deliveredAtMinute)} · dostępne{' '}
                    {formatMinute(r.availableAtMinute)} · {r.source} ·{' '}
                    {r.endpointId} / {r.accountId} → {r.targetAssetId}/
                    {r.protocol} · {r.operation} · {r.outcome} ·{' '}
                    {r.documentIds.length} dokumentów ({r.documentIds[0]}…
                    {r.documentIds.at(-1)})
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}
      <h3>Dowód ze stacji</h3>
      {!view.endpointObservations.length ? (
        <p>
          Nie zbadano lokalnego dziennika. Nazwa stacji w zgłoszeniu nie dowodzi
          kompromitacji.
        </p>
      ) : (
        view.endpointObservations.map((o) => (
          <details key={o.id} open={o === view.endpointObservations.at(-1)}>
            <summary>
              {o.endpointId} · badanie {formatMinute(o.minute)} · {o.id}
            </summary>
            <p>
              Izolacja w chwili badania: {o.isolated ? 'tak' : 'nie'}.
              Ograniczenie zapisu: {o.writesRestricted ? 'tak' : 'nie'}. Źródło:
              lokalny dziennik operacji, od 13:55 do chwili badania.
            </p>
            <ul>
              {o.records.map((r, n) => (
                <li key={n}>
                  {formatMinute(r.minute)} · {r.accountId} · {r.operation} ·{' '}
                  {r.outcome === 'allowed' ? 'dopuszczono' : 'odmowa'} ·{' '}
                  {r.documentIds.length} dokumentów{' '}
                  {r.documentIds.length
                    ? `(${r.documentIds[0]}…${r.documentIds.at(-1)})`
                    : ''}
                </li>
              ))}
            </ul>
            <p>
              To zapis operacji, nie automatyczna klasyfikacja złośliwości.
              Zestaw go z porównaniem dokumentów i zakresem uprawnień.
            </p>
          </details>
        ))
      )}
    </section>
  );
}
export function IntegrityOperations({
  view,
  onCommand,
}: {
  view: IntegrityView;
  onCommand: (c: SimulationCommand) => void;
}) {
  const button = (entry: IntegrityView['actions'][number]) => (
    <button
      key={JSON.stringify(entry.action)}
      disabled={entry.rejection !== null}
      title={
        entry.rejection
          ? 'Wymaga właściwego stanu, dostępnego źródła, wolnego wykonawcy i czasu.'
          : undefined
      }
      onClick={() =>
        onCommand({
          type: 'schedule-task',
          workerId: entry.workerId,
          action: entry.action,
        })
      }
    >
      {actionLabel(entry.action)} · {entry.turns * 5} min
    </button>
  );
  return (
    <div className="integrity-operations">
      <h3>
        Ustal stan <span>analityk</span>
      </h3>
      <div className="operation-actions">
        {view.actions
          .filter((e) =>
            [
              'inspect-edr-telemetry',
              'inspect-documents',
              'inspect-backups',
              'examine-endpoint',
            ].includes(e.action.type),
          )
          .map(button)}
      </div>
      <h3>
        Ogranicz źródło <span>administrator</span>
      </h3>
      <p>
        {view.endpoint.id}:{' '}
        {view.endpoint.isolated ? 'odizolowany' : 'komunikacja włączona'} ·
        zapis{' '}
        {view.endpoint.writesRestricted
          ? 'ograniczony'
          : 'dozwolony uprawnieniem'}
        .
      </p>
      <div className="operation-actions">
        {view.actions
          .filter((e) =>
            [
              'isolate-endpoint',
              'restrict-endpoint-writes',
              'reconnect-endpoint',
            ].includes(e.action.type),
          )
          .map(button)}
      </div>
      <p className="source-note">
        Izolacja odcina tylko tę stację i kosztuje 2 zamówienia wydajności na
        turę. Nie naprawia plików ani nie usuwa kompromitacji. Aby podłączyć
        stację: odizoluj ją, pozyskaj dowód z dziennika lub EDR i ogranicz
        zapis. Legalny odczyt będzie mógł wrócić.
      </p>
      <h3>Wybierz punkt odtworzenia</h3>
      {view.backupReadiness && (
        <p className="backup-readiness">
          Program Backup Resilience: {view.backupReadiness.backupId} ·{' '}
          {backupTestLabels[view.backupReadiness.integrity]} · test{' '}
          {view.backupReadiness.restoreTestPassed
            ? 'zaliczony'
            : 'niezaliczony'}{' '}
          · okno {view.backupReadiness.testedAt.window}, h{' '}
          {view.backupReadiness.testedAt.hour} ·{' '}
          {view.backupReadiness.checkedDocumentIds.length} sprawdzonych
          dokumentów. Parametry poniżej dotyczą aktualnej kopii.
        </p>
      )}
      {view.backupInventoryMinute === null ? (
        <p>Nie sprawdzono kopii. Zleć sprawdzenie punktów odtworzenia.</p>
      ) : (
        <>
          <p className="source-note">
            Inwentaryzacja {formatMinute(view.backupInventoryMinute)}.
            Odtworzenie w stagingu nie wyłącza całego serwera; do przełączenia
            działa dotychczasowy zbiór.
          </p>
          {view.backups.map((b) => (
            <article
              className="backup-card"
              key={b.id}
              aria-label={`Kopia ${b.id}`}
            >
              <strong>
                {b.id} · {formatMinute(b.minute)}
              </strong>
              <p>
                {b.count} / 100 dokumentów · RPO {b.rpoMinutes} min ·
                odtworzenie {b.restoreTurns * 5} min ·{' '}
                {b.available ? 'dostępna' : 'niedostępna'}.
              </p>
              <p>
                Weryfikacja:{' '}
                {b.verification === 'unknown'
                  ? 'niezbadana'
                  : b.verification === 'clean'
                    ? 'zgodna w swoim zakresie'
                    : 'wykryto niezgodności'}
                {b.verifiedAtMinute !== null
                  ? ` · ${formatMinute(b.verifiedAtMinute)}`
                  : ''}
                .
              </p>
              {b.count < 100 && (
                <p className="decision-warning">
                  Brakuje {100 - b.count} późniejszych dokumentów. Wymagają
                  osobnego uzgodnienia z ERP.
                </p>
              )}
              <div className="operation-actions">
                {view.actions
                  .filter(
                    (e) => 'backupId' in e.action && e.action.backupId === b.id,
                  )
                  .map(button)}
              </div>
            </article>
          ))}
        </>
      )}
      <div className="operation-actions">
        {view.actions
          .filter((e) => e.action.type === 'reconcile-documents')
          .map(button)}
      </div>
      <p className="decision-warning">
        Odtworzenie nie usuwa źródła modyfikacji. Na koniec ponownie porównaj
        dokumenty z ERP. Przy nieograniczonym źródle nawet poprawny wynik może
        się zdezaktualizować.
      </p>
    </div>
  );
}
