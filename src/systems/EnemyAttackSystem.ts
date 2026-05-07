import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Movement } from '../components/Movement.js';
import { Enemy } from '../components/Enemy.js';
import { EnemyAttacker } from '../components/EnemyAttacker.js';
import { Health } from '../components/Health.js';

export class EnemyAttackSystem implements System {
  readonly name = 'EnemyAttackSystem';
  readonly requiredComponents = [CType.EnemyAttacker, CType.Enemy, CType.Position, CType.Movement] as const;

  constructor(private world: World) {}

  update(entities: number[], dt: number): void {
    for (const id of entities) {
      const pos = this.world.getComponent<Position>(id, CType.Position)!;
      const mov = this.world.getComponent<Movement>(id, CType.Movement)!;
      const attacker = this.world.getComponent<EnemyAttacker>(id, CType.EnemyAttacker)!;
      const enemy = this.world.getComponent<Enemy>(id, CType.Enemy)!;

      if (attacker.cooldown > 0) {
        attacker.cooldown -= dt;
      }

      // Check if current target is still valid
      if (attacker.targetId !== null) {
        const targetHealth = this.world.getComponent<Health>(attacker.targetId, CType.Health);
        const targetPos = this.world.getComponent<Position>(attacker.targetId, CType.Position);

        if (!targetHealth?.alive || !targetPos) {
          attacker.targetId = null;
          enemy.movementPaused = false;
          mov.speed = enemy.originalSpeed;
        } else {
          const dx = targetPos.x - pos.x;
          const dy = targetPos.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > attacker.attackRange) {
            attacker.targetId = null;
            enemy.movementPaused = false;
            mov.speed = enemy.originalSpeed;
          } else if (attacker.cooldown <= 0) {
            targetHealth.takeDamage(attacker.attackDamage);
            attacker.cooldown = 1 / attacker.attackSpeed;
          }
        }
      }

      // Search for new target
      if (attacker.targetId === null) {
        const candidates = this.world.query(CType.Health, CType.Position);

        let closestId: number | null = null;
        let closestDist = Infinity;

        for (const cid of candidates) {
          if (cid === id) continue;
          if (!this.world.hasComponent(cid, CType.Tower)) continue;

          const cpos = this.world.getComponent<Position>(cid, CType.Position);
          const chealth = this.world.getComponent<Health>(cid, CType.Health);
          if (!cpos || !chealth?.alive) continue;

          const dx = cpos.x - pos.x;
          const dy = cpos.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= attacker.attackRange && dist < closestDist) {
            closestDist = dist;
            closestId = cid;
          }
        }

        if (closestId !== null) {
          attacker.targetId = closestId;
          enemy.movementPaused = true;
          enemy.originalSpeed = mov.speed;
          mov.speed = 0;

          if (attacker.cooldown <= 0) {
            const targetHealth = this.world.getComponent<Health>(closestId, CType.Health);
            if (targetHealth) {
              targetHealth.takeDamage(attacker.attackDamage);
              attacker.cooldown = 1 / attacker.attackSpeed;
            }
          }
        }
      }
    }
  }
}
