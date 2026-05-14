import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildSystem } from '../BuildSystem.js';
import { TowerWorld } from '../../core/World.js';
import { GamePhase, TowerType, TileType, ProductionType, type MapConfig } from '../../types/index.js';
import { RenderSystem } from '../RenderSystem.js';

// v3.0 roguelike — B1 BuildSystem 双扣金币清理
// 设计文档锚点：
//   - design/25-card-roguelike-refactor.md §1.3 三资源严格分层（能量 = 关内出卡唯一资源，金币禁止扣）
//   - design/dev-logs/2026-05-13.md §10.10 "B3 已知 Phase B 待清理"
//
// v3.0 卡牌流：tryPlayHandCard → runPlayCard 已扣 energy → buildSystem.startDrag → tryDrop → placeXxx
// B1 删除 BuildSystem ctor 的 spendGold callback 参数 + 三处 placeXxx 内的 spendGold 调用。
// 本测试断言：(1) ctor 不再接受 spendGold 参数（结构性 — 测试构造方式即证明）
//             (2) onBuilt 回调仍按 cost meta 触发（供 EconomySystem.registerBuild 回收溯源）

function buildSimpleMap(): MapConfig {
  // 3×3 map: row 0 = path (有 spawn 起点)，row 1/2 = empty
  // RenderSystem.sceneOffsetX/Y 默认 0，tileSize 64 → 像素 (col*64+32, row*64+32)
  const tiles: TileType[][] = [
    [TileType.Path, TileType.Path, TileType.Path],
    [TileType.Empty, TileType.Empty, TileType.Empty],
    [TileType.Empty, TileType.Empty, TileType.Empty],
  ];
  return {
    name: 'test-map',
    cols: 3,
    rows: 3,
    tileSize: 64,
    tiles,
    enemyPath: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }],
  };
}

describe('BuildSystem B1 — v3.0 卡牌流下三 place 入口不再扣金币', () => {
  let world: TowerWorld;
  let map: MapConfig;
  let buildSystem: BuildSystem;

  beforeEach(() => {
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
    world = new TowerWorld();
    map = buildSimpleMap();
    buildSystem = new BuildSystem(map, () => GamePhase.Battle);
    buildSystem.update(world, 0);
  });

  it('placeTower (Arrow @ row1,col0 邻接 row0 path) 放置成功且 ctor 不再接受 spendGold', () => {
    buildSystem.startDrag('tower', { towerType: TowerType.Arrow });
    const pxX = 0 * 64 + 32;
    const pxY = 1 * 64 + 32;
    const result = buildSystem.tryDrop(pxX, pxY);
    expect(result).not.toBe(false);
  });

  it('placeTrap (path tile @ row0,col1) 放置成功且 ctor 不再接受 spendGold', () => {
    buildSystem.startDrag('trap');
    const pxX = 1 * 64 + 32;
    const pxY = 0 * 64 + 32;
    const result = buildSystem.tryDrop(pxX, pxY);
    expect(result).not.toBe(false);
  });

  it('placeProduction (GoldMine @ row1,col1 邻接 path) 放置成功且 ctor 不再接受 spendGold', () => {
    buildSystem.startDrag('production', { productionType: ProductionType.GoldMine });
    const pxX = 1 * 64 + 32;
    const pxY = 1 * 64 + 32;
    const result = buildSystem.tryDrop(pxX, pxY);
    expect(result).not.toBe(false);
  });

  it('placeProduction (EnergyTower @ row1,col2 邻接 path) 放置成功且 ctor 不再接受 spendGold', () => {
    buildSystem.startDrag('production', { productionType: ProductionType.EnergyTower });
    const pxX = 2 * 64 + 32;
    const pxY = 1 * 64 + 32;
    const result = buildSystem.tryDrop(pxX, pxY);
    expect(result).not.toBe(false);
  });

  it('onBuilt 回调以 cost meta 触发（registerBuild 退款追溯需要）— placeTower', () => {
    const onBuilt = vi.fn();
    const bs = new BuildSystem(map, () => GamePhase.Battle, onBuilt);
    bs.update(world, 0);
    bs.startDrag('tower', { towerType: TowerType.Arrow });
    bs.tryDrop(0 * 64 + 32, 1 * 64 + 32);
    expect(onBuilt).toHaveBeenCalledTimes(1);
    const callArgs = onBuilt.mock.calls[0]!;
    expect(callArgs[0]).toBeGreaterThan(0);
    expect(typeof callArgs[1]).toBe('number');
    expect(callArgs[1]).toBeGreaterThan(0);
  });

  it('onBuilt 回调以 TRAP_REFUND_META=40 触发 — placeTrap', () => {
    const onBuilt = vi.fn();
    const bs = new BuildSystem(map, () => GamePhase.Battle, onBuilt);
    bs.update(world, 0);
    bs.startDrag('trap');
    bs.tryDrop(1 * 64 + 32, 0 * 64 + 32);
    expect(onBuilt).toHaveBeenCalledTimes(1);
    expect(onBuilt.mock.calls[0]![1]).toBe(40);
  });

  it('onBuilt 回调以 PRODUCTION_CONFIGS[GoldMine].cost 触发 — placeProduction', () => {
    const onBuilt = vi.fn();
    const bs = new BuildSystem(map, () => GamePhase.Battle, onBuilt);
    bs.update(world, 0);
    bs.startDrag('production', { productionType: ProductionType.GoldMine });
    bs.tryDrop(1 * 64 + 32, 1 * 64 + 32);
    expect(onBuilt).toHaveBeenCalledTimes(1);
    expect(onBuilt.mock.calls[0]![1]).toBeGreaterThan(0);
  });
});
