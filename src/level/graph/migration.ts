import type { PathGraph, PathNode, PathEdge, SpawnPoint } from './types.js';

export interface LegacyEnemyPathInput {
  enemyPath: { row: number; col: number }[];
}

export interface MigrationResult {
  spawns: SpawnPoint[];
  pathGraph: PathGraph;
}

export function migrateEnemyPathToGraph(input: LegacyEnemyPathInput): MigrationResult {
  const path = input.enemyPath;
  if (!Array.isArray(path) || path.length < 2) {
    throw new Error('migrateEnemyPathToGraph: enemyPath 至少需要 2 个拐点');
  }

  const spawn: SpawnPoint = {
    id: 'spawn_0',
    row: path[0]!.row,
    col: path[0]!.col,
  };

  const nodes: PathNode[] = path.map((p, i) => {
    if (i === 0) {
      return { id: `n${i}`, row: p.row, col: p.col, role: 'spawn', spawnId: 'spawn_0' };
    }
    if (i === path.length - 1) {
      return { id: `n${i}`, row: p.row, col: p.col, role: 'crystal_anchor' };
    }
    return { id: `n${i}`, row: p.row, col: p.col, role: 'waypoint' };
  });

  const edges: PathEdge[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    edges.push({ from: `n${i}`, to: `n${i + 1}` });
  }

  return {
    spawns: [spawn],
    pathGraph: { nodes, edges },
  };
}
