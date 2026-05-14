import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../../core/World.js';
import {
  Position,
  UnitTag,
  Attack,
  Visual,
  Health,
  DamageTypeVal,
} from '../../core/components.js';
import { evaluateMissileTarget } from '../MissileTargeting.js';
import { RenderSystem } from '../RenderSystem.js';
import type { MapConfig, GridPos } from '../../types/index.js';
import { TileType } from '../../types/index.js';
import { migrateEnemyPathToGraph } from '../../level/graph/migration.js';

const TILE = 32;

function makeMapWithWaypoints(waypoints: GridPos[], cols: number, rows: number): MapConfig {
  const tiles: TileType[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < cols; c++) row.push(TileType.Path);
    tiles.push(row);
  }
  const { pathGraph, spawns } = migrateEnemyPathToGraph({ enemyPath: waypoints });
  return {
    name: 'test',
    cols,
    rows,
    tileSize: TILE,
    tiles,
    pathGraph,
    spawns,
  };
}

function makeTower(world: TowerWorld, x: number, y: number, range = 600, splash = 120): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Attack, {
    damage: 10,
    attackSpeed: 1,
    range,
    splashRadius: splash,
    damageType: DamageTypeVal.Physical,
  });
  return eid;
}

function makeEnemy(world: TowerWorld, x: number, y: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    rewardGold: 10,
    canAttackBuildings: 0,
    atk: 1,
  });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 255,
    colorG: 0,
    colorB: 0,
    size: 16,
    alpha: 1,
  });
  return eid;
}

describe('MissileTargeting B.13/B.15 — crystal_anchor base position', () => {
  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('pathGraph migrated from waypoints: base position derived from crystal_anchor matches tail', () => {
    const waypoints: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 5 },
      { row: 4, col: 5 },
    ];
    const map = makeMapWithWaypoints(waypoints, 10, 10);
    const world = new TowerWorld();
    const towerX = 2 * TILE + TILE / 2;
    const towerY = 2 * TILE + TILE / 2;
    const tower = makeTower(world, towerX, towerY);
    const enemyNearBase = makeEnemy(world, 4 * TILE + TILE / 2, 4 * TILE + TILE / 2);
    const enemyFarFromBase = makeEnemy(world, 2 * TILE + TILE / 2, 0 * TILE + TILE / 2);

    const result = evaluateMissileTarget(world, tower, [enemyNearBase, enemyFarFromBase], map);

    expect(result).not.toBeNull();
    expect(result!.row).toBe(4);
    expect(result!.col).toBe(4);
  });

  it('explicit pathGraph: crystal_anchor sourced from graph node', () => {
    const map: MapConfig = {
      name: 'test',
      cols: 10,
      rows: 10,
      tileSize: TILE,
      tiles: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => TileType.Path)),
      pathGraph: {
        nodes: [
          { id: 's', row: 0, col: 0, role: 'spawn', spawnId: 'sp' },
          { id: 'w', row: 0, col: 4, role: 'waypoint' },
          { id: 'e', row: 7, col: 4, role: 'crystal_anchor' },
        ],
        edges: [
          { from: 's', to: 'w' },
          { from: 'w', to: 'e' },
        ],
      },
      spawns: [{ id: 'sp', row: 0, col: 0 }],
    };
    const world = new TowerWorld();
    const tower = makeTower(world, 3 * TILE + TILE / 2, 3 * TILE + TILE / 2);
    const enemyNearGraphCrystal = makeEnemy(world, 4 * TILE + TILE / 2, 7 * TILE + TILE / 2);
    const enemyElsewhere = makeEnemy(world, 9 * TILE + TILE / 2, 0 * TILE + TILE / 2);

    const result = evaluateMissileTarget(
      world,
      tower,
      [enemyNearGraphCrystal, enemyElsewhere],
      map,
    );

    expect(result).not.toBeNull();
    expect(result!.row).toBe(7);
    expect(result!.col).toBe(4);
  });

  it('enemy near crystal_anchor scores higher than enemy far from it', () => {
    const waypoints: GridPos[] = [
      { row: 0, col: 0 },
      { row: 0, col: 8 },
    ];
    const map = makeMapWithWaypoints(waypoints, 12, 6);
    const world = new TowerWorld();
    const tower = makeTower(world, 4 * TILE + TILE / 2, 2 * TILE + TILE / 2);
    const enemyNearBase = makeEnemy(world, 7 * TILE + TILE / 2, 0 * TILE + TILE / 2);
    const enemyFarFromBase = makeEnemy(world, 2 * TILE + TILE / 2, 0 * TILE + TILE / 2);

    const result = evaluateMissileTarget(world, tower, [enemyFarFromBase, enemyNearBase], map);

    expect(result).not.toBeNull();
    expect(result!.col).toBeGreaterThanOrEqual(6);
  });
});
