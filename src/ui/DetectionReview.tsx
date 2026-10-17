import type { DetectionReview as Review } from '../application/selectDetectionReview';
import { formatMinute } from '../simulation/clock';
const detectionLabels = {
  'alert-trigger': 'Zdarzenie wyzwalające alert',
  'detected-series': 'Kontynuacja już wykrytej serii — bez nowego alertu',
  undetected: 'Aktywność niewykryta przez regułę',
  'outside-sensor-coverage': 'Poza pokryciem sensora',
  'not-delivered-in-time': 'Niedostarczone na czas',
  'operation-denied': 'Operacja zablokowana',
};
export function DetectionReview({ review: r }: { review: Review }) {
  return (
    <section className="detection-review" aria-label="Przegląd detekcji">
      <h2>Detection Engineering — sygnał czy szum?</h2>
      <p>
        {r.rule
          ? `${r.rule.name}: ≥${r.rule.threshold} dokumentów / ${r.rule.windowMinutes} min. ${r.counting === 'distinct-document-ids-in-sliding-window' ? 'Unikalne ID dokumentów w ruchomym oknie.' : 'Historyczna suma wystąpień dokumentów w operacjach.'}`
          : 'Brak sensora EDR. Dochodzenie lokalne pozostawało dostępne.'}
      </p>
      <p>
        Alerty: {r.alerts.length}. Dotyczące szkodliwej aktywności:{' '}
        {r.truePositiveAlertIds.length}. Dotyczące legalnej aktywności (FP):{' '}
        {r.falsePositiveAlertIds.length}. Szkodliwe, dopuszczone operacje
        niewykryte przez regułę (FN): {r.undetectedHarmfulOperationIds.length}.
        Kontynuacje już wykrytych serii: {r.detectedSeriesOperationIds.length}.
        Operacje poza pokryciem sensora: {r.outsideCoverageOperationIds.length};
        niedostarczone na czas: {r.notDeliveredInTimeOperationIds.length}. Te
        dwie ostatnie kategorie nie są liczone jako FN reguły.
      </p>
      {r.alerts.map((a) => (
        <p key={a.id}>
          {formatMinute(a.minute)} · {a.id} ·{' '}
          {a.classification === 'legal'
            ? 'legalna aktywność — false positive'
            : a.classification === 'harmful'
              ? 'rzeczywista szkodliwa aktywność'
              : a.classification === 'mixed'
                ? 'legalna i szkodliwa aktywność'
                : 'nieustalona'}{' '}
          · {a.modificationCount} dokumentów. Rekordy źródłowe:{' '}
          {a.eventIds.join(', ')}. Późniejsze operacje należące do tej serii:{' '}
          {a.continuationOperationIds.join(', ') || 'brak'}.
        </p>
      ))}
      <p>
        Dowody pozyskano:{' '}
        {r.evidenceObtained
          .map((e) => `${e.id} (${e.source}, ${formatMinute(e.minute)})`)
          .join('; ') || 'nie pozyskano'}
        .
      </p>
      {r.responses.map((a) => (
        <p key={a.taskId}>
          {a.taskId} · zlecono {formatMinute(a.orderedAtMinute)}, ukończono{' '}
          {a.completedAtMinute === null
            ? 'nie ukończono'
            : formatMinute(a.completedAtMinute)}
          . Dostępne wtedy alerty: {a.availableAlertIds.join(', ') || 'brak'}.{' '}
          {a.completionBoundary} Po tej granicy:{' '}
          {a.subsequentHarmfulOperationsAllowed} dopuszczonych szkodliwych
          operacji; {a.subsequentOperationsDenied} prób z odmową. To następstwa
          w czasie, obejmujące inne przyczyny.
        </p>
      ))}
      <p>
        Obsłużono {r.business.processed} zamówień; zaległe {r.business.backlog}.
        Stacja nie wnosiła swojej przepustowości przez{' '}
        {r.business.reducedPackingTurns} tur. Alarm sam nie zmniejsza
        wydajności.
      </p>
      <details>
        <summary>Zdarzenia źródłowe i braki detekcji</summary>
        {r.sourceOperations.map((o) => (
          <p key={o.id}>
            {formatMinute(o.minute)} · {o.id} · {o.documentIds.length}{' '}
            dokumentów · {o.outcome} ·{' '}
            {o.classification === 'legal'
              ? 'legalna aktualizacja'
              : 'szkodliwa próba'}{' '}
            · {detectionLabels[o.detectionStatus]} ·{' '}
            {o.alertIds.join(', ') ||
              o.detectedSeriesAlertIds.join(', ') ||
              o.missedReason}
            .
          </p>
        ))}
      </details>
      <p className="source-note">{r.limitation}</p>
    </section>
  );
}
