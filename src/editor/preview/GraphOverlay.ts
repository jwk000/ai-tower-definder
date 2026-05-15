import { computeGraphDrawOps, paintGraph, type GraphModel } from './graphDrawOps.js';

export class GraphOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;

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
    if (this.ctx === null) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const ops = computeGraphDrawOps(model);
    paintGraph(this.ctx, ops);
  }

  dispose(): void {
    this.canvas.remove();
  }
}
