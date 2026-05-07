import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Attack } from '../components/Attack.js';
import { Health } from '../components/Health.js';
import { Unit } from '../components/Unit.js';
import { PlayerControllable } from '../components/PlayerControllable.js';

export class UnitSystem implements System {
  readonly name = 'UnitSystem';
  readonly requiredComponents = [CType.Unit, CType.Position, CType.Health, CType.Attack] as const;

  constructor(private world: World) {}

  update(entities: number[], dt: number): void {
    const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);

    for (const unitId of entities) {
      const pos = this.world.getComponent<Position>(unitId, CType.Position)!;
      const atk = this.world.getComponent<Attack>(unitId, CType.Attack)!;
      const unit = this.world.getComponent<Unit>(unitId, CType.Unit)!;
      const ctrl = this.world.getComponent<PlayerControllable>(unitId, CType.PlayerControllable);

      atk.tickCooldown(dt);

      if (ctrl && ctrl.targetX !== null && ctrl.targetY !== null) {
        const dx = ctrl.targetX - pos.x;
        const dy = ctrl.targetY - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
          ctrl.targetX = null;
          ctrl.targetY = null;
        } else {
          const moveDist = unit.baseSpeed * dt;
          if (moveDist >= dist) {
            pos.x = ctrl.targetX;
            pos.y = ctrl.targetY;
            ctrl.targetX = null;
            ctrl.targetY = null;
          } else {
            pos.x += (dx / dist) * moveDist;
            pos.y += (dy / dist) * moveDist;
          }
        }
      }

      if (!atk.canAttack) continue;

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

      if (nearestId !== null) {
        atk.resetCooldown();
        const health = this.world.getComponent<Health>(nearestId, CType.Health);
        if (health) {
          health.takeDamage(atk.atk);
        }
      }
    }
  }
}
