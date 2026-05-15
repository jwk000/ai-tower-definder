import { addComponent, defineQuery, hasComponent } from 'bitecs';

import { DeadTag, Health } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

export function createHealthSystem(): System {
  const mortalQuery = defineQuery([Health]);

  return {
    name: 'HealthSystem',
    phase: 'lifecycle',
    update(world: TowerWorld): void {
      const entities = mortalQuery(world);
      for (let i = 0; i < entities.length; i += 1) {
        const eid = entities[i]!;
        if (Health.current[eid]! > 0) continue;
        if (hasComponent(world, DeadTag, eid)) continue;
        addComponent(world, DeadTag, eid);
      }
    },
  };
}
