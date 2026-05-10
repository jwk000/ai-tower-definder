/**
 * 伤害应用工具 — 系统间共享的护甲/MR减伤逻辑
 *
 * 所有伤害站点通过此函数统一应用设计文档的减伤公式，
 * 替换原有的直接 Health.current -= damage 模式。
 *
 * 对应设计文档:
 * - design/05-combat-system.md §1 伤害公式
 */

import type { TowerWorld } from '../core/World.js';
import { Health, DamageTypeVal } from '../core/components.js';
import { calcPhysicalDamage, calcMagicDamage } from './combatFormulas.js';

/**
 * 对目标实体应用伤害，自动计算护甲/魔抗减伤。
 *
 * @param world     ECS世界实例
 * @param targetId  目标实体ID
 * @param rawDamage 原始攻击力（减伤前）
 * @param damageType 伤害类型 (DamageTypeVal.Physical=0, Magic=1)
 * @returns 实际造成的伤害值（减伤后）
 */
export function applyDamageToTarget(
  world: TowerWorld,
  targetId: number,
  rawDamage: number,
  damageType: number,
): number {
  if (rawDamage <= 0) return 0;

  const armor = Health.armor[targetId] ?? 0;
  const magicResist = Health.magicResist[targetId] ?? 0;

  let actualDamage: number;
  if (damageType === DamageTypeVal.Magic) {
    actualDamage = calcMagicDamage(rawDamage, magicResist);
  } else {
    // 默认物理伤害
    actualDamage = calcPhysicalDamage(rawDamage, armor);
  }

  // 确保不为负（极端高护甲时）
  actualDamage = Math.max(0, actualDamage);

  // 应用伤害
  const current = Health.current[targetId] ?? 0;
  Health.current[targetId] = current - actualDamage;

  return actualDamage;
}

/**
 * 对目标实体应用生命回复（治疗不经过减伤公式）。
 *
 * @param world     ECS世界实例
 * @param targetId  目标实体ID
 * @param healAmount 治疗量
 * @returns 实际治疗量（不超过 maxHP - current）
 */
export function applyHealToTarget(
  world: TowerWorld,
  targetId: number,
  healAmount: number,
): number {
  if (healAmount <= 0) return 0;

  const current = Health.current[targetId] ?? 0;
  const max = Health.max[targetId] ?? current;

  const missing = max - current;
  const actualHeal = Math.min(healAmount, Math.max(0, missing));

  Health.current[targetId] = current + actualHeal;
  return actualHeal;
}
