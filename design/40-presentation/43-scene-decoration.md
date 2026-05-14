---
title: 场景表现增强
status: stable
version: 1.0.0
last-modified: 2026-05-14
authority-for:
  - scene-decoration
supersedes: []
cross-refs:
  - 40-presentation/42-art-assets.md
  - 40-presentation/45-layer-system.md
---

# 场景表现增强

> 动态环境生物 + 全屏环境特效 | 纯视觉装饰层 | 不影响游戏逻辑

---

## 1. 概述

### 1.1 背景与动机

当前（v1.0）场景中仅有静态障碍物（树/岩石等）作为装饰，它们以单一几何原语渲染（一个绿色三角形 = 一棵树），无动画、无背景层、无环境氛围。场景显得"僵硬"，缺少生命力。

本文档设计**4类场景表现增强**，目标是让场景"活起来"：

| 类别 | 说明 | 是否游戏实体 |
|------|------|-------------|
| **静态装饰物增强** | 在现有 `ObstacleType` 基础上，将单形状升级为复合几何体 + 微动动画 | 否（纯视觉） |
| **动态环境生物** | 飞鸟、地面小动物、草丛微动 | 否（纯视觉，不参与碰撞/伤害） |
| **全屏环境特效** | 风线、阳光射线、云阴影飘移、河流/水面效果 | 否（全屏叠加） |
| **天气粒子增强** | 在现有天气系统基础上，补充风、热浪等视觉粒子 | 否（扩展天气层） |

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **纯视觉，零逻辑影响** | 装饰物不参与碰撞检测、不占用网格、不被攻击、不影响寻路 |
| **性能优先** | 装饰系统帧预算 ≤ 2ms，低端设备自动降级 |
| **主题绑定** | 每类装饰有明确主题归属，随关卡主题自动切换 |
| **配置驱动** | 装饰物的位置、数量、类型从关卡配置中读取，支持随机化 |
| **符号优于文字** | 装饰不显示文字标签，纯形状+动效表达 |
| **渐进可降级** | 设计"完整版"和"降级版"两档，Canvas 2D 用降级版，PixiJS 后升级 |

### 1.3 与现有文档的关系

| 文档 | 关系 |
|------|------|
| **07-map-level-system.md** §6 | 现有静态装饰物列表（树、灌木、岩石等），本文在此基础上增强 |
| **11-weather-system.md** §4 | 现有天气粒子（雨/雪/雾/夜晚），本文补充风效、热浪、云影 |
| **12-visual-effects.md** §2 | 现有 7 层渲染架构，本文扩展装饰层和背景层 |
| **15-refactoring-plan.md** | PixiJS 迁移路线，本文提供 Canvas 2D 降级实现 + PixiJS 升级路径 |
| **16-art-assets-design.md** §2 | v2.0 11 层架构中的 Layer 0（BackgroundLayer）和 Layer 2（DecorationLayer），本文细化实现细节 |

---

## 2. 渲染层扩展

### 2.1 当前 vs 目标

```
当前 (v1.0)                          目标 (v1.5 / v2.0)

Canvas 2D 单层渲染                  多层逻辑渲染
┌──────────────┐                    ┌──────────────────┐
│              │                    │ ScreenFXLayer    │ ← 全屏后处理（风/光/云影）
│  所有内容     │                    ├──────────────────┤
│  混在一起     │                    │ EffectLayer      │ ← 粒子层（天气/爆炸/金币）
│  绘制        │                    ├──────────────────┤
│              │                    │ EntityLayer      │ ← 游戏实体（按Y排序）
└──────────────┘                    ├──────────────────┤
                                    │ DecorationLayer  │ ← ★ 动态装饰物（植物/动物）
                                    ├──────────────────┤
                                    │ GroundLayer      │ ← 地图网格+路径+静态障碍物
                                    ├──────────────────┤
                                    │ BackgroundLayer  │ ← ★ 天空渐变+远景
                                    └──────────────────┘
```

### 2.2 Canvas 2D 实现策略

在 PixiJS 迁移之前，通过**渲染命令分层**模拟多层效果：

```
beginFrame()
  ↓
[DecorationSystem.update]  → push 背景层命令 + 装饰物命令（按Y插入实体间）
  ↓
[RenderSystem.update]      → push 地图 + 实体命令
  ↓
[WeatherSystem]            → push 天气粒子命令
  ↓
endFrame()                 → 按序绘制所有命令
  ↓
onPostRender()             → 全屏叠加（云影/光效/暗角）
```

**关键变更**：
- 新增 `DecorationSystem`（注册在 RenderSystem 之前），处理背景层 + 动态装饰物
- 新增 `ScreenFXSystem`（onPostRender 中执行），处理全屏后处理效果

---

## 3. 分类设计

### 3.1 静态装饰物增强（Static Decoration Enhancement）

#### 现状

```typescript
// RenderSystem.ts 当前实现
OBSTACLE_VISUALS[ObstacleType.Tree] = { shape: 'triangle', color: '#2e7d32', size: 14 };
// → 一个简单的绿色三角形
```

#### 目标：复合几何体

每个装饰物由 **2-5 个几何原语** 组合而成：

