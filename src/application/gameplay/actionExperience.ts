import type { PlayerView } from '../selectPlayerView';
import type {
  SimulationState,
  TaskAction,
  CommandRejection,
} from '../../domain/simulation';
import {
  knownSessionIds,
  taskSpecs,
  taskRejection,
} from '../../simulation/tasks';
import { integrityTaskTurns } from '../../simulation/integrity';
import { recoveryTaskTurns } from '../../simulation/recovery';
import { actionLabel } from '../../content/taskLabels';
import { formatMinute } from '../../simulation/clock';
export const actionGroups = {
  investigate: 'INVESTIGATE · Zbadaj',
  contain: 'CONTAIN · Ogranicz',
  recover: 'RECOVER · Przywróć',
  infrastructure: 'INFRASTRUCTURE · Skonfiguruj',
} as const;
export type ActionGroup = keyof typeof actionGroups;
export function actionGroup(a: TaskAction): ActionGroup {
  if (/^(inspect|verify|examine|contact|confirm)-/.test(a.type))
    return 'investigate';
  if (
    /^(terminate|block|isolate|restrict|revoke|narrow)-/.test(a.type) ||
    (a.type === 'set-branch-account-restriction' && a.restricted)
  )
    return 'contain';
  if (
    /^(restore|restart|reconcile|reconnect|unblock|repair|switch|start-manual|close-manual)-/.test(
      a.type,
    )
  )
    return 'recover';
  return 'infrastructure';
}
export function actionAssets(a: TaskAction, v: PlayerView): readonly string[] {
  if (a.type.includes('branch'))
    return [
      'east-workstations',
      'east-gateway',
      'east-primary-link',
      'east-backup-gateway',
      ...(a.type.includes('smb') || a.type.includes('restriction')
        ? ['fs-01']
        : ['erp', 'erp-standby']),
    ];
  if (
    a.type.includes('erp') ||
    a.type.includes('manual') ||
    a.type === 'contact-warehouse-operations'
  )
    return [
      'erp',
      'erp-db',
      'erp-storage',
      'erp-backups',
      'erp-standby',
      'standby-storage',
    ];
  if (a.type.includes('vendor'))
    return ['cargo-link', 'carrier-api', 'vpn', 'fs-01'];
  if ('ruleId' in a) {
    const r = v.rules.find((r) => r.id === a.ruleId);
    return r ? [r.sourceAssetId, r.targetAssetId] : [];
  }
  if (/document|backup/.test(a.type)) return ['fs-01', 'erp'];
  if (/endpoint|edr/.test(a.type)) return ['workstations', 'fs-01'];
  return ['vpn', 'ad', ...(a.type === 'inspect-file-access' ? ['fs-01'] : [])];
}
/** The validator's exact code is retained. Explanations use player-owned fields only. */
export function actionReason(
  v: PlayerView,
  a: TaskAction,
  code: CommandRejection | null,
): string | null {
  if (!code) return null;
  const worker = taskSpecs[a.type].workerId,
    busy = v.tasks.find((t) => t.workerId === worker && t.status === 'running');
  if (code === 'worker-busy' && busy)
    return `${worker === 'administrator' ? 'Administrator' : 'Analityk'} jest zajęty do ${formatMinute(v.clock.startMinute + busy.dueTurn * v.clock.turnMinutes)}: ${actionLabel(busy.action)}.`;
  if (code === 'simulation-finished')
    return 'Misja zakończona. Dalsze działania są dostępne w nowej próbie.';
  if (code === 'outside-time-window')
    return 'Do końca dostępnego terminu zostało za mało czasu na tę operację.';
  if (code === 'wrong-worker')
    return `Zadanie wymaga ${worker === 'administrator' ? 'administratora' : 'analityka'}.`;
  if ('backupId' in a && !a.backupId)
    return `Najpierw sprawdź ${a.type.includes('erp') ? 'kopie ERP' : 'punkty odtworzenia FS-01'}, aby wskazać istniejącą kopię.`;
  if (code === 'target-not-observed')
    return a.type === 'repair-branch-link'
      ? 'Najpierw zbadaj połączenia oddziału, aby potwierdzić stan łącza.'
      : a.type === 'terminate-session'
        ? 'Nie zidentyfikowano jeszcze tej sesji. Pobierz logi lub migawkę VPN.'
        : 'Konto lub zasób nie zostały wskazane w pozyskanych dowodach. Zleć właściwe badanie.';
  if (code === 'source-unavailable') {
    if (a.type === 'inspect-edr-telemetry')
      return 'Kolektor EDR nie jest dostępny; odczyt dotyczy wyłącznie wdrożonego sensora.';
    if (a.type === 'inspect-file-access' && !v.fileSensor?.enabled)
      return 'Brak wdrożonego audytu FS-01. Można go przygotować w Centrali.';
    if (a.type === 'inspect-branch-gateway-logs' && !v.branch?.sensor.enabled)
      return 'Nie wdrożono monitoringu bramy EAST.';
    if ('backupId' in a)
      return 'Wybrana kopia była niedostępna w ostatnim badaniu. Sprawdź źródło i jego drogę.';
    return 'Źródło wymagane przez tę operację jest niedostępne. Przyczyna wymaga badania; sam ten komunikat jej nie rozstrzyga.';
  }
  if (code === 'invalid-state') {
    const erpChanges = [
      'restore-erp-backup',
      'switch-erp-standby',
      'restart-erp-service',
    ];
    const erpMutations = [...erpChanges, 'reconcile-erp-records'];
    const conflict = v.tasks.find(
      (t) =>
        t.status === 'running' &&
        ((erpMutations.includes(a.type) &&
          erpMutations.includes(t.action.type)) ||
          (a.type === 'reconcile-documents' &&
            t.action.type === 'restore-documents') ||
          (a.type === 'restore-documents' &&
            t.action.type === 'reconcile-documents' &&
            v.integrity?.backups.find((b) => b.id === a.backupId)
              ?.verification === 'clean') ||
          (v.finale &&
            ((erpChanges.includes(a.type) &&
              t.action.type === 'reconcile-documents') ||
              (a.type === 'reconcile-documents' &&
                erpChanges.includes(t.action.type))))),
    );
    if (conflict)
      return `Trwa operacja na danych: ${actionLabel(conflict.action)} (do ${formatMinute(v.clock.startMinute + conflict.dueTurn * v.clock.turnMinutes)}). Zakończ ją przed sprzeczną zmianą.`;
    if (
      [
        'revoke-vendor-exception',
        'narrow-vendor-exception',
        'expand-vendor-exception',
      ].includes(a.type)
    ) {
      const e = v.vendor?.exception;
      return !e
        ? 'Brak istniejącego zatwierdzenia.'
        : e.status !== 'active' || v.vendor?.expired
          ? 'Wyjątek wygasł lub został cofnięty.'
          : `Wybrany zakres jest już zastosowany (${e.scope}).`;
    }

    if (a.type === 'restore-documents')
      return 'Brak potwierdzonej czystej kopii. Najpierw zweryfikuj wybrany punkt odtworzenia.';
    if (a.type === 'activate-branch-route')
      return a.route === v.branch?.route
        ? 'Ta trasa jest już wybrana.'
        : 'Nie przygotowano zapasowej trasy HTTPS.';
    if (a.type === 'repair-branch-link')
      return 'Ostatnie badanie nie potwierdza awarii łącza. Ponów badanie po zmianie sytuacji.';
    if (a.type === 'restrict-endpoint-writes')
      return !v.integrity?.endpoint.isolated
        ? 'Najpierw odizoluj stację.'
        : v.integrity.endpoint.writesRestricted
          ? 'Zapis tej stacji jest już ograniczony.'
          : 'Najpierw pozyskaj lokalny dziennik stacji lub jej rekordy EDR.';
    if (a.type === 'reconnect-endpoint')
      return !v.integrity?.endpoint.isolated
        ? 'Stacja jest już podłączona.'
        : 'Najpierw ogranicz zapis izolowanej stacji.';
    if (a.type === 'isolate-endpoint') return 'Stacja jest już odizolowana.';
    if (a.type === 'block-account')
      return 'Nowe logowania tego konta są już zablokowane.';
    if (a.type === 'unblock-account')
      return 'To konto nie ma zablokowanych nowych logowań.';
    if (a.type === 'terminate-session')
      return 'Wskazana historyczna sesja nie jest już aktywna.';
    if (a.type === 'start-manual-shipping')
      return 'Obsługa ręczna jest już uruchomiona.';
    if (a.type === 'close-manual-shipping')
      return 'Obsługa ręczna nie jest uruchomiona.';
    if (a.type === 'approve-emergency-vendor-access')
      return 'Istnieje już aktywny wyjątek dostawcy. Użyj zmiany zakresu lub cofnięcia.';
    if (a.type === 'reconcile-erp-records')
      return v.recovery?.manualActive
        ? 'Najpierw zamknij obsługę ręczną.'
        : 'Uzgodnienie wymaga użytecznego ERP i braku sprzecznej operacji na danych.';
    if (a.type === 'reconcile-documents')
      return 'Potrzebny jest zakres dokumentów do uzgodnienia oraz brak równoległego restore lub sprzecznej zmiany ERP. Potwierdź stan badaniem.';
    if (
      a.type === 'set-branch-smb-scope' ||
      a.type === 'set-branch-account-restriction'
    )
      return 'Wybrana konfiguracja jest już zastosowana.';
    return 'Aktualny stan operacji nie spełnia warunków. Sprawdź trwające prace, bieżący zakres i termin dostępu.';
  }
  if (code === 'unknown-target')
    return 'Brak wskazanego zasobu lub zatwierdzenia obsługiwanego przez tę operację.';
  return 'Parametry nie spełniają warunków komendy.';
}
function actionRequirement(a: TaskAction, v: PlayerView): string {
  if (a.type === 'inspect-file-access')
    return 'Odczyt wyłącznie wdrożonego sensora FS-01, w retencji i po opóźnieniu; sieć może zatrzymać próbę przed serwerem.';
  if (a.type === 'inspect-edr-telemetry')
    return 'Dostępny kolektor i dostarczone rekordy objętego endpointu. Izolacja może przerwać nowe dostarczanie.';
  if (a.type === 'terminate-session')
    return 'Sesja wskazana w dowodach i nadal aktywna. Nie blokuje kolejnego uwierzytelnienia.';
  if (['block-account', 'unblock-account', 'reset-credential'].includes(a.type))
    return 'Istniejące konto znane ze sprawy. Dotyczy nowych logowań; nie kończy już wydanych tuneli ani nie zmienia MFA.';
  if (a.type === 'restore-documents')
    return 'Wybrany zinwentaryzowany, dostępny i zweryfikowany czysty punkt FS-01. Restore wymaga późniejszej kontroli dokumentów.';
  if (a.type === 'restore-erp-backup')
    return 'Wybrana zinwentaryzowana kopia oraz dostępne źródło, docelowy storage i baza. Sam restore nie potwierdza kompletności danych.';
  if (a.type === 'switch-erp-standby')
    return 'Dostępny niezależny standby i jego droga. Własny starszy stan danych może wymagać uzgodnienia i kontroli.';
  if (a.type === 'restart-erp-service')
    return 'Próba uruchomienia procesu aktywnej instancji. Nie naprawia storage ani nie odtwarza danych.';
  if (a.type === 'reconcile-erp-records')
    return 'Zamknięty tryb ręczny, użyteczne ERP i niezależny dziennik. Brak równoległej sprzecznej zmiany ERP.';
  if (a.type === 'inspect-documents' || a.type === 'reconcile-documents')
    return 'Dostępne FS-01 i właściwe źródło porównania ERP; w M06 kompletna aktywna baza przez lokalną drogę analityka.';
  if (a.type === 'activate-branch-route')
    return 'Przygotowany transport docelowej trasy. Wybranie drogi nie naprawia ERP ani nie nadaje praw do danych.';
  if (a.type === 'repair-branch-link')
    return 'Potwierdzona badaniem niedostępność łącza podstawowego. Naprawa nie wybiera automatycznie trasy.';
  if (a.type === 'approve-emergency-vendor-access')
    return 'Brak aktywnego wyjątku; zakres i termin 14:30/15:00/15:30, uzasadnienie 10–200 znaków. Zgoda nie omija MFA, ACL ani uprawnień.';
  if (a.type === 'set-network-rule') {
    const rule = v.rules.find((r) => r.id === a.ruleId);
    return `Zmiana wyłącznie ${a.ruleId}; protokół ${rule?.protocol ?? 'nieustalony'}, konta ${rule?.accountIds?.join(', ') ?? 'według ogólnej reguły'}. Nie zmienia innych reguł ani nadań zasobowych.`;
  }
  return actionGroup(a) === 'investigate'
    ? 'Dostępne źródło w jego zakresie i retencji; wynik po ukończeniu badania.'
    : 'Wskazany zasób, dozwolony stan i wolny wykonawca. Efekt po zakończeniu pracy; nie naprawia innych zależności.';
}
export function selectActionExperience(s: SimulationState, v: PlayerView) {
  const accounts = v.knownAccountIds.length ? v.knownAccountIds : [''];
  const sessions = knownSessionIds(s);
  const sessionIds = sessions.length ? sessions : [''];
  const actions: TaskAction[] = [
    { type: 'inspect-auth-logs' },
    { type: 'inspect-vpn-sessions' },
    ...(v.fileSensor ? [{ type: 'inspect-file-access' as const }] : []),
    ...(!v.integrity && !v.vendor && !v.recovery && !v.branch
      ? [{ type: 'contact-account-owner' as const, accountId: 'magazyn-07' }]
      : []),
    ...accounts.flatMap((accountId) =>
      (['block-account', 'unblock-account', 'reset-credential'] as const).map(
        (type) => ({ type, accountId }),
      ),
    ),
    ...sessionIds.map((sessionId) => ({
      type: 'terminate-session' as const,
      sessionId,
    })),
    { type: 'set-vpn', assetId: v.vpnAssetId, enabled: !v.vpnOnline },
    ...v.rules.map((r) => ({
      type: 'set-network-rule' as const,
      ruleId: r.id,
      action: r.action === 'allow' ? ('deny' as const) : ('allow' as const),
    })),
    ...(v.integrity?.actions.map((a) => a.action) ?? []),
    ...(v.recovery?.actions.map((a) => a.action) ?? []),
    ...(v.branch?.actions.map((a) => a.action) ?? []),
    ...(v.vendor?.actions.map((a) => a.action) ?? []),
    ...(v.integrity?.backups.length === 0
      ? [
          { type: 'restore-documents' as const, backupId: '' },
          { type: 'verify-backup' as const, backupId: '' },
        ]
      : []),
    ...(v.recovery?.backups.length === 0
      ? [
          { type: 'restore-erp-backup' as const, backupId: '' },
          { type: 'verify-erp-backup' as const, backupId: '' },
        ]
      : []),
    ...(v.finale?.emergencyActions.map((a) => ({
      type: 'approve-emergency-vendor-access' as const,
      scope: a.scope,
      expiresAtMinute: a.expiresAtMinute,
      justification: 'Awaryjne przewozy w oknie kryzysowym M06.',
    })) ?? []),
  ];
  return [...new Map(actions.map((a) => [JSON.stringify(a), a])).values()].map(
    (action, n) => {
      const workerId = taskSpecs[action.type].workerId,
        turns =
          recoveryTaskTurns(s, action) ??
          integrityTaskTurns(s, action) ??
          taskSpecs[action.type].turns;
      const rejection = v.finished
        ? ('simulation-finished' as const)
        : taskRejection(s, workerId, action);
      const assets = actionAssets(action, v);
      return {
        id: `action-${n}`,
        action,
        label: actionLabel(action),
        workerId,
        turns,
        rejection,
        reason: actionReason(v, action, rejection),
        group: actionGroup(action),
        assets,
        scope: assets
          .map((id) => v.world.assets.find((a) => a.id === id)?.name ?? id)
          .join(' · '),
        requirement: actionRequirement(action, v),
      };
    },
  );
}
export type DecisionAction = ReturnType<typeof selectActionExperience>[number];
