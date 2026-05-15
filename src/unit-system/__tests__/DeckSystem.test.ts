import { describe, expect, it } from 'vitest';

import { DeckSystem } from '../DeckSystem.js';

const POOL = ['arrow_tower', 'shield_guard', 'spike_trap', 'fireball', 'gold_mine'];

function makeRng(sequence: number[]): () => number {
  let i = 0;
  return () => {
    const v = sequence[i % sequence.length] ?? 0;
    i += 1;
    return v;
  };
}

describe('DeckSystem', () => {
  it('builds a deck of the configured size by sampling the pool with the injected RNG', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 5, rng: makeRng([0, 0.25, 0.5, 0.75, 0.99]) });
    expect(deck.drawPileSize).toBe(5);
    expect(deck.discardPileSize).toBe(0);
  });

  it('drawCard removes the top of the draw pile and returns it', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.5, 0.99]) });
    const expected = [...deck.previewDrawPile()];
    const first = deck.drawCard();
    expect(first).toBe(expected[0]);
    expect(deck.drawPileSize).toBe(2);
  });

  it('drawCard returns null when both piles are empty', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 1, rng: makeRng([0]) });
    deck.drawCard();
    expect(deck.drawCard()).toBeNull();
  });

  it('discard moves a card into the discard pile', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.5, 0.99]) });
    const drawn = deck.drawCard()!;
    deck.discard(drawn);
    expect(deck.discardPileSize).toBe(1);
  });

  it('drawCard reshuffles the discard pile back into the draw pile when draw is empty', () => {
    const deck = new DeckSystem({
      pool: POOL,
      deckSize: 2,
      rng: makeRng([0, 0.5, 0.1, 0.7, 0.2, 0.8]),
    });
    const a = deck.drawCard()!;
    const b = deck.drawCard()!;
    expect(deck.drawCard()).toBeNull();
    deck.discard(a);
    deck.discard(b);
    expect(deck.drawPileSize).toBe(0);
    expect(deck.discardPileSize).toBe(2);

    const c = deck.drawCard();
    expect(c).not.toBeNull();
    expect(deck.drawPileSize + deck.discardPileSize).toBe(1);
  });

  it('reshuffle is deterministic given the same RNG seed', () => {
    const deckA = new DeckSystem({
      pool: POOL,
      deckSize: 3,
      rng: makeRng([0.1, 0.3, 0.6, 0.2, 0.4, 0.7]),
    });
    const deckB = new DeckSystem({
      pool: POOL,
      deckSize: 3,
      rng: makeRng([0.1, 0.3, 0.6, 0.2, 0.4, 0.7]),
    });
    const seqA = [deckA.drawCard(), deckA.drawCard(), deckA.drawCard()];
    const seqB = [deckB.drawCard(), deckB.drawCard(), deckB.drawCard()];
    expect(seqA).toEqual(seqB);
  });

  it('rejects an empty pool', () => {
    expect(() => new DeckSystem({ pool: [], deckSize: 3, rng: () => 0 })).toThrow(/empty pool/i);
  });

  it('rejects a non-positive deckSize', () => {
    expect(() => new DeckSystem({ pool: POOL, deckSize: 0, rng: () => 0 })).toThrow(/deckSize/i);
  });

  it('previewDrawPile returns a copy that does not mutate the deck', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.5, 0.99]) });
    const preview = deck.previewDrawPile();
    preview.length = 0;
    expect(deck.drawPileSize).toBe(3);
  });

  it('reset rebuilds the draw pile from scratch and clears discard', () => {
    const deck = new DeckSystem({ pool: POOL, deckSize: 3, rng: makeRng([0, 0.3, 0.6, 0.1, 0.4, 0.7]) });
    const a = deck.drawCard()!;
    deck.discard(a);
    deck.reset();
    expect(deck.drawPileSize).toBe(3);
    expect(deck.discardPileSize).toBe(0);
  });
});
