// ============================================================
// Tower Defender — HotAirBalloonSystem
//
// Handles HotAirBalloon enemies dropping bombs on Player-owned
// buildings (towers, gold mines, energy towers, base).
//
// - Finds HotAirBalloon enemies (UnitTag.isEnemy=1 + Attack.isRanged=1)
// - Checks for Player-owned buildings directly below the balloon
// - Drops bombs that fall straight down at 300 px/s
// - On impact, deals AOE physical damage to all Player-owned
//   entities within bombRadius
// ============================================================

import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position, Attack, UnitTag, Health, Visual,
  Tower, Production, PlayerOwned, Category, CategoryVal,
  Layer, LayerVal, Faction, FactionVal, ShapeVal, DamageTypeVal,
  Movement, ExplosionEffect,
} from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import { EnemyType } from '../types/index.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';

// ============================================================
// Queries
// ============================================================

/** HotAirBalloon enemies — enemies with ranged attack + position + movement */
const balloonQuery = defineQuery([Position, Attack, UnitTag, Movement]);

/** All entities with position + health (used for building search + AOE) */
const positionHealthQuery = defineQuery([Position, Health]);

/** All entities with faction + position + health (pre-filter for player-owned) */
const factionHealthQuery = defineQuery([Position, Health, Faction]);

// ============================================================
// Config
// ============================================================

const BALLOON_CONFIG = ENEMY_CONFIGS[EnemyType.HotAirBalloon];
const BOMB_FALL_SPEED = 300; // px/s — bomb falls straight down
const BOMB_SIZE = 8;

// Bomb visual: bright red circle
const BOMB_COLOR_R = 0xff;
const BOMB_COLOR_G = 0x33;
const BOMB_COLOR_B = 0x33;

// Explosion ring visual
const EXPLOSION_COLOR_R = 0xff;
const EXPLOSION_COLOR_G = 0x6d;
const EXPLOSION_COLOR_B = 0x00;

// ============================================================
// Types
// ============================================================

interface BombData {
  /** World-space Y at which the bomb detonates */
  targetY: number;
  /** X position at bomb creation (for AOE center if needed) */
  originX: number;
}

// ============================================================
// System
// ============================================================

export class HotAirBalloonSystem implements System {
  readonly name = 'HotAirBalloonSystem';

  /** Active bomb entities: entity ID → bomb state */
  private bombs = new Map<number, BombData>();

  // ==========================================================
  // Frame update
  // ==========================================================

  update(world: TowerWorld, dt: number): void {
    // ---- Phase 1: Process balloons, drop bombs ----
    this.processBalloons(world, dt);

    // ---- Phase 2: Move falling bombs, check impacts ----
    this.processBombs(world, dt);
  }

  // ==========================================================
  // Balloon processing
  // ==========================================================

  private processBalloons(world: TowerWorld, dt: number): void {
    const balloons = balloonQuery(world.world);
    const balloonSet = new Set(balloons);

    for (const eid of balloons) {
      // Defensive: must be enemy with ranged attack
      if (UnitTag.isEnemy[eid] !== 1) continue;
      if (Attack.isRanged[eid] !== 1) continue;

      // Tick cooldown
      Attack.cooldownTimer[eid]! -= dt;
      if (Attack.cooldownTimer[eid]! > 0) continue;

      const bx = Position.x[eid]!;
      const by = Position.y[eid]!;

      // Find a Player-owned building directly below this balloon
      const buildingId = this.findBuildingBelow(world, bx, by, balloonSet);
      if (buildingId === 0) continue;

      // Drop bomb aimed at the building's Y position
      const buildingY = Position.y[buildingId]!;
      this.spawnBomb(world, bx, by, buildingY);

      // Reset attack cooldown to bombInterval
      const bombInterval = BALLOON_CONFIG?.bombInterval ?? 3.5;
      Attack.cooldownTimer[eid] = bombInterval;
    }
  }

  // ==========================================================
  // Bomb lifecycle
  // ==========================================================

  private spawnBomb(
    world: TowerWorld,
    fromX: number,
    fromY: number,
    buildingY: number,
  ): void {
    const bid = world.createEntity();

    world.addComponent(bid, Position, { x: fromX, y: fromY });

    world.addComponent(bid, Visual, {
      shape: ShapeVal.Circle,
      colorR: BOMB_COLOR_R,
      colorG: BOMB_COLOR_G,
      colorB: BOMB_COLOR_B,
      size: BOMB_SIZE,
      alpha: 1,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });

    // Render layer: match balloon's LowAir so it renders above buildings
    world.addComponent(bid, Layer, { value: LayerVal.LowAir });

    this.bombs.set(bid, { targetY: buildingY, originX: fromX });
  }

  private processBombs(world: TowerWorld, dt: number): void {
    const detonated: number[] = [];

    for (const [bid, data] of this.bombs) {
      const py = Position.y[bid];
      if (py === undefined) {
        // Entity was destroyed externally — clean up
        detonated.push(bid);
        continue;
      }

      // Fall straight down
      Position.y[bid] = py + BOMB_FALL_SPEED * dt;

      // Check if bomb has reached or passed the building Y
      if (Position.y[bid]! >= data.targetY) {
        this.detonate(world, bid, data);
        detonated.push(bid);
      }
    }

    for (const bid of detonated) {
      this.bombs.delete(bid);
    }
  }