| 装饰物 | 组合方案 |
|--------|----------|
| **树** | 棕色矩形（树干 4×10）+ 深绿三角形（树冠 14px）+ 浅绿三角形（高光层 10px，偏移 -2px） |
| **灌木** | 2-3 个不同大小的深绿/浅绿圆形，随机偏移 ±3px 叠加 |
| **花** | 粉色小圆（花心 4px）+ 3-5 个更小粉圆（花瓣，围绕花心 120° 均匀分布） |
| **岩石** | 深灰菱形（主体 12px）+ 浅灰小三角（高光 5px，偏移左上） |
| **仙人掌** | 绿色矩形（主干）+ 2 个绿色小矩形（侧臂，45° 角） |
| **冰晶** | 浅蓝菱形（主体 11px）+ 白色小菱形（核心高光 5px）+ 2 个浅蓝小三角（侧晶） |
| **火炬台** | 灰色细矩形（柱子 3×14）+ 橙色菱形（火焰 8px）+ 黄色小菱形（焰心 4px） |

#### 实现方式

```typescript
// 方案 A：继续用 RenderCommand（Canvas 2D 当前方案）
// 在 drawMap() 中，对每个 obstacle 推多个命令而非一个

// 方案 B：使用 PixiJS Graphics（v2.0 升级后）
// 每个装饰物 = 一个 Graphics 对象，构建一次，脏标记触发重绘
```

**每帧行为**：静态装饰物创建后不逐帧重绘（脏标记策略），仅在以下情况重绘：
- 首次创建
- 天气切换（色调变化时）
- 随机微动（见 §3.4）

---

### 3.2 动态环境生物（Dynamic Ambient Life）

此类元素是**有自主"行为"的纯视觉单位**，与游戏逻辑完全解耦。使用 ECS 实体承载（需要少数组件），但**不参与碰撞检测、不占用网格、不被攻击**。

#### 3.2.1 数据结构

```typescript
// 新增组件（core/components.ts）
export const AmbientCreature = defineComponent({
  creatureType: Types.ui8,     // AmbientCreatureType 枚举
  animPhase: Types.f32,        // 动画相位 (0-1, 用于正弦波循环)
  animSpeed: Types.f32,        // 动画速度倍率
  pathIndex: Types.ui8,        // 当前路径点索引
  pathProgress: Types.f32,     // 路径进度 (0-1)
  flipTimer: Types.f32,        // 随机转向计时器
  state: Types.ui8,            // 状态: 0=idle, 1=walking, 2=flying
});

// 新增枚举（types/index.ts）
export enum AmbientCreatureType {
  Bird = 0,            // 小鸟
  Butterfly = 1,       // 蝴蝶
  Squirrel = 2,        // 松鼠（平原）
  Lizard = 3,          // 蜥蜴（沙漠）
  Penguin = 4,         // 企鹅（冰原）
  Firefly = 5,         // 萤火虫（火山/夜晚）
  Rat = 6,             // 老鼠（城堡）
  // 通用
  GrassBlade = 10,     // 草丛叶片（微动）
  FloatingDust = 11,   // 漂浮尘埃/花粉
}
```

#### 3.2.2 飞鸟

| 属性 | 值 |
|------|-----|
| **形状** | 简化的 V 形（2 条短线相交于中心）+ 小三角头 |
| **大小** | 8-14px 翼展 |
| **颜色** | `#ffffff`（白色，所有主题统一） |
| **数量** | 2-5 只/场景，随机 |
| **运动** | 沿贝塞尔曲线飞行路径，翅膀正弦拍动（频率 3-5 Hz） |
| **行为** | 循环路径飞行：从左到右 → 飞出后从另一侧重新进入 → 随机改变高度 |
| **层** | 在实体层之上（LayerVal.LowAir） |

**动画分解**：

```
翅膀拍动周期（1 个完整周期 = 2 次拍动/秒）：
  帧 0-25%:  翅膀展开（↑）→ 身体微升 +2px
  帧 25-50%: 翅膀收起（↓）→ 身体微降 -2px
  帧 50-75%: 翅膀展开（↑）→ 身体微升 +2px
  帧 75-100%:翅膀收起（↓）→ 身体微降 -2px

形状变化：翅膀角度从 30°（收起）到 120°（展开）正弦循环
```

**渲染实现**（Canvas 2D）：
```typescript
// 每帧推 3 个命令：身体（小圆）+ 左翅（短线段）+ 右翅（短线段）
// 翅膀角度 = 30 + Math.sin(animPhase * Math.PI * 2) * 45
```

#### 3.2.3 地面小动物

| 属性 | 值 |
|------|-----|
| **形状** | 椭圆身体 + 小圆头 + 4 条短线腿 |
| **大小** | 8-14px |
| **运动** | 沿预定义"兽径"（装饰路径）移动，速度 30-60 px/s |
| **行为** | 沿兽径来回走动，随机停顿 1-3s（idle 时身体微微上下浮动） |
| **出现概率** | 每波结束时 15-30% 概率刷新一只（现有动物死亡/离开后） |

**各主题对应动物**：

