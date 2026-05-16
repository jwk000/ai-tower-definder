import { describe, it, expect } from 'vitest';

import { buildMainMenu, resolveMainMenuClick, MainMenu, type MainMenuAction } from '../MainMenu.js';

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
    menu.__triggerForTest('start-run');
    menu.__triggerForTest('continue-run');
    expect(got).toEqual(['start-run']);
  });

  it('refresh() updates state so previously disabled action becomes enabled', () => {
    const menu = new MainMenu({ hasSavedRun: false });
    const got: MainMenuAction[] = [];
    menu.setHandler((a) => got.push(a));
    menu.refresh({ hasSavedRun: true });
    menu.__triggerForTest('continue-run');
    expect(got).toEqual(['continue-run']);
  });
});
