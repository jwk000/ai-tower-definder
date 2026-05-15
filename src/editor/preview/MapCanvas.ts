export interface MapPreviewModel {
  cols: number;
  rows: number;
  tileSize: number;
  tiles: ReadonlyArray<ReadonlyArray<string | number>>;
  tileColors?: Record<string, string>;
}

export type DrawOp =
  | { kind: 'fill'; x: number; y: number; w: number; h: number; color: string }
  | { kind: 'stroke'; x: number; y: number; w: number; h: number; color: string; width: number };

export const TILE_COLORS: Readonly<Record<string, string>> = Object.freeze({
  empty: '#7d9b6e',
  path: '#bfad94',
  blocked: '#78909c',
  spawn: '#ff8f00',
  base: '#1e88e5',
});

const GRID_STROKE_COLOR = '#2a2a3a';
const GRID_STROKE_WIDTH = 1;

function tileColorOf(model: MapPreviewModel, tile: string | number): string {
  const key = typeof tile === 'string' ? tile : String(tile);
  return model.tileColors?.[key] ?? TILE_COLORS[key] ?? TILE_COLORS.empty!;
}

export function computeMapDrawOps(model: MapPreviewModel): DrawOp[] {
  const ops: DrawOp[] = [];
  const { tileSize, tiles } = model;
  if (tiles.length === 0 || tileSize <= 0) return ops;

  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r]!;
    for (let c = 0; c < row.length; c++) {
      const tile = row[c]!;
      ops.push({
        kind: 'fill',
        x: c * tileSize,
        y: r * tileSize,
        w: tileSize,
        h: tileSize,
        color: tileColorOf(model, tile),
      });
    }
  }

  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r]!;
    for (let c = 0; c < row.length; c++) {
      ops.push({
        kind: 'stroke',
        x: c * tileSize,
        y: r * tileSize,
        w: tileSize,
        h: tileSize,
        color: GRID_STROKE_COLOR,
        width: GRID_STROKE_WIDTH,
      });
    }
  }

  return ops;
}

export function hitTestTile(
  model: MapPreviewModel,
  x: number,
  y: number,
): { row: number; col: number } | null {
  const { cols, rows, tileSize } = model;
  if (cols <= 0 || rows <= 0 || tileSize <= 0) return null;
  if (x < 0 || y < 0) return null;
  const col = Math.floor(x / tileSize);
  const row = Math.floor(y / tileSize);
  if (col >= cols || row >= rows) return null;
  return { row, col };
}

export interface MapCanvasOptions {
  onTileClick?: (row: number, col: number, ev: MouseEvent) => void;
}

export class MapCanvas {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private model: MapPreviewModel | null = null;
  private readonly opts: MapCanvasOptions;
  private readonly mouseDownListener: (ev: MouseEvent) => void;

  constructor(host: HTMLElement, opts: MapCanvasOptions = {}) {
    this.host = host;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.cursor = 'crosshair';
    this.canvas.setAttribute('data-testid', 'editor-map-canvas');
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.mouseDownListener = (ev: MouseEvent): void => {
      if (this.model === null) return;
      const hit = hitTestTile(this.model, ev.offsetX, ev.offsetY);
      if (hit === null) return;
      ev.preventDefault();
      this.opts.onTileClick?.(hit.row, hit.col, ev);
    };
    this.canvas.addEventListener('mousedown', this.mouseDownListener);
    this.canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  setModel(model: MapPreviewModel): void {
    this.model = model;
    const width = Math.max(0, model.cols * model.tileSize);
    const height = Math.max(0, model.rows * model.tileSize);
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.redraw();
  }

  redraw(): void {
    if (this.ctx === null || this.model === null) return;
    const ops = computeMapDrawOps(this.model);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const op of ops) {
      if (op.kind === 'fill') {
        ctx.fillStyle = op.color;
        ctx.fillRect(op.x, op.y, op.w, op.h);
      } else {
        ctx.strokeStyle = op.color;
        ctx.lineWidth = op.width;
        ctx.strokeRect(op.x + 0.5, op.y + 0.5, op.w - 1, op.h - 1);
      }
    }
  }

  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  dispose(): void {
    this.canvas.removeEventListener('mousedown', this.mouseDownListener);
    if (this.canvas.parentNode === this.host) {
      this.host.removeChild(this.canvas);
    }
    this.model = null;
    this.ctx = null;
  }
}
