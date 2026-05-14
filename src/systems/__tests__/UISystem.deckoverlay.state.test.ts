import { describe, it, expect, beforeEach } from 'vitest';
import { UISystem } from '../UISystem.js';
import type { Renderer } from '../../render/Renderer.js';
import { GamePhase, TowerType } from '../../types/index.js';

// v3.0 roguelike — A4-UI A3-b UISystem 模态状态机与 handleClick 路由集成测试
// 设计文档锚点：
//   - design/14-acceptance-criteria.md §3.2 line 78 牌组/弃牌堆点击可查看全览
//   - design/09-ui-ux.md §3.4 line 166 点击图标弹出 / 关闭
//
// 用最小 stub 实例化 UISystem 验证状态切换 + handleClick 路由优先级。
// Renderer 用 stub 对象（不需要真实 canvas，handleClick 不触发渲染）。

function makeStubUISystem(): UISystem {
  const rendererStub = { push: (): void => {} } as unknown as Renderer;
  const noop = (): void => {};
  return new UISystem(
    rendererStub,
    () => GamePhase.Battle,
    () => 100,
    () => 1,
    () => 8,
    () => true,
    () => null,
    (_type: TowerType) => {},
    noop,
    () => 5,
    () => 0,
    () => 0,
  );
}

describe('UISystem A3-b — 模态状态机公共 API', () => {
  let ui: UISystem;
  beforeEach(() => { ui = makeStubUISystem(); });

  it('初始 isOverlayOpen() === false', () => {
    expect(ui.isOverlayOpen()).toBe(false);
  });

  it('openDeckOverlay() 切换到 deck 态', () => {
    ui.openDeckOverlay();
    expect(ui.isOverlayOpen()).toBe(true);
  });

  it('openDiscardOverlay() 切换到 discard 态', () => {
    ui.openDiscardOverlay();
    expect(ui.isOverlayOpen()).toBe(true);
  });

  it('closeOverlay() 复位到 closed', () => {
    ui.openDeckOverlay();
    ui.closeOverlay();
    expect(ui.isOverlayOpen()).toBe(false);
  });

  it('deck → discard 直接切换无需先 close', () => {
    ui.openDeckOverlay();
    ui.openDiscardOverlay();
    expect(ui.isOverlayOpen()).toBe(true);
    ui.closeOverlay();
    expect(ui.isOverlayOpen()).toBe(false);
  });
});

describe('UISystem A3-b — handleClick 路由：closed 态打开 overlay', () => {
  let ui: UISystem;
  beforeEach(() => { ui = makeStubUISystem(); });

  it('点击牌堆图标 (1745, 955) 打开 deck overlay 并 return true', () => {
    expect(ui.isOverlayOpen()).toBe(false);
    const handled = ui.handleClick(1745, 955);
    expect(handled).toBe(true);
    expect(ui.isOverlayOpen()).toBe(true);
  });

  it('点击弃牌堆图标 (1805, 955) 打开 discard overlay 并 return true', () => {
    expect(ui.isOverlayOpen()).toBe(false);
    const handled = ui.handleClick(1805, 955);
    expect(handled).toBe(true);
    expect(ui.isOverlayOpen()).toBe(true);
  });

  it('点击非图标区域 (500, 500) 不打开 overlay，return false（无按钮 hit）', () => {
    const handled = ui.handleClick(500, 500);
    expect(handled).toBe(false);
    expect(ui.isOverlayOpen()).toBe(false);
  });
});

describe('UISystem A3-b — handleClick 路由：overlay open 时输入吞并', () => {
  let ui: UISystem;
  beforeEach(() => {
    ui = makeStubUISystem();
    ui.openDeckOverlay();
  });

  it('点 modal 外（且非图标） → close overlay + return true', () => {
    const handled = ui.handleClick(50, 50);
    expect(handled).toBe(true);
    expect(ui.isOverlayOpen()).toBe(false);
  });

  it('点 modal 内（960, 540 屏中心）→ 吞掉点击但 overlay 保持打开', () => {
    const handled = ui.handleClick(960, 540);
    expect(handled).toBe(true);
    expect(ui.isOverlayOpen()).toBe(true);
  });

  it('再次点牌堆图标 (deck 态下) → close overlay + return true', () => {
    const handled = ui.handleClick(1745, 955);
    expect(handled).toBe(true);
    expect(ui.isOverlayOpen()).toBe(false);
  });

  it('点弃牌堆图标 (deck 态下) → 切换到 discard 态，overlay 仍开', () => {
    const handled = ui.handleClick(1805, 955);
    expect(handled).toBe(true);
    expect(ui.isOverlayOpen()).toBe(true);
  });
});

describe('UISystem A3-b — handleClick 路由：overlay open 时再次点图标 toggle 关闭', () => {
  let ui: UISystem;
  beforeEach(() => { ui = makeStubUISystem(); });

  it('discard 态点 discard 图标 → 关闭', () => {
    ui.openDiscardOverlay();
    expect(ui.isOverlayOpen()).toBe(true);
    const handled = ui.handleClick(1805, 955);
    expect(handled).toBe(true);
    expect(ui.isOverlayOpen()).toBe(false);
  });

  it('discard 态点 deck 图标 → 切换到 deck 态（仍开）', () => {
    ui.openDiscardOverlay();
    const handled = ui.handleClick(1745, 955);
    expect(handled).toBe(true);
    expect(ui.isOverlayOpen()).toBe(true);
  });
});
