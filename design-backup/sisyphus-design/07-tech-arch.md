# 07 — 技术架构

> 来源: GDD §7 + AGENTS.md + 开发日志 | 版本: v0.2

---

## 1. 技术栈

| 层 | 技术 | 选型理由 |
|----|------|----------|
| 语言 | TypeScript 5.x (strict) | 类型安全，AI生成质量高 |
| 渲染 | HTML5 Canvas 2D | 几何图形直接绘制，无渲染管线 |
| 构建 | Vite | HMR热更新，极快迭代 |
| 状态管理 | 自研 ECS 架构 | 游戏实体多，ECS天然适配 |
| 数据存储 | LocalStorage | 关卡进度/设置无后端 |
| 测试 | Vitest | 数值逻辑单元测试 |

---

## 2. ECS 架构

```
┌─────────────────────────────────────────────┐
│                  Game World                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │Entities │  │Components│  │ Systems │     │
│  │ (ID池)  │  │ (纯数据) │  │ (逻辑)  │     │
│  └────┬────┘  └────┬────┘  └────┬────┘     │
│       │            │            │           │
│  Entity 1 ──── [Position, Render, Health]   │
│  Entity 2 ──── [Position, Render, Attack]   │
│  Entity 3 ──── [Position, Move, Health]     │
│                                             │
│  Systems 遍历匹配的 Entities 执行逻辑:       │
│  · MovementSystem                           │
│  · AttackSystem                             │
│  · ProjectileSystem                         │
│  · WaveSystem                               │
│  · HealthSystem                             │
│  · EconomySystem                            │
│  · BuildSystem                              │
│  · RenderSystem                             │
│  · UISystem                                 │
└─────────────────────────────────────────────┘
```

### ECS 规则

- **Components**: `readonly type = CType.Xxx` 字符串标签；其余字段为可变状态。
- **Systems**: 声明 `readonly requiredComponents` 数组；`update(entities, dt)` 每帧对匹配实体调用。
- **Query**: `World.query(...types)` 返回具有 ALL 类型的实体（AND 逻辑）。
- **注册顺序**: 系统注册顺序决定 update 顺序和 render 层级——位置敏感的。
- **实体清理**: 死实体在 `World.update()` 末尾统一清理（所有 system 运行完之后）。

---

## 3. 系统注册顺序

```
movement → attack → projectile → wave → health → economy → build → render → ui
```

| 位置 | 系统 | 职责 |
|------|------|------|
| 1 | `MovementSystem` | 敌人沿路径移动 |
| 2 | `AttackSystem` | 塔寻找目标，生成弹道 |
| 3 | `ProjectileSystem` | 弹道飞行、命中判定、伤害结算 |
| 4 | `WaveSystem` | 波次生成、结算、下一波触发 |
| 5 | `HealthSystem` | 血量归零 → 标记死亡 |
| 6 | `EconomySystem` | 金币增减、资源产出 |
| 7 | `BuildSystem` | 塔建造/拆除逻辑 |
| 8 | `RenderSystem` | 地图 + 实体渲染命令生成 |
| 9 | `UISystem` | UI 面板渲染命令生成 |

**关键**: `ProjectileSystem` 在 `AttackSystem` 之后、`HealthSystem` 之前，确保弹道在死亡检测前命中。

---

## 4. 组件清单

| 组件 | CType | 描述 |
|------|-------|------|
| `Position` | `CType.Position` | x, y 坐标 |
| `Render` | `CType.Render` | shape, size, color, label |
| `Health` | `CType.Health` | current, max, alive |
| `Attack` | `CType.Attack` | damage, range, cooldown, timer |
| `Movement` | `CType.Movement` | speed, path index, next waypoint |
| `Tower` | `CType.Tower` | type, level, cost |
| `Enemy` | `CType.Enemy` | type, reward |
| `PlayerOwned` | `CType.PlayerOwned` | 标记玩家实体 |
| `GridOccupant` | `CType.GridOccupant` | gridX, gridY 网格坐标 |
| `Projectile` | `CType.Projectile` | 弹道: target, speed, damage, source |

---

## 5. 渲染架构

### Renderer (命令缓冲模式)

- `beginFrame()`: 清空命令缓冲，开始新帧
- `drawRect()`, `drawCircle()`, `drawText()`, `drawArrow()`: 写入命令
- `endFrame()`: 批量执行缓冲命令，单次 `ctx` 刷屏

