// EnemyAttackSystem — bitecs migration
// Enemy targeting and projectile spawning for enemies with Attack component.

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import {
  Position,
  Movement,
  Health,
  Attack,
  UnitTag,
  Projectile,
  Visual,
  ShapeVal,
  MoveModeVal,
  DamageTypeVal,
} from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { Sound } from '../utils/Sound.js';
import { getEffectiveValue } from './BuffSystem.js';

// ---- Constants ----

const ENEMY_PROJECTILE_SPEED = 200; // px/s

// ---- Module-level bitecs queries ----

/** Enemies capable of attacking: have position, movement, attack, and unit tag */
const attackerQuery = defineQuery([Position, Movement, Attack, UnitTag]);

// ============================================================
// System
// ============================================================

/**
 * EnemyAttackSystem (P4 R7 后):
 * 攻击逻辑（target selection + 执行 + Movement.moveMode 切换）已迁移至 BT 节点
 * EnemyMeleeAttackNode / EnemyRangedAttackNode（design/23 §0.5）。
 *
 * 本系统当前职责: 仅作为 ECS system 占位入口（保留 BuildSystem 依赖 + 未来扩展）。
 * 实际副作用入口为模块级 export doEnemyAttack（供 BT 节点调用）。
 *
 * cooldown tick 由 AISystem 负责（line 130-133）。
 */
export class EnemyAttackSystem implements System {
  readonly name = 'EnemyAttackSystem';

  update(_world: TowerWorld, _dt: number): void {
    // BT v2.0 全权接管，update 不干预（P4 R7）
  }
}

/**
 * 敌人攻击副作用入口（design/23 §0.5 `enemy_melee_attack` / `enemy_ranged_attack` 节点依赖）。
 *
 * 服务 enemy_basic（melee）/ enemy_boss（melee）/ enemy_ranged（ranged）。读取
 * Attack.damage[sourceId] + BuffSystem.getEffectiveValue 计算有效伤害；canAttackBuildings=true
 * spawn 红色 Circle projectile + Sound.play('mage_attack'); canAttackBuildings=false 直接
 * applyDamageToTarget Physical 伤害 + Sound.play('enemy_attack')。
 *
 * 与 EnemyAttackSystem.doAttack 私有方法等价（R7 后私有路径将清零，此函数为唯一真理源）。
 */
export function doEnemyAttack(
  world: TowerWorld,
  sourceId: number,
  targetId: number,
  fromX: number,
  fromY: number,
  canAttackBuildings: boolean,
): void {
  const rawDamage = Attack.damage[sourceId]!;
  const buff = getEffectiveValue(sourceId, 'atk');
  const damage = (rawDamage + buff.absolute) * (1 + buff.percent / 100);

  if (canAttackBuildings) {
    Sound.play('mage_attack');
    spawnEnemyProjectile(world, sourceId, targetId, damage, fromX, fromY);
  } else {
    Sound.play('enemy_attack');
    applyDamageToTarget(world, targetId, damage, DamageTypeVal.Physical, sourceId);
  }
}

/**
 * 敌人远程攻击的弹道投射物（红色 Circle / 200 px/s / Physical）。
 *
 * 与 EnemyAttackSystem.spawnProjectile 私有方法等价；R7 后私有路径清零，此函数为唯一真理源。
 */
function spawnEnemyProjectile(
  world: TowerWorld,
  sourceId: number,
  targetId: number,
  damage: number,
  fromX: number,
  fromY: number,
): void {
  const pid = world.createEntity();

  world.addComponent(pid, Position, { x: fromX, y: fromY });

  world.addComponent(pid, Projectile, {
    speed: ENEMY_PROJECTILE_SPEED,
    damage,
    damageType: DamageTypeVal.Physical,
    targetId,
    sourceId,
    fromX,
    fromY,
    shape: ShapeVal.Circle,
    colorR: 0xff,
    colorG: 0x52,
    colorB: 0x52,
    size: 10,
    splashRadius: 0,
    stunDuration: 0,
    slowPercent: 0,
    slowMaxStacks: 0,
    freezeDuration: 0,
    chainCount: 0,
    chainRange: 0,
    chainDecay: 0,
    isChain: 0,
    chainIndex: 0,
    drainAmount: 0,
  });

  world.addComponent(pid, Visual, {
    shape: ShapeVal.Circle,
    colorR: 0xff,
    colorG: 0x52,
    colorB: 0x52,
    size: 10,
    alpha: 1.0,
    outline: 0,
    hitFlashTimer: 0,
    idlePhase: 0,
  });
}
