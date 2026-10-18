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
      <details className="business-dependencies">
        <summary>Od czego zależy wydajność firmy?</summary>
        {view.finale && (
          <p>
            Centrala 8 (w tym dokumenty i 2 z pakowanie-03), zdalni 8 przez VPN,
            EAST 3 (1 ERP i 2 z dokumentami), CARGO-LINK 3 przez sesję i API.
            Każdy składnik wymaga rzeczywiście działającego ERP z poprawną bazą
            i dostępnej drogi. Starsze dane ograniczają wydajność. Tryb ręczny
            zastępuje do 8 lokalnych zleceń z przygotowanych manifestów, nigdy
            nie dodaje do 22. Wysyłki są rejestrowane raz i wymagają
            uzgodnienia.
          </p>
        )}
        {view.branch && !view.finale && (
          <p>
            NEXUS EAST wnosi do 6/turę: site-to-site lub przygotowany backup
            HTTPS (do 3). Wymagana praca dokumentowa potrzebuje także SMB i
            nadania konta. Zapasowa droga HTTPS nie obsługuje plików. W całej
            firmie nadal najwyżej 22/turę.
          </p>
        )}
        {view.recovery && !view.finale && (
          <p>
            ERP wymaga sprawnego hosta, procesu, bazy, storage, poprawnych
            danych i drogi użytkownika. Brakujące zapisy ograniczają wydajność
            proporcjonalnie: floor(8 × kompletność) + floor(14 × kompletność).
            Ręczne manifesty zastępują ERP: do 10/turę z tej samej kolejki.
            Zrealizowane zamówienia nie są ponownie wysyłane po odtworzeniu, ale
            wymagają uzgodnienia potwierdzeń.
          </p>
        )}
        {view.integrity && !view.finale && (
          <p>
            W tej misji 14 zamówień wydajności zdalnej zależy także od
            dostępnego FS-01 i udziału poprawnych dokumentów: floor(14 ×
            poprawne / 100). Izolacja pakowanie-03 odbiera 2 z 8 lokalnych
            zamówień wydajności. Sprawna całość: 22. Stan danych poznajesz przez
            badanie; tu widzisz rzeczywistą wydajność procesu.
          </p>
        )}
        <ul>
          <li>
            {view.businessDependencies.localCapacity} zamówień / turę: lokalne
            stanowiska → ERP przez HTTPS.
          </li>
          <li>
            {view.businessDependencies.remoteCapacity} zamówień / turę: konto{' '}
            {view.businessDependencies.remoteAccountId} → ERP przez VPN i HTTPS.
          </li>
          {view.businessDependencies.additionalWork.map((work) => (
            <li key={work.id}>
              <strong>
                {work.capacity} zamówień / turę: {work.name}.
              </strong>{' '}
              Konto {work.accountId}{' '}
              {work.accessMode === 'branch-context'
                ? 'potrzebuje lokalnego uwierzytelnionego kontekstu, drogi site-to-site lub backup oraz'
                : 'potrzebuje własnej aktywnej sesji oraz'}{' '}
              {work.services
                .map(
                  (service) => `${service.targetAssetId} / ${service.protocol}`,
                )
                .join(' i ')}
              .
            </li>
          ))}
        </ul>
        <p>
          Wydajność wynika z dostępności, sesji, reguł i uprawnień.
          Niewykorzystana wydajność nie przechodzi na kolejne tury.
        </p>
      </details>
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
          {view.recovery
            ? 'ERP: stan hosta i danych w centrum odzyskiwania'
            : `ERP: ${view.erpOnline ? 'działa' : 'niedostępny'}`}
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
      {view.availability.contributions && (
        <div className="business-access">
          {view.availability.contributions.map((work) => (
            <span key={work.id}>
              {work.name}: {work.available ? 'dostępne' : 'niedostępne'} ·{' '}
              {work.capacity} / turę
            </span>
          ))}
        </div>
      )}
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
