/**
 * v3.0 卡牌 Roguelike — Run 生命周期管理器
 *
 * 设计文档:
 *   - design/25-card-roguelike-refactor.md §2.2 永久卡池抽卡 / §6 Run 结构 / §11 边界条款
 *   - design/13-save-system.md §3 OngoingRun 存档结构
 *   - design/14-acceptance-criteria.md §3.1 卡组构筑系统 / §3.5 跨关流程
 *
 * 职责：
 *   - initRun(): 按稀有度权重从「永久解锁卡池」抽 12 张构成本局卡组（设计 §2.2）
 *     - 权重：Common 60% / Rare 25% / Epic 12% / Legendary 3%
 *     - 保底：尽力而为 —— 每个 CardType（unit/spell）在卡池中存在时至少出 1 张
 *   - 维护 RunState（关卡进度 / 水晶 HP / 金币 / 击杀），关间存档由 PermanentSaveSystem 接管
 *   - 推进关卡：advanceToNextLevel() / startNewWave() / endRun()
 *
 * PRNG：使用 deckRandom 流抽 12 张（确定性可复现，调试与回放友好）。
 * 事件驱动管理器，不实现 System 接口。
 */

import type { CardConfig, CardConfigRegistry, CardRarity, CardType } from '../config/cardRegistry.js';
import type { GameRandom } from '../utils/Random.js';
import type { CardInstance, RunState } from './types.js';

/** 设计 §2.2 抽卡权重 (Common/Rare/Epic/Legendary)，加和必须 = 100 */
export const RARITY_WEIGHTS: Record<CardRarity, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 3,
};

/** 设计 §2.2 开局卡组规模（固定 12 张，不可由用户调整） */
export const RUN_DECK_SIZE = 12;

/**
 * 设计 §2.2 保底类型清单。当前 CardType 只有 unit/spell（building 归 unit 子类）。
 * Phase B 法术卡上线后，此清单语义不变；卡池中某类型为空时跳过其保底。
 */
export const GUARANTEED_TYPES: readonly CardType[] = ['unit', 'spell'] as const;

export interface RunManagerOptions {
  registry: CardConfigRegistry;
  rng: GameRandom;
  seed: number;
  crystalHpMax?: number;
}

export interface InitRunResult {
  cards: CardInstance[];
  state: RunState;
}

export class RunManager {
  private readonly registry: CardConfigRegistry;
  private readonly rng: GameRandom;
  state: RunState;
  /** 实例 ID 自增计数器，本局 Run 内唯一（用于 CardInstance.instanceId） */
  private instanceCounter = 0;

  constructor(opts: RunManagerOptions) {
    this.registry = opts.registry;
    this.rng = opts.rng;
    this.state = {
      seed: opts.seed,
      currentLevel: 1,
      currentWave: 0,
      crystalHp: opts.crystalHpMax ?? 100,
      crystalHpMax: opts.crystalHpMax ?? 100,
      gold: 0,
      totalKills: 0,
    };
  }

  /**
   * 从永久卡池抽 12 张构成本局卡组。
   *
   * 算法（设计 §2.2 + §11 #2 防御保底冲突）：
   *   1. 按权重抽满 RUN_DECK_SIZE 张
   *   2. 检查保底：每个 GUARANTEED_TYPES 类型在卡池中存在但本次抽中 0 张时，
   *      从卡池随机选 1 张该类型卡，替换掉抽中数量最多的非保底类型中的一张
   *   3. 卡池不足 12 张时，允许重复抽（设计意图：永久卡池起步即包含所有基础卡，
   *      Phase A 初期可能不足 12 种，允许重复以保证 Run 能开起来）
   */
  initRun(): InitRunResult {
    const pool = this.registry.getAll();
    if (pool.length === 0) {
      throw new Error('[RunManager] CardConfigRegistry 为空，无法抽卡');
    }

    const drawn = this.drawWeightedDeck(pool, RUN_DECK_SIZE);
    this.enforceTypeGuarantees(drawn, pool);

    const cards = drawn.map((cfg) => this.materialize(cfg));
    return { cards, state: this.state };
  }

  /** 推进到下一关（关间节点决议后调用） */
  advanceToNextLevel(): number {
    this.state.currentLevel += 1;
    this.state.currentWave = 0;
    return this.state.currentLevel;
  }

  /** 关内推进波次（由 WaveSystem 触发） */
  startNewWave(): number {
    this.state.currentWave += 1;
    return this.state.currentWave;
  }

