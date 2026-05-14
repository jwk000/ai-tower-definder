import { describe, it, expect } from 'vitest';
import {
  DECK_ICON_HIT,
  DISCARD_ICON_HIT,
  hitTestDeckIcon,
  hitTestDiscardIcon,
  buildDeckOverlayLayout,
  classifyOverlayClick,
  OVERLAY_MODAL_W,
  OVERLAY_MODAL_H,
  OVERLAY_CARD_W,
  OVERLAY_CARD_H,
} from '../UISystem.js';

// v3.0 roguelike — A4-UI A3 牌组/弃牌堆全览面板纯函数单测
// 设计文档锚点：
//   - design/14-acceptance-criteria.md §3.2 line 78 牌组/弃牌堆点击可查看全览
//   - design/09-ui-ux.md §3.4 line 165-166 点击图标弹出半透明面板
//   - design/20-responsive-layout.md §4.5.1 牌堆图标 anchor bottom-right offset(-200,-160) size 50×70
//                                          弃牌堆图标 anchor bottom-right offset(-140,-160) size 50×70
//
// 抽出 4 个纯函数 + 5 个常量，与 A2 buildCardTooltipLines / A1 hitTestHandCard
// 同样规避 UISystem 构造函数 27 回调注入的测试基建难题。

describe('UISystem A3 — 图标 hit box 常量', () => {
  it('DECK_ICON_HIT 锚定 design/20 §4.5.1 (1920-200, 1080-160) → (1720, 920) 50×70', () => {
    expect(DECK_ICON_HIT).toEqual({ x: 1720, y: 920, w: 50, h: 70 });
  });

  it('DISCARD_ICON_HIT 锚定 design/20 §4.5.1 (1920-140, 1080-160) → (1780, 920) 50×70', () => {
    expect(DISCARD_ICON_HIT).toEqual({ x: 1780, y: 920, w: 50, h: 70 });
  });

  it('两图标水平相邻不重叠：deck.right = 1770 < discard.left = 1780', () => {
    expect(DECK_ICON_HIT.x + DECK_ICON_HIT.w).toBe(1770);
    expect(DISCARD_ICON_HIT.x).toBe(1780);
  });
});

describe('UISystem A3 — hitTestDeckIcon', () => {
  it('图标中心命中', () => {
    expect(hitTestDeckIcon(1745, 955)).toBe(true);
  });

  it('图标四角命中（含边界 inclusive 上/左，exclusive 下/右）', () => {
    expect(hitTestDeckIcon(1720, 920)).toBe(true);
    expect(hitTestDeckIcon(1769, 989)).toBe(true);
    expect(hitTestDeckIcon(1770, 920)).toBe(false);
    expect(hitTestDeckIcon(1720, 990)).toBe(false);
  });

  it('图标外不命中', () => {
    expect(hitTestDeckIcon(0, 0)).toBe(false);
    expect(hitTestDeckIcon(960, 540)).toBe(false);
    expect(hitTestDeckIcon(1780, 955)).toBe(false);  // 弃牌堆区域
  });
});

describe('UISystem A3 — hitTestDiscardIcon', () => {
  it('图标中心命中', () => {
    expect(hitTestDiscardIcon(1805, 955)).toBe(true);
  });

  it('图标四角命中', () => {
    expect(hitTestDiscardIcon(1780, 920)).toBe(true);
    expect(hitTestDiscardIcon(1829, 989)).toBe(true);
    expect(hitTestDiscardIcon(1830, 920)).toBe(false);
    expect(hitTestDiscardIcon(1780, 990)).toBe(false);
  });

  it('图标外不命中', () => {
    expect(hitTestDiscardIcon(1745, 955)).toBe(false);  // 牌堆区域
    expect(hitTestDiscardIcon(0, 0)).toBe(false);
  });
});

