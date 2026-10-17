import { useState } from 'react';
import type { CampaignCommand, CampaignState } from '../domain/campaign';
import type { VendorExpiry, VendorScope } from '../domain/vendor';
import type { MapSelection } from './infrastructurePresentation';
import { vendorWorld } from '../content/scenarios/vendor';
import { InfrastructureMap } from './InfrastructureMap';
import { InfrastructureInspector } from './InfrastructureInspector';
import { formatMinute } from '../simulation/clock';
const previewIds = ['cargo-link', 'vpn', 'carrier-api', 'fs-01'];
const previewWorld = {
  ...vendorWorld,
  assets: vendorWorld.assets.filter((a) => previewIds.includes(a.id)),
  connections: vendorWorld.connections.filter((c) =>
    ['cargo-vpn', 'vpn-carrier-api', 'vpn-files'].includes(c.id),
  ),
  zones: vendorWorld.zones.filter((z) =>
    vendorWorld.assets.some(
      (a) => previewIds.includes(a.id) && a.zoneId === z.id,
    ),
  ),
};
export function VendorPreparation({
  campaign,
  onCommand,
}: {
  campaign: CampaignState;
  onCommand: (c: CampaignCommand) => void;
}) {
  const [scope, setScope] = useState<VendorScope>('api-only');
  const [expiry, setExpiry] = useState<VendorExpiry>(900);
  const [selection, setSelection] = useState<MapSelection>(null);
  const world = {
    ...previewWorld,
    assets: previewWorld.assets.map((a) => ({
      ...a,
      status: campaign.posture.assetOverrides[a.id] ?? a.status,
    })),
  };
  const pending = campaign.vendorApprovals?.find(
    (a) => a.completedHour === null,
  );
  const approval = [...(campaign.vendorApprovals ?? [])]
    .reverse()
    .find(
      (a) =>
        a.window === campaign.preparation.number &&
        a.completedHour !== null &&
        a.usedInWindow === null,
    );
  const busy = campaign.work.some(
    (w) =>
      w.window === campaign.preparation.number &&
      w.workerId === 'administrator' &&
      w.status === 'running',
  );
  return (
    <section
      className="vendor-card"
      aria-label="Dostęp zewnętrzny — CARGO-LINK"
    >
      <p className="eyebrow">Misja 03 / architektura dostępu</p>
      <h2>Dostęp zewnętrzny — CARGO-LINK</h2>
      <p>
        Wydzielona tożsamość: <strong>cargo-link-operator</strong>. Dostawca →
        VPN → carrier-api / HTTPS. Opcjonalnie VPN → FS-01 / SMB. Linia na mapie
        nie nadaje uprawnienia; poza ważnym wyjątkiem dostawca nie może użyć
        tych usług.
      </p>
      <p>
        Integracja wnosi 6 z 22 zamówień wydajności. Brak wymaganego przepływu
        może tworzyć zaległości. Potrzebę dokumentów ustalisz z obserwacji;
        szerszy dostęp może być uzasadniony, ale zwiększa zakres możliwych
        odczytów. Wdrożone MFA dotyczy także nowych logowań dostawcy.
      </p>
      <div className="vendor-fields">
        <label>
          Zakres wyjątku
          <select
            value={scope}
            disabled={!!pending}
            onChange={(e) => setScope(e.target.value as VendorScope)}
          >
            <option value="api-only">
              Ograniczony — tylko carrier-api / HTTPS
            </option>
            <option value="api-and-files">
              Rozszerzony — HTTPS i FS-01 / SMB
            </option>
          </select>
        </label>
        <label>
          Termin czasu świata
          <select
            value={expiry}
            disabled={!!pending}
            onChange={(e) => setExpiry(Number(e.target.value) as VendorExpiry)}
          >
            {([870, 900, 930] as const).map((t) => (
              <option value={t} key={t}>
                {formatMinute(t)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary-button"
          disabled={
            !!pending ||
            busy ||
            campaign.preparation.hour === 4 ||
            (approval?.scope === scope && approval?.expiresAtMinute === expiry)
          }
          onClick={() =>
            onCommand({
              type: 'prepare-vendor-exception',
              scope,
              expiresAtMinute: expiry,
            })
          }
        >
          Przygotuj wyjątek — 1 h administratora
        </button>
      </div>
      <p>
        {pending
          ? 'Administrator przygotowuje zatwierdzenie. Rozlicz godzinę; wyjątek jeszcze nie jest gotowy.'
          : busy
            ? 'Administrator jest zajęty wdrożeniem.'
            : 'Bez dodatkowej opłaty. Gotowy wyjątek dotyczy tylko startu Misji 03 w tym oknie; po użyciu wymaga nowej decyzji.'}
      </p>
      <p>
        {approval
          ? `${approval.id}: ${approval.scope === 'api-only' ? 'tylko HTTPS' : 'HTTPS i SMB'}, od 14:00 do ${formatMinute(approval.expiresAtMinute)} (termin wyłączny).`
          : 'Brak gotowego wyjątku dla tej misji. Możesz rozpocząć bez niego — przepływy dostawcy będą odrzucone.'}
      </p>
      <details className="vendor-architecture">
        <summary>Podgląd przepływów i inspektor architektury</summary>
        <InfrastructureMap
          world={world}
          connections={previewWorld.connections}
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
        disabled={campaign.preparation.hour !== 4}
        onClick={() =>
          onCommand({
            type: 'start-vendor-incident',
            familyId: 'nexus-vendor-access-v1',
          })
        }
      >
        Rozpocznij Misję 03 →
      </button>
    </section>
  );
}
