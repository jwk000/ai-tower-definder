/**
 * MissileTargeting 测试 — 验收 bug 回归保护
 *
 * 覆盖需求：
 * - 导弹塔自攻击自己 → MissileTargeting 必须排除塔自身所在的网格中心。
 *   即使敌人推进到塔所在格附近，目标点也不能落到塔身上。
 */
import { describe, it, expect } from 'vitest';
import { addEntity, addComponent } from 'bitecs';
import type { World as BitecsWorld } from 'bitecs';
import { TowerWorld } from '../core/World.js';
import { Position, UnitTag, Attack, Health, Layer, LayerVal } from '../core/components.js';
import { evaluateMissileTarget } from './MissileTargeting.js';
import { RenderSystem } from './RenderSystem.js';
import { MAP_01 } from '../data/gameData.js';

function addComp(world: BitecsWorld, eid: number, comp: object, values: Record<string, unknown>): void {
  addComponent(world, comp, eid);
  for (const [key, val] of Object.entries(values)) {
    const c = comp as Record<string, Record<number, unknown>>;
    if (c[key] !== undefined) {
      c[key][eid] = val;
    }
  }
}

function makeMissileTower(world: TowerWorld, x: number, y: number): number {
  const w = world.world;
  const tower = addEntity(w);
  addComp(w, tower, Position, { x, y });
  addComp(w, tower, Attack, {
    damage: 90, attackSpeed: 0.14, range: 600, damageType: 0,
    isRanged: 1, cooldownTimer: 0, splashRadius: 130,
  });
  return tower;
}

function makeEnemy(world: TowerWorld, x: number, y: number): number {
  const w = world.world;
  const e = addEntity(w);
  addComp(w, e, Position, { x, y });
  addComp(w, e, Health, { current: 100, max: 100 });
  addComp(w, e, UnitTag, { isEnemy: 1, isBoss: 0 });
  addComp(w, e, Layer, { value: LayerVal.Ground });
  return e;
}

describe('MissileTargeting — self-target guard', () => {
  it('敌人落在塔所在格 → 不会被选为目标（防止塔自轰）', () => {
    const origX = RenderSystem.sceneOffsetX;
    const origY = RenderSystem.sceneOffsetY;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    try {
      const world = new TowerWorld();
      const towerX = 5 * MAP_01.tileSize + MAP_01.tileSize / 2;
      const towerY = 4 * MAP_01.tileSize + MAP_01.tileSize / 2;
      const tower = makeMissileTower(world, towerX, towerY);

      const enemyOnTower = makeEnemy(world, towerX, towerY);
      const enemyFar = makeEnemy(world, towerX + MAP_01.tileSize * 3, towerY);

      const result = evaluateMissileTarget(world, tower, [enemyOnTower, enemyFar], MAP_01);

      expect(result).not.toBeNull();
      const dxr = result!.targetX - towerX;
      const dyr = result!.targetY - towerY;
      expect(Math.sqrt(dxr * dxr + dyr * dyr)).toBeGreaterThanOrEqual(MAP_01.tileSize);
    } finally {
      RenderSystem.sceneOffsetX = origX;
      RenderSystem.sceneOffsetY = origY;
    }
  });

  it('只有一个敌人且在塔所在格上 → 返回 null（拒绝自攻击）', () => {
    const origX = RenderSystem.sceneOffsetX;
    const origY = RenderSystem.sceneOffsetY;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    try {
      const world = new TowerWorld();
      const towerX = 5 * MAP_01.tileSize + MAP_01.tileSize / 2;
      const towerY = 4 * MAP_01.tileSize + MAP_01.tileSize / 2;
      const tower = makeMissileTower(world, towerX, towerY);
      const enemy = makeEnemy(world, towerX, towerY);

      const result = evaluateMissileTarget(world, tower, [enemy], MAP_01);

      expect(result).toBeNull();
    } finally {
      RenderSystem.sceneOffsetX = origX;
      RenderSystem.sceneOffsetY = origY;
    }
  });
});
