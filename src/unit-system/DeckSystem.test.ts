import { describe, it, expect } from 'vitest';
import { GameRandom, createRandomStreams } from '../utils/Random.js';
import { DeckSystem } from './DeckSystem.js';
import type { CardInstance } from './types.js';

function mkCard(id: string, level: 1 | 2 | 3 = 1): CardInstance {
  return { instanceId: id, cardId: `card_${id}`, cardLevel: level };
}

function mkDeck(count: number): CardInstance[] {
  return Array.from({ length: count }, (_, i) => mkCard(String(i + 1)));
}

describe('DeckSystem — 验收 §3.1 卡组构筑', () => {
  describe('初始状态', () => {
    it('空构造时三堆均空', () => {
      const ds = new DeckSystem(new GameRandom(1));
      expect(ds.state.drawPile).toEqual([]);
      expect(ds.state.discardPile).toEqual([]);
      expect(ds.state.removedPile).toEqual([]);
      expect(ds.hasCards).toBe(false);
      expect(ds.totalActive).toBe(0);
    });

    it('initial 参数会拷贝数组而非共享引用', () => {
      const draw = mkDeck(3);
      const ds = new DeckSystem(new GameRandom(1), { drawPile: draw });
      draw.length = 0;
      expect(ds.state.drawPile).toHaveLength(3);
    });
  });

  describe('draw / drawMany', () => {
    it('从 drawPile 顶（数组末尾）抽卡', () => {
      const ds = new DeckSystem(new GameRandom(1));
      ds.state.drawPile = [mkCard('A'), mkCard('B'), mkCard('C')];
      expect(ds.draw()?.instanceId).toBe('C');
      expect(ds.draw()?.instanceId).toBe('B');
      expect(ds.draw()?.instanceId).toBe('A');
    });

    it('drawPile 空且 discardPile 空时返回 undefined', () => {
      const ds = new DeckSystem(new GameRandom(1));
      expect(ds.draw()).toBeUndefined();
    });

    it('drawPile 空时自动洗 discardPile', () => {
      const ds = new DeckSystem(new GameRandom(1));
      ds.state.discardPile = [mkCard('X'), mkCard('Y'), mkCard('Z')];
      const c = ds.draw();
      expect(c).toBeDefined();
      expect(['X', 'Y', 'Z']).toContain(c!.instanceId);
      expect(ds.state.discardPile).toHaveLength(0);
      expect(ds.state.drawPile.length + 1).toBe(3);
    });

    it('drawMany 不足时尽量抽', () => {
      const ds = new DeckSystem(new GameRandom(1));
      ds.state.drawPile = [mkCard('A'), mkCard('B')];
      const cards = ds.drawMany(5);
      expect(cards).toHaveLength(2);
    });

    it('drawMany(0) 返回空数组', () => {
      const ds = new DeckSystem(new GameRandom(1));
      ds.state.drawPile = mkDeck(5);
      expect(ds.drawMany(0)).toEqual([]);
    });
  });

  describe('discard / remove / returnToDrawTop', () => {
    it('discard 放入弃牌堆顶', () => {
      const ds = new DeckSystem(new GameRandom(1));
      ds.discard(mkCard('A'));
      ds.discard(mkCard('B'));
      expect(ds.state.discardPile.map((c) => c.instanceId)).toEqual(['A', 'B']);
    });

    it('remove 放入移除堆且本局不再洗回（即使 drawPile 空）', () => {
      const ds = new DeckSystem(new GameRandom(1));
      ds.remove(mkCard('R'));
      expect(ds.state.removedPile).toHaveLength(1);
      expect(ds.draw()).toBeUndefined();
    });

    it('returnToDrawTop 放到 drawPile 末尾（下次 pop 即得）', () => {
      const ds = new DeckSystem(new GameRandom(1));
      ds.state.drawPile = [mkCard('X')];
      ds.returnToDrawTop(mkCard('TOP'));
      expect(ds.draw()?.instanceId).toBe('TOP');
    });

    it('totalActive 不含 removed', () => {
      const ds = new DeckSystem(new GameRandom(1));
      ds.state.drawPile = mkDeck(3);
      ds.discard(mkCard('D'));
      ds.remove(mkCard('R'));
      expect(ds.totalActive).toBe(4);
    });
  });

  describe('确定性洗牌 — 验收 §3.13 PRNG 隔离', () => {
    it('相同种子的 deckRandom 洗牌结果一致', () => {
      const a = createRandomStreams(42);
      const b = createRandomStreams(42);
      const dsA = new DeckSystem(a.deck);
      const dsB = new DeckSystem(b.deck);
      const deck = mkDeck(20);
      dsA.resetWithDeck(deck);
      dsB.resetWithDeck(deck);
      const drawnA = dsA.drawMany(20).map((c) => c.instanceId);
      const drawnB = dsB.drawMany(20).map((c) => c.instanceId);
      expect(drawnA).toEqual(drawnB);
    });

    it('不同种子洗牌结果不同（绝大多数情况）', () => {
      const dsA = new DeckSystem(new GameRandom(42));
      const dsB = new DeckSystem(new GameRandom(99));
      const deck = mkDeck(20);
      dsA.resetWithDeck(deck);
      dsB.resetWithDeck(deck);
      const drawnA = dsA.drawMany(20).map((c) => c.instanceId);
      const drawnB = dsB.drawMany(20).map((c) => c.instanceId);
      expect(drawnA).not.toEqual(drawnB);
    });

    it('洗牌不丢失卡', () => {
      const ds = new DeckSystem(new GameRandom(7));
      const deck = mkDeck(10);
      ds.resetWithDeck(deck);
      const drawn = ds.drawMany(10).map((c) => c.instanceId).sort();
      const expected = deck.map((c) => c.instanceId).sort();
      expect(drawn).toEqual(expected);
    });

    it('resetWithDeck 清空 discard 与 removed', () => {
      const ds = new DeckSystem(new GameRandom(1));
      ds.discard(mkCard('D'));
      ds.remove(mkCard('R'));
      ds.resetWithDeck(mkDeck(3));
      expect(ds.state.discardPile).toEqual([]);
      expect(ds.state.removedPile).toEqual([]);
      expect(ds.state.drawPile).toHaveLength(3);
    });
  });

  describe('洗回循环 — Roguelike Deckbuilding 核心', () => {
    it('抽完所有卡后，弃牌堆中的卡会被洗回 drawPile', () => {
      const ds = new DeckSystem(new GameRandom(3));
      ds.resetWithDeck(mkDeck(4));
      const first = ds.drawMany(4);
      expect(first).toHaveLength(4);
      first.forEach((c) => ds.discard(c));
      expect(ds.state.drawPile).toHaveLength(0);
      const second = ds.drawMany(4);
      expect(second).toHaveLength(4);
      expect(ds.state.drawPile).toHaveLength(0);
      expect(ds.state.discardPile).toHaveLength(0);
    });

    it('移除堆里的卡永远不会被洗回', () => {
      const ds = new DeckSystem(new GameRandom(1));
      ds.resetWithDeck(mkDeck(3));
      const c = ds.draw()!;
      ds.remove(c);
      const remaining = ds.drawMany(10);
      const ids = remaining.map((rc) => rc.instanceId);
      expect(ids).not.toContain(c.instanceId);
      expect(remaining).toHaveLength(2);
    });
  });
});
