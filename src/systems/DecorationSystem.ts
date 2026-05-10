// ============================================================
// Tower Defender — DecorationSystem
//
// 场景装饰系统：背景层 + 静态装饰物复合几何体 + 动态环境生物
// 纯视觉系统，不参与游戏逻辑（碰撞/寻路/建造/攻击）
// 注册顺序：在 RenderSystem 之前，MovementSystem 之后
// ============================================================

import { TowerWorld, type System } from '../core/World.js';
import { Renderer } from '../render/Renderer.js';
import { ObstacleType, LevelTheme, type MapConfig, type WeatherType } from '../types/index.js';
import { computeSceneLayout } from './RenderSystem.js';

/**
 * 复合几何体部件 —— 由多个简单形状组合成一个装饰物
 */
interface CompositePart {
  shape: 'rect' | 'circle' | 'triangle' | 'diamond';
  offsetX: number;
  offsetY: number;
  size: number;
  h?: number;       // rect 的高度（可选，默认 = size）
  color: string;
  alpha?: number;
}

type CompositeVisual = CompositePart[];

/** 植物微动参数 */
interface SwayParams {
  amplitudeX: number;
  amplitudeY: number;
  frequency: number;
  windMultiplier: number;
}

/** 云朵状态 */
interface CloudState {
  x: number;
  y: number;
  /** 组成云朵的椭圆列表 */
  ellipses: { rx: number; ry: number; offsetX: number; offsetY: number }[];
  speed: number;
  alpha: number;
}

/** 飞鸟状态 */
interface BirdState {
  x: number;
  y: number;
  size: number;
  speed: number;         // 水平速度 px/s
  flapSpeed: number;     // 翅膀拍动频率 Hz
  phase: number;         // 翅膀动画相位
  hoverFreq: number;     // 上下浮动频率
  hoverPhase: number;    // 上下浮动相位
  hoverAmp: number;      // 上下浮动幅度
  color: string;
}

export class DecorationSystem implements System {
  readonly name = 'DecorationSystem';

  private renderer: Renderer;
  private map: MapConfig;
  private getWeather: () => WeatherType;

  /** 场景布局偏移 */
  private ox = 0;
  private oy = 0;
  private ts = 64;

  /** 当前时间（秒），用于动画驱动 */
  private currentTime = 0;

  /** 云朵列表（首次更新时初始化） */
  private clouds: CloudState[] = [];
  private cloudsInitialized = false;

  /** 飞鸟列表（首次更新时初始化） */
  private birds: BirdState[] = [];
  private birdsInitialized = false;

  constructor(
    renderer: Renderer,
    map: MapConfig,
    getWeather: () => WeatherType,
  ) {
    this.renderer = renderer;
    this.map = map;
    this.getWeather = getWeather;

    const layout = computeSceneLayout(map, 1920, 1080);
    this.ox = layout.offsetX;
    this.oy = layout.offsetY;
    this.ts = map.tileSize;
  }

  // ============================================================
  // System.update
  // ============================================================

  update(_world: TowerWorld, dt: number): void {
    this.currentTime += dt;

    // Phase 3: 背景层（天空渐变 + 远景 + 云）
    this.drawBackground();

    // Phase 2: 静态装饰物（复合几何体 + 微动）
    this.drawStaticDecorations();

    // Phase 5: 草丛叶片（在装饰物附近）
    this.drawGrassBlades();

    // Phase 3: 云朵（在装饰物之后，确保飘在远景之上）
    this.drawClouds();

    // Phase 5: 飞鸟（在云朵之后、实体之前）
    this.drawBirds();
  }

  // ============================================================
  // Phase 2: 静态装饰物复合几何体
  // ============================================================

