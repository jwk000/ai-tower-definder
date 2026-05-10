import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType } from '../types/index.js';
import { Renderer } from '../render/Renderer.js';
import { LaserBeam } from '../components/LaserBeam.js';
import { Position } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { Render } from '../components/Render.js';

const GLOW_COLOR = '#e040fb';
const CORE_COLOR = '#ffffff';

export class LaserBeamSystem implements System {
  readonly name = 'LaserBeamSystem';
  readonly requiredComponents = [CType.LaserBeam] as const;

  constructor(
    private world: World,
    private renderer: Renderer,
  ) {}

  update(entities: number[], dt: number): void {
    for (const id of entities) {
      const beam = this.world.getComponent<LaserBeam>(id, CType.LaserBeam);
      if (!beam) continue;

      beam.timer -= dt;
      if (beam.timer <= 0) {
        this.world.destroyEntity(id);
        continue;
      }

      // Update beam endpoint to track target
      const targetPos = this.world.getComponent<Position>(beam.targetId, CType.Position);
      if (targetPos && this.world.isAlive(beam.targetId)) {
        beam.toX = targetPos.x;
        beam.toY = targetPos.y;
      }

      // Burn damage to enemies touching the beam
      beam.damageTimer += dt;
      if (beam.damageTimer >= beam.damageInterval) {
        beam.damageTimer -= beam.damageInterval;
        this.applyBeamDamage(beam);
      }
    }
  }

  private applyBeamDamage(beam: LaserBeam): void {
    const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);
    for (const enemyId of enemies) {
      if (beam.affectedEnemies.has(enemyId)) continue;
      if (!this.world.isAlive(enemyId)) continue;

      const ePos = this.world.getComponent<Position>(enemyId, CType.Position);
      const eHealth = this.world.getComponent<Health>(enemyId, CType.Health);
      if (!ePos || !eHealth?.alive) continue;

      const eRender = this.world.getComponent<Render>(enemyId, CType.Render);
      const enemyRadius = eRender ? eRender.size / 2 : 12;

      if (this.lineCircleHit(
        beam.fromX, beam.fromY, beam.toX, beam.toY,
        ePos.x, ePos.y, enemyRadius,
      )) {
        eHealth.takeDamage(beam.damage);
        if (eRender) eRender.hitFlashTimer = 0.12;
        beam.affectedEnemies.add(enemyId);
      }
    }
  }

  private lineCircleHit(
    x1: number, y1: number, x2: number, y2: number,
    cx: number, cy: number, r: number,
  ): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - cx;
    const fy = y1 - cy;
    const a = dx * dx + dy * dy;
    if (a < 0.01) {
      return Math.sqrt(fx * fx + fy * fy) <= r;
    }
    let t = -(fx * dx + fy * dy) / a;
    t = Math.max(0, Math.min(1, t));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const dist = Math.sqrt((closestX - cx) ** 2 + (closestY - cy) ** 2);
    return dist <= r;
  }

  renderBeams(): void {
    const entities = this.world.query(CType.LaserBeam);
    const ctx = this.renderer.context;
    if (!ctx) return;

    for (const id of entities) {
      const beam = this.world.getComponent<LaserBeam>(id, CType.LaserBeam);
      if (!beam || beam.timer <= 0) continue;
      this.drawBeam(ctx, beam);
    }
  }

  private drawBeam(ctx: CanvasRenderingContext2D, beam: LaserBeam): void {
    const alpha = beam.alpha;

    // Outer glow
    ctx.save();
    ctx.globalAlpha = alpha * 0.3;
    ctx.strokeStyle = GLOW_COLOR;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(beam.fromX, beam.fromY);
    ctx.lineTo(beam.toX, beam.toY);
    ctx.stroke();

    // Mid glow
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = '#9c27b0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(beam.fromX, beam.fromY);
    ctx.lineTo(beam.toX, beam.toY);
    ctx.stroke();

    // Core beam
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = CORE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(beam.fromX, beam.fromY);
    ctx.lineTo(beam.toX, beam.toY);
    ctx.stroke();

    ctx.restore();
  }
}
