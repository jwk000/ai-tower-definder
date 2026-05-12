import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import {
  Position,
  Health,
  Attack,
  Visual,
  BatTower,
  BatSwarmMember,
  Tower,
  UnitTag,
  PlayerOwned,
  Category,
  CategoryVal,
  Layer,
  LayerVal,
  DamageTypeVal,
  TargetSelectionVal,
  AttackModeVal,
} from '../core/components.js';
import type { WeatherSystem } from './WeatherSystem.js';
import { Renderer } from '../render/Renderer.js';

// ============================================================
// Boid tuning constants
// ============================================================

const BAT_SPEED = 120;
const SEPARATION_RADIUS = 50;
const ALIGNMENT_RADIUS = 100;
const COHESION_RADIUS = 130;
const WANDER_RADIUS = 160;
const MAX_FORCE = 600;
const WANDER_STRENGTH = 200;

// ============================================================
// Attack animation constants (per design/12-visual-effects.md §9)
// ============================================================

/** Phase thresholds: Lock (0-0.20) → Swoop (0.20-0.60) → Bite (0.60-0.75) → Return (0.75-1.0) */
const PHASE_LOCK_END = 0.20;
const PHASE_SWOOP_END = 0.60;
const PHASE_BITE_END = 0.75;
/** Phase at which the actual damage is applied (mid-bite, "fangs sink in") */
const PHASE_DAMAGE_TRIGGER = 0.65;

/** Particle pool soft cap to avoid runaway allocation in extreme cases */
const MAX_PARTICLES = 256;

// ============================================================
// Bitecs queries — pre-built for frame reuse
// ============================================================

/** All bats (with attack ability, health, and player ownership) */
const batQuery = defineQuery([BatSwarmMember, Position, Attack, Health, PlayerOwned]);

/** Bat towers */
const towerQuery = defineQuery([BatTower, Tower, Position]);

/** Enemies (for target selection) */
const enemyQuery = defineQuery([Position, Health, UnitTag]);

// ============================================================
// Internal anim & particle types
// ============================================================

interface BatAnimState {
  // Idle wing/hover state (always active)
  flapPhase: number;
  flapSpeed: number;       // baseline flap Hz (3-6)
  hoverFreq: number;
  hoverPhase: number;
  hoverAmp: number;

  // Attack state (isAttacking=false ⇒ remaining fields ignored)
  isAttacking: boolean;
  attackPhase: number;       // 0-1 progress through the 4-phase attack
  attackDuration: number;    // total time for the attack (= 1 / attackSpeed)
  attackTargetId: number;    // enemy entity id (0 = none)
  attackTargetX: number;     // snapshot of target pos at attack start
  attackTargetY: number;
  swoopStartX: number;       // swoop start (bat's pos at attack trigger)
  swoopStartY: number;
  swoopArcHeight: number;    // 15-30 px random arc apex height
  boidReturnX: number;       // home position snapshot for return phase
  boidReturnY: number;
  hasDealtDamage: boolean;   // ensures damage only applies once per attack
  trailEmitTimer: number;    // throttle for swoop trail particles
}

/**
 * Internal particle — lightweight, not an ECS entity (high churn rate).
 * Used for swoop trails, hit splatters, lifesteal motes, lock-on motes.
 */
interface BatParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;       // px
  color: string;
  alpha: number;      // current alpha (drives fade)
  life: number;       // remaining seconds
  maxLife: number;    // total lifetime (for alpha curves)
  z: number;          // render z-index
  /** If set, particle eases toward (homeX, homeY) instead of free-flying (lock motes / lifesteal) */
  homeId?: number;    // bat id to home to (sampled each frame for live position)
  homeOffsetX?: number;
  homeOffsetY?: number;
}

// ============================================================
// BatSwarmSystem
// ============================================================

export class BatSwarmSystem implements System {
  readonly name = 'BatSwarmSystem';

  /** Accumulating frame counter (for wander angle variation) */
  private frameCounter = 0;

  /** Per-bat velocity (vx, vy) — persistent boid state not stored in components */
  private batVelocities = new Map<number, { vx: number; vy: number }>();

  /** Per-bat wing animation + attack state */
  private batAnimStates = new Map<number, BatAnimState>();

  /** Lightweight particle list (swoop trails, hit splatters, lifesteal motes) */
  private particles: BatParticle[] = [];

  /** Current world reference — set each frame in update() */
  private world: TowerWorld | null = null;

