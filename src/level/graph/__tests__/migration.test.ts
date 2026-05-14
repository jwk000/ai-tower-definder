import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { migrateEnemyPathToGraph } from '../migration.js';
import { graphConfigSchema } from '../schema.js';
import {
  buildPathGraphIndex,
  chooseNext,
  validateGraphAlgorithms,
} from '../PathGraph.js';
import { GameRandom } from '../../../utils/Random.js';

interface OldGridPos { row: number; col: number }

const fixtureEnemyPath = (): OldGridPos[] => [
  { row: 0, col: 0 },
  { row: 0, col: 20 },
  { row: 3, col: 20 },
  { row: 3, col: 1 },
  { row: 8, col: 1 },
];

describe('migrateEnemyPathToGraph — 基本结构', () => {
  it('返回 spawns + pathGraph', () => {
    const r = migrateEnemyPathToGraph({ enemyPath: fixtureEnemyPath() });
    expect(r.spawns).toBeDefined();
    expect(r.pathGraph).toBeDefined();
  });

  it('生成单个 spawn 条目 id=spawn_0，坐标取 enemyPath[0]', () => {
    const path = fixtureEnemyPath();
    const r = migrateEnemyPathToGraph({ enemyPath: path });
    expect(r.spawns).toHaveLength(1);
    expect(r.spawns[0]).toEqual({
      id: 'spawn_0',
      row: path[0]!.row,
      col: path[0]!.col,
    });
  });

  it('节点数等于 enemyPath 拐点数', () => {
    const path = fixtureEnemyPath();
    const r = migrateEnemyPathToGraph({ enemyPath: path });
    expect(r.pathGraph.nodes).toHaveLength(path.length);
  });

  it('第 0 个节点 role=spawn，绑定 spawn_0', () => {
    const r = migrateEnemyPathToGraph({ enemyPath: fixtureEnemyPath() });
    expect(r.pathGraph.nodes[0]).toMatchObject({
      id: 'n0',
      role: 'spawn',
      spawnId: 'spawn_0',
    });
  });

  it('中间节点 role=waypoint', () => {
    const r = migrateEnemyPathToGraph({ enemyPath: fixtureEnemyPath() });
    for (let i = 1; i < r.pathGraph.nodes.length - 1; i++) {
      expect(r.pathGraph.nodes[i]?.role).toBe('waypoint');
    }
  });

  it('末节点 role=crystal_anchor', () => {
    const r = migrateEnemyPathToGraph({ enemyPath: fixtureEnemyPath() });
    const last = r.pathGraph.nodes[r.pathGraph.nodes.length - 1];
    expect(last?.role).toBe('crystal_anchor');
  });

  it('节点 id 命名为 n0/n1/n2...', () => {
    const r = migrateEnemyPathToGraph({ enemyPath: fixtureEnemyPath() });
    r.pathGraph.nodes.forEach((n, i) => {
      expect(n.id).toBe(`n${i}`);
    });
  });

  it('每对相邻拐点生成无 weight 的有向边', () => {
    const path = fixtureEnemyPath();
    const r = migrateEnemyPathToGraph({ enemyPath: path });
    expect(r.pathGraph.edges).toHaveLength(path.length - 1);
    r.pathGraph.edges.forEach((e, i) => {
      expect(e.from).toBe(`n${i}`);
      expect(e.to).toBe(`n${i + 1}`);
      expect(e.weight).toBeUndefined();
    });
  });

  it('节点坐标继承原 enemyPath 的 row/col', () => {
    const path = fixtureEnemyPath();
    const r = migrateEnemyPathToGraph({ enemyPath: path });
    r.pathGraph.nodes.forEach((n, i) => {
      expect(n.row).toBe(path[i]!.row);
      expect(n.col).toBe(path[i]!.col);
    });
  });
});

describe('migrateEnemyPathToGraph — 边界与异常', () => {
  it('enemyPath 为空抛错', () => {
    expect(() => migrateEnemyPathToGraph({ enemyPath: [] })).toThrow();
  });

  it('单节点 enemyPath 抛错（无意义）', () => {
    expect(() =>
      migrateEnemyPathToGraph({ enemyPath: [{ row: 0, col: 0 }] }),
    ).toThrow();
  });

  it('两节点 enemyPath 合法：spawn → crystal_anchor', () => {
    const r = migrateEnemyPathToGraph({
      enemyPath: [{ row: 0, col: 0 }, { row: 0, col: 5 }],
    });
    expect(r.pathGraph.nodes).toHaveLength(2);
    expect(r.pathGraph.nodes[0]?.role).toBe('spawn');
    expect(r.pathGraph.nodes[1]?.role).toBe('crystal_anchor');
    expect(r.pathGraph.edges).toHaveLength(1);
  });
});

