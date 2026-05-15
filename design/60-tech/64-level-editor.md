---
title: 关卡编辑器（Level Editor）
status: authoritative
version: 1.0.0
last-modified: 2026-05-14
authority-for:
  - level-editor
  - level-yaml-schema
supersedes: []
cross-refs:
  - 10-gameplay/13-map-level.md
  - 10-gameplay/10-roguelike-loop.md
---

# 关卡编辑器（Level Editor）

> 形态：游戏内集成编辑器 · 调试模式入口
> 数据：本地后端写文件 API → `src/config/levels/*.yaml`
> 目标用户：策划 + 开发者（仅开发环境）
> 状态：✅ v1.0 已批准实施（2026-05-13）—— 图模型（多生成口 + 分支 DAG + 传送门）+ UI 框架选定 Preact

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| v0.1 | 2026-05-13（早） | 初稿：游戏内集成编辑器 + Vite 插件文件 API |
| v0.2 | 2026-05-13（中） | 引入多生成口 + 多路径 |
| v0.3 | 2026-05-13（晚） | 升级为图模型（DAG + 分支加权 + 传送门）|
| **v1.0** | **2026-05-13** | **批准实施。UI 框架选定 Preact（轻量 ~3KB gzip，DEV-only，零运行时污染主包）。落地路线图：Phase A → F。本轮 Phase 0+A 执行骨架。** |

---

## 0. 目标与边界

### 0.1 目标

提供**一站式所见即所得**的关卡编辑工具，使策划/开发者可以在游戏运行环境中可视化编辑现有关卡 YAML 配置的所有内容（地图、路径、波次、元数据、随机池、难度乘数），并能**一键试玩**当前编辑的关卡数据。

### 0.2 非目标（明确不做）

| 不做的事 | 原因 |
|---------|------|
| 编辑单位/卡牌/技能 Buff 配置 | 单位/卡牌已有独立 YAML（`config/units/`、`config/cards/`），且数值真理源在 21-MDA。编辑器只挑选已注册单位 ID，不创建新单位。 |
| 玩家版本可用 | 仅开发环境（`import.meta.env.DEV`）启用，发布构建剥离编辑器代码。 |
| Mod/UGC 上传分享 | 文件协议封闭于本地后端，不涉及云端。 |
| 撤销/重做超过 50 步 | 单次编辑会话内提供基本撤销，但不持久化历史。 |
| 多人协作编辑 | 单用户本地工具，依赖 Git 解决多人合作。 |

### 0.3 设计原则

1. **所见即所得**：地图编辑使用真实 PixiJS 渲染管线，与游戏内观感 1:1 一致。
2. **YAML 即事实**：编辑器只是 YAML 的图形化前端，所有改动**最终落地到 YAML**，YAML 仍是唯一事实来源。
3. **零数据丢失**：保存时往返 YAML 必须保留注释外的所有字段，未识别字段透传不丢。
4. **快速回路**：编辑 → 保存 → 试玩 全流程 ≤ 3 秒。
5. **配置驱动一致性**：编辑器内可选的所有"枚举值"（tile 类型、敌人类型、塔类型、天气、装饰物类型）从代码现有 registry/枚举派生，**不在编辑器里硬编码**。

---

## 1. 形态与入口

### 1.1 集成形态

- **编辑器是游戏的一个全屏覆盖层 UI**，与战斗界面互斥但共享 PixiJS App。
- 进入编辑器时**暂停主游戏循环**（`game.pause()`），退出时恢复或回主菜单。
- 复用 `Renderer / MapRenderer / EntityRenderer` 等渲染子系统，使预览效果与实战完全一致。

### 1.2 入口

| 入口位置 | 触发条件 | 行为 |
|---------|---------|------|
| **调试面板**（参见 [27-调试系统](./63-debug.md)） | 仅 `import.meta.env.DEV === true` 时显示 | 点击「关卡编辑器」按钮，打开编辑器主界面 |
| **键盘快捷键** | `F2`（DEV 模式） | 全局热键，任何场景均可呼出 |

> 生产构建中，编辑器模块通过 `if (import.meta.env.DEV)` 守卫，Vite tree-shake 时整段剥离，**不进入 production bundle**。

### 1.3 出口

- 顶栏「关闭」按钮 → 弹确认（如有未保存改动）→ 回到调试前界面
- 顶栏「试玩」按钮 → 用当前编辑中的关卡数据**直接启动一场战斗**，战斗结束后自动回编辑器

---

## 2. 功能矩阵

### 2.1 覆盖范围（已确认）

| 模块 | 覆盖字段 | 编辑形式 |
|------|---------|---------|
| **地图与路径** | `map.cols / rows / tileSize / tiles / spawns[] / paths{} / tileColors / obstacles`（**§4.5 升级**：单 `enemyPath` → 多 `paths`，按 `spawnId` 索引） | 网格刷涂 + 多生成口管理 + 每口独立绘制拐点 + 装饰物拖放 |
| **波次** | `waves[]`（waveNumber / spawnDelay / enemies[] / isBossWave / specialRules） | 列表式编辑 + 敌人编组卡片 |
| **关卡元数据** | `id / name / description / sceneDescription / theme / available.towers / available.units / starting.gold / starting.energy / starting.maxPopulation / hasInterLevelNode / endBoss` | 表单填写 |
| **天气与随机池** | `weather.pool / weather.initial / decorationPool / waveVariantPool / banPool / neutralPool` | 多选 + 单选 |
| **难度乘数** | `enemyHpMult / enemyDmgMult / enemySpeedMult / goldRewardMult` | 滑杆 + 数字输入 |
| **实时预览播测** | 当前编辑的关卡数据 | 「试玩」按钮一键启动 |

### 2.2 显式不覆盖

- 单位 YAML、卡牌 YAML、技能/Buff、AI 行为树：**只读引用**（下拉选 ID），不可编辑。

---

## 3. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Game (main.ts + PixiJS App)                │
│  ┌─────────────────────┐   ┌──────────────────────────────┐ │
│  │   Battle Scene      │   │   Editor Overlay (DEV only)  │ │
│  │   (existing)        │◄─►│   - LevelEditorUI            │ │
│  └─────────────────────┘   │   - EditorState (model)      │ │
│                            │   - EditorRenderer (preview) │ │
│                            └────────────┬─────────────────┘ │
└──────────────────────────────┬──────────┴───────────────────┘
                               │ HTTP (DEV only)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│   Vite Dev Plugin: editor-fs-api                            │
