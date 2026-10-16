import type { WorldState } from '../domain/world';

export interface Point {
  x: number;
  y: number;
}
export const nodeSize = { width: 194, height: 88 };

/** Układ zależy wyłącznie od stref i kolejności zasobów, nigdy od ich ID. */
export function createMapLayout(world: WorldState) {
  const zoneHeight = Math.max(
    300,
    ...world.zones.map((zone) => {
      const count = world.assets.filter(
        (asset) => asset.zoneId === zone.id,
      ).length;
      const columns = count > 2 ? 2 : 1;
      return 40 + Math.ceil(count / columns) * 130;
    }),
  );
  let column = 0;
  let row = 0;
  const positions = new Map<string, Point>();
  const zones = world.zones.map((zone) => {
    const assets = world.assets.filter((asset) => asset.zoneId === zone.id);
    const span = assets.length > 2 ? 2 : 1;
    if (column + span > 3) {
      column = 0;
      row += 1;
    }
    const bounds = {
      x: 28 + column * 322,
      y: 24 + row * (zoneHeight + 24),
      width: span * 322 - 22,
      height: zoneHeight,
    };
    assets.forEach((asset, index) => {
      positions.set(asset.id, {
        x: bounds.x + (bounds.width * ((index % span) + 0.5)) / span,
        y: bounds.y + 100 + Math.floor(index / span) * 130,
      });
    });
    column += span;
    return { ...zone, ...bounds };
  });
  return {
    zones,
    positions,
    width: 1000,
    height: 24 + (row + 1) * (zoneHeight + 24),
  };
}

export function connectionPath(source: Point, target: Point, lane: number) {
  const halfWidth = nodeSize.width / 2;
  const halfHeight = nodeSize.height / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  // Oddzielne boczne tory dla zasobów w tej samej kolumnie.
  if (Math.abs(dx) < 120) {
    const sx = source.x + halfWidth;
    const tx = target.x + halfWidth;
    const bend = 55 + (lane % 3) * 24;
    return {
      path: `M ${sx} ${source.y} C ${sx + bend} ${source.y}, ${tx + bend} ${target.y}, ${tx} ${target.y}`,
      label: { x: (sx + tx) / 2 + bend * 0.75, y: (source.y + target.y) / 2 },
    };
  }

  // Długie relacje przechodzą pod węzłami, zamiast przecinać ich karty.
  if (Math.abs(dx) > 500 && Math.abs(dy) > 70) {
    const y = Math.max(source.y, target.y) + halfHeight + 32 + (lane % 2) * 10;
    return {
      path: `M ${source.x} ${source.y + halfHeight} V ${y} H ${target.x} V ${target.y + halfHeight}`,
      label: { x: (source.x + target.x) / 2, y: y - 12 },
    };
  }

  const direction = Math.sign(dx);
  const sx = source.x + direction * halfWidth;
  const tx = target.x - direction * halfWidth;
  const middle = (sx + tx) / 2;
  return {
    path: `M ${sx} ${source.y} C ${middle} ${source.y}, ${middle} ${target.y}, ${tx} ${target.y}`,
    label: { x: middle, y: (source.y + target.y) / 2 - 14 },
  };
}
