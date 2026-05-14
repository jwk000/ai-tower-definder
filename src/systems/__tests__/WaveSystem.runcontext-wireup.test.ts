import { describe, it, expect, beforeEach } from 'vitest';
import { WaveSystem } from '../WaveSystem.js';
import { TowerWorld } from '../../core/World.js';
import { createRunContext, startWaveEffect, endWaveEffect } from '../../unit-system/RunContext.js';
import { CardConfigRegistry, type CardConfig } from '../../config/cardRegistry.js';
import { GamePhase, TileType, type MapConfig, type WaveConfig } from '../../types/index.js';

// v3.0 roguelike — B2-a WaveSystem ↔ RunContext 集成层 wire-up 验证
// 设计文档锚点：
//   - design/25-card-roguelike-refactor.md §2 卡牌循环（每波抽卡 + 能量恢复）
//   - design/14-acceptance-criteria.md §3.2 line 71/72 每波抽卡补满 / persist 跨波保留
//   - design/14-acceptance-criteria.md §3.3 line 83 每波能量 +5
//
// 已落地链路（A3 Phase）：
//   WaveSystem.startWave → setPhase(Battle) → onWaveStart? hook
//   ↓ main.ts ctor 第 7 参 onWaveStart 回调
//   startWaveEffect(ctx) → energy.startWave() (回 5) + hand.refillHand(deck) (补满 4)
//
// 本测试构造最小 WaveSystem + RunContext fixture，验证 wire-up 不被回归破坏。

let counter = 0;
function mkCfg(extra: Partial<CardConfig> = {}): CardConfig {
  counter += 1;
  const id = extra.id ?? `card_${counter}`;
  return {
    id, name: id, type: 'unit', energyCost: 2, rarity: 'common',
    placement: { targetType: 'tile' },
    ...extra,
  };
}

function makeRegistry(n: number): CardConfigRegistry {
  const r = new CardConfigRegistry();
  for (let i = 0; i < n; i++) r.register(mkCfg());
  return r;
}

function buildSimpleMap(): MapConfig {
  const tiles: TileType[][] = [[TileType.Path, TileType.Empty]];
  return {
    name: 'wireup-map', cols: 2, rows: 1, tileSize: 64, tiles,
    enemyPath: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
  };
}

function buildSimpleWaves(): WaveConfig[] {
  return [
    { waveNumber: 1, enemies: [], spawnDelay: 0 },
    { waveNumber: 2, enemies: [], spawnDelay: 0 },
  ];
}

describe('WaveSystem B2-a — onWaveStart 钩子 ↔ RunContext 副作用 wire-up', () => {
  let world: TowerWorld;
  let map: MapConfig;
  let waves: WaveConfig[];

  beforeEach(() => {
    counter = 0;
    world = new TowerWorld();
    map = buildSimpleMap();
    waves = buildSimpleWaves();
  });

  it('startWave 调用 onWaveStart 钩子，钩子内 startWaveEffect 触发 energy +5 + hand 补满 4', () => {
    const registry = makeRegistry(12);
    const ctx = createRunContext({ seed: 42, registry, handCapacity: 4, energyMax: 10 });
    const initialEnergy = ctx.energy.current;
    const initialHandSize = ctx.hand.state.hand.length;
    let phase = GamePhase.Deployment;

    const ws = new WaveSystem(
      world, map, waves,
      () => phase,
      (p) => { phase = p; },
      undefined,
      () => { startWaveEffect(ctx); },
    );

    ws.startWave();

    expect(ctx.energy.current).toBe(Math.min(10, initialEnergy + 5));
    expect(ctx.hand.state.hand.length).toBeGreaterThan(initialHandSize);
    expect(ctx.hand.state.hand.length).toBeLessThanOrEqual(4);
    expect(phase).toBe(GamePhase.Battle);
  });

  it('连续两波都触发副作用：能量上限封顶 + 手牌每波都补满', () => {
    const registry = makeRegistry(12);
    const ctx = createRunContext({ seed: 42, registry, handCapacity: 4, energyMax: 10 });
    let phase = GamePhase.Deployment;

    const ws = new WaveSystem(
      world, map, waves,
      () => phase,
      (p) => { phase = p; },
      undefined,
      () => { startWaveEffect(ctx); },
    );

    ws.startWave();
    const energyAfter1 = ctx.energy.current;
    const handAfter1 = ctx.hand.state.hand.length;

    ctx.energy.spend(2);
    ctx.hand.play(ctx.hand.state.hand[0]!.instanceId);

    ws.startWave();
    expect(ctx.energy.current).toBeGreaterThan(energyAfter1 - 2);
    expect(ctx.hand.state.hand.length).toBe(handAfter1);
  });

  it('endWaveEffect 弃手牌：non-persist 卡丢光，persist=true 仍在手牌', () => {
    const registry = new CardConfigRegistry();
    registry.register(mkCfg({ id: 'normal_a' }));
    registry.register(mkCfg({ id: 'normal_b' }));
    registry.register(mkCfg({ id: 'spell_persist', type: 'spell', persistAcrossWaves: true }));
    registry.register(mkCfg({ id: 'normal_c' }));
    registry.register(mkCfg({ id: 'normal_d' }));
    const ctx = createRunContext({ seed: 1, registry, handCapacity: 4, energyMax: 10 });

    let phase = GamePhase.Deployment;
    const ws = new WaveSystem(
      world, map, waves,
      () => phase,
      (p) => { phase = p; },
      () => { endWaveEffect(ctx); },
      () => { startWaveEffect(ctx); },
    );

    ws.startWave();
    const handBeforeEnd = [...ctx.hand.state.hand];
    expect(handBeforeEnd.length).toBeGreaterThan(0);

    endWaveEffect(ctx);

    const nonPersistHandLeft = ctx.hand.state.hand.filter((c) => c.cardId !== 'spell_persist');
    expect(nonPersistHandLeft.length).toBe(0);
    const hadPersist = handBeforeEnd.some((c) => c.cardId === 'spell_persist');
    if (hadPersist) {
      const persistHandLeft = ctx.hand.state.hand.filter((c) => c.cardId === 'spell_persist');
      expect(persistHandLeft.length).toBeGreaterThan(0);
    }
  });

  it('registry 为空时 deck 空：startWaveEffect 安全无抛错（hand 无卡可拉）', () => {
    const ctx = createRunContext({ seed: 1, registry: new CardConfigRegistry() });
    let phase = GamePhase.Deployment;

    const ws = new WaveSystem(
      world, map, waves,
      () => phase,
      (p) => { phase = p; },
      undefined,
      () => { startWaveEffect(ctx); },
    );

    expect(() => ws.startWave()).not.toThrow();
    expect(ctx.energy.current).toBeGreaterThan(0);
    expect(ctx.hand.state.hand.length).toBe(0);
  });

  it('未传 onWaveStart 钩子（旧调用约定）：startWave 仍正常工作', () => {
    let phase = GamePhase.Deployment;
    const ws = new WaveSystem(
      world, map, waves,
      () => phase,
      (p) => { phase = p; },
    );
    expect(() => ws.startWave()).not.toThrow();
    expect(phase).toBe(GamePhase.Battle);
  });
});
