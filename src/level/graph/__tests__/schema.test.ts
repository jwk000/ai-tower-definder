import { describe, it, expect } from 'vitest';
import {
  pathNodeSchema,
  pathEdgeSchema,
  pathGraphSchema,
  spawnPointSchema,
  waveEnemyGroupSchema,
  graphConfigSchema,
} from '../schema.js';

describe('pathNodeSchema — id 正则 ^[a-z][a-z0-9_]*$', () => {
  it.each([
    ['a0', true],
    ['spawn_a', true],
    ['crystal_anchor_1', true],
    ['a', true],
    ['A0', false],
    ['0a', false],
    ['_a', false],
    ['a-b', false],
    ['', false],
    ['a.b', false],
  ])('id=%j → %s', (id, ok) => {
    const r = pathNodeSchema.safeParse({ id, row: 0, col: 0, role: 'waypoint' });
    expect(r.success).toBe(ok);
  });
});

describe('pathNodeSchema — role 联合', () => {
  it.each(['spawn', 'waypoint', 'branch', 'portal', 'crystal_anchor'])('role=%s 接受', (role) => {
    const base = { id: 'a0', row: 0, col: 0, role } as Record<string, unknown>;
    if (role === 'spawn') base.spawnId = 'spawn_a';
    if (role === 'portal') base.teleportTo = 'b1';
    expect(pathNodeSchema.safeParse(base).success).toBe(true);
  });

  it('未知 role 拒绝', () => {
    const r = pathNodeSchema.safeParse({ id: 'a0', row: 0, col: 0, role: 'enemy_base' });
    expect(r.success).toBe(false);
  });
});

describe('pathNodeSchema — role↔字段双向耦合（I4/I5）', () => {
  it('role=spawn 必填 spawnId', () => {
    const r = pathNodeSchema.safeParse({ id: 'a0', row: 0, col: 0, role: 'spawn' });
    expect(r.success).toBe(false);
  });

  it('role=portal 必填 teleportTo', () => {
    const r = pathNodeSchema.safeParse({ id: 'a4', row: 4, col: 10, role: 'portal' });
    expect(r.success).toBe(false);
  });

  it('role=waypoint 携带 spawnId 拒绝（避免误配）', () => {
    const r = pathNodeSchema.safeParse({
      id: 'a1',
      row: 0,
      col: 10,
      role: 'waypoint',
      spawnId: 'spawn_a',
    });
    expect(r.success).toBe(false);
  });

  it('role=waypoint 携带 teleportTo 拒绝', () => {
    const r = pathNodeSchema.safeParse({
      id: 'a1',
      row: 0,
      col: 10,
      role: 'waypoint',
      teleportTo: 'a2',
    });
    expect(r.success).toBe(false);
  });

  it('role=branch 不要 spawnId/teleportTo', () => {
    const r = pathNodeSchema.safeParse({ id: 'a2', row: 0, col: 20, role: 'branch' });
    expect(r.success).toBe(true);
  });

  it('role=crystal_anchor 不要 spawnId/teleportTo', () => {
    const r = pathNodeSchema.safeParse({ id: 'a5', row: 4, col: 1, role: 'crystal_anchor' });
    expect(r.success).toBe(true);
  });

  it('role=portal teleportTo 指向自身拒绝', () => {
    const r = pathNodeSchema.safeParse({
      id: 'a4',
      row: 4,
      col: 10,
      role: 'portal',
      teleportTo: 'a4',
    });
    expect(r.success).toBe(false);
  });
});

describe('pathNodeSchema — row/col 数值约束', () => {
  it('row 必须非负整数', () => {
    expect(pathNodeSchema.safeParse({ id: 'a0', row: -1, col: 0, role: 'waypoint' }).success).toBe(false);
    expect(pathNodeSchema.safeParse({ id: 'a0', row: 1.5, col: 0, role: 'waypoint' }).success).toBe(false);
  });

  it('col 必须非负整数', () => {
    expect(pathNodeSchema.safeParse({ id: 'a0', row: 0, col: -1, role: 'waypoint' }).success).toBe(false);
    expect(pathNodeSchema.safeParse({ id: 'a0', row: 0, col: 1.5, role: 'waypoint' }).success).toBe(false);
  });
});

