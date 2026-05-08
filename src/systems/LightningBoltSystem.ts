import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType } from '../types/index.js';
import { Renderer } from '../render/Renderer.js';
import { LightningBolt } from '../components/LightningBolt.js';
import { LightningAura } from '../components/LightningAura.js';
import { Render } from '../components/Render.js';

const SEGMENTS = 8;

/** Renders lightning bolt visual effects with glow, and ticks aura timers */
export class LightningBoltSystem implements System {
  readonly name = 'LightningBoltSystem';
  readonly requiredComponents = ['LightningBolt'] as const;

  constructor(
    private world: World,
    private renderer: Renderer,
  ) {}

  update(entities: number[], dt: number): void {
    // Tick lightning bolt timers
    for (const id of entities) {
      const bolt = this.world.getComponent<LightningBolt>(id, 'LightningBolt')!;
      bolt.timer -= dt;
      if (bolt.timer <= 0) {
        this.world.destroyEntity(id);
      }
    }

    // Tick lightning aura timers (white rings on hit enemies)
    const auras = this.world.query('LightningAura');
    for (const id of auras) {
      const aura = this.world.getComponent<LightningAura>(id, 'LightningAura');
      if (!aura) continue;
      aura.timer -= dt;
      const render = this.world.getComponent<Render>(id, CType.Render);
      if (aura.timer <= 0) {
        this.world.destroyEntity(id);
      } else if (render) {
        render.alpha = Math.max(0, aura.timer / 0.5) * 0.6;
        render.size = 30 + (1 - aura.timer / 0.5) * 10;
      }
    }
  }

  /** Draw all active bolts — called from onPostRender after endFrame */
  renderBolts(): void {
    const entities = this.world.query('LightningBolt');
    for (const id of entities) {
      const bolt = this.world.getComponent<LightningBolt>(id, 'LightningBolt');
      if (bolt && bolt.timer > 0) {
        this.drawBolt(bolt);
      }
    }
  }

  private drawBolt(bolt: LightningBolt): void {
    const ctx = this.renderer.context;
    const alpha = bolt.alpha;

    // Generate jagged points
    const points: { x: number; y: number }[] = [];
    const dx = bolt.toX - bolt.fromX;
    const dy = bolt.toY - bolt.fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / dist;
    const perpY = dx / dist;

    const jitter = dist * 0.12;

    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const baseX = bolt.fromX + dx * t;
      const baseY = bolt.fromY + dy * t;
      const offset = (i === 0 || i === SEGMENTS) ? 0 : (Math.random() - 0.5) * jitter;
      points.push({
        x: baseX + perpX * offset,
        y: baseY + perpY * offset,
      });
    }

    // Draw glow layers (shader-like effect)
    this.drawGlow(ctx, points, alpha);

    // Draw core line
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();
    ctx.restore();

    // Draw spark particles at junctions
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = '#ffffff';
    for (let i = 1; i < points.length - 1; i += 2) {
      const p = points[i]!;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGlow(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], alpha: number): void {
    // Outer glow (yellow, wide)
    ctx.save();
    ctx.globalAlpha = alpha * 0.3;
    ctx.strokeStyle = '#ffeb3b';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();

    // Mid glow (amber, medium)
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();

    // Inner glow (white, thin)
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i]!.x, points[i]!.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}
