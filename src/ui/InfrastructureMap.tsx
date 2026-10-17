import type { ResilienceStatusProps } from './ResilienceStatus';
import { useId } from 'react';
import type { KeyboardEvent } from 'react';
import { selectRelatedAssets } from '../application/infrastructureSelectors';
import type { InfrastructureConnection } from '../domain/infrastructure';
import type { WorldState } from '../domain/world';
import { AssetIcon } from './AssetIcon';
import {
  assetLabels,
  connectionLabels,
  statusLabels,
} from './infrastructurePresentation';
import type { MapSelection } from './infrastructurePresentation';
import { connectionPath, createMapLayout, nodeSize } from './mapLayout';

interface Props {
  resilience?: ResilienceStatusProps | undefined;
  world: WorldState;
  connections: readonly InfrastructureConnection[];
  selection: MapSelection;
  onSelect: (selection: MapSelection) => void;
}

export function InfrastructureMap({
  world,
  resilience,
  connections,
  selection,
  onSelect,
}: Props) {
  const markerPrefix = useId().replaceAll(':', '');
  const layout = createMapLayout(world);
  const selectedConnection =
    selection?.kind === 'connection'
      ? connections.find((connection) => connection.id === selection.id)
      : undefined;
  const highlighted = new Set<string>();
  if (selection?.kind === 'asset') {
    highlighted.add(selection.id);
    selectRelatedAssets(world, selection.id, connections).forEach((asset) =>
      highlighted.add(asset.id),
    );
  } else if (selectedConnection) {
    highlighted.add(selectedConnection.sourceAssetId);
    highlighted.add(selectedConnection.targetAssetId);
  }

  function keyboardSelect(
    event: KeyboardEvent<SVGGElement>,
    value: MapSelection,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(value);
    }
  }

  const kinds = [...new Set(connections.map((connection) => connection.kind))];

  return (
    <div
      className="map-scroll"
      tabIndex={0}
      aria-label="Mapa infrastruktury — przewijany obszar"
    >
      <svg
        className="infrastructure-map"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="group"
        aria-label="Interaktywna mapa NEXUS Logistics"
      >
        <defs>
          <pattern
            id={`${markerPrefix}-grid`}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M24 0H0V24"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
          {kinds.map((kind) => (
            <marker
              key={kind}
              id={`${markerPrefix}-${kind}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path
                d="M1 1L9 5L1 9"
                fill="none"
                className={`arrow arrow-${kind}`}
              />
            </marker>
          ))}
        </defs>
        <rect
          className="map-grid"
          width={layout.width}
          height={layout.height}
          fill={`url(#${markerPrefix}-grid)`}
        />
        {layout.zones.map((zone) => (
          <g key={zone.id} className="map-zone" data-zone-id={zone.id}>
            <rect
              x={zone.x}
              y={zone.y}
              width={zone.width}
              height={zone.height}
              rx="16"
            />
            <text x={zone.x + 20} y={zone.y + 28}>
              {zone.name.toUpperCase()}
            </text>
            <title>{zone.description}</title>
          </g>
        ))}
        {connections.map((connection, index) => {
          const source = layout.positions.get(connection.sourceAssetId);
          const target = layout.positions.get(connection.targetAssetId);
          if (!source || !target) return null;
          const geometry = connectionPath(source, target, index);
          const sourceName = world.assets.find(
            (asset) => asset.id === connection.sourceAssetId,
          )?.name;
          const targetName = world.assets.find(
            (asset) => asset.id === connection.targetAssetId,
          )?.name;
          const selected =
            selection?.kind === 'connection' && selection.id === connection.id;
          const related =
            selected ||
            (selection?.kind === 'asset' &&
              [connection.sourceAssetId, connection.targetAssetId].includes(
                selection.id,
              ));
          const label = connection.protocol ?? connection.label;
          return (
            <g
              key={connection.id}
              role="button"
              tabIndex={0}
              aria-label={`${sourceName} → ${targetName}: ${connectionLabels[connection.kind]}, ${label}`}
              aria-pressed={selected}
              data-connection-id={connection.id}
              data-kind={connection.kind}
              className={`map-edge edge-${connection.kind}${related ? ' is-related' : ''}${selection && !related ? ' is-dimmed' : ''}${selected ? ' is-selected' : ''}`}
              onClick={() =>
                onSelect({ kind: 'connection', id: connection.id })
              }
              onKeyDown={(event) =>
                keyboardSelect(event, { kind: 'connection', id: connection.id })
              }
            >
              <title>{connection.description}</title>
              <path className="edge-hit-area" d={geometry.path} />
              <path
                className="edge-line"
                d={geometry.path}
                markerEnd={`url(#${markerPrefix}-${connection.kind})`}
              />
              <g
                className="edge-label"
                transform={`translate(${geometry.label.x}, ${geometry.label.y})`}
              >
                <rect
                  x={-Math.max(25, label.length * 3.4 + 10)}
                  y="-12"
                  width={Math.max(50, label.length * 6.8 + 20)}
                  height="24"
                  rx="6"
                />
                <text textAnchor="middle" dominantBaseline="central">
                  {label}
                </text>
              </g>
            </g>
          );
        })}
        {world.assets.map((asset) => {
          const position = layout.positions.get(asset.id);
          if (!position) return null;
          const selected =
            selection?.kind === 'asset' && selection.id === asset.id;
          const related = highlighted.has(asset.id);
          return (
            <g
              key={asset.id}
              role="button"
              tabIndex={0}
              aria-label={`Zasób: ${asset.name}`}
              aria-pressed={selected}
              data-asset-id={asset.id}
              className={`map-node${selected ? ' is-selected' : ''}${related ? ' is-related' : ''}${selection && !related ? ' is-dimmed' : ''}`}
              transform={`translate(${position.x - nodeSize.width / 2}, ${position.y - nodeSize.height / 2})`}
              onClick={() => onSelect({ kind: 'asset', id: asset.id })}
              onKeyDown={(event) =>
                keyboardSelect(event, { kind: 'asset', id: asset.id })
              }
            >
              <title>{asset.description}</title>
              <rect
                className="node-card"
                width={nodeSize.width}
                height={nodeSize.height}
                rx="11"
              />
              <svg x="14" y="15" width="25" height="25">
                <AssetIcon kind={asset.kind} />
              </svg>
              <text className="node-name" x="49" y="27">
                {asset.id === 'carrier-api' ? 'CARGO-LINK Gateway' : asset.name}
              </text>
              <text className="node-kind" x="49" y="44">
                {asset.id === 'workstations' && resilience?.coverage
                  ? 'EDR: pakowanie-03 / 94'
                  : asset.id === 'fs-01' && resilience?.backup
                    ? `Kopia: ${resilience.backup.integrity === 'clean' ? 'sprawdzona' : resilience.backup.integrity === 'damaged' ? 'niezgodna' : 'niedostępna'}`
                    : assetLabels[asset.kind]}
              </text>
              <circle
                className={`status-dot status-${asset.status}`}
                cx="20"
                cy="67"
                r="3"
              />
              <text className="node-status" x="30" y="71">
                {statusLabels[asset.status]}
              </text>
              <text className="node-open" x="175" y="71" aria-hidden="true">
                →
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
