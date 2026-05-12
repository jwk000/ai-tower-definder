// EnemyAttackSystem — bitecs migration
// Enemy targeting and projectile spawning for enemies with Attack component.

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import {
  Position,
  Movement,
  Health,
  Attack,
  UnitTag,
  Projectile,
  Visual,
  ShapeVal,
  MoveModeVal,
  DamageTypeVal,
} from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { Sound } from '../utils/Sound.js';

// ---- Constants ----

const ENEMY_PROJECTILE_SPEED = 200; // px/s

// ---- Module-level bitecs queries ----

/** Enemies capable of attacking: have position, movement, attack, and unit tag */
const attackerQuery = defineQuery([Position, Movement, Attack, UnitTag]);

// ============================================================
// System
// ============================================================

/**
 * Handles enemy attack EXECUTION (not target selection).
 *
 * Target selection is delegated to AISystem's behavior tree (check_enemy_in_range +
 * attack nodes set Attack.targetId). This system reads Attack.targetId and executes
 * the attack (projectile for ranged, direct damage for melee).
 *
 * Movement is paused (MoveModeVal.HoldPosition) while an enemy has a valid target,
 * and resumed (MoveModeVal.FollowPath) when the target is lost.
 *
 * Attack cooldown ticking is handled by AISystem.
 */
export class EnemyAttackSystem implements System {
  readonly name = 'EnemyAttackSystem';

  update(world: TowerWorld, dt: number): void {
    const attackers = attackerQuery(world.world);

    for (let i = 0; i < attackers.length; i++) {
      const eid = attackers[i]!;

      // Only process actual enemies
      if (UnitTag.isEnemy[eid] !== 1) continue;

      const canAttackBuildings =
        UnitTag.canAttackBuildings[eid] === 1 || Attack.range[eid]! > 0;

      const posX = Position.x[eid]!;
      const posY = Position.y[eid]!;
      const targetId = Attack.targetId[eid]!;

      // No target set by BT → resume movement
      if (targetId === 0) {
        if (Movement.moveMode[eid] === MoveModeVal.HoldPosition) {
          Movement.moveMode[eid] = MoveModeVal.FollowPath;
        }
        continue;
      }

      // Validate target (alive + in range)
      if (!this.isTargetValid(targetId)) {
        Attack.targetId[eid] = 0;
        Movement.moveMode[eid] = MoveModeVal.FollowPath;
        continue;
      }

      const tX = Position.x[targetId]!;
      const tY = Position.y[targetId]!;
      const dx = tX - posX;
      const dy = tY - posY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > Attack.range[eid]!) {
        // Out of range — abandon
        Attack.targetId[eid] = 0;
        Movement.moveMode[eid] = MoveModeVal.FollowPath;
        continue;
      }

      // Pause movement while engaging
      Movement.moveMode[eid] = MoveModeVal.HoldPosition;

      // Execute attack (cooldown is managed by AISystem)
      if (Attack.cooldownTimer[eid]! <= 0) {
        this.doAttack(world, eid, targetId, posX, posY, canAttackBuildings);
        Attack.cooldownTimer[eid]! = 1 / Attack.attackSpeed[eid]!;
      }
    }
  }

  // ==========================================================
  // Private helpers
  // ==========================================================

  /** Return true if the target entity is alive and has health. */
  private isTargetValid(targetId: number): boolean {
    const hp = Health.current[targetId];
    return hp !== undefined && hp > 0;
  }

  /**
   * Perform the actual attack based on type:
   *  - Ranged enemies spawn a projectile toward the target.
   *  - Melee enemies deal direct damage.
   */
  private doAttack(
    world: TowerWorld,
    sourceId: number,
    targetId: number,
    fromX: number,
    fromY: number,
    canAttackBuildings: boolean,
  ): void {
    const damage = Attack.damage[sourceId]!;

    if (canAttackBuildings) {
      // Ranged — spawn projectile
      Sound.play('mage_attack');
      this.spawnProjectile(world, sourceId, targetId, damage, fromX, fromY);
    } else {
      // Melee — direct damage (enemies deal physical damage)
      Sound.play('enemy_attack');
      applyDamageToTarget(world, targetId, damage, DamageTypeVal.Physical, sourceId);
    }
  }

  /** Create an enemy projectile entity flying toward the target. */
  private spawnProjectile(
    world: TowerWorld,
    sourceId: number,
    targetId: number,
    damage: number,
    fromX: number,
    fromY: number,
  ): void {
    const pid = world.createEntity();

    world.addComponent(pid, Position, { x: fromX, y: fromY });

    world.addComponent(pid, Projectile, {
      speed: ENEMY_PROJECTILE_SPEED,
      damage,
      damageType: DamageTypeVal.Physical,
      targetId,
      sourceId,
      fromX,
      fromY,
      shape: ShapeVal.Circle,
      colorR: 0xff,
      colorG: 0x52,
      colorB: 0x52,
      size: 10,
      splashRadius: 0,
      stunDuration: 0,
      slowPercent: 0,
      slowMaxStacks: 0,
      freezeDuration: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      isChain: 0,
      chainIndex: 0,
      drainAmount: 0,
    });

    world.addComponent(pid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 0xff,
      colorG: 0x52,
      colorB: 0x52,
      size: 10,
      alpha: 1.0,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
  }
}
