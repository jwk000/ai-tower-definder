/**
 * v3.0 卡牌 Roguelike — 手牌管理器
 *
 * 设计文档:
 *   - design/25-card-roguelike-refactor.md §2.3 抽卡组与手牌机制 / §11 边界条款 #1/#3/#6
 *   - design/14-acceptance-criteria.md §3.2 手牌系统
 *
 * 关键规则：
 *   - 默认手牌上限 4，每张「手牌扩容」永久升级 +1，最高 8
 *   - 每波开始 refillHand()：从 DeckSystem 抽到补满当前手牌上限
 *   - 抽到时手牌已满 → 该卡直接进弃牌堆 + 触发「手牌已满」飘字回调（设计 §11 #6）
 *   - 波末 discardOnWaveEnd()：persistAcrossWaves=false 进弃牌堆，true 留手牌（如「时停」类高威能法术）
 *   - play()：玩家拖卡部署，从手牌移除；调用方负责扣能量和判断是否丢入弃牌堆（法术）或销毁（单位卡死亡）
 *
 * 依赖 DeckSystem 与 CardConfigRegistry（用于判断 persistAcrossWaves 标记）。
 * 事件驱动管理器，不实现 System 接口。
 */

import type { DeckSystem } from './DeckSystem.js';
import type { CardInstance, HandState } from './types.js';

/** 默认手牌上限（设计 §2.3） */
export const HAND_CAPACITY_DEFAULT = 4;
/** 永久升级后最高手牌上限（设计 §2.3，每次升级 +1，最多 4 次） */
export const HAND_CAPACITY_MAX = 8;
/** 每个新 Run 开始前的开局抽牌数 = 默认手牌上限 */
export const HAND_INITIAL_DRAW = HAND_CAPACITY_DEFAULT;

export interface HandSystemHooks {
  /** 设计 §11 #6：抽到时手牌已满 → 屏幕飘字。由 UI 层接入。 */
  onHandFullDiscard?: (card: CardInstance) => void;
}

export interface HandSystemOptions {
  capacity?: number;
  initial?: readonly CardInstance[];
  hooks?: HandSystemHooks;
  /**
   * 判定一张卡是否跨波保留。
   * 默认实现：返回 false（保持回归安全，调用方应注入根据 CardConfig 查询的实现）。
   */
  isPersistAcrossWaves?: (card: CardInstance) => boolean;
}

export class HandSystem {
  state: HandState;
  private hooks: HandSystemHooks;
  private isPersist: (card: CardInstance) => boolean;

  constructor(opts: HandSystemOptions = {}) {
    const capacity = clampCapacity(opts.capacity ?? HAND_CAPACITY_DEFAULT);
    this.state = {
      hand: opts.initial ? [...opts.initial] : [],
      capacity,
    };
    this.hooks = opts.hooks ?? {};
    this.isPersist = opts.isPersistAcrossWaves ?? (() => false);
  }

  get size(): number {
    return this.state.hand.length;
  }

  get capacity(): number {
    return this.state.capacity;
  }

  get isFull(): boolean {
    return this.size >= this.capacity;
  }

  /** 设置 / 注入 persistAcrossWaves 判定（运行时由 RunManager 接入 CardConfigRegistry）。 */
  setPersistResolver(fn: (card: CardInstance) => boolean): void {
    this.isPersist = fn;
  }

  /**
   * 单张抽牌入手：
   *   - 手牌未满 → 入手返 true
   *   - 手牌已满 → 直接入 deck.discardPile + 触发飘字回调，返 false（设计 §11 #6）
   */
  drawOne(deck: DeckSystem): boolean {
    const card = deck.draw();
    if (!card) return false;
    return this.acceptCard(card, deck);
  }

  /**
   * 补满手牌至当前 capacity（每波开始调用）。
   * 卡组耗尽时尽量补，不抛错。返回实际加入手牌的张数。
   */
  refillHand(deck: DeckSystem): number {
    let added = 0;
    while (this.size < this.capacity) {
      const card = deck.draw();
      if (!card) break;
      const accepted = this.acceptCard(card, deck);
      if (accepted) added++;
    }
    return added;
  }

  /**
   * 玩家拖卡打出 / 部署 → 从手牌移除。
   * 调用方根据 CardConfig.type 决定是否进 deck.discard（法术）或自定义流程（单位/建筑）。
   * @returns 被打出的卡，未找到返回 undefined
   */
  play(instanceId: string): CardInstance | undefined {
    const idx = this.state.hand.findIndex((c) => c.instanceId === instanceId);
    if (idx < 0) return undefined;
    const [card] = this.state.hand.splice(idx, 1);
    return card;
  }

  /**
   * 波末清理：persistAcrossWaves=true 留手牌，其余进 deck.discardPile。
   * @returns 被弃入弃牌堆的卡数（用于 UI 反馈）
   */
  discardOnWaveEnd(deck: DeckSystem): number {
    const kept: CardInstance[] = [];
    let discarded = 0;
    for (const card of this.state.hand) {
      if (this.isPersist(card)) {
        kept.push(card);
      } else {
        deck.discard(card);
        discarded++;
      }
    }
    this.state.hand = kept;
    return discarded;
  }

  /**
   * 永久升级提升手牌上限（限 4-8）。
   * 当前手牌不会因为提升 capacity 自动补抽（由调用方决定是否触发 refillHand）。
   */
  setCapacity(newCap: number): void {
    this.state.capacity = clampCapacity(newCap);
  }

  /** 完整重置（新 Run 开始）。 */
  reset(capacity: number = HAND_CAPACITY_DEFAULT): void {
    this.state.hand = [];
    this.state.capacity = clampCapacity(capacity);
  }

  private acceptCard(card: CardInstance, deck: DeckSystem): boolean {
    if (this.isFull) {
      deck.discard(card);
      this.hooks.onHandFullDiscard?.(card);
      return false;
    }
    this.state.hand.push(card);
    return true;
  }
}

function clampCapacity(n: number): number {
  if (!Number.isFinite(n)) return HAND_CAPACITY_DEFAULT;
  return Math.max(HAND_CAPACITY_DEFAULT, Math.min(HAND_CAPACITY_MAX, Math.floor(n)));
}
