import { describe, it, expect, beforeEach } from 'vitest';
import { bootstrapEditor, type EditorHandle } from '../index.js';
import type { Game } from '../../core/Game.js';

function makeFakeGame(): Game {
  return { paused: false } as unknown as Game;
}

function makeHost(): HTMLElement {
  const el = { tagName: 'DIV' } as unknown as HTMLElement;
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
