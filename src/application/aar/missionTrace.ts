import { MAX_AAR_DECISIONS } from '../../domain/afterActionReport';
import type {
  AarDecision,
  AarEvidence,
  AarTimelineEntry,
} from '../../domain/afterActionReport';
import type { SimulationState } from '../../domain/simulation';
import type { RecordedCommand } from '../operationSession';
import {
  actualState,
  actionTarget,
  facts,
  knownAtDecision,
  timeAt,
  immediateImpact,
} from './facts';

type Phase = AarTimelineEntry['phase'];
/** Keeps projections only; no SimulationState archive for individual turns. */
export class MissionTrace {
  readonly timeline: AarTimelineEntry[] = [];
  readonly evidence: AarEvidence[] = [];
  readonly decisions: AarDecision[] = [];
  readonly seen = new Set<string>();
  ordinal = 0;
  state: SimulationState;
  constructor(readonly initial: SimulationState) {
    this.state = initial;
    this.emit('mission-start', initial, 'initial', 'scenario', 'started', null);
    this.collect(initial);
  }
  emit(
    kind: string,
    state: SimulationState,
    phase: Phase,
    source: string,
    status: string,
    details: unknown,
    links: {
      taskId?: string | null;
      decisionId?: string | null;
      evidenceId?: string | null;
    } = {},
    minute?: number,
  ) {
    const id = `TL-${String(this.timeline.length + 1).padStart(5, '0')}`;
    const taskDecision = links.taskId
      ? this.decisions.find((d) => d.taskId === links.taskId)
      : undefined;
    this.timeline.push({
      id,
      at: timeAt(state, minute),
      phase,
      kind,
      source,
      status,
      commandOrdinal: this.ordinal || null,
      decisionId: links.decisionId ?? taskDecision?.id ?? null,
      taskId: links.taskId ?? null,
      evidenceId: links.evidenceId ?? null,
      details: facts(details),
    });
    return id;
  }
  once(key: string, fn: () => void) {
    if (!this.seen.has(key)) {
      this.seen.add(key);
      fn();
    }
  }
  addEvidence(
    state: SimulationState,
    key: string,
    kind: string,
    source: string,
    details: unknown,
    assertion: AarEvidence['assertion'],
    taskId: string | null = null,
  ) {
    this.once(`evidence:${key}`, () => {
      const id = `K-${key}`;
      this.evidence.push({
        id,
        kind,
        source,
        obtainedAt: timeAt(state),
        obtainedByCommand: this.ordinal,
        taskId,
        assertion,
        details: facts(details),
      });
      this.emit(
        'evidence-obtained',
        state,
        'observation',
        source,
        'available-to-player',
        { kind, assertion },
        { evidenceId: id, taskId },
      );
    });
  }
  collect(s: SimulationState) {
    const inWindow = (minute: number) =>
      minute >= s.clock.startMinute &&
      minute <= s.clock.startMinute + s.clock.turnLimit * s.clock.turnMinutes;
    for (const e of s.history)
      this.once(`history:${e.id}`, () => {
        const task = 'task' in e ? e.task : null;
        const phase: Phase =
          e.kind === 'business-report'
            ? 'interval-settlement'
            : e.kind === 'simulation-finished'
              ? 'finish'
              : e.kind === 'task-started'
                ? 'command'
                : task
                  ? 'task-completion'
                  : 'observation';
        this.emit(
          e.kind === 'configuration-changed'
            ? 'configuration-effective'
            : e.kind,
          s,
          phase,
          'engine.history',
          e.kind === 'command-rejected'
            ? 'rejected'
            : e.kind === 'task-started'
              ? 'running'
              : e.kind === 'task-completed'
                ? 'completed'
                : e.kind === 'configuration-changed'
                  ? 'applied'
                  : 'recorded',
          e.kind === 'simulation-finished'
            ? { sourceEventId: e.id, businessGoalMet: e.success }
            : e,
          {
            taskId: task?.id ?? null,
            decisionId:
              e.kind === 'command-rejected'
                ? (this.decisions.find((d) => d.commandOrdinal === this.ordinal)
                    ?.id ?? null)
                : null,
          },
          e.minute,
        );
      });
    for (const e of s.telemetry.sourceEvents)
      this.once(`auth:${e.id}`, () => {
        if (inWindow(e.minute))
          this.emit(
            'authentication',
            s,
            'actor-resolution',
            'authentication-service',
            e.outcome,
            e,
            {},
            e.minute,
          );
      });
    for (const e of s.hidden.attacker?.privateHistory ?? [])
      this.once(`attacker:${e.id}`, () =>
        this.emit(
          'vpn-actor-action',
          s,
          'actor-resolution',
          'private-attack-history',
          e.outcome,
          e,
          {},
          e.minute,
        ),
      );
    for (const [index, e] of (s.integrity?.operationRecords ?? []).entries())
      this.once(`local:${index}`, () => {
        if (inWindow(e.minute))
          this.emit(
            'local-file-operation',
            s,
            e.operation === 'read' ? 'interval-settlement' : 'actor-resolution',
            'local-operation-resolver',
            e.outcome,
            { ...e, sourceSequence: index + 1 },
            {},
            e.minute,
          );
      });
    for (const [index, e] of (
      s.hidden.integrityThreat?.history ?? []
    ).entries())
      this.once(`local-threat:${index}`, () =>
        this.emit(
          'local-threat-attempt',
          s,
          'actor-resolution',
          'private-integrity-history',
          e.outcome,
          { ...e, timeBasis: 'derived-from-recorded-turn-and-mission-clock' },
          {},
          s.clock.startMinute + e.turn * s.clock.turnMinutes,
        ),
      );
    const record = (
      key: string,
      e: {
        minute: number;
        capturedAtMinute: number;
        availableAtMinute: number;
      },
      source: string,
      taskId: string | null = null,
    ) => {
      this.once(`${key}:captured`, () => {
        if (inWindow(e.capturedAtMinute))
          this.emit(
            'sensor-captured',
            s,
            'telemetry',
            source,
            'captured',
            e,
            { taskId },
            e.capturedAtMinute,
          );
      });
      this.once(`${key}:available`, () => {
        if (inWindow(e.availableAtMinute))
          this.emit(
            'sensor-record-eligible',
            s,
            'telemetry',
            source,
            'eligible-not-player-observation',
            {
              recordId: key,
              operationMinute: e.minute,
              availableAtMinute: e.availableAtMinute,
            },
            { taskId },
            e.availableAtMinute,
          );
      });
    };
    for (const r of s.telemetry.authenticationRecords)
      record(`AUTH:${r.id}`, r, 'authentication-sensor');
    for (const r of s.telemetry.fileAudit?.records ?? [])
      record(`FILE:${r.id}`, r, 'file-audit-sensor');
    for (const r of s.telemetry.endpoint?.localEvents ?? [])
      this.once(`edr-local:${r.id}`, () => {
        if (inWindow(r.capturedAtMinute))
          this.emit(
            'endpoint-agent-captured',
            s,
            'telemetry',
            'fortress-endpoint-agent',
            'local-buffer',
            r,
            {},
            r.capturedAtMinute,
          );
      });
    for (const r of s.telemetry.endpoint?.records ?? []) {
      record(`EDR:${r.id}`, r, 'endpoint-collector');
      this.once(`edr-delivered:${r.id}`, () => {
        if (inWindow(r.deliveredAtMinute))
          this.emit(
            'endpoint-record-delivered',
            s,
            'telemetry',
            'endpoint-collector',
            'delivered',
            r,
            {},
            r.deliveredAtMinute,
          );
      });
    }
    for (const operation of s.vendor?.operations ?? [])
      this.once(`vendor-operation:${operation.id}`, () =>
        this.emit(
          'vendor-operation',
          s,
          operation.origin === 'legitimate'
            ? 'interval-settlement'
            : 'actor-resolution',
          operation.source,
          operation.outcome,
          operation,
          {},
          operation.minute,
        ),
      );
    for (const change of s.vendor?.accessChanges ?? [])
      this.once(`vendor-change:${change.kind}:${change.minute}`, () =>
        this.emit(
          'vendor-authorization-changed',
          s,
          'task-completion',
          'vendor-authorization',
          change.kind,
          change,
          { taskId: change.taskId },
          change.minute,
        ),
      );
    for (const observation of s.vendor?.observations ?? [])
      this.addEvidence(
        s,
        `${observation.id}-vendor`,
        'vendor-observation',
        observation.source,
        observation,
        'observation',
        observation.id,
      );
    for (const o of s.branch?.operations ?? [])
      this.once(`branch-operation:${o.id}`, () =>
        this.emit(
          'branch-operation',
          s,
          o.origin === 'legitimate'
            ? 'interval-settlement'
            : 'actor-resolution',
          'branch-access-resolver',
          o.checks.allowed ? 'allowed' : 'denied',
          o,
          {},
          o.minute,
        ),
      );
    for (const [index, e] of (s.branch?.events ?? []).entries())
      this.once(`branch-event:${index}`, () =>
        this.emit(
          'branch-' + e.kind,
          s,
          e.taskId ? 'task-completion' : 'actor-resolution',
          'branch-infrastructure',
          'effective',
          e,
          { taskId: e.taskId },
          e.minute,
        ),
      );
    for (const o of s.branch?.observations ?? [])
      this.addEvidence(
        s,
        o.id,
        'branch-observation',
        o.source,
        o,
        o.assertion,
        o.taskId,
      );
    for (const result of s.branch?.results ?? []) {
      this.once(`branch-result:${result.taskId}`, () =>
        this.emit(
          'branch-task-result',
          s,
          result.action.type.startsWith('inspect-') ||
            result.action.type === 'confirm-branch-requirements'
            ? 'observation'
            : 'task-completion',
          'branch-task-resolver',
          result.outcome,
          result,
          { taskId: result.taskId },
          result.minute,
        ),
      );
      if (!s.branch?.observations.some((o) => o.taskId === result.taskId))
        this.addEvidence(
          s,
          `branch-result-${result.taskId}`,
          'branch-task-result',
          'branch-task-console',
          result,
          'observation',
          result.taskId,
        );
    }
    for (const [n, e] of (s.finale?.events ?? []).entries())
      this.once(`finale-event:${n}`, () =>
        this.emit(
          'finale-event',
          s,
          'actor-resolution',
          'finale-coordination',
          'occurred',
          e,
          {},
          e.minute,
        ),
      );
    for (const o of s.recovery?.observations ?? [])
      this.addEvidence(
        s,
        o.id,
        'erp-recovery-observation',
        o.source,
        o,
        o.source === 'Warehouse journal' ? 'human-statement' : 'observation',
        o.taskId,
      );
    for (const result of s.recovery?.results ?? []) {
      if (!s.recovery?.observations.some((o) => o.taskId === result.taskId))
        this.addEvidence(
          s,
          `erp-result-${result.taskId}`,
          'erp-task-result',
          'ERP task console',
          result,
          'observation',
          result.taskId,
        );
    }
    for (const result of s.recovery?.results ?? [])
      this.once(`erp-result:${result.taskId}`, () =>
        this.emit(
          'erp-task-result',
          s,
          result.action.type.startsWith('inspect-') ||
            result.action.type === 'verify-erp-backup' ||
            result.action.type === 'contact-warehouse-operations'
            ? 'observation'
            : 'task-completion',
          'erp-recovery',
          result.outcome,
          result,
          { taskId: result.taskId },
          result.minute,
        ),
      );
    for (const a of s.incident.alerts)
      this.addEvidence(
        s,
        `AL-VPN-${a.id}`,
        'vpn-alert',
        'vpn-detector',
        a,
        'signal',
      );
    for (const a of s.telemetry.endpoint?.alerts ?? [])
      this.addEvidence(
        s,
        `AL-EDR-${a.id}`,
        'edr-alert',
        'endpoint-detector',
        a,
        'signal',
      );
    for (const o of s.knowledge.authObservations)
      this.addEvidence(
        s,
        `${o.id}-auth`,
        'authentication-observation',
        o.sensorId,
        o,
        'observation',
        o.id,
      );
    for (const o of s.knowledge.fileObservations ?? [])
      this.addEvidence(
        s,
        `${o.id}-file`,
        'file-observation',
        o.sensorId,
        o,
        'observation',
        o.id,
      );
    for (const o of s.knowledge.ownerStatements)
      this.addEvidence(
        s,
        `${o.id}-human`,
        'owner-statement',
        o.speaker,
        o,
        'human-statement',
        o.id,
      );
    const sessions = s.knowledge.sessionObservation;
    if (sessions) {
      const task = s.tasks.find(
        (t) =>
          t.action.type === 'inspect-vpn-sessions' &&
          t.status === 'completed' &&
          s.history.some(
            (e) =>
              e.kind === 'task-completed' &&
              e.task.id === t.id &&
              e.minute === sessions.observedAtMinute,
          ),
      );
      this.addEvidence(
        s,
        `${task?.id ?? sessions.observedAtMinute}-sessions`,
        'session-observation',
        s.telemetry.sessionSensor.id,
        sessions,
        'observation',
        task?.id ?? null,
      );
    }
    for (const o of s.integrity?.observations ?? [])
      this.addEvidence(
        s,
        `${o.id}-documents`,
        'document-observation',
        'ERP / FS-01',
        o,
        'observation',
        o.id,
      );
    for (const o of s.integrity?.endpointObservations ?? [])
      this.addEvidence(
        s,
        `${o.id}-endpoint`,
        'local-journal-observation',
        'physical-local-journal',
        o,
        'observation',
        o.id,
      );
    for (const o of s.telemetry.endpoint?.observations ?? [])
      this.addEvidence(
        s,
        `${o.id}-edr`,
        'edr-observation',
        o.collectorId,
        o,
        'observation',
        o.id,
      );
    for (const t of s.tasks.filter(
      (t) =>
        t.status === 'completed' &&
        (t.action.type === 'inspect-backups' ||
          t.action.type === 'verify-backup'),
    )) {
      // Called at every boundary: the first appearance is the actual acquisition time.
      this.addEvidence(
        s,
        `${t.id}-backup`,
        t.action.type === 'inspect-backups'
          ? 'backup-inventory'
          : 'backup-verification',
        'backup-service',
        t.action.type === 'inspect-backups'
          ? s.hidden.scenario.integrity?.backups.map((b) => ({
              id: b.id,
              minute: b.minute,
              count: b.documentIds.length,
              available: b.available,
              restoreTurns: b.restoreTurns,
            }))
          : s.integrity?.backups.find(
              (b) => 'backupId' in t.action && b.id === t.action.backupId,
            ),
        'observation',
        t.id,
      );
    }
    for (const m of s.incident.messages)
      this.addEvidence(
        s,
        `MSG-${m.id}`,
        'narrative-message',
        m.speaker,
        m,
        'message',
      );
    for (const [index, r] of (s.integrity?.recoveries ?? []).entries())
      this.once(`recovery:${index}`, () => {
        const task = s.tasks.find(
          (t) =>
            t.action.type === 'restore-documents' &&
            t.action.backupId === r.backupId &&
            t.status === 'completed' &&
            s.history.some(
              (e) =>
                e.kind === 'task-completed' &&
                e.task.id === t.id &&
                e.minute === r.completedAtMinute,
            ),
        );
        this.emit(
          'restore-applied',
          s,
          'task-completion',
          'integrity-recovery',
          'applied',
          r,
          { taskId: task?.id ?? null },
          r.completedAtMinute,
        );
      });
  }
  record(
    command: RecordedCommand,
    before: SimulationState,
    after: SimulationState,
  ) {
    this.ordinal++;
    let created: AarDecision | null = null;
    if (command.type !== 'advance-turn') {
      if (this.decisions.length >= MAX_AAR_DECISIONS)
        throw new Error('AAR_LIMIT');
      const task =
        command.type === 'schedule-task'
          ? after.tasks.find((t) => !before.tasks.some((b) => b.id === t.id))
          : undefined;
      const rejection = after.history
        .slice(before.history.length)
        .find((e) => e.kind === 'command-rejected');
      const id = `D-${String(this.ordinal).padStart(5, '0')}`;
      const issued = this.emit(
        'decision-issued',
        before,
        'command',
        'command-journal',
        rejection ? 'rejected' : task ? 'ordered' : 'recorded',
        command,
        { taskId: task?.id ?? null, decisionId: id },
      );
      created = {
        id,
        commandOrdinal: this.ordinal,
        issuedAt: timeAt(before),
        completedAt: null,
        workerId: command.type === 'schedule-task' ? command.workerId : null,
        action: command.type === 'schedule-task' ? command.action : command,
        target: actionTarget(
          before,
          command.type === 'schedule-task' ? command.action : command,
        ),
        taskId: task?.id ?? null,
        status: rejection ? 'rejected' : task ? 'running' : 'recorded',
        rejection:
          rejection?.kind === 'command-rejected' ? rejection.reason : null,
        knownAtDecision: knownAtDecision(before, this.evidence, this.ordinal),
        actualStateAtDecision: actualState(before),
        expectedEffect: null,
        intentRecorded:
          command.type === 'schedule-task' &&
          command.action.type === 'approve-emergency-vendor-access',
        actualEffect: null,
        subsequentConsequences: {
          afterEventId: issued,
          throughEventId: issued,
          includesOtherCauses: true,
          finalSecurityRef: 'securityConsequences',
          finalBusinessRef: 'businessConsequences',
        },
      };
      this.decisions.push(created);
    }
    const previousEvents = this.timeline.length;
    this.collect(after);
    const boundaryIds = this.timeline
      .slice(previousEvents)
      .filter((e) => e.at.minute === timeAt(after).minute)
      .map((e) => e.id);
    for (let n = 0; n < this.decisions.length; n++) {
      const d = this.decisions[n]!;
      if (d.taskId && d.status === 'running') {
        const completion = after.history.find(
          (e) => e.kind === 'task-completed' && e.task.id === d.taskId,
        );
        if (completion)
          this.decisions[n] = {
            ...d,
            status: 'completed',
            completedAt: timeAt(after, completion.minute),
            actualEffect: {
              scope: 'completion-boundary-including-concurrent-events',
              boundaryState: actualState(after),
              immediateAccessImpact: immediateImpact(
                after.hidden.decisionHistory.find((v) => v.taskId === d.taskId)
                  ?.impact,
              ),
              eventIds: boundaryIds,
            },
          };
      }
    }
    this.state = after;
  }
  finish() {
    const phaseOrder: Record<Phase, number> = {
      initial: 0,
      command: 1,
      'interval-settlement': 2,
      'task-completion': 3,
      'actor-resolution': 4,
      telemetry: 5,
      observation: 6,
      finish: 7,
    };
    // Across commands, command ordinal wins over phase at the same world minute.
    const timeline = [...this.timeline].sort(
      (a, b) =>
        a.at.minute - b.at.minute ||
        (a.commandOrdinal ?? 0) - (b.commandOrdinal ?? 0) ||
        phaseOrder[a.phase] - phaseOrder[b.phase] ||
        Number(a.id.slice(3)) - Number(b.id.slice(3)),
    );
    const last = timeline.at(-1)!.id;
    return {
      timeline,
      knownEvidence: this.evidence,
      playerDecisions: this.decisions.map((d) => ({
        ...d,
        subsequentConsequences: {
          ...d.subsequentConsequences,
          throughEventId: last,
        },
      })),
    };
  }
}
