import { describe, it, expect } from 'vitest';
import {
  computeCardSlotsLayout,
  RARITY_BORDER_COLORS,
} from '../UISystem.js';

// v3.0 roguelike — A4-UI Step 2 手牌渲染纯函数单测
// 设计文档锚点：
//   - design/20-responsive-layout.md §4.5.2 手牌区
//     · 手牌区 800 × 180，bottom-center offset(0, -130)
//     · 单卡 120 × 168，卡间距 16px，最多 8 张，水平居中
//   - design/09-ui-ux.md §3.2 卡牌稀有度色
//
// 抽出纯函数测试，避开 UISystem 构造函数 23+ 回调注入的测试基建难题。

describe('UISystem.computeCardSlotsLayout', () => {
  const REGION_W = 800;
  const CARD_W = 120;
  const GAP = 16;

  it('returns empty array when handCount is 0', () => {
    const slots = computeCardSlotsLayout(0, REGION_W, CARD_W, GAP);
    expect(slots).toEqual([]);
  });

  it('places a single card at the horizontal center of the region', () => {
    const slots = computeCardSlotsLayout(1, REGION_W, CARD_W, GAP);
    expect(slots).toHaveLength(1);
    // 1 张卡居中：x = (REGION_W - CARD_W)/2 = (800-120)/2 = 340
    expect(slots[0]!.x).toBe(340);
  });

  it('lays out 4 cards centered with 16px gaps (default hand size)', () => {
    const slots = computeCardSlotsLayout(4, REGION_W, CARD_W, GAP);
    expect(slots).toHaveLength(4);
    // total = 4*120 + 3*16 = 528；startX = (800-528)/2 = 136
    // step = 120 + 16 = 136
    expect(slots[0]!.x).toBe(136);
    expect(slots[1]!.x).toBe(272);
    expect(slots[2]!.x).toBe(408);
    expect(slots[3]!.x).toBe(544);
    // 最后一张右边沿 = 544 + 120 = 664；与左侧对称留白 = (800-664) = 136 ✓
  });

  it('lays out 8 cards centered with 16px gaps (max hand size)', () => {
    const slots = computeCardSlotsLayout(8, REGION_W, CARD_W, GAP);
    expect(slots).toHaveLength(8);
    // total = 8*120 + 7*16 = 1072 > 800 -> startX 会为负，但仍按 step 排列
    // step = 136；total = 8*120 + 7*16 = 1072；startX = (800-1072)/2 = -136
    expect(slots[0]!.x).toBe(-136);
    expect(slots[7]!.x).toBe(-136 + 7 * 136); // -136 + 952 = 816
    // 注意：8 张超出 800 宽是 design 已知约束（手牌上限 8），UI 层视觉可允许越界或后续调整 gap。
  });

  it('returns y = 0 for all slots (relative to region origin)', () => {
    const slots = computeCardSlotsLayout(4, REGION_W, CARD_W, GAP);
    for (const s of slots) {
      expect(s.y).toBe(0);
    }
  });
});

describe('UISystem.RARITY_BORDER_COLORS', () => {
  it('maps each CardRarity to the design/09 §3.2 color', () => {
    expect(RARITY_BORDER_COLORS.common).toBe('#ffffff');
    expect(RARITY_BORDER_COLORS.rare).toBe('#2196f3');
    expect(RARITY_BORDER_COLORS.epic).toBe('#9c27b0');
    expect(RARITY_BORDER_COLORS.legendary).toBe('#ffc107');
  });

  it('exposes exactly the 4 rarities defined in cardRegistry.ts', () => {
    const keys = Object.keys(RARITY_BORDER_COLORS).sort();
    expect(keys).toEqual(['common', 'epic', 'legendary', 'rare']);
  });
});
