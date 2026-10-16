import { selectMissionReport } from '../application/selectMissionReport';
import type { OperationSession } from '../application/operationSession';
import { scenarioCatalog } from '../content/scenarios';
import {
  boundedJson,
  identifier,
  integer,
  object,
  timestamp,
  sameJson,
} from './saveFormat';
import type { Result } from './saveFormat';

export const HISTORY_LIMIT = 50;
export interface HistoryDocument {
  readonly schemaVersion: 1;
  readonly attempts: readonly AttemptSummary[];
  readonly clearedAt: string | null;
}
export interface AttemptSummary {
  readonly attemptId: string;
  readonly scenarioId: string;
  readonly mode: 'training' | 'unknown';
  readonly seed: number;
  readonly exposedRecords: number;
  readonly confidentialityMet: boolean;
  readonly processed: number;
  readonly backlog: number;
  readonly continuityMet: boolean;
  readonly containmentMet: boolean | null;
  readonly turns: number;
  readonly keyActions: number;
  readonly completedAt: string;
}
export function summarizeAttempt(
  session: OperationSession,
): AttemptSummary | null {
  const report = selectMissionReport(session.simulation);
  if (!report || !session.completedAt) return null;
  return {
    attemptId: session.attemptId,
    scenarioId: report.scenario.id,
    mode: report.scenario.mode,
    seed: report.scenario.seed,
    exposedRecords: report.confidentiality.exposedRecords,
    confidentialityMet: report.confidentiality.goalMet,
    processed: report.continuity.processed,
    backlog: report.continuity.backlog,
    continuityMet: report.continuity.goalMet,
    containmentMet: report.containment.goalMet,
    turns: session.simulation.clock.turn,
    keyActions: report.actions.length,
    completedAt: session.completedAt,
  };
}
export function appendAttempt(
  history: readonly AttemptSummary[],
  entry: AttemptSummary,
) {
  if (
    history.some(
      (item) => item.attemptId === entry.attemptId && sameJson(item, entry),
    )
  )
    return history;
  return [
    ...history.filter((item) => item.attemptId !== entry.attemptId),
    entry,
  ].slice(-HISTORY_LIMIT);
}
export function readHistory(text: string): Result<HistoryDocument> {
  try {
    if (text.length > 64 * 1024) throw new Error();
    const v: unknown = JSON.parse(text);
    boundedJson(v);
    if (
      !object(v) ||
      v.schemaVersion !== 1 ||
      Object.keys(v).length !== 3 ||
      (v.clearedAt !== null && !timestamp(v.clearedAt)) ||
      !Array.isArray(v.attempts) ||
      v.attempts.length > HISTORY_LIMIT
    )
      throw new Error();
    const ids = new Set<string>();
    for (const e of v.attempts as unknown[]) {
      if (
        !object(e) ||
        Object.keys(e).length !== 13 ||
        !identifier(e.attemptId) ||
        ids.has(e.attemptId) ||
        !timestamp(e.completedAt) ||
        (e.mode !== 'training' && e.mode !== 'unknown') ||
        !integer(e.seed) ||
        !integer(e.exposedRecords, 2000) ||
        !integer(e.processed, 360) ||
        !integer(e.backlog, 360) ||
        e.processed + e.backlog !== 360 ||
        e.turns !== 18 ||
        !integer(e.keyActions, 18) ||
        typeof e.confidentialityMet !== 'boolean' ||
        typeof e.continuityMet !== 'boolean' ||
        (e.containmentMet !== null && typeof e.containmentMet !== 'boolean')
      )
        throw new Error();
      const definition = scenarioCatalog.find((s) => s.id === e.scenarioId);
      if (
        !definition ||
        definition.id !==
          (e.mode === 'training'
            ? scenarioCatalog[0].id
            : scenarioCatalog[e.seed % scenarioCatalog.length]!.id) ||
        e.confidentialityMet !==
          e.exposedRecords <= definition.goals.maxExposedRecords ||
        e.continuityMet !== e.backlog <= definition.goals.maxFinalBacklog ||
        (e.containmentMet === null) !==
          !definition.goals.requireThreatContainment ||
        (!definition.attacker && e.exposedRecords !== 0)
      )
        throw new Error();
      ids.add(e.attemptId);
    }
    return { ok: true, value: v as unknown as HistoryDocument };
  } catch {
    return {
      ok: false,
      error:
        'Historia prób jest uszkodzona lub ma nieobsługiwaną wersję. Możesz ją wyczyścić.',
    };
  }
}
