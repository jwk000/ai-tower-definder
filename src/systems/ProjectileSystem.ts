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
  TargetingMark, Layer, LayerVal,
  Tower,
} from '../core/components.js';
import { calcPhysicalDamage } from '../utils/combatFormulas.js';
import { addBuff, BuffPriority } from './BuffSystem.js';
import type { BuffData } from './BuffSystem.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { Sound } from '../utils/Sound.js';
import { TowerType, type MapConfig } from '../types/index.js';
import { TOWER_CONFIGS } from '../data/gameData.js';
import { ScreenShakeSystem } from './ScreenShakeSystem.js';
import { TileDamageSystem } from './TileDamageSystem.js';

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
// Vine tower DOT tracking
// ============================================================

interface VineDOT {
  damagePerTick: number;
  ticksRemaining: number;
  stackCount: number;
  timer: number;
}

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

  private map: MapConfig;

  /** Vine tower DOT entries: targetId → DOT state */
  private dotEntries = new Map<number, VineDOT>();

  /** Missile projectile vertical velocity: entityId → vy (px/s) */
  private missileVelY = new Map<number, number>();

  constructor(map: MapConfig) {
    this.map = map;
  }

  // ---- Frame update ----

  update(world: TowerWorld, dt: number): void {
    const entities = projectileQuery(world.world);

    for (const eid of entities) {
      const targetId = Projectile.targetId[eid] as number;
      const sourceTowerType = Projectile.sourceTowerType[eid] as number;
      const isMissile = sourceTowerType === 6;

      if (isMissile) {
        // ── Missile: parabolic trajectory, target is a position marker (no Health) ──
        const ttx = Position.x[targetId];
        const tty = Position.y[targetId];

        if (ttx === undefined || tty === undefined) {
          world.destroyEntity(eid);
          this.missileVelY.delete(eid);
          continue;
        }

        const px = Position.x[eid]!;
        const py = Position.y[eid]!;
        const speed = Projectile.speed[eid]!;

        // Initialize vertical velocity on first frame
        let vy = this.missileVelY.get(eid);
        if (vy === undefined) {
          vy = -150; // initial upward velocity
          this.missileVelY.set(eid, vy);
        }

        // Apply gravity
        vy += 400 * dt;
        this.missileVelY.set(eid, vy);

        // Horizontal movement toward target
        const dx = ttx - px;
        const dirX = dx > 0 ? 1 : -1;
        const moveX = Math.min(Math.abs(dx), speed * dt) * dirX;

        Position.x[eid] = px + moveX;
        Position.y[eid] = py + vy * dt;

        // Rotate toward velocity direction (stored in idlePhase for renderer)
        if (hasComponent(world.world, Visual, eid)) {
          Visual.idlePhase[eid] = Math.atan2(vy, dirX * speed);
        }

        // 命中判定：必须处于下落阶段（vy > 0）且 Y 已经越过目标线，
        // 防止目标在塔北方时首帧 newY (=towerY-eps) >= tty (更小) 立刻误判命中
        const newY = Position.y[eid]!;
        if (vy > 0 && newY >= tty) {
          this.onHit(world, eid, Position.x[eid]!, newY);
          this.missileVelY.delete(eid);
          world.destroyEntity(eid);
        }
      } else {
        // ── Non‑missile: straight‑line trajectory ──
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

    // ---- Vine tower DOT ticking ----
    for (const [targetId, dot] of this.dotEntries) {
      if (!isAlive(targetId)) {
        this.dotEntries.delete(targetId);
        continue;
      }
      dot.timer -= dt;
      while (dot.timer <= 0) {
        const tickDamage = dot.stackCount * dot.damagePerTick;
        const current = Health.current[targetId] ?? 0;
        Health.current[targetId] = current - tickDamage;
        dot.timer += 1.0;
        dot.ticksRemaining--;
        if (dot.ticksRemaining <= 0) {
          this.dotEntries.delete(targetId);
          break;
        }
      }
    }
  }

  // ---- Impact handler ----

  private onHit(world: TowerWorld, eid: number, hitX: number, hitY: number): void {
    const targetId = Projectile.targetId[eid] as number;
    const damage = Projectile.damage[eid]!;
    const sourceId = Projectile.sourceId[eid] as number;
    const sourceTowerType = Projectile.sourceTowerType[eid] as number;
    const isMissile = sourceTowerType === 6;

    // -- Deal damage to primary target --
    const damageType = Projectile.damageType[eid]!;
    if (isAlive(targetId)) {
      applyDamageToTarget(world, targetId, damage, damageType);
      Sound.play('enemy_hit');

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

    // -- Cannon / Missile: AOE splash + stun --
    if (splashRadius > 0) {
      this.applySplash(world, targetId, hitX, hitY, splashRadius, stunDuration, damage, damageType, sourceId, isMissile);
      Sound.play('cannon_hit');
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
          priority: BuffPriority.Slow,
          removeOnSourceDeath: false,
        };
        addBuff(world, targetId, buff);
      }
      Sound.play('ice_hit');
    }

    // -- Lightning: chain to nearby enemies (initial projectile only) --
    if (chainCount > 0 && !isChain) {
      this.applyChain(world, eid, hitX, hitY, chainCount, chainRange, chainDecay, damage);
      Sound.play('lightning_hit');
    }

    if (isMissile) {
      // ── Missile: enhanced explosion + screen shake + tile damage ──

      // Destroy this missile's own TargetingMark (Projectile.targetId points to it).
      // 不依赖位置距离阈值——抛物线轨迹的落点必然偏离 mark 中心，距离 cleanup 会漏。
      if (targetId !== 0 && hasComponent(world.world, TargetingMark, targetId)) {
        world.destroyEntity(targetId);
      }

      // Enhanced explosion: bigger, longer, larger initial radius
      this.spawnExplosion(world, hitX, hitY, splashRadius, 6, 0.5);

      // Enhanced blood splash: 15 orange/red particles
      this.spawnBloodSplash(world, hitX, hitY, 15, true);

      // Enhanced smoke with larger radius
      this.spawnSmokeExplosion(world, hitX, hitY, splashRadius, true);

      // Persistent ground mark
      this.spawnGroundMark(world, hitX, hitY, splashRadius);

      // Screen shake
      ScreenShakeSystem.triggerShake(world, 8, 0.4, 30);

      // Tile damage
      TileDamageSystem.spawnTileDamage(world, hitX, hitY, splashRadius, this.map);

      // Shockwave ring
      this.spawnShockwaveRing(world, hitX, hitY, splashRadius);
    } else {
      // ── Non‑missile: standard visual effects ──

      // -- Visual: explosion ring --
      const visRadius = splashRadius > 0 ? splashRadius : 30;
      this.spawnExplosion(world, hitX, hitY, visRadius);

      // -- Arrow: red blood splash particles --
      const projShape = Projectile.shape[eid]!;
      if (projShape === ShapeVal.Arrow) {
        this.spawnBloodSplash(world, hitX, hitY);
        Sound.play('arrow_hit');
      }

      // -- Cannon: smoke puff + persistent ground mark --
      if (splashRadius > 0) {
        this.spawnSmokeExplosion(world, hitX, hitY, splashRadius);
        this.spawnGroundMark(world, hitX, hitY, splashRadius);
      }
    }

    // -- Vine: stacking DOT true damage --
    if (sourceTowerType === 7 && isAlive(targetId)) {
      const vineCfg = TOWER_CONFIGS[TowerType.Vine];
      if (vineCfg?.dotDamage !== undefined && vineCfg?.dotDuration !== undefined) {
        const existing = this.dotEntries.get(targetId);
        if (existing) {
          existing.stackCount = Math.min(
            existing.stackCount + 1,
            vineCfg.dotMaxStacks ?? 5,
          );
          existing.ticksRemaining = vineCfg.dotDuration;
        } else {
          this.dotEntries.set(targetId, {
            damagePerTick: vineCfg.dotDamage,
            ticksRemaining: vineCfg.dotDuration,
            stackCount: 1,
            timer: 1.0,
          });
        }
      }
    }
  }

  // ---- Cannon: AOE splash damage + stun ----

  private applySplash(
    world: TowerWorld,
    sourceTargetId: number,
    hitX: number, hitY: number,
    radius: number, stunDuration: number, damage: number,
    damageType: number,
    sourceTowerId = 0,
    isMissile = false,
  ): void {
    const splashDamage = damage * 0.6;

    // v1.1 Missile: L5 thermobaric center-bonus + flying-immune
    const missileCfg = isMissile ? TOWER_CONFIGS[TowerType.Missile] : undefined;
    const towerLevel = isMissile && sourceTowerId > 0
      ? (Tower.level[sourceTowerId] ?? 1)
      : 1;
    const centerBonusActive = isMissile && towerLevel >= 5;
    const centerRadiusSq = centerBonusActive
      ? (radius * (missileCfg?.centerBonusRadiusRatio ?? 0.1)) ** 2
      : 0;
    const centerMult = missileCfg?.centerBonusMultiplier ?? 1.0;
    const cantTargetFlying = isMissile && missileCfg?.cantTargetFlying === true;

    for (const enemyId of enemyQuery(world.world)) {
      if (!isAlive(enemyId)) continue;

      // 友军伤害守卫：splash 仅伤敌方单位，不伤友军塔/建筑/陷阱（含发射源塔自身）
      if (UnitTag.isEnemy[enemyId] !== 1) continue;
      if (enemyId === sourceTowerId) continue;

      // Missile: skip flying enemies (ground explosion doesn't reach them)
      if (cantTargetFlying && (Layer.value[enemyId] ?? LayerVal.Ground) === LayerVal.LowAir) {
        continue;
      }

      const ex = Position.x[enemyId];
      const ey = Position.y[enemyId];
      if (ex === undefined || ey === undefined) continue;

      const dx = ex - hitX;
      const dy = ey - hitY;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq);

      if (dist > radius) continue;

      // L5 thermobaric: center 10% radius ×1.2 damage bonus
      const centerMultiplier = centerBonusActive && distSq <= centerRadiusSq ? centerMult : 1.0;

      // AOE damage (main target already took full damage; for missile, primary target also gets bonus)
      if (enemyId !== sourceTargetId) {
        applyDamageToTarget(world, enemyId, splashDamage * centerMultiplier, damageType);

        // Hit flash
        if (hasComponent(world.world, Visual, enemyId)) {
          Visual.hitFlashTimer[enemyId] = 0.12;
        }
      } else if (isMissile && centerMultiplier > 1.0) {
        // Missile primary target: bonus is on top of the full-damage hit already dealt at onHit()
        const bonusDamage = damage * (centerMultiplier - 1.0);
        applyDamageToTarget(world, enemyId, bonusDamage, damageType);
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

  private spawnExplosion(world: TowerWorld, x: number, y: number, maxRadius: number, initialRadius = 4, duration = 0.35): void {
    const id = world.createEntity();
    world.addComponent(id, Position, { x, y });
    world.addComponent(id, ExplosionEffect, {
      duration,
      elapsed: 0,
      radius: initialRadius,  // initial visual size
      maxRadius,              // expands to this
      colorR: EXPLOSION_R,
      colorG: EXPLOSION_G,
      colorB: EXPLOSION_B,
    });
    world.addComponent(id, Visual, {
      shape: SHAPE_CIRCLE,
      colorR: EXPLOSION_R,
      colorG: EXPLOSION_G,
      colorB: EXPLOSION_B,
      size: initialRadius,
      alpha: 1,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
  }

  // ---- Visual: blood splash particles (Arrow hit) ----

  private spawnBloodSplash(world: TowerWorld, hitX: number, hitY: number, count = 8, explosionColors = false): void {
    const colorR = explosionColors ? 0xff : 0xff;
    const colorG = explosionColors ? 0x6d : 0x33;
    const colorB = explosionColors ? 0x00 : 0x33;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.6;
      const speed = 50 + Math.random() * 80;
      const pid = world.createEntity();
      world.addComponent(pid, Position, { x: hitX, y: hitY });
      world.addComponent(pid, Visual, {
        shape: ShapeVal.Circle,
        colorR,
        colorG,
        colorB,
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

  private spawnSmokeExplosion(world: TowerWorld, hitX: number, hitY: number, splashRadius: number, isMissile = false): void {
    const ringMult = isMissile ? 0.8 : 0.6;
    const puffMult = isMissile ? 0.5 : 0.35;

    // Smoke ring — expands slower, grayish
    const sid = world.createEntity();
    world.addComponent(sid, Position, { x: hitX, y: hitY });
    world.addComponent(sid, ExplosionEffect, {
      duration: 0.6,
      elapsed: 0,
      radius: 8,
      maxRadius: splashRadius * ringMult,
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
      maxRadius: splashRadius * puffMult,
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

  // ---- Visual: shockwave ring (Missile explosion) ----

  /** Thin expanding ring separate from main explosion — missile shockwave effect */
  private spawnShockwaveRing(world: TowerWorld, hitX: number, hitY: number, splashRadius: number): void {
    const id = world.createEntity();
    world.addComponent(id, Position, { x: hitX, y: hitY });
    world.addComponent(id, ExplosionEffect, {
      duration: 0.45,
      elapsed: 0,
      radius: splashRadius * 0.15,  // smaller initial size
      maxRadius: splashRadius * 0.85,
      colorR: EXPLOSION_R,
      colorG: EXPLOSION_G,
      colorB: EXPLOSION_B,
    });
    world.addComponent(id, Visual, {
      shape: SHAPE_CIRCLE,
      colorR: EXPLOSION_R,
      colorG: EXPLOSION_G,
      colorB: EXPLOSION_B,
      size: splashRadius * 0.15,
      alpha: 0.8,
      outline: 1,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
  }
}
