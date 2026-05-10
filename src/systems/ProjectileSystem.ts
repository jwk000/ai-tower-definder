// ============================================================
// Tower Defender — ProjectileSystem (bitecs migration)
//
// Moves projectiles toward targets, deals damage on impact,
// and applies special effects (AOE splash, chain lightning,
// slow/freeze/stun status via BuffSystem).
//
// Buff duration ticking removed — delegated to BuffSystem.
// ============================================================

import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import {
  Position, Projectile, Health, Visual,
  Stunned, ExplosionEffect,
  UnitTag, Boss,
} from '../core/components.js';
import { addBuff } from './BuffSystem.js';
import type { BuffData } from './BuffSystem.js';

// ============================================================
// Queries
// ============================================================

const projectileQuery = defineQuery([Position, Projectile]);
const enemyQuery = defineQuery([Position, Health, UnitTag]);

// ============================================================
// Constants
// ============================================================

/** ShapeVal constants to avoid magic numbers */
const SHAPE_CIRCLE = 1;
const SHAPE_TRIANGLE = 2;

/** Lightning chain colour — warm yellow */
const LIGHTNING_R = 0xff;
const LIGHTNING_G = 0xf1;
const LIGHTNING_B = 0x76;

/** Explosion ring colour — orange */
const EXPLOSION_R = 0xff;
const EXPLOSION_G = 0x6d;
const EXPLOSION_B = 0x00;

// ============================================================
// Helpers
// ============================================================

/** Check whether an entity is alive (has Health with current > 0) */
function isAlive(eid: number): boolean {
  const hp = Health.current[eid];
  return hp !== undefined && hp > 0;
}

// ============================================================
// ProjectileSystem
// ============================================================

export class ProjectileSystem implements System {
  readonly name = 'ProjectileSystem';

  // ---- Frame update ----

  update(world: TowerWorld, dt: number): void {
    const entities = projectileQuery(world.world);

    for (const eid of entities) {
      const targetId = Projectile.targetId[eid] as number;

      // Target dead / gone — destroy projectile
      if (!isAlive(targetId)) {
        world.destroyEntity(eid);
        continue;
      }

      const px = Position.x[eid]!;
      const py = Position.y[eid]!;
      const tx = Position.x[targetId];
      const ty = Position.y[targetId];

      if (tx === undefined || ty === undefined) {
        world.destroyEntity(eid);
        continue;
      }

      // Move toward target
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = Projectile.speed[eid]!;
      const moveDist = speed * dt;

      if (dist <= moveDist + 2) {
        // Impact!
        this.onHit(world, eid, tx, ty);
        world.destroyEntity(eid);
      } else {
        Position.x[eid] = px + (dx / dist) * moveDist;
        Position.y[eid] = py + (dy / dist) * moveDist;
      }
    }
  }

  // ---- Impact handler ----

  private onHit(world: TowerWorld, eid: number, hitX: number, hitY: number): void {
    const targetId = Projectile.targetId[eid] as number;
    const damage = Projectile.damage[eid]!;
    const sourceId = Projectile.sourceId[eid] as number;

    // -- Deal damage to primary target --
    if (isAlive(targetId)) {
      Health.current[targetId] = (Health.current[targetId] ?? 0) - damage;

      // Hit flash (if target has Visual component)
      if (hasComponent(world.world, targetId, Visual)) {
        Visual.hitFlashTimer[targetId] = 0.12;
      }
    }

    // -- Read special-effect fields from projectile --
    const splashRadius = Projectile.splashRadius[eid]!;
    const stunDuration = Projectile.stunDuration[eid]!;
    const slowPercent = Projectile.slowPercent[eid]!;
    const slowMaxStacks = Projectile.slowMaxStacks[eid] as number;
    const chainCount = Projectile.chainCount[eid] as number;
    const chainRange = Projectile.chainRange[eid]!;
    const chainDecay = Projectile.chainDecay[eid]!;
    const isChain = Projectile.isChain[eid] as number;

    // -- Cannon: AOE splash + stun --
    if (splashRadius > 0) {
      this.applySplash(world, targetId, hitX, hitY, splashRadius, stunDuration, damage);
    }

    // -- Ice: slow debuff (BuffSystem handles stacking → freeze) --
    if (slowPercent > 0) {
      if (isAlive(targetId) && !hasComponent(world.world, targetId, Stunned)) {
        const buff: BuffData = {
          id: 'ice_slow',
          attribute: 'speed',
          value: -slowPercent,       // negative = percent reduction
          isPercent: true,
          duration: 3.0,
          stacks: 1,
          maxStacks: slowMaxStacks,
          sourceId,
        };
        addBuff(world, targetId, buff);
      }
    }

    // -- Lightning: chain to nearby enemies (initial projectile only) --
    if (chainCount > 0 && !isChain) {
      this.applyChain(world, eid, hitX, hitY, chainCount, chainRange, chainDecay, damage);
    }

    // -- Visual: explosion ring --
    const visRadius = splashRadius > 0 ? splashRadius : 30;
    this.spawnExplosion(world, hitX, hitY, visRadius);
  }

