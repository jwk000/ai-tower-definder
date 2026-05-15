import { describe, expect, it } from 'vitest';
import { addComponent, defineComponent, hasComponent, Types } from 'bitecs';

import { createTowerWorld } from '../World.js';

const TestPos = defineComponent({ x: Types.f32, y: Types.f32 });

describe('TowerWorld', () => {
  describe('createTowerWorld', () => {
    it('returns a bitecs-compatible world with TowerWorld extensions', () => {
      const world = createTowerWorld();
      expect(world).toBeDefined();
      expect(typeof world.destroyEntity).toBe('function');
      expect(typeof world.isDestroyed).toBe('function');
      expect(typeof world.flushDeferred).toBe('function');
      expect(world.time).toEqual({ dt: 0, elapsed: 0 });
    });

    it('supports bitecs addEntity / addComponent / hasComponent', () => {
      const world = createTowerWorld();
      const eid = world.addEntity();
      addComponent(world, TestPos, eid);
      TestPos.x[eid] = 10;
      TestPos.y[eid] = 20;
      expect(hasComponent(world, TestPos, eid)).toBe(true);
      expect(TestPos.x[eid]).toBe(10);
      expect(TestPos.y[eid]).toBe(20);
    });

    it('produces distinct entity ids on successive addEntity calls', () => {
      const world = createTowerWorld();
      const a = world.addEntity();
      const b = world.addEntity();
      const c = world.addEntity();
      expect(new Set([a, b, c]).size).toBe(3);
    });
  });

  describe('destroyEntity (deferred cleanup)', () => {
    it('marks an entity destroyed without immediately removing it', () => {
      const world = createTowerWorld();
      const eid = world.addEntity();
      addComponent(world, TestPos, eid);

      world.destroyEntity(eid);

      expect(world.isDestroyed(eid)).toBe(true);
      expect(hasComponent(world, TestPos, eid)).toBe(true);
    });

    it('is idempotent: destroying the same entity twice still flushes it once', () => {
      const world = createTowerWorld();
      const eid = world.addEntity();
      world.destroyEntity(eid);
      world.destroyEntity(eid);
      expect(world.flushDeferred()).toBe(1);
    });

    it('ignores destroy calls for unknown entity ids without throwing', () => {
      const world = createTowerWorld();
      expect(() => world.destroyEntity(9999)).not.toThrow();
      expect(world.flushDeferred()).toBe(0);
    });
  });

  describe('flushDeferred', () => {
    it('removes all entities marked destroyed and returns the count', () => {
      const world = createTowerWorld();
      const a = world.addEntity();
      const b = world.addEntity();
      const c = world.addEntity();
      addComponent(world, TestPos, a);
      addComponent(world, TestPos, b);
      addComponent(world, TestPos, c);

      world.destroyEntity(a);
      world.destroyEntity(c);

      const removed = world.flushDeferred();

      expect(removed).toBe(2);
      expect(hasComponent(world, TestPos, a)).toBe(false);
      expect(hasComponent(world, TestPos, b)).toBe(true);
      expect(hasComponent(world, TestPos, c)).toBe(false);
      expect(world.isDestroyed(a)).toBe(false);
      expect(world.isDestroyed(c)).toBe(false);
    });

    it('returns 0 when no entities are pending destruction', () => {
      const world = createTowerWorld();
      world.addEntity();
      expect(world.flushDeferred()).toBe(0);
    });

    it('clears the destroyed set after flush so the same entity can be reused', () => {
      const world = createTowerWorld();
      const eid = world.addEntity();
      world.destroyEntity(eid);
      world.flushDeferred();
      expect(world.isDestroyed(eid)).toBe(false);
    });
  });

  describe('time', () => {
    it('is mutable and persists between operations (driven by main loop)', () => {
      const world = createTowerWorld();
      world.time.dt = 1 / 60;
      world.time.elapsed = 0.5;
      expect(world.time.dt).toBeCloseTo(1 / 60);
      expect(world.time.elapsed).toBe(0.5);
    });
  });
});
