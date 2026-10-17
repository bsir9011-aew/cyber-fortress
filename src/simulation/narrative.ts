import type { SimulationState } from '../domain/simulation';
import type { NarrativeMessage } from '../domain/incident';
import { businessAvailability } from './business';
import { currentMinute } from './clock';

/** Typ wejścia wyklucza hidden, access i surową telemetrię. */
type NarrativeFacts = Pick<
  SimulationState,
  'clock' | 'tasks' | 'knowledge' | 'history' | 'incident' | 'business'
> & {
  readonly remoteAvailable: boolean;
};

export function deriveNarrative(
  facts: NarrativeFacts,
): readonly NarrativeMessage[] {
  const messages = [...facts.incident.messages];
  const add = (
    message: Omit<NarrativeMessage, 'minute'>,
    minute = currentMinute(facts.clock),
  ) => {
    if (!messages.some((item) => item.id === message.id))
      messages.push({ ...message, minute });
  };
  for (const event of facts.history) {
    if (event.kind !== 'task-completed') continue;
    const { task } = event;
    const action = task.action;
    let text: string | null = null;
    if (action.type === 'terminate-session')
      text = `Zakończyłem tunel ${action.sessionId}. To nie zmienia zasad nowych logowań.`;
    if (action.type === 'block-account')
      text = `Nowe logowania konta ${action.accountId} są zablokowane. Istniejące tunele wymagają osobnej decyzji.`;
    if (action.type === 'reset-credential')
      text = `Zmieniono poświadczenie konta ${action.accountId}. Wcześniej wydane sesje zachowują ważność.`;
    if (action.type === 'set-vpn')
      text = action.enabled
        ? 'Brama VPN jest ponownie dostępna. Zakończone tunele nie zostały przywrócone.'
        : 'Wyłączyłem VPN i zakończyłem aktywne tunele. Zdalni dyspozytorzy utracili dostęp.';
    if (action.type === 'set-network-rule')
      text = `Reguła ${action.ruleId} ma teraz decyzję ${action.action.toUpperCase()}. Potwierdzam zmianę konfiguracji, nie wynik incydentu.`;
    if (text)
      add(
        {
          id: `msg-${task.id}`,
          speaker: 'Bartek',
          text,
          source: 'configuration',
          referenceId: task.id,
        },
        event.minute,
      );
    if (
      action.type === 'set-network-rule' &&
      action.ruleId === 'R-SMB' &&
      action.action === 'deny'
    ) {
      const business = facts.history.find(
        (item) => item.kind === 'business-report' && item.minute > event.minute,
      );
      if (
        business?.kind === 'business-report' &&
        business.report.remoteAvailable
      )
        add(
          {
            id: `erp-${task.id}`,
            speaker: 'Ewa',
            text: business.report.contributions?.some((item) => !item.available)
              ? `Po zmianie SMB zdalna obsługa ERP nadal działa, ale część pracy zależna od FS-01 jest niedostępna. Wydajność wynosi ${business.report.capacity} zamówień na turę.`
              : 'Po zmianie SMB zdalna obsługa ERP nadal działa. Wysyłki są realizowane.',
            source: 'business',
            referenceId: business.id,
          },
          business.minute,
        );
    }
  }
  for (const observation of facts.knowledge.authObservations)
    add(
      {
        id: `msg-${observation.id}`,
        speaker: 'Analityk',
        text: `Pobrałem ${observation.records.length} zdarzeń uwierzytelnienia. To zapis logowań, bez audytu plików. Sprawdź źródło i czas obserwacji.`,
        source: 'task',
        referenceId: observation.id,
      },
      observation.observedAtMinute,
    );
  for (const observation of facts.knowledge.fileObservations ?? [])
    add(
      {
        id: `file-${observation.id}`,
        speaker: 'Analityk',
        text: `Pozyskałem ${observation.records.length} zdarzeń z audytu FS-01. Zakres wynika z pokrycia i opóźnienia sensora, bez klasyfikacji sprawcy.`,
        source: 'task',
        referenceId: observation.id,
      },
      observation.observedAtMinute,
    );
  const session = facts.knowledge.sessionObservation;
  if (session)
    add(
      {
        id: `sessions-${session.observedAtMinute}`,
        speaker: 'Analityk',
        text: `Odczytałem ${session.sessions.length} aktywnych sesji. Lista opisuje chwilę badania; nie określa, kto faktycznie używa konta.`,
        source: 'task',
        referenceId: `sessions-${session.observedAtMinute}`,
      },
      session.observedAtMinute,
    );
  for (const statement of facts.knowledge.ownerStatements)
    add(
      {
        id: `msg-${statement.id}`,
        speaker: 'Marta',
        text: statement.text,
        source: 'human-statement',
        referenceId: statement.id,
      },
      statement.observedAtMinute,
    );
  if (facts.business.backlog > 0 && !facts.remoteAvailable)
    add({
      id: 'ewa-queue',
      speaker: 'Ewa',
      text: 'Zdalni dyspozytorzy nie mogą pracować w ERP. Kolejka rośnie. Potrzebujemy planu przywrócenia dostępu.',
      source: 'business',
      referenceId:
        [...facts.history]
          .reverse()
          .find((event) => event.kind === 'business-report')?.id ?? 'business',
    });
  if (
    facts.business.lastReport?.remoteAvailable &&
    facts.business.lastReport.contributions?.some((item) => !item.available)
  )
    add({
      id: 'ewa-files',
      speaker: 'Ewa',
      text: `ERP jest dostępny, ale nie możemy ukończyć części obsługi zależnej od dokumentów FS-01. Ostatni przedział miał wydajność ${facts.business.lastReport.capacity}. Sprawdź legalną sesję, usługę, regułę i uprawnienie.`,
      source: 'business',
      referenceId: 'business-file-dependency',
    });
  if (facts.business.backlog > 40)
    add({
      id: 'ewa-limit',
      speaker: 'Ewa',
      text: 'Kolejka przekroczyła 40 zamówień. Liczy się stan o 15:30; jeśli przywrócimy wydajność, część zaległości możemy jeszcze nadrobić.',
      source: 'business',
      referenceId: 'backlog-threshold',
    });
  if (
    facts.remoteAvailable &&
    messages.some((message) => message.id === 'ewa-queue')
  )
    add({
      id: 'ewa-restored',
      speaker: 'Ewa',
      text: 'Zdalna obsługa ERP wróciła. Zespół może stopniowo nadrabiać kolejkę.',
      source: 'business',
      referenceId: 'remote-restored',
    });
  return messages;
}

export function updateNarrative(state: SimulationState): SimulationState {
  const messages = deriveNarrative({
    clock: state.clock,
    tasks: state.tasks,
    knowledge: state.knowledge,
    history: state.history,
    incident: state.incident,
    business: state.business,
    remoteAvailable: businessAvailability(state).remoteAvailable,
  });
  return { ...state, incident: { ...state.incident, messages } };
}
