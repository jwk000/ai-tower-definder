import { TowerWorld, type System } from '../core/World.js';
import { ExplosionEffect, Visual, defineQuery } from '../core/components.js';

const explosionVisualQuery = defineQuery([ExplosionEffect, Visual]);

/** Animates explosion effects — expanding fading circles */
export class ExplosionEffectSystem implements System {
  readonly name = 'ExplosionEffectSystem';

  update(world: TowerWorld, dt: number): void {
    const entities = explosionVisualQuery(world.world);
    for (const eid of entities) {
      ExplosionEffect.elapsed[eid]! += dt;

      const duration = ExplosionEffect.duration[eid]!;
      const elapsed = ExplosionEffect.elapsed[eid]!;
      const progress = Math.min(elapsed / duration, 1);
      const maxRadius = ExplosionEffect.maxRadius[eid]!;

      // diameter-style: Visual.size is the full circle diameter
      Visual.size[eid] = maxRadius * progress;
      Visual.alpha[eid] = 1 - progress;

      if (elapsed >= duration) {
        world.destroyEntity(eid);
      }
    }
  }
}
