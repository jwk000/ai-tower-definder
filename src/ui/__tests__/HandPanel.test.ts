import { describe, it, expect } from 'vitest';

import { layoutHand, resolveDropIntent, HandPanel, type HandState, type PlayCardIntent } from '../HandPanel.js';

function state(overrides: Partial<HandState> = {}): HandState {
  return {
    energy: 3,
    cards: [
      { slot: 0, cardId: 'arrow_tower', cost: 2, playable: true },
      { slot: 1, cardId: 'shield_guard', cost: 3, playable: true },
      { slot: 2, cardId: 'fireball', cost: 5, playable: false },
    ],
    ...overrides,
  };
}

describe('layoutHand', () => {
  it('centers slots horizontally at the bottom of the viewport', () => {
    const layout = layoutHand(state(), 1920, 1080);
    expect(layout.slots).toHaveLength(3);
    expect(layout.energyLabel).toBe('Energy: 3');
    const totalWidth = 3 * 120 + 2 * 8;
    expect(layout.slots[0]!.x).toBe((1920 - totalWidth) / 2);
    expect(layout.slots[0]!.y).toBe(1080 - 160);
  });

  it('propagates playable flag and cost into slot rect', () => {
    const layout = layoutHand(state(), 1920, 1080);
    expect(layout.slots[2]!.playable).toBe(false);
    expect(layout.slots[2]!.cost).toBe(5);
    expect(layout.slots[2]!.cardId).toBe('fireball');
  });
});

describe('resolveDropIntent', () => {
  it('returns play intent when dropping a playable card outside hand zone', () => {
    const intent = resolveDropIntent(state(), 0, 500, 400, 1080);
    expect(intent).toEqual({ kind: 'play', slot: 0, cardId: 'arrow_tower', targetX: 500, targetY: 400 });
  });

  it('cancels with not-playable when card is not playable', () => {
    const intent = resolveDropIntent(state(), 2, 500, 400, 1080);
    expect(intent).toEqual({ kind: 'cancel', reason: 'not-playable' });
  });

  it('cancels with over-hand-zone when dropping back into the hand bar', () => {
    const intent = resolveDropIntent(state(), 0, 500, 1000, 1080);
    expect(intent).toEqual({ kind: 'cancel', reason: 'over-hand-zone' });
  });

  it('cancels with no-such-slot when slot index does not exist', () => {
    const intent = resolveDropIntent(state(), 99, 500, 400, 1080);
    expect(intent).toEqual({ kind: 'cancel', reason: 'no-such-slot' });
  });
});

describe('HandPanel class wrapper', () => {
  it('invokes handler with play intent when drop is outside hand zone', () => {
    const panel = new HandPanel({ viewportWidth: 1920, viewportHeight: 1080 });
    const got: PlayCardIntent[] = [];
    panel.setHandler((i) => got.push(i));
    panel.refresh(state());
    panel.__triggerForTest(0, 500, 400);
    expect(got).toEqual([{ kind: 'play', slot: 0, cardId: 'arrow_tower', targetX: 500, targetY: 400 }]);
  });

  it('getLayout reflects refreshed state', () => {
    const panel = new HandPanel({ viewportWidth: 1920, viewportHeight: 1080 });
    panel.refresh(state());
    expect(panel.getLayout().slots).toHaveLength(3);
  });
});
