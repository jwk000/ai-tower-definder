import { describe, expect, it } from 'vitest';

import { DeckSystem } from '../DeckSystem.js';
import { HandSystem } from '../HandSystem.js';

const POOL = ['arrow_tower', 'shield_guard', 'spike_trap', 'fireball', 'gold_mine'];

function makeDeck(deckSize = 8): DeckSystem {
  let seed = 0;
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return new DeckSystem({ pool: POOL, deckSize, rng });
}

describe('HandSystem', () => {
  it('starts empty', () => {
    const hand = new HandSystem({ maxSize: 4 });
    expect(hand.size).toBe(0);
    expect(hand.cards).toEqual([]);
  });

  it('drawTo fills the hand to maxSize from the deck', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    expect(hand.size).toBe(4);
  });

  it('drawTo does nothing once hand is already full', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    const drawnFirstPass = deck.drawPileSize;
    hand.drawTo(deck);
    expect(hand.size).toBe(4);
    expect(deck.drawPileSize).toBe(drawnFirstPass);
  });

  it('drawTo stops cleanly when the deck cannot refill the hand', () => {
    const deck = makeDeck(2);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    expect(hand.size).toBe(2);
    expect(deck.drawPileSize).toBe(0);
  });

  it('playCard removes the card from the hand and returns it', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    const first = hand.cards[0]!;
    const played = hand.playCard(0);
    expect(played).toBe(first);
    expect(hand.size).toBe(3);
  });

  it('playCard with out-of-range index returns null', () => {
    const hand = new HandSystem({ maxSize: 4 });
    expect(hand.playCard(0)).toBeNull();
    expect(hand.playCard(-1)).toBeNull();
  });

  it('when hand is full, drawTo routes overflow cards into the deck discard', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    const before = deck.discardPileSize;

    hand.drawTo(deck);
    expect(deck.discardPileSize).toBe(before);
    expect(hand.size).toBe(4);
  });

  it('rejects non-positive maxSize', () => {
    expect(() => new HandSystem({ maxSize: 0 })).toThrow(/maxSize/i);
  });

  it('cards getter returns a defensive copy', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    const snapshot = hand.cards;
    snapshot.length = 0;
    expect(hand.size).toBe(4);
  });

  it('clear empties the hand without touching the deck', () => {
    const deck = makeDeck(8);
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    const drawBefore = deck.drawPileSize;
    const discardBefore = deck.discardPileSize;

    hand.clear();
    expect(hand.size).toBe(0);
    expect(deck.drawPileSize).toBe(drawBefore);
    expect(deck.discardPileSize).toBe(discardBefore);
  });
});
