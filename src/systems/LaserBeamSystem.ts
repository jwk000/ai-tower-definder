import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { LaserBeam, Position, Health, Visual } from '../core/components.js';
import { Container, Graphics } from 'pixi.js';

const GLOW_COLOR = '#e040fb';
const CORE_COLOR = '#ffffff';
const DAMAGE_INTERVAL = 0.1;

const beamQuery = defineQuery([LaserBeam]);

/** 激光束 — 持续性伤害 + PixiJS Graphics 渲染 */
export class LaserBeamSystem implements System {
  readonly name = 'LaserBeamSystem';

  private damageTimers = new Map<number, number>();
  private beamGfx: Graphics | null = null;

  constructor(private container: Container) {}

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
    // Remove previous frame's graphics
    if (this.beamGfx) {
      this.container.removeChild(this.beamGfx);
      this.beamGfx.destroy();
      this.beamGfx = null;
    }

    const entities = beamQuery(world.world);
    if (entities.length === 0) return;

    this.beamGfx = new Graphics();
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
      this.drawBeam(this.beamGfx, fromX, fromY, toX, toY, alpha);
    }
    this.container.addChild(this.beamGfx);
  }

  private applyDamage(eid: number): void {
    const targetId = LaserBeam.targetId[eid]!;
    if (!targetId || Health.current[targetId]! <= 0) return;
    Health.current[targetId]! -= LaserBeam.damage[eid]!;
    Visual.hitFlashTimer[targetId] = 0.08;
  }

  private drawBeam(
    g: Graphics,
    fromX: number, fromY: number,
    toX: number, toY: number,
    alpha: number,
  ): void {
    // Outer glow (width 10, alpha 0.3)
    g.moveTo(fromX, fromY).lineTo(toX, toY);
    g.stroke({ color: GLOW_COLOR, width: 10, alpha: alpha * 0.3, cap: 'round' });

    // Mid glow (width 5, alpha 0.6)
    g.moveTo(fromX, fromY).lineTo(toX, toY);
    g.stroke({ color: '#9c27b0', width: 5, alpha: alpha * 0.6, cap: 'round' });

    // Core beam (width 2, alpha 1.0)
    g.moveTo(fromX, fromY).lineTo(toX, toY);
    g.stroke({ color: CORE_COLOR, width: 2, alpha, cap: 'round' });
  }
}
