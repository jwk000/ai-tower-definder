import { System, CType } from '../types/index.js';
import { World } from '../core/World.js';
import { DeathEffect } from '../components/DeathEffect.js';

export class DeathEffectSystem implements System {
  readonly name = 'DeathEffectSystem';
  readonly requiredComponents = [CType.DeathEffect] as const;

  constructor(private world: World) {}

  update(entities: number[], dt: number): void {
    for (const id of entities) {
      const effect = this.world.getComponent<DeathEffect>(id, CType.DeathEffect);
      if (!effect) continue;
      effect.timer -= dt;
      if (effect.timer <= 0) {
        this.world.destroyEntity(id);
      }
    }
  }
}
