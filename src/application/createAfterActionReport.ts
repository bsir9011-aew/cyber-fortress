import { MAX_AAR_BYTES } from '../domain/afterActionReport';
import type {
  AarCampaignContext,
  FortressAfterActionReportV1,
} from '../domain/afterActionReport';
import type { GameSession } from './gameSession';
import type { CampaignState } from '../domain/campaign';
import {
  createCampaign,
  campaignReducer,
  budgetBalance,
} from './campaignReducer';
import { createScenarioRun } from './scenarioSelectors';
import { simulationReducer } from './simulationReducer';
import { selectMissionReport } from './selectMissionReport';
import { projectDefinition } from '../content/securityProjects';
import { validateGameSession, MAX_GAME_BYTES } from '../persistence/gameSave';
import {
  isCurrentCampaignCommand,
  isCurrentRecordedCommand,
} from '../persistence/gameSaveV7';
import { sameJson, timestamp } from '../persistence/saveFormat';
import { MissionTrace } from './aar/missionTrace';
import { actualState, facts, timeAt } from './aar/facts';
import { validateAfterActionReport } from './validateAfterActionReport';

export type AarResult =
  | { readonly ok: true; readonly value: FortressAfterActionReportV1 }
  | {
      readonly ok: false;
      readonly code:
        | 'not-finished'
        | 'missing-history'
        | 'inconsistent-history'
        | 'report-too-large'
        | 'invalid-request';
      readonly error: string;
    };
const errors = {
  'not-finished':
    'Raport AAR jest dostępny dopiero po zakończeniu 18. tury wybranej misji.',
  'missing-history':
    'Brakuje pełnej chronologii wymaganej do raportu szczegółowego. Same wyniki nie pozwalają odtworzyć decyzji i wiedzy.',
  'inconsistent-history':
    'Dziennik i stan gry są niespójne. Nie wygenerowano raportu AAR.',
  'report-too-large':
    'Raport przekracza limit 2 MiB lub 256 decyzji. Nie wygenerowano niepełnego raportu.',
  'invalid-request':
    'Nieprawidłowy identyfikator misji lub data wygenerowania raportu.',
};
const fail = (code: keyof typeof errors): AarResult => ({
  ok: false,
  code,
  error: errors[code],
});
export const campaignAarMissionId = (attemptId: string, number: number) =>
  `${attemptId}-M${number}`;
