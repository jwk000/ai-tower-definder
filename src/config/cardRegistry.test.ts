/**
 * CardConfigRegistry & CardConfig 类型 — 单元测试
 *
 * 对应设计文档:
 * - design/25-card-roguelike-refactor.md §2 卡牌系统
 * - design/02-unit-system.md §8 卡牌生成入口
 * - design/03-unit-data.md §8 卡牌目录
 *
 * TDD 阶段: A1.1 — 定义 CardConfig TS 接口与配置加载器
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  CardConfigRegistry,
  cardConfigRegistry,
  type CardConfig,
} from './cardRegistry.js';
import { loadAllCardConfigs } from './loader.js';

describe('CardConfig 类型定义', () => {
  it('单位卡: 必需字段齐全', () => {
    const cfg: CardConfig = {
      id: 'card_arrow_tower',
      name: '箭塔',
      type: 'unit',
      energyCost: 3,
      rarity: 'common',
      unitConfigId: 'arrow_tower',
      placement: { targetType: 'tile', range: 'anywhere' },
    };
    expect(cfg.id).toBe('card_arrow_tower');
    expect(cfg.type).toBe('unit');
    expect(cfg.unitConfigId).toBe('arrow_tower');
  });

  it('法术卡: 必需字段齐全', () => {
    const cfg: CardConfig = {
      id: 'card_fireball',
      name: '火球术',
      type: 'spell',
      energyCost: 2,
      rarity: 'common',
      spellEffectId: 'spell_fireball',
      spellSubtype: 'damage',
      placement: { targetType: 'area', range: 'cursor' },
    };
    expect(cfg.type).toBe('spell');
    expect(cfg.spellEffectId).toBe('spell_fireball');
    expect(cfg.spellSubtype).toBe('damage');
  });

  it('persistAcrossWaves 默认未定义（视为 false）', () => {
    const cfg: CardConfig = {
      id: 'card_swordsman',
      name: '剑士',
      type: 'unit',
      energyCost: 2,
      rarity: 'common',
      unitConfigId: 'swordsman',
      placement: { targetType: 'tile' },
    };
    expect(cfg.persistAcrossWaves).toBeUndefined();
  });

  it('rarity 枚举值合法', () => {
    const validRarities: CardConfig['rarity'][] = ['common', 'rare', 'epic', 'legendary'];
    for (const r of validRarities) {
      const cfg: CardConfig = {
        id: `card_x_${r}`,
        name: 'x',
        type: 'unit',
        energyCost: 1,
        rarity: r,
        unitConfigId: 'x',
        placement: { targetType: 'tile' },
      };
      expect(cfg.rarity).toBe(r);
    }
  });
});

describe('CardConfigRegistry', () => {
  let registry: CardConfigRegistry;

  const mockArrowCard: CardConfig = {
    id: 'card_arrow_tower',
    name: '箭塔',
    type: 'unit',
    energyCost: 3,
    rarity: 'common',
    unitConfigId: 'arrow_tower',
    placement: { targetType: 'tile' },
  };
  const mockFireball: CardConfig = {
    id: 'card_fireball',
    name: '火球术',
    type: 'spell',
    energyCost: 2,
    rarity: 'rare',
    spellEffectId: 'spell_fireball',
    spellSubtype: 'damage',
    placement: { targetType: 'area' },
  };

  beforeEach(() => {
    registry = new CardConfigRegistry();
  });

  it('register + get 按 ID 查回卡牌', () => {
    registry.register(mockArrowCard);
    expect(registry.get('card_arrow_tower')).toEqual(mockArrowCard);
  });

  it('未注册的 ID 返回 undefined', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('register 同 ID 会覆盖旧配置', () => {
    registry.register(mockArrowCard);
    const upgraded: CardConfig = { ...mockArrowCard, energyCost: 4 };
    registry.register(upgraded);
    expect(registry.get('card_arrow_tower')?.energyCost).toBe(4);
  });

  it('getAll 返回所有已注册卡牌', () => {
    registry.register(mockArrowCard);
    registry.register(mockFireball);
    expect(registry.getAll()).toHaveLength(2);
  });

  it('getByType 按 unit/spell 过滤', () => {
    registry.register(mockArrowCard);
    registry.register(mockFireball);
    expect(registry.getByType('unit')).toHaveLength(1);
    expect(registry.getByType('unit')[0]?.id).toBe('card_arrow_tower');
    expect(registry.getByType('spell')).toHaveLength(1);
    expect(registry.getByType('spell')[0]?.id).toBe('card_fireball');
  });

  it('getByRarity 按稀有度过滤', () => {
    registry.register(mockArrowCard);
    registry.register(mockFireball);
    expect(registry.getByRarity('common')).toHaveLength(1);
    expect(registry.getByRarity('rare')).toHaveLength(1);
    expect(registry.getByRarity('epic')).toHaveLength(0);
  });

  it('size 反映注册数量', () => {
    expect(registry.size).toBe(0);
    registry.register(mockArrowCard);
    expect(registry.size).toBe(1);
    registry.register(mockFireball);
    expect(registry.size).toBe(2);
  });

  it('clear 清空注册表', () => {
    registry.register(mockArrowCard);
    registry.register(mockFireball);
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.get('card_arrow_tower')).toBeUndefined();
  });

  it('全局单例 cardConfigRegistry 存在且为 CardConfigRegistry 实例', () => {
    expect(cardConfigRegistry).toBeInstanceOf(CardConfigRegistry);
  });
});

describe('loadAllCardConfigs (loader integration)', () => {
  beforeEach(() => {
    cardConfigRegistry.clear();
  });

  it('返回数组而不抛出，无论 src/config/cards/ 当前是否有 YAML 文件', async () => {
    const result = await loadAllCardConfigs();
    expect(Array.isArray(result)).toBe(true);
  });

  it('调用后已加载的卡牌也可通过全局 cardConfigRegistry 访问', async () => {
    const result = await loadAllCardConfigs();
    const all = cardConfigRegistry.getAll();
    expect(all).toHaveLength(result.length);
  });
});
