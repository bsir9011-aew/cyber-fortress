import type { StrategicSession } from '../application/gameSession';
import { campaign, prepare, finish } from './aar';
import { recoveryHeadquarters, startRecovery } from './recovery';
import type { BranchSmbScope } from '../domain/branch';
export function branchHeadquarters(variant = 0): StrategicSession {
  return campaign(
    finish(
      startRecovery(recoveryHeadquarters((variant + 2) % 3)),
    ) as StrategicSession,
    { type: 'return-headquarters' },
  );
}
export function prepareBranch(
  s = branchHeadquarters(),
  scope: BranchSmbScope = 'documents',
) {
  s = campaign(
    s,
    {
      type: 'prepare-branch-architecture',
      change: { component: 'erp', enabled: true },
    },
    {
      type: 'prepare-branch-architecture',
      change: { component: 'monitoring', enabled: true },
    },
    { type: 'advance-preparation' },
  );
  if (scope !== 'none')
    s = campaign(
      s,
      {
        type: 'prepare-branch-architecture',
        change: { component: 'smb', scope },
      },
      { type: 'advance-preparation' },
    );
  s = campaign(s, {
    type: 'prepare-branch-architecture',
    change: { component: 'backup', enabled: true },
  });
  return prepare(s);
}
export const startBranch = (s = prepareBranch()) =>
  campaign(prepare(s), {
    type: 'start-branch-incident',
    familyId: 'nexus-east-branch-v1',
  });
