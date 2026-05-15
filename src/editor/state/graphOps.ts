import type { PathGraph, PathEdge, PathNode } from '../../level/graph/types.js';

const NODE_ID_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function generateNodeId(existingIds: string[]): string {
  const used = new Set(existingIds);
  for (const ch of NODE_ID_LETTERS) {
    const candidate = `n_${ch}`;
    if (!used.has(candidate)) return candidate;
  }
  for (const a of NODE_ID_LETTERS) {
    for (const b of NODE_ID_LETTERS) {
      const candidate = `n_${a}${b}`;
      if (!used.has(candidate)) return candidate;
    }
  }
  return `n_${Date.now()}`;
}

export function hasCycle(graph: PathGraph): boolean {
  const outEdges = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = outEdges.get(e.from) ?? [];
    list.push(e.to);
    outEdges.set(e.from, list);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const n of graph.nodes) color.set(n.id, WHITE);

  function dfs(id: string): boolean {
    color.set(id, GRAY);
    for (const next of outEdges.get(id) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) return true;
      if (c === WHITE && dfs(next)) return true;
    }
    color.set(id, BLACK);
    return false;
  }

  for (const n of graph.nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE && dfs(n.id)) return true;
  }
  return false;
}

export function addNode(graph: PathGraph, node: PathNode): PathGraph {
  if (graph.nodes.some((n) => n.id === node.id)) {
    throw new Error(`duplicate node id: ${node.id}`);
  }
  return { ...graph, nodes: [...graph.nodes, { ...node }] };
}

export function removeNode(graph: PathGraph, nodeId: string): PathGraph {
  if (!graph.nodes.some((n) => n.id === nodeId)) return graph;
  const nodes = graph.nodes.filter((n) => n.id !== nodeId);
  const edges = graph.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
  return { ...graph, nodes, edges };
}

export function addEdge(graph: PathGraph, edge: PathEdge): PathGraph {
  const fromExists = graph.nodes.some((n) => n.id === edge.from);
  const toExists = graph.nodes.some((n) => n.id === edge.to);
  if (!fromExists || !toExists) throw new Error(`node not found`);

  const tentative: PathGraph = {
    ...graph,
    edges: [...graph.edges, { ...edge }],
  };
  if (hasCycle(tentative)) throw new Error(`adding this edge would create a cycle (I7)`);
  return tentative;
}

export function removeEdge(graph: PathGraph, from: string, to: string): PathGraph {
  const edges = graph.edges.filter((e) => !(e.from === from && e.to === to));

  const outDegree = (nodeId: string): number =>
    edges.filter((e) => e.from === nodeId).length;

  const nodes = graph.nodes.map((n) => {
    if (n.role === 'branch' && n.id === from && outDegree(n.id) < 2) {
      return { ...n, role: 'waypoint' as const };
    }
    return n;
  });

  return { ...graph, nodes, edges };
}

export function setNodeRole(graph: PathGraph, nodeId: string, role: PathNode['role']): PathGraph {
  const idx = graph.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return graph;
  const nodes = graph.nodes.map((n, i) => (i === idx ? { ...n, role } : n));
  return { ...graph, nodes };
}

export function setEdgeWeight(graph: PathGraph, from: string, to: string, weight: number): PathGraph {
  const idx = graph.edges.findIndex((e) => e.from === from && e.to === to);
  if (idx === -1) return graph;
  const edges = graph.edges.map((e, i) => (i === idx ? { ...e, weight } : e));
  return { ...graph, edges };
}

export function setPortalTarget(graph: PathGraph, nodeId: string, target: string | undefined): PathGraph {
  const idx = graph.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return graph;
  const nodes = graph.nodes.map((n, i) => {
    if (i !== idx) return n;
    const copy = { ...n };
    if (target === undefined) {
      delete copy.teleportTo;
    } else {
      copy.teleportTo = target;
    }
    return copy;
  });
  return { ...graph, nodes };
}
