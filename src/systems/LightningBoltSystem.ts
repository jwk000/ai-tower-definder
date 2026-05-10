import { TowerWorld, type System } from '../core/World.js';
import { LightningBolt, Position, defineQuery } from '../core/components.js';
import { Container, Graphics } from 'pixi.js';

const SEGMENTS = 8;
const lightningQuery = defineQuery([LightningBolt]);

/** Renders lightning bolt visual effects with glow */
export class LightningBoltSystem implements System {
  readonly name = 'LightningBoltSystem';
  private prevGraphics: Graphics[] = [];

  constructor(
    private container: Container,
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
    // Remove previous frame's graphics
    for (const g of this.prevGraphics) {
      this.container.removeChild(g);
      g.destroy();
    }
    this.prevGraphics = [];

    const entities = lightningQuery(world.world);
    for (const eid of entities) {
      const elapsed = LightningBolt.elapsed[eid]!;
      const duration = LightningBolt.duration[eid]!;
      if (elapsed < duration) {
        this.drawBolt(eid);
      }
    }
  }

  private drawBolt(eid: number): void {
    const g = new Graphics();
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

    // Draw glow layers (shader-like effect)
    this.drawGlow(g, points, alpha);

    // Draw core line
    g.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i]!.x, points[i]!.y);
    }
    g.stroke({ color: '#ffffff', width: 2, alpha, cap: 'round', join: 'round' });

    // Draw spark particles at junctions
    for (let i = 1; i < points.length - 1; i += 2) {
      const p = points[i]!;
      g.circle(p.x, p.y, 3).fill({ color: '#ffffff', alpha: alpha * 0.8 });
    }

    this.container.addChild(g);
    this.prevGraphics.push(g);
  }

  private drawGlow(g: Graphics, points: { x: number; y: number }[], alpha: number): void {
    // Outer glow (yellow, wide)
    g.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i]!.x, points[i]!.y);
    }
    g.stroke({ color: '#ffeb3b', width: 8, alpha: alpha * 0.3, cap: 'round', join: 'round' });

    // Mid glow (amber, medium)
    g.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i]!.x, points[i]!.y);
    }
    g.stroke({ color: '#ff9800', width: 5, alpha: alpha * 0.5, cap: 'round', join: 'round' });

    // Inner glow (white, thin)
    g.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i]!.x, points[i]!.y);
    }
    g.stroke({ color: '#ffffff', width: 2, alpha: alpha * 0.7, cap: 'round', join: 'round' });
  }
}
