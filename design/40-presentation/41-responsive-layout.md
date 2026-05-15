---
title: 响应式布局 & 自适应缩放
status: stable
version: 1.0.1
last-modified: 2026-05-15
authority-for:
  - responsive-layout
  - anchor-system
supersedes: []
cross-refs:
  - 40-presentation/40-ui-ux.md
  - 40-presentation/47-level-map-ui.md      # v1.0.1：3 选 1 + 关后路径 UI
  - 40-presentation/48-shop-redesign-v34.md # v1.0.1：商店 8 槽锚点权威
  - v3.4-MAJOR-MIGRATION.md
---

# 响应式布局 & 自适应缩放

> ✅ **v3.4 第 2 轮 audit 完成（2026-05-15，v1.0.1）**：核心锚点系统（一/二/三章 + §4.1-§4.4）v3.4 **完全保留**；§4.5 v3.0 卡牌系统锚点按 v3.4 形态级重构原则**最小侵入 audit**：
>
> - **§4.5.1 关内 HUD**：v3.4 audit 保留（手牌区 4 张上限锁）
> - **§4.5.2 手牌区**：v3.4 audit 保留 + 4 张上限锁（与 40-ui-ux v3.0.0 §3.2 一致）
> - **§4.5.3 关间节点二选一面板**：v3.4 升级为 **3 选 1**（商店 / 秘境 / 跳过），权威 cross-ref [47 §3](./47-level-map-ui.md)
> - **§4.5.4 商店面板**：v3.0 4 槽 → v3.4 8 槽，权威 cross-ref [48 §1.4](./48-shop-redesign-v34.md#14-锚点表新增到-41-responsive-layout-45)；原 §4.5.4 v3.0 4 槽表保留为 historical reference
> - **§4.5.5 秘境事件面板**：v3.4 audit 保留 + UI 风险标注红边框（5/14 高风险事件，详 [27 §5](../20-units/27-traps-spells-scene.md#5-秘境事件池)）
> - **§4.5.6 卡池界面（主菜单）**：v3.4 **整节废弃**（卡池机制已删除，所有卡开局即解锁，配置从 src/config/cards/*.yaml 读取）
> - **§4.5.7 永久升级面板**：v3.4 **整节废弃**（meta 永久升级机制已删除，单 Run 闭环）
> - **§4.5.8 Run 结算面板**：v3.4 audit「碎片入账」槽 → 「关键节点统计」槽（与 40-ui-ux v3.0.0 §10 一致）
> - **§4.5.9 主菜单**：v3.4 audit 6 项 → 5 项（删卡池/永久升级/碎片余额，按 40-ui-ux v3.0.0 §11）
>
> **v1.0.1 改动量**：5 个子节顶部加 v3.4 audit 预警条 + 卡池/永久升级整节标 deprecated + 商店/Run 结算/主菜单表内代价行删除 + cross-ref 链接修正。
>
> 新开发请优先参考：[v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) / [48-shop-redesign-v34](./48-shop-redesign-v34.md) / [40-ui-ux v3.0.0](./40-ui-ux.md)

> 设计分辨率适配 | 锚点定位系统 | 窗口自适应

---

## 一、现状分析

### 1.1 当前渲染管线

```
窗口 resize
  → Game.resize() → Renderer.resize()
    → canvas.style.width/height = 按16:9比例缩放（letterbox）
    → canvas.width/height = 始终 1920×1080（内部分辨率不变）
```

```
鼠标/触摸事件
  → InputManager.getCanvasPos()
    → clientX/clientY → 通过 getBoundingClientRect() 缩放回设计空间
    → 始终输出 1920×1080 坐标系的坐标
```

**核心结论**：当前系统是一个 **"虚拟固定分辨率"** 方案——内部一切工作在 1920×1080 空间，浏览器通过 CSS 缩放+letterbox 处理窗口变化。UI 元素全部硬编码为 1920×1080 的绝对像素值。

### 1.2 问题总结

| 问题 | 影响 |
|------|------|
| 内部分辨率固定 1920×1080 | 非16:9屏幕留大面积黑边（21:9、4:3等） |
| UI 元素全部硬编码绝对坐标 | 窗口变化时 UI 无法重新定位 |
| 无锚点系统 | 无法实现"速度按钮贴右上角"等边缘锚定 |
| 关卡选择等全屏 UI 固定尺寸 | 大屏浪费空间，小屏可能溢出 |
| resize 只更新 CSS 尺寸 | 地图偏移、UI布局不重新计算 |

### 1.3 需改造的文件清单

| 文件 | 当前硬编码内容 | 改造优先级 |
|------|---------------|-----------|
| `src/render/Renderer.ts` | `DESIGN_W=1920, DESIGN_H=1080`；resize 只改 CSS 不改内部分辨率 | P0 |
| `src/systems/UISystem.ts` | 1316行：顶栏HUD、底部面板、按钮、覆盖层——全部绝对坐标 | P0 |
| `src/systems/LevelSelectUI.ts` | 273行：卡牌网格、按钮——全部以 `(1920-x)/2` 居中 | P1 |
| `src/systems/RenderSystem.ts` | `computeSceneLayout(map, 1920, 1080)` 硬编码；静态字段初始化一次 | P1 |
| `src/systems/DecorationSystem.ts` | 天空渐变、云朵范围硬编码 `1920`/`1080` | P1 |
| `src/systems/ScreenFXSystem.ts` | 渐晕角硬编码 | P2 |
| `src/core/Game.ts` | 错误条 `fillRect(0,0,1920,60)` | P2 |
| `src/main.ts` | 天气色调 `fillRect(0,0,1920,1080)`；`onPostRender` 未触发 UI 重布局 | P2 |

---

## 二、设计目标

1. **窗口自适应**：浏览器窗口变化时，游戏自动适配新尺寸，无需刷新
2. **锚点定位**：UI 元素通过锚点声明位置，而非硬编码像素
3. **保持设计分辨率**：游戏世界（地图、实体、战斗）保持 1920×1080 逻辑坐标系，通过缩放因子映射到实际视口
4. **渐进迁移**：分阶段实施，每阶段可独立验证
5. **向后兼容**：改造期间已有玩法不退化

---

## 三、架构设计

### 3.1 核心思路：逻辑空间 + 视口空间 + 锚点系统

```
┌──────────────────────────────────────────────────────────────┐
│                      浏览器窗口（任意尺寸）                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              画布 CSS 尺寸（填充窗口）                    │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │       画布内部分辨率（ = 视口逻辑尺寸 ）            │  │  │
│  │  │                                                  │  │  │
│  │  │   设计空间(1920×1080)  ──scaleFactor──→  视口空间  │  │  │
│  │  │                                                  │  │  │
│  │  │   · 游戏世界（地图+实体）: 设计空间 → 缩放          │  │  │
│  │  │   · UI 元素：锚点系统 → 视口空间绝对定位             │  │  │
│  │  │                                                  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 LayoutManager（布局管理器）—— 新增 `src/ui/LayoutManager.ts`

LayoutManager 是全局单例，负责：

1. **维护视口尺寸**（`viewportW`, `viewportH`）
2. **计算缩放因子**（`scaleFactor = viewportH / 1080`，以高度为基准等比缩放）
3. **解析锚点配置**，输出实际像素坐标
4. **在 resize 时触发所有已注册 UI 组件的重新计算**

#### 锚点系统：

```
┌───────────────┬───────────────┬───────────────┐
│  TOP_LEFT     │  TOP_CENTER   │  TOP_RIGHT    │
│  (0,0)        │  (0.5,0)      │  (1,0)        │
├───────────────┼───────────────┼───────────────┤
│  MIDDLE_LEFT  │  MIDDLE_CENTER│  MIDDLE_RIGHT │
│  (0,0.5)      │  (0.5,0.5)    │  (1,0.5)      │
├───────────────┼───────────────┼───────────────┤
│  BOTTOM_LEFT  │  BOTTOM_CENTER│  BOTTOM_RIGHT │
│  (0,1)        │  (0.5,1)      │  (1,1)        │
└───────────────┴───────────────┴───────────────┘
```

#### API 设计：

```typescript
// 锚点配置接口
interface AnchorConfig {
  anchorX: 'left' | 'center' | 'right';   // 水平锚点：0 | 0.5 | 1
  anchorY: 'top' | 'middle' | 'bottom';   // 垂直锚点：0 | 0.5 | 1
  offsetX: number;  // 偏移量（设计分辨率像素，自动缩放）
  offsetY: number;  // 偏移量（设计分辨率像素，自动缩放）
}

// LayoutManager 核心 API
class LayoutManager {
  static viewportW: number;       // 当前视口宽度
  static viewportH: number;       // 当前视口高度
  static scale: number;           // viewportH / 1080
  static designW: number;         // 1920（常量）
  static designH: number;         // 1080（常量）

  static init(): void;
  static update(viewportW: number, viewportH: number): void;
  
  // 锚点 → 实际坐标
  static anchor(anchor: AnchorConfig): { x: number; y: number };
  
  // 设计像素 → 视口像素
  static scaleX(designPx: number): number;
  static scaleY(designPx: number): number;
  static scaleSize(designPx: number): number;
  
  // 快捷方法
  static centerX(anchor: AnchorConfig): number;
  static centerY(anchor: AnchorConfig): number;
}
```

### 3.3 缩放策略：以高度为基准等比缩放

```
scale = viewportH / 1080

视口内部分辨率 = max(viewportW, viewportH * 16/9) × viewportH
  - 保证游戏世界至少 16:9 宽
  - 高度始终匹配 viewportH
  - 超宽屏时，水平方向可有多余空间（用于扩展背景装饰）

canvas.width  = viewportW（实际视口宽度）
canvas.height = viewportH（实际视口高度）
```

**为什么以高度为基准？**

- 游戏世界核心是竖排结构（HUD + 地图 + 工具栏），高度是稀缺资源
- 超宽屏时水平空间富余，可用于背景装饰扩展
- 避免小屏时地图被压缩到看不清

### 3.4 渲染层改造

```
Renderer 改造后的 resize():
  1. 读取 window.innerWidth / innerHeight
  2. canvas.style.width/height = 窗口尺寸（不再 letterbox）
  3. canvas.width/height = 窗口尺寸（内部分辨率匹配视口）
  4. 调用 LayoutManager.update(w, h)
  5. 触发 scene layout 重新计算（RenderSystem.computeSceneLayout）
  6. 触发所有 UI 刷新（重绘命令缓冲区）
```

### 3.5 输入层改造

```
InputManager.getCanvasPos() 改造：
  - 当前：canvas.width / rect.width（因为内部分辨率和 CSS 尺寸不同）
  - 改造后：内部分辨率 = CSS 尺寸 → 比例 = 1（无需缩放）
  - transform 改为通过 LayoutManager.scaleX/Y 将视口坐标转换为设计坐标
```

### 3.6 场景布局适配

```
computeSceneLayout() → 使用动态 canvas 尺寸：
  offsetX = (canvasW - mapPixelW * scale) / 2     // 水平居中
  offsetY = topBarH * scale + gap                   // HUD 下方
            + (availableH - mapPixelH * scale) / 2  // 垂直居中于 HUD 和面板之间
  
其中:
  topBarH = 36 * scale
  panelH  = 100 * scale
  mapPixelW = 21 * TILE_SIZE
  mapPixelH = 9 * TILE_SIZE
```

---

## 四、锚点配置映射表

### 4.1 顶栏 HUD 元素

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| HUD 背景条 | `anchor: top-left, offset(0,0)`, `size: fullWidth × 36` | 横跨全屏 |
| 金币/能量文字 | `anchor: top-left, offset(20, 18)` | 贴左上角 |
| 波次文字 | `anchor: top-center, offset(-200, 18)` | HUD中央偏左 |
| 敌军存活文字 | `anchor: top-center, offset(0, 18)` | HUD正中央 |
| 天气文字 | `anchor: top-center, offset(220, 18)` | HUD中央偏右 |
| 倒计时 | `anchor: top-right, offset(-370, 18)` | 贴右上角偏左 |
| 跳过按钮 | `anchor: top-right, offset(-240, 8)` | 贴右上角 |
| 倍速按钮 | `anchor: top-right, offset(-170, 8)` | 贴右上角 |
| 暂停按钮 | `anchor: top-right, offset(-129, 8)` | 贴右上角 |

### 4.2 底部面板

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| 面板背景 | `anchor: bottom-center, offset(0, -50)`, `size: mapWidth × 100` | 与地图同宽，底部居中 |
| 塔/单位/陷阱/生产按钮 | 面板内相对布局，基准起始位置由 LayoutManager 计算 | 面板内保持一致间距 |

### 4.3 覆盖层

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| 胜利/失败覆盖层 | `anchor: middle-center, offset(0,0)`, `size: 1600×400` | 屏幕正中央 |
| 暂停菜单 | `anchor: scene-center, offset(0,0)` | 地图区域正中央 |
| 覆盖层标题文字 | `anchor: middle-center, offset(0,-30)` | 屏幕中央偏上 |
| 覆盖层副标题 | `anchor: middle-center, offset(0,20)` | 屏幕中央偏下 |

### 4.4 关卡选择（v1.1 旧版，v3.0 已替换）

> v3.0 删除关卡选择界面，由主菜单"开始 Run"按钮替代。本节保留作历史参考。

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| 全屏背景 | `anchor: top-left, offset(0,0)`, `size: fullWidth × fullHeight` | 铺满 |
| 第一行卡牌 | `anchor: top-center, offset(0, 160)`, 水平居中排列 | 屏幕上方 |
| 第二行卡牌 | `anchor: top-center, offset(0, 500)`, 水平居中排列 | 屏幕中间 |
| 无尽按钮 | `anchor: middle-center, offset(0, 300)` | 屏幕中央偏下 |
| 返回按钮 | `anchor: bottom-left, offset(170, 0)` | 左下角 |
| 重置按钮 | `anchor: bottom-right, offset(-170, 0)` | 右下角 |

### 4.5 v3.0 卡牌系统锚点（v3.4 audit · v1.0.1）

> v3.0 原始设计：根据 [10-roguelike-loop](../10-gameplay/10-roguelike-loop.md) 方案，v3.0 新增手牌区与关间面板。
>
> **v3.4 audit 状态**（详 §八 v3.4 一致性核对）：
>
> | 子节 | v3.4 状态 |
> |---|---|
> | §4.5.1 关内 HUD | ✅ 保留 |
> | §4.5.2 手牌区 | ✅ 保留（4 张上限锁） |
> | §4.5.3 关间面板 | 🔶 2 选 1 → **3 选 1**（商店 / 秘境 / 跳过）|
> | §4.5.4 商店面板 | 🛑 v3.0 4 槽锚点废弃，权威转交 [48 §1.4](./48-shop-redesign-v34.md#14-锚点表新增到-41-responsive-layout-45)（8 槽两栏） |
> | §4.5.5 秘境事件面板 | 🔶 保留 + 高风险红边框新增 |
> | §4.5.6 卡池界面 | 🛑 **整节废弃** |
> | §4.5.7 永久升级面板 | 🛑 **整节废弃** |
> | §4.5.8 Run 结算面板 | 🔶 「碎片入账」→「关键节点统计」 |
> | §4.5.9 主菜单 | 🔶 6 项 → **5 项** |

#### 4.5.1 关内 HUD 扩展（替代旧工具栏）

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| 能量条 | `anchor: top-left, offset(20, 50)`, `size: 200 × 24` | 主 HUD 下方左侧 |
| 能量数字 | `anchor: top-left, offset(230, 52)` | 能量条右侧，显示 `current/max` |
| 牌堆图标 | `anchor: bottom-right, offset(-200, -160)`, `size: 50 × 70` | 手牌区右侧上方 |
| 弃牌堆图标 | `anchor: bottom-right, offset(-140, -160)`, `size: 50 × 70` | 牌堆右侧 |
| 牌堆/弃牌数 | 跟随各自图标，offset(-25, 20) | 图标底部数字 |

#### 4.5.2 手牌区（底部居中）

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| 手牌区背景条 | `anchor: bottom-center, offset(0, -130)`, `size: 800 × 180` | 屏幕底部居中长条 |
| 手牌卡片插槽 | 手牌区内**水平居中排列**，卡间距 16px | 最多 8 张，按当前手牌数动态居中 |
| 单张卡尺寸 | `120 × 168` | 见 [16 §13.1](./42-art-assets.md#131-卡牌尺寸与基础规格) |
| 卡牌锚点（容器内） | `anchor: middle-center, offset(0, 0)` | 卡牌中心对齐手牌区中心 |
| 手牌区出现/隐藏 | 战斗阶段显示，关间阶段隐藏 | LayoutManager 监听 GamePhase |

#### 4.5.3 关间节点 3 选 1 面板（v3.4 audit · v1.0.1）

> v3.4 升级：原"商店 / 秘境"二选一 → "商店 / 秘境 / 跳过"3 选 1。权威设计见 [47-level-map-ui §3](./47-level-map-ui.md)。

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| 节点面板背景 | `anchor: middle-center, offset(0, 0)`, `size: fullWidth × fullHeight` | 全屏半透明蒙层 |
| 标题文本 | `anchor: middle-center, offset(0, -200)` | "选择前进路径" |
| 🏪 商店选项卡 | `anchor: middle-center, offset(-220, 0)`, `size: 180 × 280` | 左 |
| 🌀 秘境选项卡 | `anchor: middle-center, offset(0, 0)`, `size: 180 × 280` | 中 |
| ⏭ 跳过选项卡 | `anchor: middle-center, offset(220, 0)`, `size: 180 × 280` | 右 |

> ~~v3.0 二选一布局（offset -160/+160）保留为 historical reference，v3.4 已废弃。~~

#### 4.5.4 商店面板（v3.4 转交 48 · v1.0.1）

> 🛑 **v3.4 audit**：本节 v3.0 4 槽锚点表已废弃。v3.4 商店改造为 **8 槽（左 4 单位 + 右 4 功能卡）+ 两栏 UI + 金币/技能点双余额**，权威锚点表完整定义在 [48-shop-redesign-v34 §1.4](./48-shop-redesign-v34.md#14-锚点表新增到-41-responsive-layout-45)。本节仅作历史快照保留。

**v3.4 关键变更**：
- 商品槽数 4 → **8**（两栏对称布局）
- 余额显示 1 个（碎片）→ **2 个**（金币 G + 技能点 SP）
- 单槽尺寸 140×200 → **120×180**（适配 8 槽布局）
- 刷新按钮锚点不变，但价格递增 30→60→120 G（详 [50-mda §14](../50-data-numerical/50-mda.md#14-商店价格表v34-第-2-轮重写)）

~~v3.0 4 槽锚点表（历史快照，v3.4 已废弃）：~~

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| ~~商店全屏背景~~ | ~~`anchor: middle-center, offset(0, 0)`, `size: 1200 × 700`~~ | ~~居中大面板~~ |
| ~~标题（含余额）~~ | ~~`anchor: top-center, offset(0, 30)` 相对于商店面板~~ | ~~顶部居中~~（v3.4 改双余额槽，详 48 §1.4）|
| ~~商品槽 1-4~~ | ~~4 个槽位水平排列，槽间距 20px~~ | ~~中央区域~~（v3.4 改 8 槽两栏，详 48 §1.4）|
| ~~单槽尺寸~~ | ~~`140 × 200`~~ | ~~详见 [16 §13.8.2](./42-art-assets.md#1382-商店面板视觉)~~ |
| ~~刷新按钮~~ | ~~`anchor: bottom-right, offset(-200, -30)` 相对于商店面板~~ | ~~右下~~（v3.4 价格递增 30→60→120 G）|
| ~~离开按钮~~ | ~~`anchor: bottom-right, offset(-30, -30)` 相对于商店面板~~ | ~~右下角~~（v3.4 不变）|

> 新开发请使用：[48-shop-redesign-v34 §1.4](./48-shop-redesign-v34.md#14-锚点表新增到-41-responsive-layout-45)（权威）

#### 4.5.5 秘境事件面板（v3.4 audit · v1.0.1）

> v3.4 audit：核心锚点 v1.0 保留。新增高风险事件红边框警示（5/14 高风险事件 = 35.7%，详 [27-traps-spells-scene §5](../20-units/27-traps-spells-scene.md#5-秘境事件池)）。

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| 秘境全屏背景 | `anchor: middle-center, offset(0, 0)`, `size: 800 × 600` | 居中中面板 |
| 高风险事件红边框 | `anchor: middle-center, offset(0, 0)`, `border-width: 6px, color: #FF3030` | **v3.4 新增**：仅 ⚠️ 高风险事件时显示，详 27 §5.5 schema `highRisk: true` |
| 事件标题 | `anchor: top-center, offset(0, 30)` 相对于秘境面板 | 顶部 |
| 事件插画区 | `anchor: top-center, offset(0, 80)`, `size: 600 × 200` | 标题下方 |
| 事件描述文本 | `anchor: top-center, offset(0, 300)`, `size: 700 × 80` | 插画下方 |
| 选项按钮组 | `anchor: bottom-center, offset(0, -30)`, 垂直排列，每按钮 700 × 60 | 底部，**每个事件必含 1 个零成本退出选项**（27 §5.1）|
| 收益代价标记 | 选项按钮内右侧，`anchor: middle-right, offset(-20, 0)` | **v3.4 新增**：每选项显示 5 类资源图标（金币/SP/卡/HP/能量）|

#### 4.5.6 卡池界面（主菜单）🛑 v3.4 整节废弃

> 🛑 **v3.4 废弃声明（2026-05-15，v1.0.1）**：v3.4 形态级重构「单 Run 闭环 + 所有卡开局即解锁」原则下，**卡池界面整体取消**。
>
> **废弃原因**：
> - v3.4 取消卡牌永久解锁机制（所有卡开局即可用）→ 不再需要"卡池"作为解锁状态查看入口
> - 卡牌配置从 `src/config/cards/*.yaml` 配置层读取，不持久化 → 不再有"已解锁/未解锁"二态
> - 主菜单 v3.4 删除"卡池"入口（详 [40-ui-ux §11](./40-ui-ux.md)）
>
> **后续替代**：玩家如需查看"本 Run 卡组"，使用关内手牌区（§4.5.2）或 Run 结算面板（§4.5.8）查看；不再需要独立卡池界面。
>
> ~~v1.0 卡池界面锚点表（v3.4 已废弃，仅作历史快照）：~~

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| ~~卡池全屏背景~~ | ~~`anchor: top-left, offset(0, 0)`, `size: fullWidth × fullHeight`~~ | ~~铺满~~ |
| ~~顶部分类标签~~ | ~~`anchor: top-center, offset(0, 60)`~~ | ~~4 个稀有度过滤按钮~~ |
| ~~碎片余额~~ | ~~`anchor: top-right, offset(-30, 30)`~~ | ~~右上角~~（v3.4 双重废弃：卡池整节废弃 + 碎片货币已废弃）|
| ~~卡片网格~~ | ~~`anchor: middle-center, offset(0, 30)`, 6 列 N 行~~ | ~~中央~~ |
| ~~单卡尺寸~~ | ~~`120 × 168`, 间距 20px~~ | ~~同手牌卡~~ |
| ~~返回按钮~~ | ~~`anchor: bottom-left, offset(30, -30)`~~ | ~~左下角~~ |

#### 4.5.7 永久升级面板 🛑 v3.4 整节废弃

> 🛑 **v3.4 废弃声明（2026-05-15，v1.0.1）**：v3.4 形态级重构「单 Run 闭环 + 死亡无 meta 回报」原则下，**永久升级机制整体取消**。
>
> **废弃原因**：
> - v3.4 删除火花碎片货币 → 失去永久升级的资源基础
> - v3.4 引入"技能点 SP"作为本 Run 临时资源（详 [11-economy §4](../10-gameplay/11-economy.md) + [50-mda §17](../50-data-numerical/50-mda.md#17-技能点-sp-系统v34-新建替换火花碎片)）→ 升级路径迁移至关内技能树（第 3 轮 22-skill-tree-* 文档定义）
> - 主菜单 v3.4 删除"永久升级"入口（详 [40-ui-ux §11](./40-ui-ux.md)）
>
> **后续替代**：本 Run 单位升级走"关内技能树"（关后 3 选 1 商店购买 SP 或秘境奖励 SP → 在战场点亮塔的技能节点）。Run 结束 SP 清零。
>
> ~~v1.0 永久升级面板锚点表（v3.4 已废弃，仅作历史快照）：~~

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| ~~面板背景~~ | ~~`anchor: middle-center, offset(0, 0)`, `size: 800 × 500`~~ | ~~居中~~ |
| ~~标题~~ | ~~`anchor: top-center, offset(0, 20)`~~ | ~~顶部~~ |
| ~~升级项行~~ | ~~垂直排列 5 行，每行 `60 × 760`~~ | ~~5 类升级（v3.4 全部废弃）~~ |
| ~~关闭按钮~~ | ~~`anchor: top-right, offset(-20, 20)` 相对于面板~~ | ~~右上角~~ |

#### 4.5.8 Run 结算面板（v3.4 audit · v1.0.1）

> v3.4 audit：删除"碎片入账"槽（v3.4 单 Run 闭环 + 无 meta 收益），改为"关键节点统计"槽（详 [40-ui-ux v3.0.0 §10](./40-ui-ux.md)）。

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| 面板背景 | `anchor: middle-center, offset(0, 0)`, `size: 1000 × 600` | 居中 |
| 标题（成功/失败） | `anchor: top-center, offset(0, 40)` | 顶部 |
| 流派标签 | `anchor: top-center, offset(0, 100)` | 标题下方（"本会话荣誉"，与 meta 解耦，详 [61-save-system v3.0.0 §5](../60-tech/61-save-system.md)）|
| 数据面板 | `anchor: middle-left, offset(80, 0)`, `size: 350 × 300` | 左侧（通关关数 / 击杀数 / 用时） |
| **关键节点统计**（v3.4 替换碎片入账） | `anchor: middle-right, offset(-80, 0)`, `size: 350 × 200` | 右侧（本 Run 通关关数 / 商店秘境进入次数 / SP 总流量 / 卡组规模）|
| 资源已清零声明 | `anchor: bottom-center, offset(0, -180)`, `size: 800 × 30` | **v3.4 新增**：明确标注"金币 / 技能点 / 卡组本次 Run 已清零，下次重开干净起跑"|
| 卡组回顾 | `anchor: bottom-center, offset(0, -120)`, `size: 800 × 100` | 底部上方 |
| 重开/返回按钮 | `anchor: bottom-center, offset(0, -30)` | 底部 |

> ~~v1.0 "碎片入账"槽（碎片余额 +N、本 Run 累计、商店余额历史）已 v3.4 整体废弃。~~

#### 4.5.9 主菜单（v3.4 audit · v1.0.1）

> v3.4 audit：主菜单从 v3.0 6 项简化为 **5 项**（删卡池 / 永久升级 / 碎片余额，新增制作组 / 退出游戏明确化）。详 [40-ui-ux v3.0.0 §11](./40-ui-ux.md)。

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| 游戏标题 | `anchor: top-center, offset(0, 100)` | 顶部 |
| **开始 Run 按钮** | `anchor: middle-center, offset(0, -100)`, `size: 300 × 60` | 中央上方（v3.4 唯一 Run 入口，无"继续 Run"概念）|
| **关卡选择按钮** | `anchor: middle-center, offset(0, -20)`, `size: 300 × 60` | 中央 |
| **设置按钮** | `anchor: middle-center, offset(0, 60)`, `size: 300 × 60` | 中央下方 |
| **制作组按钮** | `anchor: middle-center, offset(0, 140)`, `size: 300 × 60` | 制作组信息 |
| **退出游戏按钮** | `anchor: middle-center, offset(0, 220)`, `size: 300 × 60` | 退出 |

> **v3.4 已删除菜单项**：
> - ~~继续 Run 按钮~~（v3.4 无 OngoingRun 持久化，详 [61-save-system v3.0.0 §3](../60-tech/61-save-system.md)）
> - ~~卡池按钮~~（v3.4 卡池机制废弃，所有卡开局即解锁）
> - ~~永久升级按钮~~（v3.4 meta 永久升级机制废弃，改本 Run 技能树）
> - ~~碎片余额显示~~（v3.4 火花碎片货币整体废弃）

---

## 五、实施计划

### Phase 1：基础设施（P0，不可省略）

**目标**：建立 LayoutManager + 锚点系统，不影响现有功能。

1. 创建 `src/ui/LayoutManager.ts`
   - 定义 `AnchorConfig` 接口和 `AnchorX`/`AnchorY` 枚举
   - 实现 `init()`, `update()`, `anchor()`, `scaleX/Y/Size()` 方法
   - 实现 9 点锚点计算逻辑

2. 改造 `src/render/Renderer.ts`
   - `resize()` 改为：canvas 内部分辨率 = window 尺寸（不再 letterbox）
   - 调用 `LayoutManager.update(canvas.width, canvas.height)`
   - 保留 `DESIGN_W`/`DESIGN_H` 常量作为缩放基准

3. 改造 `src/input/InputManager.ts`
   - `getCanvasPos()` 适配新坐标系统
   - 视口坐标 → 设计坐标转换

4. 改造 `src/systems/RenderSystem.ts`
   - `computeSceneLayout()` 接受动态 canvas 尺寸（不再硬编码 1920,1080）
   - resize 时重新调用
   - 场景偏移/尺寸字段改为非静态、可更新

5. 改造 `src/core/Game.ts` + `src/main.ts`
   - `onPostRender` 改为每帧检查是否需要 UI 重绘

**验证标准**：在不同窗口尺寸下，地图正确居中、背景覆盖全屏、无黑边。

### Phase 2：核心 UI 迁移（P1）

**目标**：迁移顶栏 HUD 和底部面板到锚点系统。

1. 改造 `src/systems/UISystem.ts`
   - `buildTopHUD()`：所有元素替换为 `LayoutManager.anchor(anchorConfig)`
   - `buildBottomPanel()`：面板位置/尺寸替换
   - 覆盖层：`middle-center` 锚点
   - 悬浮提示：保持跟随实体逻辑，但调整尺寸缩放

2. 添加 UI 重绘触发
   - resize 时标记 UISystem 需要重建按钮命令

**验证标准**：顶栏按钮始终在右上角、底部面板居中、覆盖层居中。

### Phase 3：辅助 UI 迁移（P2）

**目标**：关卡选择、装饰、特效适配。

1. 改造 `src/systems/LevelSelectUI.ts`
   - 卡牌网格、按钮全部改为锚点定位
   - 卡牌尺寸按 scale 缩放

2. 改造 `src/systems/DecorationSystem.ts`
   - 天空渐变、云朵范围改为动态视口尺寸
   - 云/鸟随机范围改为 `viewportW`

3. 改造 `src/systems/ScreenFXSystem.ts`
   - 渐晕角位置改为动态

4. 改造 `src/core/Game.ts`
   - 错误提示条改为锚点定位

**验证标准**：关卡选择在各种窗口尺寸下布局合理；装饰元素覆盖全屏。

### Phase 4：测试与打磨（P3）

**目标**：全面测试确保所有交互正常。

1. 测试矩阵：
   - 分辨率：1280×720、1920×1080、2560×1440、3440×1440(21:9)
   - 操作：建造拖拽、按钮点击、实体选中、关卡选择
   - 缩放：窗口拖动缩放（改变 aspect ratio）

2. 边缘情况：
   - 极小窗口（< 800×600）
   - 极端宽高比（32:9）
   - 窗口从全屏到最小化再恢复

3. 更新设计文档 `design/09-ui-ux.md` 补充锚点映射表

---

## 六、风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 建造拖拽的坐标转换出错 | Phase 1 完成后专门测试拖拽功能，InputManager 充分验证 |
| 字体大小缩放后模糊 | 使用 `LayoutManager.scaleSize(fontSize)` 确保字体等比缩放 |
| RenderSystem 静态字段改为实例字段后多系统引用混乱 | 逐步迁移，每步验证编译通过 |
| 全屏背景装饰在超宽屏出现空白 | 装饰系统使用 `viewportW` 而非 `1920` |
| 旧代码中残留的硬编码 1920/1080 | grep 全局搜索，Phase 3 完成后逐文件检查 |

---

## 七、验收标准

- [ ] 窗口 resize 时游戏内容自适应填充，无黑边
- [ ] 顶栏 HUD 按钮锚定边缘（暂停/速度按钮始终在右上角）
- [ ] 底部面板与地图同宽、水平居中
- [ ] 胜利/失败/暂停覆盖层居中显示
- [ ] 关卡选择卡牌网格居中、按钮锚定角落
- [ ] 地图区域水平居中于 HUD 和工具栏之间
- [ ] 建造拖拽坐标正确（拖拽位置 = 松手落位）
- [ ] 实体点击/选中坐标正确
- [ ] 字体和 UI 尺寸随视口等比缩放
- [ ] 装饰元素覆盖全视口，无溢出或空白
- [ ] 在 16:9 / 21:9 / 4:3 三种宽高比下视觉效果合理
- [ ] **v3.4 新增**：关间面板 3 选 1 布局（商店 / 秘境 / 跳过）锚点正确
- [ ] **v3.4 新增**：秘境事件高风险红边框正确显示（仅 5/14 高风险事件）
- [ ] **v3.4 新增**：Run 结算面板「关键节点统计」槽替代「碎片入账」槽
- [ ] **v3.4 新增**：主菜单 5 项（开始 Run / 关卡选择 / 设置 / 制作组 / 退出游戏），无卡池 / 永久升级 / 碎片余额
- [ ] **v3.4 新增**：商店面板锚点权威转交 [48 §1.4](./48-shop-redesign-v34.md#14-锚点表新增到-41-responsive-layout-45)，本文档 §4.5.4 仅作历史快照

---

## 八、v3.4 一致性核对（v1.0.1 新增）

| v3.4 关键变更 | 本文档 audit 项 | 状态 |
|---|---|---|
| **碎片货币彻底废弃** | §4.5.4 商店表「含余额」改双余额槽（金币+SP） / §4.5.6 卡池整节废弃 / §4.5.8 Run 结算「碎片入账」槽改「关键节点统计」/ §4.5.9 主菜单「碎片余额显示」删除 | ✅ §4.5.4-§4.5.9 audit |
| **卡池机制彻底废弃** | §4.5.6 整节废弃（卡牌从配置层读取） / §4.5.9 主菜单「卡池按钮」删除 | ✅ §4.5.6 / §4.5.9 audit |
| **永久升级机制彻底废弃** | §4.5.7 整节废弃（meta 升级→本 Run 技能树） / §4.5.9 主菜单「永久升级按钮」删除 | ✅ §4.5.7 / §4.5.9 audit |
| **单 Run 闭环 / 死亡无 meta** | §4.5.8 Run 结算「资源已清零声明」槽新增 / §4.5.9 主菜单「继续 Run 按钮」删除 | ✅ §4.5.8 / §4.5.9 audit |
| **关后 3 选 1（商店 / 秘境 / 跳过）** | §4.5.3 二选一 → 3 选 1（offset 调整 -220/0/+220） | ✅ §4.5.3 audit |
| **商店 8 槽两栏 + 双余额** | §4.5.4 原 4 槽锚点表整体废弃，权威转交 [48 §1.4](./48-shop-redesign-v34.md#14-锚点表新增到-41-responsive-layout-45) | ✅ §4.5.4 audit |
| **秘境事件 30% 高风险红边框** | §4.5.5 新增红边框锚点（仅 highRisk: true 事件显示） + 收益代价 5 类图标 | ✅ §4.5.5 audit |
| **主菜单 6 项 → 5 项** | §4.5.9 完整重写（开始 Run / 关卡选择 / 设置 / 制作组 / 退出游戏） | ✅ §4.5.9 audit |
| **核心锚点系统不变** | §1-§3（LayoutManager / 缩放策略 / 渲染层 / 输入层 / 场景布局） + §4.1-§4.4（HUD / 底部 / 覆盖层 / 关卡选择） v3.4 完全保留 | ✅ 不修改 |

> **v1.0.1 audit 总结**：5 个 v3.0 子节修订（§4.5.3 升级 / §4.5.4 转交 / §4.5.5 增强 / §4.5.8 替换 / §4.5.9 简化）+ 2 个子节整节废弃（§4.5.6 卡池 / §4.5.7 永久升级）；核心锚点系统 v3.4 完全保留。

---

## 修订历史

| 版本 | 日期 | 修订者 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-14 | refactor | 创建响应式布局 + 锚点定位系统设计；定义 LayoutManager / 缩放策略 / 9 类 v3.0 卡牌系统锚点（关内 HUD / 手牌区 / 关间面板 / 商店 / 秘境 / 卡池 / 永久升级 / Run 结算 / 主菜单）。 |
| 1.0.1 | 2026-05-15 | refactor | **v3.4 第 2 轮 audit 完成**：5 个子节修订 + 2 个子节整节废弃；§4.5.3 关间面板 2 选 1 → 3 选 1；§4.5.4 商店 v3.0 4 槽锚点表废弃，权威转交 48 §1.4；§4.5.5 秘境面板新增高风险红边框 + 5 类资源图标；§4.5.6 卡池整节废弃（v3.4 所有卡开局即解锁，配置层读取）；§4.5.7 永久升级整节废弃（meta 升级机制取消）；§4.5.8 Run 结算「碎片入账」槽 → 「关键节点统计」+ 「资源已清零声明」；§4.5.9 主菜单 6 项 → 5 项（删卡池/永久升级/碎片余额，明确制作组/退出游戏）；新增 §八 v3.4 一致性核对小节；§七 验收标准新增 5 条 v3.4 项。核心锚点系统（§一-§三 + §4.1-§4.4）v3.4 完全保留。 |
