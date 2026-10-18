import type { FinaleObservation } from '../domain/finale';
import type { SimulationState } from '../domain/simulation';
/** Player-owned observations only. Event time and disclosure time are intentionally separate. */
export function selectFinaleTimeline(
  s: SimulationState,
): readonly FinaleObservation[] {
  const rows: FinaleObservation[] = [...(s.finale?.observations ?? [])];
  const add = (
    id: string,
    eventMinute: number,
    availableAtMinute: number,
    source: string,
    assetId: string,
    fact: string,
    result: string,
    limitation: string,
  ) =>
    rows.push({
      id,
      eventMinute,
      availableAtMinute,
      source,
      assetId,
      fact,
      result,
      limitation,
    });
  for (const o of s.knowledge.authObservations)
    for (const r of o.records)
      add(
        `auth-${r.id}`,
        r.minute,
        o.observedAtMinute,
        'Uwierzytelnienia / VPN',
        r.sourceAssetId,
        `${r.accountId} · ${r.sessionId ?? 'bez sesji'}`,
        `${r.outcome} · ${r.reason ?? 'brak szczegółu'}`,
        'Log opisuje uwierzytelnienie; nie ustala osoby ani celu.',
      );
  const sessions = s.knowledge.sessionObservation;
  if (sessions)
    for (const r of sessions.sessions)
      add(
        `session-${sessions.observedAtMinute}-${r.id}`,
        sessions.observedAtMinute,
        sessions.observedAtMinute,
        'VPN',
        r.gatewayAssetId,
        `${r.id} · konto ${r.accountId}`,
        'Tunel aktywny w chwili odczytu.',
        'Migawka nie potwierdza obecnego stanu ani legalności sesji.',
      );
  for (const o of s.knowledge.fileObservations ?? [])
    for (const r of o.records)
      add(
        `file-${r.id}`,
        r.minute,
        o.observedAtMinute,
        'Audyt FS-01',
        r.targetAssetId,
        `${r.accountId} · ${r.operation} · ${r.documentIds?.length ?? 0} dokumentów`,
        `${r.outcome} · zmierzony odczyt ${r.recordsRead ?? 'nie dotyczy'}`,
        'Wyłącznie próby docierające do serwera w pokryciu; nie klasyfikuje zamiaru.',
      );
  for (const a of s.telemetry.endpoint?.alerts ?? [])
    add(
      `alert-${a.id}`,
      a.minute,
      a.minute,
      'EDR — alert',
      a.endpointId,
      `${a.name} · ${a.modificationCount} dokumentów`,
      'Wymaga dochodzenia.',
      'Sygnał z reguły, nie potwierdzenie ataku; wyłącznie objęty endpoint.',
    );
  for (const o of s.telemetry.endpoint?.observations ?? [])
    for (const r of o.records)
      add(
        `edr-${r.id}`,
        r.minute,
        o.observedAtMinute,
        'EDR',
        r.endpointId,
        `${r.operation} · ${r.documentIds.length} dokumentów`,
        r.outcome,
        'Wyłącznie dostarczona telemetria; izolacja może przerwać dostarczanie.',
      );
  for (const o of s.integrity?.endpointObservations ?? [])
    for (const [n, r] of o.records.entries())
      add(
        `local-${o.id}-${n}`,
        r.minute,
        o.minute,
        'Lokalny dziennik',
        o.endpointId,
        `${r.accountId} · ${r.operation} · ${r.documentIds.length} dokumentów`,
        r.outcome,
        'Dziennik operacji nie ustala złośliwości.',
      );
  for (const o of s.integrity?.observations ?? [])
    add(
      `docs-${o.id}`,
      o.minute,
      o.minute,
      'Porównanie FS-01 / ERP',
      'fs-01',
      `${o.correct} poprawnych, ${o.damaged} uszkodzonych, ${o.reconcile} do uzgodnienia`,
      'Stan porównania w chwili badania.',
      'Migawka zakresu badania; nie wskazuje sprawcy.',
    );
  for (const o of s.vendor?.observations ?? [])
    for (const r of o.records)
      add(
        `vendor-${r.id}`,
        r.minute,
        o.observedAtMinute,
        'CARGO-LINK',
        r.targetAssetId,
        `${r.accountId} · ${r.sessionId} · ${r.protocol} / ${r.operation}`,
        r.outcome,
        'Monitor dostępu nie zna osoby za kontem; odmowa nie dowodzi napastnika.',
      );
  for (const o of s.recovery?.observations ?? [])
    add(
      `erp-${o.id}`,
      o.minute,
      o.minute,
      o.source,
      'erp',
      o.text +
        o.backups
          .map(
            (b) =>
              ` Kopia ${b.id}: punkt ${b.minute}, dostępna ${b.available ? 'tak' : 'nie'}, odtworzenie ${b.restoreTurns * 5} min, ${b.recordIds.length} zapisów, integralność ${b.verified === null ? 'niezbadana' : b.verified ? 'potwierdzona' : 'błędy'}.`,
          )
          .join(''),
      'Pozyskano wynik badania.',
      'Migawka badanej instancji; nie wyjaśnia innych komponentów.',
    );
  for (const r of s.recovery?.results ?? [])
    if (!s.recovery!.observations.some((o) => o.taskId === r.taskId))
      add(
        `erp-result-${r.taskId}`,
        r.minute,
        r.minute,
        'ERP — konsola zadania',
        'erp',
        r.text,
        r.outcome,
        'Wynik ukończonej operacji; inne komponenty wymagają osobnej kontroli.',
      );
  for (const r of s.branch?.results ?? [])
    if (!s.branch!.observations.some((o) => o.taskId === r.taskId))
      add(
        `east-result-${r.taskId}`,
        r.minute,
        r.minute,
        'EAST — konsola zadania',
        'east-gateway',
        r.text,
        r.outcome,
        'Zmiana transportu lub uprawnień nie potwierdza działania ERP.',
      );
  for (const o of s.branch?.observations ?? []) {
    add(
      `east-${o.id}`,
      o.minute,
      o.minute,
      o.source,
      'east-gateway',
      o.text,
      'Pozyskano wynik badania.',
      'Łącze, autoryzacja i działanie ERP są odrębne.',
    );
    for (const r of o.records)
      add(
        `east-record-${r.id}`,
        r.minute,
        o.minute,
        'Monitoring EAST',
        r.targetAssetId,
        `${r.accountId} · ${r.protocol} · ${r.route}`,
        r.outcome,
        'Metadane bramy; bez treści i tożsamości człowieka.',
      );
  }
  for (const m of s.incident.messages.filter(
    (m) => m.id === 'finale-operations-report',
  ))
    add(
      m.id,
      m.minute,
      m.minute,
      'Operacje — zgłoszenie',
      'workstations',
      m.text,
      'Przyczyna niepotwierdzona.',
      'Relacja zespołu, nie wynik diagnostyki ani dowód ataku.',
    );
  // First acquisition is retained even if a later read returns the same record again.
  return [
    ...new Map(
      rows
        .sort((a, b) => b.availableAtMinute - a.availableAtMinute)
        .map((r) => [r.id, r]),
    ).values(),
  ].sort(
    (a, b) =>
      a.eventMinute - b.eventMinute ||
      a.availableAtMinute - b.availableAtMinute ||
      a.id.localeCompare(b.id),
  );
}
