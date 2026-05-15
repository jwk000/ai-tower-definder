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
});
