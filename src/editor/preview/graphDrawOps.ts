import type { PathGraph, PathNode, SpawnPoint } from '../../level/graph/types.js';

export const SPAWN_PALETTE = ['#ff4081', '#29b6f6', '#fdd835', '#66bb6a', '#ab47bc'] as const;
export const NEUTRAL_COLOR = '#9e9e9e';

export interface GraphModel {
  graph: PathGraph;
  spawns: SpawnPoint[];
  tileSize: number;
}

type NodeShape = 'triangle' | 'circle' | 'diamond' | 'swirl' | 'star';

export type GraphDrawOp =
  | { kind: 'node'; nodeId: string; cx: number; cy: number; shape: NodeShape; color: string }
  | { kind: 'edge'; edgeKey: string; x1: number; y1: number; x2: number; y2: number; color: string }
  | { kind: 'weight'; edgeKey: string; label: string; x: number; y: number; color: string }
  | { kind: 'portal-arc'; fromNodeId: string; toNodeId: string; x1: number; y1: number; x2: number; y2: number };

function nodeCx(node: PathNode, tileSize: number): number {
  return node.col * tileSize + tileSize / 2;
}
function nodeCy(node: PathNode, tileSize: number): number {
  return node.row * tileSize + tileSize / 2;
}

function roleToShape(role: PathNode['role']): NodeShape {
  switch (role) {
    case 'spawn': return 'triangle';
    case 'waypoint': return 'circle';
    case 'branch': return 'diamond';
    case 'portal': return 'swirl';
    case 'crystal_anchor': return 'star';
  }
}

function buildSpawnColorMap(spawns: SpawnPoint[]): Map<string, string> {
  const map = new Map<string, string>();
  spawns.forEach((sp, i) => {
    const color = i < SPAWN_PALETTE.length
      ? SPAWN_PALETTE[i]!
      : hashColor(sp.id);
    map.set(sp.id, color);
  });
  return map;
}

function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const hue = (h % 360 + 360) % 360;
  return `hsl(${hue},70%,55%)`;
}

function buildNodeReachMap(graph: PathGraph, spawns: SpawnPoint[]): Map<string, Set<string>> {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const outEdges = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = outEdges.get(e.from) ?? [];
    list.push(e.to);
    outEdges.set(e.from, list);
  }

  const reachMap = new Map<string, Set<string>>();

  for (const sp of spawns) {
    const startNode = graph.nodes.find(
      (n) => n.role === 'spawn' && n.spawnId === sp.id,
    );
    if (startNode === undefined) continue;

    const visited = new Set<string>();
    const queue = [startNode.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const next of outEdges.get(cur) ?? []) {
        const nextNode = nodeById.get(next);
        if (nextNode !== undefined && nextNode.role === 'portal' && nextNode.teleportTo !== undefined) {
          if (!visited.has(nextNode.teleportTo)) queue.push(nextNode.teleportTo);
        }
        if (!visited.has(next)) queue.push(next);
      }
    }

    for (const nid of visited) {
      const set = reachMap.get(nid) ?? new Set<string>();
      set.add(sp.id);
      reachMap.set(nid, set);
    }
  }

  return reachMap;
}

function pickNodeColor(
  node: PathNode,
  reachMap: Map<string, Set<string>>,
  spawnColorMap: Map<string, string>,
): string {
  if (node.role === 'spawn' && node.spawnId !== undefined) {
    return spawnColorMap.get(node.spawnId) ?? NEUTRAL_COLOR;
  }
  const reachingSpawns = reachMap.get(node.id);
  if (reachingSpawns === undefined || reachingSpawns.size === 0) return NEUTRAL_COLOR;
  if (reachingSpawns.size === 1) {
    const [spawnId] = reachingSpawns;
    return spawnColorMap.get(spawnId!) ?? NEUTRAL_COLOR;
  }
  return NEUTRAL_COLOR;
}

