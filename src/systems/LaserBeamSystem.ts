import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { LaserBeam, Position, Health, Visual } from '../core/components.js';
import { Renderer } from '../render/Renderer.js';

const GLOW_COLOR = '#e040fb';
const CORE_COLOR = '#ffffff';
const DAMAGE_INTERVAL = 0.1; // 每秒10次伤害tick

const beamQuery = defineQuery([LaserBeam]);

/**
 * 激光束系统 — 持续性伤害 + Canvas 2D渲染
 *
 * 激光束是塔与目标之间的连线，带发光效果。每隔 DAMAGE_INTERVAL 秒
 * 对目标造成一次伤害。光束追踪目标位置（动态读取 Position）。
 */
export class LaserBeamSystem implements System {
  readonly name = 'LaserBeamSystem';

  /** 每个光束实体的伤害计时器累积（秒） */
  private damageTimers = new Map<number, number>();

  constructor(
    private renderer: Renderer,
  ) {}

  update(world: TowerWorld, dt: number): void {
    const entities = beamQuery(world.world);

    for (const eid of entities) {
      // 更新持续时间
      LaserBeam.elapsed[eid] += dt;
      const elapsed = LaserBeam.elapsed[eid];
      const duration = LaserBeam.duration[eid];

      // 超时销毁
      if (elapsed >= duration) {
        world.destroyEntity(eid);
        this.damageTimers.delete(eid);
        continue;
      }

      // 周期性伤害
      let timer = this.damageTimers.get(eid) ?? 0;
      timer += dt;
      if (timer >= DAMAGE_INTERVAL) {
        timer -= DAMAGE_INTERVAL;
        this.applyDamage(eid);
      }
      this.damageTimers.set(eid, timer);
    }
  }

  /**
   * 渲染所有活跃光束（从 onPostRender 调用，在 endFrame 之后）
   */
  renderBeams(world: TowerWorld): void {
    const entities = beamQuery(world.world);
    const ctx = this.renderer.context;
    if (!ctx) return;

    for (const eid of entities) {
      const elapsed = LaserBeam.elapsed[eid];
      const duration = LaserBeam.duration[eid];
      if (elapsed >= duration) continue;

      const sourceId = LaserBeam.sourceId[eid];
      const targetId = LaserBeam.targetId[eid];

      const fromX = Position.x[sourceId];
      const fromY = Position.y[sourceId];
      const toX = Position.x[targetId];
      const toY = Position.y[targetId];

      if (fromX === undefined || fromY === undefined ||
          toX === undefined || toY === undefined) {
        continue;
      }

      const alpha = Math.max(0, 1 - elapsed / duration);
      this.drawBeam(ctx, fromX, fromY, toX, toY, alpha);
    }
  }

  // ---- 内部 ----

  /** 对光束目标造成一次周期性伤害 */
  private applyDamage(eid: number): void {
    const targetId = LaserBeam.targetId[eid];
    if (!targetId) return;

    // 目标已死亡则跳过
    if (Health.current[targetId] <= 0) return;

    const damage = LaserBeam.damage[eid];
    Health.current[targetId] -= damage;

    // 受击闪白
    Visual.hitFlashTimer[targetId] = 0.08;
  }

  /** 绘制单条光束（三层发光 → 核心线） */
  private drawBeam(
    ctx: CanvasRenderingContext2D,
    fromX: number, fromY: number,
    toX: number, toY: number,
    alpha: number,
  ): void {
    // 外层发光
    ctx.save();
    ctx.globalAlpha = alpha * 0.3;
    ctx.strokeStyle = GLOW_COLOR;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // 中层发光
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = '#9c27b0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // 核心光束
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = CORE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.restore();
  }
}
