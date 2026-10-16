import type { PlayerView } from '../application/selectPlayerView';

const availabilityLabels = {
  available: 'pełna obsługa',
  degraded: 'ograniczona obsługa',
  unavailable: 'zatrzymany',
};

export function BusinessPanel({ view }: { view: PlayerView }) {
  const report = view.business.lastReport;
  return (
    <section
      className="business-panel"
      aria-label="Działalność NEXUS Logistics"
    >
      <div className="business-heading">
        <div>
          <span className="eyebrow">Firma musi działać</span>
          <h2>{view.processName}</h2>
        </div>
        <span className="business-target">
          Cel 15:30: ≤ {view.maxFinalBacklog} zaległych
        </span>
      </div>
      <dl className="business-metrics">
        <div>
          <dt>Otrzymane zamówienia</dt>
          <dd data-testid="orders-received">{view.business.totalReceived}</dd>
        </div>
        <div>
          <dt>Obsłużone zamówienia</dt>
          <dd data-testid="orders-processed">{view.business.totalProcessed}</dd>
        </div>
        <div className={!view.goalMet ? 'business-warning' : ''}>
          <dt>Zaległe zamówienia</dt>
          <dd data-testid="orders-backlog">{view.business.backlog}</dd>
        </div>
        <div>
          <dt>Bieżąca wydajność / 5 min</dt>
          <dd data-testid="orders-capacity">{view.availability.capacity}</dd>
        </div>
      </dl>
      <div className="business-access">
        <span className={`process-${view.availability.status}`}>
          Proces: {availabilityLabels[view.availability.status]}
        </span>
        <span className={view.vpnOnline ? 'status-online' : 'status-offline'}>
          VPN: {view.vpnOnline ? 'działa' : 'wyłączony'}
        </span>
        <span className={view.erpOnline ? 'status-online' : 'status-offline'}>
          ERP: {view.erpOnline ? 'działa' : 'niedostępny'}
        </span>
        <span>
          Zdalna obsługa ERP:{' '}
          {view.availability.remoteAvailable ? 'dostępna' : 'niedostępna'}
        </span>
        <span>
          Obsługa lokalna:{' '}
          {view.availability.localAvailable ? 'dostępna' : 'niedostępna'}
        </span>
      </div>
      <p className="business-last-report">
        {report
          ? `Ostatnie 5 minut: +${report.received} zamówień · obsłużono ${report.processed} · wydajność ${report.capacity}.`
          : 'Raport operacyjny pojawi się po zakończeniu pierwszej tury.'}
      </p>
      {view.finished && (
        <section
          className={`business-result${!view.goalMet ? ' missed' : ''}`}
          role="status"
          aria-label="Podsumowanie biznesowe"
        >
          <h3>Okno operacyjne zakończone</h3>
          <p>
            {view.goalMet
              ? 'Cel operacyjny osiągnięty.'
              : 'Cel operacyjny nie został osiągnięty.'}{' '}
            Obsłużono {view.business.totalProcessed} z{' '}
            {view.business.totalReceived} zamówień. Zaległości:{' '}
            {view.business.backlog}; limit: {view.maxFinalBacklog}.
          </p>
        </section>
      )}
    </section>
  );
}
