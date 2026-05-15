import type { SpawnPoint, PathNode } from '../../level/graph/types.js';
import type { MapModel, TileCell } from './levelModel.js';

const SPAWN_ID_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function generateSpawnId(existingIds: string[]): string {
  const used = new Set(existingIds);
  for (const ch of SPAWN_ID_LETTERS) {
    const candidate = `spawn_${ch}`;
    if (!used.has(candidate)) return candidate;
  }
  // More than 26 spawns: use two-letter suffix
  for (const a of SPAWN_ID_LETTERS) {
    for (const b of SPAWN_ID_LETTERS) {
      const candidate = `spawn_${a}${b}`;
      if (!used.has(candidate)) return candidate;
    }
  }
  return `spawn_${Date.now()}`;
}

function setTile(tiles: TileCell[][], row: number, col: number, value: TileCell): TileCell[][] {
  const newTiles = tiles.map((r, ri) =>
    ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r.slice(),
  );
  return newTiles;
}

export function addSpawn(map: MapModel, row: number, col: number): MapModel {
  const existingSpawns: SpawnPoint[] = map.spawns ?? [];
  const existingNodes: PathNode[] = map.pathGraph?.nodes ?? [];
  const existingEdges = map.pathGraph?.edges ?? [];

  // If a spawn already occupies this cell, remove it first (replace)
  const oldSpawn = existingSpawns.find((s) => s.row === row && s.col === col);

  const spawnsAfterRemove = oldSpawn
    ? existingSpawns.filter((s) => s.id !== oldSpawn.id)
    : existingSpawns;
  const nodesAfterRemove = oldSpawn
    ? existingNodes.filter((n) => !(n.role === 'spawn' && n.spawnId === oldSpawn.id))
    : existingNodes;

  const newId = generateSpawnId(spawnsAfterRemove.map((s) => s.id));
  const newSpawn: SpawnPoint = { id: newId, row, col };
  const newNode: PathNode = { id: newId, row, col, role: 'spawn', spawnId: newId };

  const newTiles = setTile(map.tiles, row, col, 'spawn');

  return {
    ...map,
    tiles: newTiles,
    spawns: [...spawnsAfterRemove, newSpawn],
    pathGraph: {
      nodes: [...nodesAfterRemove, newNode],
      edges: existingEdges.slice(),
    },
  };
}

export function removeSpawn(map: MapModel, spawnId: string): MapModel {
  const existingSpawns: SpawnPoint[] = map.spawns ?? [];
  const target = existingSpawns.find((s) => s.id === spawnId);
  if (target === undefined) return map;

  const newTiles = setTile(map.tiles, target.row, target.col, 'empty');
  const newSpawns = existingSpawns.filter((s) => s.id !== spawnId);
  const existingNodes: PathNode[] = map.pathGraph?.nodes ?? [];
  const newNodes = existingNodes.filter((n) => !(n.role === 'spawn' && n.spawnId === spawnId));

  return {
    ...map,
    tiles: newTiles,
    spawns: newSpawns,
    pathGraph: {
      nodes: newNodes,
      edges: map.pathGraph?.edges.slice() ?? [],
    },
  };
}

export function renameSpawn(map: MapModel, spawnId: string, name: string): MapModel {
  const existingSpawns: SpawnPoint[] = map.spawns ?? [];
  const idx = existingSpawns.findIndex((s) => s.id === spawnId);
  if (idx === -1) return map;

  const newSpawns = existingSpawns.map((s, i) =>
    i === idx ? { ...s, name } : s,
  );

  return { ...map, spawns: newSpawns };
}
