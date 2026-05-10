// ============================================================
// Tower Defender — bitecs World Wrapper with Pipeline Support
//
// Wraps bitecs ECS primitives:
//   - createWorld / addEntity / addComponent / removeEntity / hasComponent
//   - defineQuery for system-defined queries
//   - World type alias (BitecsWorld) for the raw bitecs world object
//
// Systems now use bitecs defineQuery() directly and iterate over
// query results themselves, rather than receiving pre-filtered
// entity arrays from the World.
// ============================================================

import {
  createWorld,
  addEntity,
  addComponent,
  removeComponent,
  removeEntity,
  hasComponent,
  defineQuery,
  type World as BitecsWorld,
  type IWorld,
} from 'bitecs';

// Import component definitions — these are needed by systems that
// reference the component stores when calling addComponent / query.
import * as components from '../core/components.js';

// ============================================================
// System Interface
// ============================================================

/**
 * A system that processes entities each frame.
 *
 * Systems define their own bitecs queries (via defineQuery) and
 * iterate over matched entities themselves. The TowerWorld is passed
 * in to allow query execution and entity mutation.
 */
export interface System {
  /** Human-readable name for debugging */
  name: string;
  /** Called once per frame with the full TowerWorld for querying */
  update(world: TowerWorld, dt: number): void;
}

// ============================================================
// TowerWorld
// ============================================================

/** ECS World wrapper — manages entities, components, and the system pipeline */
export class TowerWorld {
  /** Underlying bitecs world (used by systems to run queries) */
  world: BitecsWorld = createWorld();

  /** Registered systems, executed in registration order */
  systems: System[] = [];

  /** Entity IDs marked for deferred cleanup (removed at end of update) */
  private deadEntities = new Set<number>();

  // ---- Entity Lifecycle ----

  /** Create a new entity and return its ID */
  createEntity(): number {
    return addEntity(this.world);
  }

  /** Mark an entity for deferred removal (cleaned up at end of update) */
  destroyEntity(eid: number): void {
    this.deadEntities.add(eid);
  }

  // ---- Components ----

  /**
   * Add a component to an entity.
   *
   * @param eid       Entity ID
   * @param component The component store (e.g. Position from components.ts)
   * @param store     Optional initial data to assign to the component's fields
   */
  addComponent(eid: number, component: object, store: object = {}): void {
    addComponent(this.world, eid, component);

    const keys = Object.keys(store);
    if (keys.length > 0) {
      for (const key of keys) {
        const c = component as Record<string, ArrayLike<unknown>>;
        const d = store as Record<string, unknown>;
        if (c[key] !== undefined) {
          (c[key] as Record<number, unknown>)[eid] = d[key];
        }
      }
    }
  }

  /** Remove a component from an entity */
  removeComponent(eid: number, component: object): void {
    removeComponent(this.world, eid, component);
  }

  // ---- Systems ----

  /** Register a system. Systems are executed in registration order. */
  registerSystem(system: System): void {
    this.systems.push(system);
  }

  /** Run all registered systems, then clean up dead entities */
  update(dt: number): void {
    for (let i = 0; i < this.systems.length; i++) {
      this.systems[i]!.update(this, dt);
    }

    // Deferred cleanup — remove dead entities after all systems run
    if (this.deadEntities.size > 0) {
      for (const eid of this.deadEntities) {
        removeEntity(this.world, eid);
      }
      this.deadEntities.clear();
    }
  }

  /** Reset the world to a clean state (clears entities, systems, etc.) */
  reset(): void {
    this.deadEntities.clear();
    this.systems.length = 0;
    this.world = createWorld();
  }
}

// ============================================================
// Re-exports
// ============================================================

export {
  createWorld,
  addEntity,
  addComponent,
  removeComponent,
  hasComponent,
  defineQuery,
};

export type { BitecsWorld };
