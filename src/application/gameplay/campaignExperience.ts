import type {
  CampaignState,
  CampaignCommand,
  CampaignMissionReport,
} from '../../domain/campaign';
import { campaignReducer, budgetBalance } from '../campaignReducer';
import { branchPreparationSpec } from '../branchPreparation';
import { projectDefinition } from '../../content/securityProjects';
export type MissionId = 'M01' | 'M02' | 'M03' | 'M04' | 'M05' | 'M06';
export const campaignMissions: readonly {
  id: MissionId;
  name: string;
  challenge: string;
  unlock: string;
  command: CampaignCommand;
}[] = [
  {
    id: 'M01',
    name: 'The First Breach / VPN i IAM',
    challenge: 'Zbadaj dostęp zdalny i zachowaj ciągłość wysyłek.',
    unlock: 'Dostępna od początku kampanii.',
    command: { type: 'start-incident' },
  },
  {
    id: 'M02',
    name: 'Ostatnia czysta kopia / Integrity',
    challenge: 'Ustal źródło zmian i odzyskaj poprawne dokumenty.',
    unlock: 'Ukończ dowolną M01.',
    command: { type: 'start-integrity-incident' },
  },
  {
    id: 'M03',
    name: 'Dostawca na godzinę',
    challenge: 'Dobierz zakres i czas dostępu CARGO-LINK.',
    unlock: 'Ukończ dowolną M02.',
    command: {
      type: 'start-vendor-incident',
      familyId: 'nexus-vendor-access-v1',
    },
  },
  {
    id: 'M04',
    name: 'ERP nie odpowiada / Blackout Protocol',
    challenge: 'Przywróć usługę, dane i zgodność wysyłek.',
    unlock: 'Ukończ dowolną M03.',
    command: {
      type: 'start-recovery-incident',
      familyId: 'nexus-erp-recovery-v1',
    },
  },
  {
    id: 'M05',
    name: 'Oddział na granicy / The New Branch',
    challenge: 'Pogódź łączność EAST z dostępem do zasobów.',
    unlock: 'Ukończ dowolną M04.',
    command: {
      type: 'start-branch-incident',
      familyId: 'nexus-east-branch-v1',
    },
  },
  {
    id: 'M06',
    name: 'Kryzys w NEXUS / The Perfect Storm',
    challenge: 'Zarządzaj jednym złożonym kryzysem i wspólną kolejką zamówień.',
    unlock: 'Ukończ dowolną M05.',
    command: {
      type: 'start-finale-incident',
      familyId: 'nexus-campaign-finale-v1',
    },
  },
];
export function missionFamily(r: CampaignMissionReport): MissionId {
  return r.finale
    ? 'M06'
    : r.branch
      ? 'M05'
      : r.recovery
        ? 'M04'
        : r.vendor
          ? 'M03'
          : r.integrity
            ? 'M02'
            : 'M01';
}
/** Mirrors only public progression gates; all commands still pass through the existing reducer. */
export function selectCampaignCommand(s: CampaignState) {
  const unlocked = [
    true,
    s.history.some((r) => !r.integrity),
    s.history.some((r) => r.integrity),
    s.history.some((r) => r.vendor),
    s.history.some((r) => r.recovery),
    s.history.some((r) => r.branch),
  ];
  return campaignMissions.map((m, n) => {
    const attempts = s.history.filter((r) => missionFamily(r) === m.id);
    return {
      ...m,
      attempts: attempts.length,
      last: attempts.at(-1) ?? null,
      status: attempts.length
        ? 'completed'
        : unlocked[n]
          ? 'available'
          : 'locked',
      reason: !unlocked[n]
        ? m.unlock
        : s.phase !== 'preparation'
          ? 'Wróć do Centrali po zakończeniu operacji.'
          : s.preparation.hour !== 4
            ? `Rozlicz jeszcze ${4 - s.preparation.hour} h obowiązkowego okna przygotowania.`
            : null,
    };
  });
}
/** A discarded pure reducer result supplies the actual validation/cost, never a journal entry in the player's game. Start/incident commands are deliberately excluded. */
export function preparationPreview(s: CampaignState, c: CampaignCommand) {
  if (
    c.type.startsWith('start-') ||
    c.type === 'incident-command' ||
    c.type === 'return-headquarters'
  )
    throw new Error('Not a preparation preview');
  const next = campaignReducer(s, c),
    decision = next.decisions.at(-1),
    before = budgetBalance(s),
    after = budgetBalance(next);
  let worker: string | null = null,
    hours = 0;
  if (c.type === 'assign-work') {
    worker = c.workerId;
    hours =
      s.projects.find((p) => p.id === c.projectId)?.remaining[c.workerId] ?? 0;
  }
  if (c.type === 'prepare-branch-architecture') {
    const spec = branchPreparationSpec(c.change);
    worker = spec.workerId;
    hours =
      next.branchWork?.find(
        (w) =>
          w.status === 'running' && w.change.component === c.change.component,
      )?.remainingHours ?? spec.hours;
  }
  if (c.type === 'prepare-vendor-exception') {
    worker = 'administrator';
    hours = 1;
  }
  if (c.type === 'configure-endpoint-detection') {
    worker = 'analyst';
    hours = 1;
  }
  if (c.type === 'set-segmentation-scope' && s.posture.segmentation) {
    worker = 'administrator';
    hours = 1;
  }
  return {
    reason: decision?.result === 'rejected' ? decision.reason : null,
    worker,
    hours,
    payment: Math.max(0, after.spent - before.spent),
    reservation: Math.max(0, after.reserved - before.reserved),
    inWindow: s.preparation.hour + hours <= 4,
  };
}
export function preparationTeam(s: CampaignState) {
  return (['administrator', 'analyst'] as const).map((worker) => {
    const project = s.work.find(
      (w) =>
        w.window === s.preparation.number &&
        w.workerId === worker &&
        w.status === 'running',
    );
    const branch = s.branchWork?.find(
      (w) => w.workerId === worker && w.status === 'running',
    );
    const vendor =
      worker === 'administrator'
        ? s.vendorApprovals?.find((w) => w.completedHour === null)
        : undefined;
    const detection =
      worker === 'analyst'
        ? s.detectionChanges?.find((w) => w.completedHour === null)
        : undefined;
    const hours =
      branch?.remainingHours ??
      (vendor || detection
        ? 1
        : project
          ? s.projects.find((p) => p.id === project.projectId)!.remaining[
              worker
            ]
          : 0);
    return {
      worker,
      name: branch
        ? `EAST / ${branch.change.component}`
        : vendor
          ? 'Wyjątek CARGO-LINK'
          : detection
            ? 'Konfiguracja EDR'
            : project
              ? projectDefinition(project.projectId).name
              : 'Wolny',
      hours,
      finishesNext: hours === 1,
      continues: hours > 4 - s.preparation.hour,
    };
  });
}