  /**
   * 复合几何体定义 —— 每种障碍物 → 多个几何原语组合
   */
  private static readonly COMPOSITE_VISUALS: Record<ObstacleType, CompositeVisual> = {
    // ---- 平原 ----
    [ObstacleType.Tree]: [
      { shape: 'rect', offsetX: 0, offsetY: 3, size: 5, h: 10, color: '#5d4037' },  // 树干
      { shape: 'triangle', offsetX: 0, offsetY: -4, size: 14, color: '#2e7d32' },           // 树冠
      { shape: 'triangle', offsetX: 0, offsetY: -6, size: 10, color: '#388e3c', alpha: 0.7 }, // 高光层
    ],
    [ObstacleType.Bush]: [
      { shape: 'circle', offsetX: -3, offsetY: -1, size: 8, color: '#388e3c' },
      { shape: 'circle', offsetX: 3, offsetY: 0, size: 7, color: '#2e7d32' },
      { shape: 'circle', offsetX: 0, offsetY: 2, size: 9, color: '#43a047', alpha: 0.8 },
    ],
    [ObstacleType.Flower]: [
      { shape: 'circle', offsetX: 0, offsetY: -3, size: 3, color: '#f48fb1' },
      { shape: 'circle', offsetX: -3, offsetY: 1, size: 3, color: '#f48fb1' },
      { shape: 'circle', offsetX: 3, offsetY: 1, size: 3, color: '#f48fb1' },
      { shape: 'circle', offsetX: 0, offsetY: -1, size: 4, color: '#f06292' },
      { shape: 'circle', offsetX: 0, offsetY: -1, size: 2, color: '#fce4ec' },
    ],

    // ---- 沙漠 ----
    [ObstacleType.Rock]: [
      { shape: 'diamond', offsetX: 0, offsetY: 0, size: 12, color: '#6d4c41' },
      { shape: 'triangle', offsetX: -3, offsetY: -3, size: 5, color: '#8d6e63', alpha: 0.6 },
    ],
    [ObstacleType.Cactus]: [
      { shape: 'rect', offsetX: 0, offsetY: 0, size: 6, h: 12, color: '#558b2f' },   // 主干
      { shape: 'rect', offsetX: -5, offsetY: -3, size: 4, h: 7, color: '#558b2f' },   // 左臂
      { shape: 'rect', offsetX: 5, offsetY: -2, size: 4, h: 6, color: '#558b2f' },   // 右臂
    ],
    [ObstacleType.Bones]: [
      { shape: 'rect', offsetX: -3, offsetY: 0, size: 3, h: 10, color: '#d7ccc8', alpha: 0.7 },
      { shape: 'rect', offsetX: 3, offsetY: -2, size: 3, h: 6, color: '#d7ccc8', alpha: 0.7 },
      { shape: 'circle', offsetX: 0, offsetY: -1, size: 7, color: '#d7ccc8', alpha: 0.7 },
    ],

    // ---- 冰原 ----
    [ObstacleType.IceCrystal]: [
      { shape: 'diamond', offsetX: 0, offsetY: 0, size: 11, color: '#80deea' },
      { shape: 'diamond', offsetX: 0, offsetY: 0, size: 5, color: '#e0f7fa', alpha: 0.8 },
      { shape: 'triangle', offsetX: -6, offsetY: 2, size: 6, color: '#4dd0e1', alpha: 0.6 },
      { shape: 'triangle', offsetX: 6, offsetY: 2, size: 6, color: '#4dd0e1', alpha: 0.6 },
    ],
    [ObstacleType.SnowTree]: [
      { shape: 'rect', offsetX: 0, offsetY: 2, size: 4, h: 10, color: '#607d8b' },
      { shape: 'triangle', offsetX: 0, offsetY: -5, size: 13, color: '#b0bec5' },
      { shape: 'triangle', offsetX: 0, offsetY: -7, size: 10, color: '#cfd8dc', alpha: 0.6 },
    ],
    [ObstacleType.FrozenRock]: [
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 10, color: '#90a4ae' },
      { shape: 'circle', offsetX: -2, offsetY: -2, size: 4, color: '#cfd8dc', alpha: 0.5 },
    ],

