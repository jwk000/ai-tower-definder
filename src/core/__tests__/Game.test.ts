import { describe, expect, it, vi } from 'vitest';

import { Game } from '../Game.js';
import type { System } from '../pipeline.js';

describe('Game', () => {
  it('exposes a fresh world, pipeline, and RuleEngine on construction', () => {
    const game = new Game();
    expect(game.world).toBeDefined();
    expect(game.world.time.elapsed).toBe(0);
    expect(game.world.time.dt).toBe(0);
    expect(game.pipeline).toBeDefined();
    expect(game.ruleEngine).toBeDefined();
  });

  it('tick(dt) advances world.time.elapsed by dt and records dt', () => {
    const game = new Game();
    game.tick(0.016);
    expect(game.world.time.elapsed).toBeCloseTo(0.016, 5);
    expect(game.world.time.dt).toBeCloseTo(0.016, 5);
    game.tick(0.1);
    expect(game.world.time.elapsed).toBeCloseTo(0.116, 5);
    expect(game.world.time.dt).toBeCloseTo(0.1, 5);
  });

  it('tick(dt) drives the pipeline in phase order with the (possibly clamped) dt', () => {
    const game = new Game();
    const log: string[] = [];
    const renderSys: System = {
      name: 'TestRender',
      phase: 'render',
      update: (_w, dt) => log.push(`render:${dt}`),
    };
    const gameplaySys: System = {
      name: 'TestGameplay',
      phase: 'gameplay',
      update: (_w, dt) => log.push(`gameplay:${dt}`),
    };
    game.pipeline.register(renderSys);
    game.pipeline.register(gameplaySys);

    game.tick(0.033);

    expect(log).toEqual(['gameplay:0.033', 'render:0.033']);
  });

  it('tick(dt) flushes deferred entity destruction at end of tick', () => {
    const game = new Game();
    const eid = game.world.addEntity();
    game.world.destroyEntity(eid);
    expect(game.world.isDestroyed(eid)).toBe(true);
    const flushSpy = vi.spyOn(game.world, 'flushDeferred');

    game.tick(0.016);

    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects non-positive or NaN dt to catch frame-time bugs early', () => {
    const game = new Game();
    expect(() => game.tick(0)).toThrow(/dt/);
    expect(() => game.tick(-0.016)).toThrow(/dt/);
    expect(() => game.tick(Number.NaN)).toThrow(/dt/);
  });

  it('clamps absurdly large dt to a 0.25s safety cap to avoid tab-resume tunneling', () => {
    const game = new Game();
    game.tick(10);
    expect(game.world.time.elapsed).toBeCloseTo(0.25, 5);
    expect(game.world.time.dt).toBeCloseTo(0.25, 5);
  });
});
