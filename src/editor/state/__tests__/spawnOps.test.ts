import { describe, it, expect } from 'vitest';
import {
  addSpawn,
  removeSpawn,
  renameSpawn,
  generateSpawnId,
} from '../spawnOps.js';
import type { MapModel, TileCell } from '../levelModel.js';

function makeMap(overrides: Partial<MapModel> = {}): MapModel {
  return {
    cols: 5,
    rows: 3,
    tileSize: 32,
    tiles: [
      ['empty', 'empty', 'empty', 'empty', 'empty'],
      ['empty', 'empty', 'empty', 'empty', 'empty'],
      ['empty', 'empty', 'empty', 'empty', 'empty'],
    ] as TileCell[][],
    spawns: [],
    pathGraph: { nodes: [], edges: [] },
    ...overrides,
  };
}

describe('generateSpawnId', () => {
  it('generates unique ids not in the existing set', () => {
    const id1 = generateSpawnId([]);
    const id2 = generateSpawnId([id1]);
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^spawn_[a-z]+$/);
    expect(id2).toMatch(/^spawn_[a-z]+$/);
  });
});

describe('addSpawn', () => {
  it('sets tiles[row][col] to spawn and adds spawns entry + spawn PathNode', () => {
    const map = makeMap();
    const next = addSpawn(map, 1, 2);

    expect(next.tiles[1]?.[2]).toBe('spawn');
    expect(next.spawns).toHaveLength(1);
    expect(next.spawns?.[0]).toMatchObject({ row: 1, col: 2 });

    expect(next.pathGraph?.nodes).toHaveLength(1);
    expect(next.pathGraph?.nodes[0]).toMatchObject({
      row: 1,
      col: 2,
      role: 'spawn',
      spawnId: next.spawns?.[0]?.id,
    });
  });

  it('generates a unique spawnId when one already exists', () => {
    const existing = addSpawn(makeMap(), 0, 0);
    const next = addSpawn(existing, 2, 4);
    const ids = next.spawns?.map((s) => s.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not mutate the original map', () => {
    const map = makeMap();
    const original = JSON.stringify(map);
    addSpawn(map, 0, 0);
    expect(JSON.stringify(map)).toBe(original);
  });

  it('overwrites existing non-spawn tile without spawns side-effect', () => {
    const map = makeMap({
      tiles: [
        ['path', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty'],
      ],
    });
    const next = addSpawn(map, 0, 0);
    expect(next.tiles[0]?.[0]).toBe('spawn');
    expect(next.spawns).toHaveLength(1);
  });

  it('replacing an existing spawn tile at the same cell replaces only that spawn', () => {
    const map1 = addSpawn(makeMap(), 0, 0);
    const map2 = addSpawn(map1, 0, 0);
    expect(map2.spawns).toHaveLength(1);
    expect(map2.pathGraph?.nodes.filter((n) => n.role === 'spawn')).toHaveLength(1);
  });
});

describe('removeSpawn', () => {
  it('sets tiles[row][col] back to empty, removes spawns entry and its spawn PathNode', () => {
    const withSpawn = addSpawn(makeMap(), 1, 3);
    const spawnId = withSpawn.spawns?.[0]?.id ?? '';
    const next = removeSpawn(withSpawn, spawnId);

    expect(next.tiles[1]?.[3]).toBe('empty');
    expect(next.spawns).toHaveLength(0);
    expect(next.pathGraph?.nodes.filter((n) => n.role === 'spawn')).toHaveLength(0);
  });

  it('no-ops gracefully when spawnId does not exist', () => {
    const map = makeMap();
    const next = removeSpawn(map, 'nonexistent');
    expect(next).toEqual(map);
  });

  it('does not mutate the original map', () => {
    const withSpawn = addSpawn(makeMap(), 0, 0);
    const original = JSON.stringify(withSpawn);
    removeSpawn(withSpawn, withSpawn.spawns?.[0]?.id ?? '');
    expect(JSON.stringify(withSpawn)).toBe(original);
  });

  it('removes only the specified spawn when multiple exist', () => {
    let map = addSpawn(makeMap(), 0, 0);
    map = addSpawn(map, 2, 4);
    const idToRemove = map.spawns?.[0]?.id ?? '';
    const next = removeSpawn(map, idToRemove);
    expect(next.spawns).toHaveLength(1);
    expect(next.spawns?.[0]?.id).not.toBe(idToRemove);
  });
});

describe('renameSpawn', () => {
  it('updates the name of the matching spawn', () => {
    const withSpawn = addSpawn(makeMap(), 0, 0);
    const id = withSpawn.spawns?.[0]?.id ?? '';
    const next = renameSpawn(withSpawn, id, '北口');
    expect(next.spawns?.[0]?.name).toBe('北口');
  });

  it('does not affect other spawns', () => {
    let map = addSpawn(makeMap(), 0, 0);
    map = addSpawn(map, 2, 4);
    const id0 = map.spawns?.[0]?.id ?? '';
    const next = renameSpawn(map, id0, '测试');
    expect(next.spawns?.[1]?.name).toBeUndefined();
  });

  it('no-ops gracefully when spawnId does not exist', () => {
    const map = makeMap();
    const next = renameSpawn(map, 'nonexistent', '测试');
    expect(next).toEqual(map);
  });

  it('does not mutate the original map', () => {
    const withSpawn = addSpawn(makeMap(), 0, 0);
    const original = JSON.stringify(withSpawn);
    renameSpawn(withSpawn, withSpawn.spawns?.[0]?.id ?? '', 'X');
    expect(JSON.stringify(withSpawn)).toBe(original);
  });
});
