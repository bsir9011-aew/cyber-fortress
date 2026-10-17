import type { VendorReport as Report } from '../application/selectVendorReport';
import { formatMinute } from '../simulation/clock';
export function VendorReport({
  report: r,
  onHeadquarters,
}: {
  report: Report;
  onHeadquarters: () => void;
}) {
  const s = r.summary;
  return (
    <section
      className="integrity-report vendor-report"
      aria-label="Raport Misji 03"
    >
      <p className="eyebrow">Misja 03 / Dostawca na godzinę / 15:30</p>
      <h1>
        {r.goalMet
          ? 'Zlecenie wykonane. Dostęp rozliczony.'
          : 'Okno zamknięte. Sprawdź skutki dostępu.'}
      </h1>
      <p>{r.explanation}</p>
      <div className="recovery-report-grid">
        <article>
          <h2>Zatwierdzenie i czas</h2>
          <p>
            {r.approved
              ? `${r.approved.approvalId}: ${r.approved.scope === 'api-only' ? 'tylko HTTPS' : 'HTTPS i SMB'}, od 14:00 do ${formatMinute(r.approved.expiresAtMinute)}.`
              : 'Nie zatwierdzono wyjątku.'}
          </p>
          {r.authorizationIntervals.map((i, n) => (
            <p key={n}>
              {formatMinute(i.startMinute)}–{formatMinute(i.endMinute)} ·{' '}
              {i.scope === 'api-only' ? 'tylko HTTPS' : 'HTTPS i SMB'}.
              Przedział autoryzacji; dostęp wymagał także działających usług,
              sesji, ACL i uprawnienia.
            </p>
          ))}
          <p>
            Wygaśnięcie wykonane:{' '}
            {s.expired
              ? 'tak'
              : 'nie (brak wyjątku lub wcześniejsze cofnięcie)'}
            . Stan końcowy: {s.finalException?.status ?? 'brak'}.
          </p>
        </article>
        <article>
          <h2>Potrzeba biznesowa i wynik</h2>
          <p>
            Legalne zlecenie wymagało{' '}
            {s.requiresFiles ? 'HTTPS oraz SMB' : 'wyłącznie HTTPS'}. Wykonano{' '}
            {s.completedBatches}/{s.requiredBatches} partii. Szerszy zakres
            oceniamy w kontekście zlecenia i dostępnych wtedy dowodów.
          </p>
          <p>
            Przyjęto {r.business.totalReceived}; obsłużono{' '}
            {r.business.totalProcessed}; zaległe {r.business.backlog} / 40.
          </p>
        </article>
        <article>
          <h2>Sesje i rzeczywiste cofnięcie</h2>
          <p>
            Aktywne sesje konta: {s.activeSessionCount}. Dostęp do chronionych
            usług po terminie:{' '}
            {s.accessAfterDeadline ? 'nadal możliwy' : 'odmówiony'}.
          </p>
          {r.sessions.map((x) => (
            <p key={x.id}>
              {x.id} ·{' '}
              {x.origin === 'legitimate'
                ? 'legalna'
                : x.origin === 'unauthorized'
                  ? 'nieuprawniona'
                  : 'nieustalona'}{' '}
              · {x.active ? 'aktywna' : 'nieaktywna'} · HTTPS{' '}
              {x.apiAllowed ? 'allow' : 'deny'}, SMB{' '}
              {x.smbAllowed ? 'allow' : 'deny'}.
            </p>
          ))}
        </article>
        <article>
          <h2>Nadużycie i ekspozycja</h2>
          <p>
            Nieuprawnione próby logowania:{' '}
            {s.unauthorizedAuthenticationAttempts}. Ujawniono {s.exposedRecords}{' '}
            rekordów.{' '}
            {r.threatAccess.applicable
              ? `Skradzione poświadczenie aktualne: ${r.threatAccess.stolenCredentialStillCurrent ? 'tak' : 'nie'}; nowe uwierzytelnienie możliwe: ${r.threatAccess.newAuthenticationAllowed ? 'tak' : 'nie'}.`
              : 'Brak modelowanego sprawcy w tym przebiegu.'}
          </p>
          <p>
            Wygaśnięcie nie usuwa wykonanych odczytów. MFA chroni nowe
            uwierzytelnienia, a autoryzacja obowiązuje także istniejące sesje.
          </p>
        </article>
      </div>
      <h2>Zmiany i pozyskane dowody</h2>
      {r.changes.map((c, n) => (
        <p key={n}>
          {formatMinute(c.minute)} · {c.kind} · {c.taskId ?? 'cykl wyjątku'} ·{' '}
          {c.exception.approvalId}.
        </p>
      ))}
      <p>
        Obserwacje:{' '}
        {r.evidence
          .map((o) => `${o.id} o ${formatMinute(o.observedAtMinute)}`)
          .join('; ') || 'nie pozyskano'}
        .
      </p>
      <details>
        <summary>
          Rzeczywiście dopuszczone i odrzucone operacje ({r.operations.length})
        </summary>
        {r.operations.map((o) => (
          <p key={o.id}>
            {formatMinute(o.minute)} · {o.id} ·{' '}
            {o.origin === 'legitimate'
              ? 'legalna praca'
              : o.origin === 'unauthorized'
                ? 'nieuprawniona próba'
                : 'nieustalone pochodzenie'}{' '}
            · {o.sessionId} → {o.targetAssetId}/{o.protocol} · {o.operation} ·{' '}
            {o.outcome} · odczytano {o.recordsRead ?? '—'} rekordów. ACL{' '}
            {o.accessChecks.networkAllowed ? 'allow' : 'deny'}; uprawnienie{' '}
            {o.accessChecks.permissionAllowed ? 'tak' : 'nie'}; wyjątek{' '}
            {o.accessChecks.exceptionAllowed ? 'tak' : 'nie'}.
          </p>
        ))}
      </details>
      <p className="source-note">
        To fakty tego przebiegu. Pochodzenie operacji ujawniono dopiero po
        misji. Raport nie ocenia automatycznie szerokiej polityki ani nie
        przedstawia nieprzeprowadzonych alternatyw jako pewnego wyniku. AAR
        poniżej rozdziela wiedzę przed decyzją od później ujawnionej prawdy.
      </p>
      <button className="primary-button" onClick={onHeadquarters}>
        Wróć do centrali →
      </button>
    </section>
  );
}
