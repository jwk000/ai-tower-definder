---
title: 层级系统设计
status: stable
version: 1.0.0
last-modified: 2026-05-14
authority-for:
  - render-layer-system
supersedes: []
cross-refs:
  - 40-presentation/40-ui-ux.md
---

# 层级系统设计

> 逻辑层级（棋盘空间）与表现层级（场景视觉）的映射关系、渲染排序规则、攻击目标层级约束

---

## 1. 问题分析

### 1.1 当前 Bug：蝙蝠塔的蝙蝠显示在地图背景之后

**根本原因**：渲染命令缓冲区的 FIFO 推送顺序错误。

```
当前渲染时序：
  BatSwarmSystem.update()     → 第7个注册 → renderBat() 推送蝙蝠命令
     …（中间17个系统）…
  RenderSystem.update()       → 第25个注册 → drawMap() + drawEntities() 推送地图和实体命令
  Renderer.endFrame()         → 按 FIFO 顺序绘制：蝙蝠(先) → 地图(后) → 实体(后)
                               结果：蝙蝠被地图瓦片覆盖 ❌
```

蝙蝠的渲染发生在 `BatSwarmSystem.update()` 中（系统注册序号 #7），而地图和实体渲染发生在 `RenderSystem.update()` 中（系统注册序号 #25）。所有命令进入同一个扁平缓冲区，`endFrame()` 按先入先出顺序绘制——蝙蝠命令先入，被后入的地图命令覆盖。

### 1.2 系统性缺陷

| 问题 | 影响 |
|------|------|
| **`Layer` 组件存在但渲染系统不读取** | 蝙蝠虽标记为 `Layer: LowAir`，渲染顺序完全忽略 |
| **`RenderCommand` 无层级字段** | 所有命令进入同一扁平数组，无法按层排序 |
| **命令缓冲区纯 FIFO** | `Renderer.endFrame()` 不排序，直接按推送顺序画 |
| **`AttackSystem` 不检查层级** | 近战可以攻击飞行单位，不符合设计意图 |

---

## 2. 两层体系：逻辑层级 vs 表现层级

两者是**不同维度**的概念，不能混淆：

| 维度 | 逻辑层级 | 表现层级 |
|------|----------|----------|
| **所在域** | 棋盘内的空间高度 | 场景的视觉远近 |
| **作用** | 决定攻击目标可达性、碰撞 | 决定视觉遮挡关系 |
| **用户看到的是** | 单位在棋盘上的空间位置（地面/低空） | 由远到近的渲染顺序 |
| **类比** | Z 轴（上下） | Z-index（前后） |

```
┌────────────────────────────────────────────────────────────────┐
│                        表现层级（场景视觉）                       │
│                                                                  │
│  远景背景 ───────────────────────────────────── 最远             │
│  中景背景 ─────────────────────────────────────                  │
│  ╔══════════════════════════════════════════╗                    │
│  ║           棋盘层 (Board Layer)           ║                    │
│  ║  ┌──────────────────────────────────┐   ║                    │
│  ║  │    逻辑层级（空间高度）            │   ║                    │
│  ║  │                                  │   ║                    │
│  ║  │  太空层  Space       ─ 最高       │   ║                    │
│  ║  │  低空层  LowAir      ─ 飞行单位   │   ║                    │
│  ║  │  地面层  Ground      ─ 行走单位   │   ║                    │
│  ║  │  地格上层 AboveGrid  ─ 地面陷阱   │   ║                    │
│  ║  │  地格下层 BelowGrid  ─ 封印/地下   │   ║                    │
│  ║  │  深渊层  Abyss       ─ 最低       │   ║                    │
│  ║  └──────────────────────────────────┘   ║                    │
│  ╚══════════════════════════════════════════╝                    │
│  近景层（UI/特效叠加）───────────────────── 最近                  │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

**关键认知**：逻辑层级只存在于棋盘内。对于整个场景来说，棋盘是一个平面，逻辑层级通过**棋盘内的渲染 z-order**来表达——高层级单位画在低层级单位之上。

---

## 3. 表现层级定义（场景由远到近）

沿用 [16-美术资产设计 §2](./42-art-assets.md#二场景分层架构) 的 11 层体系，但明确区分"棋盘内"和"棋盘外"：

### 3.1 棋盘外部层（不参与游戏逻辑）

| 层号 | 名称 | 说明 | 渲染策略 |
|------|------|------|----------|
| L0 | `BackgroundLayer` | 天空渐变 + 远景几何 | 脏标记触发重绘 |
| L8 | `ScreenFXLayer` | 屏幕震动、闪白、暗角 | 覆盖全屏 |
| L9 | `UILayer` | HUD、工具栏、信息面板 | 覆盖棋盘上方 |
| L10 | `OverlayLayer` | 暂停遮罩、结算面板 | 最顶层 |

### 3.2 棋盘内部层（游戏逻辑发生的区域）

棋盘内部 = 从地图瓦片到弹道特效，所有层在一个平面对齐。

```
棋盘渲染 z-order（从后到前 / 从远到近）：

  z=0   GroundLayer         地图网格瓦片 + 主题色
  z=1   DecorationLayer     场景装饰物（树/岩石/冰晶）—— 纯视觉
  z=2   ShadowLayer         实体地面投影（半透明椭圆）
  z=3   BelowGrid           地格下层 —— 被封印/隐藏的单位（半透明或不可见）
  z=4   AboveGrid           地格上层 —— 地面陷阱（地刺等）
  z=5   Ground              地面层 —— 行走单位 + 塔 + 建筑（按 Y 排序）
  z=6   LowAir              低空层 —— 飞行单位（按 Y 排序）
  z=7   Space               太空层（预留，当前无单位）
  z=8   EffectLayer         粒子特效（爆炸/命中/建造/金币飞行）
  z=9   WeatherLayer        天气粒子（雨/雪/雾）
