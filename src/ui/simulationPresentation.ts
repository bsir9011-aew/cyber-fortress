import type {
  CommandRejection,
  SimulationEvent,
  TaskAction,
} from '../domain/simulation';

export function actionLabel(action: TaskAction): string {
  switch (action.type) {
    case 'inspect-vpn-sessions':
      return 'Sprawdzenie aktywnych sesji VPN';
    case 'inspect-file-access':
      return 'Pobranie audytu FS-01';
    case 'inspect-auth-logs':
      return 'Pobranie logów uwierzytelnienia';
    case 'contact-account-owner':
      return `Rozmowa z właścicielką konta ${action.accountId}`;
    case 'terminate-session':
      return `Zakończenie sesji ${action.sessionId}`;
    case 'block-account':
      return `Blokada nowych logowań: ${action.accountId}`;
    case 'reset-credential':
      return `Reset poświadczenia: ${action.accountId}`;
    case 'set-vpn':
      return action.enabled ? 'Włączenie VPN' : 'Wyłączenie VPN';
    case 'set-network-rule':
      return `${action.action === 'allow' ? 'Dopuszczenie' : 'Blokada'} przepływu: ${action.ruleId}`;
  }
}

const rejectionLabels: Record<CommandRejection, string> = {
  'simulation-finished':
    'Okno operacyjne zakończone. Można zresetować scenariusz.',
  'worker-busy': 'Wykonawca jest zajęty. Poczekaj na zakończenie zadania.',
  'wrong-worker': 'To zadanie wymaga innego wykonawcy.',
  'unknown-target': 'Nieprawidłowy cel działania.',
  'target-not-observed':
    'Najpierw pozyskaj obserwację wskazującą konto lub sesję.',
  'invalid-state': 'Cel nie wymaga już tej zmiany.',
  'source-unavailable':
    'Źródło danych jest niedostępne lub nie zostało zdefiniowane.',
  'outside-time-window': 'Zadanie nie zakończy się przed 15:30.',
  'invalid-command': 'Nieprawidłowa komenda.',
};

export function eventLabel(event: SimulationEvent): string {
  switch (event.kind) {
    case 'command-rejected':
      return `Odrzucono: ${rejectionLabels[event.reason]}`;
    case 'task-started':
      return `Zlecono: ${actionLabel(event.task.action)}.`;
    case 'task-completed':
      return `Ukończono: ${actionLabel(event.task.action)}.`;
    case 'configuration-changed':
      return `Potwierdzono zmianę: ${actionLabel(event.task.action)}.`;
    case 'business-report':
      return `Zamówienia: +${event.report.received}, obsłużono ${event.report.processed}, zaległe ${event.report.backlog}. Wydajność w tym przedziale: ${event.report.capacity}.`;
    case 'sessions-observed':
      return `Analityk odczytał listę aktywnych sesji VPN: ${event.count}.`;
    case 'file-access-observed':
      return `Analityk pobrał audyt FS-01: ${event.count} zdarzeń.`;
    case 'auth-logs-observed':
      return `Analityk pobrał logi uwierzytelnienia: ${event.count} zdarzeń.`;
    case 'owner-contacted':
      return `Zakończono rozmowę z właścicielką konta ${event.accountId}. Relacja jest dostępna w sprawie.`;
    case 'research-unavailable':
      return 'Badanie zakończone bez nowej obserwacji: sensor lub brama VPN są niedostępne.';
    case 'simulation-finished':
      return event.success
        ? '15:30 — cel operacyjny osiągnięty.'
        : '15:30 — przekroczono dopuszczalną kolejkę zamówień.';
  }
}
