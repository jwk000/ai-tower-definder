import { describe, it, expect } from 'vitest';
import {
  buildPathGraphIndex,
  chooseNext,
  resolvePortal,
  findCycle,
  canReachCrystalAnchor,
  validateGeometry,
  findDeadEndNodes,
  validateGraphAlgorithms,
} from '../PathGraph.js';
import type { PathGraph, PathNode, PathEdge } from '../types.js';
import { GameRandom } from '../../../utils/Random.js';

const node = (
  id: string,
  row: number,
  col: number,
  role: PathNode['role'],
  extra: Partial<PathNode> = {},
): PathNode => ({ id, row, col, role, ...extra });

const edge = (from: string, to: string, weight?: number): PathEdge =>
  weight !== undefined ? { from, to, weight } : { from, to };

const linearGraph = (): PathGraph => ({
  nodes: [
    node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
    node('a1', 0, 10, 'waypoint'),
    node('a2', 0, 20, 'crystal_anchor'),
  ],
  edges: [edge('a0', 'a1'), edge('a1', 'a2')],
});

const branchGraph = (): PathGraph => ({
  nodes: [
    node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
    node('a1', 0, 10, 'branch'),
    node('a2', 0, 20, 'crystal_anchor'),
    node('a3', 4, 10, 'crystal_anchor'),
  ],
  edges: [edge('a0', 'a1'), edge('a1', 'a2', 70), edge('a1', 'a3', 30)],
});

const portalGraph = (): PathGraph => ({
  nodes: [
    node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
    node('a1', 0, 10, 'portal', { teleportTo: 'b0' }),
    node('b0', 8, 0, 'waypoint'),
    node('b1', 8, 10, 'crystal_anchor'),
  ],
  edges: [edge('a0', 'a1'), edge('b0', 'b1')],
});

describe('buildPathGraphIndex', () => {
  it('返回 nodeById 与 outEdges 索引', () => {
    const g = linearGraph();
    const idx = buildPathGraphIndex(g);
    expect(idx.nodeById.get('a0')?.id).toBe('a0');
    expect(idx.nodeById.size).toBe(3);
    expect(idx.outEdges.get('a0')).toHaveLength(1);
    expect(idx.outEdges.get('a1')).toHaveLength(1);
    expect(idx.outEdges.get('a2')).toHaveLength(0);
  });

  it('分支节点 outEdges 含所有出边', () => {
    const idx = buildPathGraphIndex(branchGraph());
    expect(idx.outEdges.get('a1')).toHaveLength(2);
  });
});

describe('chooseNext — 单一出边', () => {
  it('线性图返回唯一后继', () => {
    const idx = buildPathGraphIndex(linearGraph());
    const rng = new GameRandom(42);
    expect(chooseNext(idx, 'a0', rng)).toBe('a1');
    expect(chooseNext(idx, 'a1', rng)).toBe('a2');
  });

  it('终点（crystal_anchor）返回 null', () => {
    const idx = buildPathGraphIndex(linearGraph());
    const rng = new GameRandom(42);
    expect(chooseNext(idx, 'a2', rng)).toBeNull();
  });

  it('不存在的节点返回 null', () => {
    const idx = buildPathGraphIndex(linearGraph());
    const rng = new GameRandom(42);
    expect(chooseNext(idx, 'ghost', rng)).toBeNull();
  });
});

describe('chooseNext — 加权随机', () => {
  it('确定性：同种子相同结果', () => {
    const idx = buildPathGraphIndex(branchGraph());
    const r1 = new GameRandom(123);
    const r2 = new GameRandom(123);
    const seq1 = Array.from({ length: 20 }, () => chooseNext(idx, 'a1', r1));
    const seq2 = Array.from({ length: 20 }, () => chooseNext(idx, 'a1', r2));
    expect(seq1).toEqual(seq2);
  });

  it('1000 次采样接近 weight 比例（70/30，容忍 ±5%）', () => {
    const idx = buildPathGraphIndex(branchGraph());
    const rng = new GameRandom(7777);
    let a2 = 0;
    let a3 = 0;
    for (let i = 0; i < 1000; i++) {
      const next = chooseNext(idx, 'a1', rng);
      if (next === 'a2') a2++;
      else if (next === 'a3') a3++;
    }
    expect(a2 / 1000).toBeGreaterThan(0.65);
    expect(a2 / 1000).toBeLessThan(0.75);
    expect(a3 / 1000).toBeGreaterThan(0.25);
    expect(a3 / 1000).toBeLessThan(0.35);
  });

  it('weight 缺省按 1 计算（等概率）', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
        node('a1', 0, 10, 'branch'),
        node('a2', 0, 20, 'crystal_anchor'),
        node('a3', 4, 10, 'crystal_anchor'),
      ],
      edges: [edge('a0', 'a1'), edge('a1', 'a2'), edge('a1', 'a3')],
    };
    const idx = buildPathGraphIndex(g);
    const rng = new GameRandom(9999);
    let a2 = 0;
    for (let i = 0; i < 1000; i++) {
      if (chooseNext(idx, 'a1', rng) === 'a2') a2++;
    }
    expect(a2 / 1000).toBeGreaterThan(0.45);
    expect(a2 / 1000).toBeLessThan(0.55);
  });

  it('权重和为 0 时返回 null', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'branch'),
        node('a1', 0, 10, 'crystal_anchor'),
        node('a2', 4, 10, 'crystal_anchor'),
      ],
      edges: [edge('a0', 'a1', 0), edge('a0', 'a2', 0)],
    };
    const idx = buildPathGraphIndex(g);
    const rng = new GameRandom(1);
    expect(chooseNext(idx, 'a0', rng)).toBeNull();
  });
});

