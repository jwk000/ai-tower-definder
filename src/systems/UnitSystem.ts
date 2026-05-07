import { System, TileType } from '../types/index.js';
import { World } from '../core/World.js';
import { CType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Attack } from '../components/Attack.js';
import { Health } from '../components/Health.js';
import { Unit } from '../components/Unit.js';
import { PlayerControllable } from '../components/PlayerControllable.js';
import { Render } from '../components/Render.js';
import { RenderSystem } from './RenderSystem.js';
import type { MapConfig } from '../types/index.js';

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

          newX = Math.max(ox, Math.min(maxX, newX));
          newY = Math.max(oy, Math.min(maxY, newY));

          const col = Math.floor((newX - ox) / ts);
          const row = Math.floor((newY - oy) / ts);
          let blocked = false;
          if (row >= 0 && row < this.map.rows && col >= 0 && col < this.map.cols) {
            const tile = this.map.tiles[row]![col]!;
            if (tile === TileType.Path) {
              blocked = true;
            }
          }

          if (!blocked) {
            pos.x = newX;
            pos.y = newY;
          }
        }
      }
    }
  }
}