  constructor(
    private weatherSystem?: WeatherSystem,
    private renderer?: Renderer,
  ) {}

  // ============================================================
  // System.update
  // ============================================================

  update(world: TowerWorld, dt: number): void {
    this.world = world;
    this.frameCounter++;

    const bats = batQuery(world.world);
    const towers = towerQuery(world.world);

    // ── Pass 1: count alive bats per tower ──────────────────
    const aliveCountByTower = new Map<number, number>();
    for (let i = 0; i < bats.length; i++) {
      const batId = bats[i]!;
      if (Health.current[batId]! <= 0) continue;
      const parentId = BatSwarmMember.parentId[batId];
      aliveCountByTower.set(parentId!, (aliveCountByTower.get(parentId!) ?? 0) + 1);
    }

    // ── Pass 2: tower replenishment ─────────────────────────
    for (let i = 0; i < towers.length; i++) {
      const towerId = towers[i]!;
      const aliveCount = aliveCountByTower.get(towerId) ?? 0;
      const maxBats = BatTower.maxBats[towerId];

      // Initial spawn: no bats yet, spawn full batch
      if (aliveCount === 0 && BatTower.replenishTimer[towerId]! <= 0) {
        for (let j = 0; j < maxBats!; j++) {
          this.spawnBat(world, towerId);
        }
        this.cleanupStaleVelocities(bats);
        continue;
      }

      // Tick replenish timer when bats are missing
      if (aliveCount < maxBats!) {
        if (BatTower.replenishTimer[towerId]! > 0) {
          BatTower.replenishTimer[towerId]! -= dt;
        }
        if (BatTower.replenishTimer[towerId]! <= 0) {
          this.spawnBat(world, towerId);
          BatTower.replenishTimer[towerId] = BatTower.replenishCooldown[towerId]!;
        }
      }
    }

    // ── Pass 3: bat behavior (attack-anim aware boid + attack) ─
    for (let i = 0; i < bats.length; i++) {
      const batId = bats[i]!;
      if (Health.current[batId]! <= 0) continue;

      const anim = this.getOrCreateAnim(batId);

      // Attack cooldown ticks down independent of animation state
      if (Attack.cooldownTimer[batId]! > 0) {
        Attack.cooldownTimer[batId]! -= dt;
      }

      if (anim.isAttacking) {
        // Attack-driven motion: bezier swoop / lock / return — bypasses boid
        this.updateAttackMotion(world, batId, anim, dt);
      } else {
        // Normal flocking
        this.applyBoidForces(world, batId, bats, dt);

        // Try to start a new attack
        if (Attack.cooldownTimer[batId]! <= 0 && this.canBatAttack()) {
          this.tryStartAttack(world, batId, anim);
        }
      }
    }

    // ── Pass 4: update particles ──────────────────────────────
    this.updateParticles(dt);

    // ── Pass 5: render bats (animated body + wings + attack VFX) ──
    if (this.renderer) {
      for (let i = 0; i < bats.length; i++) {
        const batId = bats[i]!;
        if (Health.current[batId]! <= 0) continue;
        this.renderBat(batId);
      }
      this.renderParticles();
    }

    // Cleanups
    this.cleanupStaleVelocities(bats);
    this.cleanupStaleAnimations(bats);
  }

  // ============================================================
  // Weather gating
  // ============================================================

  private canBatAttack(): boolean {
    if (!this.weatherSystem) return true;
    return this.weatherSystem.canAttackBat();
  }

  // ============================================================
  // Boid forces (velocity-based steering)
  // ============================================================

