import { describe, expect, it, vi } from 'vitest';
import { addComponent, defineQuery, hasComponent } from 'bitecs';

import { Game } from '../../core/Game.js';
import { DeadTag, Health, Position } from '../../core/components.js';
import { createHealthSystem } from '../HealthSystem.js';
import { createLifecycleSystem } from '../LifecycleSystem.js';

const livingMortals = defineQuery([Health]);

function spawnMortal(game: Game, hp: number): number {
  const eid = game.world.addEntity();
  addComponent(game.world, Position, eid);
  addComponent(game.world, Health, eid);
  Position.x[eid] = 0;
  Position.y[eid] = 0;
  Health.current[eid] = hp;
  Health.max[eid] = hp;
  return eid;
}

describe('HealthSystem', () => {
  it('registers in the lifecycle phase', () => {
    const sys = createHealthSystem();
    expect(sys.phase).toBe('lifecycle');
    expect(sys.name).toBe('HealthSystem');
  });

  it('tags entities with DeadTag when Health.current drops to <= 0', () => {
    const game = new Game();
    game.pipeline.register(createHealthSystem());
    const alive = spawnMortal(game, 50);
    const dying = spawnMortal(game, 10);
    Health.current[dying] = 0;
    const obliterated = spawnMortal(game, 5);
    Health.current[obliterated] = -25;

    game.tick(0.1);

    expect(hasComponent(game.world, DeadTag, alive)).toBe(false);
    expect(hasComponent(game.world, DeadTag, dying)).toBe(true);
    expect(hasComponent(game.world, DeadTag, obliterated)).toBe(true);
  });

  it('is idempotent: re-tagging an already-dead entity does not double-fire', () => {
    const game = new Game();
    game.pipeline.register(createHealthSystem());
    const eid = spawnMortal(game, 10);
    Health.current[eid] = 0;

    game.tick(0.1);
    game.tick(0.1);

    expect(hasComponent(game.world, DeadTag, eid)).toBe(true);
  });
});

describe('LifecycleSystem', () => {
  it('registers in the lifecycle phase', () => {
    const sys = createLifecycleSystem();
    expect(sys.phase).toBe('lifecycle');
    expect(sys.name).toBe('LifecycleSystem');
  });

  it('dispatches onDeath for entities carrying DeadTag, then destroys them', () => {
    const game = new Game();
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());
    const onDeath = vi.fn();
    game.ruleEngine.registerHandler('test_on_death', onDeath);

    const eid = spawnMortal(game, 10);
    game.ruleEngine.attachRules(eid, 'onDeath', [{ handler: 'test_on_death', params: {} }]);
    Health.current[eid] = 0;

    game.tick(0.1);

    expect(onDeath).toHaveBeenCalledTimes(1);
    expect(onDeath).toHaveBeenCalledWith(eid, {}, game.world);
    expect(livingMortals(game.world)).not.toContain(eid);
  });

  it('still destroys entities that have no onDeath rules attached', () => {
    const game = new Game();
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());
    const eid = spawnMortal(game, 10);
    Health.current[eid] = -5;

    game.tick(0.1);

    expect(livingMortals(game.world)).not.toContain(eid);
  });

  it('clears RuleEngine bindings for the destroyed entity', () => {
    const game = new Game();
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());
    const onDeath = vi.fn();
    game.ruleEngine.registerHandler('test_on_death', onDeath);

    const eid = spawnMortal(game, 10);
    game.ruleEngine.attachRules(eid, 'onDeath', [{ handler: 'test_on_death', params: {} }]);
    Health.current[eid] = 0;

    game.tick(0.1);

    expect(game.ruleEngine.getRules(eid, 'onDeath')).toEqual([]);
  });

  it('does not double-dispatch onDeath if a corpse somehow persists across ticks', () => {
    const game = new Game();
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());
    const onDeath = vi.fn();
    game.ruleEngine.registerHandler('test_on_death', onDeath);
    const eid = spawnMortal(game, 10);
    game.ruleEngine.attachRules(eid, 'onDeath', [{ handler: 'test_on_death', params: {} }]);
    Health.current[eid] = 0;

    game.tick(0.1);
    game.tick(0.1);

    expect(onDeath).toHaveBeenCalledTimes(1);
  });
});
