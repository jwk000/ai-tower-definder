import type { RenderCommand, ShapeType } from '../types/index.js';
import { getFont } from '../config/fonts.js';
import { Container } from 'pixi.js';
import { LayoutManager } from '../ui/LayoutManager.js';

/** Canvas 2D renderer — draws geometric shapes with a command buffer */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private commands: RenderCommand[] = [];

  /** PixiJS container bridge — for systems migrated to Graphics API */
  readonly container: Container = new Container();

  /** Design resolution (logical coordinate space, always 1920×1080) */
  static readonly DESIGN_W = 1920;
  static readonly DESIGN_H = 1080;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  /**
   * Recalculate canvas dimensions and design-space mapping.
   *
   * Canvas internal resolution = viewport dimensions (no letterboxing).
   * A 2D transform maps the 1920×1080 design space into the viewport,
   * height-based uniform scaling, horizontally centered.
   */
  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Canvas CSS fills the window
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    // Canvas internal resolution = viewport dimensions
    this.canvas.width = w;
    this.canvas.height = h;

    // Update layout manager (scale factor, offsets)
    LayoutManager.update(w, h);
  }

  /** Apply the design-space → viewport transform to the canvas context */
  applyDesignTransform(): void {
    this.ctx.setTransform(
      LayoutManager.scale, 0,
      0, LayoutManager.scale,
      LayoutManager.designOffsetX, LayoutManager.designOffsetY,
    );
  }

  /** Reset canvas transform to identity (viewport-space drawing) */
  resetTransform(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  beginFrame(): void {
    this.commands = [];

    // Fill full viewport background (viewport-space, no design transform)
    this.resetTransform();
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Set design-space transform for subsequent render command drawing
    this.applyDesignTransform();
  }

  /** Add a render command to the buffer */
  push(cmd: RenderCommand): void {
    this.commands.push(cmd);
  }

  endFrame(): void {
    // Sort by z-index (ascending = back-to-front). Default z=5 (Ground).
    // Stable sort: same z preserves push order (= Y-sort within layer).
    const sorted = [...this.commands].sort((a, b) => (a.z ?? 5) - (b.z ?? 5));
    for (const cmd of sorted) {
      this.drawCommand(cmd);
    }
  }

  private drawCommand(cmd: RenderCommand): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = cmd.alpha ?? 1;

    const cx = cmd.x;
    const cy = cmd.y;
    const s = cmd.size;
    const hs = s / 2;

    switch (cmd.shape) {
      case 'rect': {
        const rw = s;           // width = size
        const rh = cmd.h ?? s;  // height = h if set, else size (square)
        const rot = cmd.rotation ?? 0;

        if (cmd.clipRadius) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, cmd.clipRadius, 0, Math.PI * 2);
          ctx.clip();
        }

        if (rot !== 0) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot);
          ctx.fillStyle = cmd.color;
          ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
          if (cmd.stroke) {
            ctx.strokeStyle = cmd.stroke;
            ctx.lineWidth = cmd.strokeWidth ?? 1;
            ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);
          }
          ctx.restore();
        } else {
          const x = cx - rw / 2;
          const y = cy - rh / 2;
          ctx.fillStyle = cmd.color;
          ctx.fillRect(x, y, rw, rh);
          if (cmd.stroke) {
            ctx.strokeStyle = cmd.stroke;
            ctx.lineWidth = cmd.strokeWidth ?? 1;
            ctx.strokeRect(x, y, rw, rh);
          }
        }

        if (cmd.clipRadius) {
          ctx.restore();
        }
        break;
      }
      case 'circle':
        ctx.fillStyle = cmd.color;
        ctx.beginPath();
        ctx.arc(cx, cy, hs, 0, Math.PI * 2);
        ctx.fill();
        if (cmd.stroke) {
          ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth ?? 2;
          ctx.stroke();
        }
        break;
      case 'triangle':
        ctx.fillStyle = cmd.color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - hs);
        ctx.lineTo(cx - hs * 0.866, cy + hs * 0.5);
        ctx.lineTo(cx + hs * 0.866, cy + hs * 0.5);
        ctx.closePath();
        ctx.fill();
        break;
      case 'diamond':
        ctx.fillStyle = cmd.color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - hs);
        ctx.lineTo(cx + hs, cy);
        ctx.lineTo(cx, cy + hs);
        ctx.lineTo(cx - hs, cy);
        ctx.closePath();
        ctx.fill();
        if (cmd.stroke) {
          ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth ?? 1;
          ctx.stroke();
        }
        break;
      case 'hexagon':
        ctx.fillStyle = cmd.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = cx + hs * Math.cos(angle);
          const py = cy + hs * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'arrow': {
        // Arrow: triangle head + rectangular shaft, rotated toward (targetX,targetY)
        const tx = cmd.targetX ?? cx + s;
        const ty = cmd.targetY ?? cy;
        const angle = Math.atan2(ty - cy, tx - cx);
        const headLen = s * 0.55;
        const headWidth = headLen * 0.4;
        const shaftW = s * 0.18;
        const tipX = s * 0.7;          // head tip — extends forward
        const shaftStart = -s * 0.4;   // shaft tail — extends backward

        // Arrow shaft
        ctx.fillStyle = cmd.color;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillRect(shaftStart, -shaftW / 2, tipX - shaftStart, shaftW);
        ctx.restore();

        // Arrow head (triangle)
        ctx.fillStyle = cmd.color;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(tipX, 0);
        ctx.lineTo(tipX - headLen, -headWidth);
        ctx.lineTo(tipX - headLen, headWidth);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
    }

    // Text label on top of shape
    if (cmd.label) {
      ctx.fillStyle = cmd.labelColor ?? '#ffffff';
      ctx.font = getFont(cmd.labelSize ?? 16);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cmd.label, cx, cy);
    }

    ctx.restore();
  }

  /** Measure rendered width of a label (design-space pixels) at the given font size */
  measureLabel(text: string, size: number = 16): number {
    if (!text) return 0;
    const prevFont = this.ctx.font;
    this.ctx.font = getFont(size);
    const w = this.ctx.measureText(text).width;
    this.ctx.font = prevFont;
    return w;
  }

  get context(): CanvasRenderingContext2D {
    return this.ctx;
  }

  get designWidth(): number {
    return Renderer.DESIGN_W;
  }

  get designHeight(): number {
    return Renderer.DESIGN_H;
  }
}
