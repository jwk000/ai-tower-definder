/**
 * 战斗公式 — 纯函数库
 * 
 * 从设计文档提取的公式实现，供各系统调用。
 * 对应设计文档:
 * - design/05-combat-system.md §1 伤害公式
 * - design/05-combat-system.md §2 攻速公式
 * - design/05-combat-system.md §3 移速公式
 * - design/05-combat-system.md §4 数值锚点
 */

// ---- 常数 ----

/** 护甲减伤常数: 100护甲 = 50%减伤 */
const ARMOR_CONSTANT = 100;
/** 魔抗减伤常数 */
const MR_CONSTANT = 100;
/** 攻速加成上限: 200% = 最高3倍基础攻速 */
const ATK_SPEED_CAP = 2.0;
/** 暴击率上限 */
const CRIT_CAP = 0.8;
/** 基础暴击倍率 */
const BASE_CRIT_MULT = 1.5;
/** 移速下限比例: 不低于基础移速的20% */
const SPEED_FLOOR_RATIO = 0.2;

// ---- 伤害公式 ----

/**
 * 物理伤害减伤系数
 * @param armor 护甲值
 * @returns 减伤系数 (0-1)，0=完全免伤，1=无减伤
 */
export function physicalReduction(armor: number): number {
  return 1 - armor / (armor + ARMOR_CONSTANT);
}

/**
 * 魔法伤害减伤系数
 * @param magicResist 魔抗值
 * @returns 减伤系数 (0-1)
 */
export function magicReduction(magicResist: number): number {
  return 1 - magicResist / (magicResist + MR_CONSTANT);
}

/**
 * 计算基础物理伤害（经护甲减伤后）
 * @param atk 攻击力
 * @param armor 目标护甲
 */
export function calcPhysicalDamage(atk: number, armor: number): number {
  return atk * physicalReduction(armor);
}

/**
 * 计算基础魔法伤害（经魔抗减伤后）
 * @param atk 攻击力
 * @param magicResist 目标魔抗
 */
export function calcMagicDamage(atk: number, magicResist: number): number {
  return atk * magicReduction(magicResist);
}

/**
 * 计算最终伤害
 * 最终伤害 = 基础伤害 × (1 + 伤害加成%) × (1 - 伤害减免%) × 暴击倍率
 * @param baseDamage 基础伤害（已经过护甲/MR减伤）
 * @param damageBonus 伤害加成百分比 (0 = 无加成, 0.5 = +50%)
 * @param damageReduction 伤害减免百分比 (0 = 无减免)
 * @param critMultiplier 暴击倍率 (1.0 = 无暴击, 1.5 = 基础暴击)
 */
export function calcFinalDamage(
  baseDamage: number,
  damageBonus: number = 0,
  damageReduction: number = 0,
  critMultiplier: number = 1.0,
): number {
  return baseDamage * (1 + damageBonus) * (1 - damageReduction) * critMultiplier;
}

/**
 * 获取暴击倍率
 * @param critChance 暴击率 (0-1, 上限0.8)
 * @param critBonus 额外暴伤加成 (0 = 1.5倍)
 * @returns [暴击倍率, 是否暴击]
 */
export function getCritMultiplier(critChance: number, critBonus: number = 0): [number, boolean] {
  const clampedChance = Math.min(critChance, CRIT_CAP);
  const didCrit = Math.random() < clampedChance;
  const multiplier = didCrit ? BASE_CRIT_MULT + critBonus : 1.0;
  return [multiplier, didCrit];
}

// ---- 攻速公式 ----

/**
 * 计算实际攻击间隔
 * 实际间隔 = 基础间隔 / (1 + 攻速加成%)
 * 攻速加成上限 200%（即最高3倍攻速）
 * @param baseInterval 基础攻击间隔 (秒)
 * @param speedBonus 攻速加成 (0 = 无加成, 1.0 = +100%)
 * @returns 实际攻击间隔 (秒)
 */
export function calcAttackCooldown(baseInterval: number, speedBonus: number = 0): number {
  const effectiveBonus = Math.min(speedBonus, ATK_SPEED_CAP);
  return baseInterval / (1 + effectiveBonus);
}

/**
 * 根据攻速（次/秒）计算攻击间隔
 * @param attackSpeed 攻速 (次/秒)
 * @returns 攻击间隔 (秒)
 */
export function attackSpeedToInterval(attackSpeed: number): number {
  return 1 / attackSpeed;
}

// ---- 移速公式 ----

/**
 * 计算实际移动速度
 * 实际移速 = 基础移速 × (1 + 移速加成%) × (1 - 减速%)
 * 移速下限 = 基础移速 × 20%
 * @param baseSpeed 基础移速 (px/s)
 * @param speedBonus 移速加成 (0 = 无加成, 0.5 = +50%)
 * @param slowPercent 减速百分比 (0 = 无减速, 0.8 = 减速80%)
 * @returns 实际移速 (px/s)
 */
