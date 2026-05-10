import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position, Movement, Health, UnitTag, Stunned, Frozen, Slowed, MoveModeVal,
  Visual, Attack, Projectile, DeathEffect, Trap,
} from '../core/components.js';
import type { MapConfig } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';

interface CollisionResult {
  blocked: boolean;
  pushX: number;
  pushY: number;
}

/** Components excluded from collision — projectiles, death effects, traps pass through */
const EXCLUDE_COLLISION = [Projectile, DeathEffect, Trap] as const;

export class MovementSystem implements System {
  readonly name = 'MovementSystem';

  /** Query: all moving units (enemies + player units with path-following capability) */
  private movingQuery = defineQuery([Position, Movement, UnitTag]);
  /** Query: all entities with physical presence (for collision detection) */
  private collisionQuery = defineQuery([Position, Visual]);
  /** Query: base / friendly health entities (for base damage on enemy reach-end) */
  private baseQuery = defineQuery([Position, Health]);

  constructor(private map: MapConfig) {}

  update(world: TowerWorld, dt: number): void {
    const entities = this.movingQuery(world.world);
    const path = this.map.enemyPath;
    const ts = this.map.tileSize;
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i]!;

      // Only process enemy units
      if (UnitTag.isEnemy[eid] !== 1) continue;

      // Skip stunned entities
      if (Stunned.timer[eid]! > 0) continue;

      // Skip frozen entities — completely immobilized
      if (hasComponent(world.world, eid, Frozen)) continue;

      // Skip if not in follow-path mode (e.g. hold-position)
      if (Movement.moveMode[eid] !== MoveModeVal.FollowPath) continue;

      const pathIndex = Movement.pathIndex[eid]!;

      // Reached end of path — damage base and destroy
      if (pathIndex >= path.length - 1) {
        this.onReachEnd(world, eid);
        continue;
      }

      const current = path[pathIndex]!;
      const next = path[pathIndex + 1]!;

      // World-space coordinates of current and next waypoint
      const cx = current.col * ts + ts / 2 + ox;
      const cy = current.row * ts + ts / 2 + oy;
      const nx = next.col * ts + ts / 2 + ox;
      const ny = next.row * ts + ts / 2 + oy;

      const dx = nx - cx;
      const dy = ny - cy;
      const segmentLen = Math.sqrt(dx * dx + dy * dy);

      if (segmentLen <= 0) continue;

      const baseSpeed = Movement.speed[eid]!;
      const slowFactor = hasComponent(world.world, eid, Slowed)
        ? Math.max(0.05, 1 - Slowed.percent[eid]! / 100)
        : 1;
      const speed = baseSpeed * slowFactor;
      const dist = speed * dt;

      let progress = Movement.progress[eid]!;
      progress += dist / segmentLen;

      let newX: number;
      let newY: number;

      if (progress >= 1.0) {
        // Reached waypoint — advance to next
        Movement.pathIndex[eid] = pathIndex + 1;
        Movement.progress[eid] = 0;
        newX = nx;
        newY = ny;
      } else {
        Movement.progress[eid] = progress;
        newX = cx + dx * progress;
        newY = cy + dy * progress;
      }

      const posX = Position.x[eid]!;
      const posY = Position.y[eid]!;
      const radius = this.getEntityRadius(eid);

      // Collision avoidance
      const collision = this.checkCollision(world, eid, newX, newY, radius);

