import { describe, it, expect } from 'vitest';
import {
  hitTestHandCard,
  resolveCardToEntityType,
  getHandZoneBounds,
  cardTypeLabel,
  cardTypeGlyph,
} from '../UISystem.js';
import { TowerType, UnitType } from '../../types/index.js';

// v3.0 roguelike — A4-UI Step 3 拖卡交互纯函数单测
// 设计文档锚点：
//   - design/20-responsive-layout.md §4.5.2 手牌区命中区域（与 renderHandZone 同布局）
//   - design/25-card-roguelike-refactor.md §2 卡牌 → 单位/塔配置映射
//
// 抽出纯函数测试，避开 main.ts 全装配测试基建。

describe('UISystem.getHandZoneBounds', () => {
  it('returns DESIGN_W/2-centered 800×180 region with bottom offset -130', () => {
    const b = getHandZoneBounds();
    expect(b.width).toBe(800);
    expect(b.height).toBe(180);
    expect(b.centerX).toBe(1920 / 2);
    expect(b.centerY).toBe(1080 - 130);
    expect(b.left).toBe(1920 / 2 - 400);
    expect(b.top).toBe(1080 - 130 - 90);
  });
});

describe('UISystem.hitTestHandCard', () => {
  const bounds = getHandZoneBounds();
  const CARD_W = 120;
  const CARD_H = 168;

  it('returns -1 when point lies outside the hand zone vertical band', () => {
    expect(hitTestHandCard(bounds.centerX, 0, 4)).toBe(-1);
    expect(hitTestHandCard(bounds.centerX, 1080, 4)).toBe(-1);
  });

  it('returns -1 when hand is empty regardless of position', () => {
    expect(hitTestHandCard(bounds.centerX, bounds.centerY, 0)).toBe(-1);
  });

  it('returns the correct slot index when point lies inside a card rectangle', () => {
    // 4 张布局 startX=136（相对手牌区原点 bounds.left）
    // 卡片 i 的左边沿 = bounds.left + 136 + i * (CARD_W + 16)
    // 卡片垂直居中：top = bounds.top + (180 - 168)/2 = bounds.top + 6
    const cardTop = bounds.top + (180 - CARD_H) / 2;
    const cardCenterY = cardTop + CARD_H / 2;

    for (let i = 0; i < 4; i++) {
      const cardLeft = bounds.left + 136 + i * (CARD_W + 16);
      const centerX = cardLeft + CARD_W / 2;
      expect(hitTestHandCard(centerX, cardCenterY, 4)).toBe(i);
    }
  });

  it('returns -1 when point lies in the 16px gap between cards', () => {
    const cardTop = bounds.top + (180 - CARD_H) / 2;
    const cardCenterY = cardTop + CARD_H / 2;
    // 卡 0 右沿 = bounds.left + 136 + 120 = bounds.left + 256
    // 卡 1 左沿 = bounds.left + 136 + 1*136 = bounds.left + 272
    // gap 中点 x = bounds.left + 264
    expect(hitTestHandCard(bounds.left + 264, cardCenterY, 4)).toBe(-1);
  });
});

describe('UISystem.resolveCardToEntityType', () => {
  it('resolves _tower-suffixed unitConfigId to TowerType entityType', () => {
    expect(resolveCardToEntityType('arrow_tower')).toEqual({
      entityType: 'tower',
      towerType: TowerType.Arrow,
    });
    expect(resolveCardToEntityType('cannon_tower')).toEqual({
      entityType: 'tower',
      towerType: TowerType.Cannon,
    });
    expect(resolveCardToEntityType('lightning_tower')).toEqual({
      entityType: 'tower',
      towerType: TowerType.Lightning,
    });
  });

  it('resolves known unit unitConfigId to UnitType entityType', () => {
    expect(resolveCardToEntityType('swordsman')).toEqual({
      entityType: 'unit',
      unitType: UnitType.Swordsman,
    });
    expect(resolveCardToEntityType('shield_guard')).toEqual({
      entityType: 'unit',
      unitType: UnitType.ShieldGuard,
    });
  });

  it('returns null for unknown / unsupported unitConfigId', () => {
    expect(resolveCardToEntityType('archer')).toBeNull();
    expect(resolveCardToEntityType('priest')).toBeNull();
    expect(resolveCardToEntityType('unknown_xxx')).toBeNull();
    expect(resolveCardToEntityType('')).toBeNull();
  });

  it('returns null for undefined / empty input', () => {
    expect(resolveCardToEntityType(undefined)).toBeNull();
  });

  it('B3 扩展：resolves spike_trap to trap entityType', () => {
    expect(resolveCardToEntityType('spike_trap')).toEqual({ entityType: 'trap' });
  });

  it('B3 扩展：resolves ProductionType values to production entityType', () => {
    expect(resolveCardToEntityType('gold_mine')).toEqual({
      entityType: 'production',
      productionType: 'gold_mine',
    });
    expect(resolveCardToEntityType('energy_tower')).toEqual({
      entityType: 'production',
      productionType: 'energy_tower',
    });
  });

  it('B3 扩展：energy_tower 优先匹配 production 而非 _tower 后缀', () => {
    const r = resolveCardToEntityType('energy_tower');
    expect(r).not.toBeNull();
    expect(r!.entityType).toBe('production');
  });
});

describe('UISystem.cardTypeLabel / cardTypeGlyph (B3 扩展)', () => {
  it('cardTypeLabel 覆盖 4 类 CardType', () => {
    expect(cardTypeLabel('unit')).toBe('单位');
    expect(cardTypeLabel('spell')).toBe('法术');
    expect(cardTypeLabel('trap')).toBe('陷阱');
    expect(cardTypeLabel('production')).toBe('生产');
  });

  it('cardTypeGlyph 覆盖 4 类 CardType 且各不相同', () => {
    const glyphs = [
      cardTypeGlyph('unit'),
      cardTypeGlyph('spell'),
      cardTypeGlyph('trap'),
      cardTypeGlyph('production'),
    ];
    expect(new Set(glyphs).size).toBe(4);
    for (const g of glyphs) {
      expect(g.length).toBeGreaterThan(0);
    }
  });
});