```

---

## 4. 逻辑层级 → 渲染 z 映射

`Layer` 组件值直接映射为渲染 z-index：

| Layer 组件值 | 数值 | 渲染 z | 典型单位 |
|-------------|------|--------|----------|
| `Abyss` | 0 | z=3 | （预留） |
| `BelowGrid` | 1 | z=3 | 封印敌人（半透明） |
| `AboveGrid` | 2 | z=4 | 地刺陷阱 |
| `Ground` | 3 | z=5 | 塔、敌人、我方单位、建筑 |
| `LowAir` | 4 | z=6 | 蝙蝠群、飞行敌人 |
| `Space` | 5 | z=7 | （预留） |

> **z=0~2** 为棋盘静态层（瓦片、装饰、阴影），不需要 Layer 组件。
>
> **弹道**不使用固定 z。弹道的 z = 弹道来源单位的层级（如地面塔发射的弹道 z=5，LowAir 单位发射的弹道 z=6）。弹道创建时从来源实体继承 Layer。

---

## 5. 攻击目标与层级约束

### 5.1 设计意图（来自用户需求）

| 攻击方 | 可攻击 |
|--------|--------|
| 近战地面单位 | Ground + AboveGrid（不能打空中） |
| 远程地面单位 | Ground + AboveGrid + LowAir |
| 低空单位 | Ground + AboveGrid + LowAir（可打地面） |
| 地面陷阱 | AboveGrid + Ground |

### 5.2 层级交互规则矩阵

```
             攻击方层级
             Abyss  Below  Above  Ground LowAir Space
被攻击方  ┌─────────────────────────────────────────
  Abyss    │   —     —      —      —      —      —
  Below    │   —     —      —      —      —      —
  Above    │   —     —      ✓      ✓      ✓      —
  Ground   │   —     —      ✓      ✓      ✓      —
  LowAir   │   —     —      —   远程✓    ✓      —
  Space    │   —     —      —      —      —      —