export function computeGraphDrawOps(model: GraphModel): GraphDrawOp[] {
  const { graph, spawns, tileSize } = model;
  if (graph.nodes.length === 0 && graph.edges.length === 0) return [];

  const spawnColorMap = buildSpawnColorMap(spawns);
  const reachMap = buildNodeReachMap(graph, spawns);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  const ops: GraphDrawOp[] = [];

  for (const edge of graph.edges) {
    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    if (fromNode === undefined || toNode === undefined) continue;

    const x1 = nodeCx(fromNode, tileSize);
    const y1 = nodeCy(fromNode, tileSize);
    const x2 = nodeCx(toNode, tileSize);
    const y2 = nodeCy(toNode, tileSize);
    const edgeKey = `${edge.from}->${edge.to}`;

    const color = pickNodeColor(fromNode, reachMap, spawnColorMap);
    ops.push({ kind: 'edge', edgeKey, x1, y1, x2, y2, color });

    if (edge.weight !== undefined) {
      const outEdges = graph.edges.filter((e) => e.from === edge.from);
      const totalWeight = outEdges.reduce((s, e) => s + (e.weight ?? 1), 0);
      const pct = totalWeight > 0 ? Math.round((edge.weight / totalWeight) * 100) : 0;
      ops.push({
        kind: 'weight',
        edgeKey,
        label: `${pct}%`,
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        color,
      });
    }
  }

  for (const node of graph.nodes) {
    const cx = nodeCx(node, tileSize);
    const cy = nodeCy(node, tileSize);
    const color = pickNodeColor(node, reachMap, spawnColorMap);
    ops.push({ kind: 'node', nodeId: node.id, cx, cy, shape: roleToShape(node.role), color });

    if (node.role === 'portal' && node.teleportTo !== undefined) {
      const target = nodeById.get(node.teleportTo);
      if (target !== undefined) {
        ops.push({
          kind: 'portal-arc',
          fromNodeId: node.id,
          toNodeId: node.teleportTo,
          x1: cx,
          y1: cy,
          x2: nodeCx(target, tileSize),
          y2: nodeCy(target, tileSize),
        });
      }
    }
  }

  return ops;
}

export function paintGraph(ctx: CanvasRenderingContext2D, ops: GraphDrawOp[]): void {
  for (const op of ops) {
    switch (op.kind) {
      case 'edge': paintEdge(ctx, op); break;
      case 'node': paintNode(ctx, op); break;
      case 'weight': paintWeight(ctx, op); break;
      case 'portal-arc': paintPortalArc(ctx, op); break;
    }
  }
}

type EdgeOp = Extract<GraphDrawOp, { kind: 'edge' }>;
type NodeOp = Extract<GraphDrawOp, { kind: 'node' }>;
type WeightOp = Extract<GraphDrawOp, { kind: 'weight' }>;
type PortalArcOp = Extract<GraphDrawOp, { kind: 'portal-arc' }>;

function paintEdge(ctx: CanvasRenderingContext2D, op: EdgeOp): void {
  const dx = op.x2 - op.x1;
  const dy = op.y2 - op.y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  ctx.save();
  ctx.strokeStyle = op.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(op.x1, op.y1);
  ctx.lineTo(op.x2, op.y2);
  ctx.stroke();

  const headLen = 8;
  const angle = Math.atan2(dy, dx);
  const ax = op.x2 - headLen * Math.cos(angle - Math.PI / 6);
  const ay = op.y2 - headLen * Math.sin(angle - Math.PI / 6);
  const bx = op.x2 - headLen * Math.cos(angle + Math.PI / 6);
  const by = op.y2 - headLen * Math.sin(angle + Math.PI / 6);
  ctx.beginPath();
  ctx.moveTo(op.x2, op.y2);
  ctx.lineTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.closePath();
  ctx.fillStyle = op.color;
  ctx.fill();
  ctx.restore();
}

function paintNode(ctx: CanvasRenderingContext2D, op: NodeOp): void {
  const r = 7;
  ctx.save();
  ctx.fillStyle = op.color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;

  switch (op.shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(op.cx, op.cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;

    case 'triangle': {
      const h = r * 1.6;
      ctx.beginPath();
      ctx.moveTo(op.cx, op.cy - h);
      ctx.lineTo(op.cx + h * 0.866, op.cy + h * 0.5);
      ctx.lineTo(op.cx - h * 0.866, op.cy + h * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(op.cx, op.cy - r * 1.4);
      ctx.lineTo(op.cx + r, op.cy);
      ctx.lineTo(op.cx, op.cy + r * 1.4);
      ctx.lineTo(op.cx - r, op.cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;

    case 'swirl':
      ctx.beginPath();
      ctx.arc(op.cx, op.cy, r, 0, Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(op.cx, op.cy, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'star': {
      const pts = 5;
      const outer = r * 1.3;
      const inner = r * 0.55;
      ctx.beginPath();
      for (let i = 0; i < pts * 2; i++) {
        const rad = (i * Math.PI) / pts - Math.PI / 2;
        const d = i % 2 === 0 ? outer : inner;
        const x = op.cx + d * Math.cos(rad);
        const y = op.cy + d * Math.sin(rad);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function paintWeight(ctx: CanvasRenderingContext2D, op: WeightOp): void {
  ctx.save();
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(op.label, op.x, op.y);
  ctx.fillText(op.label, op.x, op.y);
  ctx.restore();
}

function paintPortalArc(ctx: CanvasRenderingContext2D, op: PortalArcOp): void {
  const mx = (op.x1 + op.x2) / 2;
  const my = (op.y1 + op.y2) / 2 - 20;
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#e040fb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(op.x1, op.y1);
  ctx.quadraticCurveTo(mx, my, op.x2, op.y2);
  ctx.stroke();
  ctx.restore();
}
