import { describe, it, expect } from 'vitest';

import { buildMainMenu, resolveMainMenuClick } from '../MainMenu.js';

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
