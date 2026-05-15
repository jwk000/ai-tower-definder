import { describe, it, expect } from 'vitest';
import {
  addNode,
  removeNode,
  addEdge,
  removeEdge,
  setNodeRole,
  setEdgeWeight,
  setPortalTarget,
  hasCycle,
  generateNodeId,
} from '../graphOps.js';
import type { PathGraph, PathNode } from '../../../level/graph/types.js';

function makeGraph(overrides: Partial<PathGraph> = {}): PathGraph {
  return { nodes: [], edges: [], ...overrides };
}

function node(id: string, row = 0, col = 0, role: PathNode['role'] = 'waypoint'): PathNode {
  return { id, row, col, role };
}

describe('generateNodeId', () => {
  it('returns an id not in the existing set', () => {
    const id = generateNodeId([]);
    expect(id).toMatch(/^n_[a-z]+$/);
    const id2 = generateNodeId([id]);
    expect(id2).not.toBe(id);
  });
});

describe('addNode', () => {
  it('appends a waypoint node at the given row/col', () => {
    const g = addNode(makeGraph(), { id: 'n1', row: 1, col: 2, role: 'waypoint' });
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0]).toMatchObject({ id: 'n1', row: 1, col: 2, role: 'waypoint' });
  });

  it('does not mutate the original graph', () => {
    const g = makeGraph();
    const original = JSON.stringify(g);
    addNode(g, { id: 'x', row: 0, col: 0, role: 'waypoint' });
    expect(JSON.stringify(g)).toBe(original);
  });

  it('rejects a node whose id already exists', () => {
    const g = makeGraph({ nodes: [node('a')] });
    expect(() => addNode(g, node('a'))).toThrow(/duplicate/i);
  });
});

describe('removeNode', () => {
  it('removes the node and all its incident edges', () => {
    const g = makeGraph({
      nodes: [node('a', 0, 0), node('b', 0, 2), node('c', 0, 4)],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'a', to: 'c' },
      ],
    });
    const next = removeNode(g, 'b');
    expect(next.nodes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(next.edges).toHaveLength(1);
    expect(next.edges[0]).toMatchObject({ from: 'a', to: 'c' });
  });

  it('no-ops when the node does not exist', () => {
    const g = makeGraph({ nodes: [node('a')] });
    const next = removeNode(g, 'z');
    expect(next).toEqual(g);
  });

  it('does not mutate the original graph', () => {
    const g = makeGraph({ nodes: [node('a')] });
    const original = JSON.stringify(g);
    removeNode(g, 'a');
    expect(JSON.stringify(g)).toBe(original);
  });
});

