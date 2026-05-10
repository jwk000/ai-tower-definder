// ============================================================
// Tower Defender — FadingMarkSystem
//
// Manages persistent ground marks (scorch marks, explosion
// traces, etc.) that fade from maxAlpha to zero over their
// duration and are then destroyed.
// ============================================================

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Position, Visual, FadingMark } from '../core/components.js';

const markQuery = defineQuery([Position, Visual, FadingMark]);

export class FadingMarkSystem implements System {
  readonly name = 'FadingMarkSystem';

  update(world: TowerWorld, dt: number): void {
    const entities = markQuery(world.world);

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i]!;

      let elapsed = FadingMark.elapsed[eid]!;
      const duration = FadingMark.duration[eid]!;
      const maxAlpha = FadingMark.maxAlpha[eid]!;

      elapsed += dt;
      FadingMark.elapsed[eid] = elapsed;

      if (elapsed >= duration) {
        world.destroyEntity(eid);
        continue;
      }

      // Linear fade from maxAlpha → 0
      Visual.alpha[eid] = maxAlpha * (1 - elapsed / duration);
    }
  }
}
