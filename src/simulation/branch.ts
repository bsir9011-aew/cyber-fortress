import type {
  BranchContext,
  BranchOperation,
  BranchObservation,
  BranchTaskAction,
  BranchTaskResult,
} from '../domain/branch';
import type {
  SimulationState,
  TaskAction,
  EmployeeTask,
  CommandRejection,
} from '../domain/simulation';
import {
  configureBranchAccess,
  branchSmbConfigurationMatches,
} from '../content/scenarios/branch';
import {
  assessBranchAccess,
  branchContextDefinitions,
  branchWorkAvailability,
  branchTransportAvailable,
} from './branchAccess';
import { currentMinute } from './clock';
import { isAssetOnline } from './access';
export const branchTaskSpecs = {
  'inspect-branch-links': { workerId: 'analyst', turns: 1 },
  'inspect-branch-gateway-logs': { workerId: 'analyst', turns: 1 },
  'confirm-branch-requirements': { workerId: 'analyst', turns: 1 },
  'activate-branch-route': { workerId: 'administrator', turns: 1 },
  'repair-branch-link': { workerId: 'administrator', turns: 3 },
  'set-branch-smb-scope': { workerId: 'administrator', turns: 2 },
  'set-branch-account-restriction': { workerId: 'administrator', turns: 1 },
} as const;
export const isBranchAction = (a: TaskAction): a is BranchTaskAction =>
  Object.hasOwn(branchTaskSpecs, a.type);
