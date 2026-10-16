import type { AccessState } from '../domain/access';
import type {
  AttackDefinition,
  AttackOutcome,
  AttackerState,
  PlannedAttackAction,
} from '../domain/attack';
import type {
  ReferenceSimulationState,
  SimulationState,
} from '../domain/simulation';
import {
  canUseService,
  isAssetOnline,
  isSessionActive,
  issueVpnSession,
} from './access';
import { currentMinute } from './clock';
import { recordAuthentication } from './telemetry';

export function createInitialAttacker(
  definition: AttackDefinition,
): AttackerState {
  const positiveIntegers = [
    definition.recordLimit,
    definition.firstReconnaissanceTurn,
    definition.retryDelayTurns,
    definition.maxConsecutiveFailures,
    definition.stolenCredentialVersion,
    ...definition.chunkSizes,
    ...(definition.firstAuthenticationTurn === undefined
      ? []
      : [definition.firstAuthenticationTurn]),
  ];
  if (
    positiveIntegers.some(
      (value) => !Number.isSafeInteger(value) || value < 1,
    ) ||
    (definition.initialSessionId === null &&
      definition.firstAuthenticationTurn === undefined) ||
    definition.chunkSizes.length === 0 ||
    definition.chunkSizes.reduce((sum, size) => sum + size, 0) <
      definition.recordLimit
  ) {
    throw new Error(
      'Invalid attack definition: positive integer limits, delays and sufficient chunks are required.',
    );
  }
  return {
    definition: { ...definition, chunkSizes: [...definition.chunkSizes] },
    status: 'active',
    currentSessionId: definition.initialSessionId,
    knowledge: {
      reconnaissanceConfirmed: false,
      lastAccess: null,
      lastAuthentication: null,
    },
    transfer: { started: false, nextChunkIndex: 0, exposedRecords: 0 },
    consecutiveFailures: 0,
    authenticationAttempts: 0,
    nextAction: {
      kind:
        definition.initialSessionId === null
          ? 'authenticate'
          : 'reconnaissance',
      dueTurn:
        definition.initialSessionId === null
          ? definition.firstAuthenticationTurn!
          : definition.firstReconnaissanceTurn,
    },
    privateHistory: [],
  };
}

/** Planer widzi wyłącznie własny stan i czas, nigdy WorldState/access. */
export function selectAttackerAction(
  attacker: AttackerState,
  turn: number,
): PlannedAttackAction | null {
  if (
    attacker.status !== 'active' ||
    !attacker.nextAction ||
    attacker.nextAction.dueTurn > turn ||
    (attacker.privateHistory.at(-1)?.turn ?? -1) >= turn
  )
    return null;
  return attacker.nextAction;
}

function recordAttempt(
  state: SimulationState,
  attacker: AttackerState,
  action: PlannedAttackAction,
  outcome: AttackOutcome,
  copiedRecords = 0,
): SimulationState {
  return {
    ...state,
    hidden: {
      ...state.hidden,
      attacker: {
        ...attacker,
        privateHistory: [
          ...attacker.privateHistory,
          {
            id: `A-${String(attacker.privateHistory.length + 1).padStart(4, '0')}`,
            turn: state.clock.turn,
            minute: currentMinute(state.clock),
            action: action.kind,
            outcome,
            sessionId:
              outcome === 'session-lost'
                ? (state.hidden.attacker?.currentSessionId ?? null)
                : attacker.currentSessionId,
            copiedRecords,
            totalExposedRecords: attacker.transfer.exposedRecords,
          },
        ],
      },
    },
  };
}

function failAttempt(
  attacker: AttackerState,
  turn: number,
  kind: PlannedAttackAction['kind'],
): AttackerState {
  const consecutiveFailures = attacker.consecutiveFailures + 1;
  const blocked =
    consecutiveFailures >= attacker.definition.maxConsecutiveFailures;
  return {
    ...attacker,
    consecutiveFailures,
    status: blocked ? 'blocked' : 'active',
    nextAction: blocked
      ? null
      : { kind, dueTurn: turn + attacker.definition.retryDelayTurns },
  };
}

/** Przydział ID należy do resolvera usługi, nie do wiedzy planera. */
function allocateSessionId(access: AccessState): string {
  const usedIds = new Set(access.sessions.map((session) => session.id));
  let number = 20;
  while (usedIds.has(`S-${number}`)) number += 1;
  return `S-${number}`;
}

