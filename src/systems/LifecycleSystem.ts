import { defineQuery } from 'bitecs';

import { DeadTag } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

export function createLifecycleSystem(): System {
  const corpseQuery = defineQuery([DeadTag]);
  const processed = new Set<number>();

  return {
    name: 'LifecycleSystem',
    phase: 'lifecycle',
    update(world: TowerWorld): void {
      const entities = corpseQuery(world);
      for (let i = 0; i < entities.length; i += 1) {
        const eid = entities[i]!;
        if (processed.has(eid)) continue;
        processed.add(eid);
        world.ruleEngine.dispatch('onDeath', eid, world);
        world.ruleEngine.clearRules(eid);
        world.destroyEntity(eid);
      }
    },
  };
}
