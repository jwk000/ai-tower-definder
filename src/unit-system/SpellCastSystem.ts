import type { TowerWorld } from '../core/World.js';
import type { CardRegistry } from './CardRegistry.js';

export interface SpellCastPosition {
  readonly x: number;
  readonly y: number;
}

export class SpellCastSystem {
  constructor(private readonly registry: CardRegistry) {}

  cast(world: TowerWorld, cardId: string, position: SpellCastPosition): boolean {
    const card = this.registry.getCard(cardId);
    if (!card) return false;
    if (card.type !== 'spell') return false;

    if (!card.spellEffectId) {
      throw new Error(`[SpellCastSystem] card "${cardId}" has no spellEffectId`);
    }
    const handler = world.ruleEngine.getHandler(card.spellEffectId);
    if (!handler) {
      throw new Error(`[SpellCastSystem] handler "${card.spellEffectId}" not registered`);
    }
    handler(-1, { position }, world);
    return true;
  }
}
