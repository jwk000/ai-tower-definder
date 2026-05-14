import { describe, it, expect } from 'vitest';
import {
  buildCardTooltipLines,
  computeTooltipAnchor,
  CARD_TOOLTIP_WIDTH,
  CARD_TOOLTIP_HEIGHT,
  getHandZoneBounds,
} from '../UISystem.js';
import type { CardConfig } from '../../config/cardRegistry.js';

// v3.0 roguelike — A4-UI A2 悬停详情卡片纯函数单测
// 设计文档锚点：
//   - design/14-acceptance-criteria.md §3.2 line 77 卡牌悬停弹出详情卡片
//   - design/20-responsive-layout.md §4.5.2 手牌区几何
//
// 抽出 buildCardTooltipLines + computeTooltipAnchor 纯函数，避开 UISystem
// 构造函数 27 回调注入的测试基建难题。

function makeConfig(overrides: Partial<CardConfig> = {}): CardConfig {
  return {
    id: 'test_card',
    name: '测试卡',
    type: 'unit',
    energyCost: 3,
    rarity: 'common',
    placement: { targetType: 'tile' },
    ...overrides,
  };
}

describe('UISystem.buildCardTooltipLines', () => {
  it('outputs name + meta + energy for minimal config', () => {
    const lines = buildCardTooltipLines(makeConfig());
    expect(lines.map((l) => l.kind)).toEqual(['name', 'meta', 'energy']);
    expect(lines[0]!.text).toBe('测试卡');
    expect(lines[1]!.text).toBe('Common · 单位');
    expect(lines[2]!.text).toBe('◇ 3');
  });

  it('capitalizes rarity in meta line', () => {
    const lines = buildCardTooltipLines(makeConfig({ rarity: 'legendary' }));
    expect(lines[1]!.text).toBe('Legendary · 单位');
  });

  it('labels spell type as 法术', () => {
    const lines = buildCardTooltipLines(makeConfig({ type: 'spell' }));
    expect(lines[1]!.text).toBe('Common · 法术');
  });

  it('inserts persist line after energy when persistAcrossWaves=true', () => {
    const lines = buildCardTooltipLines(makeConfig({ persistAcrossWaves: true }));
    const kinds = lines.map((l) => l.kind);
    const energyIdx = kinds.indexOf('energy');
    const persistIdx = kinds.indexOf('persist');
    expect(persistIdx).toBe(energyIdx + 1);
    expect(lines[persistIdx]!.text).toBe('✦ 跨波保留');
  });

  it('omits persist line when persistAcrossWaves is falsy', () => {
    expect(buildCardTooltipLines(makeConfig()).map((l) => l.kind))
      .not.toContain('persist');
    expect(buildCardTooltipLines(makeConfig({ persistAcrossWaves: false })).map((l) => l.kind))
      .not.toContain('persist');
  });

  it('appends desc line when description present', () => {
    const lines = buildCardTooltipLines(makeConfig({ description: '造成 50 点伤害' }));
    const desc = lines.find((l) => l.kind === 'desc');
    expect(desc?.text).toBe('造成 50 点伤害');
  });

  it('appends flavor line last when flavorText present', () => {
    const lines = buildCardTooltipLines(makeConfig({
      description: '基础描述',
      flavorText: '风味文本',
    }));
    expect(lines.at(-1)!.kind).toBe('flavor');
    expect(lines.at(-1)!.text).toBe('风味文本');
  });

  it('preserves canonical order name → meta → energy → persist → desc → flavor', () => {
    const lines = buildCardTooltipLines(makeConfig({
      persistAcrossWaves: true,
      description: 'desc text',
      flavorText: 'flavor text',
    }));
    expect(lines.map((l) => l.kind)).toEqual([
      'name', 'meta', 'energy', 'persist', 'desc', 'flavor',
    ]);
  });
});

describe('UISystem.computeTooltipAnchor', () => {
  const REGION_W = 800;
  const CARD_W = 120;
  const GAP = 16;

  it('centers tooltip horizontally above a centered single card', () => {
    const anchor = computeTooltipAnchor(0, 1, REGION_W, CARD_W, GAP);
    const bounds = getHandZoneBounds();
    // 1 张卡居中，cardCenterX = bounds.centerX = 960
    // tooltip x = 960 - 240/2 = 840
    expect(anchor.x).toBe(840);
    // tooltip 底边在手牌区上边减 12px → y = bounds.top - HEIGHT - 12 = 860 - 320 - 12 = 528
    expect(anchor.y).toBe(bounds.top - CARD_TOOLTIP_HEIGHT - 12);
  });

  it('places tooltip y above hand zone top with 12px gap regardless of card index', () => {
    const bounds = getHandZoneBounds();
    for (let i = 0; i < 4; i++) {
      const anchor = computeTooltipAnchor(i, 4, REGION_W, CARD_W, GAP);
      expect(anchor.y).toBe(bounds.top - CARD_TOOLTIP_HEIGHT - 12);
    }
  });

  it('clamps tooltip to left margin when leftmost card pushes anchor offscreen', () => {
    // 8 张卡时 startX=-136，第 0 张 cardCenterX = bounds.left + (-136) + 60 = 484
    // 期望 x = 484 - 120 = 364（不需要 clamp，> 8）— 改用故意越界场景
    // 用 16 张卡触发越界（虽 design 上限 8，但 clamp 应稳健）
    const anchor = computeTooltipAnchor(0, 16, REGION_W, CARD_W, GAP);
    expect(anchor.x).toBeGreaterThanOrEqual(8);
  });

  it('clamps tooltip to right margin when rightmost card pushes anchor offscreen', () => {
    const anchor = computeTooltipAnchor(15, 16, REGION_W, CARD_W, GAP);
    const designW = 1920;
    expect(anchor.x + CARD_TOOLTIP_WIDTH).toBeLessThanOrEqual(designW - 8);
  });

  it('falls back to handZone center when cardIndex out of range', () => {
    const bounds = getHandZoneBounds();
    const anchor = computeTooltipAnchor(99, 4, REGION_W, CARD_W, GAP);
    expect(anchor.x).toBe(bounds.centerX - CARD_TOOLTIP_WIDTH / 2);
    expect(anchor.y).toBe(bounds.top - CARD_TOOLTIP_HEIGHT - 12);
  });

  it('produces distinct x for different card indices (no collapse)', () => {
    const a0 = computeTooltipAnchor(0, 4, REGION_W, CARD_W, GAP);
    const a3 = computeTooltipAnchor(3, 4, REGION_W, CARD_W, GAP);
    expect(a3.x).toBeGreaterThan(a0.x);
  });
});
