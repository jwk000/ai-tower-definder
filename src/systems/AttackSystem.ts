import { TowerWorld, type System, defineQuery } from '../core/World.js';
import {
  Position,
  Attack,
  Tower,
  Projectile,
  Visual,
  Health,
  LightningBolt,
  LaserBeam,
  UnitTag,
  ShapeVal,
  Layer,
  LayerVal,
  DamageTypeVal,
  MissileCharge,
  TargetingMark,
} from '../core/components.js';
import { TowerType } from '../types/index.js';
import type { MapConfig } from '../types/index.js';
import { TOWER_CONFIGS } from '../data/gameData.js';
import { Sound, type SfxKey } from '../utils/Sound.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { evaluateMissileTarget } from './MissileTargeting.js';
import { RenderSystem } from './RenderSystem.js';
import type { WeatherSystem } from './WeatherSystem.js';

// ============================================================
// TowerType numeric ID → enum mapping (ui8 values)
// ============================================================

const TOWER_TYPE_BY_ID: TowerType[] = [
  TowerType.Arrow,     // 0
  TowerType.Cannon,    // 1
  TowerType.Ice,       // 2
  TowerType.Lightning, // 3
  TowerType.Laser,     // 4
  TowerType.Bat,       // 5
  TowerType.Missile,   // 6
  TowerType.Vine,      // 7
  TowerType.Command,   // 8
  TowerType.Ballista,  // 9
];

// Tower type → sound key lookup (index matches towerTypeVal)
const TOWER_SHOOT_SOUNDS: SfxKey[] = [
  'tower_arrow',     // 0
  'tower_cannon',    // 1
  'tower_ice',       // 2
  'tower_lightning', // 3
  'tower_laser',     // 4
  'tower_bat',       // 5
  'tower_missile',   // 6
  'tower_arrow',     // 7  vine (reuse arrow sound)
  'tower_arrow',     // 8  command (no attack, placeholder)
  'tower_arrow',     // 9  ballista (reuse arrow sound)
];

// ============================================================
// Projectile visual presets (replaces PROJECTILE_CFG)
// ============================================================

interface ProjectileVisual {
  speed: number;
  shape: number;   // ShapeVal
  colorR: number;
  colorG: number;
  colorB: number;
  size: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const ARROW_COLOR    = hexToRgb('#ff3333');
const CANNON_COLOR   = hexToRgb('#222222');
const ICE_COLOR      = hexToRgb('#81d4fa');
const LIGHTNING_COLOR = hexToRgb('#fff176');
const LASER_COLOR    = hexToRgb('#e040fb');
const BAT_COLOR      = hexToRgb('#7c4dff');

const BALLISTA_COLOR = hexToRgb('#8d6e63');

const PROJ_VISUAL: Record<number, ProjectileVisual> = {
  0: { speed: 420, shape: ShapeVal.Arrow,    colorR: ARROW_COLOR[0],    colorG: ARROW_COLOR[1],    colorB: ARROW_COLOR[2],    size: 24 },
  1: { speed: 280, shape: ShapeVal.Circle,   colorR: CANNON_COLOR[0],   colorG: CANNON_COLOR[1],   colorB: CANNON_COLOR[2],   size: 16 },
  2: { speed: 350, shape: ShapeVal.Diamond,  colorR: ICE_COLOR[0],      colorG: ICE_COLOR[1],      colorB: ICE_COLOR[2],      size: 12 },
  3: { speed: 600, shape: ShapeVal.Triangle, colorR: LIGHTNING_COLOR[0], colorG: LIGHTNING_COLOR[1], colorB: LIGHTNING_COLOR[2], size: 10 },
  4: { speed: 500, shape: ShapeVal.Circle,   colorR: LASER_COLOR[0],    colorG: LASER_COLOR[1],    colorB: LASER_COLOR[2],    size: 8 },
  5: { speed: 350, shape: ShapeVal.Triangle, colorR: BAT_COLOR[0],      colorG: BAT_COLOR[1],      colorB: BAT_COLOR[2],      size: 10 },
  6: { speed: 280, shape: ShapeVal.Arrow,    colorR: 0xff,              colorG: 0x17,              colorB: 0x44,              size: 24 },
  7: { speed: 280, shape: ShapeVal.Circle,   colorR: 0x66,              colorG: 0xbb,              colorB: 0x6a,              size: 8 },
  8: { speed: 0,   shape: ShapeVal.Circle,   colorR: 0,                 colorG: 0,                 colorB: 0,                 size: 0 },
  9: { speed: 500, shape: ShapeVal.Arrow,    colorR: BALLISTA_COLOR[0], colorG: BALLISTA_COLOR[1], colorB: BALLISTA_COLOR[2], size: 30 },
};

// ============================================================
// Queries
// ============================================================

const towerQuery = defineQuery([Position, Attack, Tower]);
const potentialTargetQuery = defineQuery([Position, Health, UnitTag]);
const chargingQuery = defineQuery([MissileCharge]);
const targetingMarkQuery = defineQuery([TargetingMark, Position]);

// ============================================================
// Missile charging constants
// ============================================================

const MISSILE_CHARGE_TIME = 0.6; // seconds of charging before launch

// ============================================================
// AttackSystem — towers find nearest enemy and fire
// ============================================================

export class AttackSystem implements System {
  readonly name = 'AttackSystem';

