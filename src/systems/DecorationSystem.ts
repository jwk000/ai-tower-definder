// ============================================================
// Tower Defender — DecorationSystem
//
// 场景装饰系统：背景层 + 静态装饰物复合几何体 + 动态环境生物
// 纯视觉系统，不参与游戏逻辑（碰撞/寻路/建造/攻击）
// 注册顺序：在 RenderSystem 之前，MovementSystem 之后
// ============================================================

import { TowerWorld, type System } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import type { MapConfig, WeatherType, ObstacleType } from '../types/index.js';

/**
 * 复合几何体定义 —— 由多个简单形状组合成一个装饰物
 * 每个部分可以有不同的形状、颜色、大小和偏移
 */
export interface CompositePart {
  shape: 'rect' | 'circle' | 'triangle' | 'diamond';
  offsetX: number;
  offsetY: number;
  size: number;
  h?: number;       // rect 的高度（可选）
  color: string;
  alpha?: number;
}

export type CompositeVisual = CompositePart[];

export class DecorationSystem implements System {
  readonly name = 'DecorationSystem';

  private renderer: Renderer;
  private map: MapConfig;
  private getWeather: () => WeatherType;

  /** 场景布局偏移（与 RenderSystem 保持一致） */
  static sceneOffsetX = 0;
  static sceneOffsetY = 0;
  static sceneW = 0;
  static sceneH = 0;

  /** 当前时间（秒），用于动画驱动 */
  private currentTime = 0;

  constructor(
    renderer: Renderer,
    map: MapConfig,
    getWeather: () => WeatherType,
  ) {
    this.renderer = renderer;
    this.map = map;
    this.getWeather = getWeather;
  }

  // ---- System.update ----

  update(_world: TowerWorld, dt: number): void {
    this.currentTime += dt;

    // Phase 3: 背景层（天空渐变 + 远景 + 云）
    // this.drawBackground();

    // Phase 2: 静态装饰物（复合几何体 + 微动）
    // this.drawStaticDecorations();

    // Phase 5: 动态生物
    // this.updateCreatures(world, dt);
    // this.drawCreatures();
  }

  // ---- Phase 2: 静态装饰物复合几何体 ----

  /**
   * 每种障碍物对应的复合几何体定义
   * 当前为 v1.0 单形状渲染（兼容期），Phase 2 实现复合几何体
   */
  // @ts-expect-error - 预留字段，Phase 2 实现
  private static readonly COMPOSITE_VISUALS: Record<ObstacleType, CompositeVisual> = {
    // Phase 2 实现时填充
  } as Record<ObstacleType, CompositeVisual>;

  /**
   * 植物微动参数表（Phase 2 实现）
   */
  // @ts-expect-error - 预留字段
  private static readonly SWAY_PARAMS: Record<ObstacleType, {
    amplitudeX: number;
    amplitudeY: number;
    frequency: number;
    windMultiplier: number;
  }> = {} as Record<ObstacleType, unknown>;

  // ---- Phase 3: 背景层 ----

  /**
   * 天空渐变配色（5 个主题）
   */
  static readonly SKY_COLORS: Record<string, { top: string; bottom: string }> = {
    plains:  { top: '#87CEEB', bottom: '#E8F5E9' },
    desert:  { top: '#FF9800', bottom: '#FFE0B2' },
    tundra:  { top: '#BBDEFB', bottom: '#ECEFF1' },
    volcano: { top: '#D32F2F', bottom: '#1A0000' },
    castle:  { top: '#1A237E', bottom: '#37474F' },
  };

  // ---- Phase 4: 全屏特效（在 ScreenFXSystem 中实现） ----
}
