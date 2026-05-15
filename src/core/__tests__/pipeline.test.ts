import { describe, expect, it } from 'vitest';

import { Pipeline, PHASE_ORDER, type System, type SystemPhase } from '../pipeline.js';
import { createTowerWorld } from '../World.js';

function makeRecordingSystem(
  name: string,
  phase: SystemPhase,
  log: string[],
  effect?: (world: ReturnType<typeof createTowerWorld>, dt: number) => void,
): System {
  return {
    name,
    phase,
    update(world, dt) {
      log.push(name);
      effect?.(world, dt);
    },
  };
}

describe('Pipeline', () => {
  describe('phase ordering', () => {
    it('exposes the 8 canonical phase names in the documented order', () => {
      expect(PHASE_ORDER).toEqual([
        'managers',
        'vfx',
        'modifiers',
        'gameplay',
        'lifecycle',
        'creation',
        'ai',
        'render',
      ]);
    });

    it('runs systems strictly in phase order regardless of registration order', () => {
      const log: string[] = [];
      const pipeline = new Pipeline();

      pipeline.register(makeRecordingSystem('R', 'render', log));
      pipeline.register(makeRecordingSystem('M', 'managers', log));
      pipeline.register(makeRecordingSystem('A', 'ai', log));
      pipeline.register(makeRecordingSystem('G', 'gameplay', log));
      pipeline.register(makeRecordingSystem('L', 'lifecycle', log));
      pipeline.register(makeRecordingSystem('V', 'vfx', log));
      pipeline.register(makeRecordingSystem('Mo', 'modifiers', log));
      pipeline.register(makeRecordingSystem('C', 'creation', log));

      pipeline.execute(createTowerWorld(), 1 / 60);

      expect(log).toEqual(['M', 'V', 'Mo', 'G', 'L', 'C', 'A', 'R']);
    });

    it('within a phase, preserves registration order (deterministic intra-phase)', () => {
      const log: string[] = [];
      const pipeline = new Pipeline();

      pipeline.register(makeRecordingSystem('G1', 'gameplay', log));
      pipeline.register(makeRecordingSystem('G2', 'gameplay', log));
      pipeline.register(makeRecordingSystem('G3', 'gameplay', log));

      pipeline.execute(createTowerWorld(), 1 / 60);

      expect(log).toEqual(['G1', 'G2', 'G3']);
    });

    it('skips phases that have no registered systems without error', () => {
      const log: string[] = [];
      const pipeline = new Pipeline();
      pipeline.register(makeRecordingSystem('only-render', 'render', log));

      expect(() => pipeline.execute(createTowerWorld(), 1 / 60)).not.toThrow();
      expect(log).toEqual(['only-render']);
    });
  });

  describe('world & dt propagation', () => {
    it('passes the same world and dt to every system in the tick', () => {
      const world = createTowerWorld();
      const dt = 1 / 30;
      const seen: Array<{ world: unknown; dt: number }> = [];

      const pipeline = new Pipeline();
      pipeline.register({
        name: 'A',
        phase: 'gameplay',
        update(w, d) {
          seen.push({ world: w, dt: d });
        },
      });
      pipeline.register({
        name: 'B',
        phase: 'render',
        update(w, d) {
          seen.push({ world: w, dt: d });
        },
      });

      pipeline.execute(world, dt);

      expect(seen).toHaveLength(2);
      expect(seen[0]?.world).toBe(world);
      expect(seen[0]?.dt).toBe(dt);
      expect(seen[1]?.world).toBe(world);
      expect(seen[1]?.dt).toBe(dt);
    });
  });

  describe('deferred cleanup', () => {
    it('flushes destroyed entities exactly once at the end of execute (after render)', () => {
      const world = createTowerWorld();
      const a = world.addEntity();
      const b = world.addEntity();

      const log: string[] = [];
      const pipeline = new Pipeline();

      pipeline.register({
        name: 'killer',
        phase: 'lifecycle',
        update(w) {
          w.destroyEntity(a);
          w.destroyEntity(b);
          log.push(`lifecycle:alive=${w.isDestroyed(a) ? 'flagged' : 'no'}`);
        },
      });

      pipeline.register({
        name: 'render-observer',
        phase: 'render',
        update(w) {
          log.push(`render:destroyed-flag=${w.isDestroyed(a)}`);
        },
      });

      pipeline.execute(world, 0);

      expect(log).toEqual(['lifecycle:alive=flagged', 'render:destroyed-flag=true']);
      expect(world.isDestroyed(a)).toBe(false);
      expect(world.isDestroyed(b)).toBe(false);
    });
  });

  describe('register validation', () => {
    it('rejects systems with an unknown phase', () => {
      const pipeline = new Pipeline();
      expect(() =>
        pipeline.register({
          name: 'bad',
          phase: 'physics' as SystemPhase,
          update() {},
        }),
      ).toThrow(/unknown phase/i);
    });

    it('rejects duplicate system names', () => {
      const pipeline = new Pipeline();
      pipeline.register({ name: 'dup', phase: 'gameplay', update() {} });
      expect(() =>
        pipeline.register({ name: 'dup', phase: 'render', update() {} }),
      ).toThrow(/duplicate/i);
    });
  });
});
