// ============================================================
// Tower Defender — PixiJS Renderer (replaces Canvas 2D Renderer)
//
// Provides backward-compatible push(command) API while using
// PixiJS Graphics for actual rendering. Systems that need
// direct drawing access get Graphics objects via createGraphics().
// ============================================================

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ShapeType } from '../types/index.js';

// ---- Render command (backward compatible with Canvas API) ----
export interface RenderCommand {
  shape: ShapeType;
  x: number;
  y: number;
  size: number;
  color: string;
  alpha?: number;
  h?: number;
  stroke?: string;
  strokeWidth?: number;
  targetX?: number;
  targetY?: number;
  label?: string;
  labelColor?: string;
  labelSize?: number;
}

export class PixiRenderer {
  private gfx: Graphics;
  private labelTexts: Text[] = [];
  private labelGraphics: Graphics[] = [];
  private commands: RenderCommand[] = [];

  constructor(private container: Container) {
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  /** Clear all draw commands for the next frame */
  beginFrame(): void {
    this.commands = [];
    this.gfx.clear();
    // Remove old text labels and temporary graphics
    for (const t of this.labelTexts) {
      this.container.removeChild(t);
    }
    for (const g of this.labelGraphics) {
      this.container.removeChild(g);
      g.destroy();
    }
    this.labelTexts = [];
    this.labelGraphics = [];
  }

  /** Queue a draw command */
  push(cmd: RenderCommand): void {
    this.commands.push(cmd);
  }

  /** Draw all queued commands and flush */
  endFrame(): void {
    for (const cmd of this.commands) {
      this.drawCommand(cmd);
    }
  }

  /** Create a dedicated Graphics object for direct drawing */
  createGraphics(): Graphics {
    const g = new Graphics();
    this.container.addChild(g);
    return g;
  }

  /** Remove and destroy a Graphics object */
  removeGraphics(g: Graphics): void {
    this.container.removeChild(g);
    g.destroy();
  }

  private drawCommand(cmd: RenderCommand): void {
    const g = this.gfx;
    const cx = cmd.x;
    const cy = cmd.y;
    const s = cmd.size;
    const hs = s / 2;
    const alpha = cmd.alpha ?? 1;

    g.alpha = alpha;

    switch (cmd.shape) {
      case 'rect': {
        const rw = s;
        const rh = cmd.h ?? s;
        const x = cx - rw / 2;
        const y = cy - rh / 2;
        g.rect(x, y, rw, rh);
        g.fill({ color: cmd.color });
        if (cmd.stroke) {
          g.stroke({ color: cmd.stroke, width: cmd.strokeWidth ?? 1 });
        }
        break;
      }
      case 'circle':
        g.circle(cx, cy, hs);
        g.fill({ color: cmd.color });
        if (cmd.stroke) {
          g.stroke({ color: cmd.stroke, width: cmd.strokeWidth ?? 2 });
        }
        break;
      case 'triangle': {
        const x1 = cx;
        const y1 = cy - hs;
        const x2 = cx - hs * 0.866;
        const y2 = cy + hs * 0.5;
        const x3 = cx + hs * 0.866;
        const y3 = cy + hs * 0.5;
        g.poly([x1, y1, x2, y2, x3, y3]);
        g.fill({ color: cmd.color });
        break;
      }
      case 'diamond': {
        g.poly([cx, cy - hs, cx + hs, cy, cx, cy + hs, cx - hs, cy]);
        g.fill({ color: cmd.color });
        if (cmd.stroke) {
          g.stroke({ color: cmd.stroke, width: cmd.strokeWidth ?? 1 });
        }
        break;
      }
      case 'hexagon': {
        const pts: number[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          pts.push(cx + hs * Math.cos(angle), cy + hs * Math.sin(angle));
        }
        g.poly(pts);
        g.fill({ color: cmd.color });
        break;
      }
      case 'arrow': {
        const tx = cmd.targetX ?? cx + s;
        const ty = cmd.targetY ?? cy;
        const angle = Math.atan2(ty - cy, tx - cx);
        const headLen = s * 0.55;
        const shaftW = s * 0.18;

        // Create a separate Graphics for rotated arrow
        const arrowGfx = new Graphics();
        arrowGfx.x = cx;
        arrowGfx.y = cy;
        arrowGfx.rotation = angle;
        arrowGfx.alpha = alpha;

        // Shaft
        arrowGfx.rect(-s * 0.05, -shaftW / 2, s - headLen * 0.7, shaftW);
        arrowGfx.fill({ color: cmd.color });

        // Head
        arrowGfx.poly([s / 2, 0, s / 2 - headLen, -headLen * 0.4, s / 2 - headLen, headLen * 0.4]);
        arrowGfx.fill({ color: cmd.color });

        this.container.addChild(arrowGfx);
        this.labelGraphics.push(arrowGfx);
        break;
      }
    }

    // Text label
    if (cmd.label) {
      const text = new Text({
        text: cmd.label,
        style: new TextStyle({
          fontSize: cmd.labelSize ?? 16,
          fill: cmd.labelColor ?? '#ffffff',
          align: 'center',
        }),
      });
      text.anchor.set(0.5);
      text.x = cx;
      text.y = cy;
      this.container.addChild(text);
      this.labelTexts.push(text);
    }
  }
}