function resolveAuthentication(
  state: SimulationState,
  action: PlannedAttackAction,
): SimulationState {
  const attacker = state.hidden.attacker;
  if (!attacker) return state;
  const definition = attacker.definition;
  const attempted = {
    ...attacker,
    authenticationAttempts: attacker.authenticationAttempts + 1,
  };
  // Znajomość jednej bramy nie daje automatycznie dostępu do innego wystawcy.
  const result =
    definition.knownGatewayAssetId === state.access.vpnAssetId
      ? issueVpnSession(
          state.world,
          state.access,
          {
            sessionId: allocateSessionId(state.access),
            accountId: definition.accountId,
            credentialVersion: definition.stolenCredentialVersion,
          },
          currentMinute(state.clock),
        )
      : null;
  const observed = result
    ? recordAuthentication(state, definition.accountId, result)
    : state;
  if (!result?.ok) {
    const failed = failAttempt(
      {
        ...attempted,
        knowledge: { ...attacker.knowledge, lastAuthentication: 'rejected' },
      },
      state.clock.turn,
      'authenticate',
    );
    return recordAttempt(observed, failed, action, 'authentication-rejected');
  }
  const nextKind = !attacker.knowledge.reconnaissanceConfirmed
    ? 'reconnaissance'
    : attacker.transfer.started
      ? 'transfer'
      : 'start-transfer';
  const next: SimulationState = {
    ...observed,
    access: result.access,
    hidden: {
      ...state.hidden,
      sessionOrigins: {
        ...state.hidden.sessionOrigins,
        [result.session.id]: 'unauthorized',
      },
    },
  };
  return recordAttempt(
    next,
    {
      ...attempted,
      currentSessionId: result.session.id,
      consecutiveFailures: 0,
      knowledge: { ...attacker.knowledge, lastAuthentication: 'accepted' },
      nextAction: { kind: nextKind, dueTurn: state.clock.turn + 1 },
    },
    action,
    'authentication-accepted',
  );
}

/** Jedna próba na granicy tury. Wyniki pozostają poza publicznym history. */
export function stepAttacker(
  state: ReferenceSimulationState,
): ReferenceSimulationState;
export function stepAttacker(state: SimulationState): SimulationState;
export function stepAttacker(state: SimulationState): SimulationState {
  const attacker = state.hidden.attacker;
  if (!attacker) return state;
  const action = selectAttackerAction(attacker, state.clock.turn);
  if (!action) return state;
  if (action.kind === 'authenticate')
    return resolveAuthentication(state, action);

  const definition = attacker.definition;
  const session = state.access.sessions.find(
    (item) => item.id === attacker.currentSessionId,
  );
  const hasTunnel =
    session &&
    session.accountId === definition.accountId &&
    session.gatewayAssetId === definition.knownGatewayAssetId &&
    isSessionActive(session, currentMinute(state.clock)) &&
    isAssetOnline(state.world, session.gatewayAssetId);
  if (!hasTunnel) {
    const failed = failAttempt(
      { ...attacker, currentSessionId: null },
      state.clock.turn,
      'authenticate',
    );
    return recordAttempt(state, failed, action, 'session-lost');
  }
  // Każda próba, także każda porcja transferu, sprawdza ten sam mechanizm dostępu.
  const allowed = canUseService(
    state.world,
    state.access,
    session.id,
    definition.targetAssetId,
    definition.protocol,
    currentMinute(state.clock),
  );
  const observed = {
    ...attacker,
    knowledge: {
      ...attacker.knowledge,
      lastAccess: { turn: state.clock.turn, allowed },
    },
  };
  if (!allowed)
    return recordAttempt(
      state,
      failAttempt(observed, state.clock.turn, action.kind),
      action,
      'access-denied',
    );

  const successful = { ...observed, consecutiveFailures: 0 };
  if (action.kind === 'reconnaissance')
    return recordAttempt(
      state,
      {
        ...successful,
        knowledge: { ...successful.knowledge, reconnaissanceConfirmed: true },
        nextAction: { kind: 'start-transfer', dueTurn: state.clock.turn + 1 },
      },
      action,
      'reconnaissance-confirmed',
    );
  if (action.kind === 'start-transfer')
    return recordAttempt(
      state,
      {
        ...successful,
        transfer: { ...attacker.transfer, started: true },
        nextAction: { kind: 'transfer', dueTurn: state.clock.turn + 1 },
      },
      action,
      'transfer-started',
    );

  const remaining = definition.recordLimit - attacker.transfer.exposedRecords;
  const copiedRecords = Math.min(
    remaining,
    definition.chunkSizes[attacker.transfer.nextChunkIndex] ?? 0,
  );
  const exposedRecords = attacker.transfer.exposedRecords + copiedRecords;
  const completed = exposedRecords >= definition.recordLimit;
  return recordAttempt(
    state,
    {
      ...successful,
      status: completed ? 'completed' : 'active',
      transfer: {
        ...attacker.transfer,
        nextChunkIndex: attacker.transfer.nextChunkIndex + 1,
        exposedRecords,
      },
      nextAction: completed
        ? null
        : { kind: 'transfer', dueTurn: state.clock.turn + 1 },
    },
    action,
    'records-copied',
    copiedRecords,
  );
}
