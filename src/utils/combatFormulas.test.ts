/**
 * 战斗公式测试
 * 
 * 对应设计文档:
 * - design/05-combat-system.md §1 伤害公式
 * - design/05-combat-system.md §2 攻速公式
 * - design/05-combat-system.md §3 移速公式
 * - design/05-combat-system.md §5 难度曲线
 * - design/03-unit-data.md §7 波次缩放
 */
import { describe, it, expect } from 'vitest';
import {
  physicalReduction,
  magicReduction,
  calcPhysicalDamage,
  calcMagicDamage,
  calcFinalDamage,
  calcAttackCooldown,
  attackSpeedToInterval,
  calcMovementSpeed,
  calcSlowPercent,
  calcSplashDamage,
  calcChainHopDamage,
  applyBuffToAttribute,
  applyBuffStacks,
  waveHpMultiplier,
  waveSpeedMultiplier,
  waveArmorBonus,
  waveMrBonus,
} from './combatFormulas.js';

describe('护甲减伤公式', () => {
  it('0护甲 → 100%伤害 (无减伤)', () => {
    expect(physicalReduction(0)).toBeCloseTo(1.0);
    expect(calcPhysicalDamage(100, 0)).toBeCloseTo(100);
  });

  it('100护甲 → 50%减伤 (护甲常数=100)', () => {
    expect(physicalReduction(100)).toBeCloseTo(0.5);
    expect(calcPhysicalDamage(100, 100)).toBeCloseTo(50);
  });

  it('200护甲 → 66.7%减伤', () => {
    expect(physicalReduction(200)).toBeCloseTo(1/3, 2);
    expect(calcPhysicalDamage(100, 200)).toBeCloseTo(33.33, 1);
  });

  it('300护甲 → 75%减伤', () => {
    expect(physicalReduction(300)).toBeCloseTo(0.25);
    expect(calcPhysicalDamage(100, 300)).toBeCloseTo(25);
  });

  it('护甲为0时无除零错误', () => {
    expect(physicalReduction(0)).toBe(1);
  });

  it('护甲不会导致负伤害', () => {
    expect(calcPhysicalDamage(1, 99999)).toBeGreaterThan(0);
  });
});

describe('魔抗减伤公式', () => {
  it('0魔抗 → 100%魔法伤害', () => {
    expect(magicReduction(0)).toBeCloseTo(1.0);
    expect(calcMagicDamage(50, 0)).toBeCloseTo(50);
  });

  it('100魔抗 → 50%减伤', () => {
    expect(magicReduction(100)).toBeCloseTo(0.5);
  });

  it('物理与魔法减伤独立', () => {
    // 50护甲但0魔抗: 物理有减伤，魔法无减伤
    expect(physicalReduction(50)).toBeCloseTo(2/3, 2);
    expect(magicReduction(0)).toBeCloseTo(1.0);
  });
});

describe('最终伤害公式', () => {
  it('无加成时最终伤害=基础伤害', () => {
    expect(calcFinalDamage(100, 0, 0, 1)).toBe(100);
  });

  it('+50%伤害加成', () => {
    expect(calcFinalDamage(100, 0.5, 0, 1)).toBe(150);
  });

  it('30%伤害减免', () => {
    expect(calcFinalDamage(100, 0, 0.3, 1)).toBe(70);
  });

  it('2倍暴击', () => {
    expect(calcFinalDamage(50, 0, 0, 2.0)).toBe(100);
  });

  it('组合加成: +50% × 30%减免 × 1.5暴击', () => {
    // 100 × 1.5 × 0.7 × 1.5 = 157.5
    expect(calcFinalDamage(100, 0.5, 0.3, 1.5)).toBeCloseTo(157.5);
  });

  it('伤害不可为负（减免100%仍为0）', () => {
    expect(calcFinalDamage(100, 0, 1.0, 1)).toBe(0);
    expect(calcFinalDamage(100, 0, 1.5, 1)).toBeLessThanOrEqual(0);
  });
});

