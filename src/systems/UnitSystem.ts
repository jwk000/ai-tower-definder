import { System, TileType, CType } from '../types/index.js';
import { World } from '../core/World.js';
import { Position } from '../components/Position.js';
import { Attack } from '../components/Attack.js';
import { Health } from '../components/Health.js';
import { Unit } from '../components/Unit.js';
import { PlayerControllable } from '../components/PlayerControllable.js';
import { Render } from '../components/Render.js';
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig } from '../types/index.js';
import { checkTileCollision, checkEntityCollision, getEntityRadius, findAvoidanceTarget } from '../utils/collision.js';

export class UnitSystem implements System {
  readonly name = 'UnitSystem';
  readonly requiredComponents = [CType.Unit, CType.Position, CType.Health, CType.Attack] as const;

  constructor(
    private world: World,
    private map: MapConfig,
  ) {}

  update(entities: number[], dt: number): void {
    const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;
    const maxX = ox + RenderSystem.sceneW;
    const maxY = oy + RenderSystem.sceneH;
    const ts = this.map.tileSize;

    for (const unitId of entities) {
      const pos = this.world.getComponent<Position>(unitId, CType.Position)!;
      const atk = this.world.getComponent<Attack>(unitId, CType.Attack)!;
      const unit = this.world.getComponent<Unit>(unitId, CType.Unit)!;
      const ctrl = this.world.getComponent<PlayerControllable>(unitId, CType.PlayerControllable);

      const radius = getEntityRadius(this.world, unitId);

      atk.tickCooldown(dt);

      let nearestId: number | null = null;
      let nearestDist = Infinity;

      for (const enemyId of enemies) {
        const ePos = this.world.getComponent<Position>(enemyId, CType.Position);
        if (!ePos) continue;
        const dx = ePos.x - pos.x;
        const dy = ePos.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= atk.range && dist < nearestDist) {
          nearestDist = dist;
          nearestId = enemyId;
        }
      }

      if (nearestId !== null && atk.canAttack) {
        atk.resetCooldown();
        const health = this.world.getComponent<Health>(nearestId, CType.Health);
        if (health) {
          health.takeDamage(atk.atk);
        }
        const enemyRender = this.world.getComponent<Render>(nearestId, CType.Render);
        if (enemyRender) {
          enemyRender.hitFlashTimer = 0.12;
        }
      }

      let moveTargetX: number | null = null;
      let moveTargetY: number | null = null;

      if (ctrl && ctrl.targetX !== null && ctrl.targetY !== null) {
        moveTargetX = ctrl.targetX;
        moveTargetY = ctrl.targetY;
      } else {
        let closestDist = Infinity;
        for (const enemyId of enemies) {
          const ePos = this.world.getComponent<Position>(enemyId, CType.Position);
          if (!ePos) continue;
          const dx = ePos.x - pos.x;
          const dy = ePos.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            moveTargetX = ePos.x;
            moveTargetY = ePos.y;
          }
        }
      }

      if (moveTargetX !== null && moveTargetY !== null) {
        const dx = moveTargetX - pos.x;
        const dy = moveTargetY - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (ctrl && ctrl.targetX !== null && ctrl.targetY !== null && dist < 5) {
          ctrl.targetX = null;
          ctrl.targetY = null;
        } else if (dist > 0.1) {
          const moveDist = unit.baseSpeed * dt;
          const stepX = (dx / dist) * Math.min(moveDist, dist);
          const stepY = (dy / dist) * Math.min(moveDist, dist);

          let newX = pos.x + stepX;
          let newY = pos.y + stepY;

          const homeDx = newX - unit.homeX;
          const homeDy = newY - unit.homeY;
          const homeDist = Math.sqrt(homeDx * homeDx + homeDy * homeDy);

          if (homeDist > unit.moveRange) {
            const ratio = unit.moveRange / homeDist;
            newX = unit.homeX + homeDx * ratio;
            newY = unit.homeY + homeDy * ratio;
          }

          newX = Math.max(ox, Math.min(maxX, newX));
          newY = Math.max(oy, Math.min(maxY, newY));

          const tileCollision = checkTileCollision(newX, newY, radius, this.map);
          if (tileCollision) {
            newX = pos.x;
            newY = pos.y;
          }

          const entityCollision = checkEntityCollision(
            this.world,
            unitId,
            newX,
            newY,
            radius,
            [CType.Projectile, CType.DeathEffect]
          );

          if (entityCollision.blocked) {
            const avoidance = findAvoidanceTarget(
              this.world,
              unitId,
              pos.x,
              pos.y,
              radius,
              moveTargetX,
              moveTargetY,
              [CType.Projectile, CType.DeathEffect]
            );

            if (avoidance) {
              const avoidDx = avoidance.x - pos.x;
              const avoidDy = avoidance.y - pos.y;
              const avoidDist = Math.sqrt(avoidDx * avoidDx + avoidDy * avoidDy);

              if (avoidDist > 0.1) {
                const avoidStep = Math.min(moveDist, avoidDist);
                newX = pos.x + (avoidDx / avoidDist) * avoidStep;
                newY = pos.y + (avoidDy / avoidDist) * avoidStep;

                const homeDx2 = newX - unit.homeX;
                const homeDy2 = newY - unit.homeY;
                const homeDist2 = Math.sqrt(homeDx2 * homeDx2 + homeDy2 * homeDy2);
                if (homeDist2 > unit.moveRange) {
                  const ratio2 = unit.moveRange / homeDist2;
                  newX = unit.homeX + homeDx2 * ratio2;
                  newY = unit.homeY + homeDy2 * ratio2;
                }

                newX = Math.max(ox, Math.min(maxX, newX));
                newY = Math.max(oy, Math.min(maxY, newY));

                if (!checkTileCollision(newX, newY, radius, this.map)) {
                  const recheck = checkEntityCollision(
                    this.world,
                    unitId,
                    newX,
                    newY,
                    radius,
                    [CType.Projectile, CType.DeathEffect]
                  );
                  if (!recheck.blocked) {
                    pos.x = newX;
                    pos.y = newY;
                  }
                }
              }
            }
          } else {
            pos.x = newX;
            pos.y = newY;
          }
        }
      }
    }
  }
}
