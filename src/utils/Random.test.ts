/**
 * 确定性 PRNG 测试 — P2-#16
 *
 * 对应设计文档:
 * - design/07-map-level-system.md §2.3 (随机种子与可复现性)
 * - design/13-save-system.md §3 (PRNG 状态保存)
 * - design/14-acceptance-criteria.md §3.12 (随机种子验收)
 */
import { describe, it, expect } from 'vitest';
import {
  GameRandom,
  createRandomStreams,
  captureStreamState,
  restoreStreamState,
} from './Random.js';

describe('GameRandom (mulberry32)', () => {
  it('相同种子产生相同序列', () => {
    const a = new GameRandom(12345);
    const b = new GameRandom(12345);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('不同种子产生不同序列', () => {
    const a = new GameRandom(12345);
    const b = new GameRandom(67890);
    let diff = 0;
    for (let i = 0; i < 100; i++) {
      if (a.next() !== b.next()) diff++;
    }
    expect(diff).toBeGreaterThan(90);
  });

  it('next() 返回值在 [0, 1)', () => {
    const r = new GameRandom(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt(min, max) 返回值在 [min, max)', () => {
    const r = new GameRandom(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('chance(p) 频率近似 p', () => {
    const r = new GameRandom(42);
    let hits = 0;
    for (let i = 0; i < 10000; i++) {
      if (r.chance(0.3)) hits++;
    }
    expect(hits / 10000).toBeCloseTo(0.3, 1);
  });

  it('pick() 在数组范围内', () => {
    const r = new GameRandom(42);
    const arr = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(r.pick(arr));
    }
  });

  it('pickWeighted() 反映权重分布', () => {
    const r = new GameRandom(42);
    const items = ['a', 'b', 'c'];
    const weights = [1, 0, 99];
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 1000; i++) {
      const v = r.pickWeighted(items, weights);
      counts[v as 'a' | 'b' | 'c']++;
    }
    expect(counts.b).toBe(0); // weight 0 永不抽到
    expect(counts.c).toBeGreaterThan(counts.a * 50);
  });

  it('shuffle() 不丢失元素', () => {
    const r = new GameRandom(42);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const original = [...arr];
    r.shuffle(arr);
    expect(arr.sort()).toEqual(original.sort());
  });

  it('getState/setState 可恢复完整状态', () => {
    const r = new GameRandom(99);
    r.next();
    r.next();
    const state = r.getState();
    const v1 = r.next();
    r.setState(state);
    const v2 = r.next();
    expect(v1).toBe(v2);
  });
});

describe('createRandomStreams — 多流隔离 (P2-#16)', () => {
  it('相同种子产生相同的多流集合', () => {
    const a = createRandomStreams(42);
    const b = createRandomStreams(42);
    expect(a.map.next()).toBe(b.map.next());
    expect(a.wave.next()).toBe(b.wave.next());
    expect(a.drop.next()).toBe(b.drop.next());
    expect(a.decor.next()).toBe(b.decor.next());
    expect(a.deck.next()).toBe(b.deck.next());
    expect(a.mystic.next()).toBe(b.mystic.next());
  });

  it('多流之间互相独立 — 消耗 drop 不影响 wave', () => {
    const a = createRandomStreams(42);
    const b = createRandomStreams(42);
    for (let i = 0; i < 100; i++) a.drop.next();
    for (let i = 0; i < 50; i++) {
      expect(a.wave.next()).toBe(b.wave.next());
    }
  });

  it('v3.0 卡牌动作不污染战斗流：消耗 deck/mystic 不影响 wave/drop', () => {
    const a = createRandomStreams(42);
    const b = createRandomStreams(42);
    for (let i = 0; i < 100; i++) {
      a.deck.next();
      a.mystic.next();
    }
    for (let i = 0; i < 50; i++) {
      expect(a.wave.next()).toBe(b.wave.next());
      expect(a.drop.next()).toBe(b.drop.next());
    }
  });

  it('多流的种子派生互不相同', () => {
    const s = createRandomStreams(42);
    const states = [
      s.map.getState(),
      s.wave.getState(),
      s.drop.getState(),
      s.decor.getState(),
      s.deck.getState(),
      s.mystic.getState(),
    ];
    const unique = new Set(states);
    expect(unique.size).toBe(states.length);
  });
});

describe('captureStreamState / restoreStreamState — 存档复现 (P2-#16 + #17)', () => {
  it('保存后再恢复，所有流继续相同序列', () => {
    const streams = createRandomStreams(42);
    for (let i = 0; i < 10; i++) {
      streams.map.next();
      streams.wave.next();
      streams.drop.next();
      streams.decor.next();
      streams.deck.next();
      streams.mystic.next();
    }
    const state = captureStreamState(streams);

    const future = {
      map: streams.map.next(),
      wave: streams.wave.next(),
      drop: streams.drop.next(),
      decor: streams.decor.next(),
      deck: streams.deck.next(),
      mystic: streams.mystic.next(),
    };

    restoreStreamState(streams, state);
    expect(streams.map.next()).toBe(future.map);
    expect(streams.wave.next()).toBe(future.wave);
    expect(streams.drop.next()).toBe(future.drop);
    expect(streams.decor.next()).toBe(future.decor);
    expect(streams.deck.next()).toBe(future.deck);
    expect(streams.mystic.next()).toBe(future.mystic);
  });

  it('种子存储在 state 中，可跨会话复现', () => {
    const streams = createRandomStreams(0xdeadbeef);
    const state = captureStreamState(streams);
    expect(state.seed).toBe(0xdeadbeef | 0);
  });

  it('v1.1 旧存档（无 deck/mystic 字段）可向后兼容恢复', () => {
    const streams = createRandomStreams(42);
    const deckBefore = streams.deck.getState();
    const mysticBefore = streams.mystic.getState();
    restoreStreamState(streams, {
      map: 100,
      wave: 200,
      drop: 300,
      decor: 400,
    });
    expect(streams.map.getState()).toBe(100);
    expect(streams.wave.getState()).toBe(200);
    expect(streams.deck.getState()).toBe(deckBefore);
    expect(streams.mystic.getState()).toBe(mysticBefore);
  });
});