| 主题 | 动物 | 颜色 | 运动特征 |
|------|------|------|----------|
| 平原 | 松鼠 | `#8d6e63` | 快速小跑，停顿频繁 |
| 沙漠 | 蜥蜴 | `#a1887f` | 贴地爬行，偶尔急速冲刺 |
| 冰原 | 小企鹅 | `#263238` | 摇摆行走，缓慢 |
| 火山 | 火鼠 | `#ff5722` | 快速穿梭，身后拖火星粒子 |
| 城堡 | 老鼠 | `#616161` | 沿墙根快速移动，警惕停顿 |

**兽径定义**：

```typescript
// MapConfig 新增字段
interface MapConfig {
  // ...existing...
  /** 动态生物的预设活动路径（不在敌人路径上） */
  creaturePaths?: CreaturePath[];
}

interface CreaturePath {
  type: AmbientCreatureType;        // 路径上出现的生物类型
  waypoints: { x: number; y: number }[];  // 路径点序列（像素坐标，非网格坐标）
  loop: boolean;                     // true = 循环路径, false = 来回
}
```

#### 3.2.4 草丛微动

**不是独立实体**，而是对现有 `ObstacleType.Bush` / `ObstacleType.Flower` 的增强。

| 属性 | 值 |
|------|-----|
| **效果** | 装饰物的位置和大小随正弦波轻微振荡 |
| **幅度** | 水平 ±1-2px，垂直 ±0.5px，缩放 ±3% |
| **频率** | 0.5-1.5 Hz（每株随机，避免整齐划一） |
| **触发条件** | 有风天气（晴天微风/下雨/夜晚）时振幅加倍 |

**实现**：在 `DecorationSystem.update()` 中，遍历所有 `ObstaclePlacement`，用 `Date.now()` 计算每株的相位偏移，修改渲染命令的 x/y/size 参数。

---

### 3.3 全屏环境特效（Full-Screen Environmental Effects）

这一类效果通过**全屏叠加绘制**实现，在 `onPostRender` 阶段（所有实体绘制完成后）执行。

#### 3.3.1 风的视觉表现

| 属性 | 值 |
|------|-----|
| **效果** | 半透明白色细线（2-4px 粗，alpha 0.03-0.08）从左侧向右扫过全屏 |
| **数量** | 3-8 条风线同时存在 |
| **速度** | 200-500 px/s（水平），叠加微小的正弦波垂直偏移 |
| **长度** | 屏幕宽度的 30-70%，随机 |
| **触发** | 有风天气（Rain/Night）密度翻倍，无风天气（Sunny/Snow/Fog）仅 1-2 条 |

**另一种风的表达**：

| 效果 | 说明 |
|------|------|
| **植物摇摆** | 所有植物沿风向倾斜（见 §3.4） |
| **地面尘土** | 小圆点粒子贴着地面向右漂移（alpha 0.1-0.2，2-4px） |
| **尘埃粒子** | 在阳光下可见的漂浮尘埃（见 §3.4.1） |

#### 3.3.2 阳光效果

| 属性 | 值 |
|------|-----|
| **表现形式** | 从画面左上角斜射下来的半透明光束 |
| **颜色** | `#fff9c4`（暖金色），alpha 0.03-0.08 |
| **形状** | 3-5 条从左上 (0,0) 出发的三角形/梯形光束 |
| **宽度** | 每条光束 80-200px 宽（底部） |
| **动画** | 光束 alpha 缓慢呼吸（0.03→0.08→0.03，周期 4-6 秒），轻微横向偏移 ±5px |

**实现代码示例**（Canvas 2D，onPostRender）：

```typescript
// 伪代码
function drawSunRays(ctx: CanvasRenderingContext2D, time: number): void {
  const rays = [
    { angle: -30, width: 120 },
    { angle: -15, width: 80 },
    { angle: 0,   width: 160 },
    { angle: 15,  width: 100 },
    { angle: 30,  width: 90 },
  ];
  const alpha = 0.03 + Math.sin(time * 0.4) * 0.025;
  for (const ray of rays) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff9c4';
    ctx.beginPath();
    const rad = (ray.angle * Math.PI) / 180;
    const topX = 0 + Math.cos(rad) * 300;
    const bottomX = 1920 * 0.7 + Math.cos(rad) * 300;
    ctx.moveTo(topX, 0);
    ctx.lineTo(bottomX + ray.width, 1080);
    ctx.lineTo(bottomX - ray.width, 1080);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
```

**触发条件**：仅在晴天（Sunny）和非夜晚天气下显示。

#### 3.3.3 云与阴影

| 属性 | 值 |
|------|-----|
| **云** | 白色椭圆叠加组成的云朵，在天空区域缓慢漂浮（20-40 px/s） |
| **大小** | 60-200px 宽，3-6 个椭圆叠加 |
| **数量** | 2-4 朵同时可见 |
| **运动** | 从左向右漂移，到达右边界后从左边界重新进入（随机 Y 位置） |
| **阴影** | 云朵在地面上的投影：暗色半透明椭圆（alpha 0.05-0.12），比云朵滞后 80-120px（模拟光源角度），尺寸比云朵大 20% |

**云阴影的视觉冲击**：

