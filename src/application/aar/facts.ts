import { branchOutcome } from '../selectBranchReport';
import {
  assessBranchAccess,
  branchWorkAvailability,
} from '../../simulation/branchAccess';
import { isBranchAction } from '../../simulation/branch';
import {
  assessErpAvailability,
  pendingErpOrderIds,
} from '../../simulation/recoveryAccess';
import { knownSessionIds } from '../../simulation/tasks';
import type { DecisionRecord } from '../../domain/incident';
import type {
  AarActualState,
  AarData,
  AarTime,
  KnownAtDecision,
  AarEvidence,
} from '../../domain/afterActionReport';
import type { SimulationState, TaskAction } from '../../domain/simulation';
import { selectPlayerView } from '../selectPlayerView';
import { assessThreatAccess } from '../../simulation/threatAssessment';
import { businessAvailability } from '../../simulation/business';
import { canUseLocalService, canUseService } from '../../simulation/access';
import { documentCounts } from '../../simulation/integrity';
import { currentMinute } from '../../simulation/clock';
export const facts = (value: unknown): AarData =>
  value === undefined ? null : (JSON.parse(JSON.stringify(value)) as AarData);
export function timeAt(
  state: SimulationState,
  minute = currentMinute(state.clock),
): AarTime {
  return {
    minute,
    turn:
      minute < state.clock.startMinute ||
      (minute - state.clock.startMinute) % state.clock.turnMinutes !== 0
        ? null
        : (minute - state.clock.startMinute) / state.clock.turnMinutes,
  };
}
export function actualState(state: SimulationState): AarActualState {
  const minute = currentMinute(state.clock),
    i = state.integrity,
    d = state.hidden.scenario.integrity;
  return {
    ...(state.recovery
      ? {
          erpRecovery: facts({
            ...assessErpAvailability(state),
            manualActive: state.recovery.manualActive,
            pendingOrderIds: pendingErpOrderIds(state),
            revision: state.recovery.revision,
            verifiedRevision: state.recovery.verifiedRevision,
          }),
        }
      : {}),
    ...(state.branch
      ? {
          branchAccess: facts({
            architecture: state.branch.architecture,
            activeRoute: state.branch.activeRoute,
            tunnel: state.branch.tunnel,
            contexts: state.branch.contexts,
            compromisedContextId:
              state.hidden.scenario.branch!.compromisedContextId,
            work: branchWorkAvailability(state),
            ...branchOutcome(state),
            serviceChecks: state.branch.contexts.flatMap((c) => [
              {
                contextId: c.id,
                target: 'erp',
                ...assessBranchAccess(state, c.id, 'erp', 'HTTPS'),
              },
              {
                contextId: c.id,
                target: 'fs-01',
                ...assessBranchAccess(state, c.id, 'fs-01', 'SMB'),
              },
            ]),
          }),
        }
      : {}),
    threatAccess: assessThreatAccess(state),
    ...(state.access.vendorAuthorization
      ? { vendorAuthorization: facts(state.access.vendorAuthorization) }
      : {}),
    accounts: state.access.accounts,
    sessions: state.access.sessions.map((s) => ({
      ...s,
      origin: state.hidden.sessionOrigins[s.id] ?? 'unclassified',
    })),
    serviceAccess: state.access.sessions.flatMap((s) =>
      [
        ...new Map(
          state.access.rules.map((r) => [
            `${r.targetAssetId}/${r.protocol}`,
            r,
          ]),
        ).values(),
      ].map((r) => ({
        sessionId: s.id,
        targetAssetId: r.targetAssetId,
        protocol: r.protocol,
        allowed: canUseService(
          state.world,
          state.access,
          s.id,
          r.targetAssetId,
          r.protocol,
          minute,
        ),
      })),
    ),
    exposedRecords: state.branch
      ? branchOutcome(state).exposedRecords
      : (state.hidden.attacker?.transfer.exposedRecords ?? 0),
    endpoint:
      i && d
        ? facts({
            ...i.endpoint,
            compromised: state.hidden.integrityThreat?.compromised ?? false,
            canRead: canUseLocalService(
              state.world,
              state.access,
              i.endpoint,
              d.datasetAssetId,
              'SMB',
              'read',
            ),
            canWrite: canUseLocalService(
              state.world,
              state.access,
              i.endpoint,
              d.datasetAssetId,
              'SMB',
              'modify',
            ),
          })
        : null,
    documents: i ? documentCounts(i.documents) : null,
    availability: businessAvailability(state),
  };
}
export function knownAtDecision(
  state: SimulationState,
  evidence: readonly AarEvidence[],
  ordinal: number,
): KnownAtDecision {
  const v = selectPlayerView(state);
  return {
    asOfCommand: ordinal,
    at: timeAt(state),
    evidenceIds: evidence.map((e) => e.id),
    alertIds: evidence.filter((e) => e.assertion === 'signal').map((e) => e.id),
    knownSessionIds: knownSessionIds(state),
    sessions: v.sessionObservation?.sessions ?? null,
    hypotheses: {
      vpn: v.hypothesis,
      integrity: v.integrity?.hypothesis ?? null,
    },
    configuration: {
      ...(v.branch ? { branchAccess: facts(v.branch) } : {}),
      ...(v.recovery ? { erpRecovery: facts(v.recovery) } : {}),
      assets: v.world.assets.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
      })),
      networkRules: v.rules,
      ...(v.vendor
        ? {
            vendorAuthorization: facts({
              accountId: v.vendor.accountId,
              exception: v.vendor.exception,
            }),
          }
        : {}),
      knownAccounts: v.knownAccountIds.map((id) => ({
        id,
        blocked: v.blockedKnownAccountIds.includes(id),
      })),
      sensors: facts({
        ...v.sensors,
        file: v.fileSensor ?? null,
        endpoint: v.integrity?.edr
          ? {
              coverage: v.integrity.edr.coverage,
              agentOnline: v.integrity.edr.agentOnline,
              deliveryAvailable: v.integrity.edr.deliveryAvailable,
            }
          : null,
      }),
      endpoint: facts(v.integrity?.endpoint),
      backupReadiness: facts(v.integrity?.backupReadiness),
    },
    business: v.business,
    pendingTasks: v.tasks.filter((t) => t.status === 'running'),
    sourceLimitations: [
      'Alert jest sygnałem do zbadania, nie identyfikacją sprawcy.',
      'Brak rekordu nie oznacza braku zdarzenia: obowiązują pokrycie, dostępność, opóźnienie i retencja źródła.',
      'Obserwacja jest migawką z czasu pobrania; nie aktualizuje się po kolejnych zmianach.',
      ...(v.integrity
        ? [
            'EDR czyta tylko dostarczone dane kolektora. Izolacja odcina nowe dostarczenia; fizyczny dziennik jest osobnym źródłem.',
          ]
        : []),
    ],
    unknowns: [
      ...(!v.sessionObservation ? ['Nie pobrano migawki sesji VPN.'] : []),
      ...(!v.authObservations.length
        ? ['Nie pozyskano logów uwierzytelnienia.']
        : []),
      ...(v.integrity && !v.integrity.observations.length
        ? ['Nie zbadano integralności dokumentów.']
        : []),
      ...(v.integrity &&
      !v.integrity.endpointObservations.length &&
      !v.integrity.edr?.observations.length
        ? ['Nie pozyskano dziennika lokalnego ani obserwacji EDR.']
        : []),
      'Tożsamość człowieka za kontem oraz prywatny plan zagrożenia nie są wiedzą gracza.',
    ],
  };
}
export function actionTarget(
  state: SimulationState,
  action:
    | TaskAction
    | {
        type: 'set-hypothesis' | 'set-integrity-hypothesis';
        hypothesis: string;
      },
) {
  if ('type' in action && isBranchAction(action as TaskAction))
    return {
      kind: 'branch-architecture',
      id:
        'accountId' in action
          ? action.accountId
          : 'route' in action
            ? String(action.route)
            : 'scope' in action
              ? String(action.scope)
              : null,
      resourceIds: [
        'east-workstations',
        'east-gateway',
        'east-primary-link',
        'east-backup-gateway',
        'erp',
        'fs-01',
      ],
      flow: facts(state.branch?.architecture),
    };
  if ('approvalId' in action)
    return {
      kind: 'vendor-exception',
      id: action.approvalId,
      resourceIds: ['vpn', 'carrier-api', 'fs-01'],
      flow: facts(state.access.vendorAuthorization),
    };
  if ('ruleId' in action) {
    const r = state.access.rules.find((r) => r.id === action.ruleId);
    return {
      kind: 'network-rule',
      id: action.ruleId,
      resourceIds: r ? [r.sourceAssetId, r.targetAssetId] : [],
      flow: facts(r),
    };
  }
  if ('accountId' in action)
    return {
      kind: 'account',
      id: action.accountId,
      resourceIds: [state.access.identityAssetId, state.access.vpnAssetId],
      flow: null,
    };
  if ('sessionId' in action)
    return {
      kind: 'session',
      id: action.sessionId,
      resourceIds: [state.access.vpnAssetId],
      flow: null,
    };
  if ('endpointId' in action)
    return {
      kind: 'endpoint',
      id: action.endpointId,
      resourceIds: [state.integrity?.endpoint.assetId ?? 'workstations'],
      flow: null,
    };
  if ('backupId' in action)
    return {
      kind: 'backup',
      id: action.backupId,
      resourceIds: state.recovery
        ? ['erp', 'erp-backups', 'erp-storage']
        : [state.hidden.scenario.integrity?.datasetAssetId ?? 'fs-01'],
      flow: null,
    };
  if ('assetId' in action)
    return {
      kind: 'asset',
      id: action.assetId,
      resourceIds: [action.assetId],
      flow: null,
    };
  return {
    kind: action.type.includes('hypothesis') ? 'hypothesis' : 'observation',
    id: null,
    resourceIds: [],
    flow: null,
  };
}

export function immediateImpact(
  impact: DecisionRecord['impact'] | undefined,
): AarData {
  if (!impact) return null;
  return facts({
    threatAccessBefore: impact.before,
    threatAccessAfter: impact.after,
    totalCapacityBefore: impact.remoteCapacityBefore,
    totalCapacityAfter: impact.remoteCapacityAfter,
    exposedRecordsAtCompletion: impact.exposedRecordsAtCompletion,
    changedCapabilities: impact.changedCapabilities,
  });
}
