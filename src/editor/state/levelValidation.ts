import type { LevelFormModel, MapModel, TileCell, WaveSpec } from './levelModel.js';
import type { PathEdge, PathGraph, PathNode } from '../../level/graph/types.js';

export type ValidationCode =
  | 'I1_ORPHAN_SPAWN_TILE'
  | 'I2_SPAWN_TILE_MISMATCH'
  | 'I3_DUPLICATE_NODE_ID'
  | 'I4_SPAWN_NO_SPAWN_ID'
  | 'I4_SPAWN_ID_NOT_FOUND'
  | 'I5_PORTAL_NO_TELEPORT_TO'
  | 'I5_PORTAL_TELEPORT_TO_MISSING'
  | 'I6_SPAWN_UNREACHABLE'
  | 'I7_CYCLE_DETECTED'
  | 'I8_EDGE_NEGATIVE_WEIGHT'
  | 'I8_OUT_WEIGHT_SUM_ZERO'
  | 'I8_BRANCH_OUT_DEGREE'
  | 'I9_EDGE_NOT_ALIGNED'
  | 'I10_EDGE_TILE_INVALID'
  | 'I10_EDGE_NODE_MISSING'
  | 'I11_WAVE_SPAWN_ID_MISSING'
  | 'I12_NO_SPAWN'
  | 'I12_EMPTY_GRAPH'
  | 'I12_NO_CRYSTAL_ANCHOR'
  | 'I12_NO_EDGE'
  | 'I13_NODE_NO_OUTGOING';

export interface ValidationError {
  code: ValidationCode;
  message: string;
  path: (string | number)[];
}

type Ctx = {
  errors: ValidationError[];
  map: MapModel;
  nodes: PathNode[];
  edges: PathEdge[];
  nodeById: Map<string, PathNode>;
  spawnIds: Set<string>;
  waves: WaveSpec[];
};

const WALKABLE_TILES = new Set<string>(['path', 'spawn', 'base', 'crystal']);

function push(ctx: Ctx, code: ValidationCode, message: string, path: (string | number)[]): void {
  ctx.errors.push({ code, message, path });
}

function isWalkable(tile: TileCell | undefined): boolean {
  if (typeof tile === 'string') return WALKABLE_TILES.has(tile);
  return false;
}

function checkExistence(ctx: Ctx): void {
  const { map, nodes, edges } = ctx;
  if (!map.spawns || map.spawns.length === 0) {
    push(ctx, 'I12_NO_SPAWN', '至少需要 1 个生成口', ['map', 'spawns']);
  }
  if (nodes.length === 0) {
    push(ctx, 'I12_EMPTY_GRAPH', '路径图为空', ['map', 'pathGraph', 'nodes']);
  }
  if (nodes.length > 0 && !nodes.some((n) => n.role === 'crystal_anchor')) {
    push(ctx, 'I12_NO_CRYSTAL_ANCHOR', '缺少 crystal_anchor 节点', ['map', 'pathGraph', 'nodes']);
  }
  if (nodes.length > 0 && edges.length === 0) {
    push(ctx, 'I12_NO_EDGE', '至少需要 1 条边', ['map', 'pathGraph', 'edges']);
  }
}

function checkNodes(ctx: Ctx): void {
  const seen = new Set<string>();
  const ids = new Set<string>(ctx.nodes.map((n) => n.id));
  for (const [i, n] of ctx.nodes.entries()) {
    if (seen.has(n.id)) {
      push(ctx, 'I3_DUPLICATE_NODE_ID', `节点 id 重复: ${n.id}`, ['map', 'pathGraph', 'nodes', i, 'id']);
    }
    seen.add(n.id);

    if (n.role === 'spawn') {
      if (!n.spawnId) {
        push(ctx, 'I4_SPAWN_NO_SPAWN_ID', `spawn 节点 ${n.id} 缺少 spawnId`, ['map', 'pathGraph', 'nodes', i, 'spawnId']);
      } else if (!ctx.spawnIds.has(n.spawnId)) {
        push(ctx, 'I4_SPAWN_ID_NOT_FOUND', `spawn 节点 ${n.id} 的 spawnId=${n.spawnId} 不在 spawns[]`, [
          'map', 'pathGraph', 'nodes', i, 'spawnId',
        ]);
      }
    }

    if (n.role === 'portal') {
      if (!n.teleportTo) {
        push(ctx, 'I5_PORTAL_NO_TELEPORT_TO', `portal 节点 ${n.id} 缺少 teleportTo`, [
          'map', 'pathGraph', 'nodes', i, 'teleportTo',
        ]);
      } else if (!ids.has(n.teleportTo)) {
        push(ctx, 'I5_PORTAL_TELEPORT_TO_MISSING', `portal 节点 ${n.id} teleportTo=${n.teleportTo} 不存在`, [
          'map', 'pathGraph', 'nodes', i, 'teleportTo',
        ]);
      }
    }
  }
}

