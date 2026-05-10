// ============================================================
// Tower Defender — BloodParticleSystem
//
// Manages blood splash particles spawned when arrows hit enemies.
// Each particle flies outward from the hit point, slows via drag,
// fades out, and is destroyed when its lifetime expires.
// ============================================================

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Position, Visual, BloodParticle } from '../core/components.js';

const particleQuery = defineQuery([Position, Visual, BloodParticle]);

const GRAVITY = 120;  // px/s² downward pull
const DRAG = 0.92;    // per-second velocity retention

export class BloodParticleSystem implements System {
  readonly name = 'BloodParticleSystem';

  update(world: TowerWorld, dt: number): void {
    const entities = particleQuery(world.world);

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i]!;

      let elapsed = BloodParticle.elapsed[eid]!;
      const lifetime = BloodParticle.lifetime[eid]!;

      elapsed += dt;
      BloodParticle.elapsed[eid] = elapsed;

      if (elapsed >= lifetime) {
        world.destroyEntity(eid);
        continue;
      }

      // Apply velocity with drag
      const dragFactor = Math.pow(DRAG, dt * 60); // frame-rate independent
      BloodParticle.velocityY[eid]! += GRAVITY * dt;

      Position.x[eid]! += BloodParticle.velocityX[eid]! * dt;
      Position.y[eid]! += BloodParticle.velocityY[eid]! * dt;
      BloodParticle.velocityX[eid]! *= dragFactor;
      BloodParticle.velocityY[eid]! *= dragFactor;

      // Fade out over lifetime
      const progress = elapsed / lifetime;
      Visual.alpha[eid] = Math.max(0, 0.9 * (1 - progress));
    }
  }
}
