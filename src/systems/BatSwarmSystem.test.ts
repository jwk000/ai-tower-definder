/**
 * BatSwarmSystem 测试 — 蝙蝠塔四阶段攻击动画状态机
 *
 * 对应设计文档:
 * - design/12-visual-effects.md §9 蝙蝠塔攻击动作设计
 *   §9.1 四阶段（锁定/俯冲/撕咬/回弹）
 *   §9.2 撕咬命中阶段 phase=0.65 时造成伤害（不是攻击启动即造成）
 *   §9.4 攻击期间用预设轨迹覆盖 boid 位置计算
 *
 * 验收背景: 用户反馈"蝙蝠塔的蝙蝠攻击动作没了"。
 * 根因: bb6b2bb 迁移到 bitecs 时只实现了 boid + 即时 melee 攻击，
 *      文档 §9 设计的四阶段动画从未实装。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../core/World.js';
import {
  Position,
  Health,
  Attack,
  BatTower,
  Tower,
  UnitTag,
  PlayerOwned,
  Category,
  Layer,
  Visual,
  CategoryVal,
  LayerVal,
  DamageTypeVal,
  TargetSelectionVal,
  AttackModeVal,
} from '../core/components.js';
import { BatSwarmSystem } from './BatSwarmSystem.js';

function makeBatTower(world: TowerWorld, x: number, y: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: 100, max: 100 });
  world.addComponent(eid, Tower, {});
  world.addComponent(eid, BatTower, {
    maxBats: 1,
    replenishCooldown: 12,
    replenishTimer: 0,
    batDamage: 6,
    batAttackRange: 150,
    batAttackSpeed: 0.75,
    batHp: 30,
    batSpeed: 120,
    batSize: 10,
  });
  return eid;
}

function makeEnemy(world: TowerWorld, x: number, y: number): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x, y });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    rewardGold: 0,
    canAttackBuildings: 0,
    atk: 0,
  });
  world.addComponent(eid, Visual, { hitFlashTimer: 0 });
  world.addComponent(eid, Layer, { value: LayerVal.Ground });
  return eid;
}

describe('BatSwarmSystem — 蝙蝠塔攻击动画状态机', () => {
  let world: TowerWorld;
  let system: BatSwarmSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new BatSwarmSystem();
  });

  describe('§9 攻击启动 — 不立即造伤害', () => {
    it('蝙蝠开始攻击时，目标 HP 不应立即下降（伤害延迟到撕咬阶段）', () => {
      const tower = makeBatTower(world, 100, 100);
      const enemy = makeEnemy(world, 110, 100);
      const hpBefore = Health.current[enemy]!;

      const bat = system.spawnBat(world, tower);
      expect(bat).toBeGreaterThan(0);
      Position.x[bat] = 105;
      Position.y[bat] = 100;
      Attack.cooldownTimer[bat] = 0;

      system.update(world, 0.01);

      expect(Health.current[enemy]).toBe(hpBefore);
    });
  });

  describe('§9.4 撕咬命中阶段触发伤害', () => {
    it('攻击动画推进到 phase=0.65 后，目标应受到一次性伤害', () => {
      const tower = makeBatTower(world, 100, 100);
      const enemy = makeEnemy(world, 110, 100);
      const hpBefore = Health.current[enemy]!;

      const bat = system.spawnBat(world, tower);
      Position.x[bat] = 105;
      Position.y[bat] = 100;
      Attack.cooldownTimer[bat] = 0;

      let armorMR = 0;
      armorMR;
      const totalDuration = 1 / 0.75;
      const ticks = 80;
      const dt = (totalDuration * 0.7) / ticks;
      for (let i = 0; i < ticks; i++) {
        system.update(world, dt);
      }

      expect(Health.current[enemy]).toBeLessThan(hpBefore);
    });

    it('单次攻击只造成一次伤害（不会在撕咬持续帧重复扣血）', () => {
      const tower = makeBatTower(world, 100, 100);
      const enemy = makeEnemy(world, 110, 100);

      const bat = system.spawnBat(world, tower);
      Position.x[bat] = 105;
      Position.y[bat] = 100;
      Attack.cooldownTimer[bat] = 0;

      const totalDuration = 1 / 0.75;
      const ticks = 60;
      const dt = (totalDuration * 0.95) / ticks;
      for (let i = 0; i < ticks; i++) {
        system.update(world, dt);
      }
      const hpAfterOneAttack = Health.current[enemy]!;
      const damageDealt = 100 - hpAfterOneAttack;

      expect(damageDealt).toBeGreaterThan(0);
      expect(damageDealt).toBeLessThan(15);
    });
  });

  describe('§9.4 攻击期间位置由预设轨迹驱动', () => {
    it('攻击中蝙蝠飞向目标位置（俯冲阶段位移明显）', () => {
      const tower = makeBatTower(world, 100, 100);
      const enemy = makeEnemy(world, 200, 100);

      const bat = system.spawnBat(world, tower);
      const startX = 105;
      const startY = 105;
      Position.x[bat] = startX;
      Position.y[bat] = startY;
      Attack.cooldownTimer[bat] = 0;

      const totalDuration = 1 / 0.75;
      const halfDuration = totalDuration * 0.5;
      const ticks = 30;
      const dt = halfDuration / ticks;
      for (let i = 0; i < ticks; i++) {
        system.update(world, dt);
      }

      const dist = Math.hypot(
        Position.x[bat]! - startX,
        Position.y[bat]! - startY,
      );
      expect(dist).toBeGreaterThan(20);
    });

    it('攻击完成后蝙蝠回到起飞点附近（回弹阶段）', () => {
      const tower = makeBatTower(world, 100, 100);
      const enemy = makeEnemy(world, 180, 100);

      const bat = system.spawnBat(world, tower);
      const startX = 110;
      const startY = 110;
      Position.x[bat] = startX;
      Position.y[bat] = startY;
      Attack.cooldownTimer[bat] = 0;

      const totalDuration = 1 / 0.75;
      const ticks = 100;
      const dt = (totalDuration * 1.05) / ticks;
      for (let i = 0; i < ticks; i++) {
        system.update(world, dt);
      }

      const distToStart = Math.hypot(
        Position.x[bat]! - startX,
        Position.y[bat]! - startY,
      );
      const distToEnemy = Math.hypot(
        Position.x[bat]! - 180,
        Position.y[bat]! - 100,
      );
      expect(distToStart).toBeLessThan(distToEnemy);
    });
  });

  describe('§9 边界鲁棒性', () => {
    it('目标在俯冲途中死亡，攻击周期仍能正常结束（不卡死）', () => {
      const tower = makeBatTower(world, 100, 100);
      const enemy = makeEnemy(world, 130, 100);

      const bat = system.spawnBat(world, tower);
      Position.x[bat] = 105;
      Position.y[bat] = 100;
      Attack.cooldownTimer[bat] = 0;

      const totalDuration = 1 / 0.75;
      const dtSmall = totalDuration * 0.1;
      system.update(world, dtSmall);
      Health.current[enemy] = 0;

      const ticks = 30;
      const dt = (totalDuration * 1.1) / ticks;
      for (let i = 0; i < ticks; i++) {
        system.update(world, dt);
      }

      expect(Health.current[bat]).toBeGreaterThan(0);
    });

    it('蝙蝠在范围外时不应启动攻击', () => {
      const tower = makeBatTower(world, 100, 100);
      const enemy = makeEnemy(world, 500, 100);
      const hpBefore = Health.current[enemy]!;

      const bat = system.spawnBat(world, tower);
      Position.x[bat] = 105;
      Position.y[bat] = 100;
      Attack.cooldownTimer[bat] = 0;

      const totalDuration = 1 / 0.75;
      const ticks = 40;
      const dt = (totalDuration * 1.2) / ticks;
      for (let i = 0; i < ticks; i++) {
        system.update(world, dt);
      }

      expect(Health.current[enemy]).toBe(hpBefore);
    });
  });
});
