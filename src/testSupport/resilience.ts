import type {
  CampaignCommand,
  CampaignState,
  ProjectId,
} from '../domain/campaign';
import type { SimulationState, TaskAction } from '../domain/simulation';
import {
  campaignReducer,
  createCampaign,
} from '../application/campaignReducer';
import { simulationReducer } from '../application/simulationReducer';
import { taskSpecs } from '../simulation/tasks';
export const hour: CampaignCommand = { type: 'advance-preparation' };
export const turn: CampaignCommand = {
  type: 'incident-command',
  command: { type: 'advance-turn' },
};
export const fund: CampaignCommand = { type: 'accept-resilience-funding' };
export const hq: CampaignCommand = { type: 'return-headquarters' };
export function prepare(s: CampaignState) {
  while (s.preparation.hour < 4) s = campaignReducer(s, hour);
  return s;
}
export function finishCampaign(s: CampaignState) {
  while (s.phase === 'incident') s = campaignReducer(s, turn);
  return s;
}
export function nextMission(
  s: CampaignState,
  family:
    | 'start-incident'
    | 'start-integrity-incident' = 'start-integrity-incident',
) {
  return campaignReducer(prepare(s), { type: family });
}
export function reviewed() {
  const first = campaignReducer(
    finishCampaign(nextMission(createCampaign(), 'start-incident')),
    hq,
  );
  return campaignReducer(finishCampaign(nextMission(first)), hq);
}
export function reserve(s: CampaignState, projectId: ProjectId) {
  return campaignReducer(
    campaignReducer(s, { type: 'plan-project', projectId }),
    { type: 'reserve-project', projectId },
  );
}
export function assign(
  s: CampaignState,
  projectId: ProjectId,
  workerId: 'analyst' | 'administrator',
) {
  return campaignReducer(s, { type: 'assign-work', projectId, workerId });
}
export function workHour(s: CampaignState, ids: readonly ProjectId[]) {
  for (const worker of ['administrator', 'analyst'] as const) {
    if (
      s.work.some(
        (w) =>
          w.window === s.preparation.number &&
          w.workerId === worker &&
          w.status === 'running',
      )
    )
      continue;
    const p = s.projects.find(
      (p) =>
        ids.includes(p.id) &&
        ['reserved', 'in-progress'].includes(p.status) &&
        p.remaining[worker] > 0,
    );
    if (p) s = assign(s, p.id, worker);
  }
  return campaignReducer(s, hour);
}
export function deployed(ids: readonly ProjectId[]) {
  let s = campaignReducer(reviewed(), fund);
  for (const id of ids) s = reserve(s, id);
  for (
    let n = 0;
    n < 8 &&
    ids.some(
      (id) => s.projects.find((p) => p.id === id)?.status !== 'completed',
    );
    n++
  ) {
    if (s.preparation.hour === 4)
      s = campaignReducer(finishCampaign(nextMission(s)), hq);
    s = workHour(s, ids);
  }
  return s;
}
export function advance(s: SimulationState, n = 1) {
  for (let i = 0; i < n; i++)
    s = simulationReducer(s, { type: 'advance-turn' });
  return s;
}
export function order(s: SimulationState, action: TaskAction) {
  const next = simulationReducer(s, {
    type: 'schedule-task',
    workerId: taskSpecs[action.type].workerId,
    action,
  });
  if (next.tasks.length !== s.tasks.length + 1)
    throw new Error(
      `Task rejected: ${JSON.stringify(action)} ${JSON.stringify(next.history.at(-1))}`,
    );
  return next;
}
export function job(s: SimulationState, action: TaskAction) {
  const next = order(s, action);
  return advance(next, next.tasks.at(-1)!.dueTurn - next.clock.turn);
}
export function finish(s: SimulationState) {
  return advance(s, 18 - s.clock.turn);
}
export const endpointId = 'pakowanie-03';
export const isolate: TaskAction = { type: 'isolate-endpoint', endpointId };
export const examine: TaskAction = { type: 'examine-endpoint', endpointId };
export const restrict: TaskAction = {
  type: 'restrict-endpoint-writes',
  endpointId,
};
export const reconnect: TaskAction = { type: 'reconnect-endpoint', endpointId };
export const inventory: TaskAction = { type: 'inspect-backups' };
export const verify: TaskAction = {
  type: 'verify-backup',
  backupId: 'FS-1350',
};
export const restore: TaskAction = {
  type: 'restore-documents',
  backupId: 'FS-1350',
};
export const inspect: TaskAction = { type: 'inspect-documents' };
export const edr: TaskAction = { type: 'inspect-edr-telemetry' };
