/**
 * BuildSystem 测试 — 塔实体冷却 tick 回归保护
 *
 * 验收背景: 用户反馈"安放任何一个塔，第一次攻击之后无法继续攻击"。
 * 根因: createTowerEntity 未挂载 UnitTag 组件，AISystem 查询
 * `[AI, Position, Health, UnitTag]` 不会匹配塔，导致 `Attack.cooldownTimer`
 * 永远不被 tick，首次攻击后 cooldownTimer > 0 永久跳过攻击。
 *
 * 修复: createTowerEntity 与 trap/production 一致挂载 UnitTag（全 0 非敌人）。
 *
 * 本测试通过创建塔实体 + 运行 AISystem 多帧，验证 cooldownTimer 被减少到 0。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../core/World.js';
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
  DamageTypeVal,
  ShapeVal,
} from '../core/components.js';
import { AISystem } from './AISystem.js';
import { ALL_AI_CONFIGS } from '../ai/presets/aiConfigs.js';

function createTowerLikeEntity(world: TowerWorld, withUnitTag: boolean): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 100, y: 100 });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, Tower, { towerType: 0, level: 1, totalInvested: 50 });
  world.addComponent(eid, PlayerOwned);
  world.addComponent(eid, Attack, {
    damage: 10,
    attackSpeed: 1,
    range: 100,
    damageType: DamageTypeVal.Physical,
    cooldownTimer: 1.0,
    targetId: 0,
    isRanged: 1,
  });
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Circle,
    colorR: 255, colorG: 0, colorB: 0,
    size: 20, alpha: 1,
  });
  world.addComponent(eid, AI, {
    configId: 0,
    targetId: 0,
    lastUpdateTime: 0,
    updateInterval: 0.1,
    active: 1,
  });
  world.addComponent(eid, Category, { value: CategoryVal.Tower });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });

  if (withUnitTag) {
    world.addComponent(eid, UnitTag, {
      isEnemy: 0,
      isBoss: 0,
      isRanged: 1,
      canAttackBuildings: 0,
      rewardGold: 0,
      rewardEnergy: 0,
      popCost: 0,
      cost: 50,
    });
  }
  return eid;
}

describe('BuildSystem — 塔冷却 tick 回归保护', () => {
  let world: TowerWorld;
  let aiSystem: AISystem;

  beforeEach(() => {
    world = new TowerWorld();
    aiSystem = new AISystem();
    aiSystem.registerAIConfigs(ALL_AI_CONFIGS);
  });

  it('挂载 UnitTag 的塔，多帧后 cooldownTimer 应被 AISystem tick 至 ≤ 0', () => {
    const tower = createTowerLikeEntity(world, /* withUnitTag */ true);

    expect(Attack.cooldownTimer[tower]).toBeCloseTo(1.0, 5);

    // 模拟 50 帧 × 30ms = 1.5s，应足以将 1.0s 冷却 tick 至 ≤ 0
    for (let i = 0; i < 50; i++) {
      aiSystem.update(world, 0.03);
    }

    expect(Attack.cooldownTimer[tower]!).toBeLessThanOrEqual(0);
  });

  it('回归断言：不挂 UnitTag 的塔，cooldownTimer 不会被 tick（旧 bug 行为）', () => {
    const tower = createTowerLikeEntity(world, /* withUnitTag */ false);

    expect(Attack.cooldownTimer[tower]).toBeCloseTo(1.0, 5);

    for (let i = 0; i < 50; i++) {
      aiSystem.update(world, 0.03);
    }

    // 文档化旧 bug：缺 UnitTag → AISystem 查询过滤 → 冷却永不递减
    expect(Attack.cooldownTimer[tower]!).toBeCloseTo(1.0, 5);
  });
});
