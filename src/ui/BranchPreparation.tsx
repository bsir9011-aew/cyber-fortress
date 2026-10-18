import { useState } from 'react';
import type { CampaignState, CampaignCommand } from '../domain/campaign';
import type {
  BranchArchitectureChange,
  BranchSmbScope,
} from '../domain/branch';
import {
  branchWorld,
  defaultBranchArchitecture,
} from '../content/scenarios/branch';
import {
  branchPreparationRejection,
  branchPreparationSpec,
} from '../application/branchPreparation';
import { smbScopeLabels } from '../content/branchLabels';
import { InfrastructureMap } from './InfrastructureMap';
import { InfrastructureInspector } from './InfrastructureInspector';
import type { MapSelection } from './infrastructurePresentation';
const previewIds = [
  'east-workstations',
  'east-gateway',
  'east-primary-link',
  'east-backup-gateway',
  'firewall',
  'erp',
  'fs-01',
];
export function BranchPreparation({
  campaign: s,
  onCommand,
}: {
  campaign: CampaignState;
  onCommand: (c: CampaignCommand) => void;
}) {
  const a = s.branchArchitecture ?? defaultBranchArchitecture;
  const [erp, setErp] = useState(true),
    [smb, setSmb] = useState<BranchSmbScope>(a.smbScope),
    [backup, setBackup] = useState(true),
    [monitoring, setMonitoring] = useState(true),
    [selection, setSelection] = useState<MapSelection>(null);
  const world = {
    ...branchWorld,
    assets: branchWorld.assets
      .filter((a) => previewIds.includes(a.id))
      .map((a) => ({
        ...a,
        status: s.posture.assetOverrides[a.id] ?? a.status,
      })),
    connections: branchWorld.connections.filter((c) =>
      c.id.startsWith('EAST-'),
    ),
    zones: branchWorld.zones.filter((z) =>
      branchWorld.assets.some(
        (a) => previewIds.includes(a.id) && a.zoneId === z.id,
      ),
    ),
  };
  const order = (change: BranchArchitectureChange) =>
    onCommand({ type: 'prepare-branch-architecture', change });
  const button = (change: BranchArchitectureChange, label: string) => {
    const rejection = branchPreparationRejection(s, change),
      spec = branchPreparationSpec(change);
    return (
      <>
        <button
          className="secondary-button"
          disabled={!!rejection}
          title={rejection ?? undefined}
          onClick={() => order(change)}
        >
          {label} · {spec.hours} h{' '}
          {spec.workerId === 'analyst' ? 'analityka' : 'administratora'}
        </button>
        {rejection && <small>{rejection}</small>}
      </>
    );
  };
  return (
    <section
      className="vendor-card branch-card"
      aria-label="Projekt architektury — NEXUS EAST"
    >
      <p className="eyebrow">Misja 05 / przygotowanie</p>
      <h2>Projekt architektury — NEXUS EAST</h2>
      <p>
        12 osób i 8 stacji przeniesionych z centrali. Łącznie nadal 120
        pracowników i 94 urządzenia. Oddział wnosi do 6 z 22 zamówień/turę;
        backup do 3. Site-to-site jest transportem między bramami, a użytkownik
        nadal potrzebuje uwierzytelnionego kontekstu, ACL i nadania do zasobu.
      </p>
      <p>
        <strong>Wdrożone:</strong> ERP {a.erpEnabled ? 'tak' : 'nie'} · SMB{' '}
        {smbScopeLabels[a.smbScope]} · backup{' '}
        {a.backupPrepared ? 'gotowy' : 'nieprzygotowany'} · monitoring{' '}
        {a.monitoring ? 'aktywny' : 'niewdrożony'}.
      </p>
      <div className="branch-config-grid">
        <article>
          <h3>ERP / HTTPS</h3>
          <label>
            Dostęp ERP
            <select
              value={String(erp)}
              onChange={(e) => setErp(e.target.value === 'true')}
            >
              <option value="true">Włącz</option>
              <option value="false">Wyłącz</option>
            </select>
          </label>
          <p>
            Reguła HTTPS i jawne nadanie do ERP dla kont EAST. Nie zapewnia SMB.
          </p>
          {button({ component: 'erp', enabled: erp }, 'Wdróż dostęp ERP')}
        </article>
        <article>
          <h3>FS-01 / SMB</h3>
          <label>
            Zakres SMB
            <select
              value={smb}
              onChange={(e) => setSmb(e.target.value as BranchSmbScope)}
            >
              <option value="none">Brak SMB</option>
              <option value="documents">Grupa dokumentowa</option>
              <option value="all">Wszystkie konta EAST</option>
            </select>
          </label>
          <p>
            Grupa: east-documents. Szeroki wariant nadaje również east-operator
            prawo do plików. Sama reguła allow nie nadaje uprawnienia. Wydany
            kontekst grupy dokumentowej nadal może zostać nadużyty.
          </p>
          {button({ component: 'smb', scope: smb }, 'Wdróż zakres SMB')}
        </article>
        <article>
          <h3>Zapasowa droga HTTPS</h3>
          <label>
            Łącze zapasowe
            <select
              value={String(backup)}
              onChange={(e) => setBackup(e.target.value === 'true')}
            >
              <option value="true">Przygotuj</option>
              <option value="false">Wycofaj</option>
            </select>
          </label>
          <p>
            Oddzielny gateway, uwierzytelnienie i autoryzacja do ERP. Do 3/turę;
            bez SMB. Aktywacja w misji zajmuje kolejne 5 min.
          </p>
          {button(
            { component: 'backup', enabled: backup },
            'Przygotuj drogę zapasową',
          )}
        </article>
        <article>
          <h3>Monitoring bram EAST</h3>
          <label>
            Monitoring
            <select
              value={String(monitoring)}
              onChange={(e) => setMonitoring(e.target.value === 'true')}
            >
              <option value="true">Włącz</option>
              <option value="false">Wyłącz</option>
            </select>
          </label>
          <p>
            Metadane przepływów obu bram, retencja 120 min, opóźnienie 0. Bez
            treści szyfrowanych i automatycznego blokowania; brak pokrycia
            wstecz.
          </p>
          {button(
            { component: 'monitoring', enabled: monitoring },
            'Wdróż monitoring EAST',
          )}
        </article>
      </div>
      <p>
        Zmiany obowiązują po ukończeniu pracy. Administrator ma 4 h na wspólnym
        harmonogramie; analityk pracuje równolegle. Inne wdrożenia konkurują o
        te same osoby. Bez opłat, nowych projektów i finansowania. Rozpoczęte 2
        h backupu można dokończyć w następnym oknie.
      </p>
      {(s.branchWork ?? []).length > 0 && (
        <details open>
          <summary>Prace i historia architektury</summary>
          {s.branchWork?.map((w) => (
            <p key={w.id}>
              {w.id} · {w.change.component} ·{' '}
              {w.status === 'completed'
                ? 'ukończono'
                : w.status === 'paused'
                  ? 'wstrzymano na granicy okna'
                  : 'w toku'}{' '}
              · pozostało {w.remainingHours} h ·{' '}
              {w.segments
                .map(
                  (segment) =>
                    `okno ${segment.window}: ${segment.hoursWorked} h od ${segment.startHour}:00`,
                )
                .join('; ')}
              .{' '}
              {w.status === 'paused' && (
                <button
                  disabled={!!branchPreparationRejection(s, w.change)}
                  onClick={() => order(w.change)}
                >
                  Kontynuuj {w.id}
                </button>
              )}
            </p>
          ))}
        </details>
      )}
      <details className="vendor-architecture">
        <summary>Podgląd tras NEXUS EAST</summary>
        <p>
          Primary: EAST Workstations → EAST Gateway → EAST Primary Link →
          Firewall → ERP / FS-01. Backup: EAST Workstations → EAST Backup
          Gateway → ERP, wyłącznie HTTPS. To dokumentacja ścieżek; stan w misji
          wymaga obserwacji.
        </p>
        <InfrastructureMap
          world={world}
          connections={world.connections}
          selection={selection}
          onSelect={setSelection}
        />
        <InfrastructureInspector
          world={world}
          selection={selection}
          onSelect={setSelection}
        />
      </details>
      <button
        className="primary-button"
        disabled={s.preparation.hour !== 4}
        onClick={() =>
          onCommand({
            type: 'start-branch-incident',
            familyId: 'nexus-east-branch-v1',
          })
        }
      >
        Rozpocznij Misję 05 →
      </button>
    </section>
  );
}
