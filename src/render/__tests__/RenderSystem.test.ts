/**
 * EntityViewSink contract (verified by these tests, implemented by EntityRenderer in W5.4):
 *   - createView(eid, visual)   called once when ECS entity first observed
 *   - updateView(eid, x, y)     called every frame for every alive entity
 *   - destroyView(eid)          called once after entity is destroyed in world
 *   - sortByY()                 called once per frame, after all updates
 * Sink lets RenderSystem stay headless-testable; no Pixi Application needed in happy-dom.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { addComponent } from 'bitecs';

import { createTowerWorld, type TowerWorld } from '../../core/World.js';
import { Position, Visual, VisualShape } from '../../core/components.js';
import { RenderSystem, type EntityViewSink } from '../RenderSystem.js';

interface ViewRecord {
  eid: number;
  x: number;
  y: number;
  shape: number;
  color: number;
  size: number;
  destroyed: boolean;
}

function createStubSink(): EntityViewSink & { views: Map<number, ViewRecord>; sortCalls: number } {
  const views = new Map<number, ViewRecord>();
  let sortCalls = 0;
  return {
    views,
    get sortCalls() {
      return sortCalls;
    },
    createView(eid, visual) {
      views.set(eid, {
        eid,
        x: 0,
        y: 0,
        shape: visual.shape,
        color: visual.color,
        size: visual.size,
        destroyed: false,
      });
    },
    updateView(eid, x, y) {
      const v = views.get(eid);
      if (v) {
        v.x = x;
        v.y = y;
      }
    },
    destroyView(eid) {
      const v = views.get(eid);
      if (v) v.destroyed = true;
      views.delete(eid);
    },
    sortByY() {
      sortCalls++;
    },
    hasView(eid) {
      return views.has(eid);
    },
  };
}

function spawnEntity(world: TowerWorld, x: number, y: number, color = 0xff0000): number {
  const eid = world.addEntity();
  addComponent(world, Position, eid);
  addComponent(world, Visual, eid);
  Position.x[eid] = x;
  Position.y[eid] = y;
  Visual.shape[eid] = VisualShape.Circle;
  Visual.color[eid] = color;
  Visual.size[eid] = 16;
  return eid;
}

describe('RenderSystem — view lifecycle', () => {
  let world: TowerWorld;
  let sink: ReturnType<typeof createStubSink>;
  let system: RenderSystem;

  beforeEach(() => {
    world = createTowerWorld();
    sink = createStubSink();
    system = new RenderSystem(sink);
  });

  it('creates a view on first frame for a new entity with Position + Visual', () => {
    const eid = spawnEntity(world, 100, 200, 0xabcdef);

    system.update(world, 0.016);

    expect(sink.hasView(eid)).toBe(true);
    const v = sink.views.get(eid)!;
    expect(v.x).toBe(100);
    expect(v.y).toBe(200);
    expect(v.color).toBe(0xabcdef);
    expect(v.size).toBe(16);
  });

  it('syncs position to existing view on subsequent frames without recreating', () => {
    const eid = spawnEntity(world, 100, 200);
    system.update(world, 0.016);
    const viewRefBefore = sink.views.get(eid);

    Position.x[eid] = 300;
    Position.y[eid] = 400;
    system.update(world, 0.016);

    const viewRefAfter = sink.views.get(eid);
    expect(viewRefAfter).toBe(viewRefBefore); // same object — no recreate
    expect(viewRefAfter!.x).toBe(300);
    expect(viewRefAfter!.y).toBe(400);
  });

  it('destroys view when entity is destroyed in the world', () => {
    const eid = spawnEntity(world, 50, 60);
    system.update(world, 0.016);
    expect(sink.hasView(eid)).toBe(true);

    world.destroyEntity(eid);
    world.flushDeferred();
    system.update(world, 0.016);

    expect(sink.hasView(eid)).toBe(false);
  });

  it('calls sortByY exactly once per frame after view updates', () => {
    spawnEntity(world, 0, 100);
    spawnEntity(world, 0, 50);
    spawnEntity(world, 0, 200);

    const sortBefore = sink.sortCalls;
    system.update(world, 0.016);
    expect(sink.sortCalls).toBe(sortBefore + 1);

    system.update(world, 0.016);
    expect(sink.sortCalls).toBe(sortBefore + 2);
  });
});
