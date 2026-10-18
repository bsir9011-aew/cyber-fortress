import type { CampaignState } from '../domain/campaign';
import type {
  BranchArchitecture,
  BranchArchitectureChange,
} from '../domain/branch';
import type { WorkerId } from '../domain/simulation';
import { defaultBranchArchitecture } from '../content/scenarios/branch';
export function branchPreparationSpec(change: BranchArchitectureChange): {
  workerId: WorkerId;
  hours: number;
} {
  return {
    workerId: change.component === 'monitoring' ? 'analyst' : 'administrator',
    hours: change.component === 'backup' ? 2 : 1,
  };
}
export function preparationWorkerBusy(s: CampaignState, workerId: WorkerId) {
  return (
    s.work.some(
      (w) =>
        w.window === s.preparation.number &&
        w.workerId === workerId &&
        w.status === 'running',
    ) ||
    s.branchWork?.some(
      (w) => w.workerId === workerId && w.status === 'running',
    ) ||
    (workerId === 'administrator'
      ? s.vendorApprovals?.some((w) => w.completedHour === null)
      : s.detectionChanges?.some((w) => w.completedHour === null)) ||
    false
  );
}
function matches(a: BranchArchitectureChange, b: BranchArchitectureChange) {
  return (
    a.component === b.component &&
    (a.component === 'smb' && b.component === 'smb'
      ? a.scope === b.scope
      : 'enabled' in a && 'enabled' in b && a.enabled === b.enabled)
  );
}
function architectureRuleIds(c: BranchArchitectureChange): readonly string[] {
  return c.component === 'smb'
    ? ['EAST-SMB']
    : c.component === 'erp'
      ? ['EAST-ERP', 'EAST-BACKUP-ERP']
      : c.component === 'backup'
        ? ['EAST-BACKUP-LAN']
        : [];
}
export function branchPreparationRejection(
  s: CampaignState,
  c: BranchArchitectureChange,
): string | null {
  if (!s.history.some((r) => r.recovery)) return 'Najpierw ukończ Misję 04.';
  if (
    !c ||
    !['erp', 'smb', 'backup', 'monitoring'].includes(c.component) ||
    (c.component === 'smb'
      ? !['none', 'documents', 'all'].includes(c.scope)
      : typeof c.enabled !== 'boolean')
  )
    return 'Nieprawidłowa konfiguracja oddziału.';
  if (s.preparation.hour >= 4)
    return 'Okno pracy zakończone; kontynuuj w następnym oknie.';
  if (preparationWorkerBusy(s, branchPreparationSpec(c).workerId))
    return 'Wykonawca jest zajęty wspólnym harmonogramem.';
  const architecture = s.branchArchitecture ?? defaultBranchArchitecture;
  const same =
    c.component === 'smb'
      ? architecture.smbScope === c.scope
      : architecture[
          c.component === 'erp'
            ? 'erpEnabled'
            : c.component === 'backup'
              ? 'backupPrepared'
              : 'monitoring'
        ] === c.enabled;
  const expected =
    c.component === 'smb'
      ? c.scope === 'none'
        ? 'deny'
        : 'allow'
      : c.component === 'erp'
        ? c.enabled
          ? 'allow'
          : 'deny'
        : 'allow';
  const changedRule = architectureRuleIds(c).some(
    (id) =>
      s.posture.ruleOverrides[id] !== undefined &&
      s.posture.ruleOverrides[id] !== expected,
  );
  if (same && !changedRule) return 'Ta konfiguracja jest już wdrożona.';
  if (
    s.branchWork?.some(
      (w) =>
        w.status !== 'completed' &&
        w.change.component === c.component &&
        !matches(w.change, c),
    )
  )
    return 'Najpierw dokończ rozpoczętą zmianę tego elementu.';
  return null;
}
export function beginBranchPreparation(
  s: CampaignState,
  c: BranchArchitectureChange,
): CampaignState {
  const pending = s.branchWork?.find(
      (w) => w.status === 'paused' && matches(w.change, c),
    ),
    spec = branchPreparationSpec(c);
  return {
    ...s,
    branchWork: pending
      ? s.branchWork!.map((w) =>
          w === pending
            ? {
                ...w,
                status: 'running',
                segments: [
                  ...w.segments,
                  {
                    window: s.preparation.number,
                    startHour: s.preparation.hour,
                    hoursWorked: 0,
                  },
                ],
              }
            : w,
        )
      : [
          ...(s.branchWork ?? []),
          {
            id: `EAST-W-${(s.branchWork?.length ?? 0) + 1}`,
            change: { ...c },
            workerId: spec.workerId,
            remainingHours: spec.hours,
            status: 'running',
            segments: [
              {
                window: s.preparation.number,
                startHour: s.preparation.hour,
                hoursWorked: 0,
              },
            ],
            completedWindow: null,
            completedHour: null,
          },
        ],
  };
}
export function applyArchitectureChange(
  a: BranchArchitecture,
  c: BranchArchitectureChange,
): BranchArchitecture {
  return c.component === 'smb'
    ? { ...a, smbScope: c.scope }
    : c.component === 'erp'
      ? { ...a, erpEnabled: c.enabled }
      : c.component === 'backup'
        ? { ...a, backupPrepared: c.enabled }
        : { ...a, monitoring: c.enabled };
}
/** Called by the existing hourly scheduler; exactly one hour per occupied worker. */
export function advanceBranchPreparation(s: CampaignState): CampaignState {
  if (!s.branchWork) return s;
  let architecture = s.branchArchitecture ?? defaultBranchArchitecture;
  const hour = s.preparation.hour + 1,
    ruleOverrides = { ...s.posture.ruleOverrides };
  const branchWork = s.branchWork.map((w) => {
    if (w.status !== 'running') return w;
    const remainingHours = w.remainingHours - 1;
    if (remainingHours === 0) {
      architecture = applyArchitectureChange(architecture, w.change);
      const rules = architectureRuleIds(w.change);
      for (const id of rules) delete ruleOverrides[id];
    }
    return {
      ...w,
      remainingHours,
      segments: w.segments.map((segment, i) =>
        i === w.segments.length - 1
          ? { ...segment, hoursWorked: segment.hoursWorked + 1 }
          : segment,
      ),
      status:
        remainingHours === 0
          ? ('completed' as const)
          : hour === 4
            ? ('paused' as const)
            : ('running' as const),
      completedWindow: remainingHours === 0 ? s.preparation.number : null,
      completedHour: remainingHours === 0 ? hour : null,
    };
  });
  return {
    ...s,
    branchArchitecture: architecture,
    branchWork,
    posture: { ...s.posture, ruleOverrides },
  };
}
