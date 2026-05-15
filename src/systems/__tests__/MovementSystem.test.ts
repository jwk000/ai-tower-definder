import { describe, expect, it, vi } from 'vitest';
import { addComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import { Movement, Position } from '../../core/components.js';
import { createMovementSystem } from '../MovementSystem.js';

function spawnWalker(game: Game, x: number, y: number, speed: number): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Movement, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Movement.speed[eid] = speed;
  Movement.pathIndex[eid] = 0;
  return eid;
}

describe('MovementSystem', () => {
  it('registers itself in the gameplay phase', () => {
    const sys = createMovementSystem({ path: [{ x: 0, y: 0 }] });
    expect(sys.phase).toBe('gameplay');
    expect(sys.name).toBe('MovementSystem');
  });

  it('moves entities towards the next path node at speed * dt (axis-aligned)', () => {
    const game = new Game();
    const path = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ];
    game.pipeline.register(createMovementSystem({ path }));
    const eid = spawnWalker(game, 0, 0, 100);
    Movement.pathIndex[eid] = 1;

    game.tick(0.5);

    expect(Position.x[eid]).toBeCloseTo(50, 5);
    expect(Position.y[eid]).toBeCloseTo(0, 5);
  });

  it('snaps to a node when this tick would overshoot and advances pathIndex', () => {
    const game = new Game();
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
    ];
    game.pipeline.register(createMovementSystem({ path }));
    const eid = spawnWalker(game, 90, 0, 100);
    Movement.pathIndex[eid] = 1;

    game.tick(0.5);

    expect(Position.x[eid]).toBeCloseTo(100, 5);
    expect(Position.y[eid]).toBeCloseTo(0, 5);
    expect(Movement.pathIndex[eid]).toBe(2);
  });

  it('handles diagonal segments using normalized velocity', () => {
    const game = new Game();
    const path = [
      { x: 0, y: 0 },
      { x: 300, y: 400 },
    ];
    game.pipeline.register(createMovementSystem({ path }));
    const eid = spawnWalker(game, 0, 0, 100);
    Movement.pathIndex[eid] = 1;

    game.tick(1);

    expect(Position.x[eid]).toBeCloseTo(60, 3);
    expect(Position.y[eid]).toBeCloseTo(80, 3);
  });

  it('dispatches onEnter once when an entity reaches the final node', () => {
    const game = new Game();
    const path = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ];
    const onEnter = vi.fn();
    game.ruleEngine.registerHandler('test_on_enter', onEnter);
    game.pipeline.register(createMovementSystem({ path }));
    const eid = spawnWalker(game, 0, 0, 100);
    Movement.pathIndex[eid] = 1;
    game.ruleEngine.attachRules(eid, 'onEnter', [{ handler: 'test_on_enter', params: {} }]);

    game.tick(1);
    game.tick(1);

    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onEnter).toHaveBeenCalledWith(eid, {}, game.world);
  });

  it('clamps entities at the final node once reached (no overshoot, no re-dispatch)', () => {
    const game = new Game();
    const path = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ];
    const onEnter = vi.fn();
    game.ruleEngine.registerHandler('test_on_enter', onEnter);
    game.pipeline.register(createMovementSystem({ path }));
    const eid = spawnWalker(game, 0, 0, 100);
    Movement.pathIndex[eid] = 1;
    game.ruleEngine.attachRules(eid, 'onEnter', [{ handler: 'test_on_enter', params: {} }]);

    game.tick(1);
    game.tick(1);
    game.tick(1);

    expect(Position.x[eid]).toBeCloseTo(50, 5);
    expect(Position.y[eid]).toBeCloseTo(0, 5);
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('does nothing for entities missing Position or Movement', () => {
    const game = new Game();
    const path = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    game.pipeline.register(createMovementSystem({ path }));

    const positionOnly = game.world.addEntity();
    addComponent(game.world, Position, positionOnly);
    Position.x[positionOnly] = 7;
    Position.y[positionOnly] = 7;

    expect(() => game.tick(0.5)).not.toThrow();
    expect(Position.x[positionOnly]).toBe(7);
    expect(Position.y[positionOnly]).toBe(7);
  });

  it('throws on an empty path at construction to fail loudly', () => {
    expect(() => createMovementSystem({ path: [] })).toThrow(/path/);
  });
});