  // ==========================================================
  // Bomb detonation — AOE damage
  // ==========================================================

  private detonate(world: TowerWorld, bombId: number, data: BombData): void {
    const hitX = Position.x[bombId]!;
    const hitY = Position.y[bombId]!;

    const bombDamage = BALLOON_CONFIG?.bombDamage ?? 30;
    const bombRadius = BALLOON_CONFIG?.bombRadius ?? 60;

    // Deal AOE damage to all Player-owned entities within radius
    const targets = factionHealthQuery(world.world);
    for (const tid of targets) {
      if (Health.current[tid]! <= 0) continue;

      // Must be Player-owned (faction === Player)
      if (Faction.value[tid] !== FactionVal.Player) continue;

      // Optional: skip if this entity is a non-building Player entity
      // (soldiers/units) — but the task says "all Player-owned entities"
      // in the bomb radius. So we include everything.

      const tx = Position.x[tid]!;
      const ty = Position.y[tid]!;
      const dx = tx - hitX;
      const dy = ty - hitY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= bombRadius) {
        applyDamageToTarget(world, tid, bombDamage, DamageTypeVal.Physical);

        // Hit flash
        if (hasComponent(world.world, Visual, tid)) {
          Visual.hitFlashTimer[tid] = 0.12;
        }
      }
    }

    // Also check entities that have PlayerOwned tag but no Faction
    // (e.g. the base entity if it was spawned without Faction)
    const allLiving = positionHealthQuery(world.world);
    for (const tid of allLiving) {
      if (Health.current[tid]! <= 0) continue;
      // Already processed above if it has Faction
      if (Faction.value[tid] === FactionVal.Player) continue;

      // Check for PlayerOwned tag component
      if (!hasComponent(world.world, PlayerOwned, tid)) continue;

      const tx = Position.x[tid]!;
      const ty = Position.y[tid]!;
      const dx = tx - hitX;
      const dy = ty - hitY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= bombRadius) {
        applyDamageToTarget(world, tid, bombDamage, DamageTypeVal.Physical);

        if (hasComponent(world.world, Visual, tid)) {
          Visual.hitFlashTimer[tid] = 0.12;
        }
      }
    }

    // Visual: explosion ring
    this.spawnExplosionRing(world, hitX, hitY, bombRadius);

    // Destroy the bomb entity
    world.destroyEntity(bombId);
  }

  // ==========================================================
  // Building search
  // ==========================================================

  /**
   * Find a Player-owned building directly below the balloon's position.
   *
   * "Directly below" means:
   *  - building Y > balloon Y (building is below in screen space)
   *  - |building X - balloon X| <= bombRadius (horizontal proximity)
   *
   * Prioritises the closest horizontal match.
   */
  private findBuildingBelow(
    world: TowerWorld,
    balloonX: number,
    balloonY: number,
    excludeSet: Set<number>,
  ): number {
    const searchRange = BALLOON_CONFIG?.bombRadius ?? 60;

    const candidates = positionHealthQuery(world.world);
    let bestId = 0;
    let bestDist = Infinity;

    for (const tid of candidates) {
      // Skip self and other balloons
      if (excludeSet.has(tid)) continue;
      // Must be alive
      if (Health.current[tid]! <= 0) continue;

      // Building Y must be below balloon Y
      const ty = Position.y[tid]!;
      if (ty <= balloonY) continue;

      // Must be a Player-owned building
      if (!this.isPlayerBuilding(tid)) continue;

      // Horizontal proximity check
      const tx = Position.x[tid]!;
      const dx = Math.abs(tx - balloonX);

      if (dx <= searchRange && dx < bestDist) {
        bestDist = dx;
        bestId = tid;
      }
    }

    return bestId;
  }

  /**
   * Check whether an entity is a Player-owned building.
   *
   * A building is identified by:
   *  - Faction === Player AND
   *  - (Category ∈ {Tower, Building, Objective} OR has Tower/Production component)
   */
  private isPlayerBuilding(eid: number): boolean {
    const faction = Faction.value[eid];
    if (faction !== FactionVal.Player) return false;

    const category = Category.value[eid];
    if (
      category === CategoryVal.Tower ||
      category === CategoryVal.Building ||
      category === CategoryVal.Objective
    ) {
      return true;
    }

    // Fallback: component-based checks (for entities missing Category)
    if (Tower.towerType[eid] !== undefined) return true;
    if (Production.rate[eid] !== undefined) return true;

    return false;
  }

  // ==========================================================
  // Visual: explosion ring
  // ==========================================================

  private spawnExplosionRing(
    world: TowerWorld,
    x: number,
    y: number,
    radius: number,
  ): void {
    const eid = world.createEntity();
    world.addComponent(eid, Position, { x, y });
    world.addComponent(eid, Visual, {
      shape: ShapeVal.Circle,
      colorR: EXPLOSION_COLOR_R,
      colorG: EXPLOSION_COLOR_G,
      colorB: EXPLOSION_COLOR_B,
      size: 6,
      alpha: 0.8,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
    world.addComponent(eid, ExplosionEffect, {
      duration: 0.4,
      elapsed: 0,
      radius: 6,
      maxRadius: radius,
      colorR: EXPLOSION_COLOR_R,
      colorG: EXPLOSION_COLOR_G,
      colorB: EXPLOSION_COLOR_B,
    });
    world.addComponent(eid, Layer, { value: LayerVal.AboveGrid });
  }
}
