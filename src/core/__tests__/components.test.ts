import { describe, expect, it } from 'vitest';
import { addComponent, hasComponent } from 'bitecs';

import {
  Position,
  Health,
  Movement,
  Visual,
  Faction,
  UnitTag,
  Owner,
  DeadTag,
  JustSpawnedTag,
  FactionTeam,
  UnitCategory,
  VisualShape,
} from '../components.js';
import { createTowerWorld } from '../World.js';

describe('core components', () => {
  describe('field schema (SoA with bitecs Types)', () => {
    it('Position has f32 x and y for world coordinates', () => {
      expect(Position.x).toBeInstanceOf(Float32Array);
      expect(Position.y).toBeInstanceOf(Float32Array);
    });

    it('Health has i32 current and max for HP', () => {
      expect(Health.current).toBeInstanceOf(Int32Array);
      expect(Health.max).toBeInstanceOf(Int32Array);
    });

    it('Movement has speed and velocity (vx, vy) and pathIndex', () => {
      expect(Movement.speed).toBeInstanceOf(Float32Array);
      expect(Movement.vx).toBeInstanceOf(Float32Array);
      expect(Movement.vy).toBeInstanceOf(Float32Array);
      expect(Movement.pathIndex).toBeInstanceOf(Uint16Array);
    });

    it('Visual has shape, color, size (size in px)', () => {
      expect(Visual.shape).toBeInstanceOf(Uint8Array);
      expect(Visual.color).toBeInstanceOf(Uint32Array);
      expect(Visual.size).toBeInstanceOf(Float32Array);
    });

    it('Faction has a single team byte', () => {
      expect(Faction.team).toBeInstanceOf(Uint8Array);
    });

    it('UnitTag has category byte and unitId for registry lookup', () => {
      expect(UnitTag.category).toBeInstanceOf(Uint8Array);
      expect(UnitTag.unitId).toBeInstanceOf(Uint16Array);
    });

    it('Owner stores parent entity id as i32 (-1 = no parent)', () => {
      expect(Owner.parent).toBeInstanceOf(Int32Array);
    });

    it('DeadTag and JustSpawnedTag are tag components (no fields)', () => {
      expect(Object.keys(DeadTag).length).toBe(0);
      expect(Object.keys(JustSpawnedTag).length).toBe(0);
    });
  });

  describe('enum stability (Wave 1 contract freeze)', () => {
    it('FactionTeam values are frozen', () => {
      expect(FactionTeam.Player).toBe(1);
      expect(FactionTeam.Enemy).toBe(2);
      expect(FactionTeam.Neutral).toBe(3);
    });

    it('UnitCategory values are frozen and match design 21-unit-roster', () => {
      expect(UnitCategory.Tower).toBe(1);
      expect(UnitCategory.Soldier).toBe(2);
      expect(UnitCategory.Enemy).toBe(3);
      expect(UnitCategory.Building).toBe(4);
      expect(UnitCategory.Trap).toBe(5);
      expect(UnitCategory.Neutral).toBe(6);
      expect(UnitCategory.Objective).toBe(7);
    });

    it('VisualShape values are frozen for MVP geometry primitives', () => {
      expect(VisualShape.Square).toBe(1);
      expect(VisualShape.Circle).toBe(2);
      expect(VisualShape.Triangle).toBe(3);
    });
  });

  describe('component attachment and SoA access', () => {
    it('attaches Position to an entity and reads back values written via SoA', () => {
      const world = createTowerWorld();
      const eid = world.addEntity();
      addComponent(world, Position, eid);
      Position.x[eid] = 320;
      Position.y[eid] = 288;
      expect(Position.x[eid]).toBe(320);
      expect(Position.y[eid]).toBe(288);
      expect(hasComponent(world, Position, eid)).toBe(true);
    });

    it('attaches Health and tracks current vs max independently', () => {
      const world = createTowerWorld();
      const eid = world.addEntity();
      addComponent(world, Health, eid);
      Health.current[eid] = 80;
      Health.max[eid] = 100;
      expect(Health.current[eid]).toBe(80);
      expect(Health.max[eid]).toBe(100);
    });

    it('Owner.parent defaults to 0; -1 sentinel can be stored as i32', () => {
      const world = createTowerWorld();
      const eid = world.addEntity();
      addComponent(world, Owner, eid);
      Owner.parent[eid] = -1;
      expect(Owner.parent[eid]).toBe(-1);
    });

    it('DeadTag presence is observable via hasComponent only (no fields)', () => {
      const world = createTowerWorld();
      const eid = world.addEntity();
      expect(hasComponent(world, DeadTag, eid)).toBe(false);
      addComponent(world, DeadTag, eid);
      expect(hasComponent(world, DeadTag, eid)).toBe(true);
    });
  });
});
