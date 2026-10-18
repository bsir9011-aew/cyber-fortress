import type { BranchReport as Report } from '../application/selectBranchReport';
import { smbScopeLabels } from '../content/branchLabels';
import { formatMinute } from '../simulation/clock';
import { actionLabel } from './simulationPresentation';
export function BranchReport({
  report: r,
  onHeadquarters,
}: {
  report: Report;
  onHeadquarters: () => void;
}) {
  const denied = r.operations.filter((o) => !o.checks.allowed).length,
    legal = r.operations.filter((o) => o.origin === 'legitimate').length,
    unauthorized = r.operations.filter(
      (o) => o.origin === 'unauthorized',
    ).length;
  return (
    <section className="vendor-card branch-card" aria-label="Raport Misji 05">
      <p className="eyebrow">Misja 05 / After Action Review</p>
      <h2>
        {r.goalMet
          ? 'Oddział gotowy do bezpiecznej pracy'
          : 'Oddział — wynik częściowy lub nieosiągnięty'}
      </h2>
      <p>{r.explanation}</p>
      <h3>Architektura i rzeczywista dostępność</h3>
      <p>
        Trasa końcowa {r.activeRoute} · oddział{' '}
        {r.ready
          ? 'pełna obsługa 6/turę'
          : 'ograniczona lub niedostępna obsługa'}
        . Początkowo SMB {smbScopeLabels[r.initialArchitecture.smbScope]},
        ostatecznie {smbScopeLabels[r.finalArchitecture.smbScope]}. ERP{' '}
        {r.finalArchitecture.erpEnabled ? 'wdrożone' : 'niewdrożone'}.
      </p>
      <p>
        Backup {r.backupUse.prepared ? 'przygotowany' : 'nieprzygotowany'} ·
        aktywny {r.backupUse.activeIntervals * 5} min ·{' '}
        {r.backupUse.forwardedOperations} przekazanych operacji. Wyłącznie
        HTTPS, bez SMB.
      </p>
      <h3>Praca i ryzyko</h3>
      <p>
        Otrzymano {r.business.totalReceived} · obsłużono{' '}
        {r.business.totalProcessed} · zaległe {r.business.backlog} / 40. Legalne
        próby {legal}, nieuprawnione {unauthorized}, odmowy usługowe {denied}.
        Nieuprawniony odczyt {r.exposedRecords} rekordów. Bieżący dostęp
        przejętego kontekstu do FS-01:{' '}
        {r.remainingAccess ? 'pozostaje' : 'brak / nie dotyczy'}.
      </p>
      <p>
        Niepotrzebnie dostępne SMB w aktywnej konfiguracji:{' '}
        {r.unnecessaryFileAccess.join(', ') || 'brak'}. Szerokie nadanie bez
        nieuprawnionej operacji nie jest samo incydentem.{' '}
        {r.unusedCapabilities.join(' ')}
      </p>
      <details>
        <summary>Drogi i warunki dostępu na końcu</summary>
        {r.routes.map((route) => (
          <article key={route.route}>
            <h3>
              {route.route === r.activeRoute ? 'Aktywna' : 'Nieaktywna'} trasa{' '}
              {route.route}
            </h3>
            <ul>
              {route.checks.map((c) => (
                <li key={c.contextId + c.target}>
                  {c.accountId} → {c.target}/{c.protocol}: topologia{' '}
                  {c.topologyExists ? 'tak' : 'nie'} · infrastruktura{' '}
                  {c.infrastructureAvailable ? 'dostępna' : 'niedostępna'} ·
                  tunel uwierzytelniony {c.tunnelAuthenticated ? 'tak' : 'nie'}{' '}
                  · kontekst {c.contextAuthenticated ? 'wydany' : 'niewydany'} ·
                  ACL {c.networkAllowed ? 'allow' : 'deny'} · nadanie{' '}
                  {c.permissionAllowed ? 'tak' : 'nie'} · bieżąca autoryzacja{' '}
                  {c.serviceAuthorized ? 'tak' : 'nie'} · dostęp{' '}
                  {c.allowed ? 'dopuszczony' : 'odmowa'}.
                </li>
              ))}
            </ul>
          </article>
        ))}
        <p>
          Możliwości nieaktywnej trasy są oceną predykatów, nie wynikiem
          alternatywnej rozgrywki.
        </p>
      </details>
      <details>
        <summary>Rzeczywiste operacje i ekspozycja</summary>
        <ul>
          {r.operations.map((o) => (
            <li key={o.id}>
              {formatMinute(o.minute)} ·{' '}
              {o.origin === 'legitimate'
                ? 'legalna praca'
                : 'nieuprawniony kontekst'}{' '}
              · {o.accountId} → {o.targetAssetId}/{o.protocol} · {o.operation} ·{' '}
              {o.checks.allowed ? 'dopuszczono' : 'odmowa'} · dotarcie do usługi{' '}
              {o.checks.reachedService ? 'tak' : 'nie'} · odczyt{' '}
              {o.recordsRead ?? '—'} rekordów.
            </li>
          ))}
        </ul>
        <p>
          Niepotrzebna dostępność SMB w {r.unnecessaryExposureIntervals.length}{' '}
          rzeczywistych przedziałach po 5 min; to dostępność możliwości, nie
          dowód wykorzystania.
        </p>
      </details>
      <details>
        <summary>Chronologia diagnozy i reakcji</summary>
        {r.tasks.map((t) => (
          <article key={t.taskId}>
            <strong>
              {formatMinute(t.minute)} · {actionLabel(t.action)} · {t.outcome}
            </strong>
            <p>{t.text}</p>
          </article>
        ))}
        {r.events.map((e, i) => (
          <p key={i}>
            {formatMinute(e.minute)} · {e.text}
          </p>
        ))}
      </details>
      <button className="primary-button" onClick={onHeadquarters}>
        Powrót do centrali →
      </button>
    </section>
  );
}
