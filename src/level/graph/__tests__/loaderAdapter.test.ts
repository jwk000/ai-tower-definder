import { describe, it, expect } from 'vitest';
import { resolveGraphFromMap } from '../loaderAdapter.js';
import type { MapConfig } from '../../../types/index.js';

const BASE_MAP_FIELDS: Omit<MapConfig, 'enemyPath' | 'spawns' | 'pathGraph'> = {
  name: 'test',
  cols: 5,
  rows: 5,
  tileSize: 64,
  tiles: [[]],
};

describe('resolveGraphFromMap: pathGraph present (new format)', () => {
  it('returns existing spawns + pathGraph as-is', () => {
    const map: MapConfig = {
      ...BASE_MAP_FIELDS,
      enemyPath: [{ row: 0, col: 0 }, { row: 0, col: 4 }],
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

  it('ignores enemyPath when pathGraph is present', () => {
    const map: MapConfig = {
      ...BASE_MAP_FIELDS,
      enemyPath: [{ row: 0, col: 0 }, { row: 99, col: 99 }],
      spawns: [{ id: 'spawn_0', row: 0, col: 0 }],
      pathGraph: {
        nodes: [
          { id: 'n0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_0' },
          { id: 'n1', row: 0, col: 4, role: 'crystal_anchor' },
        ],
        edges: [{ from: 'n0', to: 'n1' }],
      },
    };
    const r = resolveGraphFromMap(map);
    expect(r.pathGraph.nodes.length).toBe(2);
    expect(r.pathGraph.nodes[1]!.col).toBe(4);
  });
});

describe('resolveGraphFromMap: only enemyPath (legacy format)', () => {
  it('migrates enemyPath to graph on the fly', () => {
    const map: MapConfig = {
      ...BASE_MAP_FIELDS,
      enemyPath: [
        { row: 0, col: 0 },
        { row: 0, col: 4 },
        { row: 4, col: 4 },
      ],
    };
    const r = resolveGraphFromMap(map);
    expect(r.spawns).toHaveLength(1);
    expect(r.spawns[0]!.id).toBe('spawn_0');
    expect(r.spawns[0]!.row).toBe(0);
    expect(r.spawns[0]!.col).toBe(0);
    expect(r.pathGraph.nodes).toHaveLength(3);
    expect(r.pathGraph.nodes[0]!.role).toBe('spawn');
    expect(r.pathGraph.nodes[2]!.role).toBe('crystal_anchor');
    expect(r.pathGraph.edges).toHaveLength(2);
  });

  it('migration result chain order matches enemyPath order', () => {
    const map: MapConfig = {
      ...BASE_MAP_FIELDS,
      enemyPath: [
        { row: 2, col: 0 },
        { row: 2, col: 3 },
        { row: 5, col: 3 },
        { row: 5, col: 7 },
      ],
    };
    const r = resolveGraphFromMap(map);
    const positions = r.pathGraph.nodes.map((n) => `${n.row},${n.col}`);
    expect(positions).toEqual(['2,0', '2,3', '5,3', '5,7']);
  });
});

describe('resolveGraphFromMap: error cases', () => {
  it('throws when both enemyPath and pathGraph are missing/empty', () => {
    const map = {
      ...BASE_MAP_FIELDS,
      enemyPath: [],
    } as unknown as MapConfig;
    expect(() => resolveGraphFromMap(map)).toThrow();
  });

  it('throws when enemyPath has only 1 node (cannot form an edge)', () => {
    const map: MapConfig = {
      ...BASE_MAP_FIELDS,
      enemyPath: [{ row: 0, col: 0 }],
    };
    expect(() => resolveGraphFromMap(map)).toThrow();
  });

  it('throws when pathGraph is present but spawns is missing', () => {
    const map = {
      ...BASE_MAP_FIELDS,
      enemyPath: [{ row: 0, col: 0 }, { row: 0, col: 4 }],
      pathGraph: {
        nodes: [
          { id: 'n0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_0' },
          { id: 'n1', row: 0, col: 4, role: 'crystal_anchor' },
        ],
        edges: [{ from: 'n0', to: 'n1' }],
      },
    } as unknown as MapConfig;
    expect(() => resolveGraphFromMap(map)).toThrow();
  });
});

describe('resolveGraphFromMap: type compatibility', () => {
  it('accepts MapConfig literal with only required enemyPath (legacy levels)', () => {
    const legacyMap: MapConfig = {
      ...BASE_MAP_FIELDS,
      enemyPath: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    };
    expect(() => resolveGraphFromMap(legacyMap)).not.toThrow();
  });
});
