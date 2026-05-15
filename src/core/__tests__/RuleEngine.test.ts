import { describe, expect, it, vi } from 'vitest';

import { RuleEngine, LIFECYCLE_EVENTS, type LifecycleEvent, type RuleHandler } from '../RuleEngine.js';
import { createTowerWorld } from '../World.js';

describe('LIFECYCLE_EVENTS', () => {
  it('exposes the 9 canonical lifecycle event names (frozen by Wave 1 contract)', () => {
    expect(LIFECYCLE_EVENTS).toEqual([
      'onCreate',
      'onDeath',
      'onHit',
      'onAttack',
      'onKill',
      'onUpgrade',
      'onDestroy',
      'onEnter',
      'onLeave',
    ]);
  });
});

describe('RuleEngine', () => {
  describe('handler registry', () => {
    it('stores a handler and retrieves it by name', () => {
      const engine = new RuleEngine();
      const handler: RuleHandler = vi.fn();
      engine.registerHandler('deal_damage', handler);
      expect(engine.getHandler('deal_damage')).toBe(handler);
    });

    it('rejects duplicate handler registrations under the same name', () => {
      const engine = new RuleEngine();
      engine.registerHandler('deal_damage', () => {});
      expect(() => engine.registerHandler('deal_damage', () => {})).toThrow(/duplicate/i);
    });

    it('returns undefined for an unknown handler name (caller decides what to do)', () => {
      const engine = new RuleEngine();
      expect(engine.getHandler('nonexistent')).toBeUndefined();
    });
  });

  describe('rule attachment', () => {
    it('attaches rules to an entity for a specific event', () => {
      const engine = new RuleEngine();
      engine.registerHandler('h1', () => {});
      engine.attachRules(42, 'onDeath', [{ handler: 'h1', params: { x: 1 } }]);
      const rules = engine.getRules(42, 'onDeath');
      expect(rules).toEqual([{ handler: 'h1', params: { x: 1 } }]);
    });

    it('keeps rules for different events on the same entity independent', () => {
      const engine = new RuleEngine();
      engine.registerHandler('h1', () => {});
      engine.attachRules(1, 'onDeath', [{ handler: 'h1', params: {} }]);
      engine.attachRules(1, 'onHit', [{ handler: 'h1', params: { v: 2 } }]);
      expect(engine.getRules(1, 'onDeath')).toEqual([{ handler: 'h1', params: {} }]);
      expect(engine.getRules(1, 'onHit')).toEqual([{ handler: 'h1', params: { v: 2 } }]);
    });

    it('rejects attaching rules that reference an unregistered handler', () => {
      const engine = new RuleEngine();
      expect(() =>
        engine.attachRules(1, 'onDeath', [{ handler: 'never_registered', params: {} }]),
      ).toThrow(/handler.*not.*regist/i);
    });

    it('rejects rules attached to an unknown event name', () => {
      const engine = new RuleEngine();
      engine.registerHandler('h1', () => {});
      expect(() =>
        engine.attachRules(1, 'onExplode' as LifecycleEvent, [{ handler: 'h1', params: {} }]),
      ).toThrow(/unknown.*event/i);
    });
  });

  describe('dispatch', () => {
    it('invokes every handler bound to the entity for that event in order', () => {
      const engine = new RuleEngine();
      const log: string[] = [];
      engine.registerHandler('h1', (eid, params) => {
        log.push(`h1(${eid},${JSON.stringify(params)})`);
      });
      engine.registerHandler('h2', (eid, params) => {
        log.push(`h2(${eid},${JSON.stringify(params)})`);
      });

      engine.attachRules(7, 'onDeath', [
        { handler: 'h1', params: { gold: 5 } },
        { handler: 'h2', params: { aoe: 80 } },
      ]);

      const world = createTowerWorld();
      engine.dispatch('onDeath', 7, world);

      expect(log).toEqual(['h1(7,{"gold":5})', 'h2(7,{"aoe":80})']);
    });

    it('is silent when the entity has no rules for the given event', () => {
      const engine = new RuleEngine();
      const world = createTowerWorld();
      expect(() => engine.dispatch('onHit', 999, world)).not.toThrow();
    });

    it('is silent when no rules are attached to any entity for the event', () => {
      const engine = new RuleEngine();
      engine.registerHandler('h1', vi.fn());
      const world = createTowerWorld();
      expect(() => engine.dispatch('onKill', 1, world)).not.toThrow();
    });

    it('passes the world reference unchanged to every handler invocation', () => {
      const engine = new RuleEngine();
      const seen: Array<unknown> = [];
      engine.registerHandler('observer', (_eid, _params, world) => {
        seen.push(world);
      });
      engine.attachRules(1, 'onAttack', [{ handler: 'observer', params: {} }]);
      const world = createTowerWorld();
      engine.dispatch('onAttack', 1, world);
      expect(seen).toEqual([world]);
    });

    it('does not crash if a handler throws; the error propagates to the caller', () => {
      const engine = new RuleEngine();
      engine.registerHandler('boom', () => {
        throw new Error('handler failed');
      });
      engine.attachRules(1, 'onDeath', [{ handler: 'boom', params: {} }]);
      const world = createTowerWorld();
      expect(() => engine.dispatch('onDeath', 1, world)).toThrow(/handler failed/);
    });
  });

  describe('entity cleanup', () => {
    it('removes all rules for an entity when clearRules(eid) is called', () => {
      const engine = new RuleEngine();
      engine.registerHandler('h1', () => {});
      engine.attachRules(1, 'onDeath', [{ handler: 'h1', params: {} }]);
      engine.attachRules(1, 'onHit', [{ handler: 'h1', params: {} }]);
      engine.clearRules(1);
      expect(engine.getRules(1, 'onDeath')).toEqual([]);
      expect(engine.getRules(1, 'onHit')).toEqual([]);
    });
  });
});
