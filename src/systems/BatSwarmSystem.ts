import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
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
  ShapeVal,
  DamageTypeVal,
  TargetSelectionVal,
  AttackModeVal,
} from '../core/components.js';
import type { WeatherSystem } from './WeatherSystem.js';

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
// Bitecs queries — pre-built for frame reuse
// ============================================================

/** All bats (with attack ability, health, and player ownership) */
const batQuery = defineQuery([BatSwarmMember, Position, Attack, Health, PlayerOwned]);

/** Bat towers */
const towerQuery = defineQuery([BatTower, Tower, Position]);

/** Enemies (for target selection) */
const enemyQuery = defineQuery([Position, Health, UnitTag]);

// ============================================================
// BatSwarmSystem
// ============================================================

export class BatSwarmSystem implements System {
  readonly name = 'BatSwarmSystem';

  /** Accumulating frame counter (for wander angle variation) */
  private frameCounter = 0;

  /** Per-bat velocity (vx, vy) — persistent boid state not stored in components */
  private batVelocities = new Map<number, { vx: number; vy: number }>();

  /** Current world reference — set each frame in update() */
  private world: TowerWorld | null = null;

  constructor(private weatherSystem?: WeatherSystem) {}

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

    // ── Pass 3: bat behavior (boid + attack) ────────────────
    for (let i = 0; i < bats.length; i++) {
      const batId = bats[i]!;
      if (Health.current[batId]! <= 0) continue;

      // Boid movement
      this.applyBoidForces(world, batId, bats, dt);

      // Attack
      if (Attack.cooldownTimer[batId]! > 0) {
        Attack.cooldownTimer[batId]! -= dt;
      }
      if (Attack.cooldownTimer[batId]! <= 0 && this.canBatAttack()) {
        this.tryAttack(world, batId);
      }
    }

    // Clean up velocities for bats no longer in the world
    this.cleanupStaleVelocities(bats);
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
  // Attack
  // ============================================================

  private tryAttack(world: TowerWorld, batId: number): void {
    const bx = Position.x[batId];
    const by = Position.y[batId];
    const range = Attack.range[batId];
    const damage = Attack.damage[batId];

    const enemies = enemyQuery(world.world);
    let nearestId = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < enemies.length; i++) {
      const enemyId = enemies[i]!;
      // Filter: only living enemies
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

    // Reset attack cooldown
    const attackSpeed = Attack.attackSpeed[batId];
    Attack.cooldownTimer[batId] = attackSpeed! > 0 ? 1 / attackSpeed! : 0;

    // Deal damage
    Health.current[nearestId]! -= damage!;

    // Hit flash
    if (Visual.hitFlashTimer[nearestId] !== undefined) {
      Visual.hitFlashTimer[nearestId] = 0.12;
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
      splashRadius: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      drainPercent: 0,
    });
    world.addComponent(batId, BatSwarmMember, { parentId: towerId });
    world.addComponent(batId, Visual, {
      shape: ShapeVal.Circle,
      colorR: 0x2d,
      colorG: 0x2d,
      colorB: 0x2d,
      size: BatTower.batSize[towerId],
      alpha: 0.9,
    });
    world.addComponent(batId, PlayerOwned, {});
    world.addComponent(batId, Category, { value: CategoryVal.Soldier });
    world.addComponent(batId, Layer, { value: LayerVal.LowAir });

    // Initialize velocity with small random direction
    const velAngle = Math.random() * Math.PI * 2;
    this.batVelocities.set(batId, {
      vx: Math.cos(velAngle) * 30,
      vy: Math.sin(velAngle) * 30,
    });

    return batId;
  }

  // ============================================================
  // Public API
  // ============================================================

  /** Called by HealthSystem when a bat is killed — starts replenish timer on parent */
  onBatDied(batId: number): void {
    if (!this.world) return;
    const parentId = BatSwarmMember.parentId[batId];
    if (parentId === undefined || parentId === 0) return;
    if (!hasComponent(this.world.world, parentId, BatTower)) return;

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
