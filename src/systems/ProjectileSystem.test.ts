/**
 * ProjectileSystem 测试 — 验收 bug 回归保护
 *
 * 覆盖需求：
 * - Bug 1: 导弹塔首发时，目标在塔上方/北方（tty < towerY）→ 弹体应飞越上升+下落
 *   全程，最后在标记位置爆炸，而非首帧立即在塔位置 onHit。
 * - Bug 2: 导弹/炮塔的 splash AOE 只能伤害敌方单位（UnitTag.isEnemy === 1），
 *   不能伤害友军塔、生产建筑、陷阱等己方实体，也不能伤害发射源塔自身。
 */
import { describe, it, expect } from 'vitest';
import { addEntity, addComponent, hasComponent } from 'bitecs';
import type { World as BitecsWorld } from 'bitecs';
import { TowerWorld } from '../core/World.js';
import {
  Position, Projectile, Health, UnitTag, Layer, LayerVal,
  TargetingMark, Visual, DamageTypeVal,
} from '../core/components.js';
import { ProjectileSystem } from './ProjectileSystem.js';
import { computeMissileParabola } from './AttackSystem.js';
import { MAP_01 } from '../data/gameData.js';

const MISSILE_TOWER_TYPE = 6;

function addComp(world: BitecsWorld, eid: number, comp: object, values: Record<string, unknown>): void {
  addComponent(world, comp, eid);
  for (const [key, val] of Object.entries(values)) {
    const c = comp as Record<string, Record<number, unknown>>;
    if (c[key] !== undefined) {
      c[key][eid] = val;
    }
  }
}

function makeMark(world: TowerWorld, x: number, y: number): number {
  const w = world.world;
  const id = addEntity(w);
  addComp(w, id, Position, { x, y });
  addComp(w, id, TargetingMark, { blastRadius: 130, pulsePhase: 0, ringRotation: 0 });
  addComp(w, id, Layer, { value: LayerVal.AboveGrid });
  return id;
}

function makeMissile(
  world: TowerWorld,
  fromX: number, fromY: number,
  markId: number,
  sourceId: number,
  splashRadius: number = 130,
  damage: number = 100,
): number {
  const w = world.world;
  const speed = 600;
  const targetX = Position.x[markId] ?? fromX;
  const targetY = Position.y[markId] ?? fromY;
  const { totalTime, vyInitial } = computeMissileParabola(fromX, fromY, targetX, targetY, speed);
  const id = addEntity(w);
  addComp(w, id, Position, { x: fromX, y: fromY });
  addComp(w, id, Projectile, {
    speed,
    damage,
    damageType: DamageTypeVal.Physical,
    targetId: markId,
    sourceId,
    fromX,
    fromY,
    shape: 1,
    colorR: 0, colorG: 0, colorB: 0,
    size: 10,
    splashRadius,
    stunDuration: 0.4,
    sourceTowerType: MISSILE_TOWER_TYPE,
    targetX,
    targetY,
    flightTime: 0,
    totalTime,
    vyInitial,
  });
  addComp(w, id, Visual, {
    shape: 1, colorR: 0, colorG: 0, colorB: 0,
    size: 10, alpha: 1, outline: 0, hitFlashTimer: 0, idlePhase: 0,
  });
  addComp(w, id, Layer, { value: LayerVal.Ground });
  return id;
}