> 当大片云朵的阴影扫过地图时，地面突然变暗再慢慢恢复，给玩家一种"天光流转"的感觉，非常提升沉浸感。

**实现**：云朵在 BackgroundLayer 中渲染（白色半透明椭圆），阴影在地面区域渲染（暗色半透明矩形/椭圆）。

#### 3.3.4 水面/河流效果

| 属性 | 值 |
|------|-----|
| **适用关卡** | 未来有河流/水面 tile 的关卡（目前 L4 火山可添加岩浆河） |
| **效果类型** | 水平细线周期波动（模仿水面反光） |
| **颜色** | 白色/浅蓝（水面）/ 橙黄（岩浆），alpha 0.1-0.3 |
| **动画** | 正弦波位移：水平线上下波动 ±3-6px |

**岩浆河特殊效果**：

| 效果 | 描述 |
|------|------|
| **脉动发光** | 岩浆 tile 颜色在 `#ff3d00` ↔ `#ff6e40` 之间正弦波循环 |
| **气泡粒子** | 橙色圆点从岩浆表面上升，渐隐消失 |
| **热浪扭曲** | 岩浆上方空气区域叠加半透明波浪形条纹 |

---

### 3.4 微环境动画（Micro-Environment Animation）

增强现有静态装饰物的"呼吸感"。

#### 3.4.1 植物微动系统

**统一参数模型**：

```typescript
interface SwayParams {
  amplitudeX: number;    // 水平摆动幅度 (px)
  amplitudeY: number;    // 垂直摆动幅度 (px)
  frequency: number;     // 摆动频率 (Hz)
  phaseOffset: number;   // 相位偏移（随机，避免整齐划一）
  windMultiplier: number;// 风天振幅倍率
}
```

| 装饰物 | amplitudeX | amplitudeY | frequency | windMultiplier |
|--------|-----------|-----------|-----------|----------------|
| 树 | 1.5px | 0.5px | 0.6 Hz | 2.5× |
| 灌木 | 1.0px | 0.3px | 0.8 Hz | 3.0× |
| 花 | 1.5px | 1.0px | 1.2 Hz | 3.5× |
| 草 | 2.0px | 0.5px | 1.5 Hz | 4.0× |

**实现**：在 `DecorationSystem.update()` 中：

```typescript
for (const obs of obstacles) {
  const sway = obs.swayParams;
  const t = performance.now() / 1000;
  const offsetX = Math.sin(t * sway.frequency * Math.PI * 2 + sway.phaseOffset)
                  * sway.amplitudeX * (1 + hasWind ? sway.windMultiplier - 1 : 0);
  const offsetY = Math.cos(t * sway.frequency * 1.3 * Math.PI * 2 + sway.phaseOffset)
                  * sway.amplitudeY;
  // 修改此装饰物的渲染命令位置...
}
```

#### 3.4.2 火炬/光源微动

| 效果 | 说明 |
|------|------|
| **火炬火焰** | 火焰菱形大小以 3-5 Hz 随机脉动（±20% 尺寸），颜色在橙色↔黄色之间微变 |
| **环境光晕** | 火炬周围 30-40px 半径的半透明橙色光晕，alpha 0.05-0.1，缓慢脉动 |

#### 3.4.3 岩浆/热浪效果

| 效果 | 说明 |
|------|------|
| **熔岩脉动** | `ObstacleType.LavaVent` 颜色从 `#ff3d00` 脉动到 `#ff9800`（频率 1.5 Hz） |
| **上升烟柱** | 从 LavaVent 位置向上飘出 3-5 个灰色半透明小圆点（同爆炸粒子原理） |

---

## 4. 全屏后期特效（后处理模拟）

由于 Canvas 2D 不支持真正的 shader 后处理，本节设计**模拟后处理效果**的方案。

### 4.1 暗角效果（Vignette）

| 属性 | 值 |
|------|-----|
| **效果** | 屏幕四角向中心渐变变暗 |
| **颜色** | `rgba(0, 0, 0, 0.15)` 到透明 |
| **形状** | 四个角各一个径向渐变暗色矩形 |
| **触发** | 始终开启（夜晚/雾天 alpha 翻倍） |

**Canvas 2D 实现**：手动创建 `createRadialGradient` 绘制四个角。

### 4.2 画面色调滤镜

| 天气 | 色调叠加 | Alpha |
|------|----------|-------|
| 晴天 | `rgba(255, 249, 196, ...)` 暖金色 | 0.03 |
| 下雨 | `rgba(100, 130, 180, ...)` 冷蓝灰 | 0.08 |
| 下雪 | `rgba(200, 210, 230, ...)` 冷白 | 0.10 |
| 下雾 | `rgba(180, 180, 180, ...)` 中性灰 | 0.12 |
| 夜晚 | `rgba(10, 10, 50, ...)` 深蓝黑 | 0.18 |

> **注意**：WeatherSystem 已有 `screenTint` 全屏叠加（见 `src/systems/WeatherSystem.ts`），此处仅为微调优化。

### 4.3 镜头呼吸

