import type { GameSession, StrategicSession } from '../application/gameSession';
import {
  applyCampaignSession,
  createStandalone,
  createStrategicSession,
} from '../application/gameSession';
import { applyOperationCommand } from '../application/operationSession';
import type { RecordedCommand } from '../application/operationSession';
import type { CampaignCommand, ProjectId } from '../domain/campaign';
import type { TaskAction } from '../domain/simulation';
import { taskSpecs } from '../simulation/tasks';
export const sessionDate = '2026-10-17T10:00:00.000Z';
export const reportDate = '2026-10-18T12:00:00.000Z';
export function command(g: GameSession, c: RecordedCommand): GameSession {
  return g.kind === 'incident'
    ? { ...g, operation: applyOperationCommand(g.operation, c, sessionDate) }
    : applyCampaignSession(
        g,
        { type: 'incident-command', command: c },
        sessionDate,
      );
}
export const simulation = (g: GameSession) =>
  g.kind === 'incident' ? g.operation.simulation : g.campaign.incident!;
export function advance(g: GameSession, n = 1) {
  for (let i = 0; i < n; i++) g = command(g, { type: 'advance-turn' });
  return g;
}
export function finish(g: GameSession) {
  while (simulation(g).clock.turn < 18) g = advance(g);
  return g;
}
export function order(g: GameSession, action: TaskAction) {
  return command(g, {
    type: 'schedule-task',
    workerId: taskSpecs[action.type].workerId,
    action,
  });
}
export function job(g: GameSession, action: TaskAction) {
  const next = order(g, action),
    s = simulation(next);
  if (s.tasks.length !== simulation(g).tasks.length + 1)
    throw new Error('Test scenario task rejected: ' + JSON.stringify(action));
  return advance(next, s.tasks.at(-1)!.dueTurn - s.clock.turn);
}
export const campaign = (s: StrategicSession, ...cs: CampaignCommand[]) =>
  cs.reduce((s, c) => applyCampaignSession(s, c, sessionDate), s);
export function prepare(s: StrategicSession) {
  while (s.campaign.preparation.hour < 4)
    s = campaign(s, { type: 'advance-preparation' });
  return s;
}
export function startM02(s: StrategicSession) {
  return campaign(prepare(s), { type: 'start-integrity-incident' });
}
export function firstCampaign() {
  return campaign(
    finish(
      campaign(prepare(createStrategicSession('aar-campaign', sessionDate)), {
        type: 'start-incident',
      }),
    ) as StrategicSession,
    { type: 'return-headquarters' },
  );
}
export function fundedCampaign() {
  return campaign(
    finish(startM02(firstCampaign())) as StrategicSession,
    { type: 'return-headquarters' },
    { type: 'accept-resilience-funding' },
  );
}
export function install(s: StrategicSession, ids: readonly ProjectId[]) {
  for (const projectId of ids)
    s = campaign(
      s,
      { type: 'plan-project', projectId },
      { type: 'reserve-project', projectId },
    );
  while (
    ids.some(
      (id) =>
        s.campaign.projects.find((p) => p.id === id)?.status !== 'completed',
    )
  ) {
    if (s.campaign.preparation.hour === 4)
      s = campaign(finish(startM02(s)) as StrategicSession, {
        type: 'return-headquarters',
      });
    for (const workerId of ['administrator', 'analyst'] as const) {
      if (
        s.campaign.work.some(
          (w) =>
            w.window === s.campaign.preparation.number &&
            w.workerId === workerId &&
            w.status === 'running',
        )
      )
        continue;
      const p = s.campaign.projects.find(
        (p) =>
          ids.includes(p.id) &&
          ['reserved', 'in-progress'].includes(p.status) &&
          p.remaining[workerId] > 0,
      );
      if (p)
        s = campaign(s, { type: 'assign-work', projectId: p.id, workerId });
    }
    s = campaign(s, { type: 'advance-preparation' });
  }
  return s;
}
export type AarScenarioId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export function playAarScenario(id: AarScenarioId): GameSession {
  let g: GameSession;
  if (['D', 'E', 'F', 'G'].includes(id)) {
    const start =
      id === 'F'
        ? install(fundedCampaign(), ['endpoint-edr', 'backup-resilience'])
        : id === 'G'
          ? install(fundedCampaign(), ['endpoint-edr'])
          : firstCampaign();
    g = startM02(start);
  } else
    g = createStandalone(
      'unknown',
      id === 'H' ? 1 : 0,
      `aar-${id}`,
      sessionDate,
    );
  if (id === 'A') {
    g = order(order(g, { type: 'inspect-auth-logs' }), {
      type: 'set-network-rule',
      ruleId: 'R-SMB',
      action: 'deny',
    });
    g = advance(g, 2);
  }
  if (id === 'B') {
    g = job(g, { type: 'block-account', accountId: 'magazyn-07' });
    g = job(g, { type: 'inspect-auth-logs' });
    g = job(g, { type: 'inspect-vpn-sessions' });
  }
  if (id === 'C') {
    g = job(g, { type: 'set-vpn', assetId: 'vpn', enabled: false });
    g = job(g, { type: 'set-network-rule', ruleId: 'R-SMB', action: 'deny' });
    g = job(g, { type: 'set-vpn', assetId: 'vpn', enabled: true });
  }
  if (id === 'D')
    g = job(g, { type: 'isolate-endpoint', endpointId: 'pakowanie-03' });
  if (id === 'E') {
    g = job(g, { type: 'inspect-backups' });
    g = job(g, { type: 'verify-backup', backupId: 'FS-1350' });
    g = job(g, { type: 'restore-documents', backupId: 'FS-1350' });
  }
  if (id === 'F') {
    g = job(g, { type: 'inspect-edr-telemetry' });
    g = advance(
      order(
        order(g, { type: 'isolate-endpoint', endpointId: 'pakowanie-03' }),
        { type: 'inspect-backups' },
      ),
    );
    g = job(g, { type: 'restore-documents', backupId: 'FS-1350' });
    g = advance(
      order(
        order(g, {
          type: 'restrict-endpoint-writes',
          endpointId: 'pakowanie-03',
        }),
        { type: 'inspect-documents' },
      ),
      2,
    );
    g = job(g, { type: 'reconnect-endpoint', endpointId: 'pakowanie-03' });
  }
  if (id === 'H') {
    g = job(g, { type: 'inspect-auth-logs' });
    g = job(g, { type: 'block-account', accountId: 'magazyn-07' });
    g = job(g, { type: 'set-vpn', assetId: 'vpn', enabled: false });
  }
  return finish(g);
}