describe('攻速公式', () => {
  it('基础间隔 = 1/攻速', () => {
    // 箭塔 L1: 攻速 1.0/s → 间隔 1.0s
    expect(attackSpeedToInterval(1.0)).toBeCloseTo(1.0);
    // 炮塔 L1: 攻速 0.4/s → 间隔 2.5s
    expect(attackSpeedToInterval(0.4)).toBeCloseTo(2.5);
    // 冰塔 L1: 攻速 1.2/s → 间隔 0.833s
    expect(attackSpeedToInterval(1.2)).toBeCloseTo(0.833, 2);
  });

  it('间隔 = 基础间隔 / (1 + 攻速加成)', () => {
    // 基础间隔 1.0s, +100%攻速 → 0.5s
    expect(calcAttackCooldown(1.0, 1.0)).toBeCloseTo(0.5);
    // 基础间隔 2.5s (炮塔), +100%攻速 → 1.25s
    expect(calcAttackCooldown(2.5, 1.0)).toBeCloseTo(1.25);
  });

  it('攻速加成上限 200% → 间隔=基础/3', () => {
    // 即使 +300%，实际只算 200%
    expect(calcAttackCooldown(1.0, 3.0)).toBeCloseTo(1/3, 3);
    expect(calcAttackCooldown(1.0, 2.0)).toBeCloseTo(1/3, 3);
  });

  it('无攻速加成 → 间隔不变', () => {
    expect(calcAttackCooldown(1.0, 0)).toBeCloseTo(1.0);
  });
});

describe('移速公式', () => {
  it('基础移速无修改', () => {
    expect(calcMovementSpeed(80, 0, 0)).toBe(80);
  });

  it('+50%移速加成', () => {
    expect(calcMovementSpeed(80, 0.5, 0)).toBe(120);
  });

  it('50%减速', () => {
    expect(calcMovementSpeed(80, 0, 0.5)).toBe(40);
  });

  it('+50%加成 + 50%减速 互相抵消', () => {
    // 80 × 1.5 × 0.5 = 60
    expect(calcMovementSpeed(80, 0.5, 0.5)).toBeCloseTo(60);
  });

  it('移速下限: 不低于基础移速的20%', () => {
    // 80 × 0.2 = 16
    expect(calcMovementSpeed(80, 0, 0.99)).toBeCloseTo(16);
    expect(calcMovementSpeed(100, 0, 0.99)).toBeCloseTo(20);
  });

  it('多重减速不会超过下限', () => {
    // 即使减速200%，也不低于20%下限
    expect(calcMovementSpeed(50, 0, 0.9)).toBe(10); // 50 × 0.2 = 10
  });

  it('移速下限对高速单位也适用', () => {
    // 150 × 0.2 = 30
    expect(calcMovementSpeed(150, 0, 0.95)).toBeCloseTo(30);
  });
});

describe('减速层数计算', () => {
  it('单层 20% 减速', () => {
    expect(calcSlowPercent(20, 1, 5)).toBeCloseTo(0.2);
  });

  it('满层 5 × 20% = 100%减速', () => {
    expect(calcSlowPercent(20, 5, 5)).toBeCloseTo(1.0);
  });

  it('超层数不会溢出 maxStacks', () => {
    expect(calcSlowPercent(20, 10, 5)).toBeCloseTo(1.0);
  });

  it('0层 = 0%减速', () => {
    expect(calcSlowPercent(20, 0, 5)).toBe(0);
  });
});

describe('溅射伤害', () => {
  it('默认60%溅射', () => {
    expect(calcSplashDamage(100)).toBe(60);
    expect(calcSplashDamage(50)).toBe(30);
  });

  it('自定义溅射比例', () => {
    expect(calcSplashDamage(100, 0.8)).toBe(80);
    expect(calcSplashDamage(100, 0.3)).toBe(30);
  });
});