  private applyBoidForces(
    world: TowerWorld,
    batId: number,
    allBats: readonly number[],
    dt: number,
  ): void {
    const bx = Position.x[batId];
    const by = Position.y[batId];
    const parentId = BatSwarmMember.parentId[batId];

    // Ensure velocity exists
    let vel = this.batVelocities.get(batId);
    if (!vel) {
      const angle = Math.random() * Math.PI * 2;
      vel = { vx: Math.cos(angle) * 30, vy: Math.sin(angle) * 30 };
      this.batVelocities.set(batId, vel);
    }

    let sepX = 0, sepY = 0, sepCount = 0;
    let aliX = 0, aliY = 0, aliCount = 0;
    let cohX = 0, cohY = 0, cohCount = 0;

    for (let i = 0; i < allBats.length; i++) {
      const otherId = allBats[i]!;
      if (otherId === batId) continue;
      if (Health.current[otherId]! <= 0) continue;
      // Bats currently mid-attack are not considered for flocking peers
      const otherAnim = this.batAnimStates.get(otherId);
      if (otherAnim && otherAnim.isAttacking) continue;

      const ox = Position.x[otherId];
      const oy = Position.y[otherId];
      const dx = bx! - ox!;
      const dy = by! - oy!;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.01) continue;

      const invDist = 1 / dist;

      if (dist < SEPARATION_RADIUS) {
        sepX += dx * invDist;
        sepY += dy * invDist;
        sepCount++;
      }
      if (dist < ALIGNMENT_RADIUS) {
        const oVel = this.batVelocities.get(otherId);
        if (oVel) {
          aliX += oVel.vx;
          aliY += oVel.vy;
          aliCount++;
        }
      }
      if (dist < COHESION_RADIUS) {
        cohX += ox!;
        cohY += oy!;
        cohCount++;
      }
    }

    // Home attraction (toward parent tower)
    const tx = Position.x[parentId!];
    const ty = Position.y[parentId!];
    let homeX = 0, homeY = 0;
    if (tx !== undefined && ty !== undefined) {
      homeX = tx - bx!;
      homeY = ty - by!;
    }

    // Combine forces
    let fx = 0, fy = 0;
    const sepWeight = 3.0;
    const aliWeight = 1.5;
    const cohWeight = 1.0;
    const homeWeight = 2.0;

    if (sepCount > 0) {
      fx += (sepX / sepCount) * BAT_SPEED * sepWeight;
      fy += (sepY / sepCount) * BAT_SPEED * sepWeight;
    }
    if (aliCount > 0) {
      fx += (aliX / aliCount) * aliWeight;
      fy += (aliY / aliCount) * aliWeight;
    }
    if (cohCount > 0) {
      cohX = cohX / cohCount - bx!;
      cohY = cohY / cohCount - by!;
      const cohLen = Math.sqrt(cohX * cohX + cohY * cohY);
      if (cohLen > 0.01) {
        fx += (cohX / cohLen) * BAT_SPEED * cohWeight;
        fy += (cohY / cohLen) * BAT_SPEED * cohWeight;
      }
    }

    // Home attraction
    const homeLen = Math.sqrt(homeX * homeX + homeY * homeY);
    if (homeLen > 0.01) {
      const pull = homeLen > WANDER_RADIUS ? homeWeight * 2 : homeWeight;
      fx += (homeX / homeLen) * BAT_SPEED * pull;
      fy += (homeY / homeLen) * BAT_SPEED * pull;
    }

    // Wander (per-bat deterministic randomness)
    const wanderAngle = (batId * 7.1317 + this.frameCounter * 0.03) % (Math.PI * 2);
    fx += Math.cos(wanderAngle) * WANDER_STRENGTH;
    fy += Math.sin(wanderAngle * 1.3 + 1.7) * WANDER_STRENGTH;

    // Clamp force magnitude
    const fLen = Math.sqrt(fx * fx + fy * fy);
    if (fLen > MAX_FORCE) {
      fx = (fx / fLen) * MAX_FORCE;
      fy = (fy / fLen) * MAX_FORCE;
    }

    // Apply acceleration to velocity
    const speed = BatTower.batSpeed[parentId!] ?? BAT_SPEED;
    vel.vx += fx * dt;
    vel.vy += fy * dt;

    // Clamp velocity magnitude
    const vLen = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
    if (vLen > speed) {
      vel.vx = (vel.vx / vLen) * speed;
      vel.vy = (vel.vy / vLen) * speed;
    }

    // Apply velocity to position
    Position.x[batId] = bx! + vel.vx * dt;
    Position.y[batId] = by! + vel.vy * dt;

