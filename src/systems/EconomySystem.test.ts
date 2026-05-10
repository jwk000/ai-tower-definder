/**
 * 经济系统测试 — EconomySystem
 * 
 * 对应设计文档:
 * - design/06-economy-system.md §1 三种资源
 * - design/06-economy-system.md §4 资源消耗
 * - design/06-economy-system.md §7 起始资源
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EconomySystem } from './EconomySystem.js';

describe('EconomySystem', () => {
  let economy: EconomySystem;

  beforeEach(() => {
    economy = new EconomySystem();
  });

  describe('初始状态', () => {
    it('初始金币 200', () => {
      expect(economy.gold).toBe(200);
    });

    it('初始能量 50', () => {
      expect(economy.energy).toBe(50);
    });

    it('初始人口上限 6', () => {
      expect(economy.maxPopulation).toBe(6);
    });

    it('初始人口占用 0', () => {
      expect(economy.population).toBe(0);
    });
  });

  describe('金币操作', () => {
    it('addGold 加到 pending，update 后生效', () => {
      economy.addGold(50);
      expect(economy.gold).toBe(200); // 还在 pending
      economy.update(null as any, 0);
      expect(economy.gold).toBe(250);
    });

    it('spendGold 先消耗 pending 再消耗 reserve', () => {
      economy.addGold(20);
      const ok = economy.spendGold(80);
      expect(ok).toBe(true);
      // pending 20 被消耗，剩余 60 从 reserve 扣除
      economy.update(null as any, 0);
      expect(economy.gold).toBe(140); // 200 - 60
    });

    it('spendGold 余额不足返回 false', () => {
      const ok = economy.spendGold(500);
      expect(ok).toBe(false);
      economy.update(null as any, 0);
      expect(economy.gold).toBe(200); // 未扣减
    });

    it('spendGold 精确等于余额时成功', () => {
      const ok = economy.spendGold(200);
      expect(ok).toBe(true);
      economy.update(null as any, 0);
      expect(economy.gold).toBe(0);
    });

    it('多次 addGold 累加', () => {
      economy.addGold(10);
      economy.addGold(20);
      economy.addGold(30);
      economy.update(null as any, 0);
      expect(economy.gold).toBe(260);
    });
  });

  describe('能量操作', () => {
    it('addEnergy / spendEnergy 对称', () => {
      economy.addEnergy(20);
      const ok = economy.spendEnergy(20);
      expect(ok).toBe(true);
      economy.update(null as any, 0);
      expect(economy.energy).toBe(50);
    });

    it('spendEnergy 不足时拒绝', () => {
      const ok = economy.spendEnergy(999);
      expect(ok).toBe(false);
    });
  });

  describe('人口管理', () => {
    it('canDeployUnit 空间充足时返回 true', () => {
      expect(economy.canDeployUnit(2)).toBe(true);
      expect(economy.canDeployUnit(6)).toBe(true);
    });

    it('canDeployUnit 超上限时返回 false', () => {
      economy.deployUnit(5);
      expect(economy.canDeployUnit(2)).toBe(false);
    });

    it('deployUnit 占人口', () => {
      economy.deployUnit(3);
      expect(economy.population).toBe(3);
    });

    it('releaseUnit 释放人口', () => {
      economy.deployUnit(4);
      economy.releaseUnit(2);
      expect(economy.population).toBe(2);
    });

    it('releaseUnit 不会低于0', () => {
      economy.releaseUnit(5);
      expect(economy.population).toBe(0);
    });

    it('部署 + 释放完整周期', () => {
      // 部署三个单位
      economy.deployUnit(1);
      economy.deployUnit(2);
      economy.deployUnit(1);
      expect(economy.population).toBe(4);
      expect(economy.canDeployUnit(3)).toBe(false);

      // 释放一个
      economy.releaseUnit(2);
      expect(economy.population).toBe(2);
      expect(economy.canDeployUnit(3)).toBe(true);
    });
  });

  describe('无尽模式分数', () => {
    it('非无尽模式不累加分数', () => {
      economy.addEndlessKillScore(10, 1);
      expect(economy.endlessScore).toBe(0);
    });

    it('无尽模式累加分数 = 奖励金 × 波次', () => {
      economy.isEndless = true;
      economy.addEndlessKillScore(10, 3);
      expect(economy.endlessScore).toBe(30); // 10 * 3
    });
  });

  describe('update 刷新机制', () => {
    it('update 将 pending 转入实际储备', () => {
      economy.addGold(100);
      economy.addEnergy(30);
      expect(economy.gold).toBe(200);

      economy.update(null as any, 0.016);

      expect(economy.gold).toBe(300);
      expect(economy.energy).toBe(80);
    });

    it('update 后 pending 清零', () => {
      economy.addGold(50);
      economy.update(null as any, 0);
      economy.addGold(10);
      economy.update(null as any, 0);
      expect(economy.gold).toBe(260); // 200 + 50 + 10
    });
  });
});
