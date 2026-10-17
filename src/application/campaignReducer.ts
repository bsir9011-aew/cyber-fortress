import type {
  BudgetOperation,
  CampaignCommand,
  CampaignState,
  ProjectId,
} from '../domain/campaign';
import {
  securityProjects,
  projectDefinition,
  resilienceProjects,
} from '../content/securityProjects';
import { pilotEndpointCoverage } from '../content/endpointCoverage';
import { integrityScenario } from '../content/scenarios/integrity';
import { testBackupProcedure } from '../simulation/backupReadiness';
import {
  createCampaignIncident,
  createIntegrityIncident,
  createDetectionIncident,
} from './prepareCampaignIncident';
import { simulationReducer } from './simulationReducer';
import { selectMissionReport } from './selectMissionReport';

export function createCampaign(seed = 0): CampaignState {
  if (!Number.isSafeInteger(seed) || seed < 0)
    throw new Error('Invalid campaign seed');
  return {
    phase: 'preparation',
    budget: {
      total: 80000,
      ledger: [
        {
          id: 'B-0001',
          projectId: 'remote-access',
          amount: 12000,
          kind: 'prior-expense',
          stage: 'preparation',
          window: 0,
          result: 'applied',
        },
      ],
    },
    projects: securityProjects.map((p) => ({
      id: p.id,
      status: 'available',
      remaining: { ...p.hours },
    })),
    posture: {
      remoteAccess: false,
      fileVisibility: false,
      segmentation: false,
      segmentationScope: 'file-team',
      ruleOverrides: {},
      accountOverrides: {},
      assetOverrides: {},
    },
    preparation: { number: 1, hour: 0, limit: 4 },
    work: [],
    nextSeed: seed,
    incident: null,
    history: [],
    decisions: [],
  };
}
export function budgetBalance(state: CampaignState) {
  let spent = 0;
  let reserved = 0;
  for (const entry of state.budget.ledger) {
    if (entry.result !== 'applied') continue;
    if (entry.kind === 'prior-expense') spent += entry.amount;
    if (entry.kind === 'payment') {
      spent += entry.amount;
      reserved -= entry.amount;
    }
    if (entry.kind === 'reserve') reserved += entry.amount;
    if (entry.kind === 'release') reserved -= entry.amount;
  }
  return {
    total: state.budget.total,
    spent,
    reserved,
    available: state.budget.total - spent - reserved,
  };
}
function transaction(
  state: CampaignState,
  projectId: ProjectId,
  kind: BudgetOperation['kind'],
  amount: number,
  result: BudgetOperation['result'] = 'applied',
): CampaignState {
  return {
    ...state,
    budget: {
      ...state.budget,
      ledger: [
        ...state.budget.ledger,
        {
          id: `B-${String(state.budget.ledger.length + 1).padStart(4, '0')}`,
          projectId,
          amount,
          kind,
          stage: 'preparation',
          window: state.preparation.number,
          result,
        },
      ],
    },
  };
}
function decide(
  before: CampaignState,
  next: CampaignState,
  command: CampaignCommand,
  reason = '',
): CampaignState {
  return {
    ...next,
    decisions: [
      ...before.decisions,
      {
        id: `C-${String(before.decisions.length + 1).padStart(4, '0')}`,
        window: before.preparation.number,
        hour: before.preparation.hour,
        command: command.type,
        result: reason ? 'rejected' : 'applied',
        reason,
      },
    ],
  };
}
export function campaignReducer(
  state: CampaignState,
  command: CampaignCommand,
): CampaignState {
  const reject = (
    reason: string,
    financial: BudgetOperation['kind'] | null = null,
  ) =>
    decide(
      state,
      financial && 'projectId' in command
        ? transaction(
            state,
            command.projectId,
            financial,
            projectDefinition(command.projectId)?.remainingCost ?? 0,
            'rejected',
          )
        : state,
      command,
      reason,
    );
  if (command.type === 'incident-command') {
    if (state.phase !== 'incident' || !state.incident)
      return reject('Nie ma aktywnego incydentu.');
    const incident = simulationReducer(state.incident, command.command);
    const report = selectMissionReport(incident);
    const history = report
      ? [
          ...state.history,
          {
            ...(report.integrity
              ? { integrity: report.integrity.summary }
              : {}),
            number: state.history.length + 1,
            seed: state.nextSeed,
            scenarioId: report.scenario.id,
            name: report.scenario.name,
            exposedRecords: report.confidentiality.exposedRecords,
            processed: report.continuity.processed,
            backlog: report.continuity.backlog,
            containmentMet: report.integrity
              ? !report.integrity.summary.sourceHasWrite
              : report.containment.goalMet,
            spent: budgetBalance(state).spent,
            activeProjects: state.projects
              .filter((p) => p.status === 'completed')
              .map((p) => p.id),
            mfaRefusals: incident.telemetry.sourceEvents.filter(
              (e) => e.reason === 'mfa-required',
            ).length,
            fileEvidenceRecords: (
              incident.knowledge.fileObservations ?? []
            ).reduce((n, o) => n + o.records.length, 0),
            reducedCapacityTurns:
              report.legitimateActivity.reducedCapacityTurns,
            minimumCapacity: Math.min(
              ...incident.history.flatMap((e) =>
                e.kind === 'business-report' ? [e.report.capacity] : [],
              ),
            ),
            fullCapacity:
              incident.process.localCapacity +
              incident.process.remoteCapacity +
              (incident.process.additionalWork ?? []).reduce(
                (n, w) => n + w.capacity,
                0,
              ),
          },
        ]
      : state.history;
    return decide(
      state,
      { ...state, incident, phase: report ? 'report' : 'incident', history },
      command,
    );
  }
  if (command.type === 'return-headquarters') {
    if (state.phase !== 'report' || !state.incident)
      return reject('Najpierw zakończ incydent.');
    const incident = state.incident;
    const ruleOverrides = { ...state.posture.ruleOverrides };
    for (const r of incident.access.rules)
      if (
        incident.hidden.scenario.access.rules.find(
          (initial) => initial.id === r.id,
        )?.action !== r.action
      )
        ruleOverrides[r.id] = r.action;
    const accountOverrides = { ...state.posture.accountOverrides };
    for (const a of incident.access.accounts) {
      const initial = incident.hidden.scenario.access.accounts.find(
        (i) => i.id === a.id,
      );
      if (
        initial?.loginStatus !== a.loginStatus ||
        initial.credentialVersion !== a.credentialVersion
      )
        accountOverrides[a.id] = {
          loginStatus: a.loginStatus,
          credentialVersion: a.credentialVersion,
        };
    }
    const assetOverrides = { ...state.posture.assetOverrides };
    for (const a of incident.world.assets)
      if (
        incident.hidden.scenario.world.assets.find(
          (initial) => initial.id === a.id,
        )?.status !== a.status
      )
        assetOverrides[a.id] = a.status;
    return decide(
      state,
      {
        ...state,
        incident: null,
        phase: 'preparation',
        posture: {
          ...state.posture,
          ...(incident.integrity
            ? {
                endpointOverrides: {
                  ...state.posture.endpointOverrides,
                  [incident.integrity.endpoint.id]: {
                    isolated: incident.integrity.endpoint.isolated,
                    writesRestricted:
                      incident.integrity.endpoint.writesRestricted,
                  },
                },
              }
            : {}),
          ruleOverrides,
          accountOverrides,
          assetOverrides,
        },
        nextSeed: (state.nextSeed + 1) % (Number.MAX_SAFE_INTEGER - 1),
        preparation: {
          number: state.preparation.number + 1,
          hour: 0,
          limit: 4,
        },
      },
      command,
    );
  }
  if (state.phase !== 'preparation')
    return reject('Planowanie jest dostępne w centrali, poza incydentem.');
  if (command.type === 'accept-resilience-funding') {
    const report = state.history.find((r) => r.integrity !== undefined);
    if (!report)
      return reject(
        'Finansowanie Etapu II wymaga ukończenia Misji 02 i powrotu do centrali.',
      );
    if (state.funding)
      return reject('Jednorazowa transza Etapu II została już przyjęta.');
    return decide(
      state,
      {
        ...state,
        budget: { ...state.budget, total: state.budget.total + 25000 },
        funding: {
          initialAllocation: 80000,
          allocations: [
            {
              id: 'board-resilience-ii',
              source: 'integrity-risk-review',
              amount: 25000,
              window: state.preparation.number,
              reportNumber: report.number,
            },
          ],
        },
        projects: [
          ...state.projects,
          ...resilienceProjects.map((p) => ({
            id: p.id,
            status: 'available' as const,
            remaining: { ...p.hours },
          })),
        ],
      },
      command,
    );
  }
  if (
    command.type === 'start-incident' ||
    command.type === 'start-integrity-incident' ||
    command.type === 'start-detection-incident'
  ) {
    if (
      (command.type === 'start-integrity-incident' ||
        command.type === 'start-detection-incident') &&
      !state.history.some((r) => !r.integrity)
    )
      return reject('Najpierw ukończ co najmniej jeden incydent Misji 01.');
    if (
      command.type === 'start-detection-incident' &&
      command.familyId !== 'nexus-integrity-detection-v1'
    )
      return reject('Nieznana rodzina incydentu.');
    if (state.preparation.hour !== 4)
      return reject('Najpierw rozlicz czterogodzinne okno przygotowawcze.');
    return decide(
      state,
      {
        ...state,
        phase: 'incident',
        incident:
          command.type === 'start-detection-incident'
            ? createDetectionIncident(
                state.nextSeed,
                state.posture,
                command.familyId,
              )
            : command.type === 'start-integrity-incident'
              ? createIntegrityIncident(state.nextSeed, state.posture)
              : createCampaignIncident(state.nextSeed, state.posture),
      },
      command,
    );
  }
  if (command.type === 'configure-endpoint-detection') {
    const c = state.posture.endpointCoverage;
    if (
      !c ||
      !state.projects.some(
        (p) => p.id === 'endpoint-edr' && p.status === 'completed',
      )
    )
      return reject('Najpierw ukończ wdrożenie EDR.');
    if (
      command.endpointId !== c.endpointId ||
      !Number.isSafeInteger(command.threshold) ||
      command.threshold < 2 ||
      command.threshold > 30 ||
      ![5, 10, 20].includes(command.windowMinutes)
    )
      return reject(
        'Wybierz istniejący endpoint, próg 2–30 i okno 5, 10 lub 20 minut.',
      );
    if (state.preparation.hour >= 4)
      return reject('Okno przygotowania jest zamknięte.');
    if (
      state.detectionChanges?.some((w) => w.completedHour === null) ||
      state.work.some(
        (w) =>
          w.window === state.preparation.number &&
          w.workerId === 'analyst' &&
          w.status === 'running',
      )
    )
      return reject(
        'Analityk jest zajęty. Konfiguracja wymaga 1 h wolnej pracy.',
      );
    if (
      c.detection.threshold === command.threshold &&
      c.detection.windowMinutes === command.windowMinutes
    )
      return reject('Te parametry reguły są już aktywne.');
    return decide(
      state,
      {
        ...state,
        detectionChanges: [
          ...(state.detectionChanges ?? []),
          {
            id: `DE-${(state.detectionChanges?.length ?? 0) + 1}`,
            endpointId: command.endpointId,
            threshold: command.threshold,
            windowMinutes: command.windowMinutes,
            window: state.preparation.number,
            startHour: state.preparation.hour,
            completedHour: null,
          },
        ],
      },
      command,
    );
  }
  if (command.type === 'set-segmentation-scope') {
    if (state.preparation.hour === 4)
      return reject('Okno konfiguracji zakończone.');
    if (state.posture.segmentationScope === command.scope)
      return reject('Ten zakres jest już wybrany.');
    if (state.posture.segmentation) {
      if (
        state.work.some(
          (w) =>
            w.window === state.preparation.number &&
            w.workerId === 'administrator' &&
            w.status === 'running',
        )
      )
        return reject(
          'Zmiana wdrożonej polityki wymaga wolnego administratora przez 1 h.',
        );
      const advanced = campaignReducer(state, { type: 'advance-preparation' });
      return decide(
        state,
        {
          ...advanced,
          posture: { ...advanced.posture, segmentationScope: command.scope },
          work: [
            ...advanced.work,
            {
              id: `W-${String(advanced.work.length + 1).padStart(4, '0')}`,
              projectId: 'segmentation',
              workerId: 'administrator',
              window: state.preparation.number,
              startHour: state.preparation.hour,
              hoursWorked: 1,
              status: 'completed',
            },
          ],
        },
        command,
      );
    }
    return decide(
      state,
      {
        ...state,
        posture: { ...state.posture, segmentationScope: command.scope },
      },
      command,
    );
  }
  if (command.type === 'advance-preparation') {
    if (state.preparation.hour >= 4)
      return reject('Okno przygotowania jest zamknięte.');
    const hour = state.preparation.hour + 1;
    const pendingDetection = state.detectionChanges?.find(
      (w) => w.window === state.preparation.number && w.completedHour === null,
    );
    let projects = [...state.projects];
    const work = state.work.map((w) => {
      if (w.window !== state.preparation.number || w.status !== 'running')
        return w;
      projects = projects.map((p) =>
        p.id === w.projectId
          ? {
              ...p,
              remaining: {
                ...p.remaining,
                [w.workerId]: p.remaining[w.workerId] - 1,
              },
            }
          : p,
      );
      const remaining = projects.find((p) => p.id === w.projectId)!.remaining[
        w.workerId
      ];
      return {
        ...w,
        hoursWorked: w.hoursWorked + 1,
        status:
          remaining === 0
            ? ('completed' as const)
            : hour === 4
              ? ('paused' as const)
              : ('running' as const),
      };
    });
    projects = projects.map((p) =>
      p.status === 'in-progress' &&
      p.remaining.analyst === 0 &&
      p.remaining.administrator === 0
        ? { ...p, status: 'completed' as const }
        : p,
    );
    const completed = (id: ProjectId) =>
      projects.some((p) => p.id === id && p.status === 'completed');
    const newlyTestedBackup =
      completed('backup-resilience') &&
      !state.projects.some(
        (p) => p.id === 'backup-resilience' && p.status === 'completed',
      );
    const testWorld = {
      ...integrityScenario.world,
      assets: integrityScenario.world.assets.map((a) => ({
        ...a,
        status: state.posture.assetOverrides[a.id] ?? a.status,
      })),
    };
    return decide(
      state,
      {
        ...state,
        projects,
        work,
        ...(state.detectionChanges
          ? {
              detectionChanges: state.detectionChanges.map((w) =>
                w === pendingDetection ? { ...w, completedHour: hour } : w,
              ),
            }
          : {}),
        preparation: { ...state.preparation, hour },
        posture: {
          ...state.posture,
          remoteAccess: completed('remote-access'),
          fileVisibility: completed('file-visibility'),
          segmentation: completed('segmentation'),
          ...(completed('endpoint-edr')
            ? {
                endpointCoverage:
                  state.posture.endpointCoverage ?? pilotEndpointCoverage,
              }
            : {}),
          ...(pendingDetection && state.posture.endpointCoverage
            ? {
                endpointCoverage: {
                  ...state.posture.endpointCoverage,
                  detection: {
                    ...state.posture.endpointCoverage.detection,
                    counting: 'unique-documents-v2' as const,
                    name: 'Unusual Document Modification Activity',
                    threshold: pendingDetection.threshold,
                    windowMinutes: pendingDetection.windowMinutes,
                  },
                },
              }
            : {}),
          ...(newlyTestedBackup
            ? {
                backupReadiness: testBackupProcedure(
                  integrityScenario.integrity!,
                  testWorld,
                  integrityScenario.process.erpAssetId,
                  state.preparation.number,
                  hour,
                ),
              }
            : {}),
        },
      },
      command,
    );
  }
  const project = state.projects.find((p) => p.id === command.projectId);
  if (!project) return reject('Nieznany projekt.');
  const change = (next: typeof project): CampaignState => ({
    ...state,
    projects: state.projects.map((p) => (p.id === project.id ? next : p)),
  });
  if (command.type === 'plan-project') {
    if (project.status !== 'available' || state.preparation.hour === 4)
      return reject('Projekt nie jest dostępny do planowania.');
    return decide(state, change({ ...project, status: 'planned' }), command);
  }
  if (command.type === 'reserve-project') {
    if (project.status !== 'planned' || state.preparation.hour === 4)
      return reject(
        'Najpierw zaplanuj projekt; zakończonego nie kupujemy ponownie.',
        'reserve',
      );
    const cost = projectDefinition(project.id).remainingCost;
    if (budgetBalance(state).available < cost)
      return reject('Niewystarczający dostępny budżet.', 'reserve');
    return decide(
      state,
      transaction(
        change({ ...project, status: 'reserved' }),
        project.id,
        'reserve',
        cost,
      ),
      command,
    );
  }
  if (command.type === 'cancel-project') {
    if (project.status !== 'planned' && project.status !== 'reserved')
      return reject(
        'Rozpoczęta lub ukończona praca nie podlega zwrotowi.',
        'release',
      );
    const next = change({ ...project, status: 'available' });
    return decide(
      state,
      project.status === 'reserved'
        ? transaction(
            next,
            project.id,
            'release',
            projectDefinition(project.id).remainingCost,
          )
        : next,
      command,
    );
  }
  if (command.type === 'assign-work') {
    if (
      command.workerId === 'analyst' &&
      state.detectionChanges?.some((w) => w.completedHour === null)
    )
      return reject('Analityk konfiguruje regułę EDR (1 h).');
    if (
      state.preparation.hour === 4 ||
      !['reserved', 'in-progress'].includes(project.status) ||
      project.remaining[command.workerId] <= 0
    )
      return reject(
        'Brak opłaconej pracy dla tego wykonawcy w bieżącym oknie.',
      );
    if (
      state.work.some(
        (w) =>
          w.window === state.preparation.number &&
          w.workerId === command.workerId &&
          w.status === 'running',
      )
    )
      return reject('Wykonawca jest zajęty innym projektem.');
    let next = change({ ...project, status: 'in-progress' });
    if (project.status === 'reserved')
      next = transaction(
        next,
        project.id,
        'payment',
        projectDefinition(project.id).remainingCost,
      );
    return decide(
      state,
      {
        ...next,
        work: [
          ...state.work,
          {
            id: `W-${String(state.work.length + 1).padStart(4, '0')}`,
            projectId: project.id,
            workerId: command.workerId,
            window: state.preparation.number,
            startHour: state.preparation.hour,
            hoursWorked: 0,
            status: 'running',
          },
        ],
      },
      command,
    );
  }
  return reject('Nieprawidłowa komenda.');
}
