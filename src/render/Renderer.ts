import type { RenderCommand, ShapeType } from '../types/index.js';

/** Canvas 2D renderer — draws geometric shapes with a command buffer */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private commands: RenderCommand[] = [];

  /** Design resolution (virtual canvas size) */
  static readonly DESIGN_W = 1920;
  static readonly DESIGN_H = 1080;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    const parent = this.canvas.parentElement ?? document.body;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const aspect = Renderer.DESIGN_W / Renderer.DESIGN_H;

    let cw: number, ch: number;
    if (w / h > aspect) {
      ch = h;
      cw = h * aspect;
    } else {
      cw = w;
      ch = cw / aspect;
    }

    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;
    this.canvas.width = Renderer.DESIGN_W;
    this.canvas.height = Renderer.DESIGN_H;
  }

  beginFrame(): void {
    this.commands = [];
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Add a render command to the buffer */
  push(cmd: RenderCommand): void {
    this.commands.push(cmd);
  }

  endFrame(): void {
    for (const cmd of this.commands) {
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
        const x = cx - rw / 2;
        const y = cy - rh / 2;
        ctx.fillStyle = cmd.color;
        ctx.fillRect(x, y, rw, rh);
        if (cmd.stroke) {
          ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth ?? 1;
          ctx.strokeRect(x, y, rw, rh);
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
        // Arrow: triangle head + line shaft, pointing toward (targetX,targetY)
        const tx = cmd.targetX ?? cx + s;
        const ty = cmd.targetY ?? cy;
        const angle = Math.atan2(ty - cy, tx - cx);
        const headLen = s * 0.55;
        const shaftW = s * 0.18;

        // Shaft
        ctx.fillStyle = cmd.color;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillRect(-s * 0.05, -shaftW / 2, s - headLen * 0.7, shaftW);
        ctx.restore();

        // Head (triangle)
        ctx.fillStyle = cmd.color;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(s / 2, 0);
        ctx.lineTo(s / 2 - headLen, -headLen * 0.4);
        ctx.lineTo(s / 2 - headLen, headLen * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
    }

    // Text label on top of shape
    if (cmd.label) {
      ctx.fillStyle = cmd.labelColor ?? '#ffffff';
      ctx.font = `${cmd.labelSize ?? 16}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cmd.label, cx, cy);
    }

    ctx.restore();
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
