import type { GameplayExperience } from '../application/gameplay/cockpit';
import { formatMinute } from '../simulation/clock';
import { ResilienceStatus } from './ResilienceStatus';
import type { ResilienceStatusProps } from './ResilienceStatus';
import {
  selectAssetConnections,
  selectRelatedAssets,
} from '../application/infrastructureSelectors';
import type { WorldState } from '../domain/world';
import type { NetworkRule } from '../domain/access';
import { selectConnectionRule } from '../application/selectPlayerView';
import { AssetIcon } from './AssetIcon';
import {
  assetLabels,
  connectionLabels,
  statusLabels,
} from './infrastructurePresentation';
import type { MapSelection } from './infrastructurePresentation';
import type { IntegrityView } from '../application/selectIntegrityView';

interface Props {
  experience?: GameplayExperience | undefined;
  vendor?: import('../application/selectVendorView').VendorView | undefined;
  resilience?: ResilienceStatusProps | undefined;
  world: WorldState;
  selection: MapSelection;
  onSelect: (selection: MapSelection) => void;
  networkRules?: readonly NetworkRule[];
  endpoint?: IntegrityView['endpoint'] | undefined;
}

export function InfrastructureInspector({
  world,
  experience,
  resilience,
  selection,
  onSelect,
  networkRules = [],
  endpoint,
  vendor,
}: Props) {
  const asset =
    selection?.kind === 'asset'
      ? world.assets.find((item) => item.id === selection.id)
      : undefined;
  const connection =
    selection?.kind === 'connection'
      ? world.connections.find((item) => item.id === selection.id)
      : undefined;
  const rule = selectConnectionRule(networkRules, connection);
  const vendorNote =
    vendor &&
    (asset?.id === 'carrier-api' ||
      (connection?.sourceAssetId === 'vpn' &&
        ['fs-01', 'carrier-api'].includes(connection.targetAssetId)));

  return (
    <aside className="inspector" aria-label="Inspektor infrastruktury">
      <div className="inspector-heading">
        <span className="eyebrow">Inspektor</span>
        <span className="eyebrow muted">
          {asset ? 'Zasób' : connection ? 'Relacja' : 'Wybierz element'}
        </span>
      </div>
      {vendorNote && (
        <section className="inspector-section">
          <h3>Obowiązkowy wyjątek CARGO-LINK</h3>
          <p>
            {vendor!.accountId} ·{' '}
            {vendor!.exception
              ? `${vendor!.exception.scope}, termin ${String(Math.floor(vendor!.exception.expiresAtMinute / 60)).padStart(2, '0')}:${String(vendor!.exception.expiresAtMinute % 60).padStart(2, '0')}, stan ${vendor!.expired ? 'expired' : vendor!.exception.status}`
              : 'brak zatwierdzenia — odmowa'}
            .
          </p>
          <p>
            ACL i uprawnienie nie zastępują zatwierdzenia. Wyjątek wygasa także
            dla istniejących sesji; ogólna reguła allow go nie omija.
          </p>
        </section>
      )}
      {asset ? (
        <>
          <div className="inspector-icon">
            <AssetIcon kind={asset.kind} />
          </div>
          <p className="eyebrow muted">{assetLabels[asset.kind]}</p>
          <h2>{asset.name}</h2>
          {endpoint?.assetId === asset.id && (
            <section className="inspector-section">
              <h3>Podzasób logiczny: {endpoint.id}</h3>
              <p>
                Jedna z istniejących 94 stacji, lokalny kontekst{' '}
                {endpoint.accountId}. Izolacja:{' '}
                {endpoint.isolated ? 'tak' : 'nie'}; zapis:{' '}
                {endpoint.writesRestricted
                  ? 'ograniczony'
                  : 'dozwolony uprawnieniem'}
                .
              </p>
              <p>
                ERP/HTTPS i FS-01/SMB. Odczyt dokumentów wspiera{' '}
                {endpoint.businessCapacity} zamówienia na turę. Konfiguracja nie
                dowodzi kompromitacji. Działania dostępne w panelu zespołu.
              </p>
            </section>
          )}
          {resilience && ['workstations', 'fs-01'].includes(asset.id) && (
            <ResilienceStatus {...resilience} />
          )}
          <span className={`status-badge status-${asset.status}`}>
            ● {statusLabels[asset.status]} operacyjnie
          </span>
          <p className="inspector-description">{asset.description}</p>
          {experience && (
            <section className="inspector-section">
              <h3>Twoje dowody i możliwe decyzje</h3>
              {experience.signals
                .filter((o) => o.assets.includes(asset.id))
                .slice(-3)
                .map((o) => (
                  <p key={o.id}>
                    {formatMinute(o.obtained)} · {o.source}: {o.text}
                  </p>
                ))}
              {!experience.signals.some((o) => o.assets.includes(asset.id)) && (
                <p>Nie pozyskano obserwacji dotyczących tego zasobu.</p>
              )}
              <p>
                Powiązane procesy:{' '}
                {experience.business
                  .filter((b) => b.assets.includes(asset.id))
                  .map((b) => b.name)
                  .join(', ') || 'brak opisanej części procesu'}
                .
              </p>
              <ul>
                {[
                  ...new Map(
                    experience.actions
                      .filter((a) => a.assets.includes(asset.id))
                      .map((a) => [a.action.type, a]),
                  ).values(),
                ].map((a) => (
                  <li key={a.action.type}>
                    <a href="#team-actions">{a.label}</a>
                    <small>
                      {a.reason ??
                        `${a.workerId === 'administrator' ? 'Administrator' : 'Analityk'} · ${a.turns * 5} min`}
                    </small>
                  </li>
                ))}
              </ul>
              <p>
                Filtr działań zespołu odpowiada wybranemu zasobowi. Wybierz
                grupę INVESTIGATE, CONTAIN, RECOVER lub INFRASTRUCTURE.
              </p>
            </section>
          )}
          <dl className="facts">
            <div>
              <dt>Strefa</dt>
              <dd>
                {world.zones.find((zone) => zone.id === asset.zoneId)?.name ??
                  asset.zoneId}
              </dd>
            </div>
            <div>
              <dt>Właściciel</dt>
              <dd>
                {world.teams.find((team) => team.id === asset.ownerTeamId)
                  ?.name ?? asset.ownerTeamId}
              </dd>
            </div>
          </dl>
          {asset.businessRole && (
            <section className="inspector-section">
              <h3>Znaczenie dla firmy</h3>
              <p>{asset.businessRole}</p>
            </section>
          )}
          <section className="inspector-section">
            <h3>Usługi i protokoły</h3>
            <div className="chips">
              {asset.protocols.map((protocol) => (
                <span className="chip" key={protocol}>
                  {protocol}
                </span>
              ))}
            </div>
          </section>
          <section className="inspector-section">
            <h3>
              Powiązane zasoby{' '}
              <span>{selectRelatedAssets(world, asset.id).length}</span>
            </h3>
            <div className="related-assets">
              {selectRelatedAssets(world, asset.id).map((related) => (
                <button
                  key={related.id}
                  onClick={() => onSelect({ kind: 'asset', id: related.id })}
                >
                  {related.name}
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </section>
          <section className="inspector-section">
            <h3>Relacje · wszystkie warstwy</h3>
            <div className="relation-list">
              {selectAssetConnections(world, asset.id).map((relation) => {
                const outgoing = relation.sourceAssetId === asset.id;
                const other = world.assets.find(
                  (item) =>
                    item.id ===
                    (outgoing
                      ? relation.targetAssetId
                      : relation.sourceAssetId),
                );
                return (
                  <button
                    key={relation.id}
                    onClick={() =>
                      onSelect({ kind: 'connection', id: relation.id })
                    }
                  >
                    <span className={`relation-kind kind-${relation.kind}`}>
                      {connectionLabels[relation.kind]}
                    </span>
                    <span>
                      {outgoing ? '→' : '←'} {other?.name}
                    </span>
                    <small>
                      {relation.protocol ? `${relation.protocol} · ` : ''}
                      {relation.label}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
          <p className="inspector-footnote">
            Status operacyjny opisuje dostępność. Stan zabezpieczeń nie został
            oceniony.
          </p>
        </>
      ) : connection ? (
        <>
          <div
            className={`connection-emblem kind-${connection.kind}`}
            aria-hidden="true"
          >
            ⇢
          </div>
          <p className={`eyebrow kind-${connection.kind}`}>
            {connectionLabels[connection.kind]}
          </p>
          <h2>{connection.label}</h2>
          <div className="connection-endpoints">
            {(['sourceAssetId', 'targetAssetId'] as const).map((key, index) => {
              const endpoint = world.assets.find(
                (item) => item.id === connection[key],
              );
              return (
                <div key={key}>
                  <span className="eyebrow muted">
                    {index === 0 ? 'Źródło' : 'Cel'}
                  </span>
                  <button
                    onClick={() =>
                      onSelect({ kind: 'asset', id: connection[key] })
                    }
                  >
                    {endpoint?.name ?? connection[key]}
                    <span aria-hidden="true">→</span>
                  </button>
                  {index === 0 && (
                    <span className="endpoint-arrow" aria-hidden="true">
                      ↓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <dl className="facts">
            <div>
              <dt>Typ relacji</dt>
              <dd>{connectionLabels[connection.kind]}</dd>
            </div>
            {connection.protocol && (
              <div>
                <dt>Protokół</dt>
                <dd>{connection.protocol}</dd>
              </div>
            )}
          </dl>
          <section className="inspector-section">
            <h3>Znaczenie relacji</h3>
            <p>{connection.description}</p>
          </section>
          {connection.kind === 'network' && (
            <div className="context-note">
              {rule
                ? `Polityka ${rule.id}: ${rule.action === 'allow' ? 'dopuszczaj' : 'blokuj'}. Brama ponownie ocenia również istniejący ruch po zmianie reguły.`
                : 'Ten przepływ nie ma zdefiniowanej reguły w bieżącej symulacji.'}{' '}
              Dostęp do usługi wymaga osobno ważnej sesji i uprawnienia.
            </div>
          )}
        </>
      ) : (
        <div className="inspector-empty">
          <span aria-hidden="true">⌖</span>
          <h2>Poznaj swoją infrastrukturę</h2>
          <p>
            Wybierz zasób lub strzałkę na mapie, aby poznać jego rolę i
            powiązania.
          </p>
        </div>
      )}
    </aside>
  );
}
