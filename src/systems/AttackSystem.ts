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
} from '../core/components.js';
import { TowerType } from '../types/index.js';
import { TOWER_CONFIGS } from '../data/gameData.js';
import { Sound } from '../utils/Sound.js';
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

const PROJ_VISUAL: Record<number, ProjectileVisual> = {
  0: { speed: 420, shape: ShapeVal.Arrow,    colorR: ARROW_COLOR[0],    colorG: ARROW_COLOR[1],    colorB: ARROW_COLOR[2],    size: 24 },
  1: { speed: 280, shape: ShapeVal.Circle,   colorR: CANNON_COLOR[0],   colorG: CANNON_COLOR[1],   colorB: CANNON_COLOR[2],   size: 16 },
  2: { speed: 350, shape: ShapeVal.Diamond,  colorR: ICE_COLOR[0],      colorG: ICE_COLOR[1],      colorB: ICE_COLOR[2],      size: 12 },
  3: { speed: 600, shape: ShapeVal.Triangle, colorR: LIGHTNING_COLOR[0], colorG: LIGHTNING_COLOR[1], colorB: LIGHTNING_COLOR[2], size: 10 },
  4: { speed: 500, shape: ShapeVal.Circle,   colorR: LASER_COLOR[0],    colorG: LASER_COLOR[1],    colorB: LASER_COLOR[2],    size: 8 },
  5: { speed: 350, shape: ShapeVal.Triangle, colorR: BAT_COLOR[0],      colorG: BAT_COLOR[1],      colorB: BAT_COLOR[2],      size: 10 },
};

// ============================================================
// Queries
// ============================================================

const towerQuery = defineQuery([Position, Attack, Tower]);
const potentialTargetQuery = defineQuery([Position, Health, UnitTag]);

// ============================================================
// AttackSystem — towers find nearest enemy and fire
// ============================================================

export class AttackSystem implements System {
  readonly name = 'AttackSystem';

  constructor(
    private weatherSystem?: WeatherSystem,
  ) {}

  update(world: TowerWorld, dt: number): void {
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

      // Find nearest enemy within range
      const tx = Position.x[eid]!;
      const ty = Position.y[eid]!;
      const range = Attack.range[eid]!;
      let nearestId = 0;
      let nearestDist = Infinity;

      for (const enemyId of enemyList) {
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

      Sound.play('tower_shoot');

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
    });

    world.addComponent(pid, Visual, {
      shape: visual.shape,
      colorR: visual.colorR,
      colorG: visual.colorG,
      colorB: visual.colorB,
      size: visual.size,
      alpha: 1,
    });
  }

  // ---- Damage ----

  private getDamage(eid: number): number {
    return Attack.damage[eid]!;
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
        Health.current[targetId]! -= dmg;
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
