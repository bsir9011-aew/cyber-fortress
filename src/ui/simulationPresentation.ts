import { actionLabel } from '../content/taskLabels';
export { actionLabel } from '../content/taskLabels';
import type { CommandRejection, SimulationEvent } from '../domain/simulation';

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

export const backupTestLabels = {
  clean: 'sprawdzona zgodność',
  damaged: 'wykryto uszkodzenia',
  unavailable: 'źródło niedostępne',
};
