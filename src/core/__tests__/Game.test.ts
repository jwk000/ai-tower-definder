import { describe, expect, it, vi } from 'vitest';

import { Game } from '../Game.js';
import type { System } from '../pipeline.js';
import { PHASE_GAMEPLAY, PHASE_RENDER } from '../pipeline.js';

describe('Game', () => {
  it('exposes a fresh world and RuleEngine on construction', () => {
    const game = new Game();
    expect(game.world).toBeDefined();
    expect(game.world.time).toBe(0);
    expect(game.ruleEngine).toBeDefined();
    expect(game.pipeline).toBeDefined();
  });

  it('tick(dt) advances world.time by dt', () => {
    const game = new Game();
    game.tick(0.016);
    expect(game.world.time).toBeCloseTo(0.016, 5);
    game.tick(0.5);
    expect(game.world.time).toBeCloseTo(0.516, 5);
  });

  it('tick(dt) drives the pipeline systems in order', () => {
    const game = new Game();
    const log: string[] = [];
    const sysA: System = {
      name: 'A',
      update: (_w, dt) => log.push(`A:${dt}`),
    };
    const sysB: System = {
      name: 'B',
      update: (_w, dt) => log.push(`B:${dt}`),
    };
    game.pipeline.register(PHASE_GAMEPLAY, sysA);
    game.pipeline.register(PHASE_RENDER, sysB);

    game.tick(0.033);

    expect(log).toEqual(['A:0.033', 'B:0.033']);
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

  it('rejects non-positive dt to catch frame-time bugs early', () => {
    const game = new Game();
    expect(() => game.tick(0)).toThrow(/dt/);
    expect(() => game.tick(-0.016)).toThrow(/dt/);
  });

  it('clamps absurdly large dt to a safety cap to avoid tunneling on tab-resume', () => {
    const game = new Game();
    game.tick(10);
    expect(game.world.time).toBeLessThanOrEqual(0.25);
    expect(game.world.time).toBeGreaterThan(0);
  });
});
