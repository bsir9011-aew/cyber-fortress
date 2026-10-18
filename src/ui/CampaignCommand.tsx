import type { selectRecordedCampaignHistory } from '../application/gameplay/campaignHistory';
import { useState } from 'react';
import type { CampaignState, CampaignCommand } from '../domain/campaign';
import type { HeadquartersTab } from '../application/gameSession';
import {
  selectCampaignCommand,
  preparationTeam,
} from '../application/gameplay/campaignExperience';
import type { MissionId } from '../application/gameplay/campaignExperience';
import { Terms } from './GameplayHelp';
export function CampaignCommand({
  campaign: s,
  history,
  onCommand,
  onTab,
}: {
  history: ReturnType<typeof selectRecordedCampaignHistory>;
  campaign: CampaignState;
  onCommand: (c: CampaignCommand) => void;
  onTab: (t: HeadquartersTab) => void;
}) {
  const missions = selectCampaignCommand(s),
    [selected, setSelected] = useState<MissionId>(
      () => missions.find((m) => m.status === 'available')?.id ?? 'M01',
    );
  const current = missions.find((m) => m.id === selected)!;
  const team = preparationTeam(s);
  const approval = [...(s.vendorApprovals ?? [])]
    .reverse()
    .find(
      (a) =>
        a.window === s.preparation.number &&
        a.completedHour !== null &&
        a.usedInWindow === null,
    );
  return (
    <section
      className="command-center"
      aria-label="NEXUS CAMPAIGN — ROZDZIAŁ I"
    >
      <p className="eyebrow">NEXUS CAMPAIGN — ROZDZIAŁ I</p>
      <div className="campaign-command-grid">
        <div>
          <h2>Wybierz wyzwanie</h2>
          <ol className="mission-list">
            {missions.map((m) => (
              <li key={m.id}>
                <button
                  aria-pressed={selected === m.id}
                  onClick={() => setSelected(m.id)}
                >
                  <strong>{m.id}</strong>
                  <span>
                    {m.name}
                    <small>
                      {m.status === 'completed'
                        ? 'Ukończona'
                        : m.status === 'available'
                          ? 'Dostępna'
                          : 'Zablokowana'}{' '}
                      · prób {m.attempts}
                      {m.last &&
                        ` · ostatnio: ${history.find((r) => r.number === m.last?.number)?.detail?.result.label ?? 'brak szczegółowej oceny'}, ${m.last.processed} obsłużonych / ${m.last.backlog} zaległych`}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2>
            {current.id} — {current.name}
          </h2>
          <p>{current.challenge}</p>
          <p>{current.unlock} Wynik poprzedniej próby nie blokuje kolejnej.</p>
          <section className="readiness">
            <h3>PRZED ROZPOCZĘCIEM</h3>
            <ul>
              <li>
                MFA: {s.posture.remoteAccess ? 'wdrożone' : 'niewdrożone'};
                audyt FS-01: {s.posture.fileVisibility ? 'wdrożony' : 'brak'}.
              </li>
              {['M02', 'M06'].includes(selected) && (
                <>
                  <li>
                    EDR:{' '}
                    {s.posture.endpointCoverage
                      ? `${s.posture.endpointCoverage.endpointId}, próg ${s.posture.endpointCoverage.detection.threshold}/${s.posture.endpointCoverage.detection.windowMinutes} min`
                      : 'brak pokrycia'}
                    .
                  </li>
                  <li>
                    Backup FS-01:{' '}
                    {s.posture.backupReadiness?.restoreTestPassed
                      ? 'procedura przetestowana'
                      : 'brak potwierdzonego testu'}
                    .
                  </li>
                </>
              )}
              {['M03', 'M06'].includes(selected) && (
                <li>
                  Nowy wyjątek CARGO-LINK w tym oknie:{' '}
                  {approval
                    ? `${approval.scope}, do ${Math.floor(approval.expiresAtMinute / 60)}:${String(approval.expiresAtMinute % 60).padStart(2, '0')}`
                    : 'brak gotowego, niewykorzystanego zatwierdzenia'}
                  .
                </li>
              )}
              {['M05', 'M06'].includes(selected) && (
                <li>
                  EAST: ERP{' '}
                  {s.branchArchitecture?.erpEnabled
                    ? 'włączone'
                    : 'niewdrożone'}
                  , SMB {s.branchArchitecture?.smbScope ?? 'none'}, backup HTTPS{' '}
                  {s.branchArchitecture?.backupPrepared
                    ? 'przygotowany'
                    : 'brak'}
                  , monitoring{' '}
                  {s.branchArchitecture?.monitoring ? 'wdrożony' : 'brak'}.
                </li>
              )}
              <li>
                {team.filter((w) => w.hours > 0).length} osób w trakcie pracy.
                Nieukończone projekty nie są aktywnymi zabezpieczeniami.
              </li>
            </ul>
          </section>
          <button
            className="primary-button"
            disabled={!!current.reason}
            onClick={() => onCommand(current.command)}
          >
            Rozpocznij {current.id}
          </button>
          <p className="action-reason">
            {current.reason ??
              'Okno rozliczone. Możesz rozpocząć również z niepełnymi zabezpieczeniami.'}
          </p>
          {selected === 'M02' && (
            <div>
              <button
                disabled={!!current.reason}
                onClick={() =>
                  onCommand({
                    type: 'start-detection-incident',
                    familyId: 'nexus-integrity-detection-v1',
                  })
                }
              >
                M02 — nieznany przypadek
              </button>
              <p>Ta sama rodzina misji i wymagania przygotowania.</p>
            </div>
          )}
          <button onClick={() => onTab('schedule')}>
            Przejdź do planu przygotowania
          </button>
          <Terms terms={['MFA', 'ACL', 'Least Privilege']} />
        </div>
      </div>
      <section className="preparation-command" aria-label="Plan przygotowania">
        <h2>PLAN PRZYGOTOWANIA · {s.preparation.hour}/4 h</h2>
        <div className="preparation-team">
          {team.map((w) => (
            <article key={w.worker}>
              <h3>
                {w.worker === 'administrator' ? 'Administrator' : 'Analityk'}
              </h3>
              <strong>{w.name}</strong>
              <p>
                {w.hours
                  ? `Pozostało ${w.hours} h. ${w.finishesNext ? 'Zakończy pracę po kolejnej godzinie.' : w.continues ? 'Część pracy przechodzi na kolejne okno.' : 'Praca trwa w tym oknie.'}`
                  : `Wolny · ${4 - s.preparation.hour} h do końca okna.`}
              </p>
              <button onClick={() => onTab('schedule')}>
                Przydziały i harmonogram
              </button>
            </article>
          ))}
        </div>
        <button
          disabled={s.preparation.hour >= 4}
          onClick={() => onCommand({ type: 'advance-preparation' })}
        >
          Rozlicz godzinę pracy
        </button>
        <p>
          Zegar przesuwa tylko ta decyzja. Obie osoby rozliczają tę samą
          godzinę.{' '}
          {s.branchWork?.filter((w) => w.status === 'paused').length ?? 0} zmian
          EAST oczekuje na kontynuację.
        </p>
      </section>
    </section>
  );
}
