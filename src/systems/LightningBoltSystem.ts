import { TowerWorld, type System } from '../core/World.js';
import { LightningBolt, Position, defineQuery } from '../core/components.js';
import type { Renderer } from '../render/Renderer.js';

const SEGMENTS = 8;
const lightningQuery = defineQuery([LightningBolt]);

/** Renders lightning bolt visual effects with glow using Canvas 2D */
export class LightningBoltSystem implements System {
  readonly name = 'LightningBoltSystem';

  constructor(
    private renderer: Renderer,
  ) {}

  update(world: TowerWorld, dt: number): void {
    const entities = lightningQuery(world.world);
    for (const eid of entities) {
      LightningBolt.elapsed[eid]! += dt;
      const elapsed = LightningBolt.elapsed[eid]!;
      const duration = LightningBolt.duration[eid]!;
      if (elapsed >= duration) {
        world.destroyEntity(eid);
      }
    }
  }

  /** Draw all active bolts — called from onPostRender after endFrame */
  renderBolts(world: TowerWorld): void {
    const ctx = this.renderer.context;

    const entities = lightningQuery(world.world);
    for (const eid of entities) {
      const elapsed = LightningBolt.elapsed[eid]!;
      const duration = LightningBolt.duration[eid]!;
      if (elapsed < duration) {
        this.drawBolt(ctx, eid);
      }
    }
  }

  private drawBolt(ctx: CanvasRenderingContext2D, eid: number): void {
    const elapsed = LightningBolt.elapsed[eid]!;
    const duration = LightningBolt.duration[eid]!;
    const alpha = Math.max(0, 1 - elapsed / duration);

    const srcId = LightningBolt.sourceId[eid]!;
    const tgtId = LightningBolt.targetId[eid]!;
    const fromX = Position.x[srcId] ?? 0;
    const fromY = Position.y[srcId] ?? 0;
    const toX = Position.x[tgtId] ?? 0;
    const toY = Position.y[tgtId] ?? 0;

    // Generate jagged points
    const points: { x: number; y: number }[] = [];
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / dist;
    const perpY = dx / dist;

    const jitter = dist * 0.12;

    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const baseX = fromX + dx * t;
      const baseY = fromY + dy * t;
      const offset = (i === 0 || i === SEGMENTS) ? 0 : (Math.random() - 0.5) * jitter;
      points.push({
        x: baseX + perpX * offset,
        y: baseY + perpY * offset,
      });
    }

    // Draw glow layers
    this.drawGlow(ctx, points, alpha);

    // Draw core line
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();
    ctx.restore();

    // Draw spark particles at junctions
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (let i = 1; i < points.length - 1; i += 2) {
      const p = points[i]!;
      ctx.globalAlpha = alpha * 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGlow(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], alpha: number): void {
    const drawLine = (color: string, width: number, a: number) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0]!.x, points[0]!.y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i]!.x, points[i]!.y);
      }
      ctx.stroke();
      ctx.restore();
    };

    // Outer glow (yellow, wide)
    drawLine('#ffeb3b', 8, alpha * 0.3);
    // Mid glow (amber, medium)
    drawLine('#ff9800', 5, alpha * 0.5);
    // Inner glow (white, thin)
    drawLine('#ffffff', 2, alpha * 0.7);
  }
}
