import type { RunIdentity, ScenarioDefinition } from '../domain/scenario';
import type { SimulationState } from '../domain/simulation';
import { createInitialAttacker } from '../simulation/attacker';
import { issueVpnSession } from '../simulation/access';
import { recordAuthentication, updateTelemetry } from '../simulation/telemetry';
import {
  initializeIntegrity,
  validateIntegrityDefinition,
} from '../simulation/integrity';

/** Sprawdzenie treści przed uruchomieniem, bez naprawiania błędnych referencji. */
export function validateScenario(
  definition: ScenarioDefinition,
): readonly string[] {
  const errors: string[] = [];
  const check = (valid: boolean, message: string) => {
    if (!valid) errors.push(message);
  };
  const unique = (values: readonly string[], name: string) => {
    check(
      values.every((id) => id.trim().length > 0) &&
        new Set(values).size === values.length,
      `Duplicate or empty ${name}`,
    );
  };
  const { world, access, process, telemetry, clock } = definition;
  const asset = (id: string) => world.assets.find((item) => item.id === id);
  const account = (id: string) =>
    access.accounts.find((item) => item.id === id);
  const service = (id: string, protocol: string) =>
    asset(id)?.protocols.includes(protocol) === true;
  const integer = (value: number, minimum = 0) =>
    Number.isSafeInteger(value) && value >= minimum;
  unique(
    world.assets.map((item) => item.id),
    'asset',
  );
  unique(
    world.zones.map((item) => item.id),
    'zone',
  );
  unique(
    world.teams.map((item) => item.id),
    'team',
  );
  unique(
    world.connections.map((item) => item.id),
    'connection',
  );
  unique(
    access.identities.map((item) => item.id),
    'identity',
  );
  unique(
    access.accounts.map((item) => item.id),
    'account',
  );
  unique(
    access.sessions.map((item) => item.id),
    'session',
  );
  unique(
    access.rules.map((item) => item.id),
    'rule',
  );
  unique(
    telemetry.sourceEvents.map((item) => item.id),
    'source event',
  );
  unique(
    definition.legitimateBehaviors.map((item) => item.id),
    'legitimate actor',
  );
  unique(
    definition.legitimateBehaviors.map((item) => item.accountId),
    'legitimate account',
  );
  unique(
    definition.witnesses.map((item) => item.accountId),
    'witness',
  );
  unique(
    (process.additionalWork ?? []).map((item) => item.id),
    'work contribution',
  );
  check(definition.id.trim().length > 0, 'Missing scenario id');
  check(
    integer(clock.startMinute) &&
      integer(clock.turnMinutes, 1) &&
      integer(clock.turnLimit, 1),
    'Invalid clock',
  );
  check(
    Boolean(asset(access.vpnAssetId)) && Boolean(asset(access.identityAssetId)),
    'Unknown authentication service',
  );
  check(integer(access.sessionLifetimeMinutes, 1), 'Invalid session lifetime');
  for (const item of world.assets)
    check(
      world.zones.some((zone) => zone.id === item.zoneId) &&
        world.teams.some((team) => team.id === item.ownerTeamId),
      `Unknown zone or team: ${item.id}`,
    );
  for (const item of world.connections)
    check(
      Boolean(asset(item.sourceAssetId)) && Boolean(asset(item.targetAssetId)),
      `Unknown connection endpoint: ${item.id}`,
    );
  for (const item of access.accounts)
    check(
      access.identities.some((identity) => identity.id === item.identityId) &&
        integer(item.credentialVersion, 1) &&
        (item.secondFactorVersion === undefined ||
          integer(item.secondFactorVersion, 1)),
      `Invalid account: ${item.id}`,
    );
  for (const item of access.sessions) {
    check(
      Boolean(account(item.accountId)) &&
        item.gatewayAssetId === access.vpnAssetId,
      `Unknown session account or gateway: ${item.id}`,
    );
    check(
      integer(item.startedAtMinute) &&
        item.startedAtMinute <= clock.startMinute &&
        item.expiresAtMinute > item.startedAtMinute,
      `Invalid session time: ${item.id}`,
    );
    check(
      Boolean(definition.initialSessionOrigins[item.id]),
      `Missing session origin: ${item.id}`,
    );
  }
  for (const id of Object.keys(definition.initialSessionOrigins))
    check(
      access.sessions.some((item) => item.id === id),
      `Unknown origin session: ${id}`,
    );
  for (const item of access.rules)
    check(
      Boolean(asset(item.sourceAssetId)) &&
        service(item.targetAssetId, item.protocol) &&
        Number.isSafeInteger(item.priority) &&
        ['allow', 'deny'].includes(item.action) &&
        (item.accountIds === undefined ||
          (new Set(item.accountIds).size === item.accountIds.length &&
            item.accountIds.every((id) => Boolean(account(id))))),
      `Invalid network rule: ${item.id}`,
    );
  for (const item of access.permissions)
    check(
      Boolean(account(item.accountId)) &&
        service(item.targetAssetId, item.protocol),
      `Invalid permission: ${item.accountId}/${item.targetAssetId}`,
    );
  check(
    Boolean(asset(process.workstationAssetId)) &&
      service(process.erpAssetId, process.protocol) &&
      Boolean(account(process.remoteAccountId)),
    'Invalid business references',
  );
  check(
    [
      process.ordersPerTurn,
      process.localCapacity,
      process.remoteCapacity,
      process.maxFinalBacklog,
    ].every((value) => integer(value)),
    'Invalid business capacity',
  );
  const requiredAccounts = [process.remoteAccountId];
  for (const work of process.additionalWork ?? []) {
    check(
      Boolean(account(work.accountId)) &&
        integer(work.capacity, 1) &&
        work.services.length > 0 &&
        work.services.every((item) =>
          service(item.targetAssetId, item.protocol),
        ),
      `Invalid business dependency: ${work.id}`,
    );
    requiredAccounts.push(work.accountId);
  }
  for (const behavior of definition.legitimateBehaviors)
    check(
      Boolean(account(behavior.accountId)) &&
        integer(behavior.credentialVersion, 1) &&
        integer(behavior.reconnectDelayTurns) &&
        behavior.sessionIdPrefix.length > 0,
      `Invalid legitimate actor: ${behavior.id}`,
    );
  for (const id of requiredAccounts)
    check(
      definition.legitimateBehaviors.some((actor) => actor.accountId === id),
      `Missing legal behavior: ${id}`,
    );
  let previousMinute = -1;
  for (const attempt of definition.authenticationPrelude) {
    check(
      definition.legitimateBehaviors.some(
        (actor) => actor.id === attempt.actorId,
      ),
      `Unknown prelude actor: ${attempt.actorId}`,
    );
    check(
      integer(attempt.minute) &&
        attempt.minute >= previousMinute &&
        attempt.minute <= clock.startMinute &&
        integer(attempt.credentialVersion) &&
        attempt.requestedSessionId.trim().length > 0,
      'Invalid prelude attempt',
    );
    previousMinute = attempt.minute;
  }
  for (const event of telemetry.sourceEvents) {
    check(
      Boolean(account(event.accountId)) &&
        event.sourceAssetId === access.vpnAssetId &&
        integer(event.minute) &&
        event.minute <= clock.startMinute,
      `Invalid authentication source: ${event.id}`,
    );
    const session = access.sessions.find((item) => item.id === event.sessionId);
    check(
      event.outcome === 'failure'
        ? event.sessionId === null
        : Boolean(
            session &&
              session.accountId === event.accountId &&
              session.startedAtMinute === event.minute,
          ),
      `Inconsistent authentication session: ${event.id}`,
    );
  }
  const sensor = telemetry.authenticationSensor;
  check(
    sensor.sourceAssetId === access.vpnAssetId &&
      telemetry.sessionSensor.sourceAssetId === access.vpnAssetId &&
      integer(sensor.retentionMinutes, 1) &&
      integer(sensor.delayMinutes) &&
      integer(sensor.coverageFromMinute) &&
      sensor.coverageFromMinute <= clock.startMinute,
    'Invalid sensor scope',
  );
  check(
    telemetry.processedSourceCount === 0 &&
      telemetry.authenticationRecords.length === 0,
    'Scenario contains runtime telemetry',
  );
  for (const witness of definition.witnesses)
    check(
      Boolean(account(witness.accountId)) &&
        integer(witness.referencedMinute) &&
        witness.referencedMinute <= clock.startMinute &&
        witness.text.length > 0,
      'Invalid witness',
    );
  const goals = definition.goals;
  check(
    integer(goals.recordPool, 1) &&
      integer(goals.maxExposedRecords) &&
      goals.maxExposedRecords <= goals.recordPool &&
      goals.maxFinalBacklog === process.maxFinalBacklog,
    'Invalid mission goals',
  );
  check(
    goals.requireThreatContainment ===
      (definition.attacker !== null || definition.integrity !== undefined),
    'Containment goal disagrees with threat presence',
  );
  if (definition.attacker) {
    const attack = definition.attacker;
    check(
      Boolean(account(attack.accountId)) &&
        attack.knownGatewayAssetId === access.vpnAssetId &&
        service(attack.targetAssetId, attack.protocol),
      'Invalid attacker references',
    );
    check(
      attack.recordLimit === goals.recordPool,
      'Attack and goal limit disagree',
    );
    if (attack.initialSessionId !== null)
      check(
        access.sessions.some(
          (session) =>
            session.id === attack.initialSessionId &&
            session.accountId === attack.accountId &&
            definition.initialSessionOrigins[session.id] === 'unauthorized',
        ),
        'Missing attacker initial session',
      );
    else
      check(
        integer(attack.firstAuthenticationTurn ?? -1, 1),
        'Missing first authentication turn',
      );
    try {
      createInitialAttacker(attack);
    } catch {
      errors.push('Invalid attacker plan');
    }
  }
  check(
    definition.integrity
      ? definition.kind === 'local-integrity' &&
          definition.attacker === null &&
          validateIntegrityDefinition(definition.integrity) &&
          Boolean(asset(definition.integrity.endpoint.assetId)) &&
          Boolean(account(definition.integrity.endpoint.accountId)) &&
          Boolean(account(definition.integrity.businessReadAccountId)) &&
          service(definition.integrity.datasetAssetId, 'SMB') &&
          definition.integrity.endpoint.permissions.every((p) =>
            service(p.assetId, p.protocol),
          ) &&
          definition.integrity.endpoint.businessCapacity <=
            process.localCapacity
      : definition.kind === 'legitimate-session'
        ? definition.attacker === null &&
          Object.values(definition.initialSessionOrigins).every(
            (origin) => origin === 'legitimate',
          )
        : definition.attacker !== null,
    'Scenario truth disagrees with actors',
  );
  return errors;
}

