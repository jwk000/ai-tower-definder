import { System, CType, type GridPos } from '../types/index.js';
import { World } from '../core/World.js';
import { Position } from '../components/Position.js';
import { Movement } from '../components/Movement.js';
import { Health } from '../components/Health.js';
import { Enemy } from '../components/Enemy.js';
import type { MapConfig } from '../types/index.js';
import { RenderSystem } from './RenderSystem.js';
import { getEntityRadius, checkEntityCollision, findAvoidanceTarget } from '../utils/collision.js';

export class MovementSystem implements System {
  readonly name = 'MovementSystem';
  readonly requiredComponents = [CType.Position, CType.Movement, CType.Enemy] as const;

  constructor(
    private world: World,
    private map: MapConfig,
  ) {}

  update(entities: number[], dt: number): void {
    for (const id of entities) {
      const enemy = this.world.getComponent<Enemy>(id, CType.Enemy);
      if (!enemy) continue;

      if (enemy.stunTimer > 0) {
        enemy.stunTimer -= dt;
        continue;
      }

      if (enemy.movementPaused) continue;

      const pos = this.world.getComponent<Position>(id, CType.Position)!;
      const mov = this.world.getComponent<Movement>(id, CType.Movement)!;

      const radius = getEntityRadius(this.world, id);

      const path = this.map.enemyPath;
      const currentIdx = mov.pathIndex;

      if (currentIdx >= path.length - 1) {
        this.onReachEnd(id);
        continue;
      }

      const current = path[currentIdx]!;
      const next = path[currentIdx + 1]!;

      const ts = this.map.tileSize;
      const ox = RenderSystem.sceneOffsetX;
      const oy = RenderSystem.sceneOffsetY;
      const cx = current.col * ts + ts / 2 + ox;
      const cy = current.row * ts + ts / 2 + oy;
      const nx = next.col * ts + ts / 2 + ox;
      const ny = next.row * ts + ts / 2 + oy;

      const dx = nx - cx;
      const dy = ny - cy;
      const segmentLen = Math.sqrt(dx * dx + dy * dy);

      if (segmentLen > 0) {
        const dist = mov.speed * dt;
        const reachedNext = mov.advance(dist, segmentLen);

        const t = mov.progressValue;
        let newX = cx + dx * t;
        let newY = cy + dy * t;

        if (reachedNext) {
          newX = nx;
          newY = ny;
        }

        const entityCollision = checkEntityCollision(
          this.world,
          id,
          newX,
          newY,
          radius,
          [CType.Projectile, CType.DeathEffect, CType.Trap]
        );

        if (entityCollision.blocked) {
          const avoidance = findAvoidanceTarget(
            this.world,
            id,
            pos.x,
            pos.y,
            radius,
            nx,
            ny,
            [CType.Projectile, CType.DeathEffect, CType.Trap]
          );

          if (avoidance) {
            const avoidDx = avoidance.x - pos.x;
            const avoidDy = avoidance.y - pos.y;
            const avoidDist = Math.sqrt(avoidDx * avoidDx + avoidDy * avoidDy);

            if (avoidDist > 0.1) {
              const avoidStep = Math.min(dist * 0.8, avoidDist);
              const avoidX = pos.x + (avoidDx / avoidDist) * avoidStep;
              const avoidY = pos.y + (avoidDy / avoidDist) * avoidStep;

              const recheck = checkEntityCollision(
                this.world,
                id,
                avoidX,
                avoidY,
                radius,
                [CType.Projectile, CType.DeathEffect, CType.Trap]
              );

              if (!recheck.blocked) {
                pos.x = avoidX;
                pos.y = avoidY;
              } else {
                pos.x = newX;
                pos.y = newY;
              }
            } else {
              pos.x = newX;
              pos.y = newY;
            }
          } else {
            pos.x = newX;
            pos.y = newY;
          }
        } else {
          pos.x = newX;
          pos.y = newY;
        }
      }
    }
  }

  private onReachEnd(enemyId: number): void {
    const enemy = this.world.getComponent<Enemy>(enemyId, CType.Enemy);
    const damage = enemy?.atk ?? 10;

    const bases = this.world.query(CType.Health, CType.Position);
    for (const baseId of bases) {
      if (!this.world.hasComponent(baseId, CType.Enemy)) {
        const health = this.world.getComponent<Health>(baseId, CType.Health);
        if (health) {
          health.takeDamage(damage);
        }
      }
    }

    this.world.destroyEntity(enemyId);
  }
}
