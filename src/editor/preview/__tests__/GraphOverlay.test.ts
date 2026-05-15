// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GraphOverlay } from '../GraphOverlay.js';
import type { GraphModel } from '../graphDrawOps.js';
import type { PathGraph, SpawnPoint } from '../../../level/graph/types.js';

function makeModel(graph: PathGraph = { nodes: [], edges: [] }, spawns: SpawnPoint[] = []): GraphModel {
  return { graph, spawns, tileSize: 32 };
}

describe('GraphOverlay', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it('appends a canvas element to the host on construction', () => {
    const overlay = new GraphOverlay(host);
    expect(host.querySelector('canvas')).not.toBeNull();
    overlay.dispose();
  });

  it('the overlay canvas has data-testid="editor-graph-overlay"', () => {
    const overlay = new GraphOverlay(host);
    expect(host.querySelector('[data-testid="editor-graph-overlay"]')).not.toBeNull();
    overlay.dispose();
  });

  it('removes the canvas from the host on dispose', () => {
    const overlay = new GraphOverlay(host);
    overlay.dispose();
    expect(host.querySelector('[data-testid="editor-graph-overlay"]')).toBeNull();
  });

  it('resizes the canvas to match (cols * tileSize) x (rows * tileSize) on setModel', () => {
    const overlay = new GraphOverlay(host);
    const graph: PathGraph = {
      nodes: [{ id: 'a', row: 1, col: 2, role: 'waypoint' }],
      edges: [],
    };
    overlay.setModel(makeModel(graph), 4, 3);
    const canvas = host.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(4 * 32);
    expect(canvas.height).toBe(3 * 32);
    overlay.dispose();
  });

  it('is transparent / zero-size when model has no nodes', () => {
    const overlay = new GraphOverlay(host);
    overlay.setModel(makeModel(), 5, 3);
    const canvas = host.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(5 * 32);
    expect(canvas.height).toBe(3 * 32);
    overlay.dispose();
  });

  it('can be called setModel multiple times without leaking canvas elements', () => {
    const overlay = new GraphOverlay(host);
    overlay.setModel(makeModel(), 3, 2);
    overlay.setModel(makeModel(), 4, 2);
    overlay.setModel(makeModel(), 5, 3);
    const canvases = host.querySelectorAll('canvas');
    expect(canvases).toHaveLength(1);
    overlay.dispose();
  });

  describe('hitTest', () => {
    const TILE = 32;

    function overlayWithTwoNodes() {
      const graph: PathGraph = {
        nodes: [
          { id: 'n_a', row: 0, col: 0, role: 'waypoint' },
          { id: 'n_b', row: 0, col: 2, role: 'waypoint' },
        ],
        edges: [{ from: 'n_a', to: 'n_b' }],
      };
      const overlay = new GraphOverlay(host);
      overlay.setModel(makeModel(graph), 4, 2);
      return overlay;
    }

    it('returns null when no model has been set', () => {
      const overlay = new GraphOverlay(host);
      expect(overlay.hitTest(0, 0)).toBeNull();
      overlay.dispose();
    });

    it('hits a node when pointer is within 10px of its center', () => {
      const overlay = overlayWithTwoNodes();
      const cx = 0 * TILE + TILE / 2;
      const cy = 0 * TILE + TILE / 2;
      const hit = overlay.hitTest(cx + 5, cy + 5);
      expect(hit).toEqual({ kind: 'node', nodeId: 'n_a' });
      overlay.dispose();
    });

    it('hits second node by its center', () => {
      const overlay = overlayWithTwoNodes();
      const cx = 2 * TILE + TILE / 2;
      const cy = 0 * TILE + TILE / 2;
      const hit = overlay.hitTest(cx, cy);
      expect(hit).toEqual({ kind: 'node', nodeId: 'n_b' });
      overlay.dispose();
    });

    it('returns null when pointer is more than 10px away from any node', () => {
      const overlay = overlayWithTwoNodes();
      const hit = overlay.hitTest(0, 0);
      expect(hit).toBeNull();
      overlay.dispose();
    });

    it('hits an edge when pointer is within 5px of the line segment', () => {
      const overlay = overlayWithTwoNodes();
      const x1 = 0 * TILE + TILE / 2;
      const x2 = 2 * TILE + TILE / 2;
      const midX = (x1 + x2) / 2;
      const midY = 0 * TILE + TILE / 2;
      const hit = overlay.hitTest(midX, midY + 3);
      expect(hit).toEqual({ kind: 'edge', from: 'n_a', to: 'n_b' });
      overlay.dispose();
    });

    it('nodes take priority over edges in hitTest', () => {
      const graph: PathGraph = {
        nodes: [
          { id: 'n_a', row: 0, col: 0, role: 'waypoint' },
          { id: 'n_b', row: 0, col: 1, role: 'waypoint' },
        ],
        edges: [{ from: 'n_a', to: 'n_b' }],
      };
      const overlay = new GraphOverlay(host);
      overlay.setModel(makeModel(graph), 3, 2);
      const cx = 0 * TILE + TILE / 2;
      const cy = 0 * TILE + TILE / 2;
      const hit = overlay.hitTest(cx, cy);
      expect(hit?.kind).toBe('node');
      overlay.dispose();
    });
  });
});