```

> **注意**：Ground → LowAir 的 "远程✓" 需要攻击方有远程攻击类型。近战地面单位无法攻击 LowAir。

### 5.3 实现方式

在当前 ECS 架构中：
- `Attack` 组件已有 `attackMode`（`SingleTarget`/`AoeSplash` 等）和 `range`
- 需要新增：`attackHeight` 字段（是否能打到低空），或利用 `Layer` 组件检查
- 在 `AttackSystem.tryAttack()` 中增加层级过滤

**推荐方案**：利用已有的 `Layer` 组件。在目标选择时检查 `Layer.value`：
```
if (attacker.layer === Ground && !attacker.isRanged && target.layer === LowAir) → skip
```

### 5.4 陷阱触发规则（P2-#18 修复 v1.1）

> **场景问题**：地刺等陷阱位于 `AboveGrid` 层，但敌人可能横跨多层级（如飞行敌跨 LowAir，分散敌主体在 Ground 但触手覆盖更广范围）。需要明确触发规则。

| 陷阱位置 | 可触发的敌人层级 | 例外 |
|----------|------------------|------|
| **AboveGrid（地刺）** | Ground / AboveGrid（同层或低层经过） | LowAir 不触发（飞越地刺） |
| **BelowGrid（地雷待埋）** | 任意层经过（待埋设阶段） | 一旦埋设转为 AboveGrid |
| **LowAir（高空陷阱待设计）** | LowAir | 不影响地面 |

#### 5.4.1 多目标陷阱触发

| 陷阱类型 | 触发规则 |
|----------|----------|
| **单触发型**（如尖刺）| 触发一次后销毁/进入冷却 |
| **AOE 触发型**（如地雷）| 触发时对范围内**同层级**敌人造成伤害；不触发跨层伤害 |
| **持续型**（如冰霜陷阱）| 在范围内持续对**同层级或低层级**敌人施加 Debuff |

### 5.5 跨层级特殊单位判定（v1.1）

| 特殊单位 | 主层级 | 跨层规则 |
|----------|--------|----------|
| **飞行 Boss**（如热气球） | LowAir | 仅 LowAir 攻击可达；不触发地面陷阱；不被 Ground 近战攻击 |
| **分散敌触手** | Ground | 触手判定区域属于 Ground，按主体单位层级处理 |
| **召唤型 Boss 召唤的小怪** | Ground（默认） | 单独标记 Layer，与本体可不同 |
| **变形敌**（v2.0 设计） | 动态（地面 ↔ 低空切换） | 切换时触发"层级变更事件"，重置攻击目标 |

---

## 6. 实现方案

### 6.1 改动范围

| 文件 | 改动 | 影响 |
|------|------|------|
| `src/types/index.ts` | `RenderCommand` 增加 `z?: number` | 新增字段，向后兼容 |
| `src/render/Renderer.ts` | `endFrame()` 中按 z 排序后绘制 | 改变渲染顺序 |
| `src/core/components.ts` | `Attack` 组件增加 `isRanged: Types.ui8` | 区分近战/远程 |
| `src/systems/RenderSystem.ts` | `drawEntities()` 读取 `Layer` 组件设置 z | 实体按层渲染 |
| `src/systems/BatSwarmSystem.ts` | `renderBat()` 设置 `z: 6`（LowAir） | 蝙蝠渲染修复 |
| `src/systems/AttackSystem.ts` | 弹道创建时继承来源层级 + 层级过滤 | 弹道层级 + 攻击目标限制 |
| `src/systems/ProjectileSystem.ts` | 无需改动（弹道已有 Layer 从 AttackSystem 传入） | — |
| `src/systems/WaveSystem.ts` | 敌人生成设置正确的 Layer | 已有，验证即可 |
| `src/main.ts` | 新单位创建时设置 `isRanged` 和 `Layer` | 确保新字段正确初始化 |

### 6.2 RenderCommand 新增字段

```typescript
export interface RenderCommand {
  // … 现有字段 …
  z?: number;  // 渲染 z-index，默认 5（Ground 层）。值越大越靠前。
}
```

### 6.3 渲染器排序逻辑

```typescript
endFrame(): void {
  // 按 z 稳定排序（z 相同则保持原推送顺序 = Y 排序结果）
  const sorted = [...this.commands].sort((a, b) => (a.z ?? 5) - (b.z ?? 5));
  for (const cmd of sorted) {
    this.drawCommand(cmd);
  }
}
```

### 6.4 RenderSystem 层级映射

```typescript
private drawEntities(world: TowerWorld): void {
  // … 现有 Y 排序 …

  for (const eid of sorted) {
    // 读取 Layer 组件
    const layerVal = Layer.value[eid] ?? LayerVal.Ground;
    const renderZ = LAYER_TO_RENDER_Z[layerVal];  // 查表映射

    // 渲染时传入 z
    pushCmd({ z: renderZ });
  }
}

