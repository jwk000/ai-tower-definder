import type { UnitConfig } from '../factories/UnitFactory.js';

export type CardType = 'unit' | 'spell' | 'trap' | 'production';

export interface CardConfig {
  readonly id: string;
  readonly type: CardType;
  readonly energyCost: number;
  readonly unitConfigId?: string;
  readonly spellEffectId?: string;
}

export class CardRegistry {
  private readonly cards: Map<string, CardConfig> = new Map();
  private readonly units: Map<string, UnitConfig> = new Map();

  registerCard(card: CardConfig): void {
    if (this.cards.has(card.id)) {
      throw new Error(`[CardRegistry] duplicate card id: "${card.id}"`);
    }
    this.cards.set(card.id, card);
  }

  registerUnit(unit: UnitConfig): void {
    this.units.set(unit.id, unit);
  }

  getCard(id: string): CardConfig | undefined {
    return this.cards.get(id);
  }

  getUnit(id: string): UnitConfig | undefined {
    return this.units.get(id);
  }
}