describe('resolvePortal', () => {
  it('portal 节点返回 teleportTo', () => {
    const idx = buildPathGraphIndex(portalGraph());
    expect(resolvePortal(idx, 'a1')).toEqual({ teleportTo: 'b0' });
  });

  it('非 portal 节点返回 null', () => {
    const idx = buildPathGraphIndex(portalGraph());
    expect(resolvePortal(idx, 'a0')).toBeNull();
    expect(resolvePortal(idx, 'b0')).toBeNull();
  });

  it('teleportTo 指向不存在的节点也返回 null（防御性）', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'portal', { teleportTo: 'ghost' }),
        node('a1', 0, 10, 'crystal_anchor'),
      ],
      edges: [],
    };
    const idx = buildPathGraphIndex(g);
    expect(resolvePortal(idx, 'a0')).toBeNull();
  });
});

describe('findCycle — I7 环路检测', () => {
  it('线性图无环', () => {
    expect(findCycle(linearGraph())).toBeNull();
  });

  it('简单环 a0→a1→a0', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
        node('a1', 0, 10, 'waypoint'),
      ],
      edges: [edge('a0', 'a1'), edge('a1', 'a0')],
    };
    const cycle = findCycle(g);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('a0');
    expect(cycle).toContain('a1');
  });

  it('三节点环 a0→a1→a2→a0', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
        node('a1', 0, 10, 'waypoint'),
        node('a2', 0, 20, 'waypoint'),
      ],
      edges: [edge('a0', 'a1'), edge('a1', 'a2'), edge('a2', 'a0')],
    };
    expect(findCycle(g)).not.toBeNull();
  });

  it('portal 跳转不计入环路（设计明确）', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
        node('a1', 0, 10, 'portal', { teleportTo: 'a0' }),
        node('a2', 8, 10, 'crystal_anchor'),
      ],
      edges: [edge('a0', 'a1'), edge('a0', 'a2')],
    };
    expect(findCycle(g)).toBeNull();
  });

  it('自环（理论 schema 已禁止，但纯函数层也应捕获）', () => {
    const g: PathGraph = {
      nodes: [node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' })],
      edges: [{ from: 'a0', to: 'a0' }],
    };
    expect(findCycle(g)).not.toBeNull();
  });
});

describe('canReachCrystalAnchor — I6 可达性（含 portal 跳转）', () => {
  it('线性图从 spawn 可达', () => {
    const idx = buildPathGraphIndex(linearGraph());
    expect(canReachCrystalAnchor(idx, 'a0')).toBe(true);
  });

  it('分支图两条边都通向 crystal_anchor', () => {
    const idx = buildPathGraphIndex(branchGraph());
    expect(canReachCrystalAnchor(idx, 'a0')).toBe(true);
  });

  it('portal 跳转后可达', () => {
    const idx = buildPathGraphIndex(portalGraph());
    expect(canReachCrystalAnchor(idx, 'a0')).toBe(true);
  });

  it('孤岛 spawn 不可达', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
        node('b0', 8, 0, 'crystal_anchor'),
      ],
      edges: [],
    };
    const idx = buildPathGraphIndex(g);
    expect(canReachCrystalAnchor(idx, 'a0')).toBe(false);
  });

  it('portal 指向死胡同也不可达', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
        node('a1', 0, 10, 'portal', { teleportTo: 'b0' }),
        node('b0', 8, 0, 'waypoint'),
        node('c0', 4, 4, 'crystal_anchor'),
      ],
      edges: [edge('a0', 'a1')],
    };
    const idx = buildPathGraphIndex(g);
    expect(canReachCrystalAnchor(idx, 'a0')).toBe(false);
  });
});

