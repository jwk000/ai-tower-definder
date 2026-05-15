import { describe, it, expect } from 'vitest';
import {
  computeGraphDrawOps,
  SPAWN_PALETTE,
  type GraphModel,
  type GraphDrawOp,
} from '../graphDrawOps.js';
import type { PathGraph, SpawnPoint } from '../../../level/graph/types.js';

function makeGraph(overrides: Partial<PathGraph> = {}): PathGraph {
  return {
    nodes: [],
    edges: [],
    ...overrides,
  };
}

function makeModel(
  graph: PathGraph,
  spawns: SpawnPoint[] = [],
  tileSize = 32,
): GraphModel {
  return { graph, spawns, tileSize };
}

function opsByKind<K extends GraphDrawOp['kind']>(
  ops: GraphDrawOp[],
  kind: K,
): Extract<GraphDrawOp, { kind: K }>[] {
  return ops.filter((o): o is Extract<GraphDrawOp, { kind: K }> => o.kind === kind);
}

describe('computeGraphDrawOps', () => {
  it('returns empty array for an empty graph', () => {
    const ops = computeGraphDrawOps(makeModel(makeGraph()));
    expect(ops).toHaveLength(0);
  });

  describe('nodes', () => {
    it('emits a node op for each PathNode', () => {
      const graph = makeGraph({
        nodes: [
          { id: 'a', row: 0, col: 0, role: 'waypoint' },
          { id: 'b', row: 1, col: 2, role: 'crystal_anchor' },
        ],
      });
      const ops = computeGraphDrawOps(makeModel(graph));
      const nodeOps = opsByKind(ops, 'node');
      expect(nodeOps).toHaveLength(2);
    });

    it('node op carries correct cx/cy based on row/col and tileSize', () => {
      const graph = makeGraph({
        nodes: [{ id: 'a', row: 2, col: 3, role: 'waypoint' }],
      });
      const ops = computeGraphDrawOps(makeModel(graph, [], 32));
      const nodeOp = opsByKind(ops, 'node')[0];
      expect(nodeOp).toBeDefined();
      expect(nodeOp!.cx).toBe(3 * 32 + 16);
      expect(nodeOp!.cy).toBe(2 * 32 + 16);
    });

    it('node op shape matches role', () => {
      const roles = ['spawn', 'waypoint', 'branch', 'portal', 'crystal_anchor'] as const;
      const shapeMap: Record<string, string> = {
        spawn: 'triangle',
        waypoint: 'circle',
        branch: 'diamond',
        portal: 'swirl',
        crystal_anchor: 'star',
      };
      for (const role of roles) {
        const graph = makeGraph({ nodes: [{ id: 'x', row: 0, col: 0, role }] });
        const ops = computeGraphDrawOps(makeModel(graph));
        const nodeOp = opsByKind(ops, 'node')[0]!;
        expect(nodeOp.shape).toBe(shapeMap[role]);
      }
    });

    it('colors spawn node with the first palette color when one spawn exists', () => {
      const spawns: SpawnPoint[] = [{ id: 'sp_a', row: 0, col: 0 }];
      const graph = makeGraph({
        nodes: [{ id: 'sp_a', row: 0, col: 0, role: 'spawn', spawnId: 'sp_a' }],
      });
      const ops = computeGraphDrawOps(makeModel(graph, spawns));
      const nodeOp = opsByKind(ops, 'node')[0]!;
      expect(nodeOp.color).toBe(SPAWN_PALETTE[0]);
    });

    it('colors second spawn node with the second palette color', () => {
      const spawns: SpawnPoint[] = [
        { id: 'sp_a', row: 0, col: 0 },
        { id: 'sp_b', row: 2, col: 0 },
      ];
      const graph = makeGraph({
        nodes: [
          { id: 'sp_a', row: 0, col: 0, role: 'spawn', spawnId: 'sp_a' },
          { id: 'sp_b', row: 2, col: 0, role: 'spawn', spawnId: 'sp_b' },
        ],
      });
      const ops = computeGraphDrawOps(makeModel(graph, spawns));
      const nodeOps = opsByKind(ops, 'node');
      const spawnAOp = nodeOps.find((o) => o.nodeId === 'sp_a')!;
      const spawnBOp = nodeOps.find((o) => o.nodeId === 'sp_b')!;
      expect(spawnAOp.color).toBe(SPAWN_PALETTE[0]);
      expect(spawnBOp.color).toBe(SPAWN_PALETTE[1]);
    });

    it('uses neutral gray for nodes reachable from multiple spawns', () => {
      const spawns: SpawnPoint[] = [
        { id: 'sp_a', row: 0, col: 0 },
        { id: 'sp_b', row: 4, col: 0 },
      ];
      const graph = makeGraph({
        nodes: [
          { id: 'sp_a', row: 0, col: 0, role: 'spawn', spawnId: 'sp_a' },
          { id: 'sp_b', row: 4, col: 0, role: 'spawn', spawnId: 'sp_b' },
          { id: 'shared', row: 2, col: 5, role: 'waypoint' },
          { id: 'crystal', row: 2, col: 8, role: 'crystal_anchor' },
        ],
        edges: [
          { from: 'sp_a', to: 'shared' },
          { from: 'sp_b', to: 'shared' },
          { from: 'shared', to: 'crystal' },
        ],
      });
      const ops = computeGraphDrawOps(makeModel(graph, spawns));
      const sharedOp = opsByKind(ops, 'node').find((o) => o.nodeId === 'shared')!;
      expect(sharedOp.color).toBe('#9e9e9e');
    });
  });

  describe('edges', () => {
    it('emits an edge op for each PathEdge', () => {
      const graph = makeGraph({
        nodes: [
          { id: 'a', row: 0, col: 0, role: 'waypoint' },
          { id: 'b', row: 0, col: 3, role: 'waypoint' },
        ],
        edges: [{ from: 'a', to: 'b' }],
      });
      const ops = computeGraphDrawOps(makeModel(graph));
      const edgeOps = opsByKind(ops, 'edge');
      expect(edgeOps).toHaveLength(1);
    });

    it('edge op carries from/to pixel coordinates', () => {
      const graph = makeGraph({
        nodes: [
          { id: 'a', row: 0, col: 0, role: 'waypoint' },
          { id: 'b', row: 0, col: 2, role: 'waypoint' },
        ],
        edges: [{ from: 'a', to: 'b' }],
      });
      const ops = computeGraphDrawOps(makeModel(graph, [], 32));
      const edgeOp = opsByKind(ops, 'edge')[0]!;
      expect(edgeOp.x1).toBe(16);
      expect(edgeOp.y1).toBe(16);
      expect(edgeOp.x2).toBe(80);
      expect(edgeOp.y2).toBe(16);
    });

    it('edge inherits color from the single spawn that can reach its source', () => {
      const spawns: SpawnPoint[] = [{ id: 'sp_a', row: 0, col: 0 }];
      const graph = makeGraph({
        nodes: [
          { id: 'sp_a', row: 0, col: 0, role: 'spawn', spawnId: 'sp_a' },
          { id: 'wp', row: 0, col: 2, role: 'waypoint' },
        ],
        edges: [{ from: 'sp_a', to: 'wp' }],
      });
      const ops = computeGraphDrawOps(makeModel(graph, spawns));
      const edgeOp = opsByKind(ops, 'edge')[0]!;
      expect(edgeOp.color).toBe(SPAWN_PALETTE[0]);
    });

    it('edge with weight label emits a weight op alongside the edge op', () => {
      const graph = makeGraph({
        nodes: [
          { id: 'a', row: 0, col: 0, role: 'branch' },
          { id: 'b', row: 0, col: 2, role: 'waypoint' },
          { id: 'c', row: 2, col: 0, role: 'waypoint' },
        ],
        edges: [
          { from: 'a', to: 'b', weight: 60 },
          { from: 'a', to: 'c', weight: 40 },
        ],
      });
      const ops = computeGraphDrawOps(makeModel(graph));
      const weightOps = opsByKind(ops, 'weight');
      expect(weightOps).toHaveLength(2);
      const labels = weightOps.map((o) => o.label).sort();
      expect(labels).toContain('60%');
      expect(labels).toContain('40%');
    });
  });

  describe('portal arc', () => {
    it('emits a portal-arc op for portal nodes with a valid teleportTo', () => {
      const graph = makeGraph({
        nodes: [
          { id: 'portal_in', row: 1, col: 1, role: 'portal', teleportTo: 'portal_out' },
          { id: 'portal_out', row: 3, col: 5, role: 'waypoint' },
        ],
        edges: [],
      });
      const ops = computeGraphDrawOps(makeModel(graph));
      const arcOps = opsByKind(ops, 'portal-arc');
      expect(arcOps).toHaveLength(1);
      expect(arcOps[0]!.fromNodeId).toBe('portal_in');
      expect(arcOps[0]!.toNodeId).toBe('portal_out');
    });

    it('does not emit portal-arc when teleportTo target does not exist', () => {
      const graph = makeGraph({
        nodes: [{ id: 'p', row: 0, col: 0, role: 'portal', teleportTo: 'missing' }],
        edges: [],
      });
      const ops = computeGraphDrawOps(makeModel(graph));
      expect(opsByKind(ops, 'portal-arc')).toHaveLength(0);
    });
  });
});
