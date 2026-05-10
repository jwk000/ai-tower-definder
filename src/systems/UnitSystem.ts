import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position,
  Health,
  Attack,
  PlayerControllable,
  PlayerOwned,
  Movement,
  UnitTag,
  Visual,
  Projectile,
  DeathEffect,
  Trap,
} from '../core/components.js';
import type { MapConfig } from '../types/index.js';
import { TileType } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';

// ============================================================
// Collision exclusion — projectiles, death effects, traps pass through
// ============================================================
const EXCLUDE_COLLISION = [Projectile, DeathEffect, Trap] as const;

// ============================================================
// UnitSystem — player-controlled soldier movement and combat
// ============================================================

export class UnitSystem implements System {
  readonly name = 'UnitSystem';

  /** Query: player-controllable combat units (soldiers) */
  private unitQuery = defineQuery([Position, Movement, PlayerControllable, PlayerOwned, Attack]);

  /** Query: enemies (for targeting and auto-chase) */
  private enemyQuery = defineQuery([Position, Health, UnitTag]);

  /** Query: all physical entities (for collision detection) */
  private collisionQuery = defineQuery([Position, Visual]);

  constructor(private map: MapConfig) {}

  // ============================================================
  // Frame Update
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    const units = this.unitQuery(world.world);
    if (units.length === 0) return;

    // Pre-filter live enemies for reuse across units
    const liveEnemies: number[] = [];
    {
      const allEnemies = this.enemyQuery(world.world);
      for (let i = 0; i < allEnemies.length; i++) {
        const eid = allEnemies[i]!;
        if (UnitTag.isEnemy[eid] === 1 && Health.current[eid] > 0) {
          liveEnemies.push(eid);
        }
      }
    }

    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const maxX = ox + RenderSystem.sceneW;
    const maxY = oy + RenderSystem.sceneH;

