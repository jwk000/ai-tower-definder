import { describe, expect, it, vi } from 'vitest';
import { hasComponent } from 'bitecs';

import { createTowerWorld } from '../../core/World.js';
import {
  Attack,
  Faction,
  FactionTeam,
  Health,
  Movement,
  Position,
  UnitCategory,
  UnitTag,
  Visual,
  VisualShape,
} from '../../core/components.js';
import type { UnitConfig } from '../UnitFactory.js';
import { spawnUnit } from '../UnitFactory.js';

const ENEMY_GRUNT: UnitConfig = {
  id: 'grunt',
  category: 'Enemy',
  faction: 'Enemy',
  stats: { hp: 50, atk: 5, attackSpeed: 1, range: 0, speed: 80 },
  visual: { shape: 'circle', color: 0xef5350, size: 24 },
};

const TOWER_ARROW: UnitConfig = {
  id: 'arrow_tower',
  category: 'Tower',
  faction: 'Player',
  stats: { hp: 100, atk: 10, attackSpeed: 1, range: 200, speed: 0 },
  visual: { shape: 'rect', color: 0x4fc3f7, size: 36 },
};

describe('UnitFactory.spawnUnit', () => {
  it('creates an enemy entity with Position, Health, Movement, Visual, Faction, UnitTag components', () => {
    const world = createTowerWorld();
    const eid = spawnUnit(world, ENEMY_GRUNT, { x: 100, y: 200 });

    expect(hasComponent(world, Position, eid)).toBe(true);
    expect(Position.x[eid]).toBe(100);
    expect(Position.y[eid]).toBe(200);

    expect(hasComponent(world, Health, eid)).toBe(true);
    expect(Health.current[eid]).toBe(50);
    expect(Health.max[eid]).toBe(50);

    expect(hasComponent(world, Movement, eid)).toBe(true);
    expect(Movement.speed[eid]).toBe(80);

    expect(hasComponent(world, Visual, eid)).toBe(true);
    expect(Visual.shape[eid]).toBe(VisualShape.Circle);
    expect(Visual.color[eid]).toBe(0xef5350);
    expect(Visual.size[eid]).toBe(24);

    expect(hasComponent(world, Faction, eid)).toBe(true);
    expect(Faction.team[eid]).toBe(FactionTeam.Enemy);

    expect(hasComponent(world, UnitTag, eid)).toBe(true);
    expect(UnitTag.category[eid]).toBe(UnitCategory.Enemy);
  });

  it('omits Movement for stationary units (speed = 0) and attaches Attack when range > 0', () => {
    const world = createTowerWorld();
    const eid = spawnUnit(world, TOWER_ARROW, { x: 50, y: 60 });

    expect(hasComponent(world, Movement, eid)).toBe(false);

    expect(hasComponent(world, Attack, eid)).toBe(true);
    expect(Attack.damage[eid]).toBe(10);
    expect(Attack.range[eid]).toBe(200);
    expect(Attack.cooldown[eid]).toBeCloseTo(1.0);
    expect(Attack.cooldownLeft[eid]).toBe(0);

    expect(Faction.team[eid]).toBe(FactionTeam.Player);
    expect(UnitTag.category[eid]).toBe(UnitCategory.Tower);
  });

  it('attaches lifecycle rule definitions to the rule engine under their event names', () => {
    const world = createTowerWorld();
    world.ruleEngine.registerHandler('drop_gold', () => undefined);
    world.ruleEngine.registerHandler('play_effect', () => undefined);
    world.ruleEngine.registerHandler('flash_color', () => undefined);

    const config: UnitConfig = {
      ...ENEMY_GRUNT,
      lifecycle: {
        onDeath: [
          { handler: 'drop_gold', params: { amount: 10 } },
          { handler: 'play_effect', params: { effect: 'death_basic' } },
        ],
        onHit: [{ handler: 'flash_color', params: { color: '#ffffff', duration: 0.1 } }],
      },
    };
    const eid = spawnUnit(world, config, { x: 0, y: 0 });

    const deathRules = world.ruleEngine.getRules(eid, 'onDeath');
    expect(deathRules).toHaveLength(2);
    expect(deathRules[0]).toEqual({ handler: 'drop_gold', params: { amount: 10 } });

    const hitRules = world.ruleEngine.getRules(eid, 'onHit');
    expect(hitRules).toHaveLength(1);
    expect(hitRules[0]?.handler).toBe('flash_color');
  });

  it('dispatches onCreate immediately when onCreate rules are configured', () => {
    const world = createTowerWorld();
    const onCreate = vi.fn();
    world.ruleEngine.registerHandler('record_spawn', onCreate);

    const config: UnitConfig = {
      ...ENEMY_GRUNT,
      lifecycle: {
        onCreate: [{ handler: 'record_spawn', params: { mark: 'grunt-001' } }],
      },
    };
    const eid = spawnUnit(world, config, { x: 0, y: 0 });

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(eid, { mark: 'grunt-001' }, world);
  });

  it('skips rule attachment entirely when lifecycle is omitted', () => {
    const world = createTowerWorld();
    const eid = spawnUnit(world, ENEMY_GRUNT, { x: 0, y: 0 });

    expect(world.ruleEngine.getRules(eid, 'onDeath')).toEqual([]);
    expect(world.ruleEngine.getRules(eid, 'onHit')).toEqual([]);
    expect(world.ruleEngine.getRules(eid, 'onCreate')).toEqual([]);
  });

  it('maps faction strings Player / Enemy / Neutral to FactionTeam enum values', () => {
    const world = createTowerWorld();
    const player = spawnUnit(world, { ...ENEMY_GRUNT, faction: 'Player' }, { x: 0, y: 0 });
    const enemy = spawnUnit(world, { ...ENEMY_GRUNT, faction: 'Enemy' }, { x: 0, y: 0 });
    const neutral = spawnUnit(world, { ...ENEMY_GRUNT, faction: 'Neutral' }, { x: 0, y: 0 });

    expect(Faction.team[player]).toBe(FactionTeam.Player);
    expect(Faction.team[enemy]).toBe(FactionTeam.Enemy);
    expect(Faction.team[neutral]).toBe(FactionTeam.Neutral);
  });

  it('maps visual.shape strings rect / circle / triangle to VisualShape enum values', () => {
    const world = createTowerWorld();
    const rect = spawnUnit(
      world,
      { ...ENEMY_GRUNT, visual: { ...ENEMY_GRUNT.visual, shape: 'rect' } },
      { x: 0, y: 0 },
    );
    const circ = spawnUnit(
      world,
      { ...ENEMY_GRUNT, visual: { ...ENEMY_GRUNT.visual, shape: 'circle' } },
      { x: 0, y: 0 },
    );
    const tri = spawnUnit(
      world,
      { ...ENEMY_GRUNT, visual: { ...ENEMY_GRUNT.visual, shape: 'triangle' } },
      { x: 0, y: 0 },
    );

    expect(Visual.shape[rect]).toBe(VisualShape.Square);
    expect(Visual.shape[circ]).toBe(VisualShape.Circle);
    expect(Visual.shape[tri]).toBe(VisualShape.Triangle);
  });

  it('spawning the same config twice produces distinct entities with independent component values', () => {
    const world = createTowerWorld();
    const a = spawnUnit(world, ENEMY_GRUNT, { x: 10, y: 20 });
    const b = spawnUnit(world, ENEMY_GRUNT, { x: 30, y: 40 });

    expect(a).not.toBe(b);
    expect(Position.x[a]).toBe(10);
    expect(Position.x[b]).toBe(30);
    Health.current[a] = 1;
    expect(Health.current[b]).toBe(50);
  });

  it('throws on unknown faction string to fail fast on misconfigured YAML', () => {
    const world = createTowerWorld();
    expect(() =>
      spawnUnit(world, { ...ENEMY_GRUNT, faction: 'Bogus' as never }, { x: 0, y: 0 }),
    ).toThrow(/faction/i);
  });

  it('throws on unknown visual shape string to fail fast on misconfigured YAML', () => {
    const world = createTowerWorld();
    expect(() =>
      spawnUnit(
        world,
        { ...ENEMY_GRUNT, visual: { ...ENEMY_GRUNT.visual, shape: 'star' as never } },
        { x: 0, y: 0 },
      ),
    ).toThrow(/shape/i);
  });
});
