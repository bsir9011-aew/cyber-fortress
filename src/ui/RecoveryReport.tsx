import type { RecoveryReport as Report } from '../application/selectRecoveryReport';
import { formatMinute } from '../simulation/clock';
import { actionLabel } from './simulationPresentation';
export function RecoveryReport({
  report: r,
  onHeadquarters,
}: {
  report: Report;
  onHeadquarters: () => void;
}) {
  const s = r.serviceRecovery,
    d = r.dataRecovery,
    b = r.businessContinuity;
  return (
    <section
      className="vendor-card recovery-card"
      aria-label="Raport odzyskiwania ERP"
    >
      <p className="eyebrow">Misja 04 / raport końcowy</p>
      <h2>
        {r.goalMet
          ? 'ERP i operacje odzyskane'
          : r.useful
            ? 'Częściowe odzyskanie operacji'
            : 'Operacje wymagają dalszego odzyskiwania'}
      </h2>
      <p>{r.explanation}</p>
      <h3>Service Recovery</h3>
      <p>
        Instancja {s.instance} · host {s.host ? 'online' : 'offline'} · proces{' '}
        {s.processRunning ? 'działa' : 'zatrzymany'} · baza{' '}
        {s.database ? 'online' : 'offline'} · storage{' '}
        {s.storage ? 'online' : 'offline'} · użyteczna funkcja{' '}
        {s.useful ? 'dostępna' : 'niedostępna'}. Przestój {s.downtimeMinutes}{' '}
        min. Pierwsza użyteczna funkcja{' '}
        {s.firstUsefulMinute === null
          ? 'nieodzyskana'
          : formatMinute(s.firstUsefulMinute)}
        ; obecnie od{' '}
        {s.currentUsefulSince === null
          ? '—'
          : formatMinute(s.currentUsefulSince)}
        . RTO {s.actualRtoMinutes ?? '—'} / {s.rtoTargetMinutes} min:{' '}
        {s.rtoMet ? 'spełnione' : 'przekroczone / nieodzyskane'}.
      </p>
      <h3>Data Recovery</h3>
      <p>
        Spójność {d.consistent ? 'poprawna' : 'błędy'} · punkt{' '}
        {d.recoveryPointMinute === null
          ? 'bieżące dane bez odtworzenia'
          : formatMinute(d.recoveryPointMinute)}{' '}
        · kopia {d.backupId ?? 'brak'}. RPO {d.actualRpoMinutes} /{' '}
        {d.rpoTargetMinutes} min: {d.rpoMet ? 'spełnione' : 'przekroczone'}.
        Wiek kopii nie jest liczbą utraconych zamówień.
      </p>
      <p>
        Brakujące zapisy: {d.missingRecordIds.join(', ') || 'brak'}. Niespójne:{' '}
        {d.corruptRecordIds.join(', ') || 'brak'}. Uzgodnione:{' '}
        {d.reconciledRecordIds.join(', ') || 'brak'}.
      </p>
      <h3>Business Continuity</h3>
      <p>
        Przyjęto {b.received} · obsłużono {b.processed} · zaległe {b.backlog} /{' '}
        {b.backlogLimit}. Ręcznie {b.manualProcessed} przez {b.manualMinutes}{' '}
        min · tryb {b.manualActive ? 'aktywny' : 'zamknięty'} · nieuzgodnione
        wysyłki {b.unreconciledOrders}.
      </p>
      <h3>Operational Confidence</h3>
      <p>
        {r.operationalConfidence.verified
          ? 'Spójność i kompletność potwierdzone dla bieżącej konfiguracji.'
          : 'Brak aktualnego pełnego potwierdzenia spójności i kompletności.'}
      </p>
      <details>
        <summary>Chronologia diagnozy i decyzji</summary>
        {r.tasks.map((t) => (
          <article key={t.taskId}>
            <strong>
              {formatMinute(t.minute)} · {actionLabel(t.action)} · {t.outcome}
            </strong>
            <p>{t.text}</p>
          </article>
        ))}
      </details>
      <button className="primary-button" onClick={onHeadquarters}>
        Powrót do centrali →
      </button>
    </section>
  );
}