    // ---- 火山 ----
    [ObstacleType.LavaVent]: [
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 9, color: '#d32f2f' },
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 4, color: '#ff8f00', alpha: 0.9 },
      { shape: 'circle', offsetX: 0, offsetY: -6, size: 3, color: '#ffcc02', alpha: 0.4 }, // 火星
    ],
    [ObstacleType.ScorchedTree]: [
      { shape: 'rect', offsetX: 0, offsetY: 3, size: 4, h: 10, color: '#3e2723' },
      { shape: 'triangle', offsetX: -2, offsetY: -3, size: 8, color: '#3e2723' },
      { shape: 'triangle', offsetX: 3, offsetY: -4, size: 6, color: '#4e342e' },
    ],
    [ObstacleType.VolcanicRock]: [
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 10, color: '#424242' },
      { shape: 'circle', offsetX: 2, offsetY: -2, size: 5, color: '#616161', alpha: 0.5 },
      { shape: 'triangle', offsetX: -3, offsetY: 3, size: 5, color: '#212121', alpha: 0.4 },
    ],

    // ---- 城堡 ----
    [ObstacleType.Pillar]: [
      { shape: 'rect', offsetX: 0, offsetY: 0, size: 13, h: 24, color: '#757575' },
      { shape: 'rect', offsetX: 0, offsetY: -12, size: 15, h: 4, color: '#9e9e9e' },      // 柱顶
      { shape: 'rect', offsetX: 0, offsetY: 12, size: 15, h: 4, color: '#616161' },      // 柱基
    ],
    [ObstacleType.Brazier]: [
      { shape: 'rect', offsetX: 0, offsetY: 5, size: 3, h: 14, color: '#757575' },      // 柱子
      { shape: 'diamond', offsetX: 0, offsetY: -5, size: 8, color: '#ff8f00' },             // 火焰
      { shape: 'diamond', offsetX: 0, offsetY: -4, size: 4, color: '#ffcc80', alpha: 0.8 },// 焰心
    ],
    [ObstacleType.Rubble]: [
      { shape: 'circle', offsetX: -2, offsetY: 0, size: 5, color: '#616161', alpha: 0.6 },
      { shape: 'circle', offsetX: 4, offsetY: 2, size: 6, color: '#757575', alpha: 0.6 },
      { shape: 'circle', offsetX: -1, offsetY: 3, size: 4, color: '#424242', alpha: 0.6 },
    ],
  };

  /**
   * 植物微动参数表
   */
  private static readonly SWAY_PARAMS: Partial<Record<ObstacleType, SwayParams>> = {
    [ObstacleType.Tree]: { amplitudeX: 1.5, amplitudeY: 0.5, frequency: 0.6, windMultiplier: 2.5 },
    [ObstacleType.Bush]: { amplitudeX: 1.0, amplitudeY: 0.3, frequency: 0.8, windMultiplier: 3.0 },
    [ObstacleType.Flower]: { amplitudeX: 1.5, amplitudeY: 1.0, frequency: 1.2, windMultiplier: 3.5 },
    [ObstacleType.Cactus]: { amplitudeX: 0.8, amplitudeY: 0.3, frequency: 0.5, windMultiplier: 2.0 },
    [ObstacleType.SnowTree]: { amplitudeX: 1.2, amplitudeY: 0.4, frequency: 0.5, windMultiplier: 2.0 },
    [ObstacleType.ScorchedTree]: { amplitudeX: 1.0, amplitudeY: 0.3, frequency: 0.4, windMultiplier: 2.0 },
  };

  /** 与风相关的天气类型 */
  private static readonly WIND_WEATHERS: Set<string> = new Set([
    'rain', 'night',
  ]);

  /** 强风天气（振幅更大） */
  private static readonly STRONG_WIND_WEATHERS: Set<string> = new Set([
    'rain',
  ]);

  /** 天空渐变配色 */
  static readonly SKY_COLORS: Record<string, { top: string; bottom: string }> = {
    plains: { top: '#87CEEB', bottom: '#E8F5E9' },
    desert: { top: '#FF9800', bottom: '#FFE0B2' },
    tundra: { top: '#BBDEFB', bottom: '#ECEFF1' },
    volcano: { top: '#D32F2F', bottom: '#1A0000' },
    castle: { top: '#1A237E', bottom: '#37474F' },
  };

  // ============================================================
  // Phase 3: 背景层
  // ============================================================

  /** 远景定义 */
  private static readonly DISTANT_SCENERY: Record<string, (ox: number, oy: number, mapW: number, renderer: Renderer) => void> = {
    plains: (ox, oy, mapW, r) => {
      // 远山 — 多个深浅绿色三角形叠合
      const hills = [
        { x: ox + mapW * 0.15, h: 80, w: 200, color: '#66bb6a', alpha: 0.4 },
        { x: ox + mapW * 0.40, h: 110, w: 260, color: '#43a047', alpha: 0.5 },
        { x: ox + mapW * 0.65, h: 70, w: 180, color: '#66bb6a', alpha: 0.35 },
        { x: ox + mapW * 0.85, h: 95, w: 220, color: '#388e3c', alpha: 0.45 },
      ];
      for (const h of hills) {
        r.push({ shape: 'triangle', x: h.x, y: oy, size: h.h, color: h.color, alpha: h.alpha });
        // 第二层，稍矮稍宽
        r.push({ shape: 'triangle', x: h.x - 30, y: oy + 15, size: h.h * 0.7, color: h.color, alpha: h.alpha * 0.6 });
      }
    },
    desert: (_ox, oy, mapW, r) => {
      // 沙丘 — 圆弧形叠加
      for (let i = 0; i < 4; i++) {
        const x = 300 + i * 400 + Math.sin(i * 1.3) * 60;
        const h = 40 + i * 15;
        r.push({ shape: 'circle', x, y: oy + h * 0.3, size: 180 + i * 40, color: '#ffcc80', alpha: 0.3 });
      }
    },
    tundra: (ox, oy, mapW, r) => {
      // 雪山 — 白色+浅蓝三角形
      const peaks = [
        { x: ox + mapW * 0.2, h: 120, color: '#eceff1', alpha: 0.6 },
        { x: ox + mapW * 0.45, h: 150, color: '#cfd8dc', alpha: 0.7 },
        { x: ox + mapW * 0.7, h: 100, color: '#eceff1', alpha: 0.5 },
      ];
      for (const p of peaks) {
        r.push({ shape: 'triangle', x: p.x, y: oy, size: p.h, color: p.color, alpha: p.alpha });
        // 雪顶高光
        r.push({ shape: 'triangle', x: p.x, y: oy - p.h * 0.3, size: p.h * 0.4, color: '#ffffff', alpha: 0.5 });
      }
    },
    volcano: (ox, oy, mapW, r) => {
      // 火山锥 — 暗红梯形 + 顶部橙黄发光三角
      const cx = ox + mapW / 2;
      r.push({ shape: 'triangle', x: cx, y: oy, size: 180, color: '#bf360c', alpha: 0.7 });
      r.push({ shape: 'triangle', x: cx, y: oy - 40, size: 60, color: '#ff6f00', alpha: 0.8 });
      // 烟柱
      for (let i = 0; i < 4; i++) {
        r.push({ shape: 'circle', x: cx - 10 + i * 8, y: oy - 90 - i * 25, size: 20 + i * 6, color: '#616161', alpha: 0.15 - i * 0.03 });
      }
    },
    castle: (ox, oy, mapW, r) => {
      // 城堡剪影 — 灰色矩形+锯齿城垛
      const cx = ox + mapW / 2;
      r.push({ shape: 'rect', x: cx, y: oy - 20, size: 30, h: 80, color: '#546e7a', alpha: 0.5 });
      r.push({ shape: 'rect', x: cx - 40, y: oy - 10, size: 25, h: 60, color: '#455a64', alpha: 0.45 });
      r.push({ shape: 'rect', x: cx + 40, y: oy - 15, size: 25, h: 70, color: '#455a64', alpha: 0.45 });
      // 尖塔
      r.push({ shape: 'triangle', x: cx, y: oy - 60, size: 40, color: '#78909c', alpha: 0.5 });
      r.push({ shape: 'triangle', x: cx - 40, y: oy - 40, size: 30, color: '#78909c', alpha: 0.45 });
      r.push({ shape: 'triangle', x: cx + 40, y: oy - 50, size: 35, color: '#78909c', alpha: 0.45 });
    },
  };

  /**
   * 绘制天空渐变 + 远景
   * 直接使用 Canvas 2D context 绘制渐变（命令缓冲不支持渐变）
   */
  private drawBackground(): void {
    const ctx = this.renderer.context;
    const mapW = this.map.cols * this.ts;
    const mapH = this.map.rows * this.ts;
    const theme = this.detectTheme();

    // Full-screen sky gradient (1920×1080) — covers entire canvas
    const sky = DecorationSystem.SKY_COLORS[theme] ?? DecorationSystem.SKY_COLORS['plains']!;
    const grad = ctx.createLinearGradient(0, 0, 0, 1080);
    grad.addColorStop(0, sky.top);          // pure sky at top
    grad.addColorStop(0.25, sky.top);        // sky persists through upper quarter
    grad.addColorStop(0.55, sky.bottom);     // transition to ground around map level
    grad.addColorStop(1, '#1a1a2e');        // fade to dark at screen bottom

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1920, 1080);
    ctx.restore();

    // Distant scenery — rendered via command buffer (drawn behind map tiles)
    const distantFn = DecorationSystem.DISTANT_SCENERY[theme];
    if (distantFn) {
      distantFn(this.ox, this.oy, mapW, this.renderer);
    }
  }

  /** 通过地图主题色推断当前主题 */
  private detectTheme(): string {
    const tc = this.map.tileColors;
    if (!tc) return 'plains';

    // 用空地颜色推断主题
    const emptyColor = tc.empty;
    if (emptyColor) {
      if (emptyColor === '#3a7d44' || emptyColor === '#7cb342') return 'plains';
      if (emptyColor === '#c9a96e' || emptyColor === '#e6c44d') return 'desert';
      if (emptyColor === '#cfd8dc') return 'tundra';
      if (emptyColor === '#4e342e') return 'volcano';
      if (emptyColor === '#37474f') return 'castle';
    }
    return 'plains';
  }

  /** 云朵系统 */
  private drawClouds(): void {
    // 首次初始化云朵
    if (!this.cloudsInitialized) {
      this.initClouds();
      this.cloudsInitialized = true;
    }

    const mapW = this.map.cols * this.ts;
    const skyArea = this.oy; // full sky height above map (216px)

    for (const cloud of this.clouds) {
      // 更新位置
      cloud.x += cloud.speed * (1 / 60);

      // 循环：超出右边界后从左边界重新进入
      if (cloud.x > 1920 + 150) {
        cloud.x = -150;
        cloud.y = Math.random() * skyArea * 0.7 + 10;
      }

      // 绘制云朵（多个白色椭圆叠加）
      for (const ell of cloud.ellipses) {
        this.renderer.push({
          shape: 'circle',
          x: cloud.x + ell.offsetX,
          y: cloud.y + ell.offsetY,
          size: Math.max(ell.rx, ell.ry) * 2,
          color: '#ffffff',
          alpha: cloud.alpha * (ell.rx < 30 ? 0.35 : 0.25),
        });
      }
    }
  }

  private initClouds(): void {
    const skyArea = this.oy;
    const count = 3 + Math.floor(Math.random() * 3); // 3-5 朵云

    for (let i = 0; i < count; i++) {
      const ellipsesCount = 3 + Math.floor(Math.random() * 3); // 3-5 个椭圆
      const ellipses: CloudState['ellipses'] = [];
      let totalWidth = 0;

      for (let j = 0; j < ellipsesCount; j++) {
        const rx = 25 + Math.random() * 45;
        const ry = 12 + Math.random() * 18;
        ellipses.push({
          rx,
          ry,
          offsetX: totalWidth + rx * 0.7,
          offsetY: (Math.random() - 0.5) * 15,
        });
        totalWidth += rx * 1.2;
      }

      this.clouds.push({
        x: Math.random() * 1920,
        y: Math.random() * skyArea * 0.7 + 10,
        ellipses,
        speed: 15 + Math.random() * 30, // 15-45 px/s
        alpha: 0.25 + Math.random() * 0.2, // 0.25-0.45
      });
    }
  }

  // ============================================================
  // 静态装饰物渲染
  // ============================================================

  private drawStaticDecorations(): void {
    const placements = this.map.obstaclePlacements;
    if (!placements || placements.length === 0) return;

    const weather = this.getWeather();
    const isWind = DecorationSystem.WIND_WEATHERS.has(weather);
    const isStrongWind = DecorationSystem.STRONG_WIND_WEATHERS.has(weather);

    for (const obs of placements) {
      const parts = DecorationSystem.COMPOSITE_VISUALS[obs.type];
      if (!parts || parts.length === 0) continue;

      // 基础位置（格子中心）
      const baseX = obs.col * this.ts + this.ts / 2 + this.ox;
      const baseY = obs.row * this.ts + this.ts / 2 + this.oy;

      // 植物微动偏移
      const swayParams = DecorationSystem.SWAY_PARAMS[obs.type];
      let swayX = 0;
      let swayY = 0;

      if (swayParams) {
        // 基于位置生成确定性相位偏移（每个装饰物不同）
        const phaseOffset = (obs.row * 13 + obs.col * 7) * 0.618;
        const windFactor = isWind
          ? (isStrongWind ? swayParams.windMultiplier : 1 + (swayParams.windMultiplier - 1) * 0.6)
          : 1;

        swayX = Math.sin(this.currentTime * swayParams.frequency * Math.PI * 2 + phaseOffset)
          * swayParams.amplitudeX * windFactor;
        swayY = Math.cos(this.currentTime * swayParams.frequency * 1.3 * Math.PI * 2 + phaseOffset)
          * swayParams.amplitudeY * 0.7;
      }

      // 火炬火焰脉动（Brazier 特殊处理）
      if (obs.type === ObstacleType.Brazier) {
        const flicker = Math.sin(this.currentTime * 4.5 + obs.col * 1.2) * 0.5 +
          Math.sin(this.currentTime * 7.3 + obs.row * 0.8) * 0.3 +
          Math.sin(this.currentTime * 11.1 + obs.col + obs.row) * 0.2;
        // 火焰和焰心部分的缩放
        const flameScale = 1 + flicker * 0.25;
        const brazierParts = DecorationSystem.COMPOSITE_VISUALS[obs.type]!;
        for (let i = 0; i < brazierParts.length; i++) {
          const part = brazierParts[i]!;
          const scaledSize = (i === 1 || i === 2) ? part.size * flameScale : part.size;
          this.renderer.push({
            shape: part.shape,
            x: baseX + part.offsetX,
            y: baseY + part.offsetY,
            size: scaledSize,
            h: part.h,
            color: part.color,
            alpha: part.alpha ?? 1,
            z: 1,  // decoration layer
          });
        }
        continue;
      }

      // 岩浆脉动（LavaVent 特殊处理）
      if (obs.type === ObstacleType.LavaVent) {
        const pulse = Math.sin(this.currentTime * 1.5 + obs.col * 0.7) * 0.5;
        const lavaParts = DecorationSystem.COMPOSITE_VISUALS[obs.type]!;
        for (let i = 0; i < lavaParts.length; i++) {
          const part = lavaParts[i]!;
          const size = (i === 2) ? part.size * (1 + pulse * 0.5) : part.size;  // 火星大小变化
          const alpha = (i === 2) ? (part.alpha ?? 1) * (0.5 + pulse * 0.5) : (part.alpha ?? 1);
          this.renderer.push({
            shape: part.shape,
            x: baseX + part.offsetX,
            y: baseY + part.offsetY + (i === 2 ? -pulse * 4 : 0),
            size,
            h: part.h,
            color: part.color,
            alpha,
            z: 1,  // decoration layer
          });
        }
        continue;
      }

      // 普通装饰物：绘制所有部件 + 微动偏移
      for (const part of parts) {
        this.renderer.push({
          shape: part.shape,
          x: baseX + part.offsetX + swayX,
          y: baseY + part.offsetY + swayY,
          size: part.size,
          h: part.h,
          color: part.color,
          alpha: part.alpha ?? 1,
          z: 1,  // decoration layer
        });
      }
    }
  }

  // ============================================================
  // Phase 5: 飞鸟
  // ============================================================

  private drawBirds(): void {
    if (!this.birdsInitialized) {
      this.initBirds();
      this.birdsInitialized = true;
    }

    const mapW = this.map.cols * this.ts;
    const skyMid = this.oy * 0.8;  // birds fly in upper 80% of sky area

    for (const bird of this.birds) {
      // 更新位置
      bird.x += bird.speed * (1 / 60);
      bird.phase += bird.flapSpeed * (1 / 60);

      // 循环飞出屏幕
      if (bird.x > 1920 + 60) {
        bird.x = -60;
        bird.y = 15 + Math.random() * skyMid;
      }

      // 正弦波上下浮动
      const hoverY = bird.y + Math.sin(this.currentTime * bird.hoverFreq + bird.hoverPhase) * bird.hoverAmp;

      // 翅膀角度（正弦波循环）
      const wingAngle = Math.sin(bird.phase * Math.PI * 2) * 40;
      const wingOpen = 30 + wingAngle;  // 30°-70°

      // 身体（小圆）
      this.renderer.push({
        shape: 'circle',
        x: bird.x,
        y: hoverY,
        size: bird.size * 0.6,
        color: bird.color,
        alpha: 0.85,
      });

      // 左翅
      this.renderer.push({
        shape: 'triangle',
        x: bird.x - Math.cos(wingOpen * Math.PI / 180) * bird.size * 0.5,
        y: hoverY - Math.sin(wingOpen * Math.PI / 180) * bird.size * 0.5,
        size: bird.size * 0.7,
        color: bird.color,
        alpha: 0.7,
      });

      // 右翅
      this.renderer.push({
        shape: 'triangle',
        x: bird.x + Math.cos(wingOpen * Math.PI / 180) * bird.size * 0.5,
        y: hoverY - Math.sin(wingOpen * Math.PI / 180) * bird.size * 0.5,
        size: bird.size * 0.7,
        color: bird.color,
        alpha: 0.7,
      });
    }
  }

  private initBirds(): void {
    const skyMid = this.oy * 0.6;

    // 所有主题统一使用白色飞鸟
    const colors = ['#37474f', '#455a64', '#546e7a', '#263238'];

    // 根据关卡主题选择鸟的颜色
    const theme = this.detectTheme();
    let birdColors: string[];
    if (theme === 'desert') {
      birdColors = ['#5d4037', '#6d4c41', '#4e342e'];
    } else if (theme === 'tundra') {
      birdColors = ['#90a4ae', '#78909c', '#b0bec5'];
    } else if (theme === 'volcano') {
      birdColors = ['#212121', '#424242', '#37474f'];
    } else {
      birdColors = colors;
    }
    
    const count = 3 + Math.floor(Math.random() * 3); // 3-5 只鸟

    for (let i = 0; i < count; i++) {
      this.birds.push({
        x: Math.random() * 1920,
        y: 15 + Math.random() * skyMid,
        size: 7 + Math.random() * 7,              // 7-14px（放大）
        speed: 30 + Math.random() * 50,       // 30-80 px/s
        flapSpeed: 3 + Math.random() * 3,     // 3-6 Hz
        phase: Math.random() * 2,
        hoverFreq: 0.3 + Math.random() * 0.5,
        hoverPhase: Math.random() * Math.PI * 2,
        hoverAmp: 5 + Math.random() * 10,
        color: birdColors[Math.floor(Math.random() * birdColors.length)]!,
      });
    }
  }

  // ============================================================
  // Phase 5: 草丛叶片
  // ============================================================

  /**
   * 在灌木和树附近绘制微动的小草叶片
   */
  private drawGrassBlades(): void {
    const placements = this.map.obstaclePlacements;
    if (!placements || placements.length === 0) return;

    const weather = this.getWeather();
    const isWind = DecorationSystem.WIND_WEATHERS.has(weather);
    const isStrongWind = DecorationSystem.STRONG_WIND_WEATHERS.has(weather);
    const windFactor = isWind ? (isStrongWind ? 2.5 : 1.5) : 1;

    for (const obs of placements) {
      // 只在有植物的装饰物旁边画草
      const isPlant =
        obs.type === ObstacleType.Tree ||
        obs.type === ObstacleType.Bush ||
        obs.type === ObstacleType.Flower ||
        obs.type === ObstacleType.Cactus ||
        obs.type === ObstacleType.SnowTree ||
        obs.type === ObstacleType.ScorchedTree;

      if (!isPlant) continue;

      const baseX = obs.col * this.ts + this.ts / 2 + this.ox;
      const baseY = obs.row * this.ts + this.ts / 2 + this.oy;

      // 每株植物周围画 3-5 片草叶
      const bladeCount = 3 + (obs.row + obs.col) % 3; // 3-5 片
      const radius = 8 + (obs.type === ObstacleType.Tree ? 4 : 0);

      for (let i = 0; i < bladeCount; i++) {
        const angle = (i / bladeCount) * Math.PI * 2 + (obs.row * 0.7);
        const bladeX = baseX + Math.cos(angle) * radius;
        const bladeY = baseY + Math.sin(angle) * radius + 3; // 底部

        // 基于位置生成确定性相位
        const phaseOffset = obs.row * 17 + obs.col * 11 + i * 7;
        const freq = 1.2 + (i % 3) * 0.4; // 1.2-2.0 Hz
        const sway = Math.sin(this.currentTime * freq * Math.PI * 2 + phaseOffset * 0.1)
          * 2.0 * windFactor;

        // 草叶：向上的小三角形，会随风摇摆
        const bladeHeight = 5 + (i % 3) * 2;
        this.renderer.push({
          shape: 'triangle',
          x: bladeX + sway,
          y: bladeY - bladeHeight / 2,
          size: bladeHeight,
          color: '#66bb6a',
          alpha: 0.5 + (i % 3) * 0.15,
        });
      }
    }
  }
}