| 属性 | 值 |
|------|-----|
| **效果** | 整个场景有非常微小的周期性缩放/偏移（模拟手持镜头） |
| **幅度** | scale 0.995-1.005，偏移 ±2px |
| **周期** | 8-12 秒 |
| **触发** | 仅在晴天或有风天气（给静止场景一点"温度"） |

---

## 5. 技术实现方案

### 5.1 Canvas 2D 方案（当前可用）

#### 5.1.1 新增系统

```typescript
// src/systems/DecorationSystem.ts
export class DecorationSystem implements System {
  readonly name = 'DecorationSystem';
  // 注册顺序：在 RenderSystem 之前，MovementSystem 之后

  update(world: TowerWorld, dt: number): void {
    // 1. 绘制背景层（天空渐变 + 远景）
    this.drawBackground();
    // 2. 绘制静态装饰物（复合几何体 + 微动）
    this.drawStaticDecorations(dt);
    // 3. 更新动态生物
    this.updateCreatures(world, dt);
    // 4. 绘制动态生物
    this.drawCreatures(world);
  }
}

// src/systems/ScreenFXSystem.ts
export class ScreenFXSystem {
  // 在 onPostRender 中调用
  render(ctx: CanvasRenderingContext2D, time: number, weather: WeatherType): void {
    this.drawSunRays(ctx, time, weather);
    this.drawCloudShadows(ctx, time);
    this.drawWindLines(ctx, time, weather);
    this.drawVignette(ctx, weather);
  }
}
```

#### 5.1.2 系统注册顺序

```
src/main.ts — 系统管线更新为：

1-16  现有系统（不变）
17     DecorationSystem    ← 新增（在 RenderSystem 之前）
18     RenderSystem        ← 现有（地图+实体）
19     UISystem            ← 现有

onPostRender 中：
  现有: lightningBolts → laserBeams → weatherTint → UI
  新增: ScreenFX.render()    ← 在 weatherTint 之后、UI 之前
```

#### 5.1.3 组件扩展

```typescript
// core/components.ts 新增

// 动态环境生物组件
export const AmbientCreature = defineComponent({
  creatureType: Types.ui8,     // AmbientCreatureType
  animPhase: Types.f32,
  animSpeed: Types.f32,
  pathIndex: Types.ui8,
  pathProgress: Types.f32,
  state: Types.ui8,
  nextWaypointX: Types.f32,
  nextWaypointY: Types.f32,
});

// 呼吸/微动参数组件（挂载到装饰物实体上）
export const SwayAnimation = defineComponent({
  amplitudeX: Types.f32,
  amplitudeY: Types.f32,
  frequency: Types.f32,
  phaseOffset: Types.f32,
  windMultiplier: Types.f32,
});
```

#### 5.1.4 性能预算

| 子系统 | 预估开销 | 说明 |
|--------|----------|------|
| 背景层绘制 | ~0.3ms | 渐变 + 2-4 朵云（每朵 5 个椭圆） |
| 静态装饰物微动 | ~0.2ms | 20-40 个 obstacle，每个仅修改 x/y 偏移 |
| 飞鸟 (3只) | ~0.1ms | 每只 3 个形状 + 正弦计算 |
| 地面动物 (2只) | ~0.15ms | 每只 5-8 个形状 |
| 风线 | ~0.1ms | 6 条半透明线 |
| 阳光射线 | ~0.15ms | 5 条三角形光束 |
| 云阴影 | ~0.1ms | 2-4 个半透明椭圆 |
| 暗角 | ~0.2ms | 4 个径向渐变 |
| **总计** | **~1.3ms** | 在 16.6ms (60fps) 预算内占比 < 8% |

### 5.2 PixiJS 升级路径（v2.0 后）

迁移到 PixiJS 后，装饰系统获得以下优势：

| 优势 | 说明 |
|------|------|
| `ParticleContainer` | 管理草/花粒子，支持 500+ 草叶同时摆动 |
| `Graphics` 缓存 | 装饰物复合几何体创建一次，存入纹理缓存（`generateCanvasTexture()`） |
| `filters` | 真正的模糊/发光/颜色矩阵滤镜（暗角、光晕、模糊阴影） |
| `Container` 层级 | 自然的多层排序，无需手动管理渲染命令顺序 |
| `Ticker` | 与游戏循环对齐的动画驱动 |

**迁移步骤**：

1. 将 `DecorationSystem.drawBackground()` 迁移为 Layer 0 Graphics
2. 将 `DecorationSystem.drawStaticDecorations()` 迁移为 Layer 2 Graphics（纹理缓存 + 脏标记）
3. 将飞鸟/动物迁移为 Layer 4 的 ParticleContainer 或逐帧 Graphics
4. 将 `ScreenFXSystem` 替换为 PixiJS filters（`ColorMatrixFilter` + `BlurFilter`）

---

## 6. 关卡主题配置

### 6.1 扩展 MapConfig

