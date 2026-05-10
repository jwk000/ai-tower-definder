import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { LaserBeam, Position, Health, Visual } from '../core/components.js';
import type { Renderer } from '../render/Renderer.js';

const GLOW_COLOR = '#e040fb';
const CORE_COLOR = '#ffffff';
const DAMAGE_INTERVAL = 0.1;

const beamQuery = defineQuery([LaserBeam]);

/** Laser beam — continuous damage + Canvas 2D rendering */
export class LaserBeamSystem implements System {
  readonly name = 'LaserBeamSystem';

  private damageTimers = new Map<number, number>();

  constructor(private renderer: Renderer) {}

  update(world: TowerWorld, dt: number): void {
    const entities = beamQuery(world.world);
    for (const eid of entities) {
      LaserBeam.elapsed[eid]! += dt;
      const elapsed = LaserBeam.elapsed[eid]!;
      const duration = LaserBeam.duration[eid]!;

      if (elapsed >= duration) {
        world.destroyEntity(eid);
        this.damageTimers.delete(eid);
        continue;
      }

      let timer = this.damageTimers.get(eid) ?? 0;
      timer += dt;
      if (timer >= DAMAGE_INTERVAL) {
        timer -= DAMAGE_INTERVAL;
        this.applyDamage(eid);
      }
      this.damageTimers.set(eid, timer);
    }
  }

  renderBeams(world: TowerWorld): void {
    const ctx = this.renderer.context;

    const entities = beamQuery(world.world);
    for (const eid of entities) {
      const elapsed = LaserBeam.elapsed[eid]!;
      const duration = LaserBeam.duration[eid]!;
      if (elapsed >= duration) continue;

      const sourceId = LaserBeam.sourceId[eid]!;
      const targetId = LaserBeam.targetId[eid]!;

      const fromX = Position.x[sourceId];
      const fromY = Position.y[sourceId];
      const toX = Position.x[targetId];
      const toY = Position.y[targetId];

      if (fromX === undefined || fromY === undefined ||
          toX === undefined || toY === undefined) continue;

      const alpha = Math.max(0, 1 - elapsed / duration);
      this.drawBeam(ctx, fromX, fromY, toX, toY, alpha);
    }
  }

  private applyDamage(eid: number): void {
    const targetId = LaserBeam.targetId[eid]!;
    if (!targetId || Health.current[targetId]! <= 0) return;
    Health.current[targetId]! -= LaserBeam.damage[eid]!;
    Visual.hitFlashTimer[targetId] = 0.08;
  }

  private drawBeam(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number,
    toX: number, toY: number,
    alpha: number,
  ): void {
    const drawLine = (color: string, width: number, a: number) => {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.restore();
    };

    // Outer glow (width 10, alpha 0.3)
    drawLine(GLOW_COLOR, 10, alpha * 0.3);
    // Mid glow (width 5, alpha 0.6)
    drawLine('#9c27b0', 5, alpha * 0.6);
    // Core beam (width 2, alpha 1.0)
    drawLine(CORE_COLOR, 2, alpha);
  }
}