    for (let i = 0; i < units.length; i++) {
      const eid = units[i]!;
      const px = Position.x[eid];
      const py = Position.y[eid];
      const radius = this.getRadius(eid);

      // ---- Attack Phase ----
      this.attackPhase(eid, px, py, liveEnemies, dt);

      // ---- Movement Phase ----
      this.movementPhase(world, eid, px, py, radius, liveEnemies, ox, oy, maxX, maxY, dt);
    }
  }

  // ============================================================
  // Attack — find nearest enemy in range, apply damage
  // ============================================================

  private attackPhase(
    eid: number,
    px: number,
    py: number,
    enemies: number[],
    dt: number,
  ): void {
    // Tick cooldown
    Attack.cooldownTimer[eid] -= dt;
    if (Attack.cooldownTimer[eid] > 0) return;

    const range = Attack.range[eid];
    let nearestId = 0;
    let nearestDist = Infinity;

    for (let j = 0; j < enemies.length; j++) {
      const enemyId = enemies[j]!;
      const ex = Position.x[enemyId]!;
      const ey = Position.y[enemyId]!;
      const dx = ex - px;
      const dy = ey - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range && dist < nearestDist) {
        nearestDist = dist;
        nearestId = enemyId;
      }
    }

    if (nearestId === 0) return;

    // Execute attack
    Attack.cooldownTimer[eid] = 1 / Attack.attackSpeed[eid];
    Health.current[nearestId] -= Attack.damage[eid];
    Visual.hitFlashTimer[nearestId] = 0.12;
  }

  // ============================================================
  // Movement — steer toward target, clamp boundaries, avoid collisions
  // ============================================================

  private movementPhase(
    world: TowerWorld,
    eid: number,
    px: number,
    py: number,
    radius: number,
    enemies: number[],
    ox: number,
    oy: number,
    maxX: number,
    maxY: number,
    dt: number,
  ): void {
    // Determine move target: player-directed or auto-chase nearest enemy
    const pcTargetX = PlayerControllable.targetX[eid];
    const pcTargetY = PlayerControllable.targetY[eid];
    let moveTargetX: number;
    let moveTargetY: number;

    if (pcTargetX !== 0 || pcTargetY !== 0) {
      moveTargetX = pcTargetX;
      moveTargetY = pcTargetY;
    } else {
      // Auto-target nearest enemy
      let closestDist = Infinity;
      moveTargetX = px;
      moveTargetY = py;
      for (let j = 0; j < enemies.length; j++) {
        const enemyId = enemies[j]!;
        const ex = Position.x[enemyId]!;
        const ey = Position.y[enemyId]!;
        const dx = ex - px;
        const dy = ey - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          moveTargetX = ex;
          moveTargetY = ey;
        }
      }
    }

    const dx = moveTargetX - px;
    const dy = moveTargetY - py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If player-directed and arrived at target, clear and stop
    if ((pcTargetX !== 0 || pcTargetY !== 0) && dist < 5) {
      PlayerControllable.targetX[eid] = 0;
      PlayerControllable.targetY[eid] = 0;
      return;
    }

    if (dist <= 0.1) return;

    const speed = Movement.speed[eid];
    const moveDist = speed * dt;
    const stepX = (dx / dist) * Math.min(moveDist, dist);
    const stepY = (dy / dist) * Math.min(moveDist, dist);

    let newX = px + stepX;
    let newY = py + stepY;

    // Clamp to home-range boundary
    const homeX = Movement.homeX[eid];
    const homeY = Movement.homeY[eid];
    const moveRange = Movement.moveRange[eid];
    const homeDx = newX - homeX;
    const homeDy = newY - homeY;
    const homeDist = Math.sqrt(homeDx * homeDx + homeDy * homeDy);
    if (homeDist > moveRange && moveRange > 0) {
      const ratio = moveRange / homeDist;
      newX = homeX + homeDx * ratio;
      newY = homeY + homeDy * ratio;
    }

    // Clamp to scene bounds
    newX = Math.max(ox, Math.min(maxX, newX));
    newY = Math.max(oy, Math.min(maxY, newY));

    // Tile collision check
    if (this.checkTileCollision(newX, newY, radius)) {
      newX = px;
      newY = py;
    }

    // Entity collision + avoidance
    const collision = this.checkEntityCollision(world, eid, newX, newY, radius);

    if (collision.blocked) {
      const avoidance = this.findAvoidance(
        world, eid, px, py, radius, moveTargetX, moveTargetY,
      );

      if (avoidance) {
        const avoidDx = avoidance.x - px;
        const avoidDy = avoidance.y - py;
        const avoidDist = Math.sqrt(avoidDx * avoidDx + avoidDy * avoidDy);

        if (avoidDist > 0.1) {
          const avoidStep = Math.min(moveDist, avoidDist);
          let avoidX = px + (avoidDx / avoidDist) * avoidStep;
          let avoidY = py + (avoidDy / avoidDist) * avoidStep;

          // Re-clamp to home range on avoidance
          const hdx2 = avoidX - homeX;
          const hdy2 = avoidY - homeY;
          const hd2 = Math.sqrt(hdx2 * hdx2 + hdy2 * hdy2);
          if (hd2 > moveRange && moveRange > 0) {
            const r2 = moveRange / hd2;
            avoidX = homeX + hdx2 * r2;
            avoidY = homeY + hdy2 * r2;
          }
          avoidX = Math.max(ox, Math.min(maxX, avoidX));
          avoidY = Math.max(oy, Math.min(maxY, avoidY));

          // Validate avoidance position
          if (!this.checkTileCollision(avoidX, avoidY, radius)) {
            const recheck = this.checkEntityCollision(world, eid, avoidX, avoidY, radius);
            if (!recheck.blocked) {
              Position.x[eid] = avoidX;
              Position.y[eid] = avoidY;
            }
          }
        }
      }
    } else {
      Position.x[eid] = newX;
      Position.y[eid] = newY;
    }
  }

  // ============================================================
  // Collision Helpers
  // ============================================================

  private getRadius(eid: number): number {
    return (Visual.size[eid] ?? 32) / 2;
  }

  /** Tile collision — checks if (x, y) with given radius overlaps blocked/path tiles */
  private checkTileCollision(x: number, y: number, radius: number): boolean {
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const ts = this.map.tileSize;

    const minCol = Math.floor((x - radius - ox) / ts);
    const maxCol = Math.floor((x + radius - ox) / ts);
    const minRow = Math.floor((y - radius - oy) / ts);
    const maxRow = Math.floor((y + radius - oy) / ts);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (row < 0 || row >= this.map.rows || col < 0 || col >= this.map.cols) {
          return true; // out of bounds = blocked
        }
        const tile = this.map.tiles[row]![col]!;
        if (tile === TileType.Blocked || tile === TileType.Path) {
          const tileCenterX = col * ts + ts / 2 + ox;
          const tileCenterY = row * ts + ts / 2 + oy;
          const halfTs = ts / 2;

          const closestX = Math.max(tileCenterX - halfTs, Math.min(x, tileCenterX + halfTs));
          const closestY = Math.max(tileCenterY - halfTs, Math.min(y, tileCenterY + halfTs));

          const dx = x - closestX;
          const dy = y - closestY;
          if (dx * dx + dy * dy < radius * radius) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /** Entity collision — checks if moving to (x, y) overlaps other physical entities */
  private checkEntityCollision(
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

      const otherX = Position.x[otherId];
      const otherY = Position.y[otherId];
      const otherRadius = this.getRadius(otherId);

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

  /** Find a perpendicular avoidance position around blocking entities */
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

      const otherX = Position.x[otherId];
      const otherY = Position.y[otherId];
      const otherRadius = this.getRadius(otherId);

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

  /** Check if entity should be excluded from collision (projectiles, effects, traps) */
  private isExcluded(world: TowerWorld, eid: number): boolean {
    for (const comp of EXCLUDE_COLLISION) {
      if (hasComponent(world.world, eid, comp)) return true;
    }
    return false;
  }
}

// ============================================================
// Types
// ============================================================

interface CollisionResult {
  blocked: boolean;
  pushX: number;
  pushY: number;
}
