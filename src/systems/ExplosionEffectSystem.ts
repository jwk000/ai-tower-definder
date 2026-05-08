import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Render } from '../components/Render.js';
import { ExplosionEffect } from '../components/ExplosionEffect.js';

/** Animates explosion effects — expanding fading circles */
export class ExplosionEffectSystem implements System {
  readonly name = 'ExplosionEffectSystem';
  readonly requiredComponents = ['ExplosionEffect', CType.Position, CType.Render] as const;

  constructor(private world: World) {}

  update(entities: number[], dt: number): void {
    for (const id of entities) {
      const effect = this.world.getComponent<ExplosionEffect>(id, 'ExplosionEffect')!;
      const render = this.world.getComponent<Render>(id, CType.Render)!;

      effect.timer -= dt;
      if (effect.timer <= 0) {
        this.world.destroyEntity(id);
        continue;
      }

      // Update render to show expanding fading circle
      render.size = effect.currentRadius * 2; // diameter
      render.alpha = effect.currentAlpha;
      render.color = effect.color;
    }
  }
}
