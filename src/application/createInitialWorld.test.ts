import { describe, expect, it } from 'vitest';
import { nexusInfrastructure } from '../content/nexusInfrastructure';
import { createInitialWorld } from './createInitialWorld';

describe('scenariusz NEXUS Logistics', () => {
  it('zawiera dokładnie dziewięć wymaganych zasobów', () => {
    const world = createInitialWorld();
    expect(world.organizationId).toBe('nexus-logistics');
    expect(world.assets.map((asset) => asset.id).sort()).toEqual([
      'ad',
      'erp',
      'firewall',
      'fs-01',
      'internet',
      'm365',
      'vpn',
      'web',
      'workstations',
    ]);
  });

  it('ma unikalne identyfikatory zasobów, relacji, stref i właścicieli', () => {
    const world = createInitialWorld();
    for (const collection of [
      world.assets,
      world.connections,
      world.zones,
      world.teams,
    ]) {
      expect(new Set(collection.map((entity) => entity.id)).size).toBe(
        collection.length,
      );
    }
  });

  it('odwołuje się wyłącznie do istniejących zasobów, stref i właścicieli', () => {
    const world = createInitialWorld();
    const assetIds = world.assets.map((asset) => asset.id);
    for (const asset of world.assets) {
      expect(world.zones.some((zone) => zone.id === asset.zoneId)).toBe(true);
      expect(world.teams.some((team) => team.id === asset.ownerTeamId)).toBe(
        true,
      );
      expect(asset.description.length).toBeGreaterThan(0);
      expect(asset.protocols.length).toBeGreaterThan(0);
    }
    for (const connection of world.connections) {
      expect(assetIds).toContain(connection.sourceAssetId);
      expect(assetIds).toContain(connection.targetAssetId);
      expect(connection.sourceAssetId).not.toBe(connection.targetAssetId);
    }
  });

  it('używa znanych rodzajów relacji i nie dopisuje sensorów ani uprawnień', () => {
    const connections = createInitialWorld().connections;
    for (const connection of connections) {
      expect([
        'network',
        'authentication',
        'authorization',
        'business-dependency',
        'observation',
      ]).toContain(connection.kind);
      expect(connection.description.length).toBeGreaterThan(0);
      if (connection.kind === 'network')
        expect(connection.protocol).toBeTruthy();
    }
    expect(
      connections.filter((connection) =>
        ['authorization', 'observation'].includes(connection.kind),
      ),
    ).toEqual([]);
  });

  it('zachowuje osobne kierunkowe przepływy VPN → ERP HTTPS i VPN → FS-01 SMB', () => {
    expect(createInitialWorld().connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceAssetId: 'vpn',
          targetAssetId: 'erp',
          kind: 'network',
          protocol: 'HTTPS',
        }),
        expect.objectContaining({
          sourceAssetId: 'vpn',
          targetAssetId: 'fs-01',
          kind: 'network',
          protocol: 'SMB',
        }),
      ]),
    );
  });

  it('izoluje encje i zagnieżdżone kolekcje nowych światów oraz wzorca treści', () => {
    const first = createInitialWorld();
    const second = createInitialWorld();
    expect(first).toEqual(second);
    expect(first).toEqual(nexusInfrastructure);

    // Symulacja przyszłej zmiany w czasie wykonania: readonly nie zamraża JS.
    const mutable = first as unknown as {
      assets: { name: string; protocols: string[] }[];
      connections: { description: string }[];
      zones: { name: string }[];
      teams: { name: string }[];
    };
    mutable.assets[0]!.name = 'Zmieniony zasób';
    mutable.assets[0]!.protocols.push('TEST');
    mutable.connections[0]!.description = 'Zmieniona relacja';
    mutable.zones[0]!.name = 'Zmieniona strefa';
    mutable.teams[0]!.name = 'Zmieniony właściciel';
    expect(first).not.toEqual(second);
    expect(second).toEqual(nexusInfrastructure);
    expect(createInitialWorld()).toEqual(second);
  });
});
