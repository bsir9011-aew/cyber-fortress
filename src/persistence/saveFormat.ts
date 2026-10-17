import {
  createScenarioRun,
  selectScenario,
} from '../application/scenarioSelectors';
import { simulationReducer } from '../application/simulationReducer';
import type {
  OperationSession,
  RecordedCommand,
  SavedUiState,
} from '../application/operationSession';

export const SCHEMA_VERSION = 1;
export const ENGINE_VERSION = '6.0.0';
export const CONTENT_VERSION = 'nexus-variants-1';
export const SCENARIO_VERSION = 1;
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;
export const MAX_COMMANDS = 2048;
export interface FortressSaveV1 extends OperationSession {
  readonly schemaVersion: 1;
  readonly engineVersion: string;
  readonly contentVersion: string;
  readonly scenarioId: string;
  readonly scenarioVersion: 1;
  readonly savedAt: string;
}
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code?: 'storage-unavailable' };
function invalid(): never {
  throw new Error(
    'Zapis jest niekompletny lub niespójny. Bieżąca gra pozostała bez zmian.',
  );
}
export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function integer(
  value: unknown,
  max = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= max
  );
}
export function timestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
export function identifier(value: unknown): value is string {
  return (
    typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(value)
  );
}
export function keys(value: Record<string, unknown>, fields: string[]) {
  return (
    Object.keys(value).length === fields.length &&
    fields.every((key) => Object.hasOwn(value, key))
  );
}
export function isRecordedCommand(
  value: unknown,
  allowV2Actions = false,
): value is RecordedCommand {
  if (!object(value)) return false;
  if (value.type === 'advance-turn') return keys(value, ['type']);
  if (value.type === 'set-hypothesis')
    return (
      keys(value, ['type', 'hypothesis']) &&
      typeof value.hypothesis === 'string' &&
      [
        'insufficient-evidence',
        'compromised-credential',
        'unusual-legitimate-session',
        'existing-tunnel-access',
      ].includes(value.hypothesis)
    );
  if (
    value.type !== 'schedule-task' ||
    !keys(value, ['type', 'workerId', 'action']) ||
    (value.workerId !== 'analyst' && value.workerId !== 'administrator') ||
    !object(value.action)
  )
    return false;
  const a = value.action;
  switch (a.type) {
    case 'inspect-file-access':
      return allowV2Actions && keys(a, ['type']);
    case 'unblock-account':
      return (
        allowV2Actions &&
        keys(a, ['type', 'accountId']) &&
        identifier(a.accountId)
      );
    case 'inspect-auth-logs':
    case 'inspect-vpn-sessions':
      return keys(a, ['type']);
    case 'contact-account-owner':
    case 'block-account':
    case 'reset-credential':
      return keys(a, ['type', 'accountId']) && identifier(a.accountId);
    case 'terminate-session':
      return keys(a, ['type', 'sessionId']) && identifier(a.sessionId);
    case 'set-vpn':
      return (
        keys(a, ['type', 'assetId', 'enabled']) &&
        identifier(a.assetId) &&
        typeof a.enabled === 'boolean'
      );
    case 'set-network-rule':
      return (
        keys(a, ['type', 'ruleId', 'action']) &&
        identifier(a.ruleId) &&
        (a.action === 'allow' || a.action === 'deny')
      );
    default:
      return false;
  }
}
/** Porównanie JSON bez zależności od kolejności kluczy. Żadne pola nie są pomijane. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, i) => sameJson(item, b[i]));
  if (!object(a) || !object(b)) return false;
  const ak = Object.keys(a);
  return (
    ak.length === Object.keys(b).length &&
    ak.every((key) => Object.hasOwn(b, key) && sameJson(a[key], b[key]))
  );
}
/** Ograniczamy również głębokość i liczbę elementów przed rekurencją porównania. */
export function boundedJson(value: unknown) {
  const pending = [{ value, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++count > 150_000 || item.depth > 48) invalid();
    if (typeof item.value === 'number' && !Number.isFinite(item.value))
      invalid();
    if (item.value && typeof item.value === 'object') {
      const container = item.value as Record<string, unknown>;
      for (const key in container) {
        if (!Object.hasOwn(container, key)) continue;
        if (['__proto__', 'constructor', 'prototype'].includes(key)) invalid();
        if (pending.length + count >= 150_000) invalid();
        pending.push({ value: container[key], depth: item.depth + 1 });
      }
    }
  }
}
export function validateUi(
  value: unknown,
  session: OperationSession['simulation'],
): value is SavedUiState {
  if (
    !object(value) ||
    !keys(value, ['briefing', 'context', 'layer', 'selection']) ||
    typeof value.briefing !== 'boolean' ||
    typeof value.context !== 'string' ||
    !['cases', 'operations', 'architecture'].includes(value.context) ||
    typeof value.layer !== 'string' ||
    !['network', 'identity', 'business', 'telemetry'].includes(value.layer)
  )
    return false;
  if (value.selection === null) return true;
  const s = value.selection;
  if (!object(s) || !keys(s, ['kind', 'id'])) return false;
  return s.kind === 'asset'
    ? session.world.assets.some((a) => a.id === s.id)
    : s.kind === 'connection' &&
        session.world.connections.some((c) => c.id === s.id);
}
export function createSave(
  session: OperationSession,
  savedAt: string,
): FortressSaveV1 {
  return {
    ...toOperationSession(session),
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    contentVersion: CONTENT_VERSION,
    scenarioId: session.simulation.hidden.scenario.id,
    scenarioVersion: SCENARIO_VERSION,
    savedAt,
  };
}
export function toOperationSession(save: OperationSession): OperationSession {
  return {
    attemptId: save.attemptId,
    createdAt: save.createdAt,
    completedAt: save.completedAt,
    simulation: save.simulation,
    commands: save.commands,
    uiState: save.uiState,
  };
}
/** Jedyny punkt przyszłej migracji. V1 wymaga dokładnie zgodnego silnika i treści. */
export function readSave(text: string): Result<FortressSaveV1> {
  try {
    if (
      text.length > MAX_SAVE_BYTES ||
      new TextEncoder().encode(text).byteLength > MAX_SAVE_BYTES
    )
      throw new Error('Zapis przekracza limit 2 MiB.');
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error('Plik nie zawiera poprawnego JSON.');
    }
    if (!object(value)) invalid();
    // Jawna bramka wersji, bez zgadywania migracji.
    if (value.schemaVersion !== SCHEMA_VERSION)
      throw new Error('Nieobsługiwana wersja schematu zapisu.');
    if (
      value.engineVersion !== ENGINE_VERSION ||
      value.contentVersion !== CONTENT_VERSION ||
      value.scenarioVersion !== SCENARIO_VERSION
    )
      throw new Error('Zapis wymaga innej wersji silnika lub scenariuszy.');
    boundedJson(value);
    if (
      !keys(value, [
        'schemaVersion',
        'engineVersion',
        'contentVersion',
        'scenarioId',
        'scenarioVersion',
        'savedAt',
        'attemptId',
        'createdAt',
        'completedAt',
        'simulation',
        'commands',
        'uiState',
      ]) ||
      !timestamp(value.savedAt) ||
      !timestamp(value.createdAt) ||
      !identifier(value.attemptId) ||
      !object(value.simulation) ||
      !object(value.simulation.run)
    )
      invalid();
    const run = value.simulation.run;
    if (
      (run.mode !== 'training' && run.mode !== 'unknown') ||
      !integer(run.seed)
    )
      invalid();
    if (
      value.scenarioId !== selectScenario(run.mode, run.seed).id ||
      !Array.isArray(value.commands) ||
      value.commands.length > MAX_COMMANDS ||
      !value.commands.every((entry) => isRecordedCommand(entry))
    )
      invalid();
    let expected = createScenarioRun(run.mode, run.seed);
    for (const entry of value.commands) {
      if (expected.clock.turn === expected.clock.turnLimit) invalid();
      expected = simulationReducer(expected, entry);
    }
    // Ten sam silnik weryfikuje wszystkie referencje, liczniki, dowody i ukryty stan.
    if (
      !sameJson(expected, value.simulation) ||
      !validateUi(value.uiState, expected)
    )
      invalid();
    const finished = expected.clock.turn === expected.clock.turnLimit;
    if (finished ? !timestamp(value.completedAt) : value.completedAt !== null)
      invalid();
    if (
      value.createdAt > value.savedAt ||
      (timestamp(value.completedAt) &&
        (value.completedAt < value.createdAt ||
          value.completedAt > value.savedAt))
    )
      invalid();
    // Zwracamy pełną sprawdzoną migawkę, bez nowej tury i bez scalania z domyślnymi polami.
    return { ok: true, value: value as unknown as FortressSaveV1 };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Nie udało się odczytać zapisu.',
    };
  }
}
export function serializeSave(save: FortressSaveV1): Result<string> {
  try {
    const text = JSON.stringify(save);
    const checked = readSave(text);
    return checked.ok ? { ok: true, value: text } : checked;
  } catch {
    return { ok: false, error: 'Nie udało się przygotować zapisu.' };
  }
}
