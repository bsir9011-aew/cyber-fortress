import type { PlayerView } from '../selectPlayerView';
import { selectPlayerView } from '../selectPlayerView';
import type { SimulationState } from '../../domain/simulation';
import { selectActionExperience } from './actionExperience';
import { actionLabel } from '../../content/taskLabels';
export interface KnownSignal {
  id: string;
  minute: number;
  obtained: number;
  source: string;
  assets: readonly string[];
  text: string;
  kind: 'observation' | 'interpretation' | 'operational';
}
/** Only existing public snapshots and delivered alerts. Never the source event buffers or actor truth. */
export function knownSignals(v: PlayerView): KnownSignal[] {
  const rows: KnownSignal[] = [];
  const add = (
    id: string,
    minute: number,
    obtained: number,
    source: string,
    assets: readonly string[],
    text: string,
  ) =>
    rows.push({
      id,
      minute,
      obtained,
      source,
      assets,
      text,
      kind: 'observation',
    });
  for (const o of v.authObservations)
    add(
      `auth-${o.id}`,
      o.observedAtMinute,
      o.observedAtMinute,
      'Uwierzytelnienia',
      ['vpn', 'ad'],
      `Pozyskano ${o.records.length} rekordów logowania.`,
    );
  for (const o of v.fileObservations)
    add(
      `file-${o.id}`,
      o.observedAtMinute,
      o.observedAtMinute,
      'Audyt FS-01',
      ['fs-01'],
      `Pozyskano ${o.records.length} rekordów dostępu; zamiar nieustalony.`,
    );
  if (v.sessionObservation)
    add(
      `vpn-${v.sessionObservation.observedAtMinute}`,
      v.sessionObservation.observedAtMinute,
      v.sessionObservation.observedAtMinute,
      'VPN',
      ['vpn'],
      `${v.sessionObservation.sessions.length} aktywnych tuneli w chwili migawki.`,
    );
  for (const o of v.ownerStatements)
    add(
      `human-${o.id}`,
      o.observedAtMinute,
      o.observedAtMinute,
      'Relacja użytkownika',
      ['vpn', 'ad'],
      o.text,
    );
  for (const a of v.alerts)
    add(
      `vpn-alert-${a.id}`,
      a.minute,
      a.minute,
      'Alert VPN',
      ['vpn'],
      `Sygnał wymaga badania: ${a.failureCount} nieudanych logowań.`,
    );
  for (const a of v.integrity?.edr?.alerts ?? [])
    add(
      `edr-alert-${a.id}`,
      a.minute,
      a.minute,
      'Alert EDR',
      ['workstations', 'fs-01'],
      `${a.name}; wymaga badania, nie potwierdza ataku.`,
    );
  for (const o of v.integrity?.edr?.observations ?? [])
    add(
      `edr-${o.id}`,
      o.observedAtMinute,
      o.observedAtMinute,
      'Kolektor EDR',
      ['workstations', 'fs-01'],
      `Pobrano ${o.records.length} dostarczonych rekordów.`,
    );
  for (const o of v.integrity?.endpointObservations ?? [])
    add(
      `endpoint-${o.id}`,
      o.minute,
      o.minute,
      'Lokalny dziennik',
      ['workstations', 'fs-01'],
      `Pozyskano ${o.records.length} zapisów operacji; nie identyfikuje sprawcy.`,
    );
  for (const o of v.integrity?.observations ?? [])
    add(
      `documents-${o.id}`,
      o.minute,
      o.minute,
      'Porównanie FS-01/ERP',
      ['fs-01', 'erp'],
      `${o.correct} poprawnych, ${o.damaged} uszkodzonych, ${o.reconcile} do uzgodnienia; migawka badania.`,
    );
  if (v.integrity?.backupInventoryMinute != null)
    add(
      `backup-inventory-${v.integrity.backupInventoryMinute}`,
      v.integrity.backupInventoryMinute,
      v.integrity.backupInventoryMinute,
      'Kopie FS-01',
      ['fs-01'],
      `Zinwentaryzowano ${v.integrity.backups.length} punktów odtworzenia. Inwentaryzacja nie potwierdza poprawności danych.`,
    );
  for (const b of v.integrity?.backups ?? [])
    if (b.verifiedAtMinute !== null)
      add(
        `backup-${b.id}-${b.verifiedAtMinute}`,
        b.verifiedAtMinute,
        b.verifiedAtMinute,
        'Weryfikacja kopii FS-01',
        ['fs-01'],
        `${b.id}: ${b.verification === 'clean' ? 'potwierdzona czysta kopia' : b.verification === 'damaged' ? 'stwierdzono uszkodzenia' : 'brak potwierdzenia poprawności'}.`,
      );
  for (const o of v.recovery?.observations ?? [])
    add(
      o.id,
      o.minute,
      o.minute,
      o.source,
      ['erp', ...Object.keys(o.assetStatuses)],
      o.text,
    );
  for (const o of v.branch?.observations ?? [])
    add(
      o.id,
      o.minute,
      o.minute,
      o.source,
      ['east-gateway', ...Object.keys(o.assetStatuses)],
      o.text,
    );
  for (const o of v.vendor?.observations ?? [])
    add(
      `vendor-${o.id}`,
      o.observedAtMinute,
      o.observedAtMinute,
      'CARGO-LINK',
      ['cargo-link', 'carrier-api', 'vpn', 'fs-01'],
      `Pobrano ${o.records.length} obserwacji przepływów. Wynik nie ustala zamiaru.`,
    );
  return rows.sort(
    (a, b) => a.obtained - b.obtained || a.id.localeCompare(b.id),
  );
}
export function businessContributions(v: PlayerView) {
  const a = v.availability,
    extra = v.businessDependencies.additionalWork;
  let rows: {
    id: string;
    name: string;
    current: number;
    maximum: number;
    assets: readonly string[];
    condition: string;
  }[];
  if (v.finale)
    rows = (a.contributions ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      current: c.capacity,
      maximum:
        c.id === 'east-branch' || c.id === 'cargo-link-integration' ? 3 : 8,
      assets:
        c.id === 'east-branch'
          ? ['east-gateway', 'erp', 'fs-01']
          : c.id === 'cargo-link-integration'
            ? ['carrier-api', 'vpn', 'erp']
            : [
                'erp',
                ...(c.id === 'remote-dispatch'
                  ? ['vpn']
                  : ['workstations', 'fs-01']),
              ],
      condition:
        c.id === 'east-branch'
          ? 'Wymagane ERP, kontekst lokalny i dozwolona trasa; dokumenty wymagają SMB.'
          : c.id === 'cargo-link-integration'
            ? 'Wymagane sesja, ważny wyjątek, API/HTTPS oraz użyteczne ERP.'
            : 'Wymagana użyteczna droga do poprawnej aktywnej instancji ERP.',
    }));
  else if (v.recovery)
    rows = [
      {
        id: 'erp-shipping',
        name: v.recovery.manualActive
          ? 'Obsługa ręczna zamiast ERP'
          : 'Obsługa ERP — lokalna i zdalna',
        current: a.capacity,
        maximum: v.recovery.manualActive ? 10 : 22,
        assets: ['erp', 'erp-db', 'erp-storage', 'erp-standby', 'vpn'],
        condition:
          'ERP wymaga poprawnej bazy, storage, procesu i drogi użytkowników. Manifesty są ograniczonym zamiennikiem.',
      },
    ];
  else {
    const packing = v.integrity
      ? a.contributions?.find((c) => c.id === 'packing-station')
      : undefined;
    const local = a.localAvailable
      ? v.businessDependencies.localCapacity -
        (packing && !packing.available ? packing.capacity : 0)
      : 0;
    const extraRows = extra.map((w) => {
      const c = a.contributions?.find((c) => c.id === w.id);
      return {
        id: w.id,
        name: w.name,
        current: c?.available ? c.capacity : 0,
        maximum: w.capacity,
        assets:
          w.id === 'east-branch'
            ? ['east-gateway', 'east-primary-link', 'erp', 'fs-01']
            : w.services.map((s) => s.targetAssetId),
        condition:
          w.id === 'east-branch'
            ? 'Wymagane konto, autoryzacja, ACL i trasa. Backup HTTPS nie przenosi SMB.'
            : 'Wymagane wszystkie zadeklarowane usługi, sesja, nadania i właściwy zakres dostępu.',
      };
    });
    rows = [
      {
        id: 'local',
        name: 'Centrala lokalna',
        current: local,
        maximum: v.businessDependencies.localCapacity,
        assets: ['workstations', 'erp', ...(v.integrity ? ['fs-01'] : [])],
        condition: v.integrity
          ? 'Izolacja pakowanie-03 ogranicza lokalną część pracy; dokumenty i ERP mają odrębne zależności.'
          : 'Wymagane lokalne stanowiska i droga HTTPS do ERP.',
      },
      {
        id: 'remote',
        name: 'Dyspozytorzy zdalni',
        current:
          a.capacity - local - extraRows.reduce((n, c) => n + c.current, 0),
        maximum: v.businessDependencies.remoteCapacity,
        assets: ['vpn', 'erp', ...(v.integrity ? ['fs-01'] : [])],
        condition: v.integrity
          ? 'Wymagane VPN, ERP, dostęp do FS-01 i poprawne dokumenty.'
          : 'Wymagane aktywna sesja, właściwe uprawnienie i droga do ERP.',
      },
      ...extraRows,
    ];
  }
  const signals = knownSignals(v);
  return rows.map((r) => ({
    ...r,
    evidence: signals
      .filter((o) => o.assets.some((id) => r.assets.includes(id)))
      .slice(-2),
    unknown:
      r.current < r.maximum
        ? 'Przyczyna bieżącego ograniczenia nie jest ustalona wyłącznie na podstawie wydajności.'
        : null,
  }));
}
export function selectGameplayExperience(s: SimulationState) {
  const player = selectPlayerView(s),
    signals = knownSignals(player),
    actions = selectActionExperience(s, player);
  const feedback = s.tasks
    .filter((t) => t.status === 'completed')
    .map((t) => {
      const minute = s.clock.startMinute + t.dueTurn * s.clock.turnMinutes;
      const result =
        player.recovery?.results.find((r) => r.taskId === t.id) ??
        player.branch?.results.find((r) => r.taskId === t.id);
      if (result)
        return { task: t, minute, status: result.outcome, text: result.text };
      const observed = signals.filter(
        (o) =>
          o.obtained === minute &&
          (o.id.includes(t.id) ||
            (t.action.type === 'inspect-vpn-sessions' && o.source === 'VPN') ||
            (t.action.type === 'inspect-backups' &&
              o.source === 'Kopie FS-01') ||
            (t.action.type === 'verify-backup' &&
              o.id === `backup-${t.action.backupId}-${minute}`)),
      );
      if (observed.length)
        return {
          task: t,
          minute,
          status: 'observed',
          text: observed.map((o) => o.text).join(' '),
        };
      if (t.action.type === 'restore-documents') {
        const confirmation = s.integrity?.recoveries.some(
          (r) =>
            r.backupId === ('backupId' in t.action ? t.action.backupId : '') &&
            r.completedAtMinute === minute &&
            r.orderedAtMinute ===
              s.clock.startMinute + t.startTurn * s.clock.turnMinutes,
        );
        return {
          task: t,
          minute,
          status: confirmation ? 'succeeded' : 'unconfirmed',
          text: confirmation
            ? 'Zastosowano wybrany punkt odtworzenia. Poprawność dokumentów wymaga osobnej kontroli.'
            : 'Brak potwierdzenia odtworzenia. Wynik nie zachował szczegółowej przyczyny; sprawdź dostępność źródła i celu.',
        };
      }
      if (t.action.type === 'approve-emergency-vendor-access') {
        const x = player.finale?.approvals.find((a) => a.taskId === t.id);
        return {
          task: t,
          minute,
          status: x?.outcome === 'activated' ? 'succeeded' : 'failed',
          text:
            x?.outcome === 'activated'
              ? 'Zatwierdzenie aktywne od ukończenia zadania. Pozostałe zabezpieczenia nadal obowiązują.'
              : 'Nie aktywowano zatwierdzenia; sprawdź zakres i termin.',
        };
      }
      if (
        [
          'set-vpn',
          'set-network-rule',
          'block-account',
          'unblock-account',
          'reset-credential',
          'isolate-endpoint',
          'restrict-endpoint-writes',
          'reconnect-endpoint',
        ].includes(t.action.type) &&
        player.history.some(
          (e) => e.kind === 'configuration-changed' && e.task.id === t.id,
        )
      )
        return {
          task: t,
          minute,
          status: 'applied',
          text: `Potwierdzono zastosowanie: ${actionLabel(t.action)}. Zmiana dotyczy wskazanego zakresu; nie potwierdza usunięcia zagrożenia ani poprawności odzyskania.`,
        };
      return {
        task: t,
        minute,
        status: 'completed',
        text: `Zakończono: ${actionLabel(t.action)}. ${t.workerId === 'analyst' ? 'Sprawdź pozyskany dowód; brak rekordu nie potwierdza bezpieczeństwa.' : 'Potwierdzenie czasu pracy nie zastępuje badania skutku i poprawności danych.'}`,
      };
    });
  const last = player.business.lastReport;
  const previous = player.history
    .filter((e) => e.kind === 'business-report')
    .at(-2);
  const intervalStart = player.minute - player.clock.turnMinutes;
  const recent = last
    ? [
        ...feedback
          .filter((r) => r.minute === player.minute)
          .map((r) => ({
            kind: 'operational' as const,
            text: r.text,
            status: r.status,
          })),
        ...signals
          .filter(
            (o) => o.obtained > intervalStart && o.obtained <= player.minute,
          )
          .map((o) => ({
            kind: 'observation' as const,
            text: `${o.source}: ${o.text}`,
            status: 'observed',
          })),
        ...(player.vendor?.accessChanges
          .filter(
            (e) =>
              e.kind === 'expired' &&
              e.minute > intervalStart &&
              e.minute <= player.minute,
          )
          .map(() => ({
            kind: 'operational' as const,
            text: 'Upłynął termin wyjątku CARGO-LINK; dotyczy także istniejących sesji.',
            status: 'expired',
          })) ?? []),
        ...(player.finished
          ? [
              {
                kind: 'operational' as const,
                text: 'Okno operacyjne zakończone. Raport może teraz ujawnić rzeczywisty przebieg.',
                status: 'finished',
              },
            ]
          : []),
      ]
    : [];
  return {
    player,
    actions,
    signals,
    feedback,
    business: businessContributions(player),
    decisions: player.finished
      ? feedback
          .filter((r, n, all) =>
            r.task.workerId === 'administrator'
              ? all
                  .filter((x) => x.task.workerId === 'administrator')
                  .slice(-3)
                  .includes(r)
              : !all.slice(0, n).some((x) => x.task.workerId === 'analyst'),
          )
          .map((r) => ({
            ...r,
            orderedAtMinute:
              s.clock.startMinute + r.task.startTurn * s.clock.turnMinutes,
            known: signals
              .filter(
                (o) =>
                  o.obtained <=
                  s.clock.startMinute + r.task.startTurn * s.clock.turnMinutes,
              )
              .slice(-3),
          }))
      : [],
    lastTurn: last
      ? {
          turn: last.turn,
          received: last.received,
          processed: last.processed,
          backlogChange:
            last.backlog -
            (previous?.kind === 'business-report'
              ? previous.report.backlog
              : 0),
          capacityChange:
            previous?.kind === 'business-report'
              ? last.capacity - previous.report.capacity
              : null,
          notices: recent,
        }
      : null,
  };
}
export type GameplayExperience = ReturnType<typeof selectGameplayExperience>;
