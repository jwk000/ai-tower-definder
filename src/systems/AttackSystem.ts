import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Attack } from '../components/Attack.js';
import { Tower } from '../components/Tower.js';
import { Health } from '../components/Health.js';

/** Towers attack nearest enemy in range */
export class AttackSystem implements System {
  readonly name = 'AttackSystem';
  readonly requiredComponents = [CType.Position, CType.Attack, CType.Tower] as const;

  constructor(private world: World) {}

  update(entities: number[], dt: number): void {
    const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);

    for (const towerId of entities) {
      const pos = this.world.getComponent<Position>(towerId, CType.Position)!;
      const atk = this.world.getComponent<Attack>(towerId, CType.Attack)!;

      // Tick cooldown
      atk.tickCooldown(dt);

      if (!atk.canAttack) continue;

      // Find nearest enemy in range
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
        const health = this.world.getComponent<Health>(nearestId, CType.Health);
        if (health) {
          health.takeDamage(atk.atk);
          atk.resetCooldown();
        }
      }
    }
  }
}
