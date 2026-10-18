import type {
  AarActualState,
  AarData,
  AarEvidence,
  FortressAfterActionReportV1,
} from '../domain/afterActionReport';
import { MAX_AAR_BYTES } from '../domain/afterActionReport';
import { validateAfterActionReport } from './validateAfterActionReport';
import { aarActionLabel, aarClock } from './aar/labels';
/** Imported strings are inert text, including Markdown syntax and HTML. */
export const markdownText = (v: unknown) =>
  String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_[\]#|]/g, '\\$&')
    .replace(/[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ');
const text = markdownText;
const yes = (v: boolean | null) =>
  v === null ? 'nie dotyczy' : v ? 'tak' : 'nie';
const object = (v: AarData): v is { [key: string]: AarData } =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const details = (v: AarData): string => {
  if (v === null) return 'Brak danych / nie dotyczy.';
  if (Array.isArray(v)) return v.map((value) => details(value)).join('\n\n');
  if (!object(v)) return text(v);
  return Object.entries(v)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.every((v) => typeof v === 'string' || typeof v === 'number'))
          return `- ${text(key)}: ${text(value.join(', ')) || 'brak'}.`;
        return `- ${text(key)} (${value.length}):\n\n${value.map((e) => details(e)).join('\n\n')}`;
      }
      if (object(value)) return `- ${text(key)}:\n\n${details(value)}`;
      return `- ${text(key)}: ${text(value)}.`;
    })
    .join('\n');
};
function stateSummary(s: AarActualState) {
  const a = s.threatAccess;
  return [
    `Wydajność: **${s.availability.capacity} zamówień/turę**; wykradzione rekordy: **${s.exposedRecords}**.`,
    a.applicable
      ? `Aktywne nieuprawnione tunele: ${text(a.activeSessionIds.join(', ')) || 'brak'}. Tunele z dostępem do celu: ${text(a.usableSessionIds.join(', ')) || 'brak'}. Skradzione poświadczenie nadal aktualne: ${yes(a.stolenCredentialStillCurrent)}. Nowe uwierzytelnienie możliwe: ${yes(a.newAuthenticationAllowed)}. Dostęp do celu po nowym uwierzytelnieniu: ${yes(a.accessAfterNewAuthentication)}.`
      : 'W tej misji ocena nieuprawnionego dostępu VPN nie dotyczy sprawcy. Nie oznacza to, że każda decyzja zachowała legalną działalność.',
    s.documents
      ? `Dokumenty: ${s.documents.correct} poprawnych / ${s.documents.damaged} uszkodzonych / ${s.documents.reconcile} do uzgodnienia; razem ${s.documents.total}. Odzyskane przynajmniej raz: ${s.documents.recovered}.`
      : '',
    s.vendorAuthorization
      ? `Autoryzacja dostawcy:\n\n${details(s.vendorAuthorization)}`
      : '',
    s.erpRecovery ? `ERP recovery:\n\n${details(s.erpRecovery)}` : '',
    s.endpoint ? `Endpoint:\n\n${details(s.endpoint)}` : '',
    `Konta (prawda po misji):\n\n${s.accounts.map((a) => `- ${text(a.id)}: ${a.loginStatus}, credentialVersion=${a.credentialVersion}, MFA=${a.mfaPolicy}.`).join('\n')}`,
    `Sesje (prawda po misji):\n\n${s.sessions.map((a) => `- ${text(a.id)} / ${text(a.accountId)}: ${a.status}, pochodzenie ${a.origin}; ${aarClock(a.startedAtMinute)}–${aarClock(a.expiresAtMinute)}.`).join('\n') || 'Brak.'}`,
    `Rozstrzygnięte możliwości usługowe (czysta ocena istniejącego predykatu, nie nowe próby):\n\n${s.serviceAccess.map((f) => `- ${text(f.sessionId)} → ${text(f.targetAssetId)}/${text(f.protocol)}: ${f.allowed ? 'dopuszczony' : 'odmowa'}.`).join('\n') || 'Brak sesji.'}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}
function evidenceSection(e: AarEvidence) {
  return `### ${text(e.id)} — ${text(e.kind)}\n\nŹródło: ${text(e.source)}. Pozyskano: ${aarClock(e.obtainedAt.minute)}, tura ${e.obtainedAt.turn ?? '—'}, po komendzie ${e.obtainedByCommand}. Rodzaj: ${e.assertion}. Zadanie: ${text(e.taskId)}.\n\n${details(e.details)}`;
}
/** The same facts as JSON, formatted for offline reading; no inference or scoring. */
export function renderAfterActionMarkdown(
  r: FortressAfterActionReportV1,
): string {
  if (!validateAfterActionReport(r).ok)
    throw new Error('Niespójny raport AAR.');
  const b = r.businessConsequences,
    s = r.securityConsequences,
    i = s.integrity,
    c = r.campaignContext;
  const lines = [
    `# FORTRESS LAB — After Action Review`,
    `Raport **${text(r.reportId)}** · Fortress AAR V1 · wygenerowano ${text(r.generatedAt)}.\n\nTo raport analizy zakończonej rozgrywki, **nie zapis do wczytania w grze**. Zawiera prawdę ujawnioną po misji.`,
    '## 1. Podsumowanie',
    `${text(r.scenario.family)} — ${text(r.scenario.name)}. ${aarClock(r.scenario.startMinute)}–${aarClock(r.scenario.endMinute)}, ${r.scenario.turnLimit} tur po ${r.scenario.turnMinutes} min. Seed ${r.scenario.seed}.`,
    `Cele spełnione łącznie: ${yes(r.finalOutcome.allObjectivesMet)}. Poufność: ${yes(r.finalOutcome.confidentialityMet)}; ciągłość: ${yes(r.finalOutcome.continuityMet)}; ograniczenie źródła: ${yes(r.finalOutcome.containmentMet)}; integralność: ${yes(r.finalOutcome.integrityMet)}. To wyniki celów, **nie ocena jakości rozumowania**.`,
    '## 2. Kontekst firmy',
    `${r.organization.name}: ${r.organization.employees} pracowników, ${r.organization.computers} komputerów.`,
    c
      ? `Kampania: misja ${c.missionNumber}, okno przygotowania ${c.preparationWindow}. Budżet na starcie: ${c.budgetAtStart.total} PLN; wydano ${c.budgetAtStart.spent}; zarezerwowano ${c.budgetAtStart.reserved}; dostępne ${c.budgetAtStart.available}.\n\nFinansowanie:\n\n${details(c.funding as unknown as AarData)}\n\nProjekty:\n\n${c.projects.map((p) => `- **${text(p.name)}**: ${p.status}; koszt ${p.costPLN} PLN; pozostało admin ${p.remaining.administrator} h / analityk ${p.remaining.analyst} h. Mechanizm: ${text(p.mechanism)} Granica: ${text(p.limitation)}`).join('\n')}\n\nPraca przygotowawcza (godziny poza zegarem incydentu):\n\n${details(c.work as unknown as AarData)}${c.detectionChanges ? `\n\nZmiany reguły w Centrali (aktywnie po ukończeniu 1 h):\n\n${details(c.detectionChanges as unknown as AarData)}` : ''}\n\nRejestr inwestycji:\n\n${details(c.investmentLedger as unknown as AarData)}\n\nOdziedziczona konfiguracja:\n\n${details(c.posture as unknown as AarData)}${c.vendorApprovals ? `\n\nZatwierdzenia CARGO-LINK w Centrali:\n\n${details(c.vendorApprovals as unknown as AarData)}` : ''}`
      : 'Samodzielna misja, bez budżetu i przygotowania kampanii.',
    '## 3. Cele misji',
    details(r.missionObjectives),
    ...(c?.branchArchitecture
      ? [
          'Przygotowanie architektury EAST:',
          details(c.branchArchitecture as unknown as AarData),
          details((c.branchWork ?? []) as unknown as AarData),
        ]
      : []),
    '## 4. Najważniejsze decyzje',
    'Zachowano wszystkie zlecenia, odmowy i zmiany hipotez. Przesunięcie zegara jest na osi czasu. Brak zapisanej intencji oznacza, że nie przypisujemy graczowi uzasadnienia ani oczekiwanego skutku.',
    ...r.playerDecisions.map((d) =>
      [
        `### ${text(d.id)} — ${aarClock(d.issuedAt.minute)} — ${text(aarActionLabel(d))}`,
        `Status: **${d.status}**. Wykonawca: ${text(d.workerId)}. Zadanie: ${text(d.taskId)}. Komenda ${d.commandOrdinal}. Zakończono: ${d.completedAt ? aarClock(d.completedAt.minute) : 'brak / nie dotyczy'}. ${d.rejection ? `Odmowa: ${text(d.rejection)}.` : ''}`,
        `**Wiedza przed decyzją** (${aarClock(d.knownAtDecision.at.minute)}): hipoteza VPN ${text(d.knownAtDecision.hypotheses.vpn)}; integralność ${text(d.knownAtDecision.hypotheses.integrity)}. Hipotezy są niezweryfikowanymi deklaracjami.`,
        `Pozyskane dowody: ${d.knownAtDecision.evidenceIds.map(text).join(', ') || 'brak'}. Alerty: ${d.knownAtDecision.alertIds.map(text).join(', ') || 'brak'}. Znane ID sesji: ${text(d.knownAtDecision.knownSessionIds.join(', ')) || 'brak'}. Migawka bramy: ${d.knownAtDecision.sessions === null ? 'nie pobrano migawki' : d.knownAtDecision.sessions.map((s) => `${text(s.id)} / ${text(s.accountId)} / ${text(s.gatewayAssetId)} od ${aarClock(s.startedAtMinute)}`).join('; ') || 'migawka bez aktywnych sesji'}.`,
        `Znana konfiguracja:\n\n${details(d.knownAtDecision.configuration as unknown as AarData)}`,
        `Znany stan biznesu: ${d.knownAtDecision.business.totalProcessed} obsłużonych, ${d.knownAtDecision.business.backlog} zaległych. Zadania w toku: ${d.knownAtDecision.pendingTasks.map((t) => `${text(t.id)} (${text(t.action.type)}, start t${t.startTurn}, termin t${t.dueTurn})`).join('; ') || 'brak'}.`,
        `Ograniczenia i niewiadome:\n\n${[...d.knownAtDecision.sourceLimitations, ...d.knownAtDecision.unknowns].map((v) => `- ${text(v)}`).join('\n')}`,
        `**Rzeczywisty stan przed decyzją — ujawniony dopiero po misji:**\n\n${stateSummary(d.actualStateAtDecision)}`,
        d.actualEffect
          ? `**Rzeczywisty skutek:** zadanie ukończone ${aarClock(d.completedAt!.minute)}. Natychmiastowy ślad before/after istniejącego silnika:\n\n${details(d.actualEffect.immediateAccessImpact)}\n\nStan po całej granicy zakończenia (obejmuje także współbieżne działania):\n\n${stateSummary(d.actualEffect.boundaryState)}\n\nPowiązane zdarzenia granicy: ${d.actualEffect.eventIds.map(text).join(', ')}.`
          : d.status === 'rejected'
            ? '**Nie wykonano działania.** Odmowa nie jest udanym efektem.'
            : d.status === 'running'
              ? '**Zadanie nadal w toku.** Brak potwierdzenia zakończenia.'
              : 'Zapisano hipotezę; sama deklaracja nie zmienia mechanizmów bezpieczeństwa.',
        `**Późniejsze następstwa:** oś czasu od ${text(d.subsequentConsequences.afterEventId)} do ${text(d.subsequentConsequences.throughEventId)} oraz końcowe skutki w sekcjach 7–8. Zakres obejmuje inne przyczyny. Bez zapisanej intencji nie można rozstrzygnąć, które skutki były niezamierzone.`,
      ].join('\n\n'),
    ),
    ...(r.playerDecisions.length
      ? []
      : [
          'Nie wydano zleceń ani nie zmieniono hipotez; pozostały przesunięcia czasu.',
        ]),
    '## 5. Oś czasu',
    'Każdy wiersz ma stabilne ID. Minuta to fikcyjny czas świata. Zlecenie, ukończenie, obowiązywanie konfiguracji i pozyskanie obserwacji są osobnymi zdarzeniami. Gotowość rekordu sensora nie oznacza wiedzy gracza.',
    '| ID | Czas / tura | Rodzaj / status | Źródło / faza | Powiązania | Fakty |',
    '| --- | --- | --- | --- | --- | --- |',
    ...r.timeline.map(
      (e) =>
        `| ${text(e.id)} | ${aarClock(e.at.minute)} / ${e.at.turn ?? '—'} | ${text(e.kind)} / ${text(e.status)} | ${text(e.source)} / ${text(e.phase)} | ${[e.decisionId, e.taskId, e.evidenceId].filter(Boolean).map(text).join(', ')} | ${text(JSON.stringify(e.details))} |`,
    ),
    '## 6. Dowody i ograniczenia wiedzy',
    'Katalog zawiera również dowody uzyskane później. Dla decyzji obowiązują **wyłącznie** wskazane w niej evidenceIds, nigdy cały katalog. Alert to sygnał, relacja człowieka to relacja; żadne z nich nie jest automatycznym potwierdzeniem sprawcy.',
    ...r.knownEvidence.map(evidenceSection),
    '## 7. Skutki techniczne',
    `Wykradzione rekordy: ${s.exposedRecords}. Stan końcowy:\n\n${stateSummary(r.groundTruth.finalState)}`,
    i
      ? `RPO: ${i.rpoMinutes === null ? 'nie dotyczy' : i.rpoMinutes + ' min'}. RTO od początku okna do skutecznej kontroli danych: ${i.rtoMinutes === null ? 'niepotwierdzone' : i.rtoMinutes + ' min'}. Ostatnia kopia: ${text(i.backupId)}. Źródło nadal może zapisywać: ${yes(i.sourceHasWrite)}. Brakujące zmiany z kopii: ${i.missingChanges}; odtworzone jawnie z ERP: ${i.reconstructed}; nadal do uzgodnienia: ${i.reconcile}.\n\nKopie i wykonane odtworzenia:\n\n${details(r.groundTruth.backups)}`
      : s.erpRecovery
        ? 'Kopie ERP i uzgodnienia opisano w sekcji Misji 04.'
        : 'Brak modelu integralności kopii w tej misji.',
    `Rzeczywiste wykorzystanie inwestycji:\n\n${details(s.investmentUse)}`,
    ...(s.detectionReview
      ? [
          '### Detection Engineering — wynik tego przebiegu',
          details(s.detectionReview),
          'Alert jest przesłanką do badania. Etykieta FP/FN jest dostępna dopiero po misji; nie stanowi oceny racjonalności decyzji. Następstwa i stany po decyzji opisano także w sekcjach 4 i 8.',
        ]
      : []),
    ...(s.branchAccess
      ? [
          '### Misja 05 — architektura, przepływy i ryzyko',
          details(s.branchAccess),
          'Sprawdzone możliwości nieaktywnej trasy są oceną bieżących predykatów, nie wykonanym przełączeniem ani wynikiem alternatywnej rozgrywki.',
        ]
      : []),
    ...(s.erpRecovery
      ? [
          '### Misja 04 — Service Recovery / Data Recovery / Business Continuity / Operational Confidence',
          details(s.erpRecovery),
          'Nieudany restart i starsza kopia są wynikami operacji; raport nie ocenia racjonalności decyzji ani nie tworzy alternatywnych wyników.',
        ]
      : []),
    ...(s.vendorAccess
      ? [
          '### Misja 03 — wyjątek CARGO-LINK i rzeczywiste operacje',
          details(s.vendorAccess),
        ]
      : []),
    '## 8. Skutki biznesowe',
    `Wpłynęło **${b.ordersReceived}**; obsłużono **${b.ordersProcessed}**; zaległe **${b.finalBacklog}**; szczyt kolejki **${b.peakBacklog}**. Nie przeliczamy zamówień na straty w PLN.`,
    '| Tura / przedział | Wydajność | Wpłynęło | Obsłużono | Zaległe |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...b.perTurn.map(
      (v) =>
        `| ${v.turn} / ${aarClock(r.scenario.startMinute + (v.turn - 1) * r.scenario.turnMinutes)}–${aarClock(r.scenario.startMinute + v.turn * r.scenario.turnMinutes)} | ${v.capacity} | ${v.received} | ${v.processed} | ${v.backlog} |`,
    ),
    'Zmiany przepustowości (rozliczany przedział używa konfiguracji sprzed efektów na jego końcu):',
    ...b.capacityTransitions.map(
      (v) =>
        `- ${aarClock(v.intervalStartMinute)}–${aarClock(v.at.minute)}: ${v.previousCapacity ?? 'początek'} → ${v.capacity} zamówień/turę.`,
    ),
    '## 9. Faktyczna przyczyna',
    text(r.groundTruth.explanation),
    'Rzeczywiste logowania (również prelude sprzed początku misji):',
    details(r.groundTruth.authentication),
    'Modelowane źródło VPN i posiadany materiał uwierzytelniający:',
    details(r.groundTruth.vpnThreat),
    'Rzeczywiste działania źródła VPN:',
    details(r.groundTruth.vpnAttackerActivity),
    'Rzeczywiste operacje lokalne:',
    details(r.groundTruth.localOperations),
    'Próby źródła modyfikacji lokalnych:',
    details(r.groundTruth.localThreatAttempts),
    '## 10. Pytania do analizy',
    ...r.lessonsContext.reasoningQuestions.map(
      (q, n) => `${n + 1}. ${text(q)}`,
    ),
    '## 11. Kontekst powtórki',
    details(r.lessonsContext.replay),
    '### Jednostki, pochodzenie i ograniczenia',
    text(r.fieldGuide.time),
    text(r.fieldGuide.units),
    text(r.provenance.ordering),
    ...Object.entries(r.provenance.sourceMap).map(
      ([key, value]) => `- ${text(key)}: ${text(value)}`,
    ),
    ...r.limitations.map((v) => `- ${text(v)}`),
  ];
  const md =
    lines
      .join('\n\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n') + '\n';
  if (new TextEncoder().encode(md).byteLength > MAX_AAR_BYTES)
    throw new Error('Raport Markdown przekracza limit 2 MiB.');
  return md;
}