function tilesBetween(a: PathNode, b: PathNode): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  if (a.row === b.row) {
    const r = a.row;
    const lo = Math.min(a.col, b.col);
    const hi = Math.max(a.col, b.col);
    for (let c = lo; c <= hi; c++) cells.push([r, c]);
  } else if (a.col === b.col) {
    const c = a.col;
    const lo = Math.min(a.row, b.row);
    const hi = Math.max(a.row, b.row);
    for (let r = lo; r <= hi; r++) cells.push([r, c]);
  }
  return cells;
}

function checkEdges(ctx: Ctx): void {
  for (const [i, e] of ctx.edges.entries()) {
    const a = ctx.nodeById.get(e.from);
    const b = ctx.nodeById.get(e.to);
    if (!a || !b) {
      push(ctx, 'I10_EDGE_NODE_MISSING', `边 ${e.from}→${e.to} 引用不存在的节点`, ['map', 'pathGraph', 'edges', i]);
      continue;
    }
    if (a.row !== b.row && a.col !== b.col) {
      push(ctx, 'I9_EDGE_NOT_ALIGNED', `边 ${e.from}→${e.to} 不在同行/同列`, ['map', 'pathGraph', 'edges', i]);
    } else {
      for (const [r, c] of tilesBetween(a, b)) {
        const tile = ctx.map.tiles[r]?.[c];
        if (!isWalkable(tile)) {
          push(ctx, 'I10_EDGE_TILE_INVALID', `边 ${e.from}→${e.to} 经过非可通行 tile (${r},${c})`, [
            'map', 'pathGraph', 'edges', i,
          ]);
          break;
        }
      }
    }
    if (typeof e.weight === 'number' && e.weight < 0) {
      push(ctx, 'I8_EDGE_NEGATIVE_WEIGHT', `边 ${e.from}→${e.to} 权重为负`, ['map', 'pathGraph', 'edges', i, 'weight']);
    }
  }
}

function checkOutDegree(ctx: Ctx): void {
  for (const [i, n] of ctx.nodes.entries()) {
    const out = ctx.edges.filter((e) => e.from === n.id);
    if (n.role !== 'crystal_anchor' && out.length === 0) {
      push(ctx, 'I13_NODE_NO_OUTGOING', `非终点节点 ${n.id} 没有出边`, ['map', 'pathGraph', 'nodes', i]);
    }
    if (n.role === 'branch' && out.length < 2) {
      push(ctx, 'I8_BRANCH_OUT_DEGREE', `branch 节点 ${n.id} 出度 < 2`, ['map', 'pathGraph', 'nodes', i]);
    }
    if (out.length > 0) {
      const sum = out.reduce((acc, e) => acc + (typeof e.weight === 'number' ? e.weight : 1), 0);
      if (sum <= 0) {
        push(ctx, 'I8_OUT_WEIGHT_SUM_ZERO', `节点 ${n.id} 出边权重和为 0`, ['map', 'pathGraph', 'nodes', i]);
      }
    }
  }
}

function checkCycles(ctx: Ctx): void {
  const adj = new Map<string, string[]>();
  for (const n of ctx.nodes) adj.set(n.id, []);
  for (const e of ctx.edges) adj.get(e.from)?.push(e.to);

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const n of ctx.nodes) color.set(n.id, WHITE);

  let cycleFound = false;
  const dfs = (id: string): void => {
    if (cycleFound) return;
    color.set(id, GRAY);
    for (const next of adj.get(id) ?? []) {
      const cn = color.get(next) ?? WHITE;
      if (cn === GRAY) {
        cycleFound = true;
        return;
      }
      if (cn === WHITE) dfs(next);
    }
    color.set(id, BLACK);
  };
  for (const n of ctx.nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE) dfs(n.id);
    if (cycleFound) break;
  }
  if (cycleFound) {
    push(ctx, 'I7_CYCLE_DETECTED', '路径图存在环路', ['map', 'pathGraph', 'edges']);
  }
}

