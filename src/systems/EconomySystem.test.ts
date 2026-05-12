/**
 * 经济系统测试 — EconomySystem
 * 
 * 对应设计文档:
 * - design/06-economy-system.md §1 三种资源
 * - design/06-economy-system.md §4 资源消耗
 * - design/06-economy-system.md §7 起始资源
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EconomySystem, calculateRefund, type RefundMeta } from './EconomySystem.js';

describe('EconomySystem', () => {
  let economy: EconomySystem;

  beforeEach(() => {
    economy = new EconomySystem();
  });

  describe('初始状态', () => {
    it('初始金币 220', () => {
      expect(economy.gold).toBe(220);
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
      expect(economy.gold).toBe(220); // 还在 pending
      economy.update(null as any, 0);
      expect(economy.gold).toBe(270);
    });

    it('spendGold 先消耗 pending 再消耗 reserve', () => {
      economy.addGold(20);
      const ok = economy.spendGold(80);
      expect(ok).toBe(true);
      // pending 20 被消耗，剩余 60 从 reserve 扣除
      economy.update(null as any, 0);
      expect(economy.gold).toBe(160); // 220 - 60
    });

    it('spendGold 余额不足返回 false', () => {
      const ok = economy.spendGold(500);
      expect(ok).toBe(false);
      economy.update(null as any, 0);
      expect(economy.gold).toBe(220); // 未扣减
    });

    it('spendGold 精确等于余额时成功', () => {
      const ok = economy.spendGold(220);
      expect(ok).toBe(true);
      economy.update(null as any, 0);
      expect(economy.gold).toBe(0);
    });

    it('多次 addGold 累加', () => {
      economy.addGold(10);
      economy.addGold(20);
      economy.addGold(30);
      economy.update(null as any, 0);
      expect(economy.gold).toBe(280);
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
      expect(economy.gold).toBe(220);

      economy.update(null as any, 0.016);

      expect(economy.gold).toBe(320);
      expect(economy.energy).toBe(80);
    });

    it('update 后 pending 清零', () => {
      economy.addGold(50);
      economy.update(null as any, 0);
      economy.addGold(10);
      economy.update(null as any, 0);
      expect(economy.gold).toBe(280); // 220 + 50 + 10
    });
  });

  // ============================================================
  // P1-#11 — 回收机制 (design/06-economy-system.md §4.3)
  // ============================================================
  describe('P1-#11 calculateRefund 纯函数', () => {
    const baseMeta = (overrides: Partial<RefundMeta> = {}): RefundMeta => ({
      buildTime: 0,
      lastDamageTime: -Infinity,
      lastAttackTime: -Infinity,
      everInCombat: false,
      refundRatio: 0.5,
      totalCost: 100,
      ...overrides,
    });

    it('建造冷却内 (age<3s) 拒绝退款', () => {
      const r = calculateRefund({ currentTime: 2, meta: baseMeta(), currentHp: 100, maxHp: 100 });
      expect(r.amount).toBe(0);
      expect(r.reason).toBe('cooldown');
    });

    it('刚过冷却且未参战 → 误建 90% 退款', () => {
      const r = calculateRefund({ currentTime: 3, meta: baseMeta(), currentHp: 100, maxHp: 100 });
      expect(r.amount).toBe(90);
      expect(r.reason).toBe('misbuild');
    });

    it('参战过且 age<5s → 不再享受 misbuild 退款，按 ok 计算', () => {
      const r = calculateRefund({ currentTime: 4, meta: baseMeta({ everInCombat: true, lastDamageTime: -10 }), currentHp: 100, maxHp: 100 });
      expect(r.reason).toBe('ok');
      expect(r.amount).toBe(50);
    });

    it('age>=5s 且满血 → 50% × 100% = 50', () => {
      const r = calculateRefund({ currentTime: 6, meta: baseMeta({ everInCombat: true, lastDamageTime: -10 }), currentHp: 100, maxHp: 100 });
      expect(r.amount).toBe(50);
      expect(r.reason).toBe('ok');
    });

    it('半血 → 退款按 hpRatio 缩减', () => {
      const r = calculateRefund({ currentTime: 6, meta: baseMeta({ everInCombat: true, lastDamageTime: -10 }), currentHp: 50, maxHp: 100 });
      expect(r.amount).toBe(25); // 100 * 0.5 * 0.5
    });

    it('刚受伤 (combat_damage<2s) 拒绝退款', () => {
      const r = calculateRefund({ currentTime: 10, meta: baseMeta({ everInCombat: true, lastDamageTime: 9 }), currentHp: 100, maxHp: 100 });
      expect(r.amount).toBe(0);
      expect(r.reason).toBe('combat_damage');
    });

    it('刚攻击 (combat_attack<2s) 拒绝退款', () => {
      const r = calculateRefund({ currentTime: 10, meta: baseMeta({ everInCombat: true, lastAttackTime: 9 }), currentHp: 100, maxHp: 100 });
      expect(r.amount).toBe(0);
      expect(r.reason).toBe('combat_attack');
    });

    it('combat guard 过去 2s 后可退款', () => {
      const r = calculateRefund({ currentTime: 12, meta: baseMeta({ everInCombat: true, lastDamageTime: 9 }), currentHp: 100, maxHp: 100 });
      expect(r.reason).toBe('ok');
      expect(r.amount).toBe(50);
    });

    it('maxHp=0 时按 100% hpRatio 处理 (除零保护)', () => {
      const r = calculateRefund({ currentTime: 6, meta: baseMeta({ everInCombat: true, lastDamageTime: -10 }), currentHp: 0, maxHp: 0 });
      expect(r.amount).toBe(50);
    });

    it('refundRatio=1.0 (路障/特殊) → 全额退款', () => {
      const r = calculateRefund({ currentTime: 6, meta: baseMeta({ everInCombat: true, lastDamageTime: -10, refundRatio: 1.0 }), currentHp: 100, maxHp: 100 });
      expect(r.amount).toBe(100);
    });
  });

  describe('P1-#11 EconomySystem 集成', () => {
    const tick = (econ: EconomySystem, seconds: number) => econ.update(null as any, seconds);

    it('未注册实体 computeRefund → unknown 且 amount=0', () => {
      const r = economy.computeRefund(999, 100, 100);
      expect(r.amount).toBe(0);
      expect(r.reason).toBe('unknown');
    });

    it('registerBuild 后立即回收被冷却拒绝', () => {
      economy.registerBuild(1, 100);
      const r = economy.computeRefund(1, 100, 100);
      expect(r.reason).toBe('cooldown');
    });

    it('registerBuild 后等 4 秒 → misbuild 90 退款', () => {
      economy.registerBuild(1, 100);
      tick(economy, 4);
      const r = economy.computeRefund(1, 100, 100);
      expect(r.reason).toBe('misbuild');
      expect(r.amount).toBe(90);
    });

    it('notifyDamaged 标记 everInCombat 并阻断退款', () => {
      economy.registerBuild(1, 100);
      tick(economy, 4);
      economy.notifyDamaged(1);
      const r = economy.computeRefund(1, 100, 100);
      expect(r.reason).toBe('combat_damage');
    });

    it('notifyAttacked 进入战斗状态后 5s 外按 ok 退款', () => {
      economy.registerBuild(1, 100);
      tick(economy, 1);
      economy.notifyAttacked(1);
      tick(economy, 6); // age=7s, attack 6s 前
      const r = economy.computeRefund(1, 100, 100);
      expect(r.reason).toBe('ok');
      expect(r.amount).toBe(50);
    });

    it('addUpgradeCost 累计 totalCost 影响退款额', () => {
      economy.registerBuild(1, 100);
      economy.addUpgradeCost(1, 50);
      tick(economy, 4);
      const r = economy.computeRefund(1, 100, 100);
      expect(r.amount).toBe(Math.floor(150 * 0.9)); // 135
    });

    it('addUpgradeCost 对未注册实体静默忽略', () => {
      expect(() => economy.addUpgradeCost(999, 50)).not.toThrow();
    });

    it('clearRefundMeta 移除后 computeRefund → unknown', () => {
      economy.registerBuild(1, 100);
      economy.clearRefundMeta(1);
      const r = economy.computeRefund(1, 100, 100);
      expect(r.reason).toBe('unknown');
    });

    it('GOLD_CAP=999999 限制 update 后累加上限', () => {
      economy.gold = 999_900;
      economy.addGold(200);
      tick(economy, 0);
      expect(economy.gold).toBe(999_999);
    });

    it('未注册实体 notifyDamaged/notifyAttacked 静默忽略', () => {
      expect(() => economy.notifyDamaged(999)).not.toThrow();
      expect(() => economy.notifyAttacked(999)).not.toThrow();
    });
  });

  // ============================================================
  // P2-#17 v1.1 第 2 轮 — RefundMeta 序列化 (design/13 §1)
  // ============================================================
  describe('serializeRefundMeta / deserializeRefundMeta', () => {
    it('空状态序列化为空数组', () => {
      expect(economy.serializeRefundMeta()).toEqual([]);
    });

    it('序列化包含所有已注册实体的元数据', () => {
      economy.registerBuild(1, 100);
      economy.registerBuild(2, 200, 0.7);
      const snapshot = economy.serializeRefundMeta();
      expect(snapshot.length).toBe(2);
      const eids = snapshot.map(([eid]) => eid).sort();
      expect(eids).toEqual([1, 2]);
    });

    it('反序列化恢复完整状态可被 computeRefund 读取', () => {
      economy.registerBuild(1, 100);
      economy.update(null as any, 4); // gameTime=4, age=4 → misbuild window
      const snapshot = economy.serializeRefundMeta();

      const restored = new EconomySystem();
      restored.update(null as any, 4); // align gameTime
      restored.deserializeRefundMeta(snapshot);

      const r = restored.computeRefund(1, 100, 100);
      expect(r.reason).toBe('misbuild');
      expect(r.amount).toBe(90);
    });

    it('反序列化清空旧元数据', () => {
      economy.registerBuild(1, 100);
      const restored = new EconomySystem();
      restored.registerBuild(99, 999);
      restored.deserializeRefundMeta(economy.serializeRefundMeta());
      expect(restored.getRefundMeta(99)).toBeUndefined();
      expect(restored.getRefundMeta(1)).toBeDefined();
    });

    it('反序列化把 null/undefined 时间戳还原为 -Infinity (JSON 往返保护)', () => {
      const snapshotFromJson = [
        [42, {
          buildTime: 10,
          lastDamageTime: null as any,
          lastAttackTime: undefined as any,
          everInCombat: false,
          refundRatio: 0.5,
          totalCost: 100,
        }],
      ] as Array<[number, any]>;
      economy.deserializeRefundMeta(snapshotFromJson);
      const meta = economy.getRefundMeta(42)!;
      expect(meta.lastDamageTime).toBe(-Infinity);
      expect(meta.lastAttackTime).toBe(-Infinity);
    });

    it('反序列化深拷贝避免共享引用', () => {
      economy.registerBuild(1, 100);
      const snapshot = economy.serializeRefundMeta();
      const restored = new EconomySystem();
      restored.deserializeRefundMeta(snapshot);

      economy.notifyDamaged(1);
      const restoredMeta = restored.getRefundMeta(1)!;
      expect(restoredMeta.everInCombat).toBe(false); // 不受原对象后续变化影响
    });
  });
});
