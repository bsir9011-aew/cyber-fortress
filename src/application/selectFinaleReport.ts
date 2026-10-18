import type { SimulationState } from '../domain/simulation';
import { isFinished } from '../simulation/clock';
import {
  assessErpAvailability,
  pendingErpOrderIds,
} from '../simulation/recoveryAccess';
import { assessThreatAccess } from '../simulation/threatAssessment';
import { canUseLocalService, isAssetOnline } from '../simulation/access';
import { businessAvailability } from '../simulation/business';
import { documentCounts } from '../simulation/integrity';
import { selectFinaleTimeline } from '../simulation/finaleTimeline';
export function selectFinaleReport(s: SimulationState) {
  if (!s.finale || !isFinished(s.clock)) return null;
  const i = s.integrity!,
    r = s.recovery!,
    d = s.hidden.scenario,
    erp = assessErpAvailability(s),
    a = businessAvailability(s),
    vpn = assessThreatAccess(s);
  const localThreat = !!s.hidden.integrityThreat?.compromised;
  const localWrite =
    localThreat &&
    canUseLocalService(s.world, s.access, i.endpoint, 'fs-01', 'SMB', 'modify');
  const remainingAccess =
    localWrite || (vpn.applicable && !vpn.targetAccessCutOff);
  const exposedRecords = s.hidden.attacker?.transfer.exposedRecords ?? 0;
  const documents = documentCounts(i.documents),
    pendingOrders = pendingErpOrderIds(s);
  const containmentMet = !remainingAccess;
  const integrityMet =
    documents.correct === documents.total &&
    erp.corruptRecordIds.length === 0 &&
    erp.missingRecordIds.length === 0;
  const exception = s.access.vendorAuthorization?.exception;
  const servicesMet =
    isAssetOnline(s.world, 'fs-01') &&
    a.contributions!.every(
      (c) =>
        c.available ||
        (c.id === 'cargo-link-integration' &&
          exception?.status === 'expired' &&
          exception.expiresAtMinute === 930 &&
          s.business.lastReport?.contributions?.some(
            (x) => x.id === c.id && x.available,
          )),
    );
  const continuityMet = s.business.backlog <= 40;
  const reconciliationMet = pendingOrders.length === 0 && !r.manualActive;
  const confidenceMet =
    r.verifiedRevision === r.revision &&
    (!i.recoveries.length || i.verifiedRecoveryMinute !== null);
  const securityMet = exposedRecords === 0 && containmentMet && integrityMet;
  const goalMet =
    securityMet && servicesMet && continuityMet && reconciliationMet;
  const outcome = goalMet
    ? 'full-success'
    : servicesMet && continuityMet && reconciliationMet
      ? 'operational-success-with-security-breach'
      : containmentMet && (localThreat || vpn.applicable) && !servicesMet
        ? 'contained-with-business-unavailable'
        : s.business.totalProcessed >= 180
          ? 'partial-recovery'
          : 'operational-failure';
  const completed = s.tasks.filter((t) => t.status === 'completed');
  const mfa = s.telemetry.sourceEvents.filter(
    (e) => e.reason === 'mfa-required',
  );
  const fileEvidence = (s.knowledge.fileObservations ?? []).flatMap(
    (o) => o.records,
  );
  const endpoint = s.telemetry.endpoint;
  const usedControls = [
    ...(mfa.length
      ? [
          {
            control: 'MFA',
            facts: mfa.map(
              (e) =>
                `${e.id}: ${e.accountId}, ${e.minute} — odmowa nowego uwierzytelnienia.`,
            ),
          },
        ]
      : []),
    ...(fileEvidence.length
      ? [
          {
            control: 'File Visibility',
            facts: [
              ...new Set(
                fileEvidence.map(
                  (e) => `${e.id}: ${e.operation}/${e.outcome}, ${e.minute}`,
                ),
              ),
            ],
          },
        ]
      : []),
    ...(endpoint?.alerts.length
      ? [
          {
            control: 'Endpoint EDR',
            facts: endpoint.alerts.map(
              (e) =>
                `${e.id}: sygnał z ${e.endpointId}, ${e.minute}; wymaga weryfikacji.`,
            ),
          },
        ]
      : []),
    ...(s.hidden.scenario.backupReadiness && i.recoveries.length
      ? [
          {
            control: 'Backup Resilience FS-01',
            facts: i.recoveries.map(
              (x) =>
                `${x.backupId}: faktyczne odtworzenie ${x.completedAtMinute - x.orderedAtMinute} min; nie naprawia storage ERP.`,
            ),
          },
        ]
      : []),
    ...(s.branch!.transitions.some(
      (x) => x.route === 'backup' && x.branchCapacity > 0,
    )
      ? [
          {
            control: 'Backup link EAST',
            facts: s
              .branch!.transitions.filter(
                (x) => x.route === 'backup' && x.branchCapacity > 0,
              )
              .map(
                (x) =>
                  `${x.minute}: droga HTTPS dostępna; rzeczywistą pracę określa wspólny rejestr tur.`,
              ),
          },
        ]
      : []),
    ...(s.vendor!.operations.some(
      (o) => o.protocol === 'SMB' && !o.accessChecks.exceptionAllowed,
    )
      ? [
          {
            control: 'Zakres wyjątku CARGO-LINK',
            facts: s
              .vendor!.operations.filter(
                (o) => o.protocol === 'SMB' && !o.accessChecks.exceptionAllowed,
              )
              .map(
                (o) =>
                  `${o.id}: wyjątek nie zezwalał na SMB; wynik ${o.outcome}.`,
              ),
          },
        ]
      : []),
    ...(s.vendor!.operations.some((o) => !o.accessChecks.networkAllowed)
      ? [
          {
            control: 'ACL / segmentacja VPN',
            facts: s
              .vendor!.operations.filter((o) => !o.accessChecks.networkAllowed)
              .map(
                (o) =>
                  `${o.id}: rzeczywista droga dostawcy niedozwolona przez ACL.`,
              ),
          },
        ]
      : []),
  ];
  const gaps = [
    ...(!s.telemetry.fileAudit
      ? ['Brak audytu FS-01; nie pozyskano rekordów tego sensora.']
      : []),
    ...(!endpoint ? ['Brak EDR pakowanie-03.'] : []),
    ...(!s.branch!.architecture.backupPrepared
      ? ['Nie przygotowano trasy zapasowej EAST.']
      : []),
    ...(!s.branch!.architecture.monitoring
      ? ['Brak monitoringu bramy EAST.']
      : []),
  ];
  const missingEvidence = [
    ...(!s.knowledge.authObservations.length
      ? ['Nie pobrano logów uwierzytelnienia.']
      : []),
    ...(!s.knowledge.sessionObservation
      ? ['Nie pobrano migawki sesji VPN.']
      : []),
    ...(!s.vendor!.observations.length
      ? ['Nie zbadano operacji CARGO-LINK.']
      : []),
    ...(!i.observations.length ? ['Nie porównano dokumentów z ERP.'] : []),
    ...(!i.endpointObservations.length
      ? ['Nie zbadano lokalnego dziennika pakowanie-03.']
      : []),
    ...(endpoint && !endpoint.observations.length
      ? ['Nie pobrano dostępnej telemetrii EDR.']
      : []),
    ...(s.telemetry.fileAudit && !s.knowledge.fileObservations?.length
      ? ['Nie pobrano wdrożonego audytu FS-01.']
      : []),
    ...(!r.observations.length ? ['Nie wykonano diagnostyki ERP.'] : []),
    ...(!s.branch!.observations.length ? ['Nie zbadano oddziału EAST.'] : []),
  ];
  const unusedCapabilities = [
    ...(!i.recoveries.length
      ? ['Kopie FS-01 nie zostały użyte do odtworzenia.']
      : []),
    ...(!completed.some((t) => t.action.type === 'switch-erp-standby')
      ? ['Standby ERP nie został uruchomiony.']
      : []),
    ...(!s.branch!.transitions.some((x) => x.route === 'backup')
      ? ['Nie wybrano drogi zapasowej EAST.']
      : []),
  ];
  return {
    variant: d.finale!.variant,
    outcome,
    goalMet,
    confidentialityMet: exposedRecords === 0,
    containmentMet,
    integrityMet,
    servicesMet,
    continuityMet,
    reconciliationMet,
    confidenceMet,
    exposedRecords,
    remainingAccess,
    localWrite,
    documents,
    erp,
    pendingOrders,
    manualProcessed: r.orders.filter((o) => o.fulfilledBy === 'manual').length,
    business: s.business,
    availability: a,
    observations: selectFinaleTimeline(s),
    hypotheses: s.finale.hypotheses,
    events: [
      ...s.finale.events,
      ...s.branch!.events.map((e) => ({
        minute: e.minute,
        assetId: 'east-primary-link',
        fact: e.text,
      })),
    ].sort((x, y) => x.minute - y.minute),
    tasks: s.tasks,
    usedControls,
    missingEvidence,
    serviceStatus: {
      fsOnline: isAssetOnline(s.world, 'fs-01'),
      branchRoute: s.branch!.activeRoute,
      vendorException: exception?.status ?? 'none',
    },
    gaps,
    unusedCapabilities,
    residualRisk: [
      ...(vpn.applicable &&
      vpn.stolenCredentialStillCurrent &&
      !vpn.accountContained
        ? [
            'Przejęte poświadczenie pozostaje aktualne. Ponowne udzielenie wyjątku może odtworzyć ryzyko zgodnie z MFA, sesją, ACL i nadaniami.',
          ]
        : []),
      ...(remainingAccess
        ? ['Nadal istnieje szkodliwa możliwość dostępu.']
        : []),
      ...(localThreat
        ? [
            'Kompromitacja lokalnego kontekstu pozostaje; odtworzenie nie usuwa źródła.',
          ]
        : []),
      ...(!confidenceMet
        ? [
            'Stan ERP lub odtworzonych dokumentów nie ma aktualnego potwierdzenia.',
          ]
        : []),
      ...(s.access.vendorAuthorization?.exception?.scope === 'api-and-files'
        ? [
            'Dostęp dostawcy obejmuje SMB; sam szeroki zakres nie dowodzi incydentu.',
          ]
        : []),
    ],
    operations: {
      branch: s.branch!.operations,
      vendor: s.vendor!.operations,
      vendorAccessChanges: s.vendor!.accessChanges,
      erpResults: r.results,
      primaryDataset: r.primary,
      standbyDataset: r.standby,
    },
    configuration: {
      branch: s.branch!.architecture,
      vendor: s.access.vendorAuthorization,
      accounts: s.access.accounts,
      rules: s.access.rules,
      endpointCoverage: endpoint?.coverage ?? null,
      backupReadiness: d.backupReadiness ?? null,
    },
    explanation: d.explanation,
  };
}
export type FinaleReport = NonNullable<ReturnType<typeof selectFinaleReport>>;
