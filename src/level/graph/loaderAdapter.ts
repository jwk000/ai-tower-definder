import type { MapConfig } from '../../types/index.js';
import type { PathGraph, SpawnPoint } from './types.js';
import { migrateEnemyPathToGraph } from './migration.js';

export interface ResolvedGraph {
  spawns: SpawnPoint[];
  pathGraph: PathGraph;
}

export function resolveGraphFromMap(map: MapConfig): ResolvedGraph {
  if (map.pathGraph !== undefined && map.pathGraph !== null) {
    if (map.spawns === undefined || map.spawns === null) {
      throw new Error('[loaderAdapter] pathGraph is present but spawns is missing');
    }
    return { spawns: map.spawns, pathGraph: map.pathGraph };
  }

  if (!Array.isArray(map.enemyPath) || map.enemyPath.length < 2) {
    throw new Error('[loaderAdapter] map has neither pathGraph nor a valid enemyPath (need >= 2 points)');
  }

  const result = migrateEnemyPathToGraph({ enemyPath: map.enemyPath });
  return { spawns: result.spawns, pathGraph: result.pathGraph };
}