  /** 累加击杀（结算/成就用） */
  addKills(n: number): void {
    if (n > 0) this.state.totalKills += n;
  }

  /** 加减金币（关间消费 / 战斗掉落），不允许跌破 0 */
  addGold(delta: number): number {
    this.state.gold = Math.max(0, this.state.gold + delta);
    return this.state.gold;
  }

  /** 水晶 HP 扣减（敌人到达终点）。返回剩余 HP，<=0 时调用方应判负 */
  damageCrystal(amount: number): number {
    if (amount > 0) this.state.crystalHp = Math.max(0, this.state.crystalHp - amount);
    return this.state.crystalHp;
  }

  /** 水晶 HP 恢复（秘境节点等），上限 crystalHpMax */
  healCrystal(amount: number): number {
    if (amount > 0) {
      this.state.crystalHp = Math.min(this.state.crystalHpMax, this.state.crystalHp + amount);
    }
    return this.state.crystalHp;
  }

  /** 设计 §6：HP <=0 = 死亡，金币结算为火花碎片，Run 结束 */
  get isDead(): boolean {
    return this.state.crystalHp <= 0;
  }

  /** 按 RARITY_WEIGHTS 加权抽 n 张（允许重复，卡池为空时已在 initRun 中拦截） */
  private drawWeightedDeck(pool: readonly CardConfig[], n: number): CardConfig[] {
    const byRarity = groupByRarity(pool);
    const usableRarities = (Object.keys(RARITY_WEIGHTS) as CardRarity[]).filter(
      (r) => byRarity[r].length > 0,
    );
    if (usableRarities.length === 0) {
      throw new Error('[RunManager] 卡池中无任何可用稀有度（不应到达此分支）');
    }
    const weightSum = usableRarities.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);

    const result: CardConfig[] = [];
    for (let i = 0; i < n; i++) {
      const rarity = this.pickRarity(usableRarities, weightSum);
      const candidates = byRarity[rarity];
      const idx = Math.floor(this.rng.next() * candidates.length);
      result.push(candidates[idx]!);
    }
    return result;
  }

  private pickRarity(usable: readonly CardRarity[], weightSum: number): CardRarity {
    const roll = this.rng.next() * weightSum;
    let acc = 0;
    for (const r of usable) {
      acc += RARITY_WEIGHTS[r];
      if (roll < acc) return r;
    }
    return usable[usable.length - 1]!;
  }

  /**
   * 强制每个 GUARANTEED_TYPES 在卡池中存在时至少出 1 张。
   * 替换策略：从抽中数量最多的非保底类型中替换 1 张（避免覆盖唯一保底）。
   * 卡池中没有某类型时跳过其保底（不抛错，让 Phase A 能跑）。
   */
  private enforceTypeGuarantees(drawn: CardConfig[], pool: readonly CardConfig[]): void {
    for (const type of GUARANTEED_TYPES) {
      const poolHas = pool.some((c) => c.type === type);
      if (!poolHas) continue;
      const drawnHas = drawn.some((c) => c.type === type);
      if (drawnHas) continue;

      const candidates = pool.filter((c) => c.type === type);
      const pick = candidates[Math.floor(this.rng.next() * candidates.length)]!;
      const replaceIdx = findReplaceableIndex(drawn);
      drawn[replaceIdx] = pick;
    }
  }

  private materialize(cfg: CardConfig): CardInstance {
    this.instanceCounter += 1;
    return {
      instanceId: `c${this.state.seed}_${this.instanceCounter}`,
      cardId: cfg.id,
      cardLevel: 1,
    };
  }
}

function groupByRarity(pool: readonly CardConfig[]): Record<CardRarity, CardConfig[]> {
  const out: Record<CardRarity, CardConfig[]> = {
    common: [],
    rare: [],
    epic: [],
    legendary: [],
  };
  for (const c of pool) out[c.rarity].push(c);
  return out;
}

/** 找一张"最适合被替换"的下标：选当前抽中数量最多的类型中的最后一张 */
function findReplaceableIndex(drawn: readonly CardConfig[]): number {
  const counts = new Map<CardType, number>();
  for (const c of drawn) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  let maxType: CardType = 'unit';
  let maxCount = -1;
  for (const [t, n] of counts) {
    if (n > maxCount) {
      maxCount = n;
      maxType = t;
    }
  }
  for (let i = drawn.length - 1; i >= 0; i--) {
    if (drawn[i]!.type === maxType) return i;
  }
  return drawn.length - 1;
}
