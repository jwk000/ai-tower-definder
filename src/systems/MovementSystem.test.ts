/**
 * MovementSystem 测试 — 基地伤害（敌人到达终点）
 *
 * 对应设计文档:
 * - design/05-combat-system.md 战斗系统
 * - design/14-acceptance-criteria.md ★2 = 基地 HP ≥ 80%（基地必须可受伤）
 *
 * 验收背景: 用户反馈"小兵攻击基地基地不掉血"。
 * 根因: onReachEnd 原实现 `Attack.damage[eid] ?? 10` —— bitecs TypedArray
 * 在未添加 Attack 组件时返回 0（数组默认值），而非 undefined，导致 fallback
 * 永远不会触发，无 Attack 组件的小兵到达终点造成 0 伤害。
 *
 * 修复: 在 UnitTag 中存储敌人 atk，onReachEnd 从 UnitTag.atk 取伤害值。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../core/World.js';
import {
  Position,
  Health,
  Movement,
  UnitTag,
  MoveModeVal,
  Visual,
  Attack,
  DamageTypeVal,
  Category,
  CategoryVal,
} from '../core/components.js';
import { MovementSystem } from './MovementSystem.js';
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig, GridPos } from '../types/index.js';
import { TileType } from '../types/index.js';

const TILE = 32;

function makeMap(): MapConfig {
  const waypoints: GridPos[] = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
  ];
  return {
    name: 'test',
    cols: 2,
    rows: 1,
    tileSize: TILE,
    tiles: [[TileType.Spawn, TileType.Base]],
    enemyPath: waypoints,
  };
}

function makeBase(world: TowerWorld, hp: number = 100): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 0, y: 0 });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Category, { value: CategoryVal.Objective });
  return eid;
}

function makeTower(world: TowerWorld, hp: number = 80): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 100, y: 100 });
  world.addComponent(eid, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  world.addComponent(eid, Category, { value: CategoryVal.Tower });
  return eid;
}

function makeEnemyAtEnd(
  world: TowerWorld,
  opts: { atk: number; withAttackComponent?: boolean },
): number {
  const eid = world.createEntity();
  world.addComponent(eid, Position, { x: 0, y: 0 });
  world.addComponent(eid, Health, { current: 60, max: 60, armor: 0, magicResist: 0 });
  world.addComponent(eid, Movement, {
    speed: 50,
    moveMode: MoveModeVal.FollowPath,
    pathIndex: 1,
    progress: 0,
  });
  world.addComponent(eid, UnitTag, {
    isEnemy: 1,
    rewardGold: 10,
    canAttackBuildings: 0,
    atk: opts.atk,
  });
  world.addComponent(eid, Visual, {
    shape: 1,
    colorR: 255,
    colorG: 0,
    colorB: 0,
    size: 16,
    alpha: 1,
  });
  if (opts.withAttackComponent) {
    world.addComponent(eid, Attack, {
      damage: opts.atk,
      attackSpeed: 1,
      range: 0,
      damageType: DamageTypeVal.Physical,
    });
  }
  return eid;
}

describe('MovementSystem — 基地伤害（onReachEnd）', () => {
  let world: TowerWorld;
  let system: MovementSystem;

  beforeEach(() => {
    world = new TowerWorld();
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    system = new MovementSystem(makeMap());
  });

  it('Grunt 类敌人（无 Attack 组件）到达基地必须扣血', () => {
    const base = makeBase(world, 100);
    const enemy = makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });

    system.update(world, 0.016);

    expect(
      Health.current[base],
      '基地必须受到伤害 — Grunt 无 Attack 组件时不能被 bitecs TypedArray 默认 0 值蒙混',
    ).toBeLessThan(100);
    world.cleanupDeadEntities();
  });

  it('Grunt 到达基地的伤害来源于 UnitTag.atk（=5），而非默认 fallback 10', () => {
    const base = makeBase(world, 100);
    makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });

    system.update(world, 0.016);

    expect(Health.current[base], '伤害值应等于配置 atk=5').toBe(95);
  });

  it('带 Attack 组件的敌人到达基地，仍以 UnitTag.atk 为伤害来源（数据源唯一）', () => {
    const base = makeBase(world, 100);
    makeEnemyAtEnd(world, { atk: 12, withAttackComponent: true });

    system.update(world, 0.016);

    expect(Health.current[base]).toBe(88);
  });

  it('多个敌人同帧到达，基地累计扣血', () => {
    const base = makeBase(world, 100);
    makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });
    makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });
    makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });

    system.update(world, 0.016);

    expect(Health.current[base]).toBe(85);
  });

  it('基地 HP 不会被扣成负数', () => {
    const base = makeBase(world, 3);
    makeEnemyAtEnd(world, { atk: 100, withAttackComponent: false });

    system.update(world, 0.016);

    expect(Health.current[base]).toBe(0);
  });

  it('到达终点的敌人被销毁', () => {
    makeBase(world, 100);
    const enemy = makeEnemyAtEnd(world, { atk: 5, withAttackComponent: false });

    system.update(world, 0.016);
    world.cleanupDeadEntities();

    expect(world.hasComponent(enemy, Position)).toBe(false);
  });

  it('敌人自身（带 UnitTag.isEnemy=1+Health）不会因 baseQuery 命中而被自伤', () => {
    const base = makeBase(world, 100);
    const enemy = makeEnemyAtEnd(world, { atk: 50, withAttackComponent: false });
    const enemyHp0 = Health.current[enemy];

    system.update(world, 0.016);

    expect(Health.current[base]).toBe(50);
    expect(Health.current[enemy], '敌人不应被自己的到达伤害击中').toBe(enemyHp0);
  });

  it('友方塔/建筑（Category != Objective）不会因 baseQuery 命中而被基地伤害误伤', () => {
    const base = makeBase(world, 100);
    const tower = makeTower(world, 80);
    const towerHp0 = Health.current[tower];
    makeEnemyAtEnd(world, { atk: 30, withAttackComponent: false });

    system.update(world, 0.016);

    expect(Health.current[base], '基地正常扣血').toBe(70);
    expect(Health.current[tower], '塔不应因敌人到达基地而掉血').toBe(towerHp0);
  });
});
