# 20 — 响应式布局 & 自适应缩放

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

### 4.4 关卡选择

| 元素 | 锚点配置 | 说明 |
|------|---------|------|
| 全屏背景 | `anchor: top-left, offset(0,0)`, `size: fullWidth × fullHeight` | 铺满 |
| 第一行卡牌 | `anchor: top-center, offset(0, 160)`, 水平居中排列 | 屏幕上方 |
| 第二行卡牌 | `anchor: top-center, offset(0, 500)`, 水平居中排列 | 屏幕中间 |
| 无尽按钮 | `anchor: middle-center, offset(0, 300)` | 屏幕中央偏下 |
| 返回按钮 | `anchor: bottom-left, offset(170, 0)` | 左下角 |
| 重置按钮 | `anchor: bottom-right, offset(-170, 0)` | 右下角 |

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
