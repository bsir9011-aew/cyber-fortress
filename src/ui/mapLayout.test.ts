import { describe, expect, it } from 'vitest';
import { createInitialWorld } from '../application/createInitialWorld';
import { connectionPath, createMapLayout, nodeSize } from './mapLayout';

describe('układ mapy na podstawie świata', () => {
  it('rozmieszcza wszystkie zasoby wewnątrz ich stref i obszaru mapy', () => {
    const world = createInitialWorld();
    const layout = createMapLayout(world);
    expect(layout.positions.size).toBe(9);
    for (const asset of world.assets) {
      const point = layout.positions.get(asset.id)!;
      const zone = layout.zones.find((item) => item.id === asset.zoneId)!;
      expect(point.x - nodeSize.width / 2).toBeGreaterThanOrEqual(zone.x);
      expect(point.x + nodeSize.width / 2).toBeLessThanOrEqual(
        zone.x + zone.width,
      );
      expect(point.y - nodeSize.height / 2).toBeGreaterThan(zone.y);
      expect(point.y + nodeSize.height / 2).toBeLessThan(zone.y + zone.height);
      expect(zone.y + zone.height).toBeLessThan(layout.height);
    }
  });

  it('obsługuje inny zestaw identyfikatorów bez wpisanej topologii NEXUS', () => {
    const world = createInitialWorld();
    const custom = {
      ...world,
      assets: world.assets.map((asset) => ({
        ...asset,
        id: `other-${asset.id}`,
      })),
    };
    const layout = createMapLayout(custom);
    expect(layout.positions.size).toBe(custom.assets.length);
    expect([...layout.positions.keys()]).toEqual(
      custom.zones.flatMap((zone) =>
        custom.assets
          .filter((asset) => asset.zoneId === zone.id)
          .map((asset) => asset.id),
      ),
    );
  });

  it('tworzy skończone ścieżki i etykiety dla wszystkich relacji świata', () => {
    const world = createInitialWorld();
    const { positions, width, height } = createMapLayout(world);
    for (const [index, connection] of world.connections.entries()) {
      const path = connectionPath(
        positions.get(connection.sourceAssetId)!,
        positions.get(connection.targetAssetId)!,
        index,
      );
      expect(path.path).not.toMatch(/NaN|undefined|Infinity/);
      expect(path.label.x).toBeGreaterThan(0);
      expect(path.label.x).toBeLessThan(width);
      expect(path.label.y).toBeGreaterThan(0);
      expect(path.label.y).toBeLessThan(height);
    }
  });
});