  constructor(
    private weatherSystem?: WeatherSystem,
    private map?: MapConfig,
  ) {}

  update(world: TowerWorld, dt: number): void {
    // Clean up orphaned targeting marks (tower destroyed during charging)
    this.cleanupOrphanedTargetingMarks(world);

    const towers = towerQuery(world.world);

    // Pre-collect valid enemies for efficiency
    const enemyList: number[] = [];
    const allMatches = potentialTargetQuery(world.world);
    for (const eid of allMatches) {
      if (UnitTag.isEnemy[eid]! === 1 && Health.current[eid]! > 0) {
        enemyList.push(eid);
      }
    }

    for (const eid of towers) {
      // Tick cooldown
      Attack.cooldownTimer[eid]! -= dt;
      if (Attack.cooldownTimer[eid]! > 0) continue;

      // Bat tower only attacks in Night/Fog weather
      const towerTypeVal = Tower.towerType[eid]!;
      if (towerTypeVal === 5 && this.weatherSystem && !this.weatherSystem.canAttackBat()) {
        continue;
      }

      // Missile tower: grid-scoring target selection with charging phase
      if (towerTypeVal === 6) {
        this.handleMissileTower(world, eid, enemyList, dt);
        continue;
      }

      // Find nearest enemy within range
      const tx = Position.x[eid]!;
      const ty = Position.y[eid]!;
      const range = Attack.range[eid]!;
      const attackerLayer = Layer.value[eid] ?? LayerVal.Ground;
      const attackerIsRanged = Attack.isRanged[eid] === 1;
      let nearestId = 0;
      let nearestDist = Infinity;

      for (const enemyId of enemyList) {
        // Layer reachability check
        const targetLayer = Layer.value[enemyId] ?? LayerVal.Ground;
        if (!this.canAttackLayer(attackerLayer, targetLayer, attackerIsRanged)) continue;

        const ex = Position.x[enemyId]!;
        const ey = Position.y[enemyId]!;
        const dx = ex - tx;
        const dy = ey - ty;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= range && dist < nearestDist) {
          nearestDist = dist;
          nearestId = enemyId;
        }
      }

      if (nearestId === 0) continue;

      // Reset cooldown
      Attack.cooldownTimer[eid]! = 1 / Attack.attackSpeed[eid]!;
      Attack.targetId[eid] = nearestId;

      Sound.play(TOWER_SHOOT_SOUNDS[towerTypeVal] ?? 'tower_shoot');

      const level = Tower.level[eid]!;
      const towerTypeEnum = TOWER_TYPE_BY_ID[towerTypeVal]!;

      if (towerTypeEnum === TowerType.Lightning) {
        this.doLightningAttack(world, eid, nearestId, level);
      } else if (towerTypeEnum === TowerType.Laser) {
        const enemiesInRange: Array<{ id: number; dist: number }> = [];
        for (const enemyId of enemyList) {
          if (enemyId === nearestId) {
            enemiesInRange.push({ id: enemyId, dist: nearestDist });
            continue;
          }
          const ex = Position.x[enemyId]!;
          const ey = Position.y[enemyId]!;
          const dx = ex - tx;
          const dy = ey - ty;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= range) {
            enemiesInRange.push({ id: enemyId, dist });
          }
        }
        enemiesInRange.sort((a, b) => a.dist - b.dist);
        this.doLaserAttack(world, eid, enemiesInRange, level);
      } else {
        this.spawnProjectile(world, eid, nearestId, towerTypeVal);
      }
    }
  }

  // ---- Orphan cleanup ----

  private cleanupOrphanedTargetingMarks(world: TowerWorld): void {
    const marks = targetingMarkQuery(world.world);
    if (marks.length === 0) return;

    // Collect all targeting mark IDs referenced by charging towers
    const referencedMarks = new Set<number>();
    const charging = chargingQuery(world.world);
    for (const towerId of charging) {
      const markId = MissileCharge.markEntityId[towerId];
      if (markId !== undefined && markId !== 0) {
        referencedMarks.add(markId);
      }
    }

    // Destroy targeting marks not referenced by any charging tower
    for (const markId of marks) {
      if (!referencedMarks.has(markId)) {
        world.destroyEntity(markId);
      }
    }
  }

  // ---- Missile Tower: charging + targeting mark + launch ----

  private handleMissileTower(
    world: TowerWorld,
    towerId: number,
    enemyList: number[],
    dt: number,
  ): void {
    // Check if tower is currently charging
    const chargeElapsed = MissileCharge.chargeElapsed[towerId];

    if (chargeElapsed !== undefined && chargeElapsed >= 0) {
      // Tower is charging — tick charge timer
      MissileCharge.chargeElapsed[towerId] = chargeElapsed + dt;

      const totalCharge = MissileCharge.chargeTime[towerId]!;
      if (MissileCharge.chargeElapsed[towerId]! >= totalCharge) {
        // Charge complete — launch missile
        const targetX = MissileCharge.targetX[towerId]!;
        const targetY = MissileCharge.targetY[towerId]!;
        const markId = MissileCharge.markEntityId[towerId]!;

        // Remove charge component from tower
        world.removeComponent(towerId, MissileCharge);

        // Reset cooldown
        Attack.cooldownTimer[towerId]! = 1 / Attack.attackSpeed[towerId]!;

        // Create marker entity at target position (if not already exists)
        let markEntityId = markId;
        if (markId === 0) {
          markEntityId = world.createEntity();
          world.addComponent(markEntityId, Position, { x: targetX, y: targetY });
        }

        // Launch the missile
        this.spawnMissileProjectile(world, towerId, markEntityId, targetX, targetY);

        // Play launch sound
        Sound.play('tower_missile');
      }
      return;
    }

    // Tower is not charging — check if ready to fire
    // (cooldown already checked by caller)

    // Evaluate best target position
    const missileResult = evaluateMissileTarget(world, towerId, enemyList, this.map!);
    if (!missileResult) return;

    const { targetX, targetY, row, col } = missileResult;

    // Create red targeting mark entity
    const towerCfg = TOWER_CONFIGS[TowerType.Missile];
    const blastRadius = towerCfg?.splashRadius ?? 120;

    const markId = world.createEntity();
    world.addComponent(markId, Position, { x: targetX, y: targetY });
    world.addComponent(markId, TargetingMark, {
      blastRadius: blastRadius * 0.5, // outer ring = 50% of blast radius
      pulsePhase: 0,
      ringRotation: 0,
    });
    // Add visual for rendering
    world.addComponent(markId, Visual, {
      shape: ShapeVal.Cross,
      colorR: 0xff,
      colorG: 0x17,
      colorB: 0x44,
      size: blastRadius,
      alpha: 0.9,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
    // Targeting marks go in AboveGrid layer (below entities, above ground)
    world.addComponent(markId, Layer, { value: LayerVal.AboveGrid });

    // Start charging on the tower
    world.addComponent(towerId, MissileCharge, {
      chargeTime: MISSILE_CHARGE_TIME,
      chargeElapsed: 0,
      targetX,
      targetY,
      markEntityId: markId,
    });
  }

  // ---- Projectile ----

  private spawnProjectile(
    world: TowerWorld,
    towerId: number,
    targetId: number,
    towerTypeVal: number,
  ): void {
    const visual = PROJ_VISUAL[towerTypeVal];
    if (!visual) return;

    const damage = Attack.damage[towerId];
    const fromX = Position.x[towerId];
    const fromY = Position.y[towerId];
    const towerTypeEnum = TOWER_TYPE_BY_ID[towerTypeVal]!;
    const towerCfg = TOWER_CONFIGS[towerTypeEnum];

    const pid = world.createEntity();

    world.addComponent(pid, Position, { x: fromX, y: fromY });

    world.addComponent(pid, Projectile, {
      speed: visual.speed,
      damage,
      damageType: Attack.damageType[towerId],
      targetId,
      sourceId: towerId,
      fromX,
      fromY,
      shape: visual.shape,
      colorR: visual.colorR,
      colorG: visual.colorG,
      colorB: visual.colorB,
      size: visual.size,
      splashRadius: towerCfg?.splashRadius ?? 0,
      stunDuration: towerCfg?.stunDuration ?? 0,
      slowPercent: towerCfg?.slowPercent ?? 0,
      slowMaxStacks: towerCfg?.slowMaxStacks ?? 0,
      freezeDuration: towerCfg?.freezeDuration ?? 0,
      chainCount: towerCfg?.chainCount ?? 0,
      chainRange: towerCfg?.chainRange ?? 0,
      chainDecay: towerCfg?.chainDecay ?? 0,
      sourceTowerType: towerTypeVal,
    });

    world.addComponent(pid, Visual, {
      shape: visual.shape,
      colorR: visual.colorR,
      colorG: visual.colorG,
      colorB: visual.colorB,
      size: visual.size,
      alpha: 1,
    });

    // Inherit layer from source entity for render z-ordering (方案 B: 弹道随来源层级)
    const sourceLayer = Layer.value[towerId] ?? LayerVal.Ground;
    world.addComponent(pid, Layer, { value: sourceLayer });
  }

  private spawnMissileProjectile(
    world: TowerWorld,
    towerId: number,
    targetMarkId: number,
    targetX: number,
    targetY: number,
  ): void {
    const visual = PROJ_VISUAL[6]; // missile visual
    if (!visual) return;

    const damage = Attack.damage[towerId]!;
    const fromX = Position.x[towerId]!;
    const fromY = Position.y[towerId]!;
    const towerCfg = TOWER_CONFIGS[TowerType.Missile];

    const pid = world.createEntity();
    world.addComponent(pid, Position, { x: fromX, y: fromY });
    world.addComponent(pid, Projectile, {
      speed: visual.speed,
      damage,
      damageType: Attack.damageType[towerId],
      targetId: targetMarkId,
      sourceId: towerId,
      fromX,
      fromY,
      shape: visual.shape,
      colorR: visual.colorR,
      colorG: visual.colorG,
      colorB: visual.colorB,
      size: visual.size,
      splashRadius: towerCfg?.splashRadius ?? 120,
      stunDuration: 0,
      slowPercent: 0,
      slowMaxStacks: 0,
      freezeDuration: 0,
      chainCount: 0,
      chainRange: 0,
      chainDecay: 0,
      sourceTowerType: 6,
    });

    // Store target coordinates for parabolic trajectory in fromX/fromY
    // (ProjectileSystem uses these to calculate the parabolic arc)
    // We use a different approach: store them in the projectile Position

    world.addComponent(pid, Visual, {
      shape: visual.shape,
      colorR: visual.colorR,
      colorG: visual.colorG,
      colorB: visual.colorB,
      size: visual.size,
      alpha: 1,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });

    // Inherit layer from source entity for render z-ordering
    const sourceLayer = Layer.value[towerId] ?? LayerVal.Ground;
    world.addComponent(pid, Layer, { value: sourceLayer });
  }

  // ---- Damage ----

  private getDamage(eid: number): number {
    return Attack.damage[eid]!;
  }

  // ---- Layer reachability ----

  /**
   * Check whether an attacker at `attackerLayer` can target a unit at `targetLayer`.
   * - 近战 (isRanged=false): only AboveGrid + Ground
   * - 远程 (isRanged=true): AboveGrid + Ground + LowAir
   * - LowAir attackers: can attack all ≤ LowAir
   */
  private canAttackLayer(attackerLayer: number, targetLayer: number, isRanged: boolean): boolean {
    // Ground-attached attacker (towers, soldiers)
    if (attackerLayer === LayerVal.Ground || attackerLayer === LayerVal.AboveGrid) {
      if (isRanged) {
        return targetLayer <= LayerVal.LowAir;
      }
      return targetLayer <= LayerVal.AboveGrid;
    }
    // LowAir attacker (bats, flying enemies)
    if (attackerLayer === LayerVal.LowAir) {
      return targetLayer <= LayerVal.LowAir;
    }
    // Unknown layer — allow by default
    return true;
  }

  // ---- Lightning Chain ----

  private doLightningAttack(
    world: TowerWorld,
    towerId: number,
    primaryId: number,
    level: number,
  ): void {
    const config = TOWER_CONFIGS[TowerType.Lightning];
    if (!config) return;

    const baseDamage = this.getDamage(towerId);
    const chainCount = (config.chainCount ?? 3) + (level - 1);
    const chainDecay = config.chainDecay ?? 0.2;
    const chainRange = config.chainRange ?? 120;

    const hit = new Set<number>();
    let dmg = baseDamage;
    let sourceId = towerId;
    let targetId = primaryId;

    for (let hop = 0; hop < chainCount; hop++) {
      if (hit.has(targetId)) break;
      hit.add(targetId);

      // Deal damage
      if (Health.current[targetId]! > 0) {
        const dmgType = Attack.damageType[towerId] ?? DamageTypeVal.Physical;
        applyDamageToTarget(world, targetId, dmg, dmgType);
      }

      // Hit flash
      Visual.hitFlashTimer[targetId] = 0.12;

      // Lightning bolt visual
      this.spawnLightningBolt(world, sourceId, targetId, hop);

      // Advance source to current target for next bolt
      sourceId = targetId;

      // Find next chain target
      if (hop < chainCount - 1) {
        dmg *= (1 - chainDecay);

        const originX = Position.x[targetId]!;
        const originY = Position.y[targetId]!;
        let nearestId = 0;
        let nearestDist = chainRange;

        const allMatches = potentialTargetQuery(world.world);
        for (const eid of allMatches) {
          if (hit.has(eid)) continue;
          if (UnitTag.isEnemy[eid]! !== 1) continue;
          if (Health.current[eid]! <= 0) continue;

          const ex = Position.x[eid]!;
          const ey = Position.y[eid]!;
          const dx = ex - originX;
          const dy = ey - originY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestId = eid;
          }
        }
        targetId = nearestId !== 0 ? nearestId : targetId;
      }
    }
  }

  private spawnLightningBolt(
    world: TowerWorld,
    sourceId: number,
    targetId: number,
    chainIndex: number,
  ): void {
    const bid = world.createEntity();
    world.addComponent(bid, LightningBolt, {
      sourceId,
      targetId,
      damage: 0,
      duration: 0.5,
      elapsed: 0,
      chainIndex,
    });
  }

  // ---- Laser Beam ----

  private getBeamCount(level: number): number {
    if (level >= 5) return 3;
    if (level >= 3) return 2;
    return 1;
  }

  private doLaserAttack(
    world: TowerWorld,
    towerId: number,
    enemiesInRange: Array<{ id: number; dist: number }>,
    level: number,
  ): void {
    const beamCount = Math.min(this.getBeamCount(level), enemiesInRange.length);
    const damage = this.getDamage(towerId);

    for (let i = 0; i < beamCount; i++) {
      const targetId = enemiesInRange[i]!.id;

      const beamId = world.createEntity();
      world.addComponent(beamId, LaserBeam, {
        sourceId: towerId,
        targetId,
        damage,
        duration: 1.0,
        elapsed: 0,
      });
    }
  }
}
