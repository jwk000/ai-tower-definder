import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position,
  Health,
  Movement,
  Attack,
  UnitTag,
  Tower,
  Production,
  Category,
  CategoryVal,
  Faction,
  FactionVal,
  Stunned,
  Frozen,
  MoveModeVal,
} from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import { EnemyType } from '../types/index.js';

// ---- Queries ----

/** Juggernaut candidates: enemies with Attack + canAttackBuildings */
const juggernautQuery = defineQuery([Position, Movement, Attack, UnitTag, Health]);

/** Buildings (Towers, Production buildings, and Building-category Player structures) */
const towerTargetQuery = defineQuery([Position, Health, Tower, Faction]);
const productionTargetQuery = defineQuery([Position, Health, Production, Faction]);
const buildingTargetQuery = defineQuery([Position, Health, Category, Faction]);

// ---- Constants ----

const JUGGERNAUT_CFG = ENEMY_CONFIGS[EnemyType.Juggernaut];

/**
 * JuggernautSystem — Iron Behemoth charge & CC resistance.
 *
 * Charge mechanic:
 *  - When a Player building is within attack range and charge cooldown is ready,
 *    the Juggernaut enters a charge state: speed boosted by chargeSpeedBonus%,
 *    moveMode set to FollowPath, for chargeDuration seconds.
 *  - After charge, speed resets and cooldown begins.
 *
 * CC resistance:
 *  - Stun and freeze timers decay faster (multiplied by 1/(1-resist)),
 *    so stunResist=0.5 means stun duration is halved.
 */
export class JuggernautSystem implements System {
  readonly name = 'JuggernautSystem';

  /** Per-Juggernaut charge ability cooldown remaining (eid → seconds) */
  private chargeCooldowns: Map<number, number> = new Map();

  /** Per-Juggernaut charge duration remaining (eid → seconds); only set while charging */
  private chargeTimers: Map<number, number> = new Map();

  /** Per-Juggernaut original speed saved before charge boost (eid → px/s) */
  private originalSpeeds: Map<number, number> = new Map();

  update(world: TowerWorld, dt: number): void {
    const w = world.world;
    const cfg = JUGGERNAUT_CFG;

    if (!cfg) return;

    const juggernauts = juggernautQuery(w);

    // Collect alive Juggernaut IDs
    const aliveSet = new Set<number>();

    for (let i = 0; i < juggernauts.length; i++) {
      const eid = juggernauts[i]!;

      // Must be an enemy with canAttackBuildings
      if (UnitTag.isEnemy[eid] !== 1) continue;
      if (UnitTag.canAttackBuildings[eid] !== 1) continue;
      if (Health.current[eid]! <= 0) continue;

      aliveSet.add(eid);

      // ---- CC Resistance ----
      this.applyCCResistance(world, eid, dt, cfg);

      // ---- Charge state machine ----
      this.updateCharge(world, eid, dt, cfg);
    }

    // ---- Cleanup dead Juggernauts from state maps ----
    for (const [eid] of this.chargeCooldowns) {
      if (!aliveSet.has(eid)) {
        this.chargeCooldowns.delete(eid);
        this.chargeTimers.delete(eid);
        this.originalSpeeds.delete(eid);
      }
    }
    for (const [eid] of this.chargeTimers) {
      if (!aliveSet.has(eid)) {
        this.chargeTimers.delete(eid);
        this.originalSpeeds.delete(eid);
      }
    }
  }

  // ================================================================
  // CC Resistance
  // ================================================================

  /**
   * Apply additional timer decay to Stunned / Frozen components.
   *
   * With resist=0.5, the total decay per frame becomes 2×dt,
   * halving the effective stun/freeze duration.
   */
  private applyCCResistance(
    world: TowerWorld,
    eid: number,
    dt: number,
    cfg: typeof JUGGERNAUT_CFG,
  ): void {
    const stunResist = cfg?.stunResist ?? 0;
    const freezeResist = cfg?.freezeResist ?? 0;

    // Stun resistance: extra timer decay
    if (stunResist > 0 && hasComponent(world.world, Stunned, eid)) {
      const resistFactor = stunResist / (1 - stunResist);
      Stunned.timer[eid]! -= dt * resistFactor;
    }

    // Freeze resistance: extra timer decay
    if (freezeResist > 0 && hasComponent(world.world, Frozen, eid)) {
      const resistFactor = freezeResist / (1 - freezeResist);
      Frozen.timer[eid]! -= dt * resistFactor;
    }
  }

  // ================================================================
  // Charge Mechanic
  // ================================================================

