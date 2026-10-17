import type { PlayerView } from '../application/selectPlayerView';
import { formatMinute } from '../simulation/clock';
export function FileEvidence({ view }: { view: PlayerView }) {
  const sensor = view.fileSensor;
  if (!sensor) return null;
  return (
    <section
      className="file-evidence evidence-card"
      aria-label="Dowód: audyt FS-01"
    >
      <span className="eyebrow">Wdrożone źródło obserwacji</span>
      <h2>Audyt dostępu do FS-01</h2>
      <p>
        Źródło: {sensor.id} / {sensor.sourceAssetId} · retencja{' '}
        {sensor.retentionMinutes} min · opóźnienie {sensor.delayMinutes} min od
        zebrania.
      </p>
      <p>
        Sensor obserwuje list/open/read{view.integrity ? '/modify' : ''} w
        usłudze, również legalne odczyty. Nie widzi żądań zatrzymanych przez
        sieć. Brak zapisu nie dowodzi braku aktywności.
      </p>
      {view.fileObservations.length === 0 ? (
        <p>Nie pozyskano jeszcze dowodu. Zleć analitykowi pobranie audytu.</p>
      ) : (
        view.fileObservations.map((o) => (
          <details key={o.id} open={o === view.fileObservations.at(-1)}>
            <summary>
              Obserwacja {o.id} · pozyskano {formatMinute(o.observedAtMinute)} ·{' '}
              {o.records.length} rekordów
            </summary>
            <p className="evidence-meta">
              Źródło {o.sensorId} · zakres {formatMinute(o.windowStartMinute)}–
              {formatMinute(o.windowEndMinute)}. Dane stanowią migawkę.
            </p>
            <div
              className="file-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Zdarzenia audytu plików"
            >
              <table>
                <thead>
                  <tr>
                    <th>Czas</th>
                    <th>Konto / sesja</th>
                    <th>Cel / operacja</th>
                    <th>Wynik / wolumen</th>
                    <th>Dostępne od</th>
                  </tr>
                </thead>
                <tbody>
                  {o.records.map((r) => (
                    <tr key={r.id}>
                      <td>{formatMinute(r.minute)}</td>
                      <td>
                        {r.accountId}
                        <small>
                          {r.endpointId
                            ? `Stacja ${r.endpointId} · lokalny kontekst`
                            : r.sessionId}
                        </small>
                      </td>
                      <td>
                        {r.targetAssetId} / {r.operation}
                      </td>
                      <td>
                        {r.outcome === 'allowed' ? 'Dopuszczono' : 'Odmówiono'}
                        <small>
                          {r.recordsRead === null
                            ? r.documentIds
                              ? `${r.documentIds.length} dokumentów w zakresie (${r.documentIds[0] ?? 'brak'}…${r.documentIds.at(-1) ?? 'brak'})`
                              : 'Wolumen niemierzony'
                            : `${r.recordsRead} rekordów odczytu`}
                        </small>
                      </td>
                      <td>{formatMinute(r.availableAtMinute)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))
      )}
    </section>
  );
}
