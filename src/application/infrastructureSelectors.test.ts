import { describe, expect, it } from 'vitest';
import type { InfrastructureConnection } from '../domain/infrastructure';
import { createInitialWorld } from './createInitialWorld';
import {
  selectAssetConnections,
  selectLayerConnections,
  selectRelatedAssets,
} from './infrastructureSelectors';

describe('warstwy mapy', () => {
  it('rozdziela sieć, tożsamość i biznes, pozostawiając telemetrię pustą', () => {
    const world = createInitialWorld();
    expect(
      selectLayerConnections(world, 'network').map(
        (connection) => connection.id,
      ),
    ).toEqual([
      'internet-firewall',
      'firewall-web',
      'firewall-vpn',
      'vpn-erp',
      'vpn-files',
      'workstations-erp',
    ]);
    expect(
      selectLayerConnections(world, 'identity').map(
        (connection) => connection.id,
      ),
    ).toEqual(['vpn-ad', 'workstations-ad']);
    expect(
      selectLayerConnections(world, 'business').map(
        (connection) => connection.id,
      ),
    ).toEqual(['operations-erp', 'operations-files', 'operations-m365']);
    expect(selectLayerConnections(world, 'telemetry')).toEqual([]);
  });

  it('obsługuje autoryzację i obserwacje z dowolnego świata, zamiast zaszywać scenariusz', () => {
    const world = createInitialWorld();
    const authorization: InfrastructureConnection = {
      id: 'test-authorization',
      sourceAssetId: 'workstations',
      targetAssetId: 'fs-01',
      kind: 'authorization',
      label: 'Testowe uprawnienie',
      description: 'Wyłącznie fixture testowa.',
    };
    const observation: InfrastructureConnection = {
      ...authorization,
      id: 'test-observation',
      kind: 'observation',
    };
    const customWorld = { ...world, connections: [authorization, observation] };
    expect(selectLayerConnections(customWorld, 'identity')).toEqual([
      authorization,
    ]);
    expect(selectLayerConnections(customWorld, 'telemetry')).toEqual([
      observation,
    ]);
    expect(selectLayerConnections(customWorld, 'network')).toEqual([]);
    expect(world.connections).not.toContain(authorization);
  });
});

describe('powiązania zasobu', () => {
  it('uwzględnia relacje przychodzące i wychodzące', () => {
    const world = createInitialWorld();
    expect(
      selectAssetConnections(world, 'vpn').map((connection) => connection.id),
    ).toEqual(['firewall-vpn', 'vpn-erp', 'vpn-files', 'vpn-ad']);
    expect(
      selectRelatedAssets(world, 'vpn')
        .map((asset) => asset.id)
        .sort(),
    ).toEqual(['ad', 'erp', 'firewall', 'fs-01']);
  });

  it('nie duplikuje zasobu przy relacjach różnych rodzajów', () => {
    const related = selectRelatedAssets(createInitialWorld(), 'workstations');
    expect(related.filter((asset) => asset.id === 'erp')).toHaveLength(1);
    expect(related.map((asset) => asset.id).sort()).toEqual([
      'ad',
      'erp',
      'fs-01',
      'm365',
    ]);
  });

  it('ogranicza powiązania do przekazanej warstwy bez mutacji świata', () => {
    const world = createInitialWorld();
    const before = structuredClone(world);
    expect(
      selectRelatedAssets(
        world,
        'vpn',
        selectLayerConnections(world, 'identity'),
      ).map((asset) => asset.id),
    ).toEqual(['ad']);
    expect(selectRelatedAssets(world, 'vpn', [])).toEqual([]);
    expect(world).toEqual(before);
  });

  it('bezpiecznie obsługuje nieznany identyfikator', () => {
    const world = createInitialWorld();
    expect(selectRelatedAssets(world, 'missing')).toEqual([]);
    expect(selectAssetConnections(world, 'missing')).toEqual([]);
  });
});
