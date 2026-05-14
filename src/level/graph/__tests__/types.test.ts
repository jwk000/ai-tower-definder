import { describe, it, expectTypeOf } from 'vitest';
import type {
  PathNode,
  PathEdge,
  PathGraph,
  PathNodeRole,
  SpawnPoint,
  WaveEnemyGroup,
} from '../types.js';

describe('graph/types — PathNodeRole', () => {
  it('union 包含 design/29 §4.5.2 定义的 5 个角色', () => {
    expectTypeOf<PathNodeRole>().toEqualTypeOf<
      'spawn' | 'waypoint' | 'branch' | 'portal' | 'crystal_anchor'
    >();
  });
});

describe('graph/types — PathNode', () => {
  it('必填字段：id / row / col / role', () => {
    const n: PathNode = {
      id: 'a0',
      row: 0,
      col: 0,
      role: 'waypoint',
    };
    expectTypeOf(n.id).toEqualTypeOf<string>();
    expectTypeOf(n.row).toEqualTypeOf<number>();
    expectTypeOf(n.col).toEqualTypeOf<number>();
    expectTypeOf(n.role).toEqualTypeOf<PathNodeRole>();
  });

  it('spawnId 可选（role=spawn 时业务上必填，由 schema 校验）', () => {
    const n: PathNode = {
      id: 'a0',
      row: 0,
      col: 0,
      role: 'spawn',
      spawnId: 'spawn_a',
    };
    expectTypeOf(n.spawnId).toEqualTypeOf<string | undefined>();
  });

  it('teleportTo 可选（role=portal 时业务上必填，由 schema 校验）', () => {
    const n: PathNode = {
      id: 'a4',
      row: 4,
      col: 10,
      role: 'portal',
      teleportTo: 'b2',
    };
    expectTypeOf(n.teleportTo).toEqualTypeOf<string | undefined>();
  });
});

describe('graph/types — PathEdge', () => {
  it('必填 from/to，weight 可选', () => {
    const e: PathEdge = { from: 'a0', to: 'a1' };
    expectTypeOf(e.from).toEqualTypeOf<string>();
    expectTypeOf(e.to).toEqualTypeOf<string>();
    expectTypeOf(e.weight).toEqualTypeOf<number | undefined>();
  });

  it('weight 可显式声明', () => {
    const e: PathEdge = { from: 'a2', to: 'a3', weight: 60 };
    expectTypeOf(e.weight).toEqualTypeOf<number | undefined>();
  });
});

describe('graph/types — PathGraph', () => {
  it('nodes 与 edges 数组', () => {
    const g: PathGraph = {
      nodes: [{ id: 'a0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_a' }],
      edges: [],
    };
    expectTypeOf(g.nodes).toEqualTypeOf<PathNode[]>();
    expectTypeOf(g.edges).toEqualTypeOf<PathEdge[]>();
  });
});

describe('graph/types — SpawnPoint', () => {
  it('必填 id/row/col，name 可选', () => {
    const s: SpawnPoint = { id: 'spawn_a', row: 0, col: 0 };
    expectTypeOf(s.id).toEqualTypeOf<string>();
    expectTypeOf(s.row).toEqualTypeOf<number>();
    expectTypeOf(s.col).toEqualTypeOf<number>();
    expectTypeOf(s.name).toEqualTypeOf<string | undefined>();
  });

  it('支持 name 字段', () => {
    const s: SpawnPoint = { id: 'spawn_a', row: 0, col: 0, name: '北口' };
    expectTypeOf(s.name).toEqualTypeOf<string | undefined>();
  });
});

describe('graph/types — WaveEnemyGroup', () => {
  it('必填 enemyType/count/spawnInterval，spawnId 可选', () => {
    const w: WaveEnemyGroup = {
      enemyType: 'grunt',
      count: 5,
      spawnInterval: 1.5,
    };
    expectTypeOf(w.enemyType).toEqualTypeOf<string>();
    expectTypeOf(w.count).toEqualTypeOf<number>();
    expectTypeOf(w.spawnInterval).toEqualTypeOf<number>();
    expectTypeOf(w.spawnId).toEqualTypeOf<string | undefined>();
  });
});
