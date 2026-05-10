// ============================================================
// Tower Defender — ScreenFXSystem
//
// 全屏后处理特效：阳光射线、风线、暗角
// 在 onPostRender 阶段调用，所有实体绘制完成后叠加
// 非 ECS System，不参与 World.update 循环
// ============================================================

import { WeatherType } from '../types/index.js';
import { LayoutManager } from '../ui/LayoutManager.js';

export class ScreenFXSystem {
  /** 当前时间（秒），用于动画驱动 */
  private time = 0;

  /**
   * 更新内部时间并渲染所有全屏特效
   * @param ctx    Canvas 2D 渲染上下文
   * @param dt     帧间隔（秒），用于驱动动画
   * @param weather 当前天气类型
   */
  render(ctx: CanvasRenderingContext2D, dt: number, weather: WeatherType): void {
    this.time += dt;

    this.drawSunRays(ctx, weather);
    this.drawWindLines(ctx, weather);
    this.drawVignette(ctx, weather);
  }

  // ============================================================
  // 阳光射线
  // ============================================================

  /**
   * 从画面左上角斜射下来的半透明金色光束
   * 仅在晴天显示
   */
  private drawSunRays(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    if (weather !== WeatherType.Sunny) return;

    const rayAlpha = 0.025 + Math.sin(this.time * 0.4) * 0.015;
    const rays = [
      { angleDeg: -25, width: 100 },
      { angleDeg: -12, width: 70 },
      { angleDeg: 0,   width: 140 },
      { angleDeg: 12,  width: 80 },
      { angleDeg: 25,  width: 90 },
    ];

    ctx.save();
    ctx.fillStyle = '#fff9c4';

    for (const ray of rays) {
      const angle = (ray.angleDeg * Math.PI) / 180;
      const originX = 0;
      const originY = 0;

      const length = 1800;
      const topW = ray.width * 0.3;
      const bottomW = ray.width;
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      const endX = originX + Math.cos(angle) * length;
      const endY = originY + Math.sin(angle) * length;

      ctx.globalAlpha = rayAlpha;
      ctx.beginPath();
      ctx.moveTo(originX + perpX * topW, originY + perpY * topW);
      ctx.lineTo(endX + perpX * bottomW, endY + perpY * bottomW);
      ctx.lineTo(endX - perpX * bottomW, endY - perpY * bottomW);
      ctx.lineTo(originX - perpX * topW, originY - perpY * topW);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // ============================================================
  // 风线
  // ============================================================

  /**
   * 半透明白色细线从左侧向右扫过全屏
   * 雨天/夜晚密度翻倍
   */
  private drawWindLines(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    const isWindy = weather === WeatherType.Rain || weather === WeatherType.Night;
    const count = isWindy ? 6 : 2;
    const baseAlpha = isWindy ? 0.06 : 0.03;

    ctx.save();
    ctx.strokeStyle = '#ffffff';

    for (let i = 0; i < count; i++) {
      const phase = i * 0.7 + this.time * (0.8 + i * 0.3);
      const speed = 200 + i * 80;
      const rawX = (this.time * speed + i * 400) % 2400 - 200;

      const baseY = 200 + i * 140 + (i % 2) * 60;
      const y = baseY + Math.sin(phase * 1.5) * 30;
      const lineW = 2 + (i % 3);
      const len = 250 + (i % 3) * 200;

      ctx.globalAlpha = baseAlpha * (0.7 + (i % 3) * 0.2);
      ctx.lineWidth = lineW;
      ctx.beginPath();
      ctx.moveTo(rawX, y);
      ctx.lineTo(rawX + len, y + Math.sin(phase * 2) * 15);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ============================================================
  // 暗角效果
  // ============================================================

  /**
   * 屏幕四角向中心渐变变暗
   * 夜晚/雾天 alpha 翻倍
   */
  private drawVignette(ctx: CanvasRenderingContext2D, weather: WeatherType): void {
    const isDark = weather === WeatherType.Fog || weather === WeatherType.Night;
    const baseAlpha = isDark ? 0.2 : 0.1;

    const corners = [
      { x: 0, y: 0 },
      { x: LayoutManager.DESIGN_W, y: 0 },
      { x: 0, y: LayoutManager.DESIGN_H },
      { x: LayoutManager.DESIGN_W, y: LayoutManager.DESIGN_H },
    ];

    ctx.save();

    for (const corner of corners) {
      const radius = isDark ? 600 : 450;
      const grad = ctx.createRadialGradient(corner.x, corner.y, 0, corner.x, corner.y, radius);
      grad.addColorStop(0, `rgba(0, 0, 0, ${baseAlpha})`);
      grad.addColorStop(0.5, `rgba(0, 0, 0, ${baseAlpha * 0.5})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(corner.x - radius, corner.y - radius, radius * 2, radius * 2);
    }

    ctx.restore();
  }
}
