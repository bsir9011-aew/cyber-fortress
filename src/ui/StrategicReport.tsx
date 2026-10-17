import type { CampaignState } from '../domain/campaign';
import { budgetBalance } from '../application/campaignReducer';
import { formatMinute } from '../simulation/clock';
import { projectDefinition } from '../content/securityProjects';
export function StrategicReport({ campaign }: { campaign: CampaignState }) {
  const report = campaign.history.at(-1);
  if (campaign.phase !== 'report' || !report) return null;
  const budget = budgetBalance(campaign);
  return (
    <section className="strategic-report" aria-label="Raport strategiczny">
      <p className="eyebrow">Konfiguracja → próby → wynik</p>
      <h2>Co wniosło przygotowanie firmy?</h2>
      <div className="strategic-report-grid">
        <article>
          <h3>Wydatki i rezerwa</h3>
          <p>
            Wydano {budget.spent.toLocaleString('pl-PL')} zł, zarezerwowano{' '}
            {budget.reserved.toLocaleString('pl-PL')} zł, dostępne{' '}
            {budget.available.toLocaleString('pl-PL')} zł.
          </p>
          <p>
            Zakończone wdrożenia:{' '}
            {report.activeProjects.length
              ? report.activeProjects
                  .map((id) => projectDefinition(id).name)
                  .join(', ')
              : 'brak'}
            .
          </p>
        </article>
        <article>
          <h3>Rzeczywiste uwierzytelnienia</h3>
          <p data-testid="mfa-refusals">
            Odmowy z powodu braku wymaganego drugiego składnika:{' '}
            {report.mfaRefusals}.
          </p>
          <ul>
            {campaign.incident?.telemetry.sourceEvents
              .filter((e) => e.reason === 'mfa-required')
              .map((e) => (
                <li key={e.id}>
                  {formatMinute(e.minute)} · {e.accountId} · odmowa wydania
                  sesji przez usługę VPN.
                </li>
              ))}
          </ul>
          <p>
            Wynik pochodzi z odpowiedzi usługi, nie z przypisania zwycięstwa
            projektowi. Wcześniejsze tunele wymagają osobnej kontroli.
          </p>
        </article>
        <article>
          <h3>Dowody z FS-01</h3>
          <p>
            Rekordy w pozyskanych obserwacjach: {report.fileEvidenceRecords}.
            Ponowne badania mogą obejmować te same rekordy.
          </p>
          <ul>
            {campaign.incident?.knowledge.fileObservations?.map((o) => (
              <li key={o.id}>
                {o.sensorId} · pozyskano {formatMinute(o.observedAtMinute)} ·
                zakres {formatMinute(o.windowStartMinute)}–
                {formatMinute(o.windowEndMinute)} · {o.records.length} rekordów.
              </li>
            ))}
          </ul>
          <p>
            {campaign.incident?.telemetry.fileAudit
              ? 'Źródło: fs-01-audit, list/open/read. Czasy i zakresy powyżej pochodzą z pozyskanych dowodów. Audyt nie blokuje dostępu.'
              : 'Audyt FS-01 nie został wdrożony; to źródło nie jest dostępne w tej misji.'}
          </p>
        </article>
        <article>
          <h3>Działalność i ryzyko</h3>
          <p>
            {report.processed} obsłużonych, {report.backlog} zaległych.
            Najniższa wydajność: {report.minimumCapacity} /{' '}
            {report.fullCapacity} zamówień na turę. Przedziały poniżej pełnej
            wydajności: {report.reducedCapacityTurns}.
          </p>
          <p>
            Raport misji pokazuje obecny dostęp i źródło każdego skutku.
            Dopuszczone konto może nadal służyć osobie nieuprawnionej; MFA i
            reguły nie zastępują oceny pozostałych sesji.
          </p>
        </article>
      </div>
      <p>
        Po powrocie zachowasz inwestycje, budżet oraz rzeczywiście zmienione
        reguły, konta i dostępność. Nowy incydent otrzyma świeże logowania,
        wiedzę i licznik danych.
      </p>
    </section>
  );
}