/** Cheap public gate for UI. The generator independently verifies completion through replay. */
export function canCreateAfterActionReport(
  game: GameSession,
  missionId?: string,
): boolean {
  if (game.kind === 'incident')
    return (
      (!missionId || missionId === game.operation.attemptId) &&
      game.operation.simulation.clock.turn === 18 &&
      game.operation.simulation.clock.turnLimit === 18
    );
  const id = missionId ?? game.missionMetadata?.attemptId;
  return game.campaign.history.some(
    (r) => campaignAarMissionId(game.attemptId, r.number) === id,
  );
}
function campaignContext(s: CampaignState): AarCampaignContext {
  return {
    missionNumber: s.history.length + 1,
    preparationWindow: s.preparation.number,
    budgetAtStart: budgetBalance(s),
    funding: s.funding ?? null,
    projects: s.projects.map((p) => {
      const d = projectDefinition(p.id);
      return {
        ...p,
        name: d.name,
        costPLN: d.totalCost,
        mechanism: d.effect,
        limitation: d.limitation,
      };
    }),
    work: s.work,
    investmentLedger: s.budget.ledger,
    posture: s.posture,
    ...(s.vendorApprovals ? { vendorApprovals: s.vendorApprovals } : {}),
    ...(s.detectionChanges ? { detectionChanges: s.detectionChanges } : {}),
  };
}
/** No wall-clock access, I/O, scoring or alternate simulation. All metadata is explicit. */
export function createAfterActionReport(
  game: GameSession,
  missionId: string | undefined,
  generatedAt: string,
): AarResult {
  try {
    if (
      !timestamp(generatedAt) ||
      (missionId !== undefined &&
        (typeof missionId !== 'string' || missionId.length > 128))
    )
      return fail('invalid-request');
    if (!canCreateAfterActionReport(game, missionId)) {
      if (
        game.kind === 'incident' &&
        (!missionId || missionId === game.operation.attemptId)
      )
        return fail('not-finished');
      if (
        game.kind === 'campaign' &&
        (!missionId || missionId === game.missionMetadata?.attemptId)
      )
        return fail('not-finished');
      return fail('missing-history');
    }
    const journal =
      game.kind === 'incident' ? game.operation.commands : game.commands;
    if (!Array.isArray(journal) || journal.length === 0)
      return fail('missing-history');
    const input = JSON.stringify(game);
    if (
      input.length > MAX_GAME_BYTES ||
      new TextEncoder().encode(input).byteLength > MAX_GAME_BYTES
    )
      return fail('report-too-large');
    // The envelope's savedAt is not part of GameSession. Validate its internal
    // timestamps without making world facts depend on the exporter's wall clock.
    const sourceDates =
      game.kind === 'incident'
        ? [game.operation.createdAt, game.operation.completedAt]
        : [
            game.createdAt,
            game.missionMetadata?.createdAt,
            game.missionMetadata?.completedAt,
          ];
    const validationDate = [generatedAt, ...sourceDates]
      .filter(timestamp)
      .sort()
      .at(-1)!;
    if (
      !validateGameSession(
        game,
        validationDate,
        isCurrentCampaignCommand,
        isCurrentRecordedCommand,
      )
    )
      return fail('inconsistent-history');
    let trace: MissionTrace | null = null;
    let context: AarCampaignContext | null = null;
    let id = missionId;
    if (game.kind === 'incident') {
      id = game.operation.attemptId;
      let state = createScenarioRun(
        game.operation.simulation.run.mode,
        game.operation.simulation.run.seed,
      );
      trace = new MissionTrace(state);
      for (const command of game.operation.commands) {
        const next = simulationReducer(state, command);
        trace.record(command, state, next);
        state = next;
      }
      if (!sameJson(state, game.operation.simulation))
        return fail('inconsistent-history');
    } else {
      id = missionId ?? game.missionMetadata?.attemptId;
      let campaign = createCampaign(game.initialSeed);
      let recording = false;
      for (const command of game.commands) {
        const next = campaignReducer(campaign, command);
        if (
          campaign.phase === 'preparation' &&
          next.phase === 'incident' &&
          campaignAarMissionId(game.attemptId, campaign.preparation.number) ===
            id
        ) {
          trace = new MissionTrace(next.incident!);
          context = campaignContext(campaign);
          recording = true;
        } else if (
          recording &&
          trace &&
          campaign.phase === 'incident' &&
          command.type === 'incident-command'
        ) {
          trace.record(command.command, campaign.incident!, next.incident!);
          if (next.phase === 'report') recording = false;
        }
        campaign = next;
      }
      if (!sameJson(campaign, game.campaign))
        return fail('inconsistent-history');
    }
    if (!trace || !id) return fail('missing-history');
    const s = trace.state,
      report = selectMissionReport(s);
    if (!report || s.clock.turn !== 18 || s.clock.turnLimit !== 18)
      return fail('not-finished');
    const integrity = report.integrity;
    const recovery = report.recovery;
    const detectionEngineering =
      s.telemetry.endpoint?.coverage.detection.counting ===
        'unique-documents-v2' ||
      (context?.detectionChanges?.length ?? 0) > 0 ||
      s.hidden.scenario.familyId === 'nexus-integrity-detection-v1';
    const perTurn = s.history.flatMap((e) =>
      e.kind === 'business-report' ? [e.report] : [],
    );
    const aar: FortressAfterActionReportV1 = {
      format: 'FORTRESS_AAR',
      schemaVersion: 1,
      reportId: `AAR-${id}`,
      missionId: id,
      generatedAt,
      gameVersion: {
        application: '0.2.0',
        engine: recovery
          ? '13.0.0'
          : s.vendor
            ? '12.0.0'
            : detectionEngineering
              ? '11.0.0'
              : '9.0.0',
        reportGenerator: recovery
          ? '1.3.0'
          : s.vendor
            ? '1.2.0'
            : detectionEngineering
              ? '1.1.0'
              : '1.0.0',
      },
      fieldGuide: {
        format:
          'Raport analityczny, nie zapis gry. Brak importu do symulatora.',
        time: 'minute: liczba minut od północy fikcyjnego dnia, np. 840 = 14:00. turn: granica tury 0–18, null dla zdarzeń poza granicą lub przed oknem. generatedAt: rzeczywisty UTC ISO 8601.',
        units:
          'Zamówienia i dokumenty to liczby sztuk. exposedRecords to rekordy danych, nie dokumenty. Budżet w PLN. Praca przygotowawcza w godzinach; RPO/RTO i czasy misji w minutach.',
        knownAtDecision:
          'Informacje dostępne w UI przed komendą, nie potwierdzenie, że człowiek je przeczytał. evidenceIds wskazują wyłącznie już pozyskane wpisy knownEvidence. Konfiguracja nie zawiera prywatnych wersji poświadczeń ani pochodzenia sesji.',
        sessions:
          'knownSessionIds to ID dostępne w narzędziach z pozyskanych logów, audytu i migawki bramy. sessions to wyłącznie ostatnia migawka bramy (null = nie pobrano). Żadne historyczne ID nie gwarantuje aktualności tunelu.',
        actualStateAtDecision:
          'Prawda symulacji przed komendą, ujawniona dopiero w tym raporcie po zakończeniu misji.',
        capabilities:
          'threatAccess i serviceAccess to czysta ocena istniejących predykatów w danej chwili, nie nowe próby logowania lub transferu. availability to bieżąca możliwa wydajność; perTurn rozlicza poprzedni przedział. Końcowe zdarzenie silnika businessGoalMet dotyczy tylko celu biznesowego.',
        actualEffect:
          'immediateAccessImpact pochodzi z istniejącego śladu before/after efektu zadania. boundaryState obejmuje CAŁĄ granicę zakończenia, również inne zadania i działania aktorów. Nie przypisuj całej zmiany jednej decyzji.',
        subsequentConsequences:
          'Zakres osi czasu po wydaniu decyzji, obejmujący także inne przyczyny. To sekwencja zdarzeń, nie eksperyment kontrfaktyczny ani automatyczne przypisanie przyczynowości.',
        intent:
          'expectedEffect=null i intentRecorded=false: gra nie rejestrowała uzasadnienia. Hipotezy są deklaracjami gracza. Nie da się ustalić zamierzonych i niezamierzonych skutków z samego wyniku.',
        telemetry:
          'sensor-record-eligible to zarejestrowany czas gotowości rekordu, nie wiedza gracza. evidence-obtained oznacza ukończone badanie lub informację udostępnioną w UI. Obowiązuje dostępność źródła.',
        objectives:
          'Cele mają osobne wyniki. allObjectivesMet nie jest oceną jakości rozumowania ani człowieka.',
      },
      organization: { name: 'NEXUS Logistics', employees: 120, computers: 94 },
      scenario: {
        id: report.scenario.id,
        ...(s.hidden.scenario.familyId
          ? { variantFamilyId: s.hidden.scenario.familyId }
          : {}),
        family: recovery ? 'M04' : s.vendor ? 'M03' : integrity ? 'M02' : 'M01',
        name: report.scenario.name,
        kind: report.scenario.kind,
        mode: s.run.mode,
        seed: s.run.seed,
        startMinute: s.clock.startMinute,
        endMinute:
          s.clock.startMinute + s.clock.turnLimit * s.clock.turnMinutes,
        turnMinutes: s.clock.turnMinutes,
        turnLimit: s.clock.turnLimit,
      },
      campaignContext: context,
      missionObjectives: facts({
        ...(recovery
          ? {
              rtoTargetMinutes: s.hidden.scenario.recovery!.rtoMinutes,
              rpoTargetMinutes: s.hidden.scenario.recovery!.rpoMinutes,
              verifiedRecoveryRequired: true,
              manualReconciliationRequired: true,
            }
          : {}),
        maxExposedRecords:
          recovery || integrity
            ? null
            : s.hidden.scenario.goals.maxExposedRecords,
        maxFinalBacklog: s.process.maxFinalBacklog,
        ...(s.vendor
          ? { requiredVendorBatches: s.hidden.scenario.vendor!.requiredBatches }
          : {}),
        requireThreatContainment:
          !recovery &&
          !integrity &&
          s.hidden.scenario.goals.requireThreatContainment,
        ...(integrity
          ? {
              correctDocuments: 100,
              verifiedRecoveryRequired: true,
              sourceWriteRestrictedRequired: true,
            }
          : {}),
      }),
      finalOutcome: {
        ...(recovery
          ? {
              serviceRecoveryMet: recovery.useful,
              operationalConfidenceMet: recovery.operationalConfidence.verified,
              manualClosedMet: !recovery.businessContinuity.manualActive,
            }
          : {}),
        ...(report.vendor
          ? {
              vendorWorkMet:
                report.vendor.summary.completedBatches ===
                report.vendor.summary.requiredBatches,
            }
          : {}),
        confidentialityMet:
          recovery || integrity ? null : report.confidentiality.goalMet,
        continuityMet: report.continuity.goalMet,
        containmentMet: integrity
          ? !integrity.summary.sourceHasWrite
          : report.containment.goalMet,
        integrityMet: recovery
          ? recovery.dataRecovery.met
          : integrity
            ? integrity.summary.correct === integrity.summary.total &&
              integrity.summary.verified &&
              integrity.summary.dataAvailable
            : null,
        allObjectivesMet: recovery
          ? recovery.goalMet
          : report.vendor
            ? report.vendor.goalMet
            : integrity
              ? integrity.goalMet
              : report.confidentiality.goalMet &&
                report.continuity.goalMet &&
                report.containment.goalMet !== false,
      },
      ...trace.finish(),
      groundTruth: {
        explanation: report.scenario.explanation,
        initialState: actualState(trace.initial),
        finalState: actualState(s),
        authentication: facts(s.telemetry.sourceEvents),
        vpnThreat: s.hidden.attacker
          ? facts({
              accountId: s.hidden.attacker.definition.accountId,
              stolenCredentialVersion:
                s.hidden.attacker.definition.stolenCredentialVersion,
              gatewayAssetId: s.hidden.attacker.definition.knownGatewayAssetId,
              targetAssetId: s.hidden.attacker.definition.targetAssetId,
              protocol: s.hidden.attacker.definition.protocol,
              finalStatus: s.hidden.attacker.status,
              authenticationAttempts: s.hidden.attacker.authenticationAttempts,
              consecutiveFailures: s.hidden.attacker.consecutiveFailures,
            })
          : null,
        vpnAttackerActivity: facts(s.hidden.attacker?.privateHistory ?? []),
        localOperations: facts(s.integrity?.operationRecords ?? []),
        localThreatAttempts: facts(s.hidden.integrityThreat?.history ?? []),
        telemetry: facts({
          authenticationSensor: s.telemetry.authenticationSensor,
          authenticationRecords: s.telemetry.authenticationRecords,
          fileAudit: s.telemetry.fileAudit ?? null,
          endpoint: s.telemetry.endpoint ?? null,
        }),
        backups: facts(
          recovery
            ? {
                snapshots: s.hidden.scenario.recovery!.backups,
                standby: s.hidden.scenario.recovery!.standby,
              }
            : s.hidden.scenario.integrity
              ? {
                  snapshots: s.hidden.scenario.integrity.backups,
                  verification: s.integrity?.backups,
                  readiness: s.hidden.scenario.backupReadiness ?? null,
                  recoveries: s.integrity?.recoveries,
                  reconciledIds: s.integrity?.reconciledIds,
                }
              : null,
        ),
      },
      securityConsequences: {
        ...(recovery ? { erpRecovery: facts(recovery) } : {}),
        exposedRecords: report.confidentiality.exposedRecords,
        containment: report.containment,
        integrity: integrity?.summary ?? null,
        ...(detectionEngineering && integrity
          ? { detectionReview: facts(integrity.detectionReview) }
          : {}),
        ...(report.vendor ? { vendorAccess: facts(report.vendor) } : {}),
        investmentUse: facts(
          integrity?.investments ?? {
            mfaRefusals: s.telemetry.sourceEvents.filter(
              (e) => e.reason === 'mfa-required',
            ).length,
            fileObservationCount: s.knowledge.fileObservations?.length ?? 0,
          },
        ),
      },
      businessConsequences: {
        ordersReceived: s.business.totalReceived,
        ordersProcessed: s.business.totalProcessed,
        finalBacklog: s.business.backlog,
        peakBacklog: Math.max(0, ...perTurn.map((r) => r.backlog)),
        perTurn,
        capacityTransitions: perTurn.flatMap((r, n) =>
          n === 0 || r.capacity !== perTurn[n - 1]!.capacity
            ? [
                {
                  at: timeAt(
                    s,
                    s.clock.startMinute + r.turn * s.clock.turnMinutes,
                  ),
                  intervalStartMinute:
                    s.clock.startMinute + (r.turn - 1) * s.clock.turnMinutes,
                  previousCapacity: n === 0 ? null : perTurn[n - 1]!.capacity,
                  capacity: r.capacity,
                },
              ]
            : [],
        ),
      },
      lessonsContext: {
        hypothesesAreUnverified: true,
        reasoningQuestions: [
          'Jakie dowody były dostępne przed każdą decyzją, a jakie dotarły później?',
          'Które mechanizmy zmieniło działanie, a które pozostały aktywne?',
          'Jak ograniczenie bezpieczeństwa wpłynęło na legalną pracę?',
          'Jak sprawdzono wynik odzyskiwania i trwałość ograniczenia?',
          'Jakich danych lub kontrolowanego replay potrzeba do porównania alternatywy?',
        ],
        replay: facts({
          mode: s.run.mode,
          seed: s.run.seed,
          scenarioId: report.scenario.id,
          requiresCampaignPreparation: context !== null,
          campaignMissionId: context ? id : null,
          warning:
            'Ponowienie z innymi decyzjami jest nowym przebiegiem. Hipotetyczny wynik nie jest faktem tego raportu.',
        }),
      },
      limitations: [
        'Raport zawiera fikcyjną prywatną prawdę scenariusza; jest dostępny tylko po zakończeniu misji.',
        'Nie ma kryptograficznej autentyczności lokalnego raportu. Zmieniony plik może przedstawiać inne dane.',
        'MFA jest przygotowaniem przed misją, bez komendy zmiany MFA w środku incydentu. Nie oznacza automatycznego zakończenia wydanych sesji.',
        'Nie zarejestrowano toku myślenia, uzasadnień ani informacji faktycznie przeczytanych przez człowieka. Hipoteza nie jest zweryfikowanym faktem.',
        'Chronologia odtwarza zarejestrowane granice tur; nie zna czasu ściennego kliknięć ani kolejności fizycznej między niezależnymi źródłami w tej samej fazie.',
        'Skutki wspólnej granicy tury nie stanowią izolowanego eksperymentu. Nie obliczamy nieprzeprowadzonych alternatyw ani pieniężnych strat zamówień.',
        'Historyczne podsumowanie bez dziennika nie wystarcza do rekonstrukcji AAR. Raporty nie zastępują zapisu gry.',
        'Brak sensora, opóźnienie, retencja i odcięcie dostarczania mogą ograniczyć dowody; nie dowodzą braku aktywności.',
      ],
      provenance: {
        method: 'validated-command-replay',
        commandCount: trace.ordinal,
        ordering:
          'Czas świata, kolejność komend w tej samej minucie, faza istniejącego silnika i kolejność źródła. Fazy: rozliczenie starego przedziału, ukończenie zadań/konfiguracja, aktorzy, sensory, badania. Prelude sprzed okna jest w groundTruth, nie na osi czasu.',
        sourceMap: {
          timeline:
            'SimulationState.history + istniejące źródła/rekordy telemetryczne i prywatne ślady aktorów; bez DOM.',
          knownEvidence:
            'Ukończone obserwacje i komunikaty zbierane podczas replay; nigdy końcowa wiedza nakładana wstecz.',
          actualState:
            'Istniejące assessThreatAccess, canUseService, canUseLocalService, businessAvailability i documentCounts.',
          campaignContext:
            'Pełny replay kampanii od initialSeed, stan przygotowania w chwili właściwego startu misji.',
        },
      },
    };
    const check = validateAfterActionReport(aar);
    if (!check.ok) return fail('inconsistent-history');
    if (
      new TextEncoder().encode(JSON.stringify(aar)).byteLength > MAX_AAR_BYTES
    )
      return fail('report-too-large');
    return { ok: true, value: structuredClone(aar) };
  } catch (e) {
    return fail(
      e instanceof Error && e.message === 'AAR_LIMIT'
        ? 'report-too-large'
        : 'inconsistent-history',
    );
  }
}
