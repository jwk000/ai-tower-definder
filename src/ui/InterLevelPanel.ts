export type InterLevelNodeKind = 'shop' | 'mystic' | 'skilltree';

export interface InterLevelOffer {
  readonly id: string;
  readonly kind: InterLevelNodeKind;
  readonly title: string;
  readonly description: string;
}

export interface InterLevelState {
  readonly nextLevel: number;
  readonly offers: readonly [InterLevelOffer, InterLevelOffer, InterLevelOffer];
}

export type InterLevelIntent =
  | { readonly kind: 'enter-node'; readonly offerId: string; readonly node: InterLevelNodeKind }
  | { readonly kind: 'invalid'; readonly reason: 'no-such-offer' };

export function resolveInterLevelChoice(state: InterLevelState, offerId: string): InterLevelIntent {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) return { kind: 'invalid', reason: 'no-such-offer' };
  return { kind: 'enter-node', offerId, node: offer.kind };
}

export interface InterLevelLayoutItem extends InterLevelOffer {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface InterLevelLayout {
  readonly headerLabel: string;
  readonly items: readonly InterLevelLayoutItem[];
}

export function layoutInterLevel(state: InterLevelState, viewportWidth: number, viewportHeight: number): InterLevelLayout {
  const cardW = 320;
  const cardH = 420;
  const gap = 40;
  const totalW = cardW * 3 + gap * 2;
  const startX = (viewportWidth - totalW) / 2;
  const y = (viewportHeight - cardH) / 2;
  return {
    headerLabel: `Choose path to Level ${state.nextLevel}`,
    items: state.offers.map((o, i) => ({
      ...o,
      x: startX + i * (cardW + gap),
      y,
      width: cardW,
      height: cardH,
    })),
  };
}

export function hitTestInterLevel(layout: InterLevelLayout, px: number, py: number): string | null {
  for (const item of layout.items) {
    if (px >= item.x && px <= item.x + item.width && py >= item.y && py <= item.y + item.height) {
      return item.id;
    }
  }
  return null;
}

export type InterLevelHandler = (intent: InterLevelIntent) => void;

export class InterLevelPanel {
  private state: InterLevelState | null = null;
  private handler: InterLevelHandler | null = null;

  setHandler(handler: InterLevelHandler): void {
    this.handler = handler;
  }

  refresh(state: InterLevelState): void {
    this.state = state;
  }

  trigger(offerId: string): void {
    if (!this.state) return;
    const intent = resolveInterLevelChoice(this.state, offerId);
    this.handler?.(intent);
  }
}