describe('addEdge', () => {
  it('appends an edge from→to', () => {
    const g = makeGraph({ nodes: [node('a'), node('b', 0, 2)] });
    const next = addEdge(g, { from: 'a', to: 'b' });
    expect(next.edges).toHaveLength(1);
    expect(next.edges[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('throws when from node does not exist', () => {
    const g = makeGraph({ nodes: [node('b', 0, 2)] });
    expect(() => addEdge(g, { from: 'missing', to: 'b' })).toThrow(/node/i);
  });

  it('throws when to node does not exist', () => {
    const g = makeGraph({ nodes: [node('a')] });
    expect(() => addEdge(g, { from: 'a', to: 'missing' })).toThrow(/node/i);
  });

  it('throws when the edge would create a cycle (I7)', () => {
    const g = makeGraph({
      nodes: [node('a'), node('b', 0, 2), node('c', 0, 4)],
      edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
    });
    expect(() => addEdge(g, { from: 'c', to: 'a' })).toThrow(/cycle/i);
  });

  it('does not throw for a self-loop because I7 blocks it', () => {
    const g = makeGraph({ nodes: [node('a')] });
    expect(() => addEdge(g, { from: 'a', to: 'a' })).toThrow(/cycle/i);
  });

  it('does not mutate the original graph', () => {
    const g = makeGraph({ nodes: [node('a'), node('b', 0, 2)] });
    const original = JSON.stringify(g);
    addEdge(g, { from: 'a', to: 'b' });
    expect(JSON.stringify(g)).toBe(original);
  });
});

describe('removeEdge', () => {
  it('removes the matching edge', () => {
    const g = makeGraph({
      nodes: [node('a'), node('b', 0, 2)],
      edges: [{ from: 'a', to: 'b' }],
    });
    const next = removeEdge(g, 'a', 'b');
    expect(next.edges).toHaveLength(0);
  });

  it('no-ops when edge does not exist', () => {
    const g = makeGraph({ nodes: [node('a'), node('b', 0, 2)], edges: [] });
    const next = removeEdge(g, 'a', 'b');
    expect(next.edges).toHaveLength(0);
  });

  it('auto-downgrades branch to waypoint when out-degree drops below 2', () => {
    const g = makeGraph({
      nodes: [
        { id: 'br', row: 0, col: 2, role: 'branch' },
        node('x', 0, 0),
        node('y', 0, 4),
        node('z', 2, 2),
      ],
      edges: [
        { from: 'x', to: 'br' },
        { from: 'br', to: 'y' },
        { from: 'br', to: 'z' },
      ],
    });
    const next = removeEdge(g, 'br', 'y');
    const brNode = next.nodes.find((n) => n.id === 'br')!;
    expect(brNode.role).toBe('waypoint');
  });
});

describe('setNodeRole', () => {
  it('changes the role of the specified node', () => {
    const g = makeGraph({ nodes: [node('a')] });
    const next = setNodeRole(g, 'a', 'crystal_anchor');
    expect(next.nodes[0]!.role).toBe('crystal_anchor');
  });

  it('no-ops when node does not exist', () => {
    const g = makeGraph({ nodes: [node('a')] });
    const next = setNodeRole(g, 'z', 'branch');
    expect(next).toEqual(g);
  });

  it('does not mutate the original graph', () => {
    const g = makeGraph({ nodes: [node('a')] });
    const original = JSON.stringify(g);
    setNodeRole(g, 'a', 'branch');
    expect(JSON.stringify(g)).toBe(original);
  });
});

describe('setEdgeWeight', () => {
  it('sets the weight on the matching edge', () => {
    const g = makeGraph({
      nodes: [node('a'), node('b', 0, 2)],
      edges: [{ from: 'a', to: 'b' }],
    });
    const next = setEdgeWeight(g, 'a', 'b', 75);
    expect(next.edges[0]!.weight).toBe(75);
  });

  it('no-ops when edge does not exist', () => {
    const g = makeGraph({ nodes: [node('a'), node('b', 0, 2)], edges: [] });
    const next = setEdgeWeight(g, 'a', 'b', 50);
    expect(next).toEqual(g);
  });
});

describe('setPortalTarget', () => {
  it('sets teleportTo on the portal node', () => {
    const g = makeGraph({
      nodes: [
        { id: 'p', row: 0, col: 0, role: 'portal' },
        node('dest', 2, 2),
      ],
    });
    const next = setPortalTarget(g, 'p', 'dest');
    expect(next.nodes[0]!.teleportTo).toBe('dest');
  });

  it('clears teleportTo when target is undefined', () => {
    const g = makeGraph({
      nodes: [{ id: 'p', row: 0, col: 0, role: 'portal', teleportTo: 'old' }],
    });
    const next = setPortalTarget(g, 'p', undefined);
    expect(next.nodes[0]!.teleportTo).toBeUndefined();
  });
});

describe('hasCycle', () => {
  it('returns false for an acyclic graph', () => {
    const g = makeGraph({
      nodes: [node('a'), node('b', 0, 2), node('c', 0, 4)],
      edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
    });
    expect(hasCycle(g)).toBe(false);
  });

  it('returns true when there is a cycle', () => {
    const g = makeGraph({
      nodes: [node('a'), node('b', 0, 2), node('c', 0, 4)],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ],
    });
    expect(hasCycle(g)).toBe(true);
  });

  it('returns true for a self-loop', () => {
    const g = makeGraph({
      nodes: [node('a')],
      edges: [{ from: 'a', to: 'a' }],
    });
    expect(hasCycle(g)).toBe(true);
  });

  it('portal edges are not counted for cycle detection (I7)', () => {
    const g = makeGraph({
      nodes: [
        { id: 'a', row: 0, col: 0, role: 'portal', teleportTo: 'c' },
        node('b', 0, 2),
        node('c', 0, 4),
      ],
      edges: [{ from: 'a', to: 'b' }],
    });
    expect(hasCycle(g)).toBe(false);
  });
});