```typescript
// types/index.ts 扩展

interface MapConfig {
  // ...existing...
  /** 动态环境生物配置 */
  ambientCreatures?: AmbientCreatureConfig;
  /** 环境特效开关 */
  environmentFX?: EnvironmentFXConfig;
  /** 生物活动路径 */
  creaturePaths?: CreaturePath[];
}

interface AmbientCreatureConfig {
  birds: { min: number; max: number };          // 飞鸟数量范围
  groundAnimals: {                                // 地面动物
    types: AmbientCreatureType[];                 // 可能的动物类型
    count: number;                                // 同时存在的最大数量
    spawnChance: number;                          // 每波刷新概率 (0-1)
  };
  grassBlades: { enabled: boolean; density: number }; // 草丛密度 (0-1)
  floatingDust: { enabled: boolean };             // 漂浮尘埃
}

interface EnvironmentFXConfig {
  sunRays: boolean;        // 阳光射线
  cloudShadows: boolean;   // 云阴影
  windLines: boolean;      // 风线
  vignette: boolean;       // 暗角
  heatShimmer: boolean;    // 热浪（火山）
  waterShimmer: boolean;   // 水面波光
  cameraBreathing: boolean;// 镜头呼吸
}
```

### 6.2 各关卡推荐配置

| 配置项 | L1 平原 | L2 沙漠 | L3 冰原 | L4 火山 | L5 城堡 |
|--------|---------|---------|---------|---------|---------|
| **飞鸟** | 3-5 只 | 1-2 只 | 0-1 只 | 1-2 只 | 2-3 只 |
| **地面动物** | 松鼠 2只 | 蜥蜴 2只 | 企鹅 1只 | 火鼠 1只 | 老鼠 2只 |
| **草丛密度** | 0.8 | 0.2 | 0.1 | 0.05 | 0.1 |
| **阳光射线** | ✅ | ✅ | ⬜ (减少) | ❌ | ❌ |
| **云阴影** | ✅ | ✅ | ✅ | ❌ (烟柱代替) | ✅ |
| **风线** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **暗角** | ⬜ | ✅ | ✅ | ✅ | ✅ |
| **热浪** | ❌ | ⬜ | ❌ | ✅ | ❌ |
| **镜头呼吸** | ✅ | ✅ | ❌ | ❌ | ❌ |

> ✅ = 开启，⬜ = 减弱版（减少数量/降低 alpha），❌ = 关闭

---

## 7. 降级策略

当检测到帧率低于 45fps 时，自动降级：

| 降级级别 | 触发条件 | 关闭的效果 |
|----------|----------|-----------|
| **Level 0**（完整） | ≥ 55fps | 全部开启 |
| **Level 1**（轻微） | 45-55fps | 关闭云阴影、暗角、镜头呼吸 |
| **Level 2**（中度） | 35-45fps | 关闭阳光射线、地面动物、风线 |
| **Level 3**（最小） | < 35fps | 仅保留静态装饰物（无微动），关闭所有动态效果 |

```typescript
// Game.ts 或 DecorationSystem.ts
private checkPerformanceBudget(averageFPS: number): PerfLevel {
  if (averageFPS >= 55) return PerfLevel.Full;
  if (averageFPS >= 45) return PerfLevel.Light;
  if (averageFPS >= 35) return PerfLevel.Medium;
  return PerfLevel.Minimal;
}
```

---

## 7.5 装饰物边界铁律（P3-#22/#27 修复）

> **核心原则：装饰物是纯视觉层，绝对不影响游戏逻辑。**
>
> 此规则为 ZERO TOLERANCE。任何违反都视为 BUG，必须修复。

### 7.5.1 装饰物 vs 游戏实体的分离

| 维度 | 装饰物（Decoration） | 游戏实体（GameObject） |
|------|---------------------|------------------------|
| **存储位置** | `DecorationSystem` 内部 pool，不进 World 实体 | `World` ECS 实体 |
| **碰撞检测** | ✗ 永远不参与 | ✓ 参与攻击/寻路/部署判定 |
| **寻路影响** | ✗ 永远不阻挡 | 视实体类型（路障/塔/敌人会） |
| **被攻击** | ✗ 永远不可被选为目标 | ✓ 可被锁定 |
| **触发陷阱** | ✗ 永远不会 | 视层级（地面敌会触发地刺） |
| **被技能/AOE 命中** | ✗ 不消耗贯穿/弹跳次数 | ✓ 计入 |
| **遮挡战斗信息** | ✗ 必须避让（详见 §7.5.3） | — |
| **存档持久化** | ✗ 仅保存随机种子，不保存实例 | ✓ 完整持久化 |

### 7.5.2 实现层强约束

**装饰物绝不能持有以下组件**：
- ❌ `Health` / `Armor` / `Damage`
- ❌ `Collider` / `Hitbox`
- ❌ `PathBlock` / `Buildable`
- ❌ `Attackable` / `Targetable`
- ❌ `LayerTag`（不参与 18-layer 的层级判定）

**装饰物只能持有以下组件**：
- ✅ `Position`（仅渲染坐标）
- ✅ `Render`（视觉属性）
- ✅ `SwayAnimation` / `AmbientCreature`（动画参数）
- ✅ `DecorationLifetime`（生灭管理）

### 7.5.3 战斗信息避让规则

装饰物的渲染区域必须避让以下"信息热区"：