  /**
   * Update the charge state machine for one Juggernaut entity.
   */
  private updateCharge(
    world: TowerWorld,
    eid: number,
    dt: number,
    cfg: typeof JUGGERNAUT_CFG,
  ): void {
    const chargeSpeedBonus = cfg?.chargeSpeedBonus ?? 50;
    const chargeDuration = cfg?.chargeDuration ?? 2;
    const chargeCooldownDuration = cfg?.chargeCooldown ?? 8;

    const isCharging = this.chargeTimers.has(eid);

    if (isCharging) {
      // ---- During charge ----
      let remaining = this.chargeTimers.get(eid)!;
      remaining -= dt;

      if (remaining <= 0) {
        // Charge ended — reset speed and start cooldown
        this.endCharge(world, eid, chargeCooldownDuration);
      } else {
        this.chargeTimers.set(eid, remaining);

        // Keep moveMode as FollowPath so MovementSystem continues moving
        // (overrides EnemyAttackSystem's HoldPosition during charge)
        Movement.moveMode[eid] = MoveModeVal.FollowPath;

        // Maintain boosted speed (may have been reset by other systems)
        const boostedSpeed = this.originalSpeeds.get(eid);
        const currentSpeed = Movement.speed[eid]!;
        if (boostedSpeed !== undefined && currentSpeed !== boostedSpeed) {
          Movement.speed[eid] = boostedSpeed;
          Movement.currentSpeed[eid] = boostedSpeed;
        }
      }
    } else {
      // ---- Not charging — tick cooldown ----
      let cooldown = this.chargeCooldowns.get(eid) ?? 0;
      if (cooldown > 0) {
        cooldown -= dt;
        if (cooldown <= 0) {
          cooldown = 0;
        }
        this.chargeCooldowns.set(eid, cooldown);
      }

      // Try to find a building to charge at
      if (cooldown <= 0) {
        const juggX = Position.x[eid]!;
        const juggY = Position.y[eid]!;
        const attackRange = Attack.range[eid]!;

        const nearestBuilding = this.findNearestBuilding(world, juggX, juggY, attackRange);
        if (nearestBuilding !== 0) {
          this.startCharge(world, eid, chargeSpeedBonus, chargeDuration);
        }
      }
    }
  }

  /**
   * Enter charge state: record original speed, apply boost,
   * set FollowPath to rush toward the building.
   */
  private startCharge(
    world: TowerWorld,
    eid: number,
    chargeSpeedBonus: number,
    chargeDuration: number,
  ): void {
    const baseSpeed = Movement.speed[eid]!;
    const boostedSpeed = baseSpeed * (1 + chargeSpeedBonus / 100);

    // Save original speed for restoration
    this.originalSpeeds.set(eid, baseSpeed);

    // Apply speed boost
    Movement.speed[eid] = boostedSpeed;
    Movement.currentSpeed[eid] = boostedSpeed;

    // Set to FollowPath so MovementSystem processes this entity
    // (overrides EnemyAttackSystem's HoldPosition during charge)
    Movement.moveMode[eid] = MoveModeVal.FollowPath;

    // Start charge timer
    this.chargeTimers.set(eid, chargeDuration);
  }

  /**
   * End charge: restore original speed, start cooldown.
   */
  private endCharge(
    world: TowerWorld,
    eid: number,
    cooldownDuration: number,
  ): void {
    // Restore original speed
    const originalSpeed = this.originalSpeeds.get(eid);
    if (originalSpeed !== undefined) {
      Movement.speed[eid] = originalSpeed;
      Movement.currentSpeed[eid] = originalSpeed;
    }

    // Clear charge state
    this.chargeTimers.delete(eid);
    this.originalSpeeds.delete(eid);

    // Start cooldown
    this.chargeCooldowns.set(eid, cooldownDuration);

    // Restore FollowPath mode — EnemyAttackSystem will set HoldPosition
    // if a valid target is found in its next update
    Movement.moveMode[eid] = MoveModeVal.FollowPath;
  }

  // ================================================================
  // Building Detection
  // ================================================================

  /**
   * Find the nearest Player building within range.
   * Returns entity ID or 0 if none found.
   */
  private findNearestBuilding(
    world: TowerWorld,
    fromX: number,
    fromY: number,
    maxRange: number,
  ): number {
    const w = world.world;
    let bestId = 0;
    let bestDist = Infinity;

    // ---- Towers ----
    const towers = towerTargetQuery(w);
    for (let i = 0; i < towers.length; i++) {
      const tid = towers[i]!;
      if (Health.current[tid]! <= 0) continue;
      if (Faction.value[tid] !== FactionVal.Player) continue;
      const dx = Position.x[tid]! - fromX;
      const dy = Position.y[tid]! - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= maxRange && dist < bestDist) {
        bestDist = dist;
        bestId = tid;
      }
    }

    // ---- Production buildings ----
    const productions = productionTargetQuery(w);
    for (let i = 0; i < productions.length; i++) {
      const pid = productions[i]!;
      if (Health.current[pid]! <= 0) continue;
      if (Faction.value[pid] !== FactionVal.Player) continue;
      const dx = Position.x[pid]! - fromX;
      const dy = Position.y[pid]! - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= maxRange && dist < bestDist) {
        bestDist = dist;
        bestId = pid;
      }
    }

    // ---- Building-category entities (Player faction) ----
    const buildings = buildingTargetQuery(w);
    for (let i = 0; i < buildings.length; i++) {
      const bid = buildings[i]!;
      if (Health.current[bid]! <= 0) continue;
      if (Faction.value[bid] !== FactionVal.Player) continue;
      const cat = Category.value[bid];
      if (cat !== CategoryVal.Building) continue;
      const dx = Position.x[bid]! - fromX;
      const dy = Position.y[bid]! - fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= maxRange && dist < bestDist) {
        bestDist = dist;
        bestId = bid;
      }
    }

    return bestId;
  }
}