describe('链击衰减', () => {
  it('第1跳: 基础伤害', () => {
    expect(calcChainHopDamage(100, 0.2, 0)).toBe(100);
  });

  it('第2跳: 衰减20%', () => {
    expect(calcChainHopDamage(100, 0.2, 1)).toBeCloseTo(80);
  });

  it('第3跳: 再衰减20%', () => {
    expect(calcChainHopDamage(100, 0.2, 2)).toBeCloseTo(64);
  });

  it('第4跳: 累积衰减', () => {
    expect(calcChainHopDamage(100, 0.2, 3)).toBeCloseTo(51.2, 1);
  });

  it('衰减率为0时无衰减', () => {
    expect(calcChainHopDamage(100, 0, 10)).toBe(100);
  });

  it('衰减>0时伤害永不为0（极限趋近）', () => {
    expect(calcChainHopDamage(100, 0.5, 20)).toBeGreaterThan(0);
  });
});

describe('Buff属性应用', () => {
  it('无Buff时返回基础值', () => {
    expect(applyBuffToAttribute(100)).toBe(100);
  });

  it('绝对加成', () => {
    expect(applyBuffToAttribute(100, 30)).toBe(130);
  });

  it('百分比加成', () => {
    expect(applyBuffToAttribute(100, 0, 0.5)).toBe(150);
  });

  it('组合加成', () => {
    // 公式: base * (1 + percentBonus) + absolute
    // 100 * 1.5 + 20 = 170
    expect(applyBuffToAttribute(100, 20, 0.5)).toBe(170);
  });

  it('负Buff(减益)', () => {
    expect(applyBuffToAttribute(100, -30, -0.2)).toBe(50);
  });
});

describe('Buff叠加', () => {
  it('正常叠加', () => {
    const result = applyBuffStacks(2, 1, 5);
    expect(result.newStacks).toBe(3);
    expect(result.triggersFreeze).toBe(false);
  });

  it('达到阈值触发冰冻', () => {
    const result = applyBuffStacks(4, 1, 5);
    expect(result.newStacks).toBe(5);
    expect(result.triggersFreeze).toBe(true);
  });

  it('不会超过 maxStacks', () => {
    const result = applyBuffStacks(5, 1, 5);
    expect(result.newStacks).toBe(5);
  });

  it('自定义冰冻阈值', () => {
    const result = applyBuffStacks(2, 1, 5, 3);
    expect(result.triggersFreeze).toBe(true);
  });
});

