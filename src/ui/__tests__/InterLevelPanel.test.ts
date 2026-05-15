import { describe, it, expect } from 'vitest';

import {
  layoutInterLevel,
  resolveInterLevelChoice,
  type InterLevelState,
} from '../InterLevelPanel.js';

function state(): InterLevelState {
  return {
    nextLevel: 2,
    offers: [
      { id: 'a', kind: 'shop', title: 'Shop', description: 'buy cards' },
      { id: 'b', kind: 'mystic', title: 'Mystic Event', description: 'risk reward' },
      { id: 'c', kind: 'skilltree', title: 'Skill Tree', description: 'spend SP' },
    ],
  };
}

describe('layoutInterLevel', () => {
  it('centers three cards horizontally with the configured gap', () => {
    const layout = layoutInterLevel(state(), 1920, 1080);
    expect(layout.items).toHaveLength(3);
    expect(layout.headerLabel).toBe('Choose path to Level 2');
    const totalW = 320 * 3 + 40 * 2;
    expect(layout.items[0]!.x).toBe((1920 - totalW) / 2);
  });
});

describe('resolveInterLevelChoice', () => {
  it('returns enter-node with kind when offerId matches', () => {
    expect(resolveInterLevelChoice(state(), 'b')).toEqual({
      kind: 'enter-node', offerId: 'b', node: 'mystic',
    });
  });

  it('returns invalid when offerId does not exist', () => {
    expect(resolveInterLevelChoice(state(), 'nope')).toEqual({
      kind: 'invalid', reason: 'no-such-offer',
    });
  });

  it('preserves kind per offer (shop / mystic / skilltree)', () => {
    expect(resolveInterLevelChoice(state(), 'a')).toMatchObject({ node: 'shop' });
    expect(resolveInterLevelChoice(state(), 'b')).toMatchObject({ node: 'mystic' });
    expect(resolveInterLevelChoice(state(), 'c')).toMatchObject({ node: 'skilltree' });
  });
});
