import { TowerWorld, type System } from '../core/World.js';
import { DeathEffect } from '../core/components.js';

export class DeathEffectSystem implements System {
  readonly name = 'DeathEffectSystem';

  update(world: TowerWorld, dt: number): void {
    for (let eid = 1; eid < DeathEffect.duration.length; eid++) {
      if (DeathEffect.duration[eid]! > 0) {
        DeathEffect.elapsed[eid] += dt;
        if (DeathEffect.elapsed[eid]! >= DeathEffect.duration[eid]!) {
          world.destroyEntity(eid);
        }
      }
    }
  }
}
