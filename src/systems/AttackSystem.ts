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
import type { WeatherSystem } from './WeatherSystem.js';
import { getEffectiveValue } from './BuffSystem.js';

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

// Tower type → sound key lookup (index matches towerTypeVal).
// Exported for BT nodes (SpawnProjectileTowerNode et al.) which must play
// the matching SFX when firing — same as AttackSystem.update line 211.
export const TOWER_SHOOT_SOUNDS: SfxKey[] = [
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

    // P4 R5+R6 (design/23 §0.7): 6 塔（basic/cannon/ice/lightning/laser/bat）+ missile 攻击逻辑
    // 已全部迁移至 BT 节点（SpawnProjectileTowerNode / LightningChainNode / LaserBeamNode
    // / SelectMissileTargetNode + ChargeAttackNode + LaunchMissileProjectileNode）。
    // AttackSystem.update 本体退化为：仅 orphan cleanup + missile 蓄力遗留入口。
    // cooldown tick 由 AISystem 负责，发射 cooldown 由各 BT 节点自行设置。

    const towers = towerQuery(world.world);

    const validEnemies: number[] = [];
    const allMatches = potentialTargetQuery(world.world);
    for (const eid of allMatches) {
      if (UnitTag.isEnemy[eid]! === 1 && Health.current[eid]! > 0) {
        validEnemies.push(eid);
      }
    }

    for (const eid of towers) {
      const towerTypeVal = Tower.towerType[eid]!;
      if (towerTypeVal === 6) {
        // Missile: BT v1.0 已接管 (P3 R5)，handleMissileTower 已薄化为 no-op，保留入口兼容
        this.handleMissileTower(world, eid, validEnemies, dt);
      }
      // 其余 6 塔: BT v2.0 全权接管，update 不干预（P4 R5+R6）
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

    // Also preserve marks targeted by active missile projectiles
    for (let eid = 1; eid < Projectile.sourceTowerType.length; eid++) {
      if (Projectile.sourceTowerType[eid] !== 6) continue;
      const tgt = Projectile.targetId[eid];
      if (tgt !== undefined && tgt !== 0) {
        referencedMarks.add(tgt);
      }
    }

    // Destroy targeting marks not referenced by any charging tower or active missile
    for (const markId of marks) {
      if (!referencedMarks.has(markId)) {
        world.destroyEntity(markId);
      }
    }
  }

  // ---- Missile Tower: charging + targeting mark + launch ----

  /**
   * @deprecated 自 P3 R5 起 BT v1.0 三节点 (select_missile_target /
   * charge_attack / launch_missile_projectile) 完整接管导弹塔行为，
   * 此方法薄化为 no-op 保持 line 158-161 dispatch 结构兼容（避免删除
   * 引入级联改动）。R6 验证全绿后可整体删除 dispatch + 此方法。
   */
  private handleMissileTower(
    _world: TowerWorld,
    _towerId: number,
    _enemyList: number[],
    _dt: number,
  ): void {}

  // ---- Projectile ----

  private spawnProjectile(
    world: TowerWorld,
    towerId: number,
    targetId: number,
    towerTypeVal: number,
  ): void {
    const visual = PROJ_VISUAL[towerTypeVal];
    if (!visual) return;

    const damage = this.getDamage(towerId);
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
    spawnMissileProjectile(world, towerId, targetMarkId, targetX, targetY);
  }

  // ---- Damage ----

  private getDamage(eid: number): number {
    const raw = Attack.damage[eid]!;
    const buff = getEffectiveValue(eid, 'atk');
    return (raw + buff.absolute) * (1 + buff.percent / 100);
  }

  // ---- Layer reachability ----

  /**
   * Check whether an attacker at `attackerLayer` can target a unit at `targetLayer`.
   *
   * 对应设计 design/18-layer-system.md §5.2 攻击目标可达性矩阵:
   * - 近战 (isRanged=false): only AboveGrid + Ground
   * - 远程 (isRanged=true): AboveGrid + Ground + LowAir
   * - LowAir attackers (蝙蝠、飞行敌): can attack all ≤ LowAir
   * - Abyss/BelowGrid/Space: 默认放行 (未来扩展点)
   *
   * P1-#12: 提为 static 便于纯函数单测覆盖。
   */
  static canAttackLayer(attackerLayer: number, targetLayer: number, isRanged: boolean): boolean {
    if (attackerLayer === LayerVal.Ground || attackerLayer === LayerVal.AboveGrid) {
      if (targetLayer === LayerVal.Ground || targetLayer === LayerVal.AboveGrid) return true;
      if (targetLayer === LayerVal.LowAir) return isRanged;
      return false;
    }
    if (attackerLayer === LayerVal.LowAir) {
      return targetLayer === LayerVal.Ground
        || targetLayer === LayerVal.AboveGrid
        || targetLayer === LayerVal.LowAir;
    }
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

      // Sound: only play hit sound on first hop to avoid noise overload
      if (hop === 0) {
        Sound.play('lightning_hit');
      }

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

/**
 * 计算 entity 的有效攻击力（基础 Attack.damage + BuffSystem absolute/percent 加成）。
 *
 * 公式：damage = (Attack.damage[eid] + buff.absolute) * (1 + buff.percent / 100)
 * 由 LaunchMissileProjectileNode 和 AttackSystem 共用，与 AttackSystem.getDamage
 * 私有方法等价（R5 后 AttackSystem 路径删除，此函数为唯一真理源）。
 */
export function getEffectiveDamage(eid: number): number {
  const raw = Attack.damage[eid]!;
  const buff = getEffectiveValue(eid, 'atk');
  return (raw + buff.absolute) * (1 + buff.percent / 100);
}

/**
 * 生成导弹塔抛物线投射物（design/23 §0.5 launch_missile_projectile 节点核心副作用）。
 *
 * 与 AttackSystem.spawnMissileProjectile 私有方法等价：使用 PROJ_VISUAL[6] 视觉配置，
 * 读取 BuffSystem 加成后的有效攻击力，挂载 Projectile + Visual + Layer 组件。
 * targetMarkId 指向 ChargeAttackNode spawn 的 TargetingMark 实体，ProjectileSystem
 * 据此计算抛物线终点并触发 AOE 爆炸（splashRadius 默认 120px / Missile 塔 130px）。
 */
export function spawnMissileProjectile(
  world: TowerWorld,
  towerId: number,
  targetMarkId: number,
  _targetX: number,
  _targetY: number,
): void {
  const visual = PROJ_VISUAL[6];
  if (!visual) return;

  const damage = getEffectiveDamage(towerId);
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

  const sourceLayer = Layer.value[towerId] ?? LayerVal.Ground;
  world.addComponent(pid, Layer, { value: sourceLayer });
}

// ============================================================
// P4 R1 — 非-missile 塔攻击工具函数（BT 节点依赖）
// ============================================================
//
// 这 3 个函数将 AttackSystem 类的私有 spawnProjectile / doLightningAttack /
// doLaserAttack 提取为模块级 export，供 BT 节点（SpawnProjectileTowerNode /
// LightningChainNode / LaserBeamNode）调用。语义与原私有方法等价（damage 公式 /
// 弹道视觉 / chain 衰减 / laser 多束逻辑保持一致），仅去除 `this` 依赖以便从
// BehaviorTree.ts 直接 import。R6 完成后，AttackSystem.update 中的私有方法
// 调用将被薄化为 no-op dispatch（类比 P3 R5 handleMissileTower）。

/**
 * 生成通用塔弹道投射物（design/23 §0.5 `spawn_projectile_tower` 节点核心副作用）。
 *
 * 服务 basic/cannon/ice/bat 4 塔。读 PROJ_VISUAL[towerTypeVal] 视觉配置 + TOWER_CONFIGS
 * 修饰属性（splashRadius / slowPercent / stunDuration / freezeDuration / chainCount /
 * chainRange / chainDecay），挂载 Projectile + Visual + Layer 组件。命中时由
 * ProjectileSystem 执行 splash/slow/stun/freeze/chain 副作用。
 *
 * 与 AttackSystem.spawnProjectile 私有方法等价（R5 后私有路径将清零，此函数为唯一真理源）。
 */
export function spawnProjectile(
  world: TowerWorld,
  towerId: number,
  targetId: number,
  towerTypeVal: number,
): void {
  const visual = PROJ_VISUAL[towerTypeVal];
  if (!visual) return;

  const damage = getEffectiveDamage(towerId);
  const fromX = Position.x[towerId]!;
  const fromY = Position.y[towerId]!;
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
    outline: 0,
    hitFlashTimer: 0,
    idlePhase: 0,
  });

  // Inherit layer from source entity for render z-ordering (design/18 §5.2)
  const sourceLayer = Layer.value[towerId] ?? LayerVal.Ground;
  world.addComponent(pid, Layer, { value: sourceLayer });
}