export function createScenario(
  definition: ScenarioDefinition,
  run: RunIdentity = { mode: 'training', seed: 0 },
): SimulationState {
  const errors = validateScenario(definition);
  if (errors.length)
    throw new Error(`Invalid scenario ${definition.id}: ${errors.join('; ')}`);
  if (
    !Number.isSafeInteger(run.seed) ||
    run.seed < 0 ||
    !['training', 'unknown'].includes(run.mode)
  )
    throw new Error('Invalid run identity');
  const config = structuredClone(definition);
  let state: SimulationState = {
    run: { ...run },
    world: config.world,
    clock: { ...config.clock, turn: 0 },
    process: config.process,
    access: config.access,
    telemetry: config.telemetry,
    business: {
      totalReceived: 0,
      totalProcessed: 0,
      backlog: 0,
      lastReport: null,
    },
    tasks: [],
    knowledge: {
      sessionObservation: null,
      authObservations: [],
      ownerStatements: [],
    },
    history: [],
    incident: {
      alerts: [],
      hypothesis: 'insufficient-evidence',
      messages: [
        {
          id: 'ewa-briefing',
          minute: config.clock.startMinute,
          speaker: 'Ewa',
          text: config.briefing.message,
          source: 'briefing',
          referenceId: 'mission-briefing',
        },
      ],
    },
    hidden: {
      scenario: config,
      attacker: config.attacker ? createInitialAttacker(config.attacker) : null,
      legitimateActors: config.legitimateBehaviors.map((actor) => ({
        id: actor.id,
        nextAuthenticationTurn: null,
      })),
      sessionOrigins: config.initialSessionOrigins,
      decisionHistory: [],
    },
  };
  for (const attempt of config.authenticationPrelude) {
    const actor = config.legitimateBehaviors.find(
      (item) => item.id === attempt.actorId,
    )!;
    const result = issueVpnSession(
      state.world,
      state.access,
      {
        sessionId: attempt.requestedSessionId,
        ...(actor.secondFactorVersion === undefined
          ? {}
          : { secondFactorVersion: actor.secondFactorVersion }),
        accountId: actor.accountId,
        credentialVersion: attempt.credentialVersion,
      },
      attempt.minute,
    );
    state = recordAuthentication(
      state,
      actor.accountId,
      result,
      attempt.minute,
    );
    if (result.ok)
      state = {
        ...state,
        access: result.access,
        hidden: {
          ...state.hidden,
          sessionOrigins: {
            ...state.hidden.sessionOrigins,
            [result.session.id]: 'legitimate',
          },
        },
      };
  }
  return updateTelemetry(initializeIntegrity(state));
}
