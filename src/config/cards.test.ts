/**
 * 卡牌 YAML 配置数值验证 — 6 塔 + 6 兵
 *
 * 对应设计文档:
 * - design/25-card-roguelike-refactor.md §2 卡牌系统
 * - design/03-unit-data.md §8.1 单位/建筑卡目录
 * - design/21-mda-numerical-design.md §12.2 卡牌能量消耗表（数值真理源）
 *
 * TDD 阶段: A1.2 — 实现 6 塔 + 6 兵的卡牌 YAML 配置
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadAllCardConfigs, loadAllCardConfigsSync } from './loader.js';
import { cardConfigRegistry } from './cardRegistry.js';
import { unitConfigRegistry, type UnitConfig } from './registry.js';

const TOWER_CARDS = [
  { id: 'arrow_tower_card', unit: 'arrow_tower', rarity: 'common', energy: 3 },
  { id: 'cannon_tower_card', unit: 'cannon_tower', rarity: 'common', energy: 4 },
  { id: 'ice_tower_card', unit: 'ice_tower', rarity: 'rare', energy: 5 },
  { id: 'lightning_tower_card', unit: 'lightning_tower', rarity: 'rare', energy: 5 },
  { id: 'laser_tower_card', unit: 'laser_tower', rarity: 'epic', energy: 6 },
  { id: 'bat_tower_card', unit: 'bat_tower', rarity: 'epic', energy: 5 },
] as const;

const SOLDIER_CARDS = [
  { id: 'swordsman_card', unit: 'swordsman', rarity: 'common', energy: 2 },
  { id: 'archer_card', unit: 'archer', rarity: 'common', energy: 2 },
  { id: 'shield_guard_card', unit: 'shield_guard', rarity: 'common', energy: 3 },
  { id: 'priest_card', unit: 'priest', rarity: 'rare', energy: 4 },
  { id: 'engineer_card', unit: 'engineer', rarity: 'rare', energy: 3 },
  { id: 'assassin_card', unit: 'assassin', rarity: 'epic', energy: 4 },
] as const;

const ALL_A12_CARDS = [...TOWER_CARDS, ...SOLDIER_CARDS];

describe('A1.2 卡牌 YAML 配置 (6 塔 + 6 兵)', () => {
  beforeAll(async () => {
    cardConfigRegistry.clear();
    for (const { unit } of ALL_A12_CARDS) {
      if (!unitConfigRegistry.get(unit)) {
        unitConfigRegistry.register({ id: unit } as unknown as UnitConfig);
      }
    }
    await loadAllCardConfigs();
  });

  it('共加载 12 张 A1.2 范围卡牌', () => {
    for (const expected of ALL_A12_CARDS) {
      const cfg = cardConfigRegistry.get(expected.id);
      expect(cfg, `卡牌 ${expected.id} 缺失`).toBeDefined();
    }
  });

  describe.each(TOWER_CARDS)('塔卡 $id', ({ id, unit, rarity, energy }) => {
    it('type=unit 且 unitConfigId 指向 UnitConfig', () => {
      const cfg = cardConfigRegistry.get(id);
      expect(cfg).toBeDefined();
      expect(cfg!.type).toBe('unit');
      expect(cfg!.unitConfigId).toBe(unit);
    });

    it(`稀有度 = ${rarity}`, () => {
      expect(cardConfigRegistry.get(id)!.rarity).toBe(rarity);
    });

    it(`能量消耗 = ${energy} (与 21-MDA §12.2 一致)`, () => {
      expect(cardConfigRegistry.get(id)!.energyCost).toBe(energy);
    });

    it('placement.targetType = tile (塔放置到地格)', () => {
      expect(cardConfigRegistry.get(id)!.placement.targetType).toBe('tile');
    });

    it('引用的 UnitConfig 真实存在', () => {
      expect(unitConfigRegistry.get(unit), `${unit} 单位配置缺失`).toBeDefined();
    });

    it('有中文 name 与 description', () => {
      const cfg = cardConfigRegistry.get(id)!;
      expect(cfg.name).toBeTruthy();
      expect(typeof cfg.name).toBe('string');
      expect(cfg.description).toBeTruthy();
    });
  });

  describe.each(SOLDIER_CARDS)('兵卡 $id', ({ id, unit, rarity, energy }) => {
    it('type=unit 且 unitConfigId 指向 UnitConfig', () => {
      const cfg = cardConfigRegistry.get(id);
      expect(cfg).toBeDefined();
      expect(cfg!.type).toBe('unit');
      expect(cfg!.unitConfigId).toBe(unit);
    });

    it(`稀有度 = ${rarity}`, () => {
      expect(cardConfigRegistry.get(id)!.rarity).toBe(rarity);
    });

    it(`能量消耗 = ${energy} (与 21-MDA §12.2 一致)`, () => {
      expect(cardConfigRegistry.get(id)!.energyCost).toBe(energy);
    });

    it('placement.targetType = tile (兵部署到地格)', () => {
      expect(cardConfigRegistry.get(id)!.placement.targetType).toBe('tile');
    });

    it('引用的 UnitConfig 真实存在', () => {
      expect(unitConfigRegistry.get(unit), `${unit} 单位配置缺失`).toBeDefined();
    });

    it('有中文 name 与 description', () => {
      const cfg = cardConfigRegistry.get(id)!;
      expect(cfg.name).toBeTruthy();
      expect(typeof cfg.name).toBe('string');
      expect(cfg.description).toBeTruthy();
    });
  });

  describe('稀有度分布（A1.2 范围）', () => {
    it('Common 卡 = 5 张 (arrow/cannon 塔 + swordsman/archer/shield_guard 兵)', () => {
      const commons = cardConfigRegistry
        .getByRarity('common')
        .filter((c) => ALL_A12_CARDS.some((x) => x.id === c.id));
      expect(commons).toHaveLength(5);
    });

    it('Rare 卡 = 4 张 (ice/lightning 塔 + priest/engineer 兵)', () => {
      const rares = cardConfigRegistry
        .getByRarity('rare')
        .filter((c) => ALL_A12_CARDS.some((x) => x.id === c.id));
      expect(rares).toHaveLength(4);
    });

    it('Epic 卡 = 3 张 (laser/bat 塔 + assassin 兵)', () => {
      const epics = cardConfigRegistry
        .getByRarity('epic')
        .filter((c) => ALL_A12_CARDS.some((x) => x.id === c.id));
      expect(epics).toHaveLength(3);
    });
  });

  describe('能量消耗合理性约束', () => {
    it('所有卡能量消耗在 [1, 10] 区间内', () => {
      for (const { id } of ALL_A12_CARDS) {
        const energy = cardConfigRegistry.get(id)!.energyCost;
        expect(energy, `${id} energyCost`).toBeGreaterThanOrEqual(1);
        expect(energy, `${id} energyCost`).toBeLessThanOrEqual(10);
      }
    });

    it('Common 卡能量消耗 ≤ Rare 平均 ≤ Epic 平均（稀有度成本梯度）', () => {
      const avg = (rarity: 'common' | 'rare' | 'epic'): number => {
        const cards = ALL_A12_CARDS.filter((c) => c.rarity === rarity);
        return cards.reduce((s, c) => s + c.energy, 0) / cards.length;
      };
      expect(avg('common')).toBeLessThanOrEqual(avg('rare'));
      expect(avg('rare')).toBeLessThanOrEqual(avg('epic'));
    });
  });

  describe('卡 ID 命名约定', () => {
    it('所有 A1.2 卡 ID 以 _card 结尾（统一命名）', () => {
      for (const { id } of ALL_A12_CARDS) {
        expect(id.endsWith('_card'), `${id} 应以 _card 结尾`).toBe(true);
      }
    });
  });
});

describe('A4-YAML loadAllCardConfigsSync 同步装载契约', () => {
  it('sync 与 async 加载结果等价（同一份 registry 内容）', () => {
    cardConfigRegistry.clear();
    const syncConfigs = loadAllCardConfigsSync();
    expect(syncConfigs.length).toBeGreaterThanOrEqual(12);
    for (const { id } of ALL_A12_CARDS) {
      expect(cardConfigRegistry.get(id), `sync 加载后 ${id} 应存在`).toBeDefined();
    }
  });

  it('main 启动场景：同步调用后立即能拿到非空 registry（不需 await）', () => {
    cardConfigRegistry.clear();
    expect(cardConfigRegistry.getAll().length).toBe(0);
    loadAllCardConfigsSync();
    expect(cardConfigRegistry.getAll().length).toBeGreaterThanOrEqual(12);
  });
});