    // Clamp to home area
    this.clampToHome(batId, parentId!);
  }

  /** Keep bat within a maximum distance of its parent tower */
  private clampToHome(batId: number, parentId: number): void {
    const tx = Position.x[parentId];
    const ty = Position.y[parentId];
    if (tx === undefined || ty === undefined) return;

    const bx = Position.x[batId];
    const by = Position.y[batId];
    const dx = bx! - tx;
    const dy = by! - ty;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = WANDER_RADIUS + 40;

    if (dist > maxDist) {
      Position.x[batId] = tx + (dx / dist) * maxDist;
      Position.y[batId] = ty + (dy / dist) * maxDist;
    }
  }

  // ============================================================
  // Attack — state machine: tryStartAttack → updateAttackMotion
  // ============================================================

  /**
   * Try to acquire a target and start the 4-phase attack animation.
   * Damage is NOT applied here — it fires mid-bite (phase = 0.65).
   */
  private tryStartAttack(world: TowerWorld, batId: number, anim: BatAnimState): void {
    const bx = Position.x[batId];
    const by = Position.y[batId];
    const range = Attack.range[batId];

    const enemies = enemyQuery(world.world);
    let nearestId = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const enemyId = enemies[i]!;
      if (UnitTag.isEnemy[enemyId]! !== 1) continue;
      if (Health.current[enemyId]! <= 0) continue;

      const ex = Position.x[enemyId];
      const ey = Position.y[enemyId];
      const dx = ex! - bx!;
      const dy = ey! - by!;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= range! && dist < nearestDist) {
        nearestDist = dist;
        nearestId = enemyId;
      }
    }

    if (nearestId === 0) return;

    // Compute total attack duration from attackSpeed (attacks/sec).
    const attackSpeed = Attack.attackSpeed[batId];
    const duration = attackSpeed! > 0 ? 1 / attackSpeed! : 1.33;

    // Snapshot start positions
    anim.isAttacking = true;
    anim.attackPhase = 0;
    anim.attackDuration = duration;
    anim.attackTargetId = nearestId;
    anim.attackTargetX = Position.x[nearestId]!;
    anim.attackTargetY = Position.y[nearestId]!;
    anim.swoopStartX = bx!;
    anim.swoopStartY = by!;
    anim.swoopArcHeight = 15 + Math.random() * 15;
    anim.boidReturnX = bx!;  // bat returns to where it launched from
    anim.boidReturnY = by!;
    anim.hasDealtDamage = false;
    anim.trailEmitTimer = 0;

    // Reset attack cooldown — animation will run for `duration` seconds before
    // the bat is willing to attack again (cooldown ticks during animation).
    Attack.cooldownTimer[batId] = duration;

    // Spawn 3-5 lock-on motes that converge to the bat body during the Lock phase
    const moteCount = 3 + ((batId % 3) | 0);  // 3-5, deterministic per bat
    for (let i = 0; i < moteCount; i++) {
      const a = (i / moteCount) * Math.PI * 2;
      const r = 18 + Math.random() * 10;
      this.spawnParticle({
        x: bx! + Math.cos(a) * r,
        y: by! + Math.sin(a) * r,
        vx: 0,
        vy: 0,
        size: 2 + Math.random() * 1.5,
        color: '#7b1fa2',
        alpha: 0,
        life: duration * PHASE_LOCK_END,  // dissipates when Lock phase ends
        maxLife: duration * PHASE_LOCK_END,
        z: 6,
        homeId: batId,
        homeOffsetX: 0,
        homeOffsetY: 0,
      });
    }
  }

  /**
   * Drive bat position and damage events from `attackPhase`.
   * Position is fully scripted (no boid forces during attack).
   */
  private updateAttackMotion(
    world: TowerWorld,
    batId: number,
    anim: BatAnimState,
    dt: number,
  ): void {
    // Advance phase
    const prevPhase = anim.attackPhase;
    anim.attackPhase += dt / anim.attackDuration;

    const p = anim.attackPhase;

    if (p <= PHASE_LOCK_END) {
      // Lock: hover near start, slight upward bob is handled by render hover term
      Position.x[batId] = anim.swoopStartX;
      Position.y[batId] = anim.swoopStartY;

    } else if (p <= PHASE_SWOOP_END) {
      // Swoop: quadratic bezier arc from start → apex → target
      const t = (p - PHASE_LOCK_END) / (PHASE_SWOOP_END - PHASE_LOCK_END);
      const pos = getSwoopPosition(
        t,
        anim.swoopStartX, anim.swoopStartY,
        anim.attackTargetX, anim.attackTargetY,
        anim.swoopArcHeight,
      );
      Position.x[batId] = pos.x;
      Position.y[batId] = pos.y;

      // Emit trail particles every ~0.05s
      anim.trailEmitTimer -= dt;
      if (anim.trailEmitTimer <= 0) {
        anim.trailEmitTimer = 0.05;
        this.spawnParticle({
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          size: 3,
          color: '#7c4dff',
          alpha: 0.5,
          life: 0.3,
          maxLife: 0.3,
          z: 6,
        });
      }

    } else if (p <= PHASE_BITE_END) {
      // Bite: pinned to target position
      Position.x[batId] = anim.attackTargetX;
      Position.y[batId] = anim.attackTargetY;

    } else if (p < 1.0) {
      // Return: lerp from bite position back to launch (boidReturn) point
      const t = (p - PHASE_BITE_END) / (1 - PHASE_BITE_END);
      const eased = t * t * (3 - 2 * t);  // smoothstep
      Position.x[batId] = lerp(anim.attackTargetX, anim.boidReturnX, eased);
      Position.y[batId] = lerp(anim.attackTargetY, anim.boidReturnY, eased);

    } else {
      // Attack done — reset and hand control back to boid.
      Position.x[batId] = anim.boidReturnX;
      Position.y[batId] = anim.boidReturnY;
      anim.isAttacking = false;
      anim.attackPhase = 0;
      anim.attackTargetId = 0;
      anim.hasDealtDamage = false;
      // Reset velocity so post-attack boid motion eases in
      const vel = this.batVelocities.get(batId);
      if (vel) {
        vel.vx = 0;
        vel.vy = 0;
      }
      return;
    }

    // Damage trigger — exactly once, when phase crosses 0.65
    if (
      !anim.hasDealtDamage &&
      prevPhase < PHASE_DAMAGE_TRIGGER &&
      p >= PHASE_DAMAGE_TRIGGER
    ) {
      this.applyBiteDamage(world, batId, anim);
      anim.hasDealtDamage = true;
    }
  }

  /** Apply damage + spawn bite/hit/lifesteal particles. Called once per attack mid-bite. */
  private applyBiteDamage(world: TowerWorld, batId: number, anim: BatAnimState): void {
    const targetId = anim.attackTargetId;
    if (targetId === 0) return;
    // Target may have died during swoop — skip damage but still play visuals at snapshot pos
    const targetAlive =
      Health.current[targetId] !== undefined && Health.current[targetId]! > 0;

    const tx = targetAlive ? Position.x[targetId]! : anim.attackTargetX;
    const ty = targetAlive ? Position.y[targetId]! : anim.attackTargetY;

    if (targetAlive) {
      const damage = Attack.damage[batId];
      applyDamageToTarget(world, targetId, damage!, DamageTypeVal.Magic);

      // Hit flash on target
      if (Visual.hitFlashTimer[targetId] !== undefined) {
        Visual.hitFlashTimer[targetId] = 0.12;
      }
    }

    // 5-8 purple hit-burst particles at bite point
    const burstCount = 5 + ((batId * 3) % 4);  // 5-8 deterministic-ish
    for (let i = 0; i < burstCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 60;
      this.spawnParticle({
        x: tx,
        y: ty,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        size: 2 + Math.random() * 2,
        color: '#7c4dff',
        alpha: 0.9,
        life: 0.3,
        maxLife: 0.3,
        z: 6,
      });
    }

    // 3-5 green lifesteal motes flying from target back toward bat
    if (targetAlive) {
      const moteCount = 3 + ((batId % 3) | 0);
      for (let i = 0; i < moteCount; i++) {
        this.spawnParticle({
          x: tx + (Math.random() - 0.5) * 10,
          y: ty + (Math.random() - 0.5) * 10,
          vx: 0,
          vy: 0,
          size: 2.5,
          color: '#69f0ae',
          alpha: 0.9,
          life: 0.25,
          maxLife: 0.25,
          z: 6,
          homeId: batId,
          homeOffsetX: 0,
          homeOffsetY: 0,
        });
      }
    }
  }

  // ============================================================
  // Particles — internal lightweight system (not ECS entities)
  // ============================================================

  private spawnParticle(p: BatParticle): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push(p);
  }

  private updateParticles(dt: number): void {
    // Iterate backward for safe in-place removal
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Lock motes / lifesteal motes home onto a bat's current position
      if (p.homeId !== undefined) {
        const hx = Position.x[p.homeId];
        const hy = Position.y[p.homeId];
        if (hx === undefined || hy === undefined) {
          // Home gone (bat died) — let particle decay in place
          p.homeId = undefined;
        } else {
          // Ease toward home position
          const tx = hx + (p.homeOffsetX ?? 0);
          const ty = hy + (p.homeOffsetY ?? 0);
          const dx = tx - p.x;
          const dy = ty - p.y;
          // Smooth approach: cover ~80% of remaining distance per second
          const k = 1 - Math.exp(-6 * dt);
          p.x += dx * k;
          p.y += dy * k;
        }
      } else {
        // Free-flying with mild drag
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const drag = Math.pow(0.92, dt * 60);
        p.vx *= drag;
        p.vy *= drag;
      }

      // Alpha curve: fade out over life
      const t = 1 - p.life / p.maxLife;  // 0 → 1
      // Lock motes (home set, purple) fade IN then OUT around mid-life
      if (p.homeId !== undefined && p.color === '#7b1fa2') {
        // Smooth 0 → 0.4 over first half, hold, then dropout via life expiry
        p.alpha = Math.min(0.4, t * 0.8);
      } else {
        p.alpha = Math.max(0, 0.9 * (1 - t));
      }
    }
  }

  private renderParticles(): void {
    if (!this.renderer) return;
    const r = this.renderer;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]!;
      r.push({
        shape: 'circle',
        x: p.x,
        y: p.y,
        size: p.size,
        color: p.color,
        alpha: p.alpha,
        z: p.z,
      });
    }
  }

  // ============================================================
  // Spawning
  // ============================================================

  spawnBat(world: TowerWorld, towerId: number): number {
    const tx = Position.x[towerId];
    const ty = Position.y[towerId];
    if (tx === undefined || ty === undefined) return -1;

    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 80;
    const x = tx + Math.cos(angle) * dist;
    const y = ty + Math.sin(angle) * dist;

    const batId = world.createEntity();

    world.addComponent(batId, Position, { x, y });
    world.addComponent(batId, Health, {
      current: BatTower.batHp[towerId],
      max: BatTower.batHp[towerId],
    });
    world.addComponent(batId, Attack, {
      damage: BatTower.batDamage[towerId],
      attackSpeed: BatTower.batAttackSpeed[towerId],
      range: BatTower.batAttackRange[towerId],
      cooldownTimer: 0,
      damageType: DamageTypeVal.Physical,
      targetId: 0,
      targetSelection: TargetSelectionVal.Nearest,
      attackMode: AttackModeVal.SingleTarget,
      isRanged: 0,  // bats are flying melee (LowAir can attack all ≤ LowAir anyway)
      splashRadius: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      drainPercent: 0,
    });
    world.addComponent(batId, BatSwarmMember, { parentId: towerId });
    // Visual rendering handled in renderBat() (composite body + wings + attack VFX)
    world.addComponent(batId, PlayerOwned, {});
    world.addComponent(batId, Category, { value: CategoryVal.Soldier });
    world.addComponent(batId, Layer, { value: LayerVal.LowAir });

    // Initialize velocity with small random direction
    const velAngle = Math.random() * Math.PI * 2;
    this.batVelocities.set(batId, {
      vx: Math.cos(velAngle) * 30,
      vy: Math.sin(velAngle) * 30,
    });

    // Initialize anim state (idle + attack fields zeroed)
    this.batAnimStates.set(batId, this.createAnimState());

    return batId;
  }

  private createAnimState(): BatAnimState {
    return {
      flapPhase: Math.random() * 2,
      flapSpeed: 3 + Math.random() * 3,       // 3-6 Hz idle
      hoverFreq: 0.3 + Math.random() * 0.5,
      hoverPhase: Math.random() * Math.PI * 2,
      hoverAmp: 3 + Math.random() * 5,        // 3-8px
      isAttacking: false,
      attackPhase: 0,
      attackDuration: 0,
      attackTargetId: 0,
      attackTargetX: 0,
      attackTargetY: 0,
      swoopStartX: 0,
      swoopStartY: 0,
      swoopArcHeight: 0,
      boidReturnX: 0,
      boidReturnY: 0,
      hasDealtDamage: false,
      trailEmitTimer: 0,
    };
  }

  private getOrCreateAnim(batId: number): BatAnimState {
    let anim = this.batAnimStates.get(batId);
    if (!anim) {
      anim = this.createAnimState();
      this.batAnimStates.set(batId, anim);
    }
    return anim;
  }

  // ============================================================
  // Rendering — composite shape with attack-phase variation
  // ============================================================

  /**
   * Render a single bat. Each phase modulates:
   *   - wing flap frequency & open angle
   *   - body scale & alpha
   *   - extra shapes: fangs (Bite), green halo (Return)
   * Design ref: design/12-visual-effects.md §9.2, §9.4
   */
  private renderBat(batId: number): void {
    const x = Position.x[batId];
    const y = Position.y[batId];
    if (x === undefined || y === undefined) return;

    const parentId = BatSwarmMember.parentId[batId];
    const size = (parentId !== undefined ? BatTower.batSize[parentId] : undefined) ?? 10;

    const anim = this.getOrCreateAnim(batId);

    // Determine attack-state modifiers
    let flapMul = 1.0;       // multiplies wing angle amplitude
    let flapSpeedMul = 1.0;  // multiplies flap Hz
    let bodyScale = 1.0;
    let bodyAlpha = 0.85;
    let bodyColor = '#2d2d2d';
    let halo = 0;            // green halo alpha (0 = none)
    let showFangs = false;
    // Suppress hover bob during locked-on/bite phases to look "fixed on target"
    let hoverActive = true;

    if (anim.isAttacking) {
      const p = anim.attackPhase;

      if (p <= PHASE_LOCK_END) {
        // Lock: flap accelerates 1.0 → 1.3, wings open wider, body darkens
        const t = p / PHASE_LOCK_END;
        flapMul = 1.0 + 0.3 * t;
        flapSpeedMul = 1.0 + 1.2 * t;  // 1x → 2.2x
        bodyAlpha = 0.85 - 0.2 * t;    // 0.85 → 0.65
        bodyColor = '#4a148c';
      } else if (p <= PHASE_SWOOP_END) {
        // Swoop: high flap, body scale 1 → 1.15
        const t = (p - PHASE_LOCK_END) / (PHASE_SWOOP_END - PHASE_LOCK_END);
        flapMul = 1.3 + 0.2 * t;       // 1.3 → 1.5
        flapSpeedMul = 2.2 + 0.6 * t;  // 2.2 → 2.8
        bodyScale = 1.0 + 0.15 * t;
        bodyAlpha = 0.85;
        bodyColor = '#7c4dff';         // purple swoop tint
      } else if (p <= PHASE_BITE_END) {
        // Bite: max wing burst, body scale 1.15 → 0.9
        const t = (p - PHASE_SWOOP_END) / (PHASE_BITE_END - PHASE_SWOOP_END);
        // Wings briefly snap open then settle
        flapMul = 1.5 + 0.3 * Math.sin(t * Math.PI);  // bell curve up to 1.8
        flapSpeedMul = 2.8;
        bodyScale = 1.15 - 0.25 * t;
        bodyAlpha = 0.95;
        bodyColor = '#9c27b0';
        showFangs = true;
        hoverActive = false;
      } else {
        // Return: wing returns to idle, body scales back, green halo fades out
        const t = (p - PHASE_BITE_END) / (1 - PHASE_BITE_END);
        flapMul = 1.5 - 0.5 * t;       // 1.5 → 1.0
        flapSpeedMul = 2.8 - 1.8 * t;  // 2.8 → 1.0
        bodyScale = 0.9 + 0.1 * t;
        bodyAlpha = 0.85;
        bodyColor = '#2d2d2d';
        halo = 0.2 * (1 - t);          // 0.2 → 0 fade
      }
    }

    // Update flap phase using effective flap speed (frame-locked)
    const effectiveFlapSpeed = anim.flapSpeed * flapSpeedMul;
    anim.flapPhase += effectiveFlapSpeed * (1 / 60);

    // Hover (sinusoidal vertical bob) — suppressed during bite
    const hoverY = hoverActive
      ? y + Math.sin(this.frameCounter * 0.016 * anim.hoverFreq + anim.hoverPhase) * anim.hoverAmp
      : y;

    // Wing angle: base 30°-70° (±40° sinusoidal) multiplied by attack flapMul
    const wingAngle = Math.sin(anim.flapPhase * Math.PI * 2) * 40 * flapMul;
    const wingOpen = (30 + wingAngle) * flapMul;  // wider during attack
    const wingRad = wingOpen * Math.PI / 180;
    const wingArm = size * 0.5 * bodyScale;
    const wingSize = size * 0.7 * bodyScale;

    const r = this.renderer!;

    // Green lifesteal halo (Return phase only) — drawn under body so body shows clearly
    if (halo > 0) {
      r.push({
        shape: 'circle',
        x,
        y: hoverY,
        size: size * 1.6 * bodyScale,
        color: '#69f0ae',
        alpha: halo,
        z: 5,
      });
    }

    // Body (small circle) — LowAir layer
    r.push({
      shape: 'circle',
      x,
      y: hoverY,
      size: size * 0.6 * bodyScale,
      color: bodyColor,
      alpha: bodyAlpha,
      z: 6,
    });

    // Left wing (triangle)
    r.push({
      shape: 'triangle',
      x: x - Math.cos(wingRad) * wingArm,
      y: hoverY - Math.sin(wingRad) * wingArm,
      size: wingSize,
      color: bodyColor,
      alpha: bodyAlpha * 0.85,
      z: 6,
    });

    // Right wing (triangle)
    r.push({
      shape: 'triangle',
      x: x + Math.cos(wingRad) * wingArm,
      y: hoverY - Math.sin(wingRad) * wingArm,
      size: wingSize,
      color: bodyColor,
      alpha: bodyAlpha * 0.85,
      z: 6,
    });

    // Fangs (Bite phase only): two small red triangles flanking the body
    if (showFangs) {
      const fangSize = size * 0.35;
      const fangOffset = size * 0.25;
      r.push({
        shape: 'triangle',
        x: x - fangOffset,
        y: hoverY + size * 0.15,
        size: fangSize,
        color: '#ff1744',
        alpha: 1.0,
        z: 7,  // above body
      });
      r.push({
        shape: 'triangle',
        x: x + fangOffset,
        y: hoverY + size * 0.15,
        size: fangSize,
        color: '#ff1744',
        alpha: 1.0,
        z: 7,
      });
    }
  }

  /** Remove animation entries for bats that no longer exist */
  private cleanupStaleAnimations(activeBats: readonly number[]): void {
    const activeSet = new Set(activeBats);
    for (const batId of this.batAnimStates.keys()) {
      if (!activeSet.has(batId)) {
        this.batAnimStates.delete(batId);
      }
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  /** Called by HealthSystem when a bat is killed — starts replenish timer on parent */
  onBatDied(batId: number): void {
    if (!this.world) return;
    const parentId = BatSwarmMember.parentId[batId];
    if (parentId === undefined || parentId === 0) return;
    if (!hasComponent(this.world.world, BatTower, parentId)) return;

    BatTower.replenishTimer[parentId] = BatTower.replenishCooldown[parentId]!;
  }

  /** Upgrade bat tower stats when tower is levelled up */
  upgradeBatTowerStats(towerId: number, towerLevel: number): void {
    if (!this.world) return;

    const baseBats = 4;
    let extraBats = 0;
    if (towerLevel >= 2) extraBats++;
    if (towerLevel >= 4) extraBats++;
    BatTower.maxBats[towerId] = baseBats + extraBats;

    const levelBonus = (towerLevel - 1) * 0.15;
    BatTower.batDamage[towerId] = Math.floor(10 * (1 + levelBonus));

    BatTower.batHp[towerId] = 30 + (towerLevel - 1) * 10;

    // Update existing bats
    const bats = batQuery(this.world.world);
    for (let i = 0; i < bats.length; i++) {
      const batId = bats[i]!;
      if (BatSwarmMember.parentId[batId] !== towerId) continue;

      Attack.damage[batId] = BatTower.batDamage[towerId];

      const maxHp = BatTower.batHp[towerId];
      const ratio = Health.max[batId]! > 0 ? Health.current[batId]! / Health.max[batId]! : 1;
      Health.max[batId] = maxHp;
      Health.current[batId] = Math.ceil(maxHp * ratio);
    }
  }

  // ============================================================
  // Internal helpers
  // ============================================================

  /** Remove velocity entries for bats that no longer exist */
  private cleanupStaleVelocities(activeBats: readonly number[]): void {
    const activeSet = new Set(activeBats);
    for (const batId of this.batVelocities.keys()) {
      if (!activeSet.has(batId)) {
        this.batVelocities.delete(batId);
      }
    }
  }
}

// ============================================================
// Pure math helpers
// ============================================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Quadratic bezier swoop: start → apex (lifted by arcHeight) → end.
 * Apex sits above the midpoint of (start, end) so the bat arcs over the field.
 */
function getSwoopPosition(
  t: number,
  startX: number, startY: number,
  endX: number, endY: number,
  arcHeight: number,
): { x: number; y: number } {
  const midX = (startX + endX) / 2;
  const midY = Math.min(startY, endY) - arcHeight;
  const omt = 1 - t;
  return {
    x: omt * omt * startX + 2 * omt * t * midX + t * t * endX,
    y: omt * omt * startY + 2 * omt * t * midY + t * t * endY,
  };
}
