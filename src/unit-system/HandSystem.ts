import type { DeckSystem } from './DeckSystem.js';

export interface HandSystemConfig {
  readonly maxSize: number;
}

export class HandSystem {
  private readonly maxSize: number;
  private hand: string[] = [];

  constructor(config: HandSystemConfig) {
    if (!Number.isInteger(config.maxSize) || config.maxSize <= 0) {
      throw new Error(`[HandSystem] maxSize must be a positive integer, got ${config.maxSize}`);
    }
    this.maxSize = config.maxSize;
  }

  get size(): number {
    return this.hand.length;
  }

  get cards(): string[] {
    return [...this.hand];
  }

  drawTo(deck: DeckSystem): void {
    while (this.hand.length < this.maxSize) {
      const card = deck.drawCard();
      if (card === null) return;
      this.hand.push(card);
    }
  }

  playCard(index: number): string | null {
    if (index < 0 || index >= this.hand.length) return null;
    const [removed] = this.hand.splice(index, 1);
    return removed ?? null;
  }

  clear(): void {
    this.hand = [];
  }
}