| 信息类型 | 避让方式 |
|----------|----------|
| **敌人头顶血条** | 装饰物 z 序低于实体血条层 |
| **塔射程预览圈** | 装饰物 z 序低于 UI 预览层 |
| **弹道轨迹** | 装饰物半透明（alpha ≤ 0.7），不遮挡子弹 |
| **建筑选中高亮** | 选中态下，建筑周围 80px 范围装饰物 alpha 降至 0.4 |
| **基地 HP 危险特效** | 基地 200px 范围内禁止生成新装饰物 |
| **技能指示器** | 技能瞄准期间，技能范围内装饰物 alpha 降至 0.3 |

### 7.5.4 视口与裁剪

- 视口外 100px 范围内不渲染装饰物
- 视口外 200px 范围内不更新动画
- 离开视口超过 5 秒的动态生物销毁实例（节省内存）

### 7.5.5 关卡引导的装饰物豁免（P3-#22 修复）

新手引导阶段（首次进入 L1）的特殊规则：

- **首关引导期**：禁用所有动态装饰物（飞鸟/地面动物/风线/阳光），避免干扰玩家学习核心机制
- **引导高亮期**：当 UI 引导箭头指向地图位置时，箭头方向 200px 范围内装饰物 alpha 降至 0.2
- **建造教学期**：教学指引格周围 120px 范围内不渲染任何装饰物（确保格子轮廓清晰）
- **首次胜利后**：装饰物逐步淡入（fadeIn 2 秒）

### 7.5.6 规则验证测试用例

`decoration.test.ts` 必须覆盖：
- [ ] 装饰物实体不出现在 `World.query()` 任何游戏组件查询中
- [ ] 子弹射线穿过装饰物位置，不消耗贯穿/弹跳
- [ ] 地刺陷阱在装饰物上方时，飞行敌经过仍正常豁免
- [ ] 塔的目标选择算法忽略装饰物
- [ ] 建造预览的"可放置"判定与装饰物无关
- [ ] 寻路系统 A* 图中无装饰物节点
- [ ] 装饰物在战斗中被 AOE 命中不掉血/不消失
- [ ] 引导期装饰物 alpha 衰减生效

---

## 8. 实现优先级与路线图

### 阶段 1：基础框架（1-2 天）

| # | 任务 | 产出 |
|---|------|------|
| 1.1 | 新增 `AmbientCreature`、`SwayAnimation` 组件 | `core/components.ts` |
| 1.2 | 创建 `DecorationSystem` 骨架（注册 + 空 update） | `systems/DecorationSystem.ts` |
| 1.3 | 创建 `ScreenFXSystem` 骨架 | `systems/ScreenFXSystem.ts` |
| 1.4 | 在 `main.ts` 中注册新系统，调整管线顺序 | `main.ts` |
| 1.5 | 扩展 `MapConfig` 类型（添加 `ambientCreatures` / `environmentFX`） | `types/index.ts` |

**验收**：新系统注册无误，不破坏现有渲染，装饰物仍正常显示。

### 阶段 2：静态装饰物增强（2-3 天）

| # | 任务 | 产出 |
|---|------|------|
| 2.1 | 实现复合几何体渲染（树/灌木/花/岩石/仙人掌/冰晶/火炬） | `DecorationSystem.ts` |
| 2.2 | 实现植物微动系统（`SwayAnimation` 参数 + 正弦波偏移） | `DecorationSystem.ts` |
| 2.3 | 将 obstacle 渲染从 `RenderSystem.drawMap()` 迁移到 `DecorationSystem` | 两个系统 |
| 2.4 | 实现风天联动（WindWeather 振幅倍率） | `DecorationSystem.ts` |

**验收**：树有树干+树冠，随风晃动，火炬火焰脉动，岩浆冒烟，所有原有障碍物外观升级但无功能变化。

### 阶段 3：背景层（1-2 天）

| # | 任务 | 产出 |
|---|------|------|
| 3.1 | 实现天空渐变（5 个主题的配色方案） | `DecorationSystem.ts` |
| 3.2 | 实现远景元素（山脉/沙丘/雪山/火山锥/城堡剪影） | `DecorationSystem.ts` |
| 3.3 | 实现云朵系统（生成 + 漂移 + 循环） | `DecorationSystem.ts` |
| 3.4 | 实现云阴影（地面半透明暗色椭圆） | `ScreenFXSystem.ts` |

**验收**：每个关卡有明显不同的天空和远景，云朵缓慢飘移，地面可见云影移动。

### 阶段 4：全屏特效（1-2 天）

| # | 任务 | 产出 |
|---|------|------|
| 4.1 | 实现阳光射线效果（晴天/非夜晚） | `ScreenFXSystem.ts` |
| 4.2 | 实现风线效果（半透明线条，天气联动） | `ScreenFXSystem.ts` |
| 4.3 | 实现暗角效果（四角渐变变暗） | `ScreenFXSystem.ts` |
| 4.4 | 实现画面色调滤镜（替换/增强现有 weatherTint） | `ScreenFXSystem.ts` |

**验收**：晴天有阳光洒下，风天有风线扫过，夜晚/雾天有暗角，全屏叠加自然不突兀。

### 阶段 5：动态生物（2-3 天）