│   - GET  /__editor/levels         列出所有关卡 YAML         │
│   - GET  /__editor/levels/:id     读取单个 YAML             │
│   - PUT  /__editor/levels/:id     写入单个 YAML             │
│   - POST /__editor/levels/:id/dup 复制关卡                  │
│   - DELETE /__editor/levels/:id   删除关卡（带确认）        │
│                                                             │
│   ⚠ 仅当 process.env.NODE_ENV === 'development' 时挂载      │
└─────────────────────────────────────────────────────────────┘
                               │ js-yaml + fs
                               ▼
                  src/config/levels/*.yaml
```

### 3.1 模块划分

```
src/editor/                  仅 DEV 构建包含
  index.ts                   入口：注册到 Game，监听 F2
  LevelEditor.ts             主控制器（生命周期、模式切换）
  state/
    EditorState.ts           编辑中模型（响应式）+ 撤销栈
    schema.ts                LevelConfig 完整 Zod schema（用于校验 + 默认值）
  io/
    EditorFsClient.ts        前端 HTTP 客户端（封装 fetch /__editor/）
    yamlSerializer.ts        模型 ↔ YAML 双向转换（保字段顺序）
  ui/
    EditorRoot.tsx           顶层布局（顶栏 + 左侧关卡列表 + 中央画布 + 右侧属性面板）
    panels/
      LevelMetaPanel.tsx     关卡元数据表单
      MapToolbar.tsx         地图刷涂工具栏
      PathEditor.tsx         路径拐点编辑器
      WaveListPanel.tsx      波次列表
      WaveEditorPanel.tsx    单波详情编辑
      RandomPoolPanel.tsx    天气/装饰/扰动池
      DifficultyPanel.tsx    难度乘数
    widgets/
      TilePicker.tsx
      UnitPicker.tsx         从 unitConfigRegistry 拉取
      ObstaclePicker.tsx
  preview/
    EditorRenderer.ts        复用 MapRenderer/EntityRenderer，关闭交互层
    PathOverlay.ts           路径可视化（拐点圆点 + 连线 + 序号）
    BrushOverlay.ts          刷涂高亮、悬停 tile 提示

vite-plugins/
  editor-fs-api.ts           Vite Dev Plugin：注册 /__editor/* 中间件
```

### 3.2 关键依赖

| 依赖 | 用途 | 备注 |
|------|------|------|
| `js-yaml` | YAML 序列化/反序列化 | 项目已用 |
| `zod` | LevelConfig schema 校验（新增） | 提供 schema 即文档 + 默认值 + 类型推导 |
| 现有 PixiJS 渲染管线 | 地图预览渲染 | 复用 `MapRenderer` 等 |
| Vite dev middleware API | 暴露文件读写 HTTP 接口 | 仅 DEV |

### 3.3 UI 框架决策（v1.0 已选定）

> **UI 层选定 Preact（~3KB gzip）**，决策日期 2026-05-13。

理由：
- 编辑器以表单/列表为主，HTML/CSS + 组件化表达效率远高于 PixiJS。
- 不污染游戏渲染管线 —— 用绝对定位的 `<div>` 覆盖在 canvas 上。
- Preact 体积小（~3KB gzip），API 与 React 高度兼容，TSX 友好，开发体验远优于自写 signal。
- DEV-only —— 编辑器全部代码走 `import.meta.env.DEV` 守卫，Vite tree-shake 时 Preact 与编辑器代码一同剥离，**production bundle 体积 = 0 字节**（验收 §13）。

技术细节：
- 入口：`src/editor/index.ts` 通过 `if (import.meta.env.DEV)` 动态 `import('./LevelEditor')`，编辑器与 Preact 都在动态导入分支内，生产构建静态分析后整段死代码消除。
- 组件文件后缀 `.tsx`，`tsconfig.json` 需启用 `jsx: "preserve"` + `jsxImportSource: "preact"`（或在 vite 配置中通过 `@preact/preset-vite` 处理）。
- 不引入 `react`/`react-dom`，所有组件全部 import 自 `preact`。
- 状态管理：Preact 自带 `signal`（`@preact/signals`）或本地 `useState`，按面板复杂度选择。
- 样式：原生 CSS（编辑器专属 `src/editor/styles.css`），不引入 CSS-in-JS。

依赖增量：
- `preact` `^10.x` —— UI 框架
- `@preact/signals` `^1.x` —— 响应式状态（按需）
- `@preact/preset-vite` `^2.x` —— Vite 集成 + TSX 处理
- `zod` `^3.x` —— LevelConfig schema 校验

> 所有依赖均挂在 `devDependencies` 下，并通过 vite plugin `apply: 'serve'` 与 `import.meta.env.DEV` 双重保险确保不进入 production。

---

## 4. 数据流（最重要章节）

### 4.1 编辑器内数据模型

`EditorState` 是编辑会话的核心模型，结构与 YAML 一一对应：

```typescript
interface EditorState {
  // 当前打开的关卡（克隆于磁盘 YAML）
  currentLevel: LevelConfig | null;

  // 磁盘上的原始 YAML（用于「重置改动」「未保存判定」）
  diskSnapshot: LevelConfig | null;

  // 文件系统状态
  loadedLevels: Array<{ id: string; filename: string; name: string }>;

  // 编辑器 UI 状态
  ui: {
    activeTool: 'paint' | 'path' | 'obstacle' | 'select';
    activeTileType: TileType;
    selectedWaveIndex: number | null;
    cursorTile: { row: number; col: number } | null;
    dirty: boolean;          // 未保存改动
  };

  // 撤销栈（深拷贝快照，上限 50 步）
  history: { stack: LevelConfig[]; cursor: number };
}
```

### 4.2 读写流程

#### 加载

```
用户点击关卡列表项
  → EditorFsClient.fetchLevel(id)
  → GET /__editor/levels/:id
  → 后端 fs.readFile → 返回 YAML 字符串
  → yamlSerializer.parse(yaml) → LevelConfig
  → schema.parse(config) → 校验并填充默认值
  → 写入 EditorState.currentLevel + diskSnapshot
  → EditorRenderer 重绘
```

#### 保存

```
用户点击保存（或 Ctrl+S）
  → schema.parse(state.currentLevel) → 强校验
  → 校验失败：弹出错误清单（行内高亮），不提交
  → 校验通过：yamlSerializer.stringify(level) → YAML 字符串
  → PUT /__editor/levels/:id { content }
  → 后端先写临时文件 → fs.rename 原子替换
  → 返回新的 mtime + 内容
  → 客户端更新 diskSnapshot，dirty = false
```

> Vite 在 DEV 模式默认监听 `src/**`，YAML 写入后会触发 HMR。但 `config/loader.ts` 是 eager 导入，HMR 不会自动重建关卡数据。为避免「保存后试玩仍是旧数据」，**试玩按钮强制走运行时旁路**（详见 §6）。

### 4.3 YAML 序列化保真要求

| 要求 | 实现策略 |
|------|---------|
| 字段顺序与现有 YAML 一致（map → waves → starting → available → weather → 池） | `yamlSerializer.stringify` 内部按 schema 声明顺序构造对象 |
| 二维 `tiles` 数组用流式数组（每行一行） | `js-yaml` 的 `flowLevel` 设置 + 手动后处理 |
| 注释**不保留**（已接受的折衷） | 编辑器保存会丢失原 YAML 的注释。若需保留，未来考虑用 `yaml`（eemeli/yaml）库的 CST 接口。 |
| 未识别字段透传 | schema 用 `.passthrough()`，并在 `EditorState` 中保存额外字段 |
| 浮点数避免精度膨胀 | 数值字段在 schema 中限定精度（如 mult 保留 1 位小数） |

---

## 4.5 多生成口与多路径（核心需求）

> ⚠️ **数据模型升级**：v1.0 编辑器从一开始就支持**多生成口 + 每生成口独立路径**。原 `enemyPath: GridPos[]` 单路径模型废弃。

### 4.5.1 需求要点

1. 一个关卡可有 **N 个敌人生成口**（spawn），N ≥ 1（早期关卡可仅 1 个）
2. 每个生成口对应**自己的一条路径**（path），从该 spawn 走到水晶
3. **不同路径在地图上可以交叉、可共享 path tile**（视觉上是同一条 path tile），但**逻辑上每个敌人始终走自己的 spawn 路径**
4. 生成口 A 出生的敌人只走 path A；生成口 B 出生的敌人只走 path B
5. 波次配置可以**指定敌人编组从哪个生成口出**

### 4.5.2 升级后的数据模型（图结构）

路径不再是"折线数组"，而是**节点 + 有向加权边的 DAG（有向无环图）**。
- 节点（`PathNode`）落在 tile 上，分四种角色：`spawn / waypoint / branch / portal / crystal_anchor`
- 边（`PathEdge`）从一个节点连到下一个节点，**同一节点出度 ≥ 1**；出度 > 1 = 分支点，按权重随机
- 分支语义：**敌人到达分支节点时，按出边权重随机选一条**（采用 `waveRandom` 种子流，详见 [07 §2.3.3](../10-gameplay/13-map-level.md#233-多流隔离)），选定后沿该边走到下一节点
- 传送门：特殊节点，**敌人到达后瞬移到指定目标节点**继续行走（详见 §4.6）
- 拓扑约束：**DAG**（禁止环路），但 portal 跳转**不计入环路检测**（portal 是逻辑跳转，不是图边）

```yaml
# 新（v1.0，DAG + 分支 + 传送门）
map:
  spawns:
    - { id: spawn_a, row: 0, col: 0, name: "北口" }
    - { id: spawn_b, row: 8, col: 0, name: "南口" }
  pathGraph:
    nodes:
      - { id: a0, row: 0, col: 0,  role: spawn,    spawnId: spawn_a }
      - { id: a1, row: 0, col: 10, role: waypoint }
      - { id: a2, row: 0, col: 20, role: branch }                       # 分支点
      - { id: a3, row: 4, col: 20, role: waypoint }
      - { id: a4, row: 4, col: 10, role: portal,   teleportTo: b2 }     # 传送门
      - { id: a5, row: 4, col: 1,  role: crystal_anchor }
      - { id: b0, row: 8, col: 0,  role: spawn,    spawnId: spawn_b }
      - { id: b1, row: 8, col: 10, role: waypoint }
      - { id: b2, row: 8, col: 20, role: waypoint }                     # portal 落点
      - { id: b3, row: 4, col: 20, role: crystal_anchor }
    edges:
      # spawn_a 的主干
      - { from: a0, to: a1 }
      - { from: a1, to: a2 }
      # a2 是分支点：60% 走南绕路，40% 直接传送
      - { from: a2, to: a3, weight: 60 }
      - { from: a2, to: a4, weight: 40 }
      - { from: a3, to: a5 }
      # spawn_b 的主干
      - { from: b0, to: b1 }
      - { from: b1, to: b2 }
      - { from: b2, to: b3 }

waves:
  - waveNumber: 1
    spawnDelay: 2
    enemies:
      - { enemyType: grunt,  count: 5, spawnInterval: 1.5, spawnId: spawn_a }
      - { enemyType: runner, count: 3, spawnInterval: 1.0, spawnId: spawn_b }
      # spawnId 缺省时使用 spawns[0]
```

#### TypeScript 类型（替换 `src/types/index.ts` 中的 `enemyPath`）

```typescript
type PathNodeRole = 'spawn' | 'waypoint' | 'branch' | 'portal' | 'crystal_anchor';

interface PathNode {
  id: string;                 // 关卡内唯一，正则 ^[a-z][a-z0-9_]*$
  row: number;
  col: number;
  role: PathNodeRole;
  spawnId?: string;           // role='spawn' 时必填，指向 spawns[].id
  teleportTo?: string;        // role='portal' 时必填，指向另一节点的 id（详见 §4.6）
}

interface PathEdge {
  from: string;               // node.id
  to: string;                 // node.id
  weight?: number;            // 分支点出边权重（默认 1）；非分支点忽略
}

interface PathGraph {
  nodes: PathNode[];
  edges: PathEdge[];
}

interface SpawnPoint {
  id: string;
  row: number;
  col: number;
  name?: string;
}

interface MapConfig {
  cols: number;
  rows: number;
  tileSize: number;
  tiles: TileType[][];
  spawns: SpawnPoint[];               // 至少 1 个
  pathGraph: PathGraph;               // 替代旧 enemyPath / paths
  tileColors?: Partial<Record<TileType, string>>;
  obstacles?: Obstacle[];
}

interface WaveEnemyGroup {
  enemyType: string;
  count: number;
  spawnInterval: number;
  spawnId?: string;           // 缺省 → spawns[0]
}
```

#### 与拐点折线的关系

旧的"拐点列表"在新模型中等价于：**节点序列 + 节点间默认单出边**。两个相邻节点之间在 tile 网格上仍然是**同行或同列**直线段（保持现有 `MovementSystem` 的拐点折线推进算法不变），多个拐点之间的连续直线由系统按节点 id 序列还原。

> **`tiles` 中 `spawn` 类型 tile 与 `spawns[]` 的关系**：每个 `spawns[i]` 必须落在 `tiles` 中标记为 `spawn` 的格上，且地图上所有 `spawn` 格必须有对应的 `spawns` 条目（一一对应）。编辑器维护这个不变量（§4.5.5）。

### 4.5.3 敌人实体的图遍历

敌人不再持有"整条路径数组"，而是持有**当前所在节点 id + 朝向下一节点的目标**：

- 敌人组件新增字段：
  - `spawnId: string` — 出生绑定的生成口（不可变）
  - `currentNodeId: string` — 当前出发节点
  - `targetNodeId: string` — 当前正在走向的下一节点
- `WaveSystem` 生成敌人时：`currentNodeId = spawn.startNodeId`，调用 `chooseNext(currentNodeId)` 写入 `targetNodeId`
- `MovementSystem` 每帧推进敌人朝 `targetNodeId` 走（仍是同行/同列拐点折线运动）
- 抵达 `targetNodeId` 时：
  - 若该节点 `role === 'portal'`：瞬移到 `teleportTo` 节点，将 `currentNodeId = teleportTo`（详见 §4.6）
  - 若该节点 `role === 'crystal_anchor'`：进入水晶攻击范围，触发水晶秒杀逻辑（不变）
  - 否则：`currentNodeId = targetNodeId`，调用 `chooseNext(currentNodeId)` 选下一节点
- **`chooseNext(node)`**：
  - 列出该节点所有出边 `outEdges`
  - 若出度 = 0：不应发生（除非到达 `crystal_anchor`），视为错误并销毁敌人
  - 若出度 = 1：直接选该边
  - 若出度 > 1：按 `edge.weight`（默认 1）加权随机，用 `world.waveRandom`（确定性 PRNG，保证 Replay 可复现）
- **关键约束**：随机选边只在抵达节点瞬间执行一次，结果记录在 `targetNodeId`。敌人在两节点之间运动过程中**不再二次随机**——保证敌人沿当前选定的折线段直线推进。
- 共享 path tile（两条路径在视觉上踩同一格）不会让敌人切换路径，因为图遍历完全由节点 id 决定，与 tile 坐标无关。

### 4.5.4 渲染规则（图可视化）

#### 战斗中
- 所有节点经过的 tile 合并渲染为 path tile，玩家看到的就是一张"路网"
- 分支点 / 传送门**对玩家可见**（不同于普通路点）：
  - 分支点：在 tile 上叠加 **菱形标识** + 出边引导箭头，告诉玩家"这里会随机分流"
  - 传送门入口：**漩涡图标 + 颜色 A**；传送门出口（`teleportTo` 指向的节点）：**漩涡图标 + 颜色 A**（颜色配对，玩家一看就知道入口与出口的对应关系）

#### 编辑器中
- 节点用不同形状区分角色：spawn = 三角、waypoint = 实心圆、branch = 菱形、portal = 漩涡、crystal_anchor = 五角星
- 边用箭头线连接节点
- 每个 spawn 出发可达的子图用**独立颜色**绘制；DAG 中"被多个 spawn 共用"的节点/边用**多色叠加**或灰色中性色（避免混淆）
- 调色板按 `spawns[]` 顺序循环：`#ff4081 / #29b6f6 / #fdd835 / #66bb6a / #ab47bc`；超过 5 个回退到 hash 染色
- 分支点旁边显示**各出边的权重**（如 `60% / 40%`）
- 传送门入口和出口用**虚线弧**连起来（仅编辑器可见），方便策划核对配对关系

### 4.5.5 不变量（编辑器强制维护）

| # | 不变量 | 维护时机 |
|---|--------|---------|
| I1 | 每个 `spawn` tile 必有一条对应的 `spawns[]` 记录与一个 `role='spawn'` 的 `PathNode` | 刷涂 `spawn` tile 时自动新建；删除 `spawn` tile 时联动删除 spawn 记录 + spawn 节点 + 仅由该 spawn 可达的子图（弹确认） |
| I2 | 每个 `spawns[i]` 的位置 tile 必须是 `spawn` 类型 | 拖动生成口时联动改 tile；spawn tile 被刷成其他类型时弹确认 |
| I3 | 节点 id 关卡内唯一 | 创建/重命名节点时实时校验 |
| I4 | 每个 `role='spawn'` 节点必须有 `spawnId` 指向某个 `spawns[].id` | 编辑节点角色时强制；删除 spawn 时联动 |
| I5 | 每个 `role='portal'` 节点必须有合法 `teleportTo`（指向另一个存在的节点） | 实时校验；目标节点被删时联动清空并提示 |
| I6 | 从任一 spawn 节点出发，沿图边遍历可达**至少一个** `crystal_anchor` 节点 | 保存前校验；走 portal 边的可达性视为有效 |
| I7 | 从任一节点出发，沿图边**不可形成环路**（portal 跳转不算图边，不计入环检测） | 实时增量检测；新增边导致环时阻止该边 |
| I8 | 同一节点的所有出边权重和 > 0；权重必须为非负整数 | 实时校验 |
| I9 | 相邻节点（沿图边）位置必须同行或同列（保留拐点折线模型，便于 `MovementSystem` 复用） | 实时校验；不满足时显示红色虚线警示 |
| I10 | 两节点间的连接线段经过的所有 tile 必须是 `path / spawn / crystal` 类型 | 实时校验；刷 tile 破坏路径时弹确认 |
| I11 | `waves[].enemies[].spawnId` 若指定，必须存在于 `spawns[].id` 中；缺省时使用第一个 spawn | 实时校验 + 保存前校验 |
| I12 | 至少 1 个 spawn、至少 1 个 crystal_anchor、至少 1 条边 | 保存前校验 |
| I13 | 每个非 `crystal_anchor` 节点至少有 1 条出边（否则敌人会"卡死"） | 保存前校验；新增节点默认无出边但允许临时存在，仅在保存前强校验 |

### 4.5.6 编辑器交互（图模式）

#### 工具栏（路径模式下的子工具）

| 子工具 | 快捷键 | 行为 |
|--------|--------|------|
| 选择 | `1` | 点击节点/边显示属性面板；拖动节点位置（同步改 tile） |
| 添加节点 | `2` | 在 tile 上点击新建 `waypoint` 节点；右键选择角色 |
| 添加边 | `3` | 点击源节点 → 点击目标节点 → 创建有向边；自动检测环路 I7，违规则拒绝创建 |
| 删除 | `4` | 点击节点/边删除；删除节点时联动删除其所有入边/出边 |
| 标记分支 | `5` | 点击节点，若其出度 ≥ 2 则切换为 `branch` 角色（出度 1 时禁用） |
| 添加传送门 | `6` | 点击节点 → 转为 `portal` 角色 → 再点击目标节点设置 `teleportTo` |

#### 右侧属性面板

**「生成口列表」分区**：
- 列出所有 spawn（颜色块 + 名称 + 坐标 + 子图节点数）
- 「+ 新增生成口」→ 提示在地图上点击空地 → 自动 `tiles[r][c]='spawn'` + 创建 `spawns[]` 记录 + 创建对应 `role='spawn'` 节点
- 每条 spawn 行：编辑名称 / 删除（弹确认：会级联删除仅该 spawn 可达的子图）/ **"高亮该子图"** 切换按钮

**「选中节点」分区**（点击节点后显示）：
- 节点 id（可重命名）
- 角色 select：waypoint / branch / portal / crystal_anchor（spawn 不可改）
- 坐标（row/col 数值输入，同时支持拖动）
- 角色相关字段：
  - `spawn`：spawnId 下拉
  - `portal`：teleportTo 下拉（列出所有非 portal 节点）
  - `crystal_anchor`：无额外字段
- 出边列表（每行：to + weight + 删除）
- 入边列表（只读，列出所有指向本节点的边）

**「选中边」分区**：
- from / to（只读）
- weight 数值输入（仅 from 为 branch 时生效，否则置灰）
- 删除按钮

#### 可视化策略
- 当前选中节点高亮蓝色边框
- 鼠标 hover 节点时高亮其所有出边 + 沿出边可达的节点（半透明）
- 顶栏新增"可见性"过滤器：全部 / 仅选定 spawn 的子图 / 仅显示分支与传送门
- 分支点旁标注出边权重（如 `60%`、`40%`）
- 传送门入口/出口用虚线弧连接（颜色与该传送门配色一致）

#### 安全交互
- 删除分支点的最后一条出边 → 自动降级为 `waypoint` 角色
- 添加第二条出边给 `waypoint` → 提示是否升级为 `branch`
- 删除传送门目标节点 → 该 portal 自动清空 `teleportTo` 并标红警示，不允许保存

### 4.5.7 图校验算法（DAG + 分支 + 传送门）

```
function validatePathGraph(map):
  errors = []

  # 基础存在性（对应 I12）
  if map.spawns.length == 0: errors.push("至少需要 1 个生成口")
  nodes = map.pathGraph.nodes
  edges = map.pathGraph.edges
  if nodes.empty: errors.push("路径图为空")
  if not exists(n in nodes where n.role == 'crystal_anchor'):
    errors.push("缺少 crystal_anchor 节点")

  # 节点完整性（对应 I3/I4/I5）
  ids = set()
  for n in nodes:
    if n.id in ids: errors.push(`节点 id 重复: ${n.id}`)
    ids.add(n.id)
    if n.role == 'spawn' and (not n.spawnId or n.spawnId not in spawnIdSet):
      errors.push(`spawn 节点 ${n.id} 未绑定有效 spawnId`)
    if n.role == 'portal':
      if not n.teleportTo: errors.push(`portal 节点 ${n.id} 缺少 teleportTo`)
      elif n.teleportTo not in ids: errors.push(`portal 节点 ${n.id} teleportTo 指向不存在的节点`)

  # 几何连通性（对应 I9/I10）
  for e in edges:
    a = nodeById(e.from); b = nodeById(e.to)
    if not a or not b: errors.push(`边 ${e.from}->${e.to} 引用不存在的节点`); continue
    if a.row != b.row and a.col != b.col:
      errors.push(`边 ${e.from}->${e.to} 不在同行/同列`)
    for (r,c) in segment(a, b):
      if map.tiles[r][c] not in ('path', 'spawn', 'crystal'):
        errors.push(`边 ${e.from}->${e.to} 经过非 path 格 (${r},${c})`)

  # 出度与角色一致性（对应 I8/I13）
  for n in nodes:
    out = edges.filter(e => e.from == n.id)
    if n.role != 'crystal_anchor' and out.empty:
      errors.push(`非终点节点 ${n.id} 没有出边`)
    if n.role == 'branch' and out.length < 2:
      errors.push(`branch 节点 ${n.id} 出度 < 2，应降级为 waypoint`)
    weightSum = sum(e.weight ?? 1 for e in out)
    if weightSum <= 0:
      errors.push(`节点 ${n.id} 出边权重和为 0`)
    for e in out:
      if (e.weight ?? 1) < 0:
        errors.push(`边 ${e.from}->${e.to} 权重为负`)

  # 环路检测（对应 I7，portal 不计入图边）
  if hasCycle(nodes, edges):
    errors.push("路径图存在环路")

  # 从每个 spawn 出发可达 crystal_anchor（对应 I6）
  for spawnNode in nodes.filter(role == 'spawn'):
    if not canReachCrystalAnchor(spawnNode, edges, portalMap):
      errors.push(`从生成口 ${spawnNode.id} 出发无法抵达任何 crystal_anchor`)

  # 波次引用合法性（对应 I11）
  for waveIdx, wave in enumerate(waves):
    for groupIdx, group in enumerate(wave.enemies):
      if group.spawnId and group.spawnId not in spawnIdSet:
        errors.push(`波 ${waveIdx+1} 编组 ${groupIdx+1} 引用了不存在的生成口 ${group.spawnId}`)

  return errors

# canReachCrystalAnchor:
# DFS 从 spawn 节点出发，沿图边和 portal 跳转，能否抵达任意 crystal_anchor。
# portal 节点的"逻辑后继"是 teleportTo 节点的所有出边目标。
```

### 4.5.8 现有关卡 YAML 迁移（一次性）

- `level-01.yaml` ~ `level-05.yaml` 当前均为单路径 + 单生成口
- 迁移规则（**单路径 → 线性图**）：
  - 生成一个 `spawn` 条目：`id = "spawn_0"`，坐标取原 `enemyPath[0]`
  - 把原 `enemyPath` 数组转为线性图：
    - 第 0 个拐点 → `PathNode { id: "n0", role: 'spawn', spawnId: 'spawn_0' }`
    - 中间拐点 → `waypoint`
    - 最末拐点 → `crystal_anchor`
    - 相邻拐点间生成一条无权重的有向边
  - 波次中所有 `enemies` 不写 `spawnId`（缺省回退到 `spawn_0`），保持现有行为不变
- 迁移由编辑器首次打开旧 YAML 时**自动完成并立即保存**（带迁移备注日志），或提供 `npm run editor:migrate` 一次性脚本
- 迁移完成后旧字段 `enemyPath` 彻底删除（不保留双轨）

> **回归铁律遵守**：迁移后单路径关卡的行为必须与迁移前**完全一致**——线性图（出度均为 1，无分支无传送门）的图遍历语义等价于沿数组推进。Phase D 的"保真测试"扩展为：迁移前后跑同一个关卡的自动化战斗回放，结果一致才算通过。

### 4.5.9 影响代码改动清单

| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | `MapConfig.enemyPath` 删除，新增 `spawns / pathGraph`；新增 `PathNode / PathEdge / PathGraph / PathNodeRole` 类型；`WaveEnemyGroup.spawnId?` |
| `src/core/components.ts` | 敌人组件新增 `spawnId / currentNodeId / targetNodeId` 字段（节点 id 用紧凑索引或字符串） |
| `src/systems/WaveSystem.ts` | 取 spawn 位置改为查 `map.spawns[spawnIdx]`；敌人初始化时调 `chooseNext` 写入 `targetNodeId` |
| `src/systems/MovementSystem.ts` | 重构为图遍历：抵达 target 时执行 portal 跳转 / 分支随机 / 推进；保留拐点折线运动 |
| `src/systems/PathGraph.ts`（新增） | 封装节点查找、出边查询、`chooseNext(node, rng)` 加权随机、portal 解析 |
| `src/config/levels/*.yaml` | 5 个现有关卡迁移到新结构（保持行为不变） |
| `src/data/levels/level-*.ts` | 若有重复（编译期硬编码），同步迁移；评审时确认是否仍在用 |
| `src/render/MapRenderer.ts` | 渲染所有 spawn / branch / portal / crystal_anchor 标记；编辑器渲染额外覆盖多色子图 overlay 与权重标签 |
| 各 `*.test.ts` | 涉及路径访问的测试更新；新增 PathGraph 单元测试 |

> 该改动属于"结构性升级"，但保留**所有现有玩法功能不变**——不属于「roguelike 重构」豁免，必须满足 [回归铁律](../../AGENTS.md#-回归铁律新增修改需求不得破坏已有功能)：现有 L1-L5 通关流程零退化。

---

## 4.6 传送门（Portal）

> 传送门是图模型中的特殊节点，把敌人**瞬移**到另一节点继续行走。

### 4.6.1 配置

```yaml
- { id: portal_in,  row: 4, col: 10, role: portal, teleportTo: portal_out }
- { id: portal_out, row: 0, col: 20, role: waypoint }
```

- 任意非 portal、非 spawn 节点都可作为 `teleportTo` 目标
- portal **不能链式跳转**（`teleportTo` 目标不能是另一个 portal）——保证逻辑收敛、易于 debug
- portal 出口节点可以是任意 spawn 的子图内的节点（实现"跨路径合流"）

### 4.6.2 运行时行为

1. 敌人 `targetNodeId = portal_in`，沿边走到 portal_in 的几何位置
2. 抵达瞬间：
   - 视觉特效：原地播放传送特效（漩涡缩放 + 颜色 A），目标位置播放传送出特效（漩涡膨胀 + 颜色 A）
   - 音效：`sfx_portal_teleport`（新增，待 [10-audio](../40-presentation/46-audio.md) 评估）
   - 实体坐标瞬移到 `teleportTo` 节点的几何位置
   - `currentNodeId = teleportTo`，调用 `chooseNext(currentNodeId)` 选下一节点（若 `teleportTo` 是 branch，仍会触发加权随机）
3. 在传送瞬间敌人**不计入移动距离**，攻速/buff/debuff 计时不重置

### 4.6.3 视觉与玩家可读性

- 传送门入口/出口共享一个 ID（如 "Portal #1"），用同色漩涡标记（系统按出现顺序分配色板：紫 / 青 / 黄 / 橙 / 粉）
- 战斗中地图始终显示传送门标识，帮助玩家理解敌人为什么"凭空消失又出现"
- 鼠标 hover 传送门时显示"传送到 (row, col)" 文字提示（仅 DEV 调试模式）

### 4.6.4 校验（已包含在 §4.5.7）

- I5: `teleportTo` 必须指向存在的非 portal 节点
- portal 出口节点必须仍能可达某个 crystal_anchor（递归 §4.5.7 中 `canReachCrystalAnchor`）

### 4.6.5 编辑器中的传送门工具

- 工具栏「添加传送门」→ 点击源节点（转 portal 角色）→ 点击目标节点（设 `teleportTo`）
- 创建后两节点用**虚线弧 + 配对色**连接，hover 时高亮
- 删除传送门：清空 `teleportTo`，角色回退为 `waypoint`

---

## 4.7 场景互动机关与 trap_path（v3.2 新增）

> 权威设计 → [27-traps-spells-scene §4.2](../20-units/27-traps-spells-scene.md#42-场景互动机关sceneinteractables) + [§2.5](../20-units/27-traps-spells-scene.md#25-trap_path-tile-机制)。

### 4.7.1 LevelConfig schema 扩展

```typescript
interface LevelConfig {
  // ...沿用 v3.1 字段（id / theme / waveCount / pathGraph / ...）

  // v3.2 新增：场景互动机关（与关卡主题强绑定）
  sceneInteractables?: SceneInteractableConfig[];

  // v3.2 新增：中立资源点随机池（关卡随机生成）
  neutralPool?: NeutralPoolEntry[];

  // v3.2 新增：trap_path 标记区间（哪些 path tile 允许部署陷阱）
  // 若不指定，默认所有 path tile 都不可埋陷阱
  trapPathSegments?: Array<{ from: Vec2; to: Vec2 }>;
}

interface SceneInteractableConfig {
  unitId: UnitID;                              // 引用 `category: Scene` 单位（火药桶/墓碑/藤蔓/诅咒神龛...）
  position: Vec2;                              // 固定坐标（与 tile 网格对齐）
  triggerCondition?:
    | 'on_click'                               // 玩家点击
    | 'on_enemy_touch'                         // 敌人触碰
    | 'on_tower_attack'                        // 塔攻击命中
    | 'periodic'                               // 按周期自动触发
    | 'on_chain'                               // 被其他场景机关爆炸链锁
    | 'on_wave_start';                         // 每波开始时触发
  triggerCooldown?: number;                    // 触发冷却（秒）
  themeRestriction?: LevelTheme[];             // 仅限关卡主题（用于校验）
}

interface NeutralPoolEntry {
  unitId: 'gold_chest' | 'healing_spring' | 'mana_crystal' | 'ancient_altar';
  weight: number;                              // 抽取权重
  spawnArea?: Array<Vec2>;                     // 允许出现的格位（默认全图空地）
  maxCount?: number;                           // 每关上限（默认 1）
}
```

### 4.7.2 编辑器 UI 扩展

- 工具栏新增「场景机关」页签：列出当前关卡主题允许的 `Scene` 单位（按 themeRestriction 过滤）
- 拖拽场景单位到地图：自动写入 `sceneInteractables[]`，触发条件可在右侧属性面板配置
- 工具栏新增「trap_path 笔刷」：刷在 `path` tile 上，标记为可埋陷阱区间；视觉为虚线轮廓
- 右侧 Inspector：选中场景机关后展示 `triggerCondition` 下拉、`triggerCooldown` 数值、关联 RuleHandler 预览

### 4.7.3 校验规则（schema.parse 强校验）

1. `sceneInteractables[].unitId` 必须存在于 `category: Scene` 单位注册表，否则报错
2. `themeRestriction` 与 `LevelConfig.theme` 不匹配 → 警告（允许跨主题但提示设计师）
3. `trapPathSegments` 内所有坐标必须是 `path` tile，否则报错
4. `neutralPool[].spawnArea` 内所有坐标必须是 `empty` tile，否则报错
5. 每关 `sceneInteractables` 数量 ≤ 8（防止过载，可在 §6 试玩中实时验证）

### 4.7.4 现有关卡迁移

- 旧 LevelConfig 无以上字段 → loader 自动填充空数组 `[]`，行为与 v3.1 完全一致
- 新增字段全部 `optional`，向后兼容
- 一键迁移工具（DEV-only）：对每个关卡按主题自动建议 sceneInteractables（设计师二次确认后写入）

---

## 5. UI 总体布局

```
┌──────────────────────────────────────────────────────────────────────┐
│ 关卡编辑器                                                            │
│ [📂 加载] [💾 保存] [🔄 重置] [▶ 试玩] [➕ 新建] [📋 复制] [关闭 ✕]    │
├────────────┬──────────────────────────────────────┬──────────────────┤
│            │                                      │                  │
│ 关卡列表   │                                      │ 属性面板         │
│            │       预览画布                       │  （上下文敏感）  │
│ ▸ L1 平原  │       (PixiJS, 1344×576)             │                  │
│   L2 森林  │                                      │ ▸ 元数据         │
│   L3 沼泽  │                                      │ ▸ 地图工具       │
│   ...      │                                      │ ▸ 波次           │
│            │                                      │ ▸ 随机池         │
│            │                                      │ ▸ 难度           │
│            │                                      │                  │
│            ├──────────────────────────────────────┤                  │
│            │ 工具栏: [🖌 Tile][📍 路径][🌳 装饰] │                  │
│            │ 当前: empty | 行: 3 | 列: 8 | 笔刷 1 │                  │
└────────────┴──────────────────────────────────────┴──────────────────┘
```

### 5.1 区域职责

| 区域 | 职责 |
|------|------|
| 顶栏 | 文件操作（加载/保存/重置/新建/复制/试玩/关闭），未保存指示器（`*`） |
| 左侧关卡列表 | 列出 `config/levels/*.yaml`，点击切换；右键菜单：删除、在文件管理器中显示（开发体验） |
| 中央预览画布 | PixiJS 渲染当前 `currentLevel`，叠加编辑可视化层（路径拐点、可放置高亮等） |
| 画布下方状态栏 | 显示当前工具、悬停坐标、笔刷参数 |
| 右侧属性面板 | 折叠分区：元数据 / 地图工具 / 波次列表 / 随机池 / 难度。当前激活工具的面板自动展开 |

### 5.2 工具模式（互斥）

| 模式 | 快捷键 | 行为 |
|------|--------|------|
| **Tile 刷涂** | `B` | 点击/拖动画 tile 类型（empty / path / blocked / spawn / base / crystal）。右键吸取当前 tile 类型 |
| **路径绘制** | `P` | 在 tile 上点击添加 `enemyPath` 拐点；拐点按顺序连接；可拖拽已有拐点；右键删除拐点 |
| **装饰物摆放** | `O` | 选择装饰类型后点击放置；右键删除；只能在 `empty` tile 上 |
| **选择/查看** | `Esc` 或 `V` | 默认模式，点击 tile 显示坐标和当前类型，不修改 |

---

## 6. 试玩（实时预览播测）

### 6.1 流程

```
用户点击「▶ 试玩」
  → 若 state.dirty 弹确认：是否先保存？[保存并试玩] [不保存试玩] [取消]
  → 旁路 loader：调用 game.startBattle(state.currentLevel)
    - 关卡数据来自 EditorState，而非 yamlModules
    - 已有 LevelManager / BattleManager 必须支持注入 LevelConfig
  → 切到战斗场景（隐藏编辑器 overlay，恢复游戏循环）
  → 战斗结束（胜/败/玩家手动退出）
  → 自动回编辑器，保留之前的编辑状态
```

### 6.2 注入接口（新增）

为支持试玩，游戏侧需暴露：

```typescript
// src/core/Game.ts 新增
public startBattleWithConfig(level: LevelConfig, options?: {
  startingResources?: Resources;
  skipIntro?: boolean;
  onExit?: () => void;
}): void;
```

> 此接口同时为自动化测试/调试系统复用，不专属于编辑器。

### 6.3 试玩中编辑器状态

- 编辑器 overlay 完全隐藏，但内存中的 `EditorState` 保留
- 试玩中触发的 `Escape` 弹出菜单包含「返回编辑器」选项

---

## 7. 校验与错误处理

### 7.1 Schema 校验项（Zod）

| 项 | 规则 | 错误提示 |
|---|------|---------|
| `map.cols / rows` | 必须 = 21 / 9（v1.0 锁定，未来放开） | "地图尺寸固定为 21×9" |
| `map.tiles` | 二维数组维度 = rows × cols | "地图数据维度与 cols/rows 不一致" |
| 路径连通性 | `enemyPath` 相邻拐点必须能在 path tile 上连成线，且首尾分别在 spawn / 水晶相邻格 | "路径在 (r,c) 与 (r,c) 之间断开" |
| 至少 1 个 spawn 和 1 个 base/crystal | 必填 | "缺少敌人出生点或水晶位置" |
| `waves[].enemies[].enemyType` | 必须存在于 `unitConfigRegistry` 中且 `category === 'Enemy'` | "未知敌人类型: xxx" |
| `available.towers / units` | ID 必须存在于 registry | "未知塔/单位: xxx" |
| 难度乘数 | 0.1 ≤ mult ≤ 5.0 | "倍率超出 [0.1, 5.0]" |
| `starting.gold / energy / maxPopulation` | 非负整数 | "起始资源不能为负" |

### 7.2 校验时机

| 时机 | 行为 |
|------|------|
| 实时（每次字段变更） | 单字段校验，错误即时高亮，但不阻塞继续编辑 |
| 保存前 | 全量校验，任一错误阻塞保存，错误清单一次性展示 |
| 试玩前 | 全量校验 + 路径连通性强校验，错误阻塞试玩 |

### 7.3 路径连通性算法

**多路径模型下的完整算法见 §4.5.7 `validateAllPaths`。** 本节仅作向后兼容索引，不再重复。

---

## 8. Vite 插件：editor-fs-api

### 8.1 职责

- 仅在 Vite dev server 启动时挂载
- 提供 5 个 REST 端点处理 YAML 读写
- 路径锁定到 `src/config/levels/`，防止越权读写其他目录

### 8.2 实现要点

```typescript
// vite-plugins/editor-fs-api.ts
import type { Plugin } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const LEVELS_DIR = path.resolve(__dirname, '../src/config/levels');

export function editorFsApi(): Plugin {
  return {
    name: 'editor-fs-api',
    apply: 'serve',  // 仅 dev
    configureServer(server) {
      server.middlewares.use('/__editor', async (req, res) => {
        // 路由分发：GET/PUT/POST/DELETE
        // 关键安全：所有 :id 必须匹配 /^[a-z0-9_-]+$/，禁止 ../
        // 写入用 fs.writeFile(tmp) + fs.rename 原子替换
      });
    },
  };
}
```

### 8.3 安全约束

| 风险 | 缓解 |
|------|------|
| 路径穿越（`../`） | `:id` 严格白名单正则 + `path.resolve` 后判断仍在 `LEVELS_DIR` 内 |
| 误写入非关卡文件 | 文件名固定为 `${id}.yaml`，扩展名锁定 |
| 删除不可恢复 | DELETE 端点返回前先把目标内容备份到 `.editor-trash/`（开发者手动清理） |
| Production 启用风险 | `apply: 'serve'` 确保仅 dev；前端代码也以 `import.meta.env.DEV` 双重保险 |

---

## 9. 与现有系统的接触面

| 模块 | 接触方式 | 改动 |
|------|---------|------|
| `core/Game.ts` | 新增 `startBattleWithConfig()`；新增 `pause/resume` 钩子 | 小 |
| `config/loader.ts` | 编辑器不通过它加载（直接走 HTTP）；试玩注入也旁路 loader | 0 |
| `render/MapRenderer.ts` | 复用：编辑器渲染 = MapRenderer + 编辑层 overlay；**新增 spawn / branch / portal / crystal_anchor 标记 + 多色子图 overlay + 分支权重标签 + 传送门配对弧线**（仅编辑模式） | **中-大** |
| `debug/` | 调试面板新增「关卡编辑器」入口按钮 | 小 |
| `config/registry.ts` | 编辑器读取 `unitConfigRegistry` 提供 UI 下拉选项 | 0 |
| `config/levels/*.yaml` | 编辑后被覆盖；**单路径迁移到图结构**（§4.5.8） | **中**（结构性升级） |
| `types/index.ts` | `MapConfig` 字段升级（删 `enemyPath`，加 `spawns / pathGraph`）；新增图相关类型 | **中** |
| `core/components.ts` | 敌人组件新增 `spawnId / currentNodeId / targetNodeId` | 小 |
| `systems/WaveSystem.ts` | 改为按 spawn 节点初始化敌人图遍历状态 | 中 |
| `systems/MovementSystem.ts` | **重构为图遍历**：抵达节点 → portal 跳转 / branch 加权随机 / 推进；保留同行/同列拐点折线运动 | **中-大** |
| `systems/PathGraph.ts`（新增） | 图遍历核心：节点/边索引、`chooseNext`、portal 解析、可达性查询 | 新增 |
| `vite.config.ts` | 新增 `editorFsApi()` 插件 | 小 |
| `package.json` | 新增 dev 依赖 `zod` | 小 |

---

## 10. 实施路线图（建议阶段）

### Phase A — 骨架（1-2 天）
1. Vite 插件 `editor-fs-api` 实现 GET/PUT/列出
2. 调试入口 + F2 热键 + 全屏 overlay 容器
3. 关卡列表加载、单个 YAML 显示为只读 JSON

### Phase B — 地图与图编辑（4-5 天）
1. 复用 `MapRenderer` 渲染预览
2. Tile 刷涂工具（含撤销）
3. **生成口（spawn）管理**：新增/重命名/删除/位置拖动，自动同步 `tiles[r][c] = 'spawn'` 与图中 spawn 节点
4. **图编辑工具集**（§4.5.6）：选择/添加节点/添加边/删除/标记分支/添加传送门
5. **图渲染层**：节点角色形状、边箭头、多色子图 overlay、分支权重标签、传送门配对弧线
6. 节点拖动同步坐标 + tile 校验
7. 实时不变量校验（I7 环路检测 / I9 同行同列 / I10 tile 类型）红色高亮
8. 装饰物摆放

### Phase C — 表单编辑（2 天）
1. 元数据表单
2. 波次列表 + 单波编辑（敌人编组）
3. 随机池多选 + 难度乘数

### Phase D — 校验、迁移与运行时图遍历（3 天）
1. Zod schema 完整定义（含 `spawns / pathGraph` 图结构）
2. 实时 + 保存前校验（含 §4.5.7 图校验算法 + §4.5.5 不变量 I1-I13）
3. yamlSerializer 双向往返保真测试
4. **L1-L5 旧 YAML 单路径→线性图迁移**（§4.5.8）：迁移函数 + 单元测试 + 自动化回放回归
5. 实现 `src/systems/PathGraph.ts`：节点索引、`chooseNext` 加权随机（用 `waveRandom`）、portal 解析
6. 重构 `MovementSystem`：图遍历替代数组推进；性能基准测试（确保多路径场景不退化）
7. 改写 `WaveSystem`：spawn 节点初始化敌人 `currentNodeId / targetNodeId`

### Phase E — 试玩（1 天）
1. `Game.startBattleWithConfig()` 实现
2. 试玩流程联调
3. 战斗结束返回编辑器

### Phase F — 体验打磨（1 天）
1. 撤销/重做
2. 复制关卡、新建关卡模板
3. 删除关卡的回收站机制

> **每个 Phase 完成立即提交（铁律：原子提交）。** 每个 Phase 内的功能必须配套测试覆盖。

---

## 11. 测试策略

| 测试类型 | 范围 |
|---------|------|
| 单元测试 | yamlSerializer 双向往返、schema 校验、路径连通性算法 |
| 单元测试 | EditorState 撤销栈、dirty 判定 |
| 集成测试（Node） | Vite 插件的 5 个端点（用 supertest 模拟） |
| 端到端测试（手动） | 加载 → 编辑 → 保存 → 试玩 → 改动生效 全流程 |
| 回归测试 | 用编辑器打开并立即保存现有 L1-L5 YAML，diff 应为空（保真测试） |

> 保真测试是底线：**编辑器开 → 立即存 → diff 必须为空**（除注释外）。这是验证序列化保真的唯一可靠手段。

---

## 12. 决策记录（v1.0 已敲定）

| # | 议题 | 决策 |
|---|------|------|
| 1 | YAML 注释保留 | **接受丢失**。编辑器目标用户不依赖手写注释。未来如需保留再考虑切 `eemeli/yaml` CST。 |
| 2 | 地图尺寸是否可变 | **v1.0 锁定 21×9**。未来若需自定义尺寸需同步调整渲染锚点和水晶位置。 |
| 3 | UI 框架选型 | **Preact（~3KB gzip）**。详见 §3.3。 |
| 4 | 共享 path tile 编辑歧义 | **只对"当前编辑中节点"生效**（§4.5.6）。共享 tile 在 hover 时以列表形式展示所有所属节点。 |
| 5 | `tiles[].type = 'base'` 是否保留 | **编辑器内部统一显示为水晶（crystal）**。迁移时 `base` 透明转 `crystal`，YAML 写回也用 `crystal`。与 [07 §1.2](../10-gameplay/13-map-level.md) 对齐。 |

---

## 13. 验收标准（v1.0）

- [ ] DEV 模式下按 F2 可打开/关闭编辑器，生产构建中 F2 无响应
- [ ] 可加载 `src/config/levels/` 下所有现有关卡，UI 正确展示其全部字段
- [ ] 加载现有任一关卡 → 不做改动 → 保存 → 文件 diff 为空（除注释外）
- [ ] 可在编辑器内完成以下操作并正确写回 YAML：
  - [ ] 刷涂 tile 类型
  - [ ] **新增/重命名/删除生成口（spawn）**
  - [ ] **图编辑**：添加节点（waypoint/branch/portal/crystal_anchor）、添加/删除有向边、拖动节点位置
  - [ ] **分支节点**：出度 ≥ 2 自动提示升级，编辑各出边权重，敌人到达分支节点时按权重随机走一条
  - [ ] **传送门节点**：设置 `teleportTo`，敌人到达后瞬移到目标节点；传送门入口/出口配对染色
  - [ ] **波次编组可指定 `spawnId`，缺省时回退到第一个生成口**
  - [ ] **多个子图在地图上交叉/共享 path tile 时，编辑器视觉区分清晰；战斗中每个敌人按生成口绑定的子图行走，不会因为踩共享格切换到其他 spawn 的子图**
  - [ ] 添加/删除装饰物
  - [ ] 编辑元数据所有字段
  - [ ] 增删波次、编辑敌人编组
  - [ ] 修改随机池与难度乘数
- [ ] 图校验生效（§4.5.7）：节点存在性、portal 合法性、环路检测、可达性、出度、权重和、波次 spawnId 合法性，任一失败阻塞保存并指明
- [ ] §4.5.5 全部 13 项不变量（I1-I13）由编辑器自动维护
- [ ] 试玩按钮可一键启动当前编辑中的关卡战斗，战斗结束返回编辑器
- [ ] **现有 L1-L5 关卡通过 §4.5.8 迁移后行为与迁移前完全一致**（自动化回放验证）
- [ ] 分支节点的随机选择使用 `waveRandom` 流，**同种子下结果可复现**（写回放/调试核心要求）
- [ ] 传送门跳转不影响敌人的 buff/debuff 计时与攻速时序
- [ ] 单元测试覆盖：yamlSerializer 保真、schema 校验、图校验（含环检测/可达性）、Vite 插件路由、迁移函数、PathGraph.chooseNext 加权随机分布
- [ ] 编辑器代码在 production bundle 中体积 = 0（通过 `npm run build` 产物大小验证）

---

## 14. 参考文档

- [07-地图与关卡系统](../10-gameplay/13-map-level.md) — 关卡配置字段语义
- [15-重构方案](./60-architecture.md) — 配置驱动架构
- [20-响应式布局](../40-presentation/41-responsive-layout.md) — 21×9 网格与锚点
- [27-调试系统](./63-debug.md) — 调试入口规范
- [src/config/loader.ts](../src/config/loader.ts) — 现有 YAML 加载流
- [src/config/levels/](../src/config/levels/) — 现有关卡 YAML 范例
