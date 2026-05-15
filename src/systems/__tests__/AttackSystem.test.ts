import { describe, expect, it } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import {
  Attack,
  Faction,
  FactionTeam,
  Health,
  Position,
} from '../../core/components.js';
import { createAttackSystem } from '../AttackSystem.js';

function spawnTower(
  game: Game,
  x: number,
  y: number,
  opts: { damage: number; range: number; cooldown: number },
): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Faction, eid);
  addComponent(game.world, Attack, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Faction.team[eid] = FactionTeam.Player;
  Attack.damage[eid] = opts.damage;
  Attack.range[eid] = opts.range;
  Attack.cooldown[eid] = opts.cooldown;
  Attack.cooldownLeft[eid] = 0;
  return eid;
}

function spawnEnemy(game: Game, x: number, y: number, hp: number): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Faction, eid);
  addComponent(game.world, Health, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Faction.team[eid] = FactionTeam.Enemy;
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  return eid;
}

describe('AttackSystem', () => {
  it('registers itself in the gameplay phase', () => {
    const sys = createAttackSystem();
    expect(sys.phase).toBe('gameplay');
    expect(sys.name).toBe('AttackSystem');
  });

  it('damages the nearest enemy within range when off cooldown', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    const tower = spawnTower(game, 100, 100, { damage: 25, range: 200, cooldown: 1 });
    const near = spawnEnemy(game, 150, 100, 100);
    const far = spawnEnemy(game, 150, 250, 100);

    game.tick(0.1);

    expect(Health.current[near]).toBe(75);
    expect(Health.current[far]).toBe(100);
    expect(Attack.cooldownLeft[tower]).toBeCloseTo(1, 5);
  });

  it('does not attack enemies outside range', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    spawnTower(game, 0, 0, { damage: 25, range: 100, cooldown: 1 });
    const outOfRange = spawnEnemy(game, 200, 0, 100);

    game.tick(0.1);

    expect(Health.current[outOfRange]).toBe(100);
  });

  it('does not attack friendly units', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    spawnTower(game, 0, 0, { damage: 25, range: 500, cooldown: 1 });
    const friendly = game.world.addEntity();
    addComponent(game.world, Position, friendly);
    addComponent(game.world, Faction, friendly);
    addComponent(game.world, Health, friendly);
    Position.x[friendly] = 50;
    Position.y[friendly] = 0;
    Faction.team[friendly] = FactionTeam.Player;
    Health.current[friendly] = 100;
    Health.max[friendly] = 100;

    game.tick(0.1);

    expect(Health.current[friendly]).toBe(100);
  });

  it('decreases cooldownLeft by dt each tick', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    const tower = spawnTower(game, 0, 0, { damage: 10, range: 500, cooldown: 1 });
    const enemy = spawnEnemy(game, 50, 0, 100);

    game.tick(0.1);
    expect(Attack.cooldownLeft[tower]).toBeCloseTo(1, 5);

    game.tick(0.25);
    expect(Attack.cooldownLeft[tower]).toBeCloseTo(0.75, 5);
    expect(Health.current[enemy]).toBe(90);

    game.tick(0.25);
    expect(Attack.cooldownLeft[tower]).toBeCloseTo(0.5, 5);
    expect(Health.current[enemy]).toBe(90);
  });

  it('does not fire while on cooldown even if an enemy is in range', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    const tower = spawnTower(game, 0, 0, { damage: 30, range: 500, cooldown: 2 });
    const enemy = spawnEnemy(game, 50, 0, 100);

    game.tick(0.1);
    expect(Health.current[enemy]).toBe(70);
    expect(Attack.cooldownLeft[tower]).toBeCloseTo(2, 5);

    for (let i = 0; i < 5; i += 1) game.tick(0.25);
    expect(Health.current[enemy]).toBe(70);
  });

  it('fires again immediately when cooldown elapses', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    spawnTower(game, 0, 0, { damage: 25, range: 500, cooldown: 0.5 });
    const enemy = spawnEnemy(game, 50, 0, 1000);

    game.tick(0.1);
    expect(Health.current[enemy]).toBe(975);

    for (let i = 0; i < 3; i += 1) game.tick(0.25);
    expect(Health.current[enemy]).toBe(950);
  });

  it('switches targets when the current one dies (becomes Health.current <= 0)', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    spawnTower(game, 0, 0, { damage: 100, range: 500, cooldown: 0.5 });
    const enemyA = spawnEnemy(game, 30, 0, 50);
    const enemyB = spawnEnemy(game, 60, 0, 100);

    game.tick(0.1);
    expect(Health.current[enemyA]).toBe(-50);

    for (let i = 0; i < 3; i += 1) game.tick(0.25);
    expect(Health.current[enemyB]).toBe(0);
  });

  it('picks closest among multiple in-range enemies', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    spawnTower(game, 100, 100, { damage: 10, range: 500, cooldown: 1 });
    const farther = spawnEnemy(game, 300, 100, 100);
    const closest = spawnEnemy(game, 130, 100, 100);
    const mid = spawnEnemy(game, 200, 100, 100);

    game.tick(0.1);

    expect(Health.current[closest]).toBe(90);
    expect(Health.current[mid]).toBe(100);
    expect(Health.current[farther]).toBe(100);
  });

  it('ignores dead enemies (Health.current <= 0) when picking targets', () => {
    const game = new Game();
    game.pipeline.register(createAttackSystem());
    spawnTower(game, 0, 0, { damage: 10, range: 500, cooldown: 1 });
    const corpse = spawnEnemy(game, 30, 0, 0);
    Health.current[corpse] = 0;
    const alive = spawnEnemy(game, 60, 0, 100);

    game.tick(0.1);

    expect(Health.current[corpse]).toBe(0);
    expect(Health.current[alive]).toBe(90);
  });
});
