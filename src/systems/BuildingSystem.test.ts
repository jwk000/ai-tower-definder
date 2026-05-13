/**
 * BuildingSystem 测试 — 塔建造期回归保护
 *
 * 需求: 所有塔安装之后不能立即攻击，需要 buildTime 秒的建造过程，
 * 期间不可攻击、不被敌人锁定、不可选中；完成后 BuildingTower 组件移除，进入正常作战。
 *
 * 本测试覆盖:
 * 1. tick 行为：BuildingTower.timer 按 dt 递减
 * 2. 完成行为：timer<=0 时组件被移除
 * 3. AISystem 集成：建造中塔的 cooldownTimer 不被 tick（实现"建造期不可攻击"）
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld, hasComponent } from '../core/World.js';
import {
  Position,
  Health,
  Attack,
  Tower,
  AI,
  UnitTag,
  PlayerOwned,
  Visual,
  Category,
  CategoryVal,
  Layer,
  LayerVal,
  BuildingTower,
  DamageTypeVal,
  ShapeVal,
} from '../core/components.js';
import { BuildingSystem } from './BuildingSystem.js';
import { AISystem } from './AISystem.js';
import { ALL_AI_CONFIGS } from '../ai/presets/aiConfigs.js';

function createBuildingTower(world: TowerWorld, buildTime: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 100, y: 100 });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, Tower, { towerType: 0, level: 1, totalInvested: 50 });
  world.addComponent(eid, PlayerOwned);
  world.addComponent(eid, Attack, {
    damage: 10, attackSpeed: 1, range: 100,
    damageType: DamageTypeVal.Physical,
    cooldownTimer: 1.0, targetId: 0, isRanged: 1,
  });
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Circle,
    colorR: 255, colorG: 0, colorB: 0,
    size: 20, alpha: 1,
  });
  world.addComponent(eid, AI, {
    configId: 0, targetId: 0,
    lastUpdateTime: 0, updateInterval: 0.1, active: 1,
  });
  world.addComponent(eid, Category, { value: CategoryVal.Tower });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  world.addComponent(eid, UnitTag, {
    isEnemy: 0, isBoss: 0, isRanged: 1, canAttackBuildings: 0,
    rewardGold: 0, rewardEnergy: 0, popCost: 0, cost: 50,
  });
  world.addComponent(eid, BuildingTower, { timer: buildTime, duration: buildTime });
  return eid;
}

describe('BuildingSystem — 塔建造期回归保护', () => {
  let world: TowerWorld;
  let buildingSystem: BuildingSystem;

  beforeEach(() => {
    world = new TowerWorld();
    buildingSystem = new BuildingSystem();
  });

  it('tick：BuildingTower.timer 应按 dt 递减', () => {
    const tower = createBuildingTower(world, 2.0);
    expect(BuildingTower.timer[tower]).toBeCloseTo(2.0, 5);

    buildingSystem.update(world, 0.5);

    expect(BuildingTower.timer[tower]).toBeCloseTo(1.5, 5);
    expect(hasComponent(world.world, BuildingTower, tower)).toBe(true);
  });

  it('完成：timer 减到 ≤ 0 时 BuildingTower 组件应被移除', () => {
    const tower = createBuildingTower(world, 1.0);

    for (let i = 0; i < 40; i++) {
      buildingSystem.update(world, 0.03);
    }

    expect(hasComponent(world.world, BuildingTower, tower)).toBe(false);
  });

  it('AISystem 集成：建造中塔的 cooldownTimer 不会被 tick（建造期不可攻击）', () => {
    const tower = createBuildingTower(world, 5.0);
    const aiSystem = new AISystem();
    aiSystem.registerAIConfigs(ALL_AI_CONFIGS);

    expect(Attack.cooldownTimer[tower]).toBeCloseTo(1.0, 5);

    for (let i = 0; i < 20; i++) {
      aiSystem.update(world, 0.03);
    }

    expect(Attack.cooldownTimer[tower]).toBeCloseTo(1.0, 5);
    expect(hasComponent(world.world, BuildingTower, tower)).toBe(true);
  });
});
