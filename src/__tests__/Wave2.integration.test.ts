import { describe, expect, it, vi } from 'vitest';
import { addComponent, hasComponent } from 'bitecs';

import { Game } from '../core/Game.js';
import {
  Crystal,
  DeadTag,
  Faction,
  FactionTeam,
  Health,
  Position,
  UnitCategory,
  UnitTag,
} from '../core/components.js';
import { spawnUnit, type UnitConfig } from '../factories/UnitFactory.js';
import { createCrystalSystem } from '../systems/CrystalSystem.js';
import { createHealthSystem } from '../systems/HealthSystem.js';
import { createLifecycleSystem } from '../systems/LifecycleSystem.js';
import { createMovementSystem } from '../systems/MovementSystem.js';

const GRUNT: UnitConfig = {
  id: 'grunt',
  category: 'Enemy',
  faction: 'Enemy',
  stats: { hp: 50, atk: 0, attackSpeed: 0, range: 0, speed: 100 },
  visual: { shape: 'circle', color: 0xef5350, size: 24 },
  lifecycle: {
    onDeath: [{ handler: 'drop_gold', params: { amount: 10 } }],
  },
};

function spawnCrystalAt(game: Game, x: number, y: number, hp: number, radius: number): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  addComponent(game.world, Health, eid);
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  addComponent(game.world, Faction, eid);
  Faction.team[eid] = FactionTeam.Player;
  addComponent(game.world, UnitTag, eid);
  UnitTag.category[eid] = UnitCategory.Objective;
  addComponent(game.world, Crystal, eid);
  Crystal.radius[eid] = radius;
  return eid;
}

describe('Wave 2 integration: enemy spawn -> walk path -> crystal kill -> lifecycle cleanup', () => {
  it('drives a grunt from spawn to crystal and resolves the full death pipeline within bounded ticks', () => {
    const game = new Game();
    const dropGold = vi.fn();
    game.world.ruleEngine.registerHandler('drop_gold', dropGold);

    const path = [
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ];
    game.pipeline.register(createMovementSystem({ path }));
    game.pipeline.register(createCrystalSystem());
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const crystal = spawnCrystalAt(game, 400, 100, 5, 50);
    const grunt = spawnUnit(game.world, GRUNT, { x: 0, y: 100 });

    expect(Health.current[grunt]).toBe(50);
    expect(Health.current[crystal]).toBe(5);

    let resolved = false;
    for (let i = 0; i < 600 && !resolved; i += 1) {
      game.tick(0.1);
      if (dropGold.mock.calls.length > 0) {
        resolved = true;
      }
    }

    expect(resolved).toBe(true);
    expect(dropGold).toHaveBeenCalledTimes(1);
    expect(dropGold).toHaveBeenCalledWith(grunt, { amount: 10 }, game.world);
    expect(Health.current[crystal]).toBe(4);
    expect(hasComponent(game.world, DeadTag, grunt)).toBe(false);
  });

  it('handles a wave of three grunts: each one trims crystal HP by 1, onDeath fires per kill, deads are destroyed', () => {
    const game = new Game();
    const dropGold = vi.fn();
    game.world.ruleEngine.registerHandler('drop_gold', dropGold);

    const path = [
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ];
    game.pipeline.register(createMovementSystem({ path }));
    game.pipeline.register(createCrystalSystem());
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const crystal = spawnCrystalAt(game, 400, 100, 10, 30);
    spawnUnit(game.world, GRUNT, { x: 0, y: 100 });
    spawnUnit(game.world, GRUNT, { x: -100, y: 100 });
    spawnUnit(game.world, GRUNT, { x: -200, y: 100 });

    for (let i = 0; i < 600 && dropGold.mock.calls.length < 3; i += 1) {
      game.tick(0.1);
    }

    expect(dropGold).toHaveBeenCalledTimes(3);
    expect(Health.current[crystal]).toBe(7);
  });

  it('a single Game.tick covers proximity-kill in same frame: zero HP, DeadTag attached, onDeath dispatched, entity destroyed', () => {
    const game = new Game();
    const dropGold = vi.fn();
    game.world.ruleEngine.registerHandler('drop_gold', dropGold);

    const path = [
      { x: 0, y: 100 },
      { x: 100, y: 100 },
    ];
    game.pipeline.register(createMovementSystem({ path }));
    game.pipeline.register(createCrystalSystem());
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const crystal = spawnCrystalAt(game, 100, 100, 5, 50);
    const grunt = spawnUnit(game.world, GRUNT, { x: 60, y: 100 });

    game.tick(0.016);

    expect(dropGold).toHaveBeenCalledTimes(1);
    expect(Health.current[crystal]).toBe(4);
    expect(hasComponent(game.world, DeadTag, grunt)).toBe(false);
  });
});