| # | 任务 | 产出 |
|---|------|------|
| 5.1 | 实现飞鸟系统（V 形几何体 + 翅膀拍动 + 贝塞尔飞行路径） | `DecorationSystem.ts` |
| 5.2 | 实现地面动物系统（兽径 + 来回移动 + 停顿 + idle 动画） | `DecorationSystem.ts` |
| 5.3 | 实现草丛叶片系统（随机分布的细长三角，正弦摆动） | `DecorationSystem.ts` |
| 5.4 | 实现萤火虫/漂浮尘埃粒子（小圆点环绕光点） | `DecorationSystem.ts` |
| 5.5 | 配置各关卡的生物类型和参数 | 关卡配置文件 |

**验收**：平原有关鸟飞、松鼠跑、草摆动；沙漠有蜥蜴爬行；冰原有企鹅摇摆；火山有火鼠穿梭；城堡有老鼠出没。

### 阶段 6：性能与打磨（1 天）

| # | 任务 | 产出 |
|---|------|------|
| 6.1 | 实现 FPS 监控和自动降级策略 | `DecorationSystem.ts` |
| 6.2 | 性能测试（5 关 × 高波次 × 完整装饰） | 测试报告 |
| 6.3 | 视觉调优（各效果 alpha、频率、密度参数微调） | 调优参数 |
| 6.4 | 随机装饰池（关卡初始随机摆放装饰物） | 关卡配置 |

**验收**：60fps 稳定，低端设备自动降级，装饰效果自然不突兀。

---

## 9. 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/systems/DecorationSystem.ts` | 背景层 + 静态装饰物 + 动态生物的系统 |
| `src/systems/ScreenFXSystem.ts` | 全屏后处理特效（阳光/风线/云影/暗角） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/core/components.ts` | 新增 `AmbientCreature`、`SwayAnimation` 组件 |
| `src/types/index.ts` | 新增 `AmbientCreatureType` 枚举；扩展 `MapConfig` 接口 |
| `src/main.ts` | 注册 `DecorationSystem`；在 `onPostRender` 中调用 `ScreenFXSystem` |
| `src/systems/RenderSystem.ts` | 从 `drawMap()` 中移除 obstacle 渲染逻辑（迁移到 DecorationSystem） |
| `src/data/levels/level-*.ts` | 5 个关卡文件添加 `ambientCreatures` 和 `environmentFX` 配置 |

### 不变文件

| 文件 | 原因 |
|------|------|
| `src/core/World.ts` | 仅使用现有 bitecs API，无需改动 |
| `src/render/Renderer.ts` | 仍使用命令缓冲模式，无需改动 |
| `src/core/Game.ts` | 游戏循环不变 |
| `src/data/gameData.ts` | 装饰物不改变游戏数据 |

---

## 10. 验收标准

### 功能验收

- [ ] 5 个关卡各有独特的天空渐变 + 远景轮廓
- [ ] 每个关卡的静态装饰物以复合几何体渲染（非单形状）
- [ ] 植物在风天有明显摆动，无风和风天视觉差异可感知
- [ ] 飞鸟在空中沿曲线飞行，翅膀有拍动动画
- [ ] 每个关卡至少 1 种地面动物在场景中活动
- [ ] 阳光射线在晴天可见，夜晚/雾天不显示
- [ ] 云朵缓慢飘移，地面可见云影跟随
- [ ] 风天有风线扫过屏幕，密度与天气关联
- [ ] 暗角在夜晚/雾天加深
- [ ] 装饰物不影响任何游戏逻辑（碰撞、寻路、建造、攻击）

### 性能验收

- [ ] 完整装饰开启时，60fps 稳定（高波次 100+ 敌人 + 粒子 + 装饰物）
- [ ] FPS < 45 时自动降级，FPS ≥ 55 时恢复
- [ ] 装饰系统每帧耗时 ≤ 2ms（在 16.6ms 帧预算中）

### 体验验收

- [ ] 进入关卡时，场景不"空"，有明显环境氛围
- [ ] 不同关卡的视觉差异一目了然（不只看地面颜色）
- [ ] 装饰物不干扰战斗信息（不遮挡敌人、弹道、血条、建筑）
- [ ] 装饰物动画自然流畅，无突兀跳变

---

## 9. v3.1 一致性核对

> 本表为「沿用类」文档的固定审计项，对照 v3.0/v3.1 关键变更逐项给出本文档的现状。

| v3.0/v3.1 关键变更 | 本文档影响 | 当前状态 |
|---|---|---|
| 三资源（能量/金币/碎片）替换金币/人口/能量 | 不涉及（仅美术装饰） | ✅ |
| 工具栏部署 → 手牌区出卡 | 不涉及 | ✅ |
| 塔升级 L1-L5 → 关外科技树 | 不涉及 | ✅ |
| 毒藤塔/弩炮塔废弃 | 无相关条目 | ✅ |

> 状态图例：✅ 已同步 / 🔶 部分同步 / ❌ 未处理

## 修订历史

| 版本 | 日期 | 修订者 | 摘要 |
|---|---|---|---|
| v3.1-audit | 2026-05-14 | doc-refactor | R5 追加 v3.1 一致性核对章节 |
