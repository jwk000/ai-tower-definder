import { describe, it, expect } from 'vitest';
import { resolveGraphFromMap } from '../loaderAdapter.js';
import type { MapConfig } from '../../../types/index.js';

const BASE_MAP_FIELDS: Omit<MapConfig, 'spawns' | 'pathGraph'> = {
  name: 'test',
  cols: 5,
  rows: 5,
  tileSize: 64,
  tiles: [[]],
};

describe('resolveGraphFromMap B.15 — pathGraph is the single source of truth', () => {
  it('returns existing spawns + pathGraph as-is when both are well-formed', () => {
    const map: MapConfig = {
      ...BASE_MAP_FIELDS,
      spawns: [{ id: 'spawn_a', row: 0, col: 0 }, { id: 'spawn_b', row: 4, col: 0 }],
      pathGraph: {
        nodes: [
          { id: 'na', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_a' },
          { id: 'nb', row: 4, col: 0, role: 'spawn', spawnId: 'spawn_b' },
          { id: 'nc', row: 0, col: 4, role: 'crystal_anchor' },
        ],
        edges: [
          { from: 'na', to: 'nc' },
          { from: 'nb', to: 'nc' },
        ],
      },
    };
    const r = resolveGraphFromMap(map);
    expect(r.spawns).toBe(map.spawns);
    expect(r.pathGraph).toBe(map.pathGraph);
  });
});

describe('resolveGraphFromMap B.15 — error cases', () => {
  it('throws when pathGraph is missing', () => {
    const map = { ...BASE_MAP_FIELDS } as MapConfig;
    expect(() => resolveGraphFromMap(map)).toThrow(/pathGraph is missing/);
  });

  it('throws when pathGraph is present but spawns is missing', () => {
    const map = {
      ...BASE_MAP_FIELDS,
      pathGraph: {
        nodes: [
          { id: 'n0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_0' },
          { id: 'n1', row: 0, col: 4, role: 'crystal_anchor' },
        ],
        edges: [{ from: 'n0', to: 'n1' }],
      },
    } as unknown as MapConfig;
    expect(() => resolveGraphFromMap(map)).toThrow(/spawns is missing/);
  });
});
