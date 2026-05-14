import type { MapConfig } from '../../types/index.js';
import type { PathGraph, SpawnPoint } from './types.js';

export interface ResolvedGraph {
  spawns: SpawnPoint[];
  pathGraph: PathGraph;
}

export function resolveGraphFromMap(map: MapConfig): ResolvedGraph {
  if (map.pathGraph === undefined || map.pathGraph === null) {
    throw new Error('[loaderAdapter] map.pathGraph is missing — B.15 requires every MapConfig to declare pathGraph+spawns explicitly');
  }
  if (map.spawns === undefined || map.spawns === null) {
    throw new Error('[loaderAdapter] map.pathGraph is present but spawns is missing');
  }
  return { spawns: map.spawns, pathGraph: map.pathGraph };
}