function makeEnemy(world: TowerWorld, x: number, y: number, hp: number = 200): number {
  const w = world.world;
  const id = addEntity(w);
  addComp(w, id, Position, { x, y });
  addComp(w, id, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  addComp(w, id, UnitTag, { isEnemy: 1, isBoss: 0, isRanged: 0 });
  addComp(w, id, Layer, { value: LayerVal.Ground });
  return id;
}

function makeAlliedTower(world: TowerWorld, x: number, y: number, hp: number = 500): number {
  const w = world.world;
  const id = addEntity(w);
  addComp(w, id, Position, { x, y });
  addComp(w, id, Health, { current: hp, max: hp, armor: 0, magicResist: 0 });
  addComp(w, id, UnitTag, { isEnemy: 0, isBoss: 0, isRanged: 1 });
  addComp(w, id, Layer, { value: LayerVal.Ground });
  return id;
}

describe('ProjectileSystem — Missile parabolic trajectory', () => {
  it('Bug 1: 目标在塔北方（tty < towerY）→ 导弹不应在首帧立即命中塔位置', () => {
    const world = new TowerWorld();
    const sys = new ProjectileSystem(MAP_01);

    const towerX = 400, towerY = 400;
    const tower = makeAlliedTower(world, towerX, towerY);

    const markX = 600, markY = 200;
    const markId = makeMark(world, markX, markY);

    const enemyAtTower = makeEnemy(world, towerX, towerY, 200);
    const enemyAtMark = makeEnemy(world, markX, markY, 200);

    const hpBeforeAtTower = Health.current[enemyAtTower]!;
    const hpBeforeAtMark = Health.current[enemyAtMark]!;

    const missile = makeMissile(world, towerX, towerY, markId, tower);

    sys.update(world, 1 / 60);

    expect(Health.current[enemyAtTower]).toBe(hpBeforeAtTower);
    expect(Health.current[enemyAtMark]).toBe(hpBeforeAtMark);
    expect(Position.x[missile]).toBeDefined();
  });

  it('Bug 1: 目标在塔北方时 → 抛物线最终落到 mark 位置爆炸（多帧推进）', () => {
    const world = new TowerWorld();
    const sys = new ProjectileSystem(MAP_01);

    const towerX = 400, towerY = 400;
    const tower = makeAlliedTower(world, towerX, towerY);

    const markX = 600, markY = 200;
    const markId = makeMark(world, markX, markY);

    const enemyAtMark = makeEnemy(world, markX, markY, 200);
    const hpBefore = Health.current[enemyAtMark]!;

    makeMissile(world, towerX, towerY, markId, tower);

    for (let i = 0; i < 180; i++) {
      sys.update(world, 1 / 60);
    }

    expect(Health.current[enemyAtMark]).toBeLessThan(hpBefore);
  });
});

describe('ProjectileSystem — Splash friendly-fire guard', () => {
  it('Bug 2: 导弹 splash 不应伤害友方塔', () => {
    const world = new TowerWorld();
    const sys = new ProjectileSystem(MAP_01);

    const hitX = 500, hitY = 500;
    const markId = makeMark(world, hitX, hitY);

    const alliedTower = makeAlliedTower(world, hitX + 30, hitY + 30, 500);
    const enemy = makeEnemy(world, hitX - 30, hitY - 30, 200);

    const alliedHpBefore = Health.current[alliedTower]!;
    const enemyHpBefore = Health.current[enemy]!;

    const sourceTowerId = makeAlliedTower(world, 0, 0, 500);
    makeMissile(world, hitX, hitY - 50, markId, sourceTowerId, 130, 100);

    for (let i = 0; i < 180; i++) {
      sys.update(world, 1 / 60);
    }

    expect(Health.current[alliedTower]).toBe(alliedHpBefore);
    expect(Health.current[enemy]).toBeLessThan(enemyHpBefore);
  });

  it('Bug 2: splash 不应伤害发射弹体的源塔本身（即使源塔在范围内）', () => {
    const world = new TowerWorld();
    const sys = new ProjectileSystem(MAP_01);

    const sourceX = 500, sourceY = 500;
    const sourceTowerId = makeAlliedTower(world, sourceX, sourceY, 500);
    const sourceHpBefore = Health.current[sourceTowerId]!;

    const markX = sourceX + 50, markY = sourceY + 50;
    const markId = makeMark(world, markX, markY);

    const enemy = makeEnemy(world, markX, markY, 200);
    const enemyHpBefore = Health.current[enemy]!;

    makeMissile(world, sourceX, sourceY, markId, sourceTowerId, 200, 100);

    for (let i = 0; i < 180; i++) {
      sys.update(world, 1 / 60);
    }

    expect(Health.current[sourceTowerId]).toBe(sourceHpBefore);
    expect(Health.current[enemy]).toBeLessThan(enemyHpBefore);
  });
});

describe('ProjectileSystem — Missile landing accuracy', () => {
  function runUntilHit(world: TowerWorld, sys: ProjectileSystem, missile: number): { hitX: number; hitY: number } {
    for (let i = 0; i < 600; i++) {
      sys.update(world, 1 / 60);
      // 命中那帧 ProjectileSystem 已强制 Position=(targetX,targetY) 再 destroyEntity，
      // SoA 数组保留命中位置值；cleanupDeadEntities 仅移除 Projectile 组件用于判存活。
      const x = Position.x[missile] ?? 0;
      const y = Position.y[missile] ?? 0;
      world.cleanupDeadEntities();
      if (!hasComponent(world.world, Projectile, missile)) {
        return { hitX: x, hitY: y };
      }
    }
    throw new Error('Missile never hit within 600 frames');
  }

  const tolerance = 8;

  it.each([
    ['target east+south (down-right)', 400, 400, 700, 600],
    ['target east+north (up-right)', 400, 400, 700, 200],
    ['target west+south (down-left)', 600, 400, 300, 600],
    ['target west+north (up-left)', 600, 400, 300, 200],
    ['target very close', 400, 400, 450, 410],
    ['target very far', 400, 400, 1200, 1000],
  ])('落点应精准命中 mark 位置 (±%spx tolerance): %s', (_label: string, towerX, towerY, markX, markY) => {
    const world = new TowerWorld();
    const sys = new ProjectileSystem(MAP_01);

    const tower = makeAlliedTower(world, towerX, towerY);
    const markId = makeMark(world, markX, markY);
    const missile = makeMissile(world, towerX, towerY, markId, tower);

    const { hitX, hitY } = runUntilHit(world, sys, missile);

    expect(Math.abs(hitX - markX)).toBeLessThan(tolerance);
    expect(Math.abs(hitY - markY)).toBeLessThan(tolerance);
  });
});