  // ---- Cannon: AOE splash damage + stun ----

  private applySplash(
    world: TowerWorld,
    sourceTargetId: number,
    hitX: number, hitY: number,
    radius: number, stunDuration: number, damage: number,
  ): void {
    const splashDamage = damage * 0.6;

    for (const enemyId of enemyQuery(world.world)) {
      if (!isAlive(enemyId)) continue;

      const ex = Position.x[enemyId];
      const ey = Position.y[enemyId];
      if (ex === undefined || ey === undefined) continue;

      const dx = ex - hitX;
      const dy = ey - hitY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius) continue;

      // AOE damage (main target already took full damage)
      if (enemyId !== sourceTargetId) {
        Health.current[enemyId] = (Health.current[enemyId] ?? 0) - splashDamage;

        // Hit flash
        if (hasComponent(world.world, enemyId, Visual)) {
          Visual.hitFlashTimer[enemyId] = 0.12;
        }
      }

      // Stun: skip bosses
      if (hasComponent(world.world, enemyId, Boss)) continue;

      const existing = hasComponent(world.world, enemyId, Stunned)
        ? Stunned.timer[enemyId]!
        : 0;
      world.addComponent(enemyId, Stunned, {
        timer: Math.max(existing, stunDuration),
      });
    }
  }

  // ---- Lightning: chain to nearby enemies ----

  private applyChain(
    world: TowerWorld,
    sourceEid: number,
    hitX: number, hitY: number,
    chainCount: number, chainRange: number,
    chainDecay: number, damage: number,
  ): void {
    const sourceId = Projectile.sourceId[sourceEid] as number;
    const primaryTarget = Projectile.targetId[sourceEid] as number;
    const hitIds = new Set<number>([primaryTarget]);

    let fromX = hitX;
    let fromY = hitY;

    for (let hop = 0; hop < chainCount - 1; hop++) {
      let nearestId: number | null = null;
      let nearestDist = chainRange + 1;

      for (const enemyId of enemyQuery(world.world)) {
        if (hitIds.has(enemyId) || !isAlive(enemyId)) continue;

        const ex = Position.x[enemyId];
        const ey = Position.y[enemyId];
        if (ex === undefined || ey === undefined) continue;

        const dx = ex - fromX;
        const dy = ey - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= chainRange && dist < nearestDist) {
          nearestDist = dist;
          nearestId = enemyId;
        }
      }

      if (nearestId === null) break;

      hitIds.add(nearestId);

      // Damage decays per hop: (1 - chainDecay)^hop
      const hopDamage = damage * Math.pow(1 - chainDecay, hop);

      // Spawn a new chain projectile entity
      const pid = world.createEntity();
      world.addComponent(pid, Position, { x: fromX, y: fromY });
      world.addComponent(pid, Projectile, {
        speed: 600,
        damage: hopDamage,
        targetId: nearestId,
        sourceId,
        fromX,
        fromY,
        shape: SHAPE_TRIANGLE,
        colorR: LIGHTNING_R,
        colorG: LIGHTNING_G,
        colorB: LIGHTNING_B,
        size: 10,
        isChain: 1,
        chainIndex: hop + 1,
      });
      world.addComponent(pid, Visual, {
        shape: SHAPE_TRIANGLE,
        colorR: LIGHTNING_R,
        colorG: LIGHTNING_G,
        colorB: LIGHTNING_B,
        size: 10,
        alpha: 1,
        outline: 0,
        hitFlashTimer: 0,
        idlePhase: 0,
      });

      // Next hop origin = current target position
      fromX = Position.x[nearestId]!;
      fromY = Position.y[nearestId]!;
    }
  }

  // ---- Visual: explosion ring ----

  private spawnExplosion(world: TowerWorld, x: number, y: number, radius: number): void {
    const id = world.createEntity();
    world.addComponent(id, Position, { x, y });
    world.addComponent(id, ExplosionEffect, {
      duration: 0.35,
      elapsed: 0,
      radius: 4,             // initial visual size
      maxRadius: radius,     // expands to this
      colorR: EXPLOSION_R,
      colorG: EXPLOSION_G,
      colorB: EXPLOSION_B,
    });
    world.addComponent(id, Visual, {
      shape: SHAPE_CIRCLE,
      colorR: EXPLOSION_R,
      colorG: EXPLOSION_G,
      colorB: EXPLOSION_B,
      size: 4,
      alpha: 1,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
  }
}
