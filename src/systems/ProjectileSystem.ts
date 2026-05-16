import { addComponent, defineQuery, hasComponent } from 'bitecs';

import { DeadTag, Health, Position, Projectile } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

export function createProjectileSystem(): System {
  const projectileQuery = defineQuery([Projectile, Position]);

  return {
    name: 'ProjectileSystem',
    phase: 'gameplay',
    update(world: TowerWorld, dt: number): void {
      const entities = projectileQuery(world);
      const dtMs = dt * 1000;

      for (let i = 0; i < entities.length; i += 1) {
        const eid = entities[i]!;
        if (hasComponent(world, DeadTag, eid)) continue;

        const target = Projectile.targetEid[eid]!;
        const speed = Projectile.speed[eid]!;
        const targetAlive =
          target > 0 &&
          hasComponent(world, Position, target) &&
          hasComponent(world, Health, target) &&
          Health.current[target]! > 0;

        if (targetAlive) {
          const dx = Position.x[target]! - Position.x[eid]!;
          const dy = Position.y[target]! - Position.y[eid]!;
          const dist = Math.hypot(dx, dy);
          if (dist > 0) {
            Projectile.vx[eid] = (dx / dist) * speed;
            Projectile.vy[eid] = (dy / dist) * speed;
          }
        }

        Position.x[eid] = Position.x[eid]! + Projectile.vx[eid]! * dt;
        Position.y[eid] = Position.y[eid]! + Projectile.vy[eid]! * dt;

        if (targetAlive) {
          const hitR = Projectile.hitRadius[eid]!;
          const ddx = Position.x[target]! - Position.x[eid]!;
          const ddy = Position.y[target]! - Position.y[eid]!;
          if (ddx * ddx + ddy * ddy <= hitR * hitR) {
            Health.current[target] = Health.current[target]! - Projectile.damage[eid]!;
            addComponent(world, DeadTag, eid);
            continue;
          }
        }

        Projectile.ttlMs[eid] = Projectile.ttlMs[eid]! - dtMs;
        if (Projectile.ttlMs[eid]! <= 0) {
          addComponent(world, DeadTag, eid);
        }
      }
    },
  };
}

export interface SpawnProjectileOpts {
  readonly sourceEid: number;
  readonly targetEid: number;
  readonly damage: number;
  readonly speed: number;
  readonly hitRadius?: number;
  readonly ttlMs?: number;
}

const DEFAULT_HIT_RADIUS = 12;
const DEFAULT_TTL_MS = 4000;

export function spawnProjectile(world: TowerWorld, opts: SpawnProjectileOpts): number {
  const eid = world.addEntity();
  addComponent(world, Position, eid);
  addComponent(world, Projectile, eid);
  Position.x[eid] = Position.x[opts.sourceEid] ?? 0;
  Position.y[eid] = Position.y[opts.sourceEid] ?? 0;
  Projectile.targetEid[eid] = opts.targetEid;
  Projectile.damage[eid] = opts.damage;
  Projectile.speed[eid] = opts.speed;
  Projectile.sourceEid[eid] = opts.sourceEid;
  Projectile.hitRadius[eid] = opts.hitRadius ?? DEFAULT_HIT_RADIUS;
  Projectile.ttlMs[eid] = opts.ttlMs ?? DEFAULT_TTL_MS;
  Projectile.vx[eid] = 0;
  Projectile.vy[eid] = 0;
  return eid;
}