describe('migrateEnemyPathToGraph — 与 schema/算法层的契约一致性', () => {
  it('迁移结果 + 最少 wave 通过 graphConfigSchema', () => {
    const r = migrateEnemyPathToGraph({ enemyPath: fixtureEnemyPath() });
    const cfg = {
      spawns: r.spawns,
      pathGraph: r.pathGraph,
      waves: [
        {
          waveNumber: 1,
          spawnDelay: 0,
          enemies: [{ enemyType: 'grunt', count: 5, spawnInterval: 1 }],
        },
      ],
    };
    const parse = graphConfigSchema.safeParse(cfg);
    if (!parse.success) {
      throw new Error('schema 失败: ' + JSON.stringify(parse.error.issues));
    }
    expect(parse.success).toBe(true);
  });

  it('迁移结果通过 validateGraphAlgorithms（无环、无死端、可达）', () => {
    const r = migrateEnemyPathToGraph({ enemyPath: fixtureEnemyPath() });
    const errs = validateGraphAlgorithms({
      spawns: r.spawns,
      pathGraph: r.pathGraph,
      waves: [],
    });
    expect(errs).toEqual([]);
  });
});

describe('migrateEnemyPathToGraph — 行为等价性（线性图 ↔ 数组推进）', () => {
  it('chooseNext 链式调用还原原 enemyPath 顺序', () => {
    const path = fixtureEnemyPath();
    const r = migrateEnemyPathToGraph({ enemyPath: path });
    const idx = buildPathGraphIndex(r.pathGraph);
    const rng = new GameRandom(42);
    const traversed: string[] = ['n0'];
    let cur = 'n0';
    while (true) {
      const next = chooseNext(idx, cur, rng);
      if (next === null) break;
      traversed.push(next);
      cur = next;
    }
    const expected = path.map((_, i) => `n${i}`);
    expect(traversed).toEqual(expected);
  });

  it('线性图所有节点出度 ∈ {0, 1}（无分支随机）', () => {
    const r = migrateEnemyPathToGraph({ enemyPath: fixtureEnemyPath() });
    const idx = buildPathGraphIndex(r.pathGraph);
    for (const n of r.pathGraph.nodes) {
      const out = idx.outEdges.get(n.id);
      expect(out?.length === 0 || out?.length === 1).toBe(true);
    }
  });
});

// B.15 起 yaml fixture 已迁移为 pathGraph + spawns 编码，enemyPath 字段不再存在。
describe('L1-L5 真实 YAML 内嵌 pathGraph 合规验证（B.15）', () => {
  const levelsDir = resolve(__dirname, '../../../config/levels');
  const yamlFiles = readdirSync(levelsDir)
    .filter((f) => /^level-\d+\.yaml$/.test(f))
    .sort();

  interface RawSpawns { id: string; row: number; col: number }
  interface RawNode { id: string; row: number; col: number; role: string; spawnId?: string }
  interface RawEdge { from: string; to: string; weight?: number }
  interface RawPathGraph { nodes: RawNode[]; edges: RawEdge[] }
  interface RawMap { spawns?: RawSpawns[]; pathGraph?: RawPathGraph }

  const findMap = (obj: unknown): RawMap | null => {
    if (!obj || typeof obj !== 'object') return null;
    const rec = obj as Record<string, unknown>;
    if (rec.map && typeof rec.map === 'object') return rec.map as RawMap;
    for (const v of Object.values(rec)) {
      const found = findMap(v);
      if (found) return found;
    }
    return null;
  };

  it.each(yamlFiles)('%s 内嵌 pathGraph 通过 schema + 算法层 + 单链遍历', (file) => {
    const text = readFileSync(resolve(levelsDir, file), 'utf-8');
    const raw = yamlLoad(text);
    const map = findMap(raw);
    expect(map).not.toBeNull();
    expect(map!.spawns).toBeDefined();
    expect(map!.pathGraph).toBeDefined();
    expect(Array.isArray(map!.spawns)).toBe(true);
    expect(map!.spawns!.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(map!.pathGraph!.nodes)).toBe(true);
    expect(map!.pathGraph!.nodes.length).toBeGreaterThanOrEqual(2);

    const cfg = {
      spawns: map!.spawns,
      pathGraph: map!.pathGraph,
      waves: [
        {
          waveNumber: 1,
          spawnDelay: 0,
          enemies: [{ enemyType: 'grunt', count: 1, spawnInterval: 1 }],
        },
      ],
    };
    const schema = graphConfigSchema.safeParse(cfg);
    if (!schema.success) {
      throw new Error(`${file} schema: ${JSON.stringify(schema.error.issues)}`);
    }

    const errs = validateGraphAlgorithms(schema.data);
    if (errs.length > 0) {
      throw new Error(`${file} 算法层错误: ${errs.join(' | ')}`);
    }

    const idx = buildPathGraphIndex(schema.data.pathGraph);
    const rng = new GameRandom(0);
    const reachableFromSpawn = new Set<string>();
    let cur: string | null = 'n0';
    while (cur !== null) {
      reachableFromSpawn.add(cur);
      cur = chooseNext(idx, cur, rng);
    }
    expect(reachableFromSpawn.size).toBe(schema.data.pathGraph.nodes.length);
  });
});
