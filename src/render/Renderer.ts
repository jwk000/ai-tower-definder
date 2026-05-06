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
    // Fill with solid background instead of transparent
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
    ctx.fillStyle = cmd.color;

    const cx = cmd.x;
    const cy = cmd.y;
    const s = cmd.size;
    const hs = s / 2;

    if (cmd.rotation) {
      ctx.translate(cx, cy);
      ctx.rotate(cmd.rotation);
    }

    switch (cmd.shape) {
      case 'rect': {
        const x = cmd.rotation ? -hs : cx - hs;
        const y = cmd.rotation ? -hs : cy - hs;
        ctx.fillRect(x, y, s, s);
        if (cmd.stroke) {
          ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth ?? 1;
          ctx.strokeRect(x, y, s, s);
        }
        break;
      }
      case 'circle':
        ctx.beginPath();
        ctx.arc(cmd.rotation ? 0 : cx, cmd.rotation ? 0 : cy, hs, 0, Math.PI * 2);
        ctx.fill();
        if (cmd.stroke) {
          ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth ?? 1;
          ctx.stroke();
        }
        break;
      case 'triangle':
        ctx.beginPath();
        if (cmd.rotation) {
          ctx.moveTo(0, -hs);
          ctx.lineTo(-hs * 0.866, hs * 0.5);
          ctx.lineTo(hs * 0.866, hs * 0.5);
        } else {
          ctx.moveTo(cx, cy - hs);
          ctx.lineTo(cx - hs * 0.866, cy + hs * 0.5);
          ctx.lineTo(cx + hs * 0.866, cy + hs * 0.5);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'diamond':
        ctx.beginPath();
        if (cmd.rotation) {
          ctx.moveTo(0, -hs);
          ctx.lineTo(hs, 0);
          ctx.lineTo(0, hs);
          ctx.lineTo(-hs, 0);
        } else {
          ctx.moveTo(cx, cy - hs);
          ctx.lineTo(cx + hs, cy);
          ctx.lineTo(cx, cy + hs);
          ctx.lineTo(cx - hs, cy);
        }
        ctx.closePath();
        ctx.fill();
        if (cmd.stroke) {
          ctx.strokeStyle = cmd.stroke;
          ctx.lineWidth = cmd.strokeWidth ?? 1;
          ctx.stroke();
        }
        break;
      case 'hexagon':
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = (cmd.rotation ? 0 : cx) + hs * Math.cos(angle);
          const py = (cmd.rotation ? 0 : cy) + hs * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
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
