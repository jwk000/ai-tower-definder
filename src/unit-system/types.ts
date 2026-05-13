/**
 * v3.0 卡牌 Roguelike — 运行时数据结构
 *
 * 设计文档:
 *   - design/25-card-roguelike-refactor.md §2 卡牌系统 / §3 关间节点 / §6 Run 结构
 *   - design/13-save-system.md §3 OngoingRun 存档结构
 *   - design/14-acceptance-criteria.md §3.1-§3.5
 *
 * 卡组/手牌/Run 状态因含动态字符串数组与对象池，不适合 bitecs SoA。
 * 这里定义的是纯 TS 接口/类型，由 unit-system/ 下的 manager 类持有。
 */

import type { CardConfig } from '../config/cardRegistry.js';

/**
 * 手牌/卡组中的卡牌实例。
 * 对应 CardConfig（静态定义）的一次具现化，含运行时状态（实例 ID、cardLevel）。
 */
export interface CardInstance {
  /** 实例 ID，本局 Run 内唯一（用于追踪同卡多副本） */
  instanceId: string;
  /** 引用 CardConfig.id —— 通过 cardConfigRegistry.get() 取静态数据 */
  cardId: string;
  /** 卡级（1-3），来自永久卡池基础等级 + 本局商店升级 + 本局技能卡升级 */
  cardLevel: 1 | 2 | 3;
}

/** 卡组三堆状态 —— 标准 Roguelike Deckbuilding 结构 */
export interface DeckState {
  /** 抽牌堆（顶部在数组末尾，pop() 抽顶） */
  drawPile: CardInstance[];
  /** 弃牌堆（打出后/波末弃牌进此） */
  discardPile: CardInstance[];
  /** 移除堆（商店「移除卡」/秘境献祭进此，本局不再参与洗牌） */
  removedPile: CardInstance[];
}

/** 手牌状态 */
export interface HandState {
  /** 当前手牌（顺序与 UI 显示一致，左->右） */
  cards: CardInstance[];
  /** 手牌容量（默认 4，永久升级最高 8） */
  capacity: number;
}

/**
 * Run 进行中状态 —— 跨关卡持久，关间节点是其检查点。
 * 对应 13-save-system §3 OngoingRun 存档结构。
 */
export interface RunState {
  /** Run 内唯一 seed，PRNG 派生 6 流 */
  seed: number;
  /** 当前关卡 1-8，9 = 终战 Boss */
  currentLevel: number;
  /** 当前波次（关内 1-based） */
  currentWave: number;
  /** 水晶 HP（field 名沿用 baseHp 兼容旧存档，见 §0 字段命名说明） */
  crystalHp: number;
  /** 水晶最大 HP（永久升级 + 秘境加固后的值） */
  crystalHpMax: number;
  /** 本局累计金币（关间消费用） */
  gold: number;
  /** 本局击杀总数（结算与成就用） */
  totalKills: number;
}
