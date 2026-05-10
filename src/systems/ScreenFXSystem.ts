// ============================================================
// Tower Defender — ScreenFXSystem
//
// 全屏后处理特效：阳光射线、风线、云阴影、暗角、色调滤镜
// 在 onPostRender 阶段调用，所有实体绘制完成后叠加
// 非 ECS System，不参与 World.update 循环
// ============================================================

import { WeatherType } from '../types/index.js';

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

    // Phase 4: 以下效果逐步实现
    // this.drawSunRays(ctx, weather);
    // this.drawWindLines(ctx, weather);
    // this.drawCloudShadows(ctx);
    // this.drawVignette(ctx, weather);
  }

  // ---- Phase 4: 阳光射线 ----

  /**
   * 从画面左上角斜射下来的半透明金色光束
   * 仅在晴天/非夜晚天气下显示
   */
  private drawSunRays(_ctx: CanvasRenderingContext2D, _weather: WeatherType): void {
    // Phase 4 实现
  }

  // ---- Phase 4: 风线 ----

  /**
   * 半透明白色细线从左侧向右扫过全屏
   * 密度与天气关联（Rain/Night 密度翻倍）
   */
  private drawWindLines(_ctx: CanvasRenderingContext2D, _weather: WeatherType): void {
    // Phase 4 实现
  }

  // ---- Phase 4: 暗角 ----

  /**
   * 屏幕四角向中心渐变变暗
   * 夜晚/雾天 alpha 翻倍
   */
  private drawVignette(_ctx: CanvasRenderingContext2D, _weather: WeatherType): void {
    // Phase 4 实现
  }
}
