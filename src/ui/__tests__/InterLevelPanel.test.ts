import { describe, it, expect } from 'vitest';

import {
  hitTestInterLevel,
  layoutInterLevel,
  resolveInterLevelChoice,
  InterLevelPanel,
  type InterLevelState,
  type InterLevelIntent,
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

describe('InterLevelPanel class wrapper', () => {
  it('triggers handler with enter-node intent when offerId matches', () => {
    const panel = new InterLevelPanel();
    const got: InterLevelIntent[] = [];
    panel.setHandler((i) => got.push(i));
    panel.refresh(state());
    panel.trigger('b');
    expect(got).toEqual([{ kind: 'enter-node', offerId: 'b', node: 'mystic' }]);
  });

  it('returns invalid intent when offerId not found', () => {
    const panel = new InterLevelPanel();
    const got: InterLevelIntent[] = [];
    panel.setHandler((i) => got.push(i));
    panel.refresh(state());
    panel.trigger('nope');
    expect(got).toEqual([{ kind: 'invalid', reason: 'no-such-offer' }]);
  });
});

describe('hitTestInterLevel (Wave 8.2 Pixi 事件链)', () => {
  it('点击中心命中对应 offer', () => {
    const layout = layoutInterLevel(state(), 1344, 576);
    for (const item of layout.items) {
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      expect(hitTestInterLevel(layout, cx, cy)).toBe(item.id);
    }
  });

  it('点击空白返回 null', () => {
    const layout = layoutInterLevel(state(), 1344, 576);
    expect(hitTestInterLevel(layout, 0, 0)).toBeNull();
    expect(hitTestInterLevel(layout, 1343, 575)).toBeNull();
  });

  it('点击 offer 之间的间隙返回 null', () => {
    const layout = layoutInterLevel(state(), 1344, 576);
    const first = layout.items[0]!;
    const gapX = first.x + first.width + 10;
    const cy = first.y + first.height / 2;
    expect(hitTestInterLevel(layout, gapX, cy)).toBeNull();
  });
});
