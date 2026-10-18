import type { StrategicSession, GameSession } from '../application/gameSession';
import { campaign, prepare, finish, job, command, advance } from './aar';
import { branchHeadquarters, prepareBranch, startBranch } from './branch';
export function finaleHeadquarters(variant = 0): StrategicSession {
  const previous = (variant + 2) % 3;
  let g: GameSession = startBranch(prepareBranch(branchHeadquarters(previous)));
  if (previous === 0) {
    g = advance(g, 4);
    g = job(g, { type: 'inspect-branch-links' });
    g = job(g, { type: 'repair-branch-link' });
  }
  return campaign(finish(g) as StrategicSession, {
    type: 'return-headquarters',
  });
}
export function startFinale(variant = 0, approved = true) {
  let g = finaleHeadquarters(variant);
  if (approved)
    g = campaign(g, {
      type: 'prepare-vendor-exception',
      scope: 'api-only',
      expiresAtMinute: 930,
    });
  return campaign(prepare(g), {
    type: 'start-finale-incident',
    familyId: 'nexus-campaign-finale-v1',
  });
}
export function playFinale(g: GameSession, variant: number) {
  if (variant === 0) {
    g = job(g, { type: 'examine-endpoint', endpointId: 'pakowanie-03' });
    g = command(g, {
      type: 'schedule-task',
      workerId: 'administrator',
      action: { type: 'isolate-endpoint', endpointId: 'pakowanie-03' },
    });
    g = job(g, { type: 'inspect-backups' });
    g = command(g, {
      type: 'schedule-task',
      workerId: 'administrator',
      action: { type: 'restart-erp-service' },
    });
    g = job(g, { type: 'verify-backup', backupId: 'FS-1350' });
    g = command(g, {
      type: 'schedule-task',
      workerId: 'administrator',
      action: { type: 'restore-documents', backupId: 'FS-1350' },
    });
    g = job(g, { type: 'inspect-erp-consistency' });
    g = advance(g);
    g = command(g, {
      type: 'schedule-task',
      workerId: 'administrator',
      action: { type: 'restrict-endpoint-writes', endpointId: 'pakowanie-03' },
    });
    g = job(g, { type: 'inspect-documents' });
    g = job(g, { type: 'reconnect-endpoint', endpointId: 'pakowanie-03' });
  }
  if (variant === 2) {
    g = job(g, { type: 'inspect-erp-database' });
    g = job(g, { type: 'start-manual-shipping' });
    g = command(g, {
      type: 'schedule-task',
      workerId: 'administrator',
      action: { type: 'switch-erp-standby' },
    });
    g = job(g, { type: 'inspect-branch-links' });
    g = advance(g, 2);
    g = job(g, { type: 'close-manual-shipping' });
    g = command(g, {
      type: 'schedule-task',
      workerId: 'administrator',
      action: { type: 'repair-branch-link' },
    });
    g = job(g, { type: 'reconcile-erp-records' });
    g = advance(g);
    g = job(g, { type: 'inspect-erp-consistency' });
  }
  return finish(g);
}
