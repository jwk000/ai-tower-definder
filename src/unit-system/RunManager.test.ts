import { describe, it, expect, beforeEach } from 'vitest';
import { GameRandom } from '../utils/Random.js';
import { CardConfigRegistry } from '../config/cardRegistry.js';
import type { CardConfig, CardRarity, CardType } from '../config/cardRegistry.js';
import {
  RunManager,
  RUN_DECK_SIZE,
  RARITY_WEIGHTS,
  GUARANTEED_TYPES,
} from './RunManager.js';

let counter = 0;
function mkCfg(rarity: CardRarity, type: CardType = 'unit', extra: Partial<CardConfig> = {}): CardConfig {
  counter += 1;
  return {
    id: `card_${type}_${rarity}_${counter}`,
    name: `${type}-${rarity}-${counter}`,
    type,
    energyCost: 2,
    rarity,
    placement: { targetType: 'tile' },
    ...extra,
  };
}

function makeRegistry(cards: readonly CardConfig[]): CardConfigRegistry {
  const r = new CardConfigRegistry();
  cards.forEach((c) => r.register(c));
  return r;
}

beforeEach(() => { counter = 0; });

describe('RunManager — 验收 §3.1 卡组构筑 / §3.5 跨关流程', () => {
  describe('常量与权重', () => {
    it('开局卡组固定 12 张', () => {
      expect(RUN_DECK_SIZE).toBe(12);
    });

    it('稀有度权重 60/25/12/3 加和 = 100', () => {
      const sum = RARITY_WEIGHTS.common + RARITY_WEIGHTS.rare + RARITY_WEIGHTS.epic + RARITY_WEIGHTS.legendary;
      expect(sum).toBe(100);
      expect(RARITY_WEIGHTS.common).toBe(60);
      expect(RARITY_WEIGHTS.rare).toBe(25);
      expect(RARITY_WEIGHTS.epic).toBe(12);
      expect(RARITY_WEIGHTS.legendary).toBe(3);
    });

    it('保底类型清单覆盖所有 CardType', () => {
      expect(GUARANTEED_TYPES).toContain('unit');
      expect(GUARANTEED_TYPES).toContain('spell');
    });
  });

  describe('initRun — 开局抽 12 张', () => {
    it('返回正好 12 张卡', () => {
      const registry = makeRegistry([
        mkCfg('common'), mkCfg('common'), mkCfg('common'),
        mkCfg('rare'), mkCfg('rare'),
        mkCfg('epic'),
        mkCfg('legendary'),
      ]);
      const rm = new RunManager({ registry, rng: new GameRandom(42), seed: 42 });
      const { cards } = rm.initRun();
      expect(cards).toHaveLength(RUN_DECK_SIZE);
    });

    it('每张卡都是合法 CardInstance（cardLevel=1，instanceId 唯一）', () => {
      const registry = makeRegistry([mkCfg('common'), mkCfg('rare')]);
      const rm = new RunManager({ registry, rng: new GameRandom(1), seed: 1 });
      const { cards } = rm.initRun();
      const ids = new Set(cards.map((c) => c.instanceId));
      expect(ids.size).toBe(RUN_DECK_SIZE);
      cards.forEach((c) => {
        expect(c.cardLevel).toBe(1);
        expect(c.instanceId).toMatch(/^c1_\d+$/);
        expect(registry.get(c.cardId)).toBeDefined();
      });
    });

    it('确定性：相同 seed → 相同抽卡序列', () => {
      const reg1 = makeRegistry([
        mkCfg('common'), mkCfg('common'), mkCfg('rare'), mkCfg('epic'), mkCfg('legendary'),
      ]);
      const reg2 = makeRegistry([
        mkCfg('common'), mkCfg('common'), mkCfg('rare'), mkCfg('epic'), mkCfg('legendary'),
      ]);
      // 重置 counter 确保两边 id 序列一致
      counter = 0;
      const reg3 = makeRegistry([
        mkCfg('common'), mkCfg('common'), mkCfg('rare'), mkCfg('epic'), mkCfg('legendary'),
      ]);
      counter = 0;
      const reg4 = makeRegistry([
        mkCfg('common'), mkCfg('common'), mkCfg('rare'), mkCfg('epic'), mkCfg('legendary'),
      ]);
      const a = new RunManager({ registry: reg3, rng: new GameRandom(7), seed: 7 }).initRun();
      const b = new RunManager({ registry: reg4, rng: new GameRandom(7), seed: 7 }).initRun();
      expect(a.cards.map((c) => c.cardId)).toEqual(b.cards.map((c) => c.cardId));
    });

    it('不同 seed → 抽卡序列大概率不同', () => {
      const big = Array.from({ length: 20 }, (_, i) =>
        mkCfg((['common', 'rare', 'epic', 'legendary'] as CardRarity[])[i % 4]!),
      );
      const a = new RunManager({ registry: makeRegistry(big), rng: new GameRandom(1), seed: 1 }).initRun();
      const b = new RunManager({ registry: makeRegistry(big), rng: new GameRandom(999), seed: 999 }).initRun();
      expect(a.cards.map((c) => c.cardId)).not.toEqual(b.cards.map((c) => c.cardId));
    });

    it('卡池为空时抛错', () => {
      const rm = new RunManager({ registry: new CardConfigRegistry(), rng: new GameRandom(1), seed: 1 });
      expect(() => rm.initRun()).toThrow(/为空/);
    });

    it('卡池只有 common 时也能抽满 12 张（单稀有度退化）', () => {
      const registry = makeRegistry([mkCfg('common'), mkCfg('common')]);
      const rm = new RunManager({ registry, rng: new GameRandom(1), seed: 1 });
      const { cards } = rm.initRun();
      expect(cards).toHaveLength(12);
    });
  });

  describe('稀有度权重分布（统计验证）', () => {
    it('大量抽卡时 Common 占比明显高于 Legendary', () => {
      const registry = makeRegistry([
        mkCfg('common'), mkCfg('rare'), mkCfg('epic'), mkCfg('legendary'),
      ]);
      const counts: Record<CardRarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
      // 100 个 Run × 12 张 = 1200 张抽样
      for (let s = 1; s <= 100; s++) {
        const rm = new RunManager({ registry, rng: new GameRandom(s), seed: s });
        const { cards } = rm.initRun();
        for (const c of cards) {
          const rarity = registry.get(c.cardId)!.rarity;
          counts[rarity]++;
        }
      }
      expect(counts.common).toBeGreaterThan(counts.rare);
      expect(counts.rare).toBeGreaterThan(counts.epic);
      expect(counts.epic).toBeGreaterThan(counts.legendary);
      // Common 应远高于 Legendary（60% vs 3% = 20 倍）
      expect(counts.common).toBeGreaterThan(counts.legendary * 5);
    });
  });

  describe('保底机制（设计 §2.2）', () => {
    it('卡池含 unit + spell 时，12 张中至少各 1 张', () => {
      const registry = makeRegistry([
        mkCfg('common', 'unit'), mkCfg('common', 'unit'),
        mkCfg('legendary', 'spell'),
      ]);
      // 跑 50 个不同 seed，每次都应包含 spell（保底强制）
      for (let s = 1; s <= 50; s++) {
        const rm = new RunManager({ registry, rng: new GameRandom(s), seed: s });
        const { cards } = rm.initRun();
        const types = new Set(cards.map((c) => registry.get(c.cardId)!.type));
        expect(types.has('unit')).toBe(true);
        expect(types.has('spell')).toBe(true);
      }
    });

    it('卡池中无 spell 时不抛错（Phase A 当前阶段）', () => {
      const registry = makeRegistry([mkCfg('common', 'unit'), mkCfg('rare', 'unit')]);
      const rm = new RunManager({ registry, rng: new GameRandom(1), seed: 1 });
      expect(() => rm.initRun()).not.toThrow();
      const { cards } = rm.initRun();
      cards.forEach((c) => {
        expect(registry.get(c.cardId)!.type).toBe('unit');
      });
    });
  });

  describe('RunState 生命周期', () => {
    let rm: RunManager;
    beforeEach(() => {
      const registry = makeRegistry([mkCfg('common'), mkCfg('rare')]);
      rm = new RunManager({ registry, rng: new GameRandom(1), seed: 1, crystalHpMax: 100 });
    });

    it('初始 state 字段正确', () => {
      expect(rm.state.seed).toBe(1);
      expect(rm.state.currentLevel).toBe(1);
      expect(rm.state.currentWave).toBe(0);
      expect(rm.state.crystalHp).toBe(100);
      expect(rm.state.crystalHpMax).toBe(100);
      expect(rm.state.gold).toBe(0);
      expect(rm.state.totalKills).toBe(0);
      expect(rm.isDead).toBe(false);
    });

    it('advanceToNextLevel: level +1，wave 归 0', () => {
      rm.startNewWave();
      rm.startNewWave();
      expect(rm.state.currentWave).toBe(2);
      rm.advanceToNextLevel();
      expect(rm.state.currentLevel).toBe(2);
      expect(rm.state.currentWave).toBe(0);
    });

    it('startNewWave: 关内波数 1-based 累加', () => {
      expect(rm.startNewWave()).toBe(1);
      expect(rm.startNewWave()).toBe(2);
      expect(rm.startNewWave()).toBe(3);
      expect(rm.state.currentWave).toBe(3);
    });

    it('addKills: 累加击杀，忽略非正数', () => {
      rm.addKills(5);
      rm.addKills(3);
      rm.addKills(-1);
      rm.addKills(0);
      expect(rm.state.totalKills).toBe(8);
    });

    it('addGold: 加减金币，下限 0', () => {
      rm.addGold(50);
      expect(rm.state.gold).toBe(50);
      rm.addGold(-30);
      expect(rm.state.gold).toBe(20);
      rm.addGold(-100);
      expect(rm.state.gold).toBe(0);
    });

    it('damageCrystal: HP 下限 0，归零触发 isDead', () => {
      expect(rm.damageCrystal(30)).toBe(70);
      expect(rm.isDead).toBe(false);
      expect(rm.damageCrystal(200)).toBe(0);
      expect(rm.isDead).toBe(true);
    });

    it('damageCrystal: 忽略非正数', () => {
      rm.damageCrystal(-5);
      rm.damageCrystal(0);
      expect(rm.state.crystalHp).toBe(100);
    });

    it('healCrystal: 上限 crystalHpMax', () => {
      rm.damageCrystal(50);
      rm.healCrystal(20);
      expect(rm.state.crystalHp).toBe(70);
      rm.healCrystal(999);
      expect(rm.state.crystalHp).toBe(100);
    });

    it('healCrystal: 忽略非正数', () => {
      rm.damageCrystal(30);
      rm.healCrystal(-5);
      rm.healCrystal(0);
      expect(rm.state.crystalHp).toBe(70);
    });
  });

  describe('crystalHpMax 默认值', () => {
    it('不传 crystalHpMax 时默认 100', () => {
      const registry = makeRegistry([mkCfg('common')]);
      const rm = new RunManager({ registry, rng: new GameRandom(1), seed: 1 });
      expect(rm.state.crystalHpMax).toBe(100);
      expect(rm.state.crystalHp).toBe(100);
    });

    it('支持自定义 crystalHpMax（永久升级后）', () => {
      const registry = makeRegistry([mkCfg('common')]);
      const rm = new RunManager({ registry, rng: new GameRandom(1), seed: 1, crystalHpMax: 150 });
      expect(rm.state.crystalHp).toBe(150);
      expect(rm.state.crystalHpMax).toBe(150);
    });
  });
});
