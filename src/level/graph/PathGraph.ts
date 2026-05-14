import type { PathGraph, PathNode, PathEdge, SpawnPoint, WaveEnemyGroup } from './types.js';
import type { GameRandom } from '../../utils/Random.js';

export interface PathGraphIndex {
  graph: PathGraph;
  nodeById: Map<string, PathNode>;
  outEdges: Map<string, PathEdge[]>;
}

export function buildPathGraphIndex(graph: PathGraph): PathGraphIndex {
  const nodeById = new Map<string, PathNode>();
  const outEdges = new Map<string, PathEdge[]>();
  for (const n of graph.nodes) {
    nodeById.set(n.id, n);
    outEdges.set(n.id, []);
  }
  for (const e of graph.edges) {
    const list = outEdges.get(e.from);
    if (list) list.push(e);
  }
  return { graph, nodeById, outEdges };
}

export function chooseNext(
  index: PathGraphIndex,
  nodeId: string,
  rng: GameRandom,
): string | null {
  const out = index.outEdges.get(nodeId);
  if (!out || out.length === 0) return null;
  if (out.length === 1) return out[0]!.to;

  const weights = out.map((e) => (e.weight ?? 1));
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return null;
  const items = out.map((e) => e.to);
  return rng.pickWeighted(items, weights);
}

export function resolvePortal(
  index: PathGraphIndex,
  nodeId: string,
): { teleportTo: string } | null {
  const n = index.nodeById.get(nodeId);
  if (!n || n.role !== 'portal' || !n.teleportTo) return null;
  if (!index.nodeById.has(n.teleportTo)) return null;
  return { teleportTo: n.teleportTo };
}

export function findCycle(graph: PathGraph): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const n of graph.nodes) color.set(n.id, WHITE);
  const adj = new Map<string, string[]>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    const list = adj.get(e.from);
    if (list) list.push(e.to);
  }

  const stack: string[] = [];

  const dfs = (node: string): string[] | null => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adj.get(node) ?? []) {
      const c = color.get(next);
      if (c === undefined) continue;
      if (c === GRAY) {
        const i = stack.indexOf(next);
        return i >= 0 ? stack.slice(i) : [next, node];
      }
      if (c === WHITE) {
        const found = dfs(next);
        if (found) return found;
      }
    }
    color.set(node, BLACK);
    stack.pop();
    return null;
  };

  for (const n of graph.nodes) {
    if (color.get(n.id) === WHITE) {
      const found = dfs(n.id);
      if (found) return found;
    }
  }
  return null;
}

export function canReachCrystalAnchor(
  index: PathGraphIndex,
  fromNodeId: string,
): boolean {
  if (!index.nodeById.has(fromNodeId)) return false;
  const visited = new Set<string>();
  const queue = [fromNodeId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const node = index.nodeById.get(cur);
    if (!node) continue;
    if (node.role === 'crystal_anchor') return true;
    if (node.role === 'portal' && node.teleportTo) {
      if (index.nodeById.has(node.teleportTo) && !visited.has(node.teleportTo)) {
        queue.push(node.teleportTo);
      }
      continue;
    }
    for (const e of index.outEdges.get(cur) ?? []) {
      if (!visited.has(e.to)) queue.push(e.to);
    }
  }
  return false;
}

export function validateGeometry(
  graph: PathGraph,
  tiles: string[][],
  allowedTiles: string[],
): string[] {
  const errors: string[] = [];
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const allowed = new Set(allowedTiles);
  const rows = tiles.length;
  const cols = rows > 0 ? (tiles[0]?.length ?? 0) : 0;

  const inBounds = (r: number, c: number): boolean =>
    r >= 0 && r < rows && c >= 0 && c < cols;

  for (const n of graph.nodes) {
    if (!inBounds(n.row, n.col)) {
      errors.push(`节点 ${n.id} 坐标 (${n.row},${n.col}) 超出 tile 网格`);
    }
  }

  for (const e of graph.edges) {
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    if (!a || !b) continue;
    if (!inBounds(a.row, a.col) || !inBounds(b.row, b.col)) continue;

    if (a.row !== b.row && a.col !== b.col) {
      errors.push(`边 ${e.from}->${e.to} 不在同行/同列`);
      continue;
    }

    if (a.row === b.row) {
      const r = a.row;
      const lo = Math.min(a.col, b.col);
      const hi = Math.max(a.col, b.col);
      for (let c = lo; c <= hi; c++) {
        const t = tiles[r]?.[c];
        if (t === undefined || !allowed.has(t)) {
          errors.push(`边 ${e.from}->${e.to} 经过非法 tile (${r},${c})=${t ?? 'undefined'}`);
        }
      }
    } else {
      const c = a.col;
      const lo = Math.min(a.row, b.row);
      const hi = Math.max(a.row, b.row);
      for (let r = lo; r <= hi; r++) {
        const t = tiles[r]?.[c];
        if (t === undefined || !allowed.has(t)) {
          errors.push(`边 ${e.from}->${e.to} 经过非法 tile (${r},${c})=${t ?? 'undefined'}`);
        }
      }
    }
  }

  return errors;
}

export function findDeadEndNodes(graph: PathGraph): string[] {
  const outDeg = new Map<string, number>();
  for (const n of graph.nodes) outDeg.set(n.id, 0);
  for (const e of graph.edges) {
    outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1);
  }
  const deadEnds: string[] = [];
  for (const n of graph.nodes) {
    if (n.role !== 'crystal_anchor' && (outDeg.get(n.id) ?? 0) === 0) {
      deadEnds.push(n.id);
    }
  }
  return deadEnds;
}

export interface GraphAlgorithmInput {
  spawns: SpawnPoint[];
  pathGraph: PathGraph;
  waves?: { enemies: WaveEnemyGroup[] }[];
}

export function validateGraphAlgorithms(
  cfg: GraphAlgorithmInput,
  tiles?: string[][],
  allowedTiles?: string[],
): string[] {
  const errors: string[] = [];
  const index = buildPathGraphIndex(cfg.pathGraph);

  const cycle = findCycle(cfg.pathGraph);
  if (cycle) {
    errors.push(`路径图存在环路: ${cycle.join('->')}`);
  }

  const deadEnds = findDeadEndNodes(cfg.pathGraph);
  for (const id of deadEnds) {
    errors.push(`非终点节点 ${id} 没有出边`);
  }

  for (const spawn of cfg.spawns) {
    const spawnNodes = cfg.pathGraph.nodes.filter(
      (n) => n.role === 'spawn' && n.spawnId === spawn.id,
    );
    for (const sn of spawnNodes) {
      if (!canReachCrystalAnchor(index, sn.id)) {
        errors.push(`从生成口 ${spawn.id}（节点 ${sn.id}）出发无法抵达任何 crystal_anchor`);
      }
    }
  }

  if (tiles && allowedTiles) {
    errors.push(...validateGeometry(cfg.pathGraph, tiles, allowedTiles));
  }

  return errors;
}