function checkReachability(ctx: Ctx): void {
  const adj = new Map<string, string[]>();
  for (const n of ctx.nodes) adj.set(n.id, []);
  for (const e of ctx.edges) adj.get(e.from)?.push(e.to);

  for (const n of ctx.nodes) {
    if (n.role === 'portal' && n.teleportTo && ctx.nodeById.has(n.teleportTo)) {
      adj.get(n.id)?.push(n.teleportTo);
    }
  }

  for (const [i, spawnNode] of ctx.nodes.entries()) {
    if (spawnNode.role !== 'spawn') continue;
    const visited = new Set<string>();
    const stack = [spawnNode.id];
    let reached = false;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const node = ctx.nodeById.get(cur);
      if (node?.role === 'crystal_anchor') {
        reached = true;
        break;
      }
      for (const next of adj.get(cur) ?? []) {
        if (!visited.has(next)) stack.push(next);
      }
    }
    if (!reached) {
      push(ctx, 'I6_SPAWN_UNREACHABLE', `从生成口 ${spawnNode.id} 出发无法抵达 crystal_anchor`, [
        'map', 'pathGraph', 'nodes', i,
      ]);
    }
  }
}

function checkWaveSpawnIds(ctx: Ctx): void {
  for (const [wi, wave] of ctx.waves.entries()) {
    for (const [gi, g] of wave.enemies.entries()) {
      if (g.spawnId && !ctx.spawnIds.has(g.spawnId)) {
        push(
          ctx,
          'I11_WAVE_SPAWN_ID_MISSING',
          `波 ${wave.waveNumber} 编组 ${gi + 1} 引用了不存在的生成口 ${g.spawnId}`,
          ['waves', wi, 'enemies', gi, 'spawnId'],
        );
      }
    }
  }
}

function checkSpawnTileConsistency(ctx: Ctx): void {
  const declared = new Map<string, { row: number; col: number }>();
  for (const s of ctx.map.spawns ?? []) declared.set(`${s.row},${s.col}`, s);

  for (const [i, s] of (ctx.map.spawns ?? []).entries()) {
    const tile = ctx.map.tiles[s.row]?.[s.col];
    if (tile !== 'spawn') {
      push(ctx, 'I2_SPAWN_TILE_MISMATCH', `spawns[${i}] 位置 (${s.row},${s.col}) 的 tile 不是 spawn`, [
        'map', 'spawns', i,
      ]);
    }
  }

  for (let r = 0; r < ctx.map.tiles.length; r++) {
    const row = ctx.map.tiles[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 'spawn' && !declared.has(`${r},${c}`)) {
        push(ctx, 'I1_ORPHAN_SPAWN_TILE', `tile (${r},${c}) 是 spawn 但未在 spawns[] 声明`, [
          'map', 'tiles', r, c,
        ]);
      }
    }
  }
}

export function validateLevel(model: LevelFormModel): ValidationError[] {
  const errors: ValidationError[] = [];
  const map = model.map;
  const graph: PathGraph = map.pathGraph ?? { nodes: [], edges: [] };
  const nodes = graph.nodes;
  const edges = graph.edges;
  const nodeById = new Map<string, PathNode>();
  for (const n of nodes) nodeById.set(n.id, n);
  const spawnIds = new Set<string>((map.spawns ?? []).map((s) => s.id));

  const ctx: Ctx = {
    errors,
    map,
    nodes,
    edges,
    nodeById,
    spawnIds,
    waves: model.waves,
  };

  checkExistence(ctx);
  checkNodes(ctx);
  checkEdges(ctx);
  checkOutDegree(ctx);
  checkCycles(ctx);
  checkReachability(ctx);
  checkWaveSpawnIds(ctx);
  checkSpawnTileConsistency(ctx);

  return errors;
}
