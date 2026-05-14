import { describe, it, expect } from 'vitest';
import { validateLevel, type ValidationError } from '../levelValidation.js';
import type { LevelFormModel, TileCell } from '../levelModel.js';
import type { PathGraph, PathNode, SpawnPoint } from '../../../level/graph/types.js';

function makeWalkableTiles(): TileCell[][] {
  const rows: TileCell[][] = [];
  for (let r = 0; r < 3; r++) {
    const row: TileCell[] = [];
    for (let c = 0; c < 5; c++) {
      if (r !== 0) row.push('empty');
      else if (c === 0) row.push('spawn');
      else if (c === 4) row.push('base');
      else row.push('path');
    }
    rows.push(row);
  }
  return rows;
}

function makeBaseModel(overrides: Partial<LevelFormModel> = {}): LevelFormModel {
  const spawn: SpawnPoint = { id: 'spawn_0', row: 0, col: 0 };
  const nodes: PathNode[] = [
    { id: 'n0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_0' },
    { id: 'n1', row: 0, col: 4, role: 'crystal_anchor' },
  ];
  const graph: PathGraph = {
    nodes,
    edges: [{ from: 'n0', to: 'n1' }],
  };
  return {
    id: 'L_test',
    name: 'Test',
    map: {
      cols: 5,
      rows: 3,
      tileSize: 64,
      tiles: makeWalkableTiles(),
      spawns: [spawn],
      pathGraph: graph,
    },
    waves: [
      { waveNumber: 1, spawnDelay: 0, enemies: [{ enemyType: 'goblin', count: 5, spawnInterval: 1 }] },
    ],
    ...overrides,
  };
}

function codes(errors: ValidationError[]): string[] {
  return errors.map((e) => e.code);
}

describe('validateLevel — happy path', () => {
  it('returns no errors for the minimal valid linear level', () => {
    expect(validateLevel(makeBaseModel())).toEqual([]);
  });
});

describe('validateLevel — I12 基础存在性', () => {
  it('flags missing spawns', () => {
    const m = makeBaseModel();
    m.map.spawns = [];
    expect(codes(validateLevel(m))).toContain('I12_NO_SPAWN');
  });

  it('flags empty pathGraph nodes', () => {
    const m = makeBaseModel();
    m.map.pathGraph = { nodes: [], edges: [] };
    expect(codes(validateLevel(m))).toContain('I12_EMPTY_GRAPH');
  });

  it('flags missing crystal_anchor', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes[1]!.role = 'waypoint';
    m.map.pathGraph!.nodes.push({ id: 'n2', row: 1, col: 4, role: 'waypoint' });
    m.map.pathGraph!.edges.push({ from: 'n1', to: 'n2' });
    expect(codes(validateLevel(m))).toContain('I12_NO_CRYSTAL_ANCHOR');
  });

  it('flags zero edges', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.edges = [];
    expect(codes(validateLevel(m))).toContain('I12_NO_EDGE');
  });
});

describe('validateLevel — I3 节点 id 唯一', () => {
  it('flags duplicate node ids', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes.push({ id: 'n0', row: 0, col: 2, role: 'waypoint' });
    expect(codes(validateLevel(m))).toContain('I3_DUPLICATE_NODE_ID');
  });
});

describe('validateLevel — I4 spawn 节点 spawnId 合法', () => {
  it('flags spawn node without spawnId', () => {
    const m = makeBaseModel();
    delete m.map.pathGraph!.nodes[0]!.spawnId;
    expect(codes(validateLevel(m))).toContain('I4_SPAWN_NO_SPAWN_ID');
  });

  it('flags spawn node with spawnId not in spawns[]', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes[0]!.spawnId = 'spawn_ghost';
    expect(codes(validateLevel(m))).toContain('I4_SPAWN_ID_NOT_FOUND');
  });
});

describe('validateLevel — I5 portal teleportTo 合法', () => {
  it('flags portal without teleportTo', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes.push({ id: 'p0', row: 0, col: 2, role: 'portal' });
    expect(codes(validateLevel(m))).toContain('I5_PORTAL_NO_TELEPORT_TO');
  });

  it('flags portal with teleportTo pointing to nonexistent node', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes.push({ id: 'p0', row: 0, col: 2, role: 'portal', teleportTo: 'ghost' });
    expect(codes(validateLevel(m))).toContain('I5_PORTAL_TELEPORT_TO_MISSING');
  });
});

describe('validateLevel — I9 相邻节点同行/同列', () => {
  it('flags edge between nodes not on the same row or column', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes.push({ id: 'n2', row: 1, col: 1, role: 'waypoint' });
    m.map.pathGraph!.edges.push({ from: 'n0', to: 'n2' });
    expect(codes(validateLevel(m))).toContain('I9_EDGE_NOT_ALIGNED');
  });
});

describe('validateLevel — I10 边经过 tile 合法', () => {
  it('flags edge crossing an empty tile', () => {
    const m = makeBaseModel();
    m.map.tiles[0]![2] = 'empty';
    expect(codes(validateLevel(m))).toContain('I10_EDGE_TILE_INVALID');
  });

  it('accepts crystal tile on the path', () => {
    const m = makeBaseModel();
    m.map.tiles[0]![3] = 'crystal';
    expect(codes(validateLevel(m)).filter((c) => c === 'I10_EDGE_TILE_INVALID')).toEqual([]);
  });

  it('accepts base tile on the path as alias for crystal', () => {
    expect(codes(validateLevel(makeBaseModel())).filter((c) => c === 'I10_EDGE_TILE_INVALID')).toEqual([]);
  });
});

