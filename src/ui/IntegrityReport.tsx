import { DetectionReview } from './DetectionReview';
import type { selectIntegrityReport } from '../application/selectIntegrityReport';
import { formatMinute } from '../simulation/clock';
import { actionLabel, backupTestLabels } from './simulationPresentation';
const assumptions = {
  'insufficient-evidence': 'Za mało danych',
  'local-modification': 'Modyfikacje z lokalnej stacji',
  'data-drift': 'Niezgodność danych / proces uzgodnienia',
};
const outcomes = {
  modified: 'Zmodyfikowano dokumenty',
  'access-denied': 'Odmowa dostępu',
  'no-new-documents': 'Brak kolejnych poprawnych dokumentów do zmiany',
};
export function IntegrityReport({
  report,
  onHeadquarters,
}: {
  report: NonNullable<ReturnType<typeof selectIntegrityReport>>;
  onHeadquarters: () => void;
}) {
  const s = report.summary;
  return (
    <section
      className="integrity-report"
      aria-label="Raport integralności i odtwarzania"
      data-testid="integrity-report"
    >
      <p className="eyebrow">Misja 02 / Ostatnia czysta kopia / 15:30</p>
      <h1>
        {report.goalMet
          ? 'Dane odzyskane. Źródło ograniczone.'
          : 'Okno zamknięte. Sprawdź pozostałe skutki.'}
      </h1>
      <p>{report.explanation}</p>
      <div className="recovery-report-grid">
        <article>
          <h2>Integralność danych</h2>
          <dl className="integrity-counts">
            <div>
              <dt>Poprawne</dt>
              <dd>{s.correct}</dd>
            </div>
            <div>
              <dt>Uszkodzone</dt>
              <dd>{s.damaged}</dd>
            </div>
            <div>
              <dt>Do uzgodnienia</dt>
              <dd>{s.reconcile}</dd>
            </div>
          </dl>
          <p>
            Suma stanów: {s.total} dokumentów. Kiedykolwiek uszkodzone:{' '}
            {s.everDamaged}; odzyskane przynajmniej raz: {s.recovered}. Te
            historyczne liczniki mogą obejmować ponownie uszkodzone dokumenty.
          </p>
          <p>
            Końcowa integralność potwierdzona badaniem:{' '}
            {s.verified ? 'tak' : 'nie'}.
          </p>
        </article>
        <article>
          <h2>Dostępność i działalność</h2>
          <p>
            FS-01: {s.serviceOnline ? 'online' : 'offline'}; poprawny zbiór
            dostępny do lokalnej pracy: {s.dataAvailable ? 'tak' : 'nie'}.
          </p>
          <p>
            Ograniczona poprawność/dostępność danych: {s.limitedDataMinutes}{' '}
            min.
          </p>
          <p>
            Otrzymane: {report.business.totalReceived}; obsłużone:{' '}
            {report.business.totalProcessed}; zaległe: {report.business.backlog}{' '}
            / 40. Szczyt kolejki: {s.peakBacklog}.
          </p>
          <p>
            Serwer online nie oznacza poprawnych dokumentów. Poprawne dokumenty
            nie przywracają automatycznie izolowanej stacji.
          </p>
        </article>
        <article>
          <h2>Kontrola źródła</h2>
          <p>
            Źródło nadal może modyfikować FS-01:{' '}
            <strong>{s.sourceHasWrite ? 'tak' : 'nie'}</strong>.
          </p>
          <p>
            Izolacja: {s.endpointIsolated ? 'tak' : 'nie'}; ograniczenie zapisu:{' '}
            {s.writesRestricted ? 'tak' : 'nie'}. Kompromitacja stacji
            pozostaje: {report.compromised ? 'tak' : 'nie'}.
          </p>
          <p>
            Zakaz zapisu pozwala odzyskać modelowaną legalną pracę, ale nie jest
            potwierdzeniem oczyszczenia hosta.
          </p>
        </article>
        <article>
          <h2>Odtworzenie</h2>
          <p>
            Ostatnia użyta kopia: {s.backupId ?? 'brak'}. RPO:{' '}
            {s.rpoMinutes === null ? 'nie dotyczy' : `${s.rpoMinutes} min`}.
          </p>
          <p>
            RTO danych od 14:00 do skutecznej kontroli:{' '}
            {s.rtoMinutes === null ? 'niepotwierdzone' : `${s.rtoMinutes} min`}.
          </p>
          <p>
            Zmiany poza zakresem ostatniej kopii: {s.missingChanges}; jawnie
            zrekonstruowane z ERP (unikalne dokumenty): {s.reconstructed}; nadal
            do uzgodnienia: {s.reconcile}.
          </p>
          {report.recoveries.map((r, n) => (
            <p key={n}>
              {r.backupId} · zlecono {formatMinute(r.orderedAtMinute)} →
              odtworzono {formatMinute(r.completedAtMinute)}. Po kopii brakowało{' '}
              {r.missingDocuments} dokumentów.
            </p>
          ))}
        </article>
      </div>
      <section className="investment-report" aria-label="Wpływ inwestycji">
        <h2>Inwestycje i ich faktyczne wykorzystanie</h2>
        {report.investments.edr ? (
          <>
            <h3>EDR · agent obecny na pakowanie-03 (1/94)</h3>
            <p>
              Przechwycono {report.investments.edr.capturedEvents} operacji
              read/modify; w retencji kolektora{' '}
              {report.investments.edr.deliveredEvents}. Alerty:{' '}
              {report.investments.edr.alerts.length}; pierwszy{' '}
              {report.investments.edr.alerts[0]
                ? formatMinute(report.investments.edr.alerts[0].minute)
                : 'brak'}
              . To obserwacje, nie klasyfikacja sprawcy.
            </p>
            <p>
              Dowód modyfikacji faktycznie pozyskany przez EDR:{' '}
              {report.investments.edr.firstEvidenceMinute === null
                ? 'nie pozyskano — możliwości nie wykorzystano'
                : formatMinute(report.investments.edr.firstEvidenceMinute)}
              . Badanie lokalne z takim dowodem:{' '}
              {report.investments.firstLocalEvidenceMinute === null
                ? 'nie wykonano'
                : formatMinute(report.investments.firstLocalEvidenceMinute)}
              .
            </p>
            <p>
              Liczba decyzji ograniczających źródło podjętych po pozyskaniu
              dowodu EDR: {report.investments.edr.informedActions}. Badanie EDR
              trwa 5 min, lokalne 10 min. Zysk czasu zależy od chwili zlecenia i
              dostępności danych; zakup nie izoluje stacji.
            </p>
          </>
        ) : (
          <p>
            Brak agenta EDR. Lokalny dziennik pozostawał dostępny do badania
            przez analityka (10 min).
          </p>
        )}
        <h3>Backup Resilience</h3>
        <p>
          {report.investments.backup
            ? `Wynik testu ${report.investments.backup.backupId}: ${backupTestLabels[report.investments.backup.integrity]}; zakres ${report.investments.backup.checkedDocumentIds.length} dokumentów; próba odtworzenia ${report.investments.backup.restoreTestPassed ? 'zaliczona' : 'niezaliczona'}.`
            : 'Brak wcześniejszego testu programu. Obowiązywały dotychczasowe procedury.'}
        </p>
        <p>
          Wybrana kopia: {s.backupId ?? 'nie użyto'}. Faktyczne odtworzenie:{' '}
          {report.investments.restoreMinutes === null
            ? 'nie wykonano'
            : `${report.investments.restoreMinutes} min`}
          . RPO: {s.rpoMinutes ?? '—'} min. RTO od początku okna:{' '}
          {s.rtoMinutes ?? 'niepotwierdzone'} min. Nadal do uzgodnienia:{' '}
          {s.reconcile} dokumentów.
        </p>
        <p>
          Samo przygotowanie kopii ani odtworzenie nie odbiera źródłu prawa
          zapisu. Wynik zależy od wykonanych działań.
        </p>
      </section>
      {report.detectionReview && (
        <DetectionReview review={report.detectionReview} />
      )}
      <h2>Decyzje: wiedza, założenie, zmiana</h2>
      <div className="integrity-decisions">
        {report.decisions.map((d) => (
          <article key={d.taskId}>
            <strong>
              {formatMinute(d.orderedAtMinute)} ·{' '}
              {actionLabel(
                report.actions.find((t) => t.id === d.taskId)!.action,
              )}
            </strong>
            <p>
              Znane dowody: {d.knownObservationIds.join(', ') || 'brak'}; spis
              kopii:{' '}
              {d.backupInventoryMinute === null
                ? 'nieznany'
                : formatMinute(d.backupInventoryMinute)}
              . Hipoteza: {assumptions[d.assumption]}.
            </p>
            {d.knownEvidence.map((e) => (
              <p key={e.id}>
                {e.id} · {e.source} · {formatMinute(e.minute)}: {e.summary}
              </p>
            ))}
            <p>
              {d.completedAtMinute === null
                ? 'Nie ukończono.'
                : `${formatMinute(d.completedAtMinute)} · ${d.effect}`}
            </p>
          </article>
        ))}
      </div>
      <details>
        <summary>Rozstrzygnięte próby źródła modyfikacji</summary>
        {report.threatHistory.map((h, n) => (
          <p key={n}>
            Tura {h.turn}: {outcomes[h.outcome]} · {h.documentIds.length}{' '}
            dokumentów.
          </p>
        ))}
      </details>
      <button className="primary-button" onClick={onHeadquarters}>
        Wróć do centrali →
      </button>
    </section>
  );
}
