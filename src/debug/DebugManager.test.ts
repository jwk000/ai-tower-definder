import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager } from '../utils/SaveManager.js';
import { LEVELS } from '../data/levels/index.js';

const localStorageStore: Record<string, string> = {};

function installLocalStorage(): void {
  for (const key of Object.keys(localStorageStore)) delete localStorageStore[key];
  (globalThis as any).localStorage = {
    getItem: (key: string) => localStorageStore[key] ?? null,
    setItem: (key: string, value: string) => { localStorageStore[key] = value; },
    removeItem: (key: string) => { delete localStorageStore[key]; },
    clear: () => { for (const k of Object.keys(localStorageStore)) delete localStorageStore[k]; },
    get length() { return Object.keys(localStorageStore).length; },
    key: (index: number) => Object.keys(localStorageStore)[index] ?? null,
  } as Storage;
}

function installMinimalDom(): void {
  const elementProto = {
    style: new Proxy({} as Record<string, string>, {
      get: (target, prop: string) => target[prop] ?? '',
      set: (target, prop: string, value: string) => { target[prop] = value; return true; },
    }),
    appendChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
    setAttribute: vi.fn(),
    getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600 }),
    getContext: () => null,
    contains: () => false,
  };
  const makeElement = () => ({
    ...elementProto,
    style: { ...elementProto.style },
    children: [],
    childNodes: [],
    classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
    innerHTML: '',
    textContent: '',
    title: '',
    id: '',
    disabled: false,
    width: 0,
    height: 0,
    appendChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
    setAttribute: vi.fn(),
    getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600 }),
    getContext: () => null,
    contains: () => false,
  });

  (globalThis as any).document = {
    createElement: (_tag: string) => makeElement(),
    getElementById: () => null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  };
  (globalThis as any).window = {
    devicePixelRatio: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  (globalThis as any).requestAnimationFrame = (_cb: FrameRequestCallback): number => 0;
  (globalThis as any).cancelAnimationFrame = (_id: number) => undefined;
}

describe('DebugManager — 调试功能 (design/27-debug-system.md)', () => {
  beforeEach(() => {
    installLocalStorage();
    installMinimalDom();
  });

  it('completeAllLevels 将所有关卡设为 3 星并解锁到最后一关', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');

    const world = new TowerWorld();
    const refreshCallback = vi.fn();
    const debug = new DebugManager(world, { onLevelProgressChanged: refreshCallback });

    const result = debug.completeAllLevels();

    expect(result.unlocked).toBe(LEVELS.length);
    expect(result.stars).toBe(3);

    const save = SaveManager.load();
    expect(save.unlockedLevels).toBe(LEVELS.length);
    for (let i = 1; i <= LEVELS.length; i++) {
      expect(save.levelStars[i]).toBe(3);
    }
    expect(refreshCallback).toHaveBeenCalledTimes(1);
  });

  it('addDebugGold 在未注入 economy 时返回 false 且不抛错', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');

    const world = new TowerWorld();
    const debug = new DebugManager(world);

    expect(debug.addDebugGold()).toBe(false);
  });

  it('addDebugGold 在注入 economy 后调用 economy.addGold(99999)', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');
    const { EconomySystem } = await import('../systems/EconomySystem.js');

    const world = new TowerWorld();
    const economy = new EconomySystem();
    const debug = new DebugManager(world, { getEconomy: () => economy });

    const goldBefore = economy.gold;
    const ok = debug.addDebugGold();

    expect(ok).toBe(true);
    economy.update(world, 0);
    expect(economy.gold).toBeGreaterThanOrEqual(Math.min(goldBefore + 99999, 999_999));
  });

  it('addDebugGold 在 economy provider 返回 null 时按未注入处理', async () => {
    const { TowerWorld } = await import('../core/World.js');
    const { DebugManager } = await import('./DebugManager.js');

    const world = new TowerWorld();
    let currentEconomy: any = null;
    const debug = new DebugManager(world, { getEconomy: () => currentEconomy });

    expect(debug.addDebugGold()).toBe(false);
  });
});
