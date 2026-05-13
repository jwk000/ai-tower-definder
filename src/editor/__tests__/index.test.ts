import { describe, it, expect, beforeEach } from 'vitest';
import { bootstrapEditor, attachF2Hotkey, type EditorHandle } from '../index.js';
import type { Game } from '../../core/Game.js';

function makeFakeGame(): Game {
  return { paused: false } as unknown as Game;
}

function makeHost(): HTMLElement {
  const style: Record<string, string> = { display: 'none' };
  const el = {
    tagName: 'DIV',
    style: new Proxy(style, {
      get: (target, key: string) => target[key] ?? '',
      set: (target, key: string, value: string) => { target[key] = value; return true; },
    }),
  } as unknown as HTMLElement;
  return el;
}

describe('bootstrapEditor', () => {
  let game: Game;
  let handle: EditorHandle;

  beforeEach(() => {
    game = makeFakeGame();
    handle = bootstrapEditor({ game, hostElement: makeHost() });
  });

  it('starts in closed state', () => {
    expect(handle.isOpen()).toBe(false);
  });

  it('open() pauses the game and marks editor open', () => {
    expect(game.paused).toBe(false);
    handle.open();
    expect(handle.isOpen()).toBe(true);
    expect(game.paused).toBe(true);
  });

  it('close() restores prior pause state (was not paused)', () => {
    handle.open();
    handle.close();
    expect(handle.isOpen()).toBe(false);
    expect(game.paused).toBe(false);
  });

  it('close() preserves prior pause state (was paused before open)', () => {
    game.paused = true;
    handle.open();
    expect(game.paused).toBe(true);
    handle.close();
    expect(game.paused).toBe(true);
  });

  it('open() is idempotent', () => {
    handle.open();
    handle.open();
    expect(handle.isOpen()).toBe(true);
    handle.close();
    expect(game.paused).toBe(false);
  });

  it('close() is idempotent', () => {
    handle.close();
    expect(handle.isOpen()).toBe(false);
    handle.open();
    handle.close();
    handle.close();
    expect(game.paused).toBe(false);
  });

  it('toggle() flips open state', () => {
    handle.toggle();
    expect(handle.isOpen()).toBe(true);
    expect(game.paused).toBe(true);
    handle.toggle();
    expect(handle.isOpen()).toBe(false);
    expect(game.paused).toBe(false);
  });

  it('dispose() auto-closes if open', () => {
    handle.open();
    handle.dispose();
    expect(handle.isOpen()).toBe(false);
    expect(game.paused).toBe(false);
  });

  it('dispose() is safe when already closed', () => {
    handle.dispose();
    expect(handle.isOpen()).toBe(false);
  });
});

describe('bootstrapEditor: host element visibility', () => {
  it('host display="none" when closed', () => {
    const host = makeHost();
    const game = makeFakeGame();
    bootstrapEditor({ game, hostElement: host });
    expect(host.style.display).toBe('none');
  });

  it('host display=current value when opened, restores to none on close', () => {
    const host = makeHost();
    const game = makeFakeGame();
    const h = bootstrapEditor({ game, hostElement: host });
    h.open();
    expect(host.style.display).not.toBe('none');
    h.close();
    expect(host.style.display).toBe('none');
  });
});

describe('attachF2Hotkey', () => {
  function makeKeyboardTarget(): { target: EventTarget; dispatchF2(): void; dispatch(key: string): void; detach(): void } {
    const listeners: Array<(e: Event) => void> = [];
    const target: EventTarget = {
      addEventListener: (_type: string, fn: EventListener) => { listeners.push(fn as (e: Event) => void); },
      removeEventListener: (_type: string, fn: EventListener) => {
        const idx = listeners.indexOf(fn as (e: Event) => void);
        if (idx >= 0) listeners.splice(idx, 1);
      },
      dispatchEvent: () => true,
    } as unknown as EventTarget;
    return {
      target,
      dispatchF2: () => listeners.forEach((fn) => fn({ key: 'F2', preventDefault: () => undefined } as unknown as Event)),
      dispatch: (key) => listeners.forEach((fn) => fn({ key, preventDefault: () => undefined } as unknown as Event)),
      detach: () => listeners.splice(0),
    };
  }

  it('F2 toggles editor open/close', () => {
    const host = makeHost();
    const game = makeFakeGame();
    const h = bootstrapEditor({ game, hostElement: host });
    const kb = makeKeyboardTarget();
    attachF2Hotkey(h, kb.target);
    kb.dispatchF2();
    expect(h.isOpen()).toBe(true);
    kb.dispatchF2();
    expect(h.isOpen()).toBe(false);
  });

  it('other keys do not toggle', () => {
    const host = makeHost();
    const game = makeFakeGame();
    const h = bootstrapEditor({ game, hostElement: host });
    const kb = makeKeyboardTarget();
    attachF2Hotkey(h, kb.target);
    kb.dispatch('F1');
    kb.dispatch('Escape');
    expect(h.isOpen()).toBe(false);
  });

  it('returns detach function that removes listener', () => {
    const host = makeHost();
    const game = makeFakeGame();
    const h = bootstrapEditor({ game, hostElement: host });
    const kb = makeKeyboardTarget();
    const detach = attachF2Hotkey(h, kb.target);
    detach();
    kb.dispatchF2();
    expect(h.isOpen()).toBe(false);
  });
});
