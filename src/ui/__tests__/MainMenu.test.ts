import { describe, it, expect } from 'vitest';

import { buildMainMenu, hitTestMainMenu, layoutMainMenu, MainMenu, resolveMainMenuClick, type MainMenuAction } from '../MainMenu.js';

describe('buildMainMenu', () => {
  it('disables continue-run when no saved run exists', () => {
    const buttons = buildMainMenu({ hasSavedRun: false });
    const cont = buttons.find((b) => b.action === 'continue-run')!;
    expect(cont.enabled).toBe(false);
  });

  it('enables continue-run when a saved run exists', () => {
    const buttons = buildMainMenu({ hasSavedRun: true });
    expect(buttons.find((b) => b.action === 'continue-run')!.enabled).toBe(true);
  });

  it('always enables start-run, open-cards, open-settings, quit', () => {
    const buttons = buildMainMenu({ hasSavedRun: false });
    for (const action of ['start-run', 'open-cards', 'open-settings', 'quit'] as const) {
      expect(buttons.find((b) => b.action === action)!.enabled).toBe(true);
    }
  });
});

describe('resolveMainMenuClick', () => {
  it('returns the action when button is enabled', () => {
    expect(resolveMainMenuClick({ hasSavedRun: true }, 'continue-run')).toBe('continue-run');
  });

  it('rejects when button is disabled', () => {
    expect(resolveMainMenuClick({ hasSavedRun: false }, 'continue-run')).toEqual({
      kind: 'rejected', reason: 'disabled',
    });
  });
});

describe('MainMenu class wrapper', () => {
  it('invokes handler with enabled action; ignores disabled', () => {
    const menu = new MainMenu({ hasSavedRun: false });
    const got: MainMenuAction[] = [];
    menu.setHandler((a) => got.push(a));
    menu.trigger('start-run');
    menu.trigger('continue-run');
    expect(got).toEqual(['start-run']);
  });

  it('refresh() updates state so previously disabled action becomes enabled', () => {
    const menu = new MainMenu({ hasSavedRun: false });
    const got: MainMenuAction[] = [];
    menu.setHandler((a) => got.push(a));
    menu.refresh({ hasSavedRun: true });
    menu.trigger('continue-run');
    expect(got).toEqual(['continue-run']);
  });
});

describe('layoutMainMenu + hitTestMainMenu (Wave 8.2 Pixi 事件链)', () => {
  const VW = 1344;
  const VH = 576;

  it('layout 中心对齐 5 个按钮，宽度 320，间距 16，可命中 start-run', () => {
    const layout = layoutMainMenu({ hasSavedRun: false }, VW, VH);
    expect(layout.buttons.length).toBe(5);
    for (const b of layout.buttons) {
      expect(b.width).toBe(320);
      expect(b.height).toBe(56);
      expect(b.x).toBe((VW - 320) / 2);
    }
    const startBtn = layout.buttons[0]!;
    const cx = startBtn.x + startBtn.width / 2;
    const cy = startBtn.y + startBtn.height / 2;
    expect(hitTestMainMenu(layout, cx, cy)).toBe('start-run');
  });

  it('点击 disabled 的 continue-run 返回 null（命中但被忽略）', () => {
    const layout = layoutMainMenu({ hasSavedRun: false }, VW, VH);
    const contBtn = layout.buttons.find((b) => b.action === 'continue-run')!;
    expect(contBtn.enabled).toBe(false);
    const cx = contBtn.x + contBtn.width / 2;
    const cy = contBtn.y + contBtn.height / 2;
    expect(hitTestMainMenu(layout, cx, cy)).toBeNull();
  });

  it('点击空白处返回 null', () => {
    const layout = layoutMainMenu({ hasSavedRun: true }, VW, VH);
    expect(hitTestMainMenu(layout, 0, 0)).toBeNull();
    expect(hitTestMainMenu(layout, VW - 1, VH - 1)).toBeNull();
  });

  it('hasSavedRun=true 时可命中 continue-run', () => {
    const layout = layoutMainMenu({ hasSavedRun: true }, VW, VH);
    const contBtn = layout.buttons.find((b) => b.action === 'continue-run')!;
    expect(contBtn.enabled).toBe(true);
    const cx = contBtn.x + contBtn.width / 2;
    const cy = contBtn.y + contBtn.height / 2;
    expect(hitTestMainMenu(layout, cx, cy)).toBe('continue-run');
  });
});
