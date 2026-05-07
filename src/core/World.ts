import type { Component, ComponentType, EntityId, System } from '../types/index.js';

/** ECS World — manages all entities, components, and systems */
export class World {
  private nextId: EntityId = 0;
  private entities: Set<EntityId> = new Set();
  private components: Map<string, Map<EntityId, Component>> = new Map();
  private systems: System[] = [];
  private deadEntities: Set<EntityId> = new Set();

  // ---- Entity Lifecycle ----

  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  clear(): void {
    this.entities.clear();
    this.components.clear();
    this.deadEntities.clear();
    this.systems = [];
    this.nextId = 0;
  }

  destroyEntity(id: EntityId): void {
    this.deadEntities.add(id);
  }

  isAlive(id: EntityId): boolean {
    return this.entities.has(id) && !this.deadEntities.has(id);
  }

  // ---- Components ----

  addComponent(id: EntityId, component: Component): void {
    let typeMap = this.components.get(component.type);
    if (!typeMap) {
      typeMap = new Map();
      this.components.set(component.type, typeMap);
    }
    typeMap.set(id, component);
  }

  getComponent<T extends Component>(id: EntityId, type: string): T | undefined {
    return this.components.get(type)?.get(id) as T | undefined;
  }

  hasComponent(id: EntityId, type: string): boolean {
    return this.components.get(type)?.has(id) ?? false;
  }

  removeComponent(id: EntityId, type: string): void {
    this.components.get(type)?.delete(id);
  }

  /** Get all entity IDs that have ALL the specified component types */
  query(...types: string[]): EntityId[] {
    if (types.length === 0) return [];

    const result: EntityId[] = [];
    const firstType = types[0]!;
    const firstMap = this.components.get(firstType);
    if (!firstMap) return [];

    for (const id of firstMap.keys()) {
      if (!this.isAlive(id)) continue;
      let match = true;
      for (let i = 1; i < types.length; i++) {
        if (!this.components.get(types[i]!)?.has(id)) {
          match = false;
          break;
        }
      }
      if (match) result.push(id);
    }
    return result;
  }

  // ---- Systems ----

  registerSystem(system: System): void {
    this.systems.push(system);
  }

  update(deltaTime: number): void {
    // Run all systems
    for (const system of this.systems) {
      const entities = this.query(...system.requiredComponents);
      system.update(entities, deltaTime);
    }

    // Cleanup dead entities
    if (this.deadEntities.size > 0) {
      for (const id of this.deadEntities) {
        this.entities.delete(id);
        for (const typeMap of this.components.values()) {
          typeMap.delete(id);
        }
      }
      this.deadEntities.clear();
    }
  }

  // ---- Debug ----

  get entityCount(): number {
    return this.entities.size - this.deadEntities.size;
  }
}
