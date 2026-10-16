import type {
  AssetId,
  ConnectionKind,
  InfrastructureConnection,
} from '../domain/infrastructure';
import type { WorldState } from '../domain/world';

export type MapLayer = 'network' | 'identity' | 'business' | 'telemetry';

const connectionLayers: Record<ConnectionKind, MapLayer> = {
  network: 'network',
  authentication: 'identity',
  authorization: 'identity',
  'business-dependency': 'business',
  observation: 'telemetry',
};

export function getConnectionLayer(kind: ConnectionKind): MapLayer {
  return connectionLayers[kind];
}

export function selectLayerConnections(world: WorldState, layer: MapLayer) {
  return world.connections.filter(
    (connection) => getConnectionLayer(connection.kind) === layer,
  );
}

export function selectAssetConnections(world: WorldState, assetId: AssetId) {
  return world.connections.filter(
    (connection) =>
      connection.sourceAssetId === assetId ||
      connection.targetAssetId === assetId,
  );
}

/** Oba kierunki, bez duplikatów i bez zwracania wybranego zasobu. */
export function selectRelatedAssets(
  world: WorldState,
  assetId: AssetId,
  connections: readonly InfrastructureConnection[] = world.connections,
) {
  const relatedIds = new Set(
    connections.flatMap((connection) => {
      if (connection.sourceAssetId === assetId)
        return [connection.targetAssetId];
      if (connection.targetAssetId === assetId)
        return [connection.sourceAssetId];
      return [];
    }),
  );

  return world.assets.filter(
    (asset) => asset.id !== assetId && relatedIds.has(asset.id),
  );
}