describe('pathEdgeSchema', () => {
  it('from/to 必须是合法 id', () => {
    expect(pathEdgeSchema.safeParse({ from: 'a0', to: 'a1' }).success).toBe(true);
    expect(pathEdgeSchema.safeParse({ from: 'A0', to: 'a1' }).success).toBe(false);
    expect(pathEdgeSchema.safeParse({ from: 'a0', to: '' }).success).toBe(false);
  });

  it('weight 缺省合法（默认按 1 计算，由运行时层处理）', () => {
    expect(pathEdgeSchema.safeParse({ from: 'a2', to: 'a3' }).success).toBe(true);
  });

  it('weight 非负整数（I8）', () => {
    expect(pathEdgeSchema.safeParse({ from: 'a2', to: 'a3', weight: 0 }).success).toBe(true);
    expect(pathEdgeSchema.safeParse({ from: 'a2', to: 'a3', weight: 60 }).success).toBe(true);
    expect(pathEdgeSchema.safeParse({ from: 'a2', to: 'a3', weight: -1 }).success).toBe(false);
    expect(pathEdgeSchema.safeParse({ from: 'a2', to: 'a3', weight: 1.5 }).success).toBe(false);
  });

  it('from=to 自环拒绝', () => {
    expect(pathEdgeSchema.safeParse({ from: 'a0', to: 'a0' }).success).toBe(false);
  });
});

describe('spawnPointSchema', () => {
  it('id 正则同 PathNode', () => {
    expect(spawnPointSchema.safeParse({ id: 'spawn_a', row: 0, col: 0 }).success).toBe(true);
    expect(spawnPointSchema.safeParse({ id: 'Spawn_A', row: 0, col: 0 }).success).toBe(false);
  });

  it('name 可选', () => {
    expect(spawnPointSchema.safeParse({ id: 'spawn_a', row: 0, col: 0, name: '北口' }).success).toBe(true);
  });

  it('row/col 非负整数', () => {
    expect(spawnPointSchema.safeParse({ id: 'spawn_a', row: -1, col: 0 }).success).toBe(false);
  });
});

describe('waveEnemyGroupSchema', () => {
  it('enemyType / count / spawnInterval 必填', () => {
    expect(waveEnemyGroupSchema.safeParse({ enemyType: 'grunt', count: 5, spawnInterval: 1.5 }).success).toBe(true);
    expect(waveEnemyGroupSchema.safeParse({ enemyType: '', count: 5, spawnInterval: 1.5 }).success).toBe(false);
    expect(waveEnemyGroupSchema.safeParse({ enemyType: 'grunt', count: 0, spawnInterval: 1.5 }).success).toBe(false);
    expect(waveEnemyGroupSchema.safeParse({ enemyType: 'grunt', count: 5, spawnInterval: -1 }).success).toBe(false);
  });

  it('spawnId 可选', () => {
    expect(waveEnemyGroupSchema.safeParse({ enemyType: 'grunt', count: 5, spawnInterval: 1 }).success).toBe(true);
    expect(waveEnemyGroupSchema.safeParse({
      enemyType: 'grunt',
      count: 5,
      spawnInterval: 1,
      spawnId: 'spawn_a',
    }).success).toBe(true);
  });
});

describe('pathGraphSchema — 节点 id 唯一性（I3）', () => {
  it('唯一 id 通过', () => {
    const g = {
      nodes: [
        { id: 'a0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_a' },
        { id: 'a1', row: 0, col: 10, role: 'crystal_anchor' },
      ],
      edges: [{ from: 'a0', to: 'a1' }],
    };
    expect(pathGraphSchema.safeParse(g).success).toBe(true);
  });

  it('重复 id 拒绝', () => {
    const g = {
      nodes: [
        { id: 'a0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_a' },
        { id: 'a0', row: 0, col: 10, role: 'crystal_anchor' },
      ],
      edges: [],
    };
    expect(pathGraphSchema.safeParse(g).success).toBe(false);
  });
});

