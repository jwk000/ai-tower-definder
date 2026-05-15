import { describe, it, expect } from 'vitest';

import { attemptPurchase, applyPurchase, type ShopState } from '../ShopPanel.js';

function state(overrides: Partial<ShopState> = {}): ShopState {
  return {
    gold: 100,
    sp: 5,
    items: [
      { id: 'card_arrow', kind: 'unit-card', label: 'Arrow Tower Card', costGold: 50, grantsCardId: 'arrow_tower', stock: 1 },
      { id: 'sp_pack', kind: 'sp-exchange', label: 'Spark Pack', costGold: 30, grantsSP: 2, stock: 3 },
      { id: 'card_shield', kind: 'unit-card', label: 'Shield Guard Card', costGold: 80, grantsCardId: 'shield_guard', stock: 0 },
    ],
    ...overrides,
  };
}

describe('attemptPurchase', () => {
  it('buys a unit card: deducts gold, grants card, leaves sp unchanged', () => {
    expect(attemptPurchase(state(), 'card_arrow')).toEqual({
      kind: 'success', newGold: 50, newSp: 5, grantsCardId: 'arrow_tower', itemId: 'card_arrow',
    });
  });

  it('redeems sp pack: deducts gold, grants sp, no card', () => {
    expect(attemptPurchase(state(), 'sp_pack')).toEqual({
      kind: 'success', newGold: 70, newSp: 7, grantsCardId: undefined, itemId: 'sp_pack',
    });
  });

  it('rejects with insufficient-gold when gold below cost', () => {
    expect(attemptPurchase(state({ gold: 10 }), 'card_arrow')).toEqual({
      kind: 'rejected', reason: 'insufficient-gold',
    });
  });

  it('rejects with out-of-stock for stock=0 item', () => {
    expect(attemptPurchase(state(), 'card_shield')).toEqual({
      kind: 'rejected', reason: 'out-of-stock',
    });
  });

  it('rejects with no-such-item for unknown id', () => {
    expect(attemptPurchase(state(), 'nope')).toEqual({
      kind: 'rejected', reason: 'no-such-item',
    });
  });
});

describe('applyPurchase', () => {
  it('decrements stock and updates gold/sp on success', () => {
    const { state: next, result } = applyPurchase(state(), 'sp_pack');
    expect(result.kind).toBe('success');
    expect(next.gold).toBe(70);
    expect(next.sp).toBe(7);
    expect(next.items.find((i) => i.id === 'sp_pack')!.stock).toBe(2);
  });

  it('returns state unchanged on rejection', () => {
    const original = state({ gold: 10 });
    const { state: next, result } = applyPurchase(original, 'card_arrow');
    expect(result.kind).toBe('rejected');
    expect(next).toBe(original);
  });
});