      if (collision.blocked) {
        const avoidance = this.findAvoidance(world, eid, posX, posY, radius, nx, ny);

        if (avoidance) {
          const avoidDx = avoidance.x - posX;
          const avoidDy = avoidance.y - posY;
          const avoidDist = Math.sqrt(avoidDx * avoidDx + avoidDy * avoidDy);

          if (avoidDist > 0.1) {
            const avoidStep = Math.min(dist * 0.8, avoidDist);
            const avoidX = posX + (avoidDx / avoidDist) * avoidStep;
            const avoidY = posY + (avoidDy / avoidDist) * avoidStep;

            const recheck = this.checkCollision(world, eid, avoidX, avoidY, radius);
            Position.x[eid] = recheck.blocked ? newX : avoidX;
            Position.y[eid] = recheck.blocked ? newY : avoidY;
          } else {
            Position.x[eid] = newX;
            Position.y[eid] = newY;
          }
        } else {
          Position.x[eid] = newX;
          Position.y[eid] = newY;
        }
      } else {
        Position.x[eid] = newX;
        Position.y[eid] = newY;
      }
    }
  }

  /** Deal damage to base and destroy enemy that reached the end */
  private onReachEnd(world: TowerWorld, eid: number): void {
    const damage = Attack.damage[eid] ?? 10;

    const bases = this.baseQuery(world.world);
    for (let i = 0; i < bases.length; i++) {
      const baseId = bases[i]!;
      if (UnitTag.isEnemy[baseId] === 1) continue; // skip enemy health entities
      Health.current[baseId]! -= damage;
      if (Health.current[baseId]! < 0) Health.current[baseId]! = 0;
    }

    world.destroyEntity(eid);
  }

  // ---- Bitecs-compatible collision helpers ----

  private getEntityRadius(eid: number): number {
    return (Visual.size[eid] ?? 32) / 2;
  }

  /** Check if moving to (x, y) would collide with any non-excluded entity */
  private checkCollision(
    world: TowerWorld,
    selfId: number,
    x: number,
    y: number,
    radius: number,
  ): CollisionResult {
    const result: CollisionResult = { blocked: false, pushX: 0, pushY: 0 };
    const others = this.collisionQuery(world.world);

    for (let i = 0; i < others.length; i++) {
      const otherId = others[i]!;
      if (otherId === selfId) continue;

      if (this.isExcluded(world, otherId)) continue;

      const otherX = Position.x[otherId]!;
      const otherY = Position.y[otherId]!;
      const otherRadius = this.getEntityRadius(otherId);

      const dx = x - otherX;
      const dy = y - otherY;
      const distSq = dx * dx + dy * dy;
      const minDist = radius + otherRadius;

      if (distSq < minDist * minDist && distSq > 0.01) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        result.blocked = true;
        result.pushX += nx * overlap;
        result.pushY += ny * overlap;
      }
    }

    return result;
  }

  /** Find a perpendicular avoidance position near a blocking entity */
  private findAvoidance(
    world: TowerWorld,
    selfId: number,
    x: number,
    y: number,
    radius: number,
    targetX: number,
    targetY: number,
  ): { x: number; y: number } | null {
    const others = this.collisionQuery(world.world);

    for (let i = 0; i < others.length; i++) {
      const otherId = others[i]!;
      if (otherId === selfId) continue;

      if (this.isExcluded(world, otherId)) continue;

      const otherX = Position.x[otherId]!;
      const otherY = Position.y[otherId]!;
      const otherRadius = this.getEntityRadius(otherId);

      const dx = x - otherX;
      const dy = y - otherY;
      const distSq = dx * dx + dy * dy;
      const minDist = radius + otherRadius + 10;

      if (distSq < minDist * minDist && distSq > 0.01) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        const toTargetX = targetX - x;
        const toTargetY = targetY - y;
        const toTargetLen = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

        if (toTargetLen > 0.01) {
          const dirX = toTargetX / toTargetLen;
          const dirY = toTargetY / toTargetLen;
          const perpX = -dirY;
          const perpY = dirX;
          const dot = nx * perpX + ny * perpY;
          const sign = dot > 0 ? 1 : -1;
          return {
            x: otherX + (radius + otherRadius + 15) * perpX * sign,
            y: otherY + (radius + otherRadius + 15) * perpY * sign,
          };
        } else {
          return {
            x: otherX + nx * (radius + otherRadius + 15),
            y: otherY + ny * (radius + otherRadius + 15),
          };
        }
      }
    }

    return null;
  }

  /** Check if an entity should be excluded from collision (projectiles, effects, traps) */
  private isExcluded(world: TowerWorld, eid: number): boolean {
    for (const comp of EXCLUDE_COLLISION) {
      if (hasComponent(world.world, eid, comp)) return true;
    }
    return false;
  }
}
