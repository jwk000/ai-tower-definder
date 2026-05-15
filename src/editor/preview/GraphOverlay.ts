import { computeGraphDrawOps, paintGraph, type GraphModel, type GraphDrawOp } from './graphDrawOps.js';

const NODE_HIT_RADIUS = 10;
const EDGE_HIT_TOLERANCE = 5;

export interface HitNode { kind: 'node'; nodeId: string }
export interface HitEdge { kind: 'edge'; from: string; to: string }
export type HitResult = HitNode | HitEdge | null;

export class GraphOverlay {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private lastOps: GraphDrawOp[] = [];

  constructor(host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.dataset['testid'] = 'editor-graph-overlay';
    Object.assign(this.canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      pointerEvents: 'none',
    });
    host.style.position = 'relative';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  setModel(model: GraphModel, cols: number, rows: number): void {
    this.canvas.width = cols * model.tileSize;
    this.canvas.height = rows * model.tileSize;
    this.lastOps = computeGraphDrawOps(model);
    if (this.ctx === null) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    paintGraph(this.ctx, this.lastOps);
  }

  hitTest(px: number, py: number): HitResult {
    for (const op of this.lastOps) {
      if (op.kind === 'node') {
        const dx = px - op.cx;
        const dy = py - op.cy;
        if (Math.hypot(dx, dy) <= NODE_HIT_RADIUS) {
          return { kind: 'node', nodeId: op.nodeId };
        }
      }
    }
    for (const op of this.lastOps) {
      if (op.kind === 'edge') {
        if (pointToSegmentDist(px, py, op.x1, op.y1, op.x2, op.y2) <= EDGE_HIT_TOLERANCE) {
          const edgeKey = op.edgeKey;
          const sep = edgeKey.indexOf('->');
          if (sep !== -1) {
            return { kind: 'edge', from: edgeKey.slice(0, sep), to: edgeKey.slice(sep + 2) };
          }
        }
      }
    }
    return null;
  }

  dispose(): void {
    this.canvas.remove();
  }
}

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
