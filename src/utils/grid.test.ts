/**
 * 网格工具测试 — isAdjacentToPath
 * 
 * 对应设计文档: design/07-map-level-system.md §1.3 建造限制
 * "仅可在路径的8方向相邻1格内的空地上建造"
 */
import { describe, it, expect } from 'vitest';
import { isAdjacentToPath } from './grid.js';
import { TileType, type MapConfig } from '../types/index.js';

/** 创建测试用的最小地图 */
function makeMap(tiles: TileType[][]): MapConfig {
  return {
    name: 'test',
    cols: tiles[0]!.length,
    rows: tiles.length,
    tileSize: 64,
    tiles,
  };
}

describe('isAdjacentToPath', () => {
  it('空地旁有路径 → true', () => {
    const map = makeMap([
      [TileType.Empty, TileType.Empty, TileType.Empty],
      [TileType.Path,   TileType.Empty, TileType.Empty],
      [TileType.Empty,  TileType.Empty, TileType.Empty],
    ]);
    // (0,0) 的右下邻是 Path
    expect(isAdjacentToPath(0, 0, map)).toBe(true);
  });

  it('空地四周无路径 → false', () => {
    const map = makeMap([
      [TileType.Empty, TileType.Empty, TileType.Empty],
      [TileType.Empty, TileType.Empty, TileType.Empty],
      [TileType.Empty, TileType.Empty, TileType.Empty],
    ]);
    expect(isAdjacentToPath(1, 1, map)).toBe(false);
  });

  it('8方向任意邻格有路径即为true', () => {
    // 测试对角邻格: Path在(1,1)，检查(0,0)的对角邻格
    const map = makeMap([
      [TileType.Empty, TileType.Empty, TileType.Empty],
      [TileType.Empty, TileType.Path,   TileType.Empty],
      [TileType.Empty, TileType.Empty, TileType.Empty],
    ]);
    // (0,0)的对角(1,1)是Path → true
    expect(isAdjacentToPath(0, 0, map)).toBe(true);
  });

  it('本身是路径但不算"邻接自己"', () => {
    const map = makeMap([
      [TileType.Path, TileType.Empty],
      [TileType.Empty, TileType.Empty],
    ]);
    // (0,0) 就是Path，但函数检查的是邻格，本身不在检查范围内
    // 如果周围都是 Empty，应返回 false
    expect(isAdjacentToPath(0, 0, map)).toBe(false);
  });

  it('边缘格不越界', () => {
    const map = makeMap([
      [TileType.Path, TileType.Empty],
      [TileType.Empty, TileType.Empty],
    ]);
    // (1,1) 处于右下角，邻接(0,0)=Path → true（对角邻格）
    expect(isAdjacentToPath(1, 1, map)).toBe(true);
    // (0,1) 邻接 Path(0,0) → true
    expect(isAdjacentToPath(0, 1, map)).toBe(true);
  });

  it('多路径场景', () => {
    const map = makeMap([
      [TileType.Empty, TileType.Path,   TileType.Empty],
      [TileType.Path,   TileType.Empty, TileType.Empty],
      [TileType.Empty,  TileType.Empty, TileType.Path],
    ]);
    // (1,1) 上下左右四个方向都有路径
    expect(isAdjacentToPath(1, 1, map)).toBe(true);
  });

  it('Blocked格不算路径', () => {
    const map = makeMap([
      [TileType.Empty,   TileType.Blocked],
      [TileType.Blocked, TileType.Empty],
    ]);
    // (0,0) 周围只有 Blocked，无 Path
    expect(isAdjacentToPath(0, 0, map)).toBe(false);
  });

  it('Base格不算路径', () => {
    const map = makeMap([
      [TileType.Empty, TileType.Base],
      [TileType.Empty, TileType.Empty],
    ]);
    expect(isAdjacentToPath(0, 0, map)).toBe(false);
  });
});
