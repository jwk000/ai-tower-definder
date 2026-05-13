/**
 * v3.0 卡牌 Roguelike — 关内出卡能量管理器
 *
 * 设计文档:
 *   - design/25-card-roguelike-refactor.md §4 能量系统
 *   - design/14-acceptance-criteria.md §3.3
 *
 * 与 EconomySystem.energy 旧字段语义不同：
 *   - 旧 energy 由能量塔被动产出，本系统不再使用
 *   - 新 EnergySystem.current 由 startWave() 阶段性回能，战斗中无被动恢复
 *
 * 事件驱动（非每帧 tick），故不实现 System 接口。
 */

export const ENERGY_MAX_DEFAULT = 10;
export const ENERGY_MAX_PERMANENT_UPGRADED = 12;
export const ENERGY_REGEN_PER_WAVE = 5;
export const ENERGY_INITIAL = 5;

export class EnergySystem {
  current: number;
  max: number;
  regenPerWave: number;

  constructor(opts: { max?: number; regenPerWave?: number; initial?: number } = {}) {
    this.max = opts.max ?? ENERGY_MAX_DEFAULT;
    this.regenPerWave = opts.regenPerWave ?? ENERGY_REGEN_PER_WAVE;
    this.current = Math.min(this.max, opts.initial ?? ENERGY_INITIAL);
  }

  /** 波次开始：恢复 regenPerWave 点，不超过 max。返回实际恢复量。 */
  startWave(): number {
    const before = this.current;
    this.current = Math.min(this.max, this.current + this.regenPerWave);
    return this.current - before;
  }

  /** 尝试消耗能量。能量足够返回 true 并扣减，不够返回 false 不扣减。 */
  spend(amount: number): boolean {
    if (amount < 0) return false;
    if (this.current < amount) return false;
    this.current -= amount;
    return true;
  }

  /** 是否能负担 amount 点消耗（不修改状态，用于 UI 灰显判断）。 */
  canAfford(amount: number): boolean {
    return amount >= 0 && this.current >= amount;
  }

  /**
   * 额外回能（秘境事件 / 特殊法术卡触发），受 max 上限约束。
   * 返回实际增加量。
   */
  addBonus(amount: number): number {
    if (amount <= 0) return 0;
    const before = this.current;
    this.current = Math.min(this.max, this.current + amount);
    return this.current - before;
  }

  /** 永久升级提升能量上限。设计 §4.1：仅放大顶，当前能量不自动补到新上限。 */
  setMax(newMax: number): void {
    if (newMax < 0) return;
    this.max = newMax;
    if (this.current > this.max) this.current = this.max;
  }
}
