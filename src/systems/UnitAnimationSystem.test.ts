/**
 * UnitAnimationSystem 测试 — 单位动画相位推进
 *
 * 需求:
 * - 已配置 visualParts 的单位（partsId != 0）每帧 breathPhase 按固定速率累加，循环 [0, 2π)
 * - attackAnimTimer > 0 时每帧按 dt 衰减至 0，不会变负
 * - 未配置 visualParts 的单位（partsId === 0）相位完全不动，零开销
 * - World.registerUnitVisualParts 返回从 1 开始的索引，0 保留给"无装饰"
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../core/World.js';
import { Visual, ShapeVal } from '../core/components.js';
import { UnitAnimationSystem } from './UnitAnimationSystem.js';
import type { UnitVisualParts } from '../types/index.js';

const STUB_PARTS: UnitVisualParts = {
  eyes: { pupilRadius: 1.5, pupilColor: '#000' },
};

function addVisualWithParts(world: TowerWorld, partsId: number, opts: { breath?: number; atkTimer?: number; atkDur?: number } = {}): number {
  const eid = world.createEntity();
  world.addComponent(eid, Visual, {
    shape: ShapeVal.Rect,
    colorR: 255, colorG: 0, colorB: 0,
    size: 24, alpha: 1, outline: 1,
    breathPhase: opts.breath ?? 0,
    attackAnimTimer: opts.atkTimer ?? 0,
    attackAnimDuration: opts.atkDur ?? 0.3,
    partsId,
  });
  return eid;
}

describe('UnitAnimationSystem — 动画相位推进', () => {
  let world: TowerWorld;
  let system: UnitAnimationSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new UnitAnimationSystem();
  });

  it('partsId != 0 时 breathPhase 每帧按速率累加', () => {
    const partsId = world.registerUnitVisualParts(STUB_PARTS);
    const eid = addVisualWithParts(world, partsId, { breath: 0 });

    system.update(world, 1.0);
    const phaseAfter1s = Visual.breathPhase[eid]!;
    expect(phaseAfter1s).toBeGreaterThan(0);
    expect(phaseAfter1s).toBeLessThan(Math.PI * 2);
  });

  it('breathPhase 循环回绕到 [0, 2π)', () => {
    const partsId = world.registerUnitVisualParts(STUB_PARTS);
    const eid = addVisualWithParts(world, partsId, { breath: Math.PI * 2 - 0.01 });

    system.update(world, 1.0);
    expect(Visual.breathPhase[eid]!).toBeLessThan(Math.PI * 2);
    expect(Visual.breathPhase[eid]!).toBeGreaterThanOrEqual(0);
  });

  it('attackAnimTimer 每帧按 dt 衰减', () => {
    const partsId = world.registerUnitVisualParts(STUB_PARTS);
    const eid = addVisualWithParts(world, partsId, { atkTimer: 0.3, atkDur: 0.3 });

    system.update(world, 0.1);
    expect(Visual.attackAnimTimer[eid]!).toBeCloseTo(0.2, 5);
  });

  it('attackAnimTimer 衰减不会变负', () => {
    const partsId = world.registerUnitVisualParts(STUB_PARTS);
    const eid = addVisualWithParts(world, partsId, { atkTimer: 0.05, atkDur: 0.3 });

    system.update(world, 0.2);
    expect(Visual.attackAnimTimer[eid]!).toBe(0);
  });

  it('partsId === 0 的实体不被推进（零开销保护）', () => {
    const eid = addVisualWithParts(world, 0, { breath: 0, atkTimer: 0.5 });

    system.update(world, 1.0);
    expect(Visual.breathPhase[eid]!).toBe(0);
    expect(Visual.attackAnimTimer[eid]!).toBe(0.5);
  });
});

describe('World.registerUnitVisualParts — 注册表行为', () => {
  it('首次注册返回 1（0 保留为"无装饰"）', () => {
    const world = new TowerWorld();
    expect(world.registerUnitVisualParts(STUB_PARTS)).toBe(1);
  });

  it('多次注册返回递增 id', () => {
    const world = new TowerWorld();
    const id1 = world.registerUnitVisualParts(STUB_PARTS);
    const id2 = world.registerUnitVisualParts(STUB_PARTS);
    const id3 = world.registerUnitVisualParts(STUB_PARTS);
    expect([id1, id2, id3]).toEqual([1, 2, 3]);
  });

  it('getUnitVisualParts(id) 返回原始配置对象', () => {
    const world = new TowerWorld();
    const id = world.registerUnitVisualParts(STUB_PARTS);
    expect(world.getUnitVisualParts(id)).toBe(STUB_PARTS);
  });

  it('getUnitVisualParts(0) 返回 undefined（哨兵值）', () => {
    const world = new TowerWorld();
    expect(world.getUnitVisualParts(0)).toBeUndefined();
  });

  it('getUnitVisualParts(未注册 id) 返回 undefined', () => {
    const world = new TowerWorld();
    expect(world.getUnitVisualParts(999)).toBeUndefined();
  });
});