function authenticate(
  s: SimulationState,
  c: { id: string; accountId: string },
): BranchContext {
  const a = s.access.accounts.find((a) => a.id === c.accountId);
  const source =
    isAssetOnline(s.world, 'east-workstations') &&
    isAssetOnline(s.world, s.access.identityAssetId);
  const reason =
    !source || !a
      ? 'source-unavailable'
      : a.loginStatus === 'blocked'
        ? 'account-blocked'
        : a.mfaPolicy === 'required' && a.secondFactorVersion !== 1
          ? 'mfa-required'
          : 'authenticated';
  return {
    ...c,
    authenticated: reason === 'authenticated',
    issuedAtMinute: reason === 'authenticated' ? currentMinute(s.clock) : null,
    lastAttemptTurn: s.clock.turn,
    authenticationReason: reason,
  };
}
export function initializeBranch(s: SimulationState): SimulationState {
  const d = s.hidden.scenario.branch;
  if (!d) return s;
  const next = {
    ...s,
    branch: {
      architecture: d.architecture,
      tunnel: {
        id: 'EAST-S2S' as const,
        localGatewayAssetId: 'east-gateway' as const,
        linkAssetId: 'east-primary-link' as const,
        peerAssetId: 'firewall' as const,
        authenticated: true,
        authorized: true,
      },
      backupAuthenticated: d.architecture.backupPrepared,
      backupAuthorized: d.architecture.backupPrepared,
      contexts: branchContextDefinitions.map((c) => authenticate(s, c)),
      activeRoute: 'primary' as const,
      faultApplied: false,
      primaryFault: !isAssetOnline(s.world, 'east-primary-link'),
      operations: [],
      gatewayRecords: [],
      sensor: {
        enabled: d.architecture.monitoring,
        coverageFromMinute: s.clock.startMinute,
        retentionMinutes: 120 as const,
        delayMinutes: 0 as const,
      },
      observations: [],
      results: [],
      transitions: [],
      events: [],
    },
  };
  return trackBranchAvailability(next);
}
export function branchTaskRejection(
  s: SimulationState,
  a: BranchTaskAction,
): CommandRejection | null {
  const b = s.branch;
  if (!b) return 'invalid-state';
  switch (a.type) {
    case 'inspect-branch-gateway-logs':
      return b.sensor.enabled &&
        (isAssetOnline(s.world, 'east-gateway') ||
          isAssetOnline(s.world, 'east-backup-gateway'))
        ? null
        : 'source-unavailable';
    case 'activate-branch-route':
      if (!['primary', 'backup'].includes(a.route)) return 'invalid-command';
      if (a.route === b.activeRoute) return 'invalid-state';
      return a.route === 'backup' && !b.architecture.backupPrepared
        ? 'invalid-state'
        : null;
    case 'repair-branch-link': {
      const observed = [...b.observations]
        .reverse()
        .find((o) => Object.hasOwn(o.assetStatuses, 'east-primary-link'));
      if (!observed) return 'target-not-observed';
      return observed.assetStatuses['east-primary-link'] === 'offline'
        ? null
        : 'invalid-state';
    }
    case 'set-branch-smb-scope':
      return !['none', 'documents', 'all'].includes(a.scope)
        ? 'invalid-command'
        : a.scope === b.architecture.smbScope &&
            branchSmbConfigurationMatches(s.access, b.architecture)
          ? 'invalid-state'
          : null;
    case 'set-branch-account-restriction':
      if (typeof a.restricted !== 'boolean') return 'invalid-command';
      if (
        !b.contexts.some((c) => c.accountId === a.accountId) ||
        !s.access.accounts.some((c) => c.id === a.accountId)
      )
        return 'unknown-target';
      return b.architecture.restrictedAccountIds.includes(a.accountId) ===
        a.restricted
        ? 'invalid-state'
        : null;
    default:
      return null;
  }
}
function recordOperation(
  s: SimulationState,
  contextId: string,
  targetAssetId: string,
  protocol: 'HTTPS' | 'SMB',
  operation: BranchOperation['operation'],
  origin: BranchOperation['origin'],
  minute: number,
): SimulationState {
  const b = s.branch!,
    context = b.contexts.find((c) => c.id === contextId);
  if (!context) return s;
  const checks = assessBranchAccess(s, contextId, targetAssetId, protocol);
  const op: BranchOperation = {
    id: `EAST-OP-${b.operations.length + 1}`,
    minute,
    contextId,
    accountId: context.accountId,
    sourceAssetId: 'east-workstations',
    gatewayAssetId:
      b.activeRoute === 'primary' ? 'east-gateway' : 'east-backup-gateway',
    targetAssetId,
    protocol,
    operation,
    origin,
    recordsRead:
      checks.allowed && operation === 'read'
        ? origin === 'unauthorized'
          ? Math.min(
              200,
              2000 -
                b.operations.reduce(
                  (n, o) =>
                    n +
                    (o.origin === 'unauthorized' ? (o.recordsRead ?? 0) : 0),
                  0,
                ),
            )
          : 4
        : null,
    checks,
  };
  const captured =
    b.sensor.enabled &&
    minute >= b.sensor.coverageFromMinute &&
    isAssetOnline(s.world, 'east-workstations') &&
    isAssetOnline(s.world, op.gatewayAssetId);
  let next: SimulationState = {
    ...s,
    branch: {
      ...b,
      operations: [...b.operations, op],
      gatewayRecords: captured
        ? [
            ...b.gatewayRecords,
            {
              id: `EAST-FLOW-${b.gatewayRecords.length + 1}`,
              minute,
              contextId,
              accountId: op.accountId,
              sourceAssetId: op.sourceAssetId,
              gatewayAssetId: op.gatewayAssetId,
              targetAssetId,
              protocol,
              route: b.activeRoute,
              outcome: checks.reachedService ? 'allowed' : 'denied',
              reason: checks.reachedService
                ? 'forwarded-to-service'
                : 'transport-or-authentication-denied',
            },
          ]
        : b.gatewayRecords,
    },
  };
  const audit = s.telemetry.fileAudit;
  if (
    protocol === 'SMB' &&
    checks.reachedService &&
    audit?.sensor.enabled &&
    audit.sensor.sourceAssetId === targetAssetId &&
    minute >= audit.sensor.coverageFromMinute
  )
    next = {
      ...next,
      telemetry: {
        ...next.telemetry,
        fileAudit: {
          ...audit,
          sourceEvents: [
            ...audit.sourceEvents,
            {
              id: `FILE-${String(audit.sourceEvents.length + 1).padStart(4, '0')}`,
              minute,
              accountId: context.accountId,
              sessionId: null,
              endpointId: context.id,
              targetAssetId,
              operation: operation === 'work' ? 'read' : operation,
              outcome: checks.allowed ? 'allowed' : 'denied',
              recordsRead: op.recordsRead,
            },
          ],
        },
      },
    };
  return next;
}
export function recordLegalBranchActivity(s: SimulationState): SimulationState {
  if (!s.branch) return s;
  const minute = currentMinute(s.clock) + s.clock.turnMinutes;
  let next = recordOperation(
    s,
    'EAST-OP',
    'erp',
    'HTTPS',
    'work',
    'legitimate',
    minute,
  );
  next = recordOperation(
    next,
    'EAST-DOC',
    'erp',
    'HTTPS',
    'work',
    'legitimate',
    minute,
  );
  if (branchWorkAvailability(s).requiresDocuments)
    next = recordOperation(
      next,
      'EAST-DOC',
      'fs-01',
      'SMB',
      'read',
      'legitimate',
      minute,
    );
  return next;
}
export function stepBranch(s: SimulationState): SimulationState {
  let b = s.branch;
  const d = s.hidden.scenario.branch;
  if (!b || !d) return s;
  const minute = currentMinute(s.clock);
  b = {
    ...b,
    contexts: b.contexts.map((c) =>
      c.authenticated || c.lastAttemptTurn === s.clock.turn
        ? c
        : authenticate(s, c),
    ),
  };
  let next = { ...s, branch: b };
  if (
    !b.faultApplied &&
    d.linkFailureTurn !== null &&
    s.clock.turn >= d.linkFailureTurn
  ) {
    b = {
      ...b,
      faultApplied: true,
      primaryFault: true,
      events: [
        ...b.events,
        {
          minute,
          kind: 'link-failed',
          taskId: null,
          text: 'Utrata fizycznego połączenia east-primary-link.',
        },
      ],
    };
    next = {
      ...next,
      world: {
        ...s.world,
        assets: s.world.assets.map((a) =>
          a.id === 'east-primary-link' ? { ...a, status: 'offline' } : a,
        ),
      },
      branch: b,
    };
  }
  if (d.compromisedContextId && s.clock.turn >= d.firstProbeTurn)
    next = recordOperation(
      next,
      d.compromisedContextId,
      'fs-01',
      'SMB',
      s.clock.turn >= d.firstReadTurn
        ? 'read'
        : s.clock.turn === d.firstProbeTurn
          ? 'list'
          : 'open',
      'unauthorized',
      minute,
    ) as typeof next;
  return trackBranchAvailability(next);
}
export function trackBranchAvailability(s: SimulationState): SimulationState {
  const b = s.branch;
  if (!b) return s;
  const entry = {
    minute: currentMinute(s.clock),
    route: b.activeRoute,
    primaryAvailable: branchTransportAvailable(s, 'primary'),
    backupAvailable: branchTransportAvailable(s, 'backup'),
    branchCapacity: branchWorkAvailability(s).capacity,
    documentService: assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed,
    fileAccessAccountIds: b.contexts
      .filter((c) => assessBranchAccess(s, c.id, 'fs-01', 'SMB').allowed)
      .map((c) => c.accountId),
  };
  return {
    ...s,
    branch: {
      ...b,
      transitions: [
        ...b.transitions.filter((t) => t.minute !== entry.minute),
        entry,
      ],
    },
  };
}
export function applyBranchTask(
  s: SimulationState,
  t: EmployeeTask,
): SimulationState {
  const a = t.action;
  if (!s.branch || !isBranchAction(a)) return s;
  let b = s.branch,
    next = s;
  const minute = currentMinute(s.clock),
    d = s.hidden.scenario.branch!;
  let text = '',
    outcome: BranchTaskResult['outcome'] = 'succeeded',
    observation: BranchObservation | null = null;
  const fail = (message: string) => {
    outcome = 'failed';
    text = message;
  };
  const observe = (
    source: string,
    assertion: BranchObservation['assertion'],
    description: string,
    statuses: BranchObservation['assetStatuses'] = {},
    records: BranchObservation['records'] = [],
  ) => {
    observation = {
      id: `EAST-OBS-${t.id}`,
      taskId: t.id,
      minute,
      source,
      assertion,
      text: description,
      assetStatuses: statuses,
      records,
    };
    text = description;
  };
  const event = (kind: (typeof b.events)[number]['kind']) => {
    b = { ...b, events: [...b.events, { minute, kind, taskId: t.id, text }] };
  };
  switch (a.type) {
    case 'inspect-branch-links': {
      const statuses = Object.fromEntries(
        [
          'east-workstations',
          'east-gateway',
          'east-primary-link',
          'east-backup-gateway',
          'firewall',
          'erp',
          'fs-01',
        ].map((id) => [
          id,
          isAssetOnline(s.world, id)
            ? ('online' as const)
            : ('offline' as const),
        ]),
      );
      observe(
        'EAST transport diagnostics',
        'observation',
        `Trasa aktywna: ${b.activeRoute}. Primary: ${branchTransportAvailable(s, 'primary') ? 'transport działa' : 'transport niedostępny'}. Backup: ${branchTransportAvailable(s, 'backup') ? 'transport działa' : 'niegotowy lub niedostępny'}. Tunel site-to-site: peer ${b.tunnel.peerAssetId}, uwierzytelnienie ${b.tunnel.authenticated ? 'potwierdzone' : 'niepotwierdzone'}, autoryzacja ${b.tunnel.authorized ? 'tak' : 'nie'}. Konteksty lokalne: ${b.contexts.map((c) => `${c.accountId}: ${c.authenticated ? 'wydany' : c.authenticationReason}`).join('; ')}. ERP/HTTPS z EAST-OP: ${assessBranchAccess(s, 'EAST-OP', 'erp', 'HTTPS').allowed ? 'dostępny' : 'niedostępny'}; FS-01/SMB z EAST-DOC: ${assessBranchAccess(s, 'EAST-DOC', 'fs-01', 'SMB').allowed ? 'dostępny' : 'niedostępny'}. Stan trasy nie nadaje prawa do danych.`,
        statuses,
      );
      break;
    }
    case 'inspect-branch-gateway-logs': {
      if (
        !b.sensor.enabled ||
        (!isAssetOnline(s.world, 'east-gateway') &&
          !isAssetOnline(s.world, 'east-backup-gateway'))
      ) {
        fail('Monitor lub źródła bramy niedostępne.');
        break;
      }
      const records = b.gatewayRecords.filter(
        (r) =>
          r.minute >=
            Math.max(
              b.sensor.coverageFromMinute,
              minute - b.sensor.retentionMinutes,
            ) &&
          r.minute <= minute &&
          isAssetOnline(s.world, r.gatewayAssetId),
      );
      observe(
        'EAST gateway metadata',
        'observation',
        'Metadane przepływów bram: allowed oznacza przekazanie do usługi, nie prawo do treści. Brak odczytu zawartości zaszyfrowanej transmisji. Retencja 120 min, opóźnienie 0; odczyt wymaga dostępnej bramy.',
        {},
        records,
      );
      break;
    }
    case 'confirm-branch-requirements':
      observe(
        'NEXUS EAST operations',
        'human-statement',
        d.requiresDocuments
          ? 'Operacje potwierdzają: od 14:10 dwa z sześciu zleceń wymagają tylko ERP, cztery także FS-01/SMB z konta east-documents. Konto east-operator nie potrzebuje plików. To relacja zespołu; nie dowodzi pochodzenia obserwowanego ruchu.'
          : 'Operacje potwierdzają: sześć zleceń wymaga ERP/HTTPS (cztery east-operator, dwa east-documents). W tym oknie nie zlecono pracy z FS-01/SMB. To relacja zespołu; sam ruch SMB nie identyfikuje człowieka ani nie dowodzi odczytu danych.',
      );
      break;
    case 'activate-branch-route':
      if (!branchTransportAvailable(s, a.route))
        fail(
          'Przełączenie nieskuteczne: docelowa trasa nie ma dostępnego transportu, uwierzytelnienia lub autoryzacji.',
        );
      else {
        b = { ...b, activeRoute: a.route };
        text = `Wybrano trasę ${a.route}. ${a.route === 'backup' ? 'Wyłącznie ERP/HTTPS, do 3/turę, bez SMB.' : 'Site-to-site nadal wymaga ACL i uprawnień.'}`;
        event('route-changed');
      }
      break;
    case 'repair-branch-link':
      if (
        !d.repairable ||
        !b.primaryFault ||
        isAssetOnline(s.world, 'east-primary-link')
      )
        fail(
          'Brak naprawialnej awarii east-primary-link w zakresie tej pracy. Inne bramy i polityki nie zostały zmienione.',
        );
      else {
        next = {
          ...next,
          world: {
            ...next.world,
            assets: next.world.assets.map((asset) =>
              asset.id === 'east-primary-link'
                ? { ...asset, status: 'online' }
                : asset,
            ),
          },
        };
        b = { ...b, primaryFault: false };
        text =
          'Naprawiono east-primary-link. Aktywna trasa nie zmienia się automatycznie; sprawdź przepływy.';
        event('link-repaired');
      }
      break;
    case 'set-branch-smb-scope': {
      b = { ...b, architecture: { ...b.architecture, smbScope: a.scope } };
      const configured = configureBranchAccess(s.access, b.architecture);
      // This task changes only SMB; preserve independently modified ERP and transport rules/grants.
      next = {
        ...next,
        access: {
          ...s.access,
          rules: s.access.rules.map((r) =>
            r.id === 'EAST-SMB'
              ? configured.rules.find((c) => c.id === r.id)!
              : r,
          ),
          permissions: [
            ...s.access.permissions.filter(
              (p) =>
                !(
                  b.contexts.some((c) => c.accountId === p.accountId) &&
                  p.targetAssetId === 'fs-01' &&
                  p.protocol === 'SMB'
                ),
            ),
            ...configured.permissions.filter(
              (p) =>
                b.contexts.some((c) => c.accountId === p.accountId) &&
                p.targetAssetId === 'fs-01' &&
                p.protocol === 'SMB',
            ),
          ],
        },
      };
      text = `Wdrożono SMB: ${a.scope}. ACL i nadania zasobowe mają osobne warunki; bieżące ograniczenia kont pozostają.`;
      event('policy-changed');
      break;
    }
    case 'set-branch-account-restriction':
      if (
        !b.contexts.some((c) => c.accountId === a.accountId) ||
        !s.access.accounts.some((c) => c.id === a.accountId)
      ) {
        fail('Konto oddziału nie istnieje.');
        break;
      }
      b = {
        ...b,
        architecture: {
          ...b.architecture,
          restrictedAccountIds: a.restricted
            ? [...b.architecture.restrictedAccountIds, a.accountId]
            : b.architecture.restrictedAccountIds.filter(
                (id) => id !== a.accountId,
              ),
        },
      };
      text = `${a.restricted ? 'Odebrano' : 'Przywrócono'} bieżącą autoryzację SMB konta ${a.accountId}, także dla już wydanego kontekstu. ERP, nowe logowania, hasło, MFA i sesje VPN pozostają osobnymi mechanizmami.${a.restricted ? '' : ' Jeśli kontekst jest nadal przejęty, odzyska on także możliwość odczytu danych.'}`;
      event('authorization-changed');
      break;
  }
  const result: BranchTaskResult = {
    taskId: t.id,
    minute,
    action: a,
    outcome,
    text,
  };
  return {
    ...next,
    branch: {
      ...b,
      results: [...b.results, result],
      observations: observation
        ? [...b.observations, observation]
        : b.observations,
    },
  };
}
export function observeBranchTask(
  s: SimulationState,
  t: EmployeeTask,
): SimulationState {
  return t.workerId === 'analyst' && isBranchAction(t.action)
    ? applyBranchTask(s, t)
    : s;
}