describe('pathGraphSchema — 边引用存在性', () => {
  it('边 from/to 必须指向存在的节点', () => {
    const g = {
      nodes: [{ id: 'a0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_a' }],
      edges: [{ from: 'a0', to: 'ghost' }],
    };
    expect(pathGraphSchema.safeParse(g).success).toBe(false);
  });
});

describe('pathGraphSchema — portal teleportTo 引用存在性（I5）', () => {
  it('teleportTo 指向不存在的节点拒绝', () => {
    const g = {
      nodes: [
        { id: 'a0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_a' },
        { id: 'a4', row: 4, col: 0, role: 'portal', teleportTo: 'ghost' },
      ],
      edges: [{ from: 'a0', to: 'a4' }],
    };
    expect(pathGraphSchema.safeParse(g).success).toBe(false);
  });
});

describe('graphConfigSchema — 顶层最少计数（I12 子集）', () => {
  const validNode = (id: string, role: string, extra: Record<string, unknown> = {}) => ({
    id,
    row: 0,
    col: 0,
    role,
    ...extra,
  });

  it('至少 1 个 spawn + 1 个 crystal_anchor + 1 条边', () => {
    const cfg = {
      spawns: [{ id: 'spawn_a', row: 0, col: 0 }],
      pathGraph: {
        nodes: [
          validNode('a0', 'spawn', { spawnId: 'spawn_a' }),
          validNode('a1', 'crystal_anchor'),
        ],
        edges: [{ from: 'a0', to: 'a1' }],
      },
      waves: [
        {
          waveNumber: 1,
          spawnDelay: 2,
          enemies: [{ enemyType: 'grunt', count: 5, spawnInterval: 1 }],
        },
      ],
    };
    expect(graphConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('spawns 为空拒绝', () => {
    const cfg = {
      spawns: [],
      pathGraph: {
        nodes: [validNode('a0', 'crystal_anchor')],
        edges: [],
      },
      waves: [],
    };
    expect(graphConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('没有 crystal_anchor 节点拒绝', () => {
    const cfg = {
      spawns: [{ id: 'spawn_a', row: 0, col: 0 }],
      pathGraph: {
        nodes: [validNode('a0', 'spawn', { spawnId: 'spawn_a' })],
        edges: [],
      },
      waves: [],
    };
    expect(graphConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('spawn 节点 spawnId 必须存在于 spawns[]（I4）', () => {
    const cfg = {
      spawns: [{ id: 'spawn_a', row: 0, col: 0 }],
      pathGraph: {
        nodes: [
          validNode('a0', 'spawn', { spawnId: 'ghost' }),
          validNode('a1', 'crystal_anchor'),
        ],
        edges: [{ from: 'a0', to: 'a1' }],
      },
      waves: [],
    };
    expect(graphConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('wave.enemies[].spawnId 引用必须存在（I11）', () => {
    const cfg = {
      spawns: [{ id: 'spawn_a', row: 0, col: 0 }],
      pathGraph: {
        nodes: [
          validNode('a0', 'spawn', { spawnId: 'spawn_a' }),
          validNode('a1', 'crystal_anchor'),
        ],
        edges: [{ from: 'a0', to: 'a1' }],
      },
      waves: [
        {
          waveNumber: 1,
          spawnDelay: 0,
          enemies: [{ enemyType: 'grunt', count: 5, spawnInterval: 1, spawnId: 'ghost' }],
        },
      ],
    };
    expect(graphConfigSchema.safeParse(cfg).success).toBe(false);
  });

  it('wave.enemies[].spawnId 缺省合法', () => {
    const cfg = {
      spawns: [{ id: 'spawn_a', row: 0, col: 0 }],
      pathGraph: {
        nodes: [
          validNode('a0', 'spawn', { spawnId: 'spawn_a' }),
          validNode('a1', 'crystal_anchor'),
        ],
        edges: [{ from: 'a0', to: 'a1' }],
      },
      waves: [
        {
          waveNumber: 1,
          spawnDelay: 0,
          enemies: [{ enemyType: 'grunt', count: 5, spawnInterval: 1 }],
        },
      ],
    };
    expect(graphConfigSchema.safeParse(cfg).success).toBe(true);
  });
});
