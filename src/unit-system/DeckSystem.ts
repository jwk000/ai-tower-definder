export interface DeckSystemConfig {
  readonly pool: readonly string[];
  readonly deckSize: number;
  readonly rng: () => number;
}

export class DeckSystem {
  private readonly pool: readonly string[];
  private readonly deckSize: number;
  private readonly rng: () => number;
  private drawPile: string[] = [];
  private discardPile: string[] = [];

  constructor(config: DeckSystemConfig) {
    if (config.pool.length === 0) {
      throw new Error('[DeckSystem] empty pool');
    }
    if (!Number.isInteger(config.deckSize) || config.deckSize <= 0) {
      throw new Error(`[DeckSystem] deckSize must be a positive integer, got ${config.deckSize}`);
    }
    this.pool = config.pool;
    this.deckSize = config.deckSize;
    this.rng = config.rng;
    this.buildDeck();
  }

  get drawPileSize(): number {
    return this.drawPile.length;
  }

  get discardPileSize(): number {
    return this.discardPile.length;
  }

  drawCard(): string | null {
    if (this.drawPile.length === 0) {
      if (this.discardPile.length === 0) return null;
      this.reshuffle();
    }
    return this.drawPile.shift() ?? null;
  }

  discard(card: string): void {
    this.discardPile.push(card);
  }

  previewDrawPile(): string[] {
    return [...this.drawPile];
  }

  reset(): void {
    this.discardPile = [];
    this.buildDeck();
  }

  private buildDeck(): void {
    this.drawPile = [];
    for (let i = 0; i < this.deckSize; i += 1) {
      const idx = Math.floor(this.rng() * this.pool.length);
      const safeIdx = idx < this.pool.length ? idx : this.pool.length - 1;
      this.drawPile.push(this.pool[safeIdx]!);
    }
  }

  private reshuffle(): void {
    // Fisher-Yates over the discard pile, then move it into the draw pile
    const arr = this.discardPile;
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng() * (i + 1));
      const safeJ = j <= i ? j : i;
      const tmp = arr[i]!;
      arr[i] = arr[safeJ]!;
      arr[safeJ] = tmp;
    }
    this.drawPile = arr;
    this.discardPile = [];
  }
}
