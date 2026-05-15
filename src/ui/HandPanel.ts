export interface HandCard {
  readonly slot: number;
  readonly cardId: string;
  readonly cost: number;
  readonly playable: boolean;
}

export interface HandState {
  readonly cards: readonly HandCard[];
  readonly energy: number;
}

export interface HandSlotRect {
  readonly slot: number;
  readonly cardId: string;
  readonly cost: number;
  readonly playable: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HandLayout {
  readonly slots: readonly HandSlotRect[];
  readonly energyLabel: string;
}

export type PlayCardIntent =
  | { readonly kind: 'play'; readonly slot: number; readonly cardId: string; readonly targetX: number; readonly targetY: number }
  | { readonly kind: 'cancel'; readonly reason: 'not-playable' | 'over-hand-zone' | 'no-such-slot' };

const HAND_ZONE_HEIGHT = 160;
const SLOT_WIDTH = 120;
const SLOT_HEIGHT = 160;
const SLOT_GAP = 8;

export function layoutHand(state: HandState, viewportWidth: number, viewportHeight: number): HandLayout {
  const totalWidth = state.cards.length * SLOT_WIDTH + Math.max(0, state.cards.length - 1) * SLOT_GAP;
  const startX = (viewportWidth - totalWidth) / 2;
  const y = viewportHeight - SLOT_HEIGHT;
  return {
    slots: state.cards.map((card, i) => ({
      slot: card.slot,
      cardId: card.cardId,
      cost: card.cost,
      playable: card.playable,
      x: startX + i * (SLOT_WIDTH + SLOT_GAP),
      y,
      width: SLOT_WIDTH,
      height: SLOT_HEIGHT,
    })),
    energyLabel: `Energy: ${state.energy}`,
  };
}

export function resolveDropIntent(
  state: HandState,
  slot: number,
  dropX: number,
  dropY: number,
  viewportHeight: number,
): PlayCardIntent {
  const card = state.cards.find((c) => c.slot === slot);
  if (!card) return { kind: 'cancel', reason: 'no-such-slot' };
  if (!card.playable) return { kind: 'cancel', reason: 'not-playable' };
  if (dropY >= viewportHeight - HAND_ZONE_HEIGHT) {
    return { kind: 'cancel', reason: 'over-hand-zone' };
  }
  return { kind: 'play', slot: card.slot, cardId: card.cardId, targetX: dropX, targetY: dropY };
}