describe('波次难度曲线 — HP倍率', () => {
  it('波次1: 0.7x', () => {
    expect(waveHpMultiplier(1)).toBeCloseTo(0.7);
  });

  it('波次3: 0.9x', () => {
    expect(waveHpMultiplier(3)).toBeCloseTo(0.9);
  });

  it('波次4: 1.0x', () => {
    expect(waveHpMultiplier(4)).toBeCloseTo(1.0);
  });

  it('波次8: 1.4x', () => {
    // 公式: 1.0 + (8-4) * 0.1 = 1.4
    expect(waveHpMultiplier(8)).toBeCloseTo(1.4);
  });

  it('波次15: 2.0x', () => {
    expect(waveHpMultiplier(15)).toBeCloseTo(2.0, 1);
  });

  it('波次20: 2.8x', () => {
    expect(waveHpMultiplier(20)).toBeCloseTo(2.8, 1);
  });

  it('波次25: >20波后每波+12%', () => {
    const base20 = waveHpMultiplier(20);
    // 25 = 20 + 5波, 1.12^5 ≈ 1.76
    const multiplier = waveHpMultiplier(25);
    const expected = base20 * Math.pow(1.12, 5);
    expect(multiplier).toBeCloseTo(expected, 1);
  });

  it('HP倍率单调递增', () => {
    let prev = 0;
    for (let w = 1; w <= 30; w++) {
      const curr = waveHpMultiplier(w);
      expect(curr, `波次${w} HP倍率应 > 波次${w-1}`).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });
});

describe('波次难度曲线 — 速度倍率', () => {
  it('波次1-8: 1.0x', () => {
    expect(waveSpeedMultiplier(1)).toBe(1.0);
    expect(waveSpeedMultiplier(8)).toBe(1.0);
  });

  it('波次9-15: 1.05x', () => {
    expect(waveSpeedMultiplier(10)).toBeCloseTo(1.05);
    expect(waveSpeedMultiplier(15)).toBeCloseTo(1.05);
  });

  it('波次16-20: 1.1x', () => {
    expect(waveSpeedMultiplier(20)).toBeCloseTo(1.1);
  });

  it('波次20+: 每波+2.5%, 上限200%', () => {
    expect(waveSpeedMultiplier(21)).toBeCloseTo(1.125);
    expect(waveSpeedMultiplier(30)).toBeCloseTo(1.35, 1);
    expect(waveSpeedMultiplier(999)).toBe(2.0);
  });
});

describe('波次难度曲线 — 护甲/魔抗递增', () => {
  it('波次1-3: 无护甲加成', () => {
    expect(waveArmorBonus(1)).toBe(0);
    expect(waveArmorBonus(3)).toBe(0);
  });

  it('波次4-8: 护甲+2', () => {
    expect(waveArmorBonus(4)).toBe(2);
  });

  it('波次9-15: 护甲+5', () => {
    expect(waveArmorBonus(10)).toBe(5);
  });

  it('波次16-20: 护甲+10', () => {
    expect(waveArmorBonus(18)).toBe(10);
  });

  it('波次20+: 每波+1.2护甲', () => {
    const armor21 = waveArmorBonus(21);
    expect(armor21).toBe(11.2);
    const armor22 = waveArmorBonus(22);
    expect(armor22).toBe(12.4);
  });

  it('魔抗与护甲独立递增', () => {
    expect(waveMrBonus(5)).toBe(1);
    expect(waveArmorBonus(5)).toBe(2);
    expect(waveMrBonus(20)).toBe(7);
    expect(waveArmorBonus(20)).toBe(10);
  });
});

describe('设计文档对照 — 具体数值验证', () => {
  // 参考: design/03-unit-data.md §1.1 箭塔 + §3.1 小兵
  it('箭塔(11ATK物理)打小兵(0护甲) = 11', () => {
    expect(calcPhysicalDamage(11, 0)).toBe(11);
  });

  // 参考: design/05-combat-system.md §4 数值锚点
  it('箭塔L1 ATK=11 打 重装兵(80护甲) ≈ 6.11', () => {
    expect(calcPhysicalDamage(11, 80)).toBeCloseTo(6.11, 1);
  });

  it('冰塔L1 ATK=8魔法 打 法师(60魔抗) ≈ 5.0', () => {
    expect(calcMagicDamage(8, 60)).toBeCloseTo(5.0, 1);
  });

  it('炮塔ATK=24 打重装兵(80护甲) ≈ 13.33', () => {
    expect(calcPhysicalDamage(24, 80)).toBeCloseTo(13.33, 1);
  });

  // 攻速锚点
  it('箭塔1.0/s 间隔1.0s，+100%攻速后0.5s', () => {
    const interval = attackSpeedToInterval(1.0);
    expect(interval).toBe(1.0);
    expect(calcAttackCooldown(interval, 1.0)).toBe(0.5);
  });

  // 移速锚点
  it('小兵80移速，50%减速后40px/s', () => {
    expect(calcMovementSpeed(80, 0, 0.5)).toBe(40);
  });

  it('快兵150移速，90%减速后最低30px/s', () => {
    // 150 × 0.2 = 30
    expect(calcMovementSpeed(150, 0, 0.9)).toBe(30);
  });

  // 暴击设计
  it('暴击倍率 = 1.5 + 额外暴伤加成', () => {
    expect(calcFinalDamage(100, 0, 0, 1.5)).toBe(150);
    expect(calcFinalDamage(100, 0, 0, 2.0)).toBe(200);
  });
});
