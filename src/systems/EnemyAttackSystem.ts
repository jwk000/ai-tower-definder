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
  Category,
  Tower,
  PlayerOwned,
  BatSwarmMember,
  CategoryVal,
  ShapeVal,
  MoveModeVal,
  DamageTypeVal,
} from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';

// ---- Constants ----

const ENEMY_PROJECTILE_SPEED = 200; // px/s

// ---- Module-level bitecs queries ----

/** Enemies capable of attacking: have position, movement, attack, and unit tag */
const attackerQuery = defineQuery([Position, Movement, Attack, UnitTag]);

/** Tower targets: must have Tower + Health + Position */
const towerTargetQuery = defineQuery([Tower, Health, Position]);

/** Bat swarm targets */
const batTargetQuery = defineQuery([BatSwarmMember, Position, Health]);

/** Player units (soldiers, etc.) */
const unitTargetQuery = defineQuery([PlayerOwned, Position, Health]);

/** Buildings and objectives (filtered by Category.value in loop) */
const categoryTargetQuery = defineQuery([Category, Position, Health]);

// ============================================================
// System
// ============================================================

/**
 * Handles enemy attack logic:
 *  - Ranged enemies (canAttackBuildings=true) target towers, bats, buildings, objectives
 *    and fire projectiles.
 *  - Melee enemies target player units and deal direct damage.
 *
 * Movement is paused (MoveModeVal.HoldPosition) while an enemy has a valid target,
 * and resumed (MoveModeVal.FollowPath) when the target is lost.
 */
export class EnemyAttackSystem implements System {
  readonly name = 'EnemyAttackSystem';

  update(world: TowerWorld, dt: number): void {
    const attackers = attackerQuery(world.world);

    for (let i = 0; i < attackers.length; i++) {
      const eid = attackers[i]!;

      // Only process actual enemies (defensive guard)
      if (UnitTag.isEnemy[eid] !== 1) continue;

      // Determine attack capability — prefer UnitTag flag, fall back to range heuristic
      const canAttackBuildings =
        UnitTag.canAttackBuildings[eid] === 1 || Attack.range[eid] > 0;

      // Tick cooldown
      if (Attack.cooldownTimer[eid] > 0) {
        Attack.cooldownTimer[eid] -= dt;
      }

      const posX = Position.x[eid];
      const posY = Position.y[eid];

      // ====================================================
      // Check if current target is still valid
      // ====================================================
      const currentTarget = Attack.targetId[eid];
      if (currentTarget !== 0) {
        const targetValid = this.isTargetValid(currentTarget);

        if (!targetValid) {
          // Dead or invalid — clear target and resume movement
          Attack.targetId[eid] = 0;
          Movement.moveMode[eid] = MoveModeVal.FollowPath;
        } else {
          const tX = Position.x[currentTarget];
          const tY = Position.y[currentTarget];
          const dx = tX - posX;
          const dy = tY - posY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > Attack.range[eid]) {
            // Out of range — abandon
            Attack.targetId[eid] = 0;
            Movement.moveMode[eid] = MoveModeVal.FollowPath;
          } else if (Attack.cooldownTimer[eid] <= 0) {
            // Ready to attack!
            this.doAttack(world, eid, currentTarget, posX, posY, canAttackBuildings);
            Attack.cooldownTimer[eid] = 1 / Attack.attackSpeed[eid];
          }
        }
      }

      // ====================================================
      // Search for a new target if none is set
      // ====================================================
      if (Attack.targetId[eid] === 0) {
        const newTarget = this.findTarget(world, eid, posX, posY, canAttackBuildings);

        if (newTarget !== 0) {
          Attack.targetId[eid] = newTarget;
          // Pause path-following while attacking
          Movement.moveMode[eid] = MoveModeVal.HoldPosition;

          if (Attack.cooldownTimer[eid] <= 0) {
            this.doAttack(world, eid, newTarget, posX, posY, canAttackBuildings);
            Attack.cooldownTimer[eid] = 1 / Attack.attackSpeed[eid];
          }
        }
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
   * Find the nearest valid target within attack range.
   *
   * - Ranged enemies (canAttackBuildings=true): search towers, bats, buildings, objectives.
   * - Melee enemies: search player-owned units.
   */
  private findTarget(
    world: TowerWorld,
    eid: number,
    fromX: number,
    fromY: number,
    canAttackBuildings: boolean,
  ): number {
    const range = Attack.range[eid];
    let bestId = 0;
    let bestDist = Infinity;

    if (canAttackBuildings) {
      // --- Ranged: towers ---
      const towers = towerTargetQuery(world.world);
      for (let i = 0; i < towers.length; i++) {
        const tid = towers[i]!;
        if (tid === eid) continue;
        if (Health.current[tid] <= 0) continue;
        const dx = Position.x[tid] - fromX;
        const dy = Position.y[tid] - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= range && dist < bestDist) {
          bestDist = dist;
          bestId = tid;
        }
      }

      // --- Ranged: bat swarm ---
      const bats = batTargetQuery(world.world);
      for (let i = 0; i < bats.length; i++) {
        const bid = bats[i]!;
        if (bid === eid) continue;
        if (Health.current[bid] <= 0) continue;
        const dx = Position.x[bid] - fromX;
        const dy = Position.y[bid] - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= range && dist < bestDist) {
          bestDist = dist;
          bestId = bid;
        }
      }

      // --- Ranged: buildings & objectives ---
      const categoryTargets = categoryTargetQuery(world.world);
      for (let i = 0; i < categoryTargets.length; i++) {
        const cid = categoryTargets[i]!;
        if (cid === eid) continue;
        if (Health.current[cid] <= 0) continue;
        const cat = Category.value[cid];
        if (cat !== CategoryVal.Building && cat !== CategoryVal.Objective) continue;
        const dx = Position.x[cid] - fromX;
        const dy = Position.y[cid] - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= range && dist < bestDist) {
          bestDist = dist;
          bestId = cid;
        }
      }
    } else {
      // --- Melee: player units ---
      const units = unitTargetQuery(world.world);
      for (let i = 0; i < units.length; i++) {
        const uid = units[i]!;
        if (uid === eid) continue;
        if (Health.current[uid] <= 0) continue;
        const dx = Position.x[uid] - fromX;
        const dy = Position.y[uid] - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= range && dist < bestDist) {
          bestDist = dist;
          bestId = uid;
        }
      }
    }

    return bestId;
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
    const damage = Attack.damage[sourceId];

    if (canAttackBuildings) {
      // Ranged — spawn projectile
      this.spawnProjectile(world, sourceId, targetId, damage, fromX, fromY);
    } else {
      // Melee — direct damage
      const hp = Health.current[targetId];
      if (hp !== undefined) {
        Health.current[targetId] = hp - damage;
      }
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
