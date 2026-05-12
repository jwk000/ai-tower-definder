/**
 * TrapSystem 测试 — P2-#18 跨层级触发规则
 *
 * 对应设计文档:
 * - design/18-layer-system.md §5.4 (陷阱触发规则)
 * - design/18-layer-system.md §5.5 (跨层级特殊单位判定)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TowerWorld } from '../core/World.js';
import {
  Position, Health, Trap, GridOccupant, Layer, LayerVal,
} from '../core/components.js';
import { TrapSystem } from './TrapSystem.js';
import { RenderSystem } from './RenderSystem.js';

const TILE = 32;

function makeTrap(world: TowerWorld, row: number, col: number, layer: number = LayerVal.AboveGrid): number {
  const eid = world.createEntity();
  const ox = RenderSystem.sceneOffsetX;
  const oy = RenderSystem.sceneOffsetY;
  world.addComponent(eid, Position, { x: ox + col * TILE + TILE / 2, y: oy + row * TILE + TILE / 2 });
  world.addComponent(eid, GridOccupant, { row, col });
  world.addComponent(eid, Trap, {
    damagePerSecond: 100,
    radius: TILE * 0.5,
    cooldown: 0,
    cooldownTimer: 0,
    animTimer: 0,
    animDuration: 0.4,
    triggerCount: 0,
    maxTriggers: 0,
  });
  world.addComponent(eid, Layer, { value: layer });
  return eid;
}

function makeEnemy(world: TowerWorld, row: number, col: number, layer: number = LayerVal.Ground): number {
  const eid = world.createEntity();
  const ox = RenderSystem.sceneOffsetX;
  const oy = RenderSystem.sceneOffsetY;
  world.addComponent(eid, Position, { x: ox + col * TILE + TILE / 2, y: oy + row * TILE + TILE / 2 });
  world.addComponent(eid, Health, { current: 100, max: 100, armor: 0, magicResist: 0 });
  world.addComponent(eid, Layer, { value: layer });
  return eid;
}

describe('TrapSystem — P2-#18 §5.4 陷阱触发规则', () => {
  let world: TowerWorld;
  let system: TrapSystem;

  beforeEach(() => {
    world = new TowerWorld();
    system = new TrapSystem(TILE);
  });

  describe('AboveGrid 陷阱（地刺）', () => {
    it('Ground 敌人踩中触发伤害', () => {
      const trap = makeTrap(world, 5, 5, LayerVal.AboveGrid);
      const enemy = makeEnemy(world, 5, 5, LayerVal.Ground);
      const hp0 = Health.current[enemy];
      system.update(world, 1.0);
      expect(Health.current[enemy]).toBeLessThan(hp0!);
      expect(Trap.animTimer[trap]).toBeGreaterThan(0);
    });

    it('AboveGrid 敌人踩中触发伤害（同层）', () => {
      const trap = makeTrap(world, 5, 5, LayerVal.AboveGrid);
      const enemy = makeEnemy(world, 5, 5, LayerVal.AboveGrid);
      const hp0 = Health.current[enemy];
      system.update(world, 1.0);
      expect(Health.current[enemy]).toBeLessThan(hp0!);
      expect(Trap.animTimer[trap]).toBeGreaterThan(0);
    });

    it('LowAir 敌人飞越不触发（§5.4 例外）', () => {
      const trap = makeTrap(world, 5, 5, LayerVal.AboveGrid);
      const enemy = makeEnemy(world, 5, 5, LayerVal.LowAir);
      const hp0 = Health.current[enemy];
      system.update(world, 1.0);
      expect(Health.current[enemy]).toBe(hp0);
      expect(Trap.animTimer[trap]).toBe(0);
    });
  });

  describe('BelowGrid 陷阱（地雷待埋）', () => {
    it('任意层敌人路过都触发', () => {
      const trap = makeTrap(world, 5, 5, LayerVal.BelowGrid);
      const ground = makeEnemy(world, 5, 5, LayerVal.Ground);
      const flying = makeEnemy(world, 5, 5, LayerVal.LowAir);
      const hp0g = Health.current[ground];
      const hp0f = Health.current[flying];
      system.update(world, 1.0);
      // 任意一个受到伤害即可（实现选 first-hit）
      const totalDmg =
        (hp0g! - (Health.current[ground] ?? 0)) +
        (hp0f! - (Health.current[flying] ?? 0));
      expect(totalDmg).toBeGreaterThan(0);
    });
  });

  describe('LowAir 陷阱（高空陷阱）', () => {
    it('LowAir 敌人触发', () => {
      const trap = makeTrap(world, 5, 5, LayerVal.LowAir);
      const enemy = makeEnemy(world, 5, 5, LayerVal.LowAir);
      const hp0 = Health.current[enemy];
      system.update(world, 1.0);
      expect(Health.current[enemy]).toBeLessThan(hp0!);
      expect(Trap.animTimer[trap]).toBeGreaterThan(0);
    });

    it('Ground 敌人不触发（不影响地面）', () => {
      const trap = makeTrap(world, 5, 5, LayerVal.LowAir);
      const enemy = makeEnemy(world, 5, 5, LayerVal.Ground);
      const hp0 = Health.current[enemy];
      system.update(world, 1.0);
      expect(Health.current[enemy]).toBe(hp0);
      expect(Trap.animTimer[trap]).toBe(0);
    });
  });

  describe('网格匹配', () => {
    it('敌人不在同格不触发', () => {
      const trap = makeTrap(world, 5, 5, LayerVal.AboveGrid);
      const enemy = makeEnemy(world, 6, 6, LayerVal.Ground);
      const hp0 = Health.current[enemy];
      system.update(world, 1.0);
      expect(Health.current[enemy]).toBe(hp0);
    });

    it('陷阱无 Layer 组件按 AboveGrid 默认行为', () => {
      const eid = world.createEntity();
      const ox = RenderSystem.sceneOffsetX;
      const oy = RenderSystem.sceneOffsetY;
      world.addComponent(eid, Position, { x: ox + 5 * TILE + TILE / 2, y: oy + 5 * TILE + TILE / 2 });
      world.addComponent(eid, GridOccupant, { row: 5, col: 5 });
      world.addComponent(eid, Trap, {
        damagePerSecond: 100, radius: TILE * 0.5, cooldown: 0, cooldownTimer: 0,
        animTimer: 0, animDuration: 0.4, triggerCount: 0, maxTriggers: 0,
      });
      const ground = makeEnemy(world, 5, 5, LayerVal.Ground);
      const flying = makeEnemy(world, 5, 5, LayerVal.LowAir);
      const hp0g = Health.current[ground];
      const hp0f = Health.current[flying];
      system.update(world, 1.0);
      // 默认 AboveGrid: Ground 受伤，LowAir 不受伤
      expect(Health.current[ground]).toBeLessThan(hp0g!);
      expect(Health.current[flying]).toBe(hp0f);
    });

    it('canTriggerOnEnemy 静态矩阵符合 §5.4 规则', () => {
      const { canTriggerOnEnemy } = TrapSystem;
      // AboveGrid 陷阱
      expect(canTriggerOnEnemy(LayerVal.AboveGrid, LayerVal.Ground)).toBe(true);
      expect(canTriggerOnEnemy(LayerVal.AboveGrid, LayerVal.AboveGrid)).toBe(true);
      expect(canTriggerOnEnemy(LayerVal.AboveGrid, LayerVal.LowAir)).toBe(false);
      // BelowGrid 陷阱 (任意层)
      expect(canTriggerOnEnemy(LayerVal.BelowGrid, LayerVal.Ground)).toBe(true);
      expect(canTriggerOnEnemy(LayerVal.BelowGrid, LayerVal.LowAir)).toBe(true);
      expect(canTriggerOnEnemy(LayerVal.BelowGrid, LayerVal.AboveGrid)).toBe(true);
      // LowAir 陷阱
      expect(canTriggerOnEnemy(LayerVal.LowAir, LayerVal.LowAir)).toBe(true);
      expect(canTriggerOnEnemy(LayerVal.LowAir, LayerVal.Ground)).toBe(false);
      expect(canTriggerOnEnemy(LayerVal.LowAir, LayerVal.AboveGrid)).toBe(false);
    });
  });
});