const LAYER_TO_RENDER_Z: Record<number, number> = {
  0: 3,  // Abyss
  1: 3,  // BelowGrid
  2: 4,  // AboveGrid
  3: 5,  // Ground
  4: 6,  // LowAir
  5: 7,  // Space
};
```

### 6.5 BatSwarmSystem 设置正确的 z

```typescript
private renderBat(batId: number): void {
  // … 现有逻辑 …
  r.push({
    shape: 'circle', x, y: hoverY, size: size * 0.6,
    color: '#2d2d2d', alpha: 0.85,
    z: 6,  // LowAir 层
  });
  r.push({
    shape: 'triangle', /* … left wing … */,
    z: 6,  // 翅膀也在 LowAir
  });
  r.push({
    shape: 'triangle', /* … right wing … */,
    z: 6,
  });
}
```

### 6.6 AttackSystem 弹道 z 继承 + 层级过滤

**弹道继承来源层级**：

```typescript
// AttackSystem.spawnProjectile() 中：
const sourceLayer = Layer.value[towerId] ?? LayerVal.Ground;
world.addComponent(pid, Layer, { value: sourceLayer });
// 弹道渲染时使用 sourceLayer 映射为 z
```

**层级过滤**（使用 `isRanged` 字段）：

```typescript
// 在目标选择时增加层级检查：
for (const enemyId of enemyList) {
  // … 现有距离检查 …

  // 层级可达性检查
  const targetLayer = Layer.value[enemyId] ?? LayerVal.Ground;
  if (!this.canAttackLayer(attackerLayer, targetLayer, isRanged)) continue;

  // … 选择最近 …
}

private canAttackLayer(
  attackerLayer: number,  // LayerVal
  targetLayer: number,    // LayerVal
  isRanged: boolean,
): boolean {
  // Ground 层攻击方
  if (attackerLayer === LayerVal.Ground) {
    if (isRanged) {
      return targetLayer <= LayerVal.LowAir; // 远程可打 LowAir
    }
    return targetLayer <= LayerVal.AboveGrid; // 近战只能打地面+陷阱
  }
  // LowAir 层攻击方 — 可攻击所有 ≤ LowAir 的层
  if (attackerLayer === LayerVal.LowAir) {
    return targetLayer <= LayerVal.LowAir;
  }
  // AboveGrid — 只打同层和地面
  if (attackerLayer === LayerVal.AboveGrid) {
    return targetLayer <= LayerVal.Ground;
  }
  return false;
}
```

### 6.7 不涉及改动的内容

以下系统**无需改动**：
- `DecorationSystem` — 装饰物固定 z=1，不需要动态层
- `WeatherSystem` — 天气粒子已有自己的 ParticleContainer
- `UISystem` — 在 onPostRender 中渲染，在棋盘之后
- `LightningBoltSystem` / `LaserBeamSystem` — 在 onPostRender 中直接画 Canvas，在棋盘之后

---

## 7. 已确认的设计决策

### ✅ 决策 1：弹道层级 → 方案 B
弹道 z = 弹道来源单位的层级。地面塔的弹道在 LowAir 单位之下，飞行单位的弹道在 LowAir 层级。

### ✅ 决策 2：LowAir 层内的 Y 排序 → 方案 A
LowAir 内部也按 Y 坐标排序，产生自然的前后遮挡。

### ✅ 决策 3：近战/远程标记 → 方案 A
在 `Attack` 组件中新增 `isRanged: Types.ui8` 字段，明确区分近战/远程单位。

### ✅ 决策 4：蝙蝠攻击范围 → 方案 A
蝙蝠可攻击 ≤ LowAir 的所有单位（包括飞行敌人）。

---

## 8. 实现优先级

| 优先级 | 任务 | 原因 |
|--------|------|------|
| **P0** | `RenderCommand` + `Renderer` z 排序 | 修复蝙蝠渲染 bug 的基础 |
| **P0** | `BatSwarmSystem.renderBat()` 设置 z | 直接修复蝙蝠问题 |
| **P1** | `RenderSystem` 读取 `Layer` 设置 z | 所有实体层级正确 |
| **P1** | `AttackSystem` 层级过滤 | 攻击目标符合设计 |
| **P2** | 弹道/特效设置正确 z | 视觉完整 |
| **P3** | 单位配置中补充层级定义 | 新增飞行敌人等 |

---

## 9. 验证方法

修复后验证：
1. 建造蝙蝠塔 → 蝙蝠应显示在地图瓦片和地面单位**之上**
2. 同时有地面陷阱和蝙蝠 → 地刺在蝙蝠**之下**
3. 近战单位（盾卫）→ 不应攻击飞行敌人
4. 远程单位（弓手）→ 应可攻击低空敌人
5. 蝙蝠群 → 应可攻击地面敌人