### 渲染层级

1. `RenderSystem` 在场景系统中最后注册 — 先画地图 tile，再画实体（按 Y 排序）
2. `UISystem` 在 `RenderSystem` 之后注册 — UI 形状在最上层
3. `onPostRender` 回调在 `endFrame()` 之后绘制文本叠加层

### 弹道渲染

- `RenderSystem` 检测 `Projectile` 组件 → 将 `Render.shape` 覆盖为 `'arrow'`
- 箭头计算目标方向，由箭杆 + 三角箭头组成
- 颜色: 蓝色

### 实体标签 (Phase 1)

- 塔: 蓝色圆圈 + "箭塔" 文字
- 敌人: 红色圆圈 + "小兵" 文字
- 基地: 六边形 + "基地" 文字
- `RenderCommand` 支持 `label` / `labelColor` / `labelSize` 字段

### 血条 (Phase 1)

- 高度: 3px
- 偏移: -14px (单位中心上方)
- 颜色梯度: 绿(>60%) → 黄(30-60%) → 红(<30%)

---

## 6. 输入系统

- `InputManager` 队列缓冲事件（mousedown, mousemove, mouseup, touchstart, touchmove, touchend）
- 每帧 `flush()` 处理：点击事件先检查 UI 按钮，再检查地图建造
- 触屏与鼠标统一为 `InputAction` 抽象
- 当 `x < 160` 或 `y < 60` 时不路由到地图（UI 面板区域）

---

## 7. 目录结构

```
src/
├── main.ts              # 入口 — 组装 Game, Systems, Input
├── core/                # 引擎核心
│   ├── Game.ts          # 游戏主循环 + 阶段机
│   ├── World.ts         # ECS World (实体存储 + 查询)
│   ├── Entity.ts        # 实体
│   └── System.ts        # 系统基类
├── components/          # ECS 组件 (纯数据)
│   ├── Position.ts
│   ├── Render.ts
│   ├── Health.ts
│   ├── Attack.ts
│   ├── Movement.ts
│   ├── Tower.ts
│   ├── Enemy.ts
│   ├── PlayerOwned.ts
│   ├── GridOccupant.ts
│   └── Projectile.ts
├── systems/             # ECS 系统 (逻辑)
│   ├── MovementSystem.ts
│   ├── AttackSystem.ts
│   ├── ProjectileSystem.ts
│   ├── WaveSystem.ts
│   ├── HealthSystem.ts
│   ├── EconomySystem.ts
│   ├── BuildSystem.ts
│   ├── RenderSystem.ts
│   └── UISystem.ts
├── render/              # 渲染层
│   └── Renderer.ts      # 命令缓冲模式渲染器
├── input/               # 输入处理
│   └── InputManager.ts  # 队列缓冲，每帧 flush
├── data/                # 静态配置
│   └── gameData.ts      # 塔/敌人/波次/地图配置
└── types/               # 类型定义
    └── index.ts         # CType 常量, 共享类型
```

---

## 8. TypeScript 规范

- `strict: true` — 所有严格检查开启
- `noUncheckedIndexedAccess: true` — 数组索引返回 `T | undefined`
- `noImplicitOverride: true`
- `forceConsistentCasingInFileNames: true`
- 导入使用 `.js` 扩展名（Vite `bundler` moduleResolution 要求）
- 路径别名: `@/`, `@core/`, `@components/`, `@systems/`, `@data/`, `@ui/`, `@render/`, `@input/`, `@utils/`, `@types/`

---

## 9. 游戏循环

```
beginFrame()    → 清空渲染命令缓冲
input flush()   → 处理本帧输入事件
systems.update()→ 依次运行所有系统
endFrame()      → 批量执行渲染命令，刷屏
onPostRender()  → 文本叠加层绘制
```

---

## 10. 构建命令

```bash
npm run dev          # dev server (localhost:3000)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # TypeScript only, no emit
npm test             # vitest
npm run release      # clean + typecheck + build
```

构建管线强制: `typecheck → clean → build`，类型错误不允许构建。

---

## 相关文档

- [04-combat.md](./04-combat.md) — 弹道系统数值
- [06-ui-ux.md](./06-ui-ux.md) — 渲染层级与UI规范
- [09-dev-plan.md](./09-dev-plan.md) — 开发阶段与技术任务