describe('validateGeometry — I9 同行/同列 + I10 tile 类型', () => {
  const tilePath = 'path';
  const tileSpawn = 'spawn';
  const tileCrystal = 'crystal';
  const tileGrass = 'grass';

  it('同行直线 + path tile 通过', () => {
    const g = linearGraph();
    const tiles = Array.from({ length: 9 }, () => Array(21).fill(tilePath));
    tiles[0]![0] = tileSpawn;
    tiles[0]![20] = tileCrystal;
    const errs = validateGeometry(g, tiles, ['path', 'spawn', 'crystal']);
    expect(errs).toHaveLength(0);
  });

  it('斜线（不同行不同列）拒绝（I9）', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
        node('a1', 5, 5, 'crystal_anchor'),
      ],
      edges: [edge('a0', 'a1')],
    };
    const tiles = Array.from({ length: 9 }, () => Array(21).fill(tilePath));
    const errs = validateGeometry(g, tiles, ['path', 'spawn', 'crystal']);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.some((e) => e.includes('a0') && e.includes('a1'))).toBe(true);
  });

  it('线段经过非 path tile 拒绝（I10）', () => {
    const g = linearGraph();
    const tiles = Array.from({ length: 9 }, () => Array(21).fill(tilePath));
    tiles[0]![0] = tileSpawn;
    tiles[0]![5] = tileGrass;
    tiles[0]![20] = tileCrystal;
    const errs = validateGeometry(g, tiles, ['path', 'spawn', 'crystal']);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('节点超出 tile 网格拒绝', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
        node('a1', 0, 999, 'crystal_anchor'),
      ],
      edges: [edge('a0', 'a1')],
    };
    const tiles = Array.from({ length: 9 }, () => Array(21).fill(tilePath));
    const errs = validateGeometry(g, tiles, ['path', 'spawn', 'crystal']);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('portal 节点不需要从 portal→teleportTo 的几何线（瞬移）', () => {
    const g = portalGraph();
    const tiles = Array.from({ length: 9 }, () => Array(21).fill(tilePath));
    tiles[0]![0] = tileSpawn;
    tiles[8]![10] = tileCrystal;
    const errs = validateGeometry(g, tiles, ['path', 'spawn', 'crystal']);
    expect(errs).toHaveLength(0);
  });
});

describe('findDeadEndNodes — I13 非 crystal 节点必须有出边', () => {
  it('线性图无死端', () => {
    expect(findDeadEndNodes(linearGraph())).toEqual([]);
  });

  it('waypoint 无出边视为死端', () => {
    const g: PathGraph = {
      nodes: [
        node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
        node('a1', 0, 10, 'waypoint'),
        node('a2', 0, 20, 'crystal_anchor'),
      ],
      edges: [edge('a0', 'a1')],
    };
    expect(findDeadEndNodes(g)).toEqual(['a1']);
  });

  it('crystal_anchor 无出边视为合法终点', () => {
    expect(findDeadEndNodes(linearGraph())).not.toContain('a2');
  });
});

describe('validateGraphAlgorithms — 汇总入口', () => {
  it('合法图返回空数组', () => {
    const cfg = {
      spawns: [{ id: 'spawn_a', row: 0, col: 0 }],
      pathGraph: linearGraph(),
      waves: [],
    };
    const tiles = Array.from({ length: 9 }, () => Array(21).fill('path'));
    tiles[0]![0] = 'spawn';
    tiles[0]![20] = 'crystal';
    expect(validateGraphAlgorithms(cfg, tiles, ['path', 'spawn', 'crystal'])).toEqual([]);
  });

  it('多类错误一并返回（环 + 死端）', () => {
    const cfg = {
      spawns: [{ id: 'spawn_a', row: 0, col: 0 }],
      pathGraph: {
        nodes: [
          node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
          node('a1', 0, 10, 'waypoint'),
        ],
        edges: [edge('a0', 'a1'), edge('a1', 'a0')],
      },
      waves: [],
    };
    const errs = validateGraphAlgorithms(cfg);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('从某个 spawn 不可达 crystal 时报错', () => {
    const cfg = {
      spawns: [
        { id: 'spawn_a', row: 0, col: 0 },
        { id: 'spawn_b', row: 8, col: 0 },
      ],
      pathGraph: {
        nodes: [
          node('a0', 0, 0, 'spawn', { spawnId: 'spawn_a' }),
          node('a1', 0, 10, 'crystal_anchor'),
          node('b0', 8, 0, 'spawn', { spawnId: 'spawn_b' }),
        ],
        edges: [edge('a0', 'a1')],
      },
      waves: [],
    };
    const errs = validateGraphAlgorithms(cfg);
    expect(errs.some((e) => e.includes('b0') || e.includes('spawn_b'))).toBe(true);
  });

  it('tiles 缺省时跳过几何校验', () => {
    const cfg = {
      spawns: [{ id: 'spawn_a', row: 0, col: 0 }],
      pathGraph: linearGraph(),
      waves: [],
    };
    expect(validateGraphAlgorithms(cfg)).toEqual([]);
  });
});
