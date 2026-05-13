/**
 * Card Configuration Registry
 *
 * 对应设计文档:
 * - design/25-card-roguelike-refactor.md §2 卡牌系统
 * - design/02-unit-system.md §8 卡牌生成入口
 * - design/03-unit-data.md §8 卡牌目录
 *
 * CardConfig 是卡牌的不可变静态定义，运行时状态（手牌位置、cardLevel、
 * 实例升级修正等）存储在 ECS 组件中，不进 CardConfig。
 */

export type CardType = 'unit' | 'spell';

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type CardSpellSubtype =
  | 'damage'
  | 'control'
  | 'buff_instance'
  | 'buff_card'
  | 'utility';

export type CardPlacementTarget =
  | 'tile'
  | 'enemy'
  | 'ally'
  | 'area'
  | 'global';

export type CardPlacementRange =
  | 'cursor'
  | 'path'
  | 'anywhere'
  | 'left-half'
  | 'right-half';

export interface CardPlacement {
  targetType: CardPlacementTarget;
  range?: CardPlacementRange;
}

export interface CardConfig {
  id: string;
  name: string;
  type: CardType;
  energyCost: number;
  rarity: CardRarity;

  unitConfigId?: string;

  spellEffectId?: string;
  spellSubtype?: CardSpellSubtype;

  placement: CardPlacement;

  persistAcrossWaves?: boolean;

  description?: string;
  flavorText?: string;

  [extras: string]: unknown;
}

export class CardConfigRegistry {
  private readonly configs = new Map<string, CardConfig>();

  register(config: CardConfig): void {
    this.configs.set(config.id, config);
  }

  get(id: string): CardConfig | undefined {
    return this.configs.get(id);
  }

  getAll(): CardConfig[] {
    return [...this.configs.values()];
  }

  getByType(type: CardType): CardConfig[] {
    return [...this.configs.values()].filter((c) => c.type === type);
  }

  getByRarity(rarity: CardRarity): CardConfig[] {
    return [...this.configs.values()].filter((c) => c.rarity === rarity);
  }

  get size(): number {
    return this.configs.size;
  }

  clear(): void {
    this.configs.clear();
  }
}

export const cardConfigRegistry = new CardConfigRegistry();
