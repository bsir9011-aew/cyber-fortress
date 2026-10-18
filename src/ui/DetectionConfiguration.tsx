import { preparationWorkerBusy } from '../application/branchPreparation';
import { useState } from 'react';
import type { CampaignCommand, CampaignState } from '../domain/campaign';

export function DetectionConfiguration({
  campaign,
  onCommand,
}: {
  campaign: CampaignState;
  onCommand: (command: CampaignCommand) => void;
}) {
  const coverage = campaign.posture.endpointCoverage;
  const rule = coverage?.detection;
  const [threshold, setThreshold] = useState(rule?.threshold ?? 10);
  const [windowMinutes, setWindow] = useState<5 | 10 | 20>(
    (rule?.windowMinutes ?? 10) as 5 | 10 | 20,
  );
  const pending = campaign.detectionChanges?.find(
    (w) => w.completedHour === null,
  );
  const analystBusy = preparationWorkerBusy(campaign, 'analyst');
  return (
    <section
      className="detection-configuration"
      aria-label="Konfiguracja detekcji EDR"
    >
      <p className="eyebrow">Detection Engineering / pokrycie 1 z 94 stacji</p>
      <h2>Unusual Document Modification Activity</h2>
      <p>
        {coverage
          ? `EDR wdrożony na ${coverage.endpointId}. Aktywny próg: ${rule!.threshold} / ${rule!.windowMinutes} min.`
          : 'EDR niewdrożony. Najpierw ukończ projekt Endpoint EDR; badanie lokalnego dziennika pozostaje dostępne bez sensora.'}
      </p>
      <p>
        Reguła liczy unikalne ID dokumentów w dopuszczonych operacjach SMB
        modify, w ruchomym oknie. Ten sam dokument liczy się raz w oknie, nawet
        po kilku aktualizacjach. Źródłem są dostarczone rekordy sensora;
        obowiązują opóźnienie i retencja. Alert wymaga dochodzenia.
      </p>
      {rule && !rule.counting && (
        <p>
          Aktywna konfiguracja historyczna: suma wystąpień dokumentów w
          operacjach. Nowy nieznany przypadek używa unikalnych ID; historyczna
          Misja 02 zachowuje dotychczasową regułę do zmiany parametrów.
        </p>
      )}
      <div className="detection-fields">
        <label>
          Minimum dokumentów (2–30)
          <input
            type="number"
            min={2}
            max={30}
            step={1}
            value={threshold}
            disabled={!coverage || Boolean(pending)}
            onChange={(e) => setThreshold(e.target.valueAsNumber)}
          />
        </label>
        <label>
          Ruchome okno czasowe
          <select
            value={windowMinutes}
            disabled={!coverage || Boolean(pending)}
            onChange={(e) => setWindow(Number(e.target.value) as 5 | 10 | 20)}
          >
            <option value={5}>5 minut</option>
            <option value={10}>10 minut</option>
            <option value={20}>20 minut</option>
          </select>
        </label>
        <button
          className="secondary-button"
          disabled={
            !coverage ||
            Boolean(pending) ||
            analystBusy ||
            campaign.preparation.hour >= 4 ||
            !Number.isSafeInteger(threshold) ||
            threshold < 2 ||
            threshold > 30 ||
            (threshold === rule?.threshold &&
              windowMinutes === rule.windowMinutes)
          }
          onClick={() =>
            onCommand({
              type: 'configure-endpoint-detection',
              endpointId: 'pakowanie-03',
              threshold,
              windowMinutes,
            })
          }
        >
          Zleć konfigurację — 1 h analityka
        </button>
      </div>
      <p>
        {pending
          ? `Analityk konfiguruje ${pending.threshold} dokumentów / ${pending.windowMinutes} min. Rozlicz godzinę pracy, aby aktywować zmianę. Dotychczasowa reguła nadal obowiązuje.`
          : analystBusy
            ? 'Analityk zajęty innym projektem.'
            : 'Zmiana wymaga wolnego analityka przez 1 h przygotowania; bez dodatkowej opłaty. Działa po ukończeniu i przechodzi do kolejnych misji. Nie przelicza poprzednich alertów.'}
      </p>
      {!!campaign.detectionChanges?.length && (
        <details>
          <summary>Zmiany reguły w Centrali</summary>
          {campaign.detectionChanges.map((w) => (
            <p key={w.id}>
              {w.id} · okno {w.window}, godzina {w.startHour} →{' '}
              {w.completedHour ?? 'w toku'} · {w.threshold} / {w.windowMinutes}{' '}
              min
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
