import { describe, expect, it } from 'vitest';
import { createInitialWorld } from './createInitialWorld';

describe('createInitialWorld', () => {
  it('uruchamia NEXUS Logistics bez zasobów i relacji niezaładowanego scenariusza', () => {
    expect(createInitialWorld()).toEqual({
      organizationId: 'nexus-logistics',
      assets: [],
      connections: [],
    });
  });

  it('tworzy niezależne światy, aby nowa gra nie dziedziczyła kolekcji poprzedniej', () => {
    const first = createInitialWorld();
    const second = createInitialWorld();

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.assets).not.toBe(first.assets);
    expect(second.connections).not.toBe(first.connections);
  });
});