/**
 * 执行闪电链攻击（design/23 §0.5 `lightning_chain` 节点核心副作用）。
 *
 * 服务 lightning 塔。chainCount = baseChain + (level-1) 跳，每跳衰减 chainDecay，
 * 每跳 spawn LightningBolt entity（视觉 0.5s）+ applyDamageToTarget 直接造成伤害。
 * 首跳 Sound.play('lightning_hit') 避免噪音过载。
 *
 * 与 AttackSystem.doLightningAttack 私有方法等价。
 */
export function doLightningAttack(
  world: TowerWorld,
  towerId: number,
  primaryId: number,
  level: number,
): void {
  const config = TOWER_CONFIGS[TowerType.Lightning];
  if (!config) return;

  const baseDamage = getEffectiveDamage(towerId);
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

    if ((Health.current[targetId] ?? 0) > 0) {
      const dmgType = Attack.damageType[towerId] ?? DamageTypeVal.Physical;
      applyDamageToTarget(world, targetId, dmg, dmgType);
    }

    Visual.hitFlashTimer[targetId] = 0.12;

    // LightningBolt entity（视觉 0.5s，RenderSystem 消费）
    const bid = world.createEntity();
    world.addComponent(bid, LightningBolt, {
      sourceId,
      targetId,
      damage: 0,
      duration: 0.5,
      elapsed: 0,
      chainIndex: hop,
    });

    if (hop === 0) Sound.play('lightning_hit');

    sourceId = targetId;

    // 寻找下一跳目标
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
        if ((Health.current[eid] ?? 0) <= 0) continue;

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

/**
 * 扫描指定塔射程内的活敌，返回按距离升序排列的 {id, dist} 列表（design/23 §0.5 工具函数）。
 *
 * 服务 BT 层 LaserBeamNode（多束自扫）及 AttackSystem 内部 update / doLightningAttack 链跳目标搜索。
 * 用 potentialTargetQuery（Position + Health + UnitTag）+ UnitTag.isEnemy === 1 + Health.current > 0 过滤。
 */
export function findEnemiesInRange(
  world: TowerWorld,
  towerId: number,
  range: number,
): Array<{ id: number; dist: number }> {
  const tx = Position.x[towerId]!;
  const ty = Position.y[towerId]!;
  const result: Array<{ id: number; dist: number }> = [];
  const allMatches = potentialTargetQuery(world.world);
  for (const eid of allMatches) {
    if (UnitTag.isEnemy[eid]! !== 1) continue;
    if ((Health.current[eid] ?? 0) <= 0) continue;
    const ex = Position.x[eid]!;
    const ey = Position.y[eid]!;
    const dx = ex - tx;
    const dy = ey - ty;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= range) {
      result.push({ id: eid, dist });
    }
  }
  result.sort((a, b) => a.dist - b.dist);
  return result;
}

/**
 * 执行激光多束攻击（design/23 §0.5 `laser_beam` 节点核心副作用）。
 *
 * 服务 laser 塔。L1-2: 1 束 / L3-4: 2 束 / L5: 3 束（getLaserBeamCount）；
 * 取 enemiesInRange 按距离排序前 N 束，每束 spawn LaserBeam entity（视觉 1.0s + DOT）。
 * 实际持续伤害由 LaserBeamSystem 周期 tick。
 *
 * 与 AttackSystem.doLaserAttack 私有方法等价。
 */
export function getLaserBeamCount(level: number): number {
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

export function doLaserAttack(
  world: TowerWorld,
  towerId: number,
  enemiesInRange: Array<{ id: number; dist: number }>,
  level: number,
): void {
  const beamCount = Math.min(getLaserBeamCount(level), enemiesInRange.length);
  const damage = getEffectiveDamage(towerId);

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
