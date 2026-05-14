import { describe, it, expect } from 'vitest';
import { linearizeForLegacy } from '../PathGraph.js';
import { migrateEnemyPathToGraph } from '../migration.js';
import type { PathGraph, PathNode, PathEdge, SpawnPoint } from '../types.js';
import type { GridPos } from '../../../types/index.js';

const node = (
  id: string,
  row: number,
  col: number,
  role: PathNode['role'],
  extra: Partial<PathNode> = {},
): PathNode => ({ id, row, col, role, ...extra });

const edge = (from: string, to: string, weight?: number): PathEdge =>
  weight !== undefined ? { from, to, weight } : { from, to };

function linearGraph(): { graph: PathGraph; spawns: SpawnPoint[] } {
  return {
    spawns: [{ id: 'sp', row: 0, col: 0 }],
    graph: {
      nodes: [
        node('n0', 0, 0, 'spawn', { spawnId: 'sp' }),
        node('n1', 0, 5, 'waypoint'),
        node('n2', 3, 5, 'waypoint'),
        node('n3', 3, 10, 'crystal_anchor'),
      ],
      edges: [edge('n0', 'n1'), edge('n1', 'n2'), edge('n2', 'n3')],
    },
  };
}

function branchingGraph(): { graph: PathGraph; spawns: SpawnPoint[] } {
  return {
    spawns: [{ id: 'sp', row: 0, col: 0 }],
    graph: {
      nodes: [
        node('n0', 0, 0, 'spawn', { spawnId: 'sp' }),
        node('a', 0, 5, 'waypoint'),
        node('b', 5, 0, 'waypoint'),
        node('e', 5, 5, 'crystal_anchor'),
      ],
      edges: [edge('n0', 'a'), edge('n0', 'b'), edge('a', 'e'), edge('b', 'e')],
    },
  };
}

function multiSpawnGraph(): { graph: PathGraph; spawns: SpawnPoint[] } {
  return {
    spawns: [
      { id: 'sp1', row: 0, col: 0 },
      { id: 'sp2', row: 9, col: 0 },
    ],
    graph: {
      nodes: [
        node('s1', 0, 0, 'spawn', { spawnId: 'sp1' }),
        node('s2', 9, 0, 'spawn', { spawnId: 'sp2' }),
        node('e', 5, 5, 'crystal_anchor'),
      ],
      edges: [edge('s1', 'e'), edge('s2', 'e')],
    },
  };
}

function portalGraph(): { graph: PathGraph; spawns: SpawnPoint[] } {
  return {
    spawns: [{ id: 'sp', row: 0, col: 0 }],
    graph: {
      nodes: [
        node('n0', 0, 0, 'spawn', { spawnId: 'sp' }),
        node('p', 0, 5, 'portal', { teleportTo: 'n1' }),
        node('n1', 10, 0, 'waypoint'),
        node('n2', 10, 5, 'crystal_anchor'),
      ],
      edges: [edge('n0', 'p'), edge('n1', 'n2')],
    },
  };
}

describe('linearizeForLegacy — single-chain graph contract', () => {
  it('linearizes spawn→waypoint→crystal_anchor into [GridPos] in order', () => {
    const { graph, spawns } = linearGraph();
    const result = linearizeForLegacy({ pathGraph: graph, spawns });
    expect(result).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 5 },
      { row: 3, col: 5 },
      { row: 3, col: 10 },
    ]);
  });

  it('returns a readonly array with at least 2 entries (spawn + crystal)', () => {
    const { graph, spawns } = linearGraph();
    const result = linearizeForLegacy({ pathGraph: graph, spawns });
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toEqual({ row: 0, col: 0 });
    expect(result[result.length - 1]).toEqual({ row: 3, col: 10 });
  });
});

describe('linearizeForLegacy — error cases (B.12a scope: single-chain only)', () => {
  it('throws on branching graph (node with > 1 outgoing edge)', () => {
    const { graph, spawns } = branchingGraph();
    expect(() => linearizeForLegacy({ pathGraph: graph, spawns })).toThrow(
      /分支|branch/i,
    );
  });

  it('throws on multi-spawn graph (more than 1 spawn role)', () => {
    const { graph, spawns } = multiSpawnGraph();
    expect(() => linearizeForLegacy({ pathGraph: graph, spawns })).toThrow(
      /多生成口|multiple spawn|multi-spawn/i,
    );
  });

  it('throws on graph with portal node (not yet supported in B.12a)', () => {
    const { graph, spawns } = portalGraph();
    expect(() => linearizeForLegacy({ pathGraph: graph, spawns })).toThrow(
      /传送|portal/i,
    );
  });

  it('throws when no spawn node exists', () => {
    const graph: PathGraph = {
      nodes: [node('only', 0, 0, 'crystal_anchor')],
      edges: [],
    };
    expect(() => linearizeForLegacy({ pathGraph: graph, spawns: [] })).toThrow(
      /spawn/i,
    );
  });

  it('throws when no crystal_anchor is reachable', () => {
    const graph: PathGraph = {
      nodes: [
        node('s', 0, 0, 'spawn', { spawnId: 'sp' }),
        node('w', 0, 5, 'waypoint'),
      ],
      edges: [edge('s', 'w')],
    };
    expect(() =>
      linearizeForLegacy({ pathGraph: graph, spawns: [{ id: 'sp', row: 0, col: 0 }] }),
    ).toThrow(/crystal|终点|anchor/i);
  });
});

describe('linearizeForLegacy — round-trip equivalence with migrateEnemyPathToGraph', () => {
  /**
   * Core invariant of B.12a: for ANY legacy enemyPath, migrating to a graph
   * and then linearizing must reproduce the same waypoint sequence.
   * This is the "no-regression safety net" for MovementSystem refactor.
   */
  it('preserves a short straight path', () => {
    const enemyPath: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 5 },
      { row: 0, col: 10 },
    ];
    const { pathGraph, spawns } = migrateEnemyPathToGraph({ enemyPath });
    const linearized = linearizeForLegacy({ pathGraph, spawns });
    expect(linearized).toEqual(enemyPath);
  });

  it('preserves an L-shaped path', () => {
    const enemyPath: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 8 },
      { row: 4, col: 8 },
    ];
    const { pathGraph, spawns } = migrateEnemyPathToGraph({ enemyPath });
    const linearized = linearizeForLegacy({ pathGraph, spawns });
    expect(linearized).toEqual(enemyPath);
  });

  it('preserves a zigzag path with 6 waypoints', () => {
    const enemyPath: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 4 },
      { row: 3, col: 4 },
      { row: 3, col: 8 },
      { row: 6, col: 8 },
      { row: 6, col: 12 },
    ];
    const { pathGraph, spawns } = migrateEnemyPathToGraph({ enemyPath });
    const linearized = linearizeForLegacy({ pathGraph, spawns });
    expect(linearized).toEqual(enemyPath);
  });

  it('first linearized point equals first spawn, last equals crystal anchor', () => {
    const enemyPath: GridPos[] = [
      { row: 2, col: 3 },
      { row: 2, col: 7 },
      { row: 5, col: 7 },
    ];
    const { pathGraph, spawns } = migrateEnemyPathToGraph({ enemyPath });
    const linearized = linearizeForLegacy({ pathGraph, spawns });
    expect(linearized[0]).toEqual(enemyPath[0]);
    expect(linearized[linearized.length - 1]).toEqual(
      enemyPath[enemyPath.length - 1],
    );
  });
});