export function calcMovementSpeed(
  baseSpeed: number,
  speedBonus: number = 0,
  slowPercent: number = 0,
): number {
  const boosted = baseSpeed * (1 + speedBonus);
  const slowed = boosted * (1 - slowPercent);
  const floor = baseSpeed * SPEED_FLOOR_RATIO;
  return Math.max(slowed, floor);
}

/**
 * 计算减速因子
 * @param slowPercent 单层减速百分比 (20 = 20%)
 * @param stacks 当前层数
 * @param maxStacks 最大层数
 * @returns 总减速百分比 (0-1)
 */
export function calcSlowPercent(
  slowPercent: number,
  stacks: number,
  maxStacks: number,
): number {
  const actualStacks = Math.min(stacks, maxStacks);
  return (slowPercent / 100) * actualStacks;
}

// ---- 溅射 / 链击公式 ----

/**
 * 溅射伤害 (60% 主伤害)
 * @param mainDamage 主目标伤害
 * @param splashRatio 溅射比率 (默认 0.6)
 */
export function calcSplashDamage(mainDamage: number, splashRatio: number = 0.6): number {
  return mainDamage * splashRatio;
}

/**
 * 链击衰减伤害
 * @param baseDamage 基础伤害
 * @param decay 每跳衰减率 (0.2 = 20%)
 * @param hop 当前跳数 (0-based)
 */
export function calcChainHopDamage(baseDamage: number, decay: number, hop: number): number {
  return baseDamage * Math.pow(1 - decay, hop);
}

// ---- Buff / 属性公式 ----

/**
 * 应用 Buff 效果到基础属性
 * @param baseValue 基础值
 * @param absoluteBonus 绝对加成
 * @param percentBonus 百分比加成 (0.5 = +50%)
 */
export function applyBuffToAttribute(
  baseValue: number,
  absoluteBonus: number = 0,
  percentBonus: number = 0,
): number {
  return baseValue * (1 + percentBonus) + absoluteBonus;
}

/**
 * Buff 叠加逻辑
 * @param currentStacks 当前层数
 * @param addedStacks 新增层数
 * @param maxStacks 最大层数
 * @param freezeThreshold 冰冻触发阈值 (通常 = maxStacks)
 * @returns [新层数, 是否触发冰冻]
 */
export function applyBuffStacks(
  currentStacks: number,
  addedStacks: number,
  maxStacks: number,
  freezeThreshold: number = maxStacks,
): { newStacks: number; triggersFreeze: boolean } {
  const newStacks = Math.min(currentStacks + addedStacks, maxStacks);
  const triggersFreeze = newStacks >= freezeThreshold;
  return { newStacks, triggersFreeze };
}

// ---- 难度曲线公式 ----

/**
 * 波次难度缩放 — HP倍率
 * @param waveNumber 当前波次
 */
export function waveHpMultiplier(waveNumber: number): number {
  if (waveNumber <= 20) {
    if (waveNumber <= 3) return 0.6 + (waveNumber - 1) * 0.1;
    if (waveNumber <= 8) return 1.0 + (waveNumber - 4) * 0.06;
    if (waveNumber <= 15) return 1.4 + (waveNumber - 9) * 0.057;
    return 1.9 + (waveNumber - 16) * 0.12;
  }
  // 20波以后每波+15%
  const base = waveHpMultiplier(20);
  return base * Math.pow(1.15, waveNumber - 20);
}

/**
 * 波次难度缩放 — 速度倍率
 * @param waveNumber 当前波次
 * @param cap 速度上限 (默认200%)
 */
export function waveSpeedMultiplier(waveNumber: number, cap: number = 2.0): number {
  const raw = 1.0 + Math.max(0, waveNumber - 9) * 0.03;
  return Math.min(raw, cap);
}

/**
 * 波次难度缩放 — 护甲递增
 * @param waveNumber 当前波次
 */
export function waveArmorBonus(waveNumber: number): number {
  if (waveNumber <= 3) return 0;
  if (waveNumber <= 8) return 3;
  if (waveNumber <= 15) return 6;
  if (waveNumber <= 20) return 13;
  // 20+ 每波 +1.5
  return 13 + (waveNumber - 20) * 1.5;
}

/**
 * 波次难度缩放 — 魔抗递增
 * @param waveNumber 当前波次
 */
export function waveMrBonus(waveNumber: number): number {
  if (waveNumber <= 3) return 0;
  if (waveNumber <= 8) return 2;
  if (waveNumber <= 15) return 4;
  if (waveNumber <= 20) return 9;
  // 20+ 每波 +1.0
  return 9 + (waveNumber - 20) * 1.0;
}