describe('validateLevel — I13 出度', () => {
  it('flags a waypoint with no outgoing edge', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes.push({ id: 'n2', row: 0, col: 2, role: 'waypoint' });
    expect(codes(validateLevel(m))).toContain('I13_NODE_NO_OUTGOING');
  });

  it('does not flag crystal_anchor for missing outgoing edge', () => {
    expect(codes(validateLevel(makeBaseModel()))).not.toContain('I13_NODE_NO_OUTGOING');
  });
});

describe('validateLevel — I8 权重和 > 0 / 非负', () => {
  it('flags negative weights', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.edges[0]!.weight = -1;
    expect(codes(validateLevel(m))).toContain('I8_EDGE_NEGATIVE_WEIGHT');
  });

  it('flags node whose outgoing weight sum is 0', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes[0]!.role = 'branch';
    m.map.pathGraph!.nodes.push({ id: 'n2', row: 2, col: 0, role: 'waypoint' });
    m.map.pathGraph!.edges[0]!.weight = 0;
    m.map.pathGraph!.edges.push({ from: 'n0', to: 'n2', weight: 0 });
    m.map.pathGraph!.edges.push({ from: 'n2', to: 'n1', weight: 1 });
    for (let c = 0; c < 5; c++) m.map.tiles[2]![c] = 'path';
    m.map.tiles[1]![0] = 'path';
    m.map.tiles[1]![4] = 'path';
    expect(codes(validateLevel(m))).toContain('I8_OUT_WEIGHT_SUM_ZERO');
  });

  it('flags branch node with fewer than 2 outgoing edges', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes[0]!.role = 'branch';
    expect(codes(validateLevel(m))).toContain('I8_BRANCH_OUT_DEGREE');
  });
});

describe('validateLevel — I7 环路检测', () => {
  it('flags a simple 2-node cycle', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.edges.push({ from: 'n1', to: 'n0' });
    expect(codes(validateLevel(m))).toContain('I7_CYCLE_DETECTED');
  });

  it('does NOT flag a portal teleport-back as a cycle', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes.push({ id: 'n2', row: 0, col: 3, role: 'portal', teleportTo: 'n0' });
    expect(codes(validateLevel(m))).not.toContain('I7_CYCLE_DETECTED');
  });
});

describe('validateLevel — I6 spawn → crystal_anchor 可达', () => {
  it('flags spawn that cannot reach any crystal_anchor', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.edges = [];
    expect(codes(validateLevel(m))).toContain('I6_SPAWN_UNREACHABLE');
  });

  it('treats portal teleport as a logical successor for reachability', () => {
    const m = makeBaseModel();
    m.map.pathGraph!.nodes = [
      { id: 'n0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_0' },
      { id: 'n2', row: 0, col: 2, role: 'portal', teleportTo: 'n3' },
      { id: 'n3', row: 2, col: 0, role: 'waypoint' },
      { id: 'n1', row: 2, col: 4, role: 'crystal_anchor' },
    ];
    m.map.pathGraph!.edges = [
      { from: 'n0', to: 'n2' },
      { from: 'n3', to: 'n1' },
    ];
    for (let c = 0; c < 5; c++) m.map.tiles[2]![c] = 'path';
    m.map.tiles[2]![4] = 'base';
    expect(codes(validateLevel(m))).not.toContain('I6_SPAWN_UNREACHABLE');
  });
});

describe('validateLevel — I11 wave spawnId 合法', () => {
  it('flags wave enemy group referencing nonexistent spawnId', () => {
    const m = makeBaseModel();
    m.waves[0]!.enemies[0]!.spawnId = 'spawn_ghost';
    expect(codes(validateLevel(m))).toContain('I11_WAVE_SPAWN_ID_MISSING');
  });

  it('accepts wave enemy group without spawnId', () => {
    const m = makeBaseModel();
    delete m.waves[0]!.enemies[0]!.spawnId;
    expect(codes(validateLevel(m)).filter((c) => c === 'I11_WAVE_SPAWN_ID_MISSING')).toEqual([]);
  });
});

describe('validateLevel — I1/I2 spawn tile 联动', () => {
  it('I2: flags spawns[i] whose tile is not spawn', () => {
    const m = makeBaseModel();
    m.map.spawns![0]!.row = 1;
    m.map.spawns![0]!.col = 1;
    expect(codes(validateLevel(m))).toContain('I2_SPAWN_TILE_MISMATCH');
  });

  it('I1: flags a spawn tile not declared in spawns[]', () => {
    const m = makeBaseModel();
    m.map.tiles[0]![1] = 'spawn';
    expect(codes(validateLevel(m))).toContain('I1_ORPHAN_SPAWN_TILE');
  });
});

describe('validateLevel — error shape', () => {
  it('returns errors with code + message + path', () => {
    const m = makeBaseModel();
    m.map.spawns = [];
    const e = validateLevel(m).find((x) => x.code === 'I12_NO_SPAWN');
    expect(e).toBeDefined();
    expect(typeof e!.message).toBe('string');
    expect(e!.message.length).toBeGreaterThan(0);
    expect(Array.isArray(e!.path)).toBe(true);
  });

  it('does not throw on completely empty model', () => {
    const m: LevelFormModel = {
      id: '',
      name: '',
      map: { cols: 0, rows: 0, tileSize: 64, tiles: [] },
      waves: [],
    };
    expect(() => validateLevel(m)).not.toThrow();
  });
});

describe('validateLevel — real L1 fixture should pass', () => {
  it('parses and validates level-01.yaml without errors', async () => {
    const { parseYamlToModel } = await import('../levelModel.js');
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const yamlText = readFileSync(
      path.join(here, '..', '..', '..', 'config', 'levels', 'level-01.yaml'),
      'utf8',
    );
    const model = parseYamlToModel(yamlText);
    expect(validateLevel(model)).toEqual([]);
  });
});
