import type {
  AarData,
  FortressAfterActionReportV1,
} from '../domain/afterActionReport';
const isObject = (v: AarData): v is { [key: string]: AarData } =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
/** Semantic consistency of generated facts; this is not a save importer or a signature. */
export function validateAfterActionReport(
  r: FortressAfterActionReportV1,
): { ok: true } | { ok: false; error: string } {
  const bad = () => ({
    ok: false as const,
    error: 'Niespójne fakty lub powiązania raportu.',
  });
  const b = r.businessConsequences;
  if (
    b.ordersReceived !== b.ordersProcessed + b.finalBacklog ||
    b.perTurn.length !== r.scenario.turnLimit ||
    b.ordersReceived !== b.perTurn.reduce((n, v) => n + v.received, 0) ||
    b.ordersProcessed !== b.perTurn.reduce((n, v) => n + v.processed, 0)
  )
    return bad();
  let backlog = 0;
  for (const [n, v] of b.perTurn.entries()) {
    if (
      v.turn !== n + 1 ||
      v.backlog !== backlog + v.received - v.processed ||
      v.processed > v.capacity ||
      v.processed < 0
    )
      return bad();
    backlog = v.backlog;
  }
  const documents = r.securityConsequences.integrity;
  if (
    documents &&
    (documents.correct + documents.damaged + documents.reconcile !==
      documents.total ||
      documents.recovered > documents.total ||
      documents.everDamaged > documents.total)
  )
    return bad();
  const goals = r.missionObjectives;
  if (
    !isObject(goals) ||
    typeof goals.maxFinalBacklog !== 'number' ||
    r.finalOutcome.continuityMet !== b.finalBacklog <= goals.maxFinalBacklog
  )
    return bad();
  if (r.scenario.family === 'M01' || r.scenario.family === 'M03') {
    if (
      typeof goals.maxExposedRecords !== 'number' ||
      r.finalOutcome.confidentialityMet !==
        r.securityConsequences.exposedRecords <= goals.maxExposedRecords
    )
      return bad();
    if (
      r.finalOutcome.containmentMet !==
      (goals.requireThreatContainment
        ? r.securityConsequences.containment.targetAccessCutOff
        : null)
    )
      return bad();
  } else if (r.scenario.family === 'M06') {
    const f = r.securityConsequences.campaignFinale;
    if (
      !f ||
      !isObject(f) ||
      f.goalMet !== r.finalOutcome.allObjectivesMet ||
      f.exposedRecords !== r.securityConsequences.exposedRecords ||
      r.finalOutcome.confidentialityMet !==
        (r.securityConsequences.exposedRecords === 0) ||
      !documents ||
      !f.documents ||
      !isObject(f.documents) ||
      f.documents.correct !== documents.correct ||
      f.documents.damaged !== documents.damaged ||
      f.documents.reconcile !== documents.reconcile ||
      f.confidentialityMet !== r.finalOutcome.confidentialityMet ||
      f.containmentMet !== r.finalOutcome.containmentMet ||
      f.integrityMet !== r.finalOutcome.integrityMet ||
      f.servicesMet !== r.finalOutcome.serviceRecoveryMet ||
      f.reconciliationMet !== r.finalOutcome.manualClosedMet
    )
      return bad();
    if (
      b.perTurn.some(
        (t) =>
          t.capacity > 22 ||
          t.contributions?.reduce((n, c) => n + c.capacity, 0) !== t.capacity,
      )
    )
      return bad();
  } else if (r.scenario.family === 'M05') {
    const branch = r.securityConsequences.branchAccess;
    if (
      !branch ||
      !isObject(branch) ||
      branch.goalMet !== r.finalOutcome.allObjectivesMet ||
      branch.ready !== r.finalOutcome.branchWorkMet ||
      branch.exposedRecords !== r.securityConsequences.exposedRecords ||
      r.finalOutcome.integrityMet !== null
    )
      return bad();
    if (
      r.finalOutcome.confidentialityMet !==
        (typeof branch.exposedRecords === 'number' &&
          branch.exposedRecords === 0) ||
      r.finalOutcome.containmentMet !==
        (branch.kind === 'compromised-context' ? !branch.remainingAccess : null)
    )
      return bad();
  } else if (r.scenario.family === 'M04') {
    const erp = r.securityConsequences.erpRecovery;
    if (
      !isObject(erp ?? null) ||
      r.finalOutcome.confidentialityMet !== null ||
      r.finalOutcome.containmentMet !== null
    )
      return bad();
    if (erp && isObject(erp)) {
      const data = erp.dataRecovery,
        confidence = erp.operationalConfidence,
        operations = erp.businessContinuity;
      if (
        !data ||
        !isObject(data) ||
        !confidence ||
        !isObject(confidence) ||
        !operations ||
        !isObject(operations) ||
        erp.goalMet !== r.finalOutcome.allObjectivesMet ||
        erp.useful !== r.finalOutcome.serviceRecoveryMet ||
        data.met !== r.finalOutcome.integrityMet ||
        confidence.verified !== r.finalOutcome.operationalConfidenceMet ||
        !operations.manualActive !== r.finalOutcome.manualClosedMet ||
        operations.received !== b.ordersReceived ||
        operations.processed !== b.ordersProcessed ||
        operations.backlog !== b.finalBacklog
      )
        return bad();
    }
  } else if (
    !documents ||
    r.finalOutcome.integrityMet !==
      (documents.correct === documents.total &&
        documents.verified &&
        documents.dataAvailable) ||
    r.finalOutcome.containmentMet !== !documents.sourceHasWrite
  )
    return bad();
  if (
    r.finalOutcome.allObjectivesMet !==
    [
      r.finalOutcome.confidentialityMet,
      r.finalOutcome.continuityMet,
      r.finalOutcome.containmentMet,
      r.finalOutcome.integrityMet,
      r.finalOutcome.vendorWorkMet ?? true,
      r.finalOutcome.branchWorkMet ?? true,
      r.finalOutcome.serviceRecoveryMet ?? true,
      r.finalOutcome.operationalConfidenceMet ?? true,
      r.finalOutcome.manualClosedMet ?? true,
    ].every((v) => v !== false)
  )
    return bad();
  const events = new Map(r.timeline.map((e) => [e.id, e]));
  const evidence = new Map(r.knownEvidence.map((e) => [e.id, e]));
  if (
    events.size !== r.timeline.length ||
    evidence.size !== r.knownEvidence.length ||
    new Set(r.playerDecisions.map((d) => d.id)).size !==
      r.playerDecisions.length
  )
    return bad();
  for (const e of r.knownEvidence) {
    if (
      e.obtainedAt.minute < r.scenario.startMinute ||
      e.obtainedAt.minute > r.scenario.endMinute ||
      e.obtainedByCommand > r.provenance.commandCount
    )
      return bad();
    if (isObject(e.details) && Array.isArray(e.details.records))
      for (const record of e.details.records) {
        if (!isObject(record)) return bad();
        for (const key of ['minute', 'availableAtMinute', 'deliveredAtMinute'])
          if (
            typeof record[key] === 'number' &&
            record[key] > e.obtainedAt.minute
          )
            return bad();
      }
  }
  let minute = r.scenario.startMinute;
  for (const e of r.timeline) {
    if (
      e.at.minute < minute ||
      e.at.minute > r.scenario.endMinute ||
      (e.at.turn !== null &&
        e.at.minute !==
          r.scenario.startMinute + e.at.turn * r.scenario.turnMinutes)
    )
      return bad();
    minute = e.at.minute;
    if (e.evidenceId && !evidence.has(e.evidenceId)) return bad();
    if (e.decisionId && !r.playerDecisions.some((d) => d.id === e.decisionId))
      return bad();
  }
  for (const d of r.playerDecisions) {
    if (
      d.intentRecorded !==
      (d.action.type === 'approve-emergency-vendor-access')
    )
      return bad();
    if (
      d.knownAtDecision.asOfCommand !== d.commandOrdinal ||
      d.knownAtDecision.at.minute !== d.issuedAt.minute ||
      (d.completedAt && d.completedAt.minute < d.issuedAt.minute)
    )
      return bad();
    if (
      d.status === 'rejected' &&
      (d.actualEffect !== null || d.completedAt !== null || !d.rejection)
    )
      return bad();
    if (
      d.status === 'completed' &&
      (!d.completedAt ||
        !d.taskId ||
        !r.timeline.some(
          (e) =>
            e.kind === 'task-completed' &&
            e.taskId === d.taskId &&
            e.at.minute === d.completedAt!.minute,
        ))
    )
      return bad();
    for (const id of d.knownAtDecision.evidenceIds) {
      const e = evidence.get(id);
      if (
        !e ||
        e.obtainedAt.minute > d.issuedAt.minute ||
        e.obtainedByCommand >= d.commandOrdinal
      )
        return bad();
    }
    for (const id of d.knownAtDecision.alertIds)
      if (
        !d.knownAtDecision.evidenceIds.includes(id) ||
        evidence.get(id)?.assertion !== 'signal'
      )
        return bad();
    if (
      d.actualEffect?.eventIds.some(
        (id) =>
          !events.has(id) ||
          events.get(id)!.at.minute !== d.completedAt?.minute,
      ) ||
      !events.has(d.subsequentConsequences.afterEventId) ||
      !events.has(d.subsequentConsequences.throughEventId)
    )
      return bad();
  }
  return { ok: true };
}
