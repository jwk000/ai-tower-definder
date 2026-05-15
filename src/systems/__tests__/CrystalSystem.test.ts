import { describe, expect, it } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import {
  Crystal,
  Faction,
  FactionTeam,
  Health,
  Position,
  UnitCategory,
  UnitTag,
} from '../../core/components.js';
import type { TowerWorld } from '../../core/World.js';
import { createCrystalSystem } from '../CrystalSystem.js';

function spawnCrystal(world: TowerWorld, x: number, y: number, hp: number, radius: number): number {
  const eid = world.addEntity();
  addComponent(world, Position, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  addComponent(world, Health, eid);
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  addComponent(world, Faction, eid);
  Faction.team[eid] = FactionTeam.Player;
  addComponent(world, UnitTag, eid);
  UnitTag.category[eid] = UnitCategory.Objective;
  addComponent(world, Crystal, eid);
  Crystal.radius[eid] = radius;
  return eid;
}

function spawnEnemy(world: TowerWorld, x: number, y: number, hp: number): number {
  const eid = world.addEntity();
  addComponent(world, Position, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  addComponent(world, Health, eid);
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  addComponent(world, Faction, eid);
  Faction.team[eid] = FactionTeam.Enemy;
  addComponent(world, UnitTag, eid);
  UnitTag.category[eid] = UnitCategory.Enemy;
  return eid;
}

describe('CrystalSystem', () => {
  it('insta-kills one enemy inside crystal radius and deducts 1 HP from the crystal', () => {
    const game = new Game();
    game.pipeline.register(createCrystalSystem());

    const crystal = spawnCrystal(game.world, 100, 100, 10, 50);
    const enemy = spawnEnemy(game.world, 130, 100, 80);

    game.tick(0.016);

    expect(Health.current[enemy]).toBeLessThanOrEqual(0);
    expect(Health.current[crystal]).toBe(9);
  });

  it('does not affect enemies outside crystal radius', () => {
    const game = new Game();
    game.pipeline.register(createCrystalSystem());

    const crystal = spawnCrystal(game.world, 100, 100, 10, 50);
    const farEnemy = spawnEnemy(game.world, 200, 100, 80);

    game.tick(0.016);

    expect(Health.current[farEnemy]).toBe(80);
    expect(Health.current[crystal]).toBe(10);
  });

  it('insta-kills multiple enemies in the same frame and deducts HP per kill', () => {
    const game = new Game();
    game.pipeline.register(createCrystalSystem());

    const crystal = spawnCrystal(game.world, 100, 100, 10, 50);
    const e1 = spawnEnemy(game.world, 110, 100, 80);
    const e2 = spawnEnemy(game.world, 100, 110, 80);
    const e3 = spawnEnemy(game.world, 90, 90, 80);

    game.tick(0.016);

    expect(Health.current[e1]).toBeLessThanOrEqual(0);
    expect(Health.current[e2]).toBeLessThanOrEqual(0);
    expect(Health.current[e3]).toBeLessThanOrEqual(0);
    expect(Health.current[crystal]).toBe(7);
  });

  it('stops killing enemies once crystal HP reaches 0', () => {
    const game = new Game();
    game.pipeline.register(createCrystalSystem());

    const crystal = spawnCrystal(game.world, 100, 100, 1, 50);
    const e1 = spawnEnemy(game.world, 110, 100, 80);
    const e2 = spawnEnemy(game.world, 100, 110, 80);

    game.tick(0.016);

    expect(Health.current[crystal]).toBe(0);
    const killed = [Health.current[e1]! <= 0, Health.current[e2]! <= 0].filter(Boolean).length;
    expect(killed).toBe(1);
  });

  it('respects radius boundary (distance exactly equal to radius counts as inside)', () => {
    const game = new Game();
    game.pipeline.register(createCrystalSystem());

    const crystal = spawnCrystal(game.world, 0, 0, 10, 50);
    const onBoundary = spawnEnemy(game.world, 50, 0, 80);
    const justOutside = spawnEnemy(game.world, 51, 0, 80);

    game.tick(0.016);

    expect(Health.current[onBoundary]).toBeLessThanOrEqual(0);
    expect(Health.current[justOutside]).toBe(80);
    expect(Health.current[crystal]).toBe(9);
  });

  it('does not target player-faction units regardless of distance', () => {
    const game = new Game();
    game.pipeline.register(createCrystalSystem());

    const crystal = spawnCrystal(game.world, 100, 100, 10, 50);
    const allyEid = game.world.addEntity();
    addComponent(game.world, Position, allyEid);
    Position.x[allyEid] = 100;
    Position.y[allyEid] = 100;
    addComponent(game.world, Health, allyEid);
    Health.current[allyEid] = 80;
    Health.max[allyEid] = 80;
    addComponent(game.world, Faction, allyEid);
    Faction.team[allyEid] = FactionTeam.Player;
    addComponent(game.world, UnitTag, allyEid);
    UnitTag.category[allyEid] = UnitCategory.Soldier;

    game.tick(0.016);

    expect(Health.current[allyEid]).toBe(80);
    expect(Health.current[crystal]).toBe(10);
  });

  it('handles a frame where no enemies are in range without errors and without HP change', () => {
    const game = new Game();
    game.pipeline.register(createCrystalSystem());

    const crystal = spawnCrystal(game.world, 100, 100, 10, 50);

    expect(() => game.tick(0.016)).not.toThrow();
    expect(Health.current[crystal]).toBe(10);
  });

  it('handles multiple crystals independently in the same world', () => {
    const game = new Game();
    game.pipeline.register(createCrystalSystem());

    const crystalA = spawnCrystal(game.world, 0, 0, 10, 50);
    const crystalB = spawnCrystal(game.world, 500, 500, 10, 50);
    const enemyNearA = spawnEnemy(game.world, 10, 0, 80);
    const enemyNearB = spawnEnemy(game.world, 510, 500, 80);

    game.tick(0.016);

    expect(Health.current[enemyNearA]).toBeLessThanOrEqual(0);
    expect(Health.current[enemyNearB]).toBeLessThanOrEqual(0);
    expect(Health.current[crystalA]).toBe(9);
    expect(Health.current[crystalB]).toBe(9);
  });
});
