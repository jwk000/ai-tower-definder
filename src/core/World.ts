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
  entityExists,
  defineQuery,
  getAllEntities,
  type World as BitecsWorld,
  type IWorld,
} from 'bitecs';

// Import component definitions — these are needed by systems that
// reference the component stores when calling addComponent / query.
import * as components from '../core/components.js';
import type { UnitVisualParts } from '../types/index.js';

// Debug logging
import { entityCreated, entityDestroyed, componentAdded, componentRemoved } from '../utils/debugLog.js';

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

  /** Entity display names (eid → name string) — used by RenderSystem for overhead HUD */
  private displayNames = new Map<number, string>();

  private unitVisualPartsTable: UnitVisualParts[] = [];

  registerUnitVisualParts(parts: UnitVisualParts): number {
    this.unitVisualPartsTable.push(parts);
    return this.unitVisualPartsTable.length;
  }

  getUnitVisualParts(id: number): UnitVisualParts | undefined {
    if (id <= 0) return undefined;
    return this.unitVisualPartsTable[id - 1];
  }

  // ---- Entity Lifecycle ----

  /** Create a new entity and return its ID */
  createEntity(): number {
    const eid = addEntity(this.world);
    entityCreated(eid, 'World.createEntity');
    return eid;
  }

  /** Mark an entity for deferred removal (cleaned up at end of update) */
  destroyEntity(eid: number): void {
    this.deadEntities.add(eid);
    entityDestroyed(eid, 'deferred (marked for cleanup)');
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
    addComponent(this.world, component, eid);

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

    componentAdded(eid, getComponentLabel(component));
  }

  /** Remove a component from an entity */
  removeComponent(eid: number, component: object): void {
    removeComponent(this.world, component, eid);
    componentRemoved(eid, getComponentLabel(component));
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
    this.cleanupDeadEntities();
  }

  /** Set the display name for an entity (used by overhead HUD rendering) */
  setDisplayName(eid: number, name: string): void {
    this.displayNames.set(eid, name);
  }

  /** Get the display name for an entity, or undefined if not set */
  getDisplayName(eid: number): string | undefined {
    return this.displayNames.get(eid);
  }

  /** Clean up entities marked for deferred removal */
  cleanupDeadEntities(): void {
    if (this.deadEntities.size > 0) {
      for (const eid of this.deadEntities) {
        removeEntity(this.world, eid);
        this.displayNames.delete(eid);
        entityDestroyed(eid, 'cleanupDeadEntities (bitecs removed)');
      }
      this.deadEntities.clear();
    }
  }

  /** Reset the world to a clean state (clears entities, systems, etc.) */
  reset(): void {
    this.deadEntities.clear();
    this.displayNames.clear();
    this.unitVisualPartsTable.length = 0;
    this.systems.length = 0;
    // Remove all existing entities from current world before creating a new one
    const allEntities = getAllEntities(this.world);
    for (const eid of allEntities) {
      removeEntity(this.world, eid);
    }
    this.world = createWorld();
  }

  /** Alias for reset — compatibility with old World API */
  clear(): void {
    this.reset();
  }

  // ---- Compatibility bridge (old World API → bitecs) ----

  /** Compatibility: check if entity has a component */
  hasComponent(eid: number, component: object | string): boolean {
    if (typeof component === 'string') return false; // no string-based components
    return hasComponent(this.world, component, eid);
  }

  /** Compatibility: get component value */
  getComponent<T>(eid: number, _component: object | string): T | undefined {
    return undefined; // bridge only — actual access via bitecs stores
  }

  /** Compatibility: query entities with given component strings/objects */
  query(...components: (object | string)[]): number[] {
    const result: number[] = [];
    if (components.length === 0) return result;
    const stores = components.filter(c => typeof c !== 'string') as object[];
    if (stores.length === 0) return result;
    const first = stores[0]!;
    const store = first as Record<string, ArrayLike<unknown>>;
    const _size = store._size as Uint32Array | undefined;
    const len = _size ? _size.length : 1000;
    for (let eid = 0; eid < len; eid++) {
      let match = true;
      for (const comp of stores) {
        if (!hasComponent(this.world, comp, eid)) {
          match = false;
          break;
        }
      }
      if (match) result.push(eid);
    }
    return result;
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
  entityExists,
  defineQuery,
};

export type { BitecsWorld };

// ============================================================
// Helpers
// ============================================================

/** 获取组件的可读名称（用于调试日志） */
function getComponentLabel(component: object): string {
  // 遍历 components 模块查找匹配的组件
  for (const [name, comp] of Object.entries(components)) {
    if (comp === component) {
      return name;
    }
  }
  // 回退：尝试从构造函数名推断
  const ctor = (component as Record<string, unknown>).constructor as
    | { name?: string }
    | undefined;
  return ctor?.name ?? 'UnknownComponent';
}
