/**
 * v3.0 卡牌 Roguelike — Run 运行时上下文
 *
 * 设计文档:
 *   - design/25-card-roguelike-refactor.md §2-§6 卡牌/Run 系统
 *   - design/14-acceptance-criteria.md §3.1-§3.3
 *   - design/15-refactoring-plan.md Phase A3 集成层
 *
 * 把 RunManager / EnergySystem / DeckSystem / HandSystem 4 个事件驱动管理器
 * 与对应 PRNG 流绑成一个上下文对象，挂在 TowerWorld.runContext 上。
 *
 * 设计动机：
 *   - 4 个管理器互相协作（如 startWaveEffect 同时调 energy.startWave() + hand.refillHand(deck)），
 *     由 RunContext 统一封装事件分发，避免调用方拼装错误
 *   - 与 ECS World 同生命周期：World.reset() 时由 main.ts 显式 attachRunContext 重建
 *   - 容错初始化：cardConfigRegistry 为空（YAML 尚未加载完）时 initRun 静默 fallback，
 *     deck 留空。等 Phase A4 UI 装配后再决定异步加载流程
 *
 * 调用方约定：
 *   - main.ts initBattle: 调 createRunContext(seed) → world.attachRunContext()
 *   - WaveSystem.startWave: 调 runContext.startWaveEffect()
 *   - WaveSystem.onWaveComplete: 调 runContext.endWaveEffect()
 *   - 卡牌 UI 出卡: 调 runContext.play(instanceId) → 返回 CardConfig（或 null 表示能量不足）
 */

import { cardConfigRegistry, type CardConfigRegistry, type CardConfig } from '../config/cardRegistry.js';
import { createRandomStreams, GameRandom, type RandomStreams } from '../utils/Random.js';
import { DeckSystem } from './DeckSystem.js';
import { EnergySystem } from './EnergySystem.js';
import { HandSystem } from './HandSystem.js';
import { RunManager } from './RunManager.js';
import type { CardInstance } from './types.js';

export interface RunContext {
  /** Run 全局 seed */
  seed: number;
  /** 6 流 PRNG（wave/drop/deco/loot/deck/mystic） */
  streams: RandomStreams;
  /** Run 状态与生命周期 */
  run: RunManager;
  /** 关内能量（出卡资源） */
  energy: EnergySystem;
  /** 三堆卡组 */
  deck: DeckSystem;
  /** 手牌区 */
  hand: HandSystem;
  /** 卡配置查询，UI/AttackSystem 等需要按 cardId 取静态数据时用 */
  registry: CardConfigRegistry;
}

export interface CreateRunContextOptions {
  seed?: number;
  registry?: CardConfigRegistry;
  /** 永久升级后的水晶 HP 上限（默认 100） */
  crystalHpMax?: number;
  /** 永久升级后的手牌上限（默认 4，最高 8） */
  handCapacity?: number;
  /** 永久升级后的能量上限（默认 10，最高 12） */
  energyMax?: number;
}

/**
 * 创建一个完整 RunContext 并执行 initRun（抽 12 张装入 deck）。
 *
 * 容错策略：registry 为空时 deck 留空，不抛错；调用方应在 UI 层提示"卡池未加载"
 * 或在 Phase A4 异步加载完毕后调用 reinitDeck()。
 */
export function createRunContext(opts: CreateRunContextOptions = {}): RunContext {
  const seed = opts.seed ?? (Math.random() * 0xffffffff) >>> 0;
  const streams = createRandomStreams(seed);
  const registry = opts.registry ?? cardConfigRegistry;

  const run = new RunManager({
    registry,
    rng: streams.deck,
    seed,
    crystalHpMax: opts.crystalHpMax,
  });
  const energy = new EnergySystem({ max: opts.energyMax });
  const deck = new DeckSystem(streams.deck);
  const hand = new HandSystem({ capacity: opts.handCapacity });

  hand.setPersistResolver(makePersistResolver(registry));

  if (registry.size > 0) {
    const { cards } = run.initRun();
    deck.resetWithDeck(cards);
  }

  return { seed, streams, run, energy, deck, hand, registry };
}

/**
 * 每波开始事件：恢复能量 + 补满手牌。
 * 返回此次实际恢复的能量与新加手牌的卡数（用于 UI 飘字 / 调试日志）。
 */
export function startWaveEffect(ctx: RunContext): { energyGained: number; cardsDrawn: number } {
  const energyGained = ctx.energy.startWave();
  const cardsDrawn = ctx.hand.refillHand(ctx.deck);
  return { energyGained, cardsDrawn };
}

/**
 * 每波结束事件：按 persistAcrossWaves 弃手牌。
 * 返回此次实际弃入弃牌堆的卡数。
 */
export function endWaveEffect(ctx: RunContext): { discarded: number } {
  const discarded = ctx.hand.discardOnWaveEnd(ctx.deck);
  return { discarded };
}

/**
 * 玩家出卡（拖卡到地图 / 点击出卡按钮）。
 *
 * 综合检查能量是否够 + 手牌是否含此 instanceId + 注册表是否有 CardConfig。
 * 任一失败返回 null，不修改任何状态。成功则：
 *   1. 从手牌移除该卡
 *   2. 扣能量
 *   3. 若卡 type=spell → 入弃牌堆；type=unit → 调用方负责后续（部署到战场，死亡时不回弃牌堆）
 *
 * @returns 出卡成功时返回 { instance, config }；失败返回 null
 */
export function playCard(
  ctx: RunContext,
  instanceId: string,
): { instance: CardInstance; config: CardConfig } | null {
  const card = ctx.hand.state.hand.find((c) => c.instanceId === instanceId);
  if (!card) return null;
  const config = ctx.registry.get(card.cardId);
  if (!config) return null;
  if (!ctx.energy.canAfford(config.energyCost)) return null;

  const played = ctx.hand.play(instanceId);
  if (!played) return null;
  ctx.energy.spend(config.energyCost);

  if (config.type === 'spell') {
    ctx.deck.discard(played);
  }
  return { instance: played, config };
}

/**
 * 通过 CardConfigRegistry 构造 persistAcrossWaves 判定函数。
 * 闭包捕获 registry 引用，registry 后续 register 新卡也能查到（动态扩展友好）。
 */
function makePersistResolver(registry: CardConfigRegistry): (card: CardInstance) => boolean {
  return (card) => registry.get(card.cardId)?.persistAcrossWaves === true;
}
