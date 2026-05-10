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
  Stunned, ExplosionEffect, BloodParticle, FadingMark,
  UnitTag, Boss, ShapeVal, DamageTypeVal,
} from '../core/components.js';
import { addBuff } from './BuffSystem.js';
import type { BuffData } from './BuffSystem.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';

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
    const damageType = Projectile.damageType[eid]!;
    if (isAlive(targetId)) {
      applyDamageToTarget(world, targetId, damage, damageType);

      // Hit flash (if target has Visual component)
      if (hasComponent(world.world, Visual, targetId)) {
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
      this.applySplash(world, targetId, hitX, hitY, splashRadius, stunDuration, damage, damageType);
    }

    // -- Ice: slow debuff (BuffSystem handles stacking → freeze) --
    if (slowPercent > 0) {
      if (isAlive(targetId) && !hasComponent(world.world, Stunned, targetId)) {
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

    // -- Arrow: red blood splash particles --
    const projShape = Projectile.shape[eid]!;
    if (projShape === ShapeVal.Arrow) {
      this.spawnBloodSplash(world, hitX, hitY);
    }

    // -- Cannon: smoke puff + persistent ground mark --
    if (splashRadius > 0) {
      this.spawnSmokeExplosion(world, hitX, hitY, splashRadius);
      this.spawnGroundMark(world, hitX, hitY, splashRadius);
    }
  }

  // ---- Cannon: AOE splash damage + stun ----

  private applySplash(
    world: TowerWorld,
    sourceTargetId: number,
    hitX: number, hitY: number,
    radius: number, stunDuration: number, damage: number,
    damageType: number,
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
        applyDamageToTarget(world, enemyId, splashDamage, damageType);

        // Hit flash
        if (hasComponent(world.world, Visual, enemyId)) {
          Visual.hitFlashTimer[enemyId] = 0.12;
        }
      }

      // Stun: skip bosses
      if (hasComponent(world.world, Boss, enemyId)) continue;

      const existing = hasComponent(world.world, Stunned, enemyId)
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
        damageType: Projectile.damageType[sourceEid],
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

  // ---- Visual: blood splash particles (Arrow hit) ----

  private spawnBloodSplash(world: TowerWorld, hitX: number, hitY: number): void {
    const PARTICLE_COUNT = 8;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 / PARTICLE_COUNT) * i + (Math.random() - 0.5) * 0.6;
      const speed = 50 + Math.random() * 80;
      const pid = world.createEntity();
      world.addComponent(pid, Position, { x: hitX, y: hitY });
      world.addComponent(pid, Visual, {
        shape: ShapeVal.Circle,
        colorR: 0xff,
        colorG: 0x33,
        colorB: 0x33,
        size: 3 + Math.random() * 4,
        alpha: 0.9,
        outline: 0,
        hitFlashTimer: 0,
        idlePhase: 0,
      });
      world.addComponent(pid, BloodParticle, {
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - 30, // slight upward bias
        elapsed: 0,
        lifetime: 0.3 + Math.random() * 0.25,
      });
    }
  }

  // ---- Visual: smoke puff (Cannon hit) ----

  private spawnSmokeExplosion(world: TowerWorld, hitX: number, hitY: number, splashRadius: number): void {
    // Smoke ring — expands slower, grayish
    const sid = world.createEntity();
    world.addComponent(sid, Position, { x: hitX, y: hitY });
    world.addComponent(sid, ExplosionEffect, {
      duration: 0.6,
      elapsed: 0,
      radius: 8,
      maxRadius: splashRadius * 0.6,
      colorR: 0x99,
      colorG: 0x99,
      colorB: 0x99,
    });
    world.addComponent(sid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 0x99,
      colorG: 0x99,
      colorB: 0x99,
      size: 8,
      alpha: 0.45,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });

    // Central smoke puff — stays near center, fades faster
    const pid = world.createEntity();
    world.addComponent(pid, Position, { x: hitX, y: hitY });
    world.addComponent(pid, ExplosionEffect, {
      duration: 0.5,
      elapsed: 0,
      radius: 6,
      maxRadius: splashRadius * 0.35,
      colorR: 0x77,
      colorG: 0x77,
      colorB: 0x77,
    });
    world.addComponent(pid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 0x77,
      colorG: 0x77,
      colorB: 0x77,
      size: 6,
      alpha: 0.6,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
  }

  // ---- Visual: persistent ground mark (Cannon hit) ----

  private spawnGroundMark(world: TowerWorld, hitX: number, hitY: number, splashRadius: number): void {
    const gid = world.createEntity();
    world.addComponent(gid, Position, { x: hitX, y: hitY });
    world.addComponent(gid, Visual, {
      shape: ShapeVal.Circle,
      colorR: 0x33,
      colorG: 0x33,
      colorB: 0x33,
      size: 40 + splashRadius * 0.4,
      alpha: 0.3,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
    world.addComponent(gid, FadingMark, {
      duration: 3.0,
      elapsed: 0,
      maxAlpha: 0.3,
    });
  }
}
