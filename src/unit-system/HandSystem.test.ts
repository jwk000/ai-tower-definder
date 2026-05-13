import { describe, it, expect, vi } from 'vitest';
import { GameRandom } from '../utils/Random.js';
import { DeckSystem } from './DeckSystem.js';
import {
  HandSystem,
  HAND_CAPACITY_DEFAULT,
  HAND_CAPACITY_MAX,
  HAND_INITIAL_DRAW,
} from './HandSystem.js';
import type { CardInstance } from './types.js';

function mkCard(id: string, persist = false): CardInstance & { persist?: boolean } {
  return { instanceId: id, cardId: `card_${id}`, cardLevel: 1, ...(persist ? { persist } : {}) };
}

function mkDeck(ids: readonly string[]): DeckSystem {
  const ds = new DeckSystem(new GameRandom(1));
  ds.state.drawPile = ids.map((id) => mkCard(id));
  return ds;
}

describe('HandSystem — 验收 §3.2 手牌系统', () => {
  describe('初始状态 & 常量', () => {
    it('默认手牌上限 4，最高 8', () => {
      expect(HAND_CAPACITY_DEFAULT).toBe(4);
      expect(HAND_CAPACITY_MAX).toBe(8);
      expect(HAND_INITIAL_DRAW).toBe(4);
    });

    it('空构造时手牌为空、capacity=4', () => {
      const h = new HandSystem();
      expect(h.size).toBe(0);
      expect(h.capacity).toBe(4);
      expect(h.isFull).toBe(false);
    });

    it('capacity 被裁剪到 [4, 8]', () => {
      expect(new HandSystem({ capacity: 0 }).capacity).toBe(4);
      expect(new HandSystem({ capacity: 999 }).capacity).toBe(8);
      expect(new HandSystem({ capacity: 5.7 }).capacity).toBe(5);
    });
  });

  describe('drawOne — 抽牌入手', () => {
    it('手牌未满，从 deck 抽顶并入手', () => {
      const deck = mkDeck(['A', 'B']);
      const h = new HandSystem();
      const ok = h.drawOne(deck);
      expect(ok).toBe(true);
      expect(h.size).toBe(1);
      expect(h.state.hand[0]?.instanceId).toBe('B');
    });

    it('deck 全空时返 false 不影响手牌', () => {
      const deck = new DeckSystem(new GameRandom(1));
      const h = new HandSystem();
      expect(h.drawOne(deck)).toBe(false);
      expect(h.size).toBe(0);
    });

    it('手牌已满 → 抽到的卡进 deck.discardPile + 触发飘字回调（设计 §11 #6）', () => {
      const deck = mkDeck(['EXTRA']);
      const onHandFullDiscard = vi.fn();
      const h = new HandSystem({
        initial: [mkCard('1'), mkCard('2'), mkCard('3'), mkCard('4')],
        hooks: { onHandFullDiscard },
      });
      expect(h.isFull).toBe(true);
      const ok = h.drawOne(deck);
      expect(ok).toBe(false);
      expect(h.size).toBe(4);
      expect(deck.state.discardPile).toHaveLength(1);
      expect(deck.state.discardPile[0]?.instanceId).toBe('EXTRA');
      expect(onHandFullDiscard).toHaveBeenCalledOnce();
      expect(onHandFullDiscard.mock.calls[0]?.[0]?.instanceId).toBe('EXTRA');
    });
  });

  describe('refillHand — 每波开始补满', () => {
    it('从 0 补到 capacity', () => {
      const deck = mkDeck(['A', 'B', 'C', 'D', 'E']);
      const h = new HandSystem();
      const added = h.refillHand(deck);
      expect(added).toBe(4);
      expect(h.size).toBe(4);
      expect(deck.state.drawPile).toHaveLength(1);
    });

    it('卡组耗尽时尽量补，不抛错', () => {
      const deck = mkDeck(['A', 'B']);
      const h = new HandSystem();
      const added = h.refillHand(deck);
      expect(added).toBe(2);
      expect(h.size).toBe(2);
    });

    it('已满则不抽', () => {
      const deck = mkDeck(['A']);
      const h = new HandSystem({
        initial: [mkCard('1'), mkCard('2'), mkCard('3'), mkCard('4')],
      });
      expect(h.refillHand(deck)).toBe(0);
      expect(deck.state.drawPile).toHaveLength(1);
    });

    it('capacity 提升后再 refill 能多补', () => {
      const deck = mkDeck(['A', 'B', 'C', 'D', 'E', 'F']);
      const h = new HandSystem();
      h.refillHand(deck);
      expect(h.size).toBe(4);
      h.setCapacity(6);
      const added = h.refillHand(deck);
      expect(added).toBe(2);
      expect(h.size).toBe(6);
    });
  });

  describe('play — 玩家拖卡打出', () => {
    it('按 instanceId 移除并返回卡', () => {
      const h = new HandSystem({
        initial: [mkCard('A'), mkCard('B'), mkCard('C')],
      });
      const played = h.play('B');
      expect(played?.instanceId).toBe('B');
      expect(h.size).toBe(2);
      expect(h.state.hand.map((c) => c.instanceId)).toEqual(['A', 'C']);
    });

    it('未找到返回 undefined', () => {
      const h = new HandSystem({ initial: [mkCard('A')] });
      expect(h.play('NOPE')).toBeUndefined();
      expect(h.size).toBe(1);
    });
  });

  describe('discardOnWaveEnd — 波末清理（核心边界 #1/#3）', () => {
    it('persist=false 全部进 deck.discardPile，手牌清空', () => {
      const deck = new DeckSystem(new GameRandom(1));
      const h = new HandSystem({
        initial: [mkCard('A'), mkCard('B'), mkCard('C')],
        isPersistAcrossWaves: () => false,
      });
      const discarded = h.discardOnWaveEnd(deck);
      expect(discarded).toBe(3);
      expect(h.size).toBe(0);
      expect(deck.state.discardPile).toHaveLength(3);
    });

    it('persist=true 留手牌；混合时只弃非 persist', () => {
      const deck = new DeckSystem(new GameRandom(1));
      const h = new HandSystem({
        initial: [mkCard('A'), mkCard('B'), mkCard('C'), mkCard('D')],
        isPersistAcrossWaves: (c) => c.instanceId === 'B' || c.instanceId === 'D',
      });
      const discarded = h.discardOnWaveEnd(deck);
      expect(discarded).toBe(2);
      expect(h.state.hand.map((c) => c.instanceId)).toEqual(['B', 'D']);
      expect(deck.state.discardPile.map((c) => c.instanceId)).toEqual(['A', 'C']);
    });

    it('全部 persist → 手牌完整保留', () => {
      const deck = new DeckSystem(new GameRandom(1));
      const h = new HandSystem({
        initial: [mkCard('A'), mkCard('B')],
        isPersistAcrossWaves: () => true,
      });
      const discarded = h.discardOnWaveEnd(deck);
      expect(discarded).toBe(0);
      expect(h.size).toBe(2);
      expect(deck.state.discardPile).toHaveLength(0);
    });
  });

  describe('setCapacity — 永久升级（手牌扩容）', () => {
    it('提升 capacity 但不自动补抽', () => {
      const h = new HandSystem({
        initial: [mkCard('A'), mkCard('B'), mkCard('C'), mkCard('D')],
      });
      h.setCapacity(6);
      expect(h.capacity).toBe(6);
      expect(h.size).toBe(4);
      expect(h.isFull).toBe(false);
    });

    it('上限被裁剪到 [4, 8]', () => {
      const h = new HandSystem();
      h.setCapacity(99);
      expect(h.capacity).toBe(8);
      h.setCapacity(1);
      expect(h.capacity).toBe(4);
    });
  });

  describe('setPersistResolver — 运行时注入判定函数', () => {
    it('可在构造后替换 isPersist 实现', () => {
      const deck = new DeckSystem(new GameRandom(1));
      const h = new HandSystem({
        initial: [mkCard('A'), mkCard('B')],
      });
      h.setPersistResolver((c) => c.instanceId === 'A');
      h.discardOnWaveEnd(deck);
      expect(h.state.hand.map((c) => c.instanceId)).toEqual(['A']);
      expect(deck.state.discardPile.map((c) => c.instanceId)).toEqual(['B']);
    });
  });

  describe('reset — 新 Run 开始', () => {
    it('清空手牌并设置 capacity', () => {
      const h = new HandSystem({
        initial: [mkCard('A'), mkCard('B')],
        capacity: 6,
      });
      h.reset();
      expect(h.size).toBe(0);
      expect(h.capacity).toBe(4);
    });

    it('reset 也接受自定义 capacity', () => {
      const h = new HandSystem();
      h.reset(5);
      expect(h.capacity).toBe(5);
    });
  });
});
