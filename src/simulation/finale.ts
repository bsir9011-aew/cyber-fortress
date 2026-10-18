import type {
  SimulationState,
  EmployeeTask,
  CommandRejection,
} from '../domain/simulation';
import type { FinaleTaskAction } from '../domain/finale';
import { selectFinaleTimeline } from './finaleTimeline';
import { currentMinute } from './clock';
export function initializeFinale(s: SimulationState): SimulationState {
  return s.hidden.scenario.finale
    ? {
        ...s,
        finale: {
          faultInjected: false,
          observations: [],
          hypothesis: 'insufficient-evidence',
          events: [],
          hypotheses: [],
          approvals: [],
        },
      }
    : s;
}
/** Fixed private fault schedule; defender configuration never selects or rewrites a variant. */
export function stepFinale(s: SimulationState): SimulationState {
  const d = s.hidden.scenario.finale,
    f = s.finale;
  if (
    d &&
    f &&
    s.clock.turn === 1 &&
    !s.incident.messages.some((m) => m.id === 'finale-operations-report')
  )
    s = {
      ...s,
      incident: {
        ...s.incident,
        messages: [
          ...s.incident.messages,
          {
            id: 'finale-operations-report',
            minute: currentMinute(s.clock),
            speaker: 'Ewa',
            source: 'briefing',
            referenceId: 'finale-operations-report',
            text: 'Operacje zgłaszają okresowo wolniejsze odpowiedzi usług i wzmożoną pracę z dokumentami. To zgłoszenie, nie diagnoza. Możesz zbadać ERP, przygotować manifesty ręczne lub zweryfikować dostęp. Łącza i dane wymagają odrębnej kontroli.',
          },
        ],
      },
    };
  if (!d || !f || f.faultInjected || s.clock.turn < d.faultTurn) return s;
  const minute = currentMinute(s.clock);
  let next = s;
  if (d.variant === 'crossfire')
    next = {
      ...next,
      recovery: {
        ...s.recovery!,
        primary: { ...s.recovery!.primary, processRunning: false },
        revision: s.recovery!.revision + 1,
        verifiedRevision: null,
      },
    };
  if (d.variant === 'cascade')
    next = {
      ...next,
      world: {
        ...next.world,
        assets: next.world.assets.map((a) =>
          a.id === 'erp-storage' ? { ...a, status: 'offline' } : a,
        ),
      },
      recovery: {
        ...s.recovery!,
        revision: s.recovery!.revision + 1,
        verifiedRevision: null,
      },
    };
  const events =
    d.variant === 'false-lead'
      ? []
      : [
          {
            minute,
            assetId: d.variant === 'crossfire' ? 'erp' : 'erp-storage',
            fact:
              d.variant === 'crossfire'
                ? 'Niezależne zatrzymanie procesu ERP.'
                : 'Awaria primary storage ERP; współdzielone repozytorium również niedostępne.',
          },
        ];
  return {
    ...next,
    finale: { ...f, faultInjected: true, events: [...f.events, ...events] },
  };
}
export function emergencyVendorRejection(
  s: SimulationState,
  a: FinaleTaskAction,
  completion = false,
): CommandRejection | null {
  if (!s.finale || !s.vendor || !s.access.vendorAuthorization)
    return 'invalid-state';
  if (
    !['api-only', 'api-and-files'].includes(a.scope) ||
    ![870, 900, 930].includes(a.expiresAtMinute) ||
    typeof a.justification !== 'string' ||
    a.justification.trim().length < 10 ||
    a.justification.length > 200
  )
    return 'invalid-command';
  const e = s.access.vendorAuthorization.exception;
  if (e?.status === 'active' && e.expiresAtMinute > currentMinute(s.clock))
    return 'invalid-state';
  return currentMinute(s.clock) + (completion ? 0 : 10) >= a.expiresAtMinute
    ? 'outside-time-window'
    : null;
}
export function applyFinaleTask(
  s: SimulationState,
  t: EmployeeTask,
): SimulationState {
  if (t.action.type !== 'approve-emergency-vendor-access' || !s.finale)
    return s;
  const a = t.action,
    minute = currentMinute(s.clock),
    failed = !!emergencyVendorRejection(s, a, true);
  if (failed)
    return {
      ...s,
      finale: {
        ...s.finale,
        approvals: [
          ...s.finale.approvals,
          {
            taskId: t.id,
            minute,
            justification: a.justification,
            outcome: 'failed',
          },
        ],
      },
    };
  const exception = {
    approvalId: `FIN-${t.id}`,
    scope: a.scope,
    validFromMinute: minute,
    expiresAtMinute: a.expiresAtMinute,
    status: 'active' as const,
  };
  return {
    ...s,
    access: {
      ...s.access,
      vendorAuthorization: { ...s.access.vendorAuthorization!, exception },
    },
    vendor: {
      ...s.vendor!,
      accessChanges: [
        ...s.vendor!.accessChanges,
        { minute, kind: 'activated', taskId: t.id, exception },
      ],
    },
    finale: {
      ...s.finale,
      approvals: [
        ...s.finale.approvals,
        {
          taskId: t.id,
          minute,
          justification: a.justification,
          outcome: 'activated',
        },
      ],
    },
  };
}

export function rememberFinaleObservations(
  s: SimulationState,
): SimulationState {
  return s.finale
    ? { ...s, finale: { ...s.finale, observations: selectFinaleTimeline(s) } }
    : s;
}
