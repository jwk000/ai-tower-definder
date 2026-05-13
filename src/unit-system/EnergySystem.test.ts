import { describe, it, expect } from 'vitest';
import {
  EnergySystem,
  ENERGY_INITIAL,
  ENERGY_MAX_DEFAULT,
  ENERGY_REGEN_PER_WAVE,
  ENERGY_MAX_PERMANENT_UPGRADED,
} from './EnergySystem.js';

describe('EnergySystem — 验收 §3.3 能量系统', () => {
  describe('开局状态', () => {
    it('关 1 开始能量为 5/10', () => {
      const e = new EnergySystem();
      expect(e.current).toBe(ENERGY_INITIAL);
      expect(e.max).toBe(ENERGY_MAX_DEFAULT);
      expect(ENERGY_INITIAL).toBe(5);
      expect(ENERGY_MAX_DEFAULT).toBe(10);
    });

    it('支持自定义 max（永久升级后达 12）', () => {
      const e = new EnergySystem({ max: ENERGY_MAX_PERMANENT_UPGRADED });
      expect(e.max).toBe(12);
    });

    it('initial 高于 max 时被裁剪到 max', () => {
      const e = new EnergySystem({ max: 10, initial: 999 });
      expect(e.current).toBe(10);
    });
  });

  describe('startWave — 每波开始 +5', () => {
    it('每波恢复 5 点能量', () => {
      const e = new EnergySystem();
      const gained = e.startWave();
      expect(gained).toBe(5);
      expect(e.current).toBe(10);
    });

    it('不超过上限 max', () => {
      const e = new EnergySystem({ initial: 8 });
      const gained = e.startWave();
      expect(e.current).toBe(10);
      expect(gained).toBe(2);
    });

    it('已满则恢复 0', () => {
      const e = new EnergySystem({ initial: 10 });
      const gained = e.startWave();
      expect(gained).toBe(0);
      expect(e.current).toBe(10);
    });

    it('regenPerWave 与设计常量一致', () => {
      expect(ENERGY_REGEN_PER_WAVE).toBe(5);
    });
  });

  describe('spend — 出卡消耗', () => {
    it('能量足够时扣减并返回 true', () => {
      const e = new EnergySystem({ initial: 5 });
      expect(e.spend(3)).toBe(true);
      expect(e.current).toBe(2);
    });

    it('能量不足时返回 false 且不扣减', () => {
      const e = new EnergySystem({ initial: 2 });
      expect(e.spend(3)).toBe(false);
      expect(e.current).toBe(2);
    });

    it('恰好够花时返回 true 并归零', () => {
      const e = new EnergySystem({ initial: 5 });
      expect(e.spend(5)).toBe(true);
      expect(e.current).toBe(0);
    });

    it('拒绝负数消耗（防止反向加能 bug）', () => {
      const e = new EnergySystem({ initial: 5 });
      expect(e.spend(-3)).toBe(false);
      expect(e.current).toBe(5);
    });
  });

  describe('canAfford — UI 灰显判断', () => {
    it('正确判断是否能负担消耗', () => {
      const e = new EnergySystem({ initial: 5 });
      expect(e.canAfford(3)).toBe(true);
      expect(e.canAfford(5)).toBe(true);
      expect(e.canAfford(6)).toBe(false);
    });

    it('不修改状态', () => {
      const e = new EnergySystem({ initial: 5 });
      e.canAfford(3);
      expect(e.current).toBe(5);
    });
  });

  describe('战斗中无被动恢复（关键设计约束）', () => {
    it('多次 spend 后 current 不自动恢复', () => {
      const e = new EnergySystem({ initial: 8 });
      e.spend(3);
      e.spend(2);
      expect(e.current).toBe(3);
    });
  });

  describe('跨波保留', () => {
    it('波末剩余能量在 startWave 后保留并叠加', () => {
      const e = new EnergySystem({ initial: 5 });
      e.spend(3);
      expect(e.current).toBe(2);
      e.startWave();
      expect(e.current).toBe(7);
    });

    it('跨多波保留', () => {
      const e = new EnergySystem({ initial: 5 });
      e.spend(4);
      e.startWave();
      e.spend(3);
      e.startWave();
      expect(e.current).toBe(8);
    });
  });

  describe('addBonus — 秘境/法术卡额外回能', () => {
    it('增加能量，受 max 约束', () => {
      const e = new EnergySystem({ initial: 5 });
      const gained = e.addBonus(3);
      expect(e.current).toBe(8);
      expect(gained).toBe(3);
    });

    it('超过 max 时只回到 max', () => {
      const e = new EnergySystem({ initial: 8 });
      const gained = e.addBonus(5);
      expect(e.current).toBe(10);
      expect(gained).toBe(2);
    });

    it('已满时回能 0', () => {
      const e = new EnergySystem({ initial: 10 });
      expect(e.addBonus(3)).toBe(0);
    });

    it('忽略非正数', () => {
      const e = new EnergySystem({ initial: 5 });
      expect(e.addBonus(0)).toBe(0);
      expect(e.addBonus(-3)).toBe(0);
      expect(e.current).toBe(5);
    });
  });

  describe('setMax — 永久升级', () => {
    it('提升 max，但当前能量不自动补满（设计 §4.1）', () => {
      const e = new EnergySystem({ initial: 5 });
      e.setMax(12);
      expect(e.max).toBe(12);
      expect(e.current).toBe(5);
    });

    it('降低 max 时裁剪当前能量', () => {
      const e = new EnergySystem({ initial: 10 });
      e.setMax(6);
      expect(e.current).toBe(6);
    });

    it('忽略负值', () => {
      const e = new EnergySystem({ initial: 5 });
      e.setMax(-3);
      expect(e.max).toBe(10);
    });
  });
});