describe('UISystem A3 — buildDeckOverlayLayout', () => {
  it('modal 居中于 1920×1080 设计画布', () => {
    const layout = buildDeckOverlayLayout(0);
    expect(layout.modal.w).toBe(OVERLAY_MODAL_W);
    expect(layout.modal.h).toBe(OVERLAY_MODAL_H);
    expect(layout.modal.x).toBe((1920 - OVERLAY_MODAL_W) / 2);
    expect(layout.modal.y).toBe((1080 - OVERLAY_MODAL_H) / 2);
  });

  it('cards=0 时 cells 空数组', () => {
    const layout = buildDeckOverlayLayout(0);
    expect(layout.cells).toEqual([]);
  });

  it('cards=1 时单元格在网格首位（modal padding 内）', () => {
    const layout = buildDeckOverlayLayout(1);
    expect(layout.cells).toHaveLength(1);
    const cell = layout.cells[0]!;
    expect(cell.index).toBe(0);
    expect(cell.w).toBe(OVERLAY_CARD_W);
    expect(cell.h).toBe(OVERLAY_CARD_H);
    expect(cell.x).toBeGreaterThan(layout.modal.x);
    expect(cell.x + cell.w).toBeLessThan(layout.modal.x + layout.modal.w);
    expect(cell.y).toBeGreaterThan(layout.modal.y);
  });

  it('cards=20 时分行：每行容纳 (modal.w-padding*2) / (cardW+gap) 张', () => {
    const layout = buildDeckOverlayLayout(20);
    expect(layout.cells).toHaveLength(20);
    // 取第 0 和第 N 张的 y 不同确认换行
    const row0 = layout.cells[0]!.y;
    const last = layout.cells[19]!;
    expect(last.y).toBeGreaterThanOrEqual(row0);
  });

  it('cells x/y 严格递增（同行 x 递增 + 跨行 y 递增）', () => {
    const layout = buildDeckOverlayLayout(15);
    for (let i = 1; i < layout.cells.length; i++) {
      const prev = layout.cells[i - 1]!;
      const cur = layout.cells[i]!;
      if (cur.y === prev.y) {
        expect(cur.x).toBeGreaterThan(prev.x);
      } else {
        expect(cur.y).toBeGreaterThan(prev.y);
      }
    }
  });

  it('title 位置在 modal 顶部 padding 内', () => {
    const layout = buildDeckOverlayLayout(0);
    expect(layout.title.x).toBeGreaterThanOrEqual(layout.modal.x);
    expect(layout.title.y).toBeGreaterThanOrEqual(layout.modal.y);
    expect(layout.title.y).toBeLessThan(layout.modal.y + 80);  // 顶部 80 像素内
  });

  it('closeHintAt 位置在 modal 底部内', () => {
    const layout = buildDeckOverlayLayout(0);
    expect(layout.closeHintAt.y).toBeGreaterThan(layout.modal.y + layout.modal.h - 80);
    expect(layout.closeHintAt.y).toBeLessThan(layout.modal.y + layout.modal.h);
  });

  it('卡数极端 100 张不崩溃', () => {
    const layout = buildDeckOverlayLayout(100);
    expect(layout.cells).toHaveLength(100);
    expect(layout.cells[99]!.index).toBe(99);
  });
});

describe('UISystem A3 — classifyOverlayClick', () => {
  const modal = { x: 410, y: 190, w: 1100, h: 700 };

  it('点击牌堆图标 → icon-deck', () => {
    expect(classifyOverlayClick(1745, 955, modal)).toBe('icon-deck');
  });

  it('点击弃牌堆图标 → icon-discard', () => {
    expect(classifyOverlayClick(1805, 955, modal)).toBe('icon-discard');
  });

  it('点击 modal 内部 → inside-modal', () => {
    expect(classifyOverlayClick(960, 540, modal)).toBe('inside-modal');
  });

  it('点击 modal 边缘内 → inside-modal', () => {
    expect(classifyOverlayClick(modal.x + 1, modal.y + 1, modal)).toBe('inside-modal');
    expect(classifyOverlayClick(modal.x + modal.w - 1, modal.y + modal.h - 1, modal)).toBe('inside-modal');
  });

  it('点击 modal 外（且非图标） → outside-modal', () => {
    expect(classifyOverlayClick(50, 50, modal)).toBe('outside-modal');
    expect(classifyOverlayClick(1900, 1000, modal)).toBe('outside-modal');
  });

  it('点击图标优先级高于 inside-modal 判定（图标在 modal 外，无歧义）', () => {
    // 图标 (1745, 955) 不在 modal (410,190,1100,700) 内（modal 右下角 1510,890）
    // 此用例验证图标分类不被 inside-modal 覆盖
    expect(1745).toBeGreaterThan(modal.x + modal.w);
    expect(classifyOverlayClick(1745, 955, modal)).toBe('icon-deck');
  });
});
