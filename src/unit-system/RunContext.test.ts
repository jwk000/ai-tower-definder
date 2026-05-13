import { describe, it, expect, beforeEach } from 'vitest';
import { CardConfigRegistry, type CardConfig } from '../config/cardRegistry.js';
import {
  createRunContext,
  startWaveEffect,
  endWaveEffect,
  playCard,
} from './RunContext.js';

let counter = 0;
function mkCfg(extra: Partial<CardConfig> = {}): CardConfig {
  counter += 1;
  const id = extra.id ?? `card_${counter}`;
  return {
    id,
    name: id,
    type: 'unit',
    energyCost: 2,
    rarity: 'common',
    placement: { targetType: 'tile' },
    ...extra,
  };
}

function makeRegistry(cards: readonly CardConfig[]): CardConfigRegistry {
  const r = new CardConfigRegistry();
  cards.forEach((c) => r.register(c));
  return r;
}

beforeEach(() => { counter = 0; });

describe('RunContext — Phase A3 集成层', () => {
  describe('createRunContext', () => {
    it('返回完整 4 管理器 + 6 流 PRNG', () => {
      const registry = makeRegistry([mkCfg(), mkCfg()]);
      const ctx = createRunContext({ seed: 42, registry });
      expect(ctx.seed).toBe(42);
      expect(ctx.streams.wave).toBeDefined();
      expect(ctx.streams.deck).toBeDefined();
      expect(ctx.streams.mystic).toBeDefined();
      expect(ctx.run).toBeDefined();
      expect(ctx.energy).toBeDefined();
      expect(ctx.deck).toBeDefined();
      expect(ctx.hand).toBeDefined();
      expect(ctx.registry).toBe(registry);
    });

    it('initRun 抽 12 张装入 deck.drawPile', () => {
      const registry = makeRegistry([mkCfg(), mkCfg(), mkCfg()]);
      const ctx = createRunContext({ seed: 1, registry });
      expect(ctx.deck.state.drawPile).toHaveLength(12);
      expect(ctx.deck.state.discardPile).toHaveLength(0);
      expect(ctx.deck.state.removedPile).toHaveLength(0);
    });

    it('容错：registry 为空时 deck 留空，不抛错', () => {
      const registry = new CardConfigRegistry();
      expect(() => createRunContext({ seed: 1, registry })).not.toThrow();
      const ctx = createRunContext({ seed: 1, registry });
      expect(ctx.deck.state.drawPile).toHaveLength(0);
      expect(ctx.run.state.currentLevel).toBe(1);
    });

    it('相同 seed 完全可复现（卡序列 + instanceId）', () => {
      const reg1 = makeRegistry([mkCfg({ id: 'A' }), mkCfg({ id: 'B' }), mkCfg({ id: 'C' })]);
      const reg2 = makeRegistry([mkCfg({ id: 'A' }), mkCfg({ id: 'B' }), mkCfg({ id: 'C' })]);
      const a = createRunContext({ seed: 7, registry: reg1 });
      const b = createRunContext({ seed: 7, registry: reg2 });
      expect(a.deck.state.drawPile.map((c) => c.cardId)).toEqual(
        b.deck.state.drawPile.map((c) => c.cardId),
      );
      expect(a.deck.state.drawPile.map((c) => c.instanceId)).toEqual(
        b.deck.state.drawPile.map((c) => c.instanceId),
      );
    });

    it('支持自定义 energyMax / handCapacity / crystalHpMax（永久升级生效）', () => {
      const registry = makeRegistry([mkCfg()]);
      const ctx = createRunContext({
        seed: 1, registry,
        energyMax: 12, handCapacity: 6, crystalHpMax: 150,
      });
      expect(ctx.energy.max).toBe(12);
      expect(ctx.hand.capacity).toBe(6);
      expect(ctx.run.state.crystalHpMax).toBe(150);
    });

    it('不传 seed 时自动生成（每次不同）', () => {
      const registry = makeRegistry([mkCfg()]);
      const a = createRunContext({ registry });
      const b = createRunContext({ registry });
      expect(typeof a.seed).toBe('number');
      expect(typeof b.seed).toBe('number');
    });
  });

  describe('startWaveEffect — 每波开始事件', () => {
    it('能量恢复 + 补满手牌', () => {
      const registry = makeRegistry([mkCfg(), mkCfg()]);
      const ctx = createRunContext({ seed: 1, registry });
      ctx.energy.spend(3);
      expect(ctx.energy.current).toBe(2);
      expect(ctx.hand.size).toBe(0);
      const { energyGained, cardsDrawn } = startWaveEffect(ctx);
      expect(energyGained).toBe(5);
      expect(ctx.energy.current).toBe(7);
      expect(cardsDrawn).toBe(4);
      expect(ctx.hand.size).toBe(4);
    });

    it('能量已满时只补手牌', () => {
      const registry = makeRegistry([mkCfg()]);
      const ctx = createRunContext({ seed: 1, registry });
      expect(ctx.energy.current).toBe(5);
      const { energyGained, cardsDrawn } = startWaveEffect(ctx);
      expect(energyGained).toBe(5);
      expect(ctx.energy.current).toBe(10);
      expect(cardsDrawn).toBe(4);
    });

    it('deck 为空时手牌补 0 不抛错', () => {
      const registry = new CardConfigRegistry();
      const ctx = createRunContext({ seed: 1, registry });
      const { energyGained, cardsDrawn } = startWaveEffect(ctx);
      expect(energyGained).toBe(5);
      expect(cardsDrawn).toBe(0);
    });
  });

  describe('endWaveEffect — 每波结束事件', () => {
    it('persist=false 的卡全部进弃牌堆', () => {
      const registry = makeRegistry([mkCfg({ id: 'C1' })]);
      const ctx = createRunContext({ seed: 1, registry });
      startWaveEffect(ctx);
      expect(ctx.hand.size).toBe(4);
      const { discarded } = endWaveEffect(ctx);
      expect(discarded).toBe(4);
      expect(ctx.hand.size).toBe(0);
      expect(ctx.deck.state.discardPile).toHaveLength(4);
    });

    it('persist=true 的卡留手牌', () => {
      const registry = makeRegistry([
        mkCfg({ id: 'PERSIST', persistAcrossWaves: true }),
      ]);
      const ctx = createRunContext({ seed: 1, registry });
      startWaveEffect(ctx);
      const handSizeBefore = ctx.hand.size;
      const { discarded } = endWaveEffect(ctx);
      expect(discarded).toBe(0);
      expect(ctx.hand.size).toBe(handSizeBefore);
    });
  });

  describe('playCard — 玩家出卡', () => {
    it('能量足 + 手牌含 + 注册表有 → 成功扣能量、卡离手', () => {
      const registry = makeRegistry([mkCfg({ id: 'CARD_A', energyCost: 3 })]);
      const ctx = createRunContext({ seed: 1, registry });
      startWaveEffect(ctx);
      const target = ctx.hand.state.hand[0]!;
      const result = playCard(ctx, target.instanceId);
      expect(result).not.toBeNull();
      expect(result!.config.id).toBe('CARD_A');
      expect(ctx.hand.state.hand.find((c) => c.instanceId === target.instanceId)).toBeUndefined();
      expect(ctx.energy.current).toBe(10 - 3);
    });

    it('能量不足 → 返 null，状态完全不变', () => {
      const registry = makeRegistry([mkCfg({ id: 'EXPENSIVE', energyCost: 99 })]);
      const ctx = createRunContext({ seed: 1, registry });
      startWaveEffect(ctx);
      const energyBefore = ctx.energy.current;
      const handBefore = ctx.hand.size;
      const target = ctx.hand.state.hand[0]!;
      const result = playCard(ctx, target.instanceId);
      expect(result).toBeNull();
      expect(ctx.energy.current).toBe(energyBefore);
      expect(ctx.hand.size).toBe(handBefore);
    });

    it('instanceId 不在手牌 → 返 null', () => {
      const registry = makeRegistry([mkCfg()]);
      const ctx = createRunContext({ seed: 1, registry });
      startWaveEffect(ctx);
      const energyBefore = ctx.energy.current;
      const result = playCard(ctx, 'NONEXISTENT');
      expect(result).toBeNull();
      expect(ctx.energy.current).toBe(energyBefore);
    });

    it('type=spell 卡 → 出卡后进弃牌堆', () => {
      const registry = makeRegistry([
        mkCfg({ id: 'FIREBALL', type: 'spell', energyCost: 2 }),
      ]);
      const ctx = createRunContext({ seed: 1, registry });
      startWaveEffect(ctx);
      const target = ctx.hand.state.hand[0]!;
      playCard(ctx, target.instanceId);
      expect(ctx.deck.state.discardPile.map((c) => c.instanceId)).toContain(target.instanceId);
    });

    it('type=unit 卡 → 出卡后不入弃牌堆（设计 §2.5：单位死亡不回弃牌堆）', () => {
      const registry = makeRegistry([mkCfg({ id: 'KNIGHT', type: 'unit', energyCost: 2 })]);
      const ctx = createRunContext({ seed: 1, registry });
      startWaveEffect(ctx);
      const target = ctx.hand.state.hand[0]!;
      const discardBefore = ctx.deck.state.discardPile.length;
      playCard(ctx, target.instanceId);
      expect(ctx.deck.state.discardPile).toHaveLength(discardBefore);
    });
  });

  describe('persistAcrossWaves resolver 注入', () => {
    it('createRunContext 自动按 registry 构造 resolver', () => {
      const registry = makeRegistry([
        mkCfg({ id: 'STAY', persistAcrossWaves: true }),
        mkCfg({ id: 'GO' }),
      ]);
      const ctx = createRunContext({ seed: 1, registry });
      startWaveEffect(ctx);
      const persistCards = ctx.hand.state.hand.filter(
        (c) => registry.get(c.cardId)?.persistAcrossWaves === true,
      );
      const nonPersistCards = ctx.hand.state.hand.filter(
        (c) => registry.get(c.cardId)?.persistAcrossWaves !== true,
      );
      endWaveEffect(ctx);
      expect(ctx.hand.size).toBe(persistCards.length);
      expect(ctx.deck.state.discardPile).toHaveLength(nonPersistCards.length);
    });
  });

  describe('完整波次循环复合验证', () => {
    it('波1→波2 流程：剩余手牌跨波保留(persist) / 弃牌堆洗回 / 能量累积', () => {
      const registry = makeRegistry([
        mkCfg({ id: 'A', energyCost: 1 }),
        mkCfg({ id: 'B', energyCost: 1 }),
        mkCfg({ id: 'C', energyCost: 1, persistAcrossWaves: true }),
      ]);
      const ctx = createRunContext({ seed: 1, registry });
      // 波 1 开始
      startWaveEffect(ctx);
      expect(ctx.energy.current).toBe(10);
      expect(ctx.hand.size).toBe(4);
      // 出 2 张
      const c1 = ctx.hand.state.hand[0]!;
      const c2 = ctx.hand.state.hand[1]!;
      playCard(ctx, c1.instanceId);
      playCard(ctx, c2.instanceId);
      expect(ctx.energy.current).toBe(8);
      // 波 1 结束：persist 留手牌，其余弃
      endWaveEffect(ctx);
      const persistKept = ctx.hand.size;
      // 波 2 开始：能量 +5 上限 10，手牌补回 4
      const { energyGained } = startWaveEffect(ctx);
      expect(energyGained).toBe(2);
      expect(ctx.energy.current).toBe(10);
      expect(ctx.hand.size).toBe(4);
      expect(ctx.hand.size).toBeGreaterThanOrEqual(persistKept);
    });
  });
});
