/**
 * v3.0 卡牌 Roguelike — 卡组管理器
 *
 * 设计文档:
 *   - design/25-card-roguelike-refactor.md §2.3 抽卡组与手牌机制 / §2.5 卡牌死亡销毁
 *   - design/14-acceptance-criteria.md §3.1 卡组构筑系统
 *
 * 三堆模型（标准 Roguelike Deckbuilding）：
 *   - drawPile     抽牌堆，顶部 = 数组末尾（pop 抽顶 = O(1)）
 *   - discardPile  弃牌堆，法术卡打出后/波末非 persist 卡进此
 *   - removedPile  移除堆，商店「移除卡」/秘境献祭进此，本局不再洗回
 *
 * 卡组耗尽时自动洗 discard → draw（保留 removed 不动）。
 * 洗牌走 deckRandom 流（确定性 PRNG，可复现）。
 *
 * 事件驱动管理器，不实现 System 接口。
 */

import type { GameRandom } from '../utils/Random.js';
import type { CardInstance, DeckState } from './types.js';

export class DeckSystem {
  private readonly rng: GameRandom;
  state: DeckState;

  constructor(rng: GameRandom, initial?: Partial<DeckState>) {
    this.rng = rng;
    this.state = {
      drawPile: initial?.drawPile ? [...initial.drawPile] : [],
      discardPile: initial?.discardPile ? [...initial.discardPile] : [],
      removedPile: initial?.removedPile ? [...initial.removedPile] : [],
    };
  }

  /** 卡组总数（draw + discard，不含 removed） */
  get totalActive(): number {
    return this.state.drawPile.length + this.state.discardPile.length;
  }

  /** 是否还有任何可抽的卡（不算 removed） */
  get hasCards(): boolean {
    return this.totalActive > 0;
  }

  /**
   * 抽一张卡：drawPile 空时自动洗 discardPile 为新 drawPile。
   * 全空（含 discard）时返回 undefined。
   */
  draw(): CardInstance | undefined {
    if (this.state.drawPile.length === 0) {
      if (this.state.discardPile.length === 0) return undefined;
      this.reshuffleDiscardIntoDraw();
    }
    return this.state.drawPile.pop();
  }

  /** 批量抽 n 张（不足则尽量抽）。返回实际抽到的卡序列。 */
  drawMany(n: number): CardInstance[] {
    const out: CardInstance[] = [];
    for (let i = 0; i < n; i++) {
      const c = this.draw();
      if (!c) break;
      out.push(c);
    }
    return out;
  }

  /** 将一张卡放入弃牌堆顶（法术卡打出 / 波末非 persist 卡丢弃 / 手牌满飘字弃牌）。 */
  discard(card: CardInstance): void {
    this.state.discardPile.push(card);
  }

  /** 永久移除一张卡（商店「移除卡」/秘境献祭）。本局不再洗回。 */
  remove(card: CardInstance): void {
    this.state.removedPile.push(card);
  }

  /**
   * 将一张卡放回 drawPile 顶部（特殊法术「英灵召还」等用）。
   * 设计 §2.5 注明：单位/建筑死亡默认 *不* 走这里，避免免费换血。
   */
  returnToDrawTop(card: CardInstance): void {
    this.state.drawPile.push(card);
  }

  /** Fisher-Yates 洗牌，可外部触发（如 Run 开始时打散卡组）。 */
  shuffleDrawPile(): void {
    this.rng.shuffle(this.state.drawPile);
  }

  /**
   * 用现有 deck 数组替换 drawPile（Run 开始时由 RunManager 调用），
   * 同步清空 discard/removed 并洗牌。
   */
  resetWithDeck(cards: readonly CardInstance[]): void {
    this.state.drawPile = [...cards];
    this.state.discardPile = [];
    this.state.removedPile = [];
    this.shuffleDrawPile();
  }

  private reshuffleDiscardIntoDraw(): void {
    this.state.drawPile = this.state.discardPile;
    this.state.discardPile = [];
    this.rng.shuffle(this.state.drawPile);
  }
}
