---
title: 架构与重构方案
status: authoritative
version: 1.0.0
last-modified: 2026-05-14
authority-for:
  - system-architecture
  - pipeline-order
  - ecs-rules
  - rule-engine-spec
supersedes: []
cross-refs:
  - 10-gameplay/10-roguelike-loop.md
  - 60-tech/61-save-system.md
---

# 架构与重构方案

> 技术选型评估、架构设计、迁移路线图

---

## 一、当前状态评估

### 1.1 项目规模

| 维度 | 当前 |
|------|------|
| 源码文件 | 78个 TS 文件 |
| ECS系统 | 25个 |
| ECS组件 | 24个 |
| 渲染方式 | Canvas 2D（命令缓冲） |
| 开发阶段 | Phase 2完成 + Phase 3部分完成 |

### 1.2 核心架构问题

| 问题 | 影响 |
|------|------|
| **ECS自研且松散** | 系统间隐式耦合、查询无类型安全、组件管理分散 |
| **单位概念不统一** | 塔/敌人/单位/中立各自独立处理，重复代码多，新增单位需改多处 |
| **逻辑硬编码在系统中** | 新加一个单位需改动类型定义+配置文件+系统逻辑，无法"配置即生效" |
| **缺少规则引擎** | 自爆虫的死亡爆炸、冰塔的冰冻触发等逻辑分散在HealthSystem/ProjectileSystem中 |
| **渲染性能天花板** | Canvas 2D在天气粒子+战斗特效同时运行时帧率不足 |
| **测试覆盖为零** | 无单元测试，回归全靠手动验证 |
| **AI系统过度设计** | 行为树引擎完整但80%的单位只需要简单的"选最近→打" |

---

## 二、技术选型

### 2.1 候选方案对比

| 方案 | 渲染 | ECS | 迁移成本 | 匹配度 |
|------|------|-----|----------|--------|
| **A: Canvas 2D + 自研ECS（现状）** | Canvas 2D | 自研 | — | 低 |
| **B: Canvas 2D + bitecs** | Canvas 2D | bitecs | 中 | 中 |
| **C: PixiJS + bitecs ✅** | PixiJS WebGL | bitecs | 中高 | **高** |
| D: Phaser 3 | WebGL(内置) | 需放弃ECS | 高 | 低 |
| E: Excalibur.js | WebGL(内置) | 自带Actor | 高 | 中 |

### 2.2 最终选型：**PixiJS + bitecs**

**理由**：

1. **bitecs**：业界验证的数据导向ECS，SoA内存布局天然适合"大量实体同屏"的塔防场景。类型安全查询、系统依赖声明、实体生命周期管理开箱即用。

2. **PixiJS**：WebGL渲染 + ParticleContainer专为粒子优化 → 天气粒子+战斗特效同时运行无压力。Graphics API足以绘制几何图形。内置Ticker与游戏循环对齐。

3. **匹配新架构**：bitecs的纯数据组件 + PixiJS的渲染层分离，完美支持"配置驱动"架构——组件从配置动态创建，系统对组件做统一处理。

4. **渐进迁移**：ECS层和渲染层可以分阶段独立验证。

---

## 三、新架构设计

### 3.1 核心原则

```
┌─────────────────────────────────────────────────────────┐
│                    配置驱动架构                           │
│                                                         │
│  配置层 (YAML/JSON) — 策划可编辑                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 单位配置  │  │ 关卡配置  │  │ 技能Buff │              │
│  │ 静态数值  │  │ 地图+波次 │  │ 配置     │              │
│  │ 行为规则  │  │ 随机池   │  │         │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │             │                    │
│  ┌────┴─────────────┴─────────────┴────┐               │
│  │           配置加载 & 解析             │               │
│  └────────────────┬────────────────────┘               │
│                   │                                    │
│  运行时层 — 程序员维护                                   │
│  ┌────────────────┴────────────────────┐               │
│  │         规则引擎 (RuleEngine)        │               │
│  │  · 生命周期事件分发                  │               │
│  │  · 行为规则执行（目标选择/攻击模式）   │               │
│  │  · 行为树（复杂AI补充）              │               │
│  └────────────────┬────────────────────┘               │
│                   │                                    │
│  ┌────────────────┴────────────────────┐               │
│  │         ECS World (bitecs)           │               │
│  │  · 所有单位 = Entity + Components    │               │
│  │  · 系统 = 纯函数处理组件数据          │               │
│  │  · 查询 = 类型安全的 defineQuery     │               │
│  └────────────────┬────────────────────┘               │
│                   │                                    │
│  ┌────────────────┴────────────────────┐               │
│  │        PixiJS 渲染层                 │               │
│  │  · Graphics (几何图形)               │               │
│  │  · ParticleContainer (粒子特效)      │               │
│  │  · Container (UI层级管理)            │               │
│  └─────────────────────────────────────┘               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 规则引擎设计

**核心职责**：将声明式配置转换为运行时行为。

```
配置:                  规则引擎:                ECS系统:
                                                
onDeath:               RuleEngine              HealthSystem
  - type: explode       .onEntityDied()        检测HP≤0
    radius: 100          ↓                      
    damage: 50          查找配置的onDeath规则    
                         ↓                      
                        执行规则: deal_aoe_damage
                         ↓                      
                        调用 dealDamage(entities_in_range, 50)
```

**规则引擎不代替ECS系统**，而是在系统之间提供配置驱动的调度层：

1. HealthSystem 检测单位死亡 → 通知 RuleEngine
2. RuleEngine 查找该单位类型的 onDeath 规则
3. RuleEngine 执行规则（调用相关系统的方法或直接修改组件）

### 3.3 单位创建流程

```
加载关卡配置
  │
  ▼
遍历关卡允许的单位类型
  │
  ▼
从单位配置库 (UnitConfigRegistry) 加载每家单位的配置
  │  配置包含: stats, behavior, lifecycle, ai, visual
  ▼
RuleEngine 预编译行为规则
  │  将声明式规则转为可执行的 Rule 对象
  ▼
运行时创建单位:
  WaveSystem.spawn("grunt") 
    → EntityFactory.create("grunt")
    → 从配置读取 stats → 设置组件数据
    → 注册 lifecycle 规则到 RuleEngine
    → 注册 behavior 规则到 RuleEngine
    → 若配置了 ai_tree → 初始化行为树实例
    → 返回 Entity
```

### 3.4 目录结构

```
src/
├── main.ts                    入口 + PixiJS App + ECS World 初始化
├── core/                      引擎核心
│   ├── World.ts               bitecs World 封装
│   ├── components.ts          所有组件 defineComponent 定义
│   ├── pipeline.ts            系统管线（注册顺序 + 依赖）
│   └── RuleEngine.ts          规则引擎（生命周期 + 行为规则）
├── config/                    配置加载（策划层）
│   ├── loader.ts              配置加载器（解析YAML/JSON → typed对象）
│   ├── registry.ts            单位配置注册表
│   ├── units/                 单位配置文件
│   │   ├── towers.yaml
│   │   ├── soldiers.yaml
│   │   ├── enemies.yaml
│   │   ├── buildings.yaml
│   │   ├── neutrals.yaml
│   │   └── objectives.yaml
│   └── levels/                关卡配置文件
│       ├── level-01.yaml
│       └── ...
├── systems/                   系统逻辑（纯函数 + bitecs query）
│   ├── movementSystem.ts
│   ├── attackSystem.ts
│   ├── projectileSystem.ts
│   ├── waveSystem.ts
│   ├── healthSystem.ts
│   ├── economySystem.ts
│   ├── buildSystem.ts
│   ├── unitSystem.ts
│   ├── skillSystem.ts
│   ├── buffSystem.ts
│   ├── bossSystem.ts
│   ├── productionSystem.ts
│   ├── trapSystem.ts
│   ├── weatherSystem.ts
│   └── renderSystem.ts        PixiJS渲染同步
├── ai/                        复杂AI（行为树作为补充）
│   ├── BehaviorTree.ts
│   └── presets/
│       └── bossTrees.ts
├── render/                    PixiJS渲染层
│   ├── Renderer.ts
│   ├── MapRenderer.ts
│   ├── EntityRenderer.ts
│   ├── ProjectileRenderer.ts
│   ├── ParticleRenderer.ts
│   └── UIRenderer.ts
├── audio/
│   └── AudioManager.ts
├── input/
│   └── InputManager.ts
├── save/
│   └── SaveManager.ts
├── data/                      运行时数据/公式
│   ├── balance.ts             波次缩放公式
│   └── EndlessWaveGenerator.ts
├── debug/
│   └── ...
└── types/
    └── index.ts               枚举 + 配置类型接口
```

---

## 四、迁移路线图

### 阶段0：准备（1-2天）

| 任务 | 产出 |
|------|------|
| 安装依赖 | `bitecs`, `pixi.js`, `js-yaml` |
| 定义组件 Schema | 所有组件改为 bitecs 的 `defineComponent` |
| 建立测试框架 | Vitest + 核心逻辑测试用例 |
| 提取配置文件 | 将硬编码数据导出为 YAML |

### 阶段1：ECS + 规则引擎（核心，4-6天）

**目标**：bitecs替代自研ECS，规则引擎替代硬编码生命周期逻辑。

| # | 任务 |
|---|------|
| 1.1 | 实现 bitecs World 封装 + Entity 工厂 |
| 1.2 | 迁移所有组件为 bitecs Component |
| 1.3 | 实现配置加载器（YAML → 注册表） |
| 1.4 | 实现 RuleEngine：生命周期事件分发 |
| 1.5 | 实现 RuleEngine：行为规则（目标选择/攻击模式/移动模式） |
| 1.6 | 迁移系统（按依赖顺序），逐个验证 |
| 1.7 | 迁移 AI 行为树引擎，适配新 ECS |
| 1.8 | 集成测试：创建 → 战斗 → 死亡全链路 |

**验收标准**：所有现有功能在 bitecs 上正常运行，规则引擎驱动自爆虫爆炸/冰塔冰冻等效果。

### 阶段2：渲染升级（3-4天）

**目标**：PixiJS替换Canvas 2D，重制所有视觉特效。

| # | 任务 |
|---|------|
| 2.1 | 建立 PixiJS Application + Stage 层级 |
| 2.2 | MapRenderer：地图网格 + 主题色 + 装饰 |
| 2.3 | EntityRenderer：实体图形 + 文字 + 血条 + Buff图标 |
| 2.4 | ProjectileRenderer：弹道渲染（5种形状） |
| 2.5 | ParticleRenderer：粒子特效（爆炸/建造/命中/死亡/金币） |
| 2.6 | 天气粒子（雨/雪/雾/夜晚） |
| 2.7 | UIRenderer：HUD + 工具栏 + 信息面板 |
| 2.8 | 过渡动画（场景切换/天气渐变/实体缩放） |
| 2.9 | 调试工具适配新渲染层 |

**验收标准**：所有视觉特效可用，天气粒子流畅，60fps稳定。

### 阶段3：配置完善（2-3天）

| # | 任务 |
|---|------|
| 3.1 | 补齐所有单位的 YAML 配置（含行为规则） |
| 3.2 | 补齐所有关卡的 YAML 配置（含随机池） |
| 3.3 | 补齐技能/Buff 配置 |
| 3.4 | 音频系统接入（Web Audio API） |
| 3.5 | 未完成单位实现（弓手/祭司/工程师/刺客） |

### 阶段4：测试与打磨（2-3天）

| # | 任务 |
|---|------|
| 4.1 | 单元测试：伤害公式、波次生成、经济结算、规则引擎 |
| 4.2 | 集成测试：系统间交互 |
| 4.3 | 性能测试：高波次（100+实体 + 天气粒子）帧率验证 |
| 4.4 | 手动验收：5关 + 无尽模式完整可玩 |
| 4.5 | 已知Bug修复 |

---

## 五、规则引擎细节

### 5.1 生命周期规则接口

```typescript
// 规则引擎在对应时机调用的接口
interface RuleEngine {
  dispatch(event: LifecycleEvent, entity: Entity, context: EventContext): void;
}

type LifecycleEvent = 
  | 'onCreate' | 'onDeath' | 'onHit' | 'onAttack' 
  | 'onKill' | 'onUpgrade' | 'onDestroy' | 'onEnter' | 'onLeave';

// 规则处理器（可扩展）
type RuleHandler = (entity: Entity, params: RuleParams, world: World) => void;

// 注册规则处理器
ruleEngine.registerHandler('deal_aoe_damage', (entity, params, world) => {
  const entities = queryInRadius(world, entity.position, params.radius);
  for (const e of entities) {
    if (e.faction === params.targets) {
      e.health.current -= params.damage;
    }
  }
});
```

### 5.2 行为规则接口

```typescript
interface BehaviorRule {
  targetSelection: (entity: Entity, candidates: Entity[]) => Entity | null;
  attackMode: (entity: Entity, target: Entity, dt: number) => void;
  movementMode: (entity: Entity, dt: number) => void;
}

// 系统调用规则引擎获取决策
function attackSystem(world: World): void {
  for (const eid of attackQuery(world)) {
    const entity = getEntity(world, eid);
    const rule = getBehaviorRule(entity);
    
    const target = rule.targetSelection(entity, enemyQuery(world));
    if (target) {
      rule.attackMode(entity, target, world.dt);
    }
  }
}
```

### 5.3 ~~行为树集成~~ 🛑 v3.4 已 DEPRECATED（实现方式作废，AI 需求保留）

> **2026-05-16 决策**：放弃**行为树作为实现方式**，但 AI 产品需求全部保留。本节原描述的 `ai_tree` 配置字段、boss_commander_ai / abyss_lord_ai 等行为树预设、`src/ai/BehaviorTree.ts` 引擎全部废弃。
>
> **新方案**：所有 AI（含士兵四状态机、Boss、高级敌人）走 §5.1 / §5.2 描述的规则引擎路径——
> - 配置中声明 `targetSelection` / `attackMode` / `movementMode` + 生命周期 `RuleHandler`
> - 由 AttackSystem / MovementSystem / SkillSystem 等具体系统在每帧 query 中查阅
> - 状态字段（如士兵 `state: 警戒/追击/战斗/游荡`）挂在 ECS 组件上，状态转换由帧内条件检测触发
> - Boss 阶段切换由 `onHpThreshold` / `onPhaseTransition` 等生命周期事件 + `RuleHandler` 实现，不再需要 BT `Once` 装饰节点
>
> **AI 需求出处**:
> - 士兵 AI: [`30-ai/31-soldier-ai.md`](../30-ai/31-soldier-ai.md) §1-§5 / §10-§12（需求段仍权威）
> - 敌方威胁度评分: ~~[`30-ai/30-behavior-tree.md §6`](../30-ai/30-behavior-tree.md)~~ → v3.4 由 `targetSelection: threat_score` 配置承载
>
> **决策溯源**: [`design/00-vision/decisions/2026-05-16_drop-behavior-tree.md`](../00-vision/decisions/2026-05-16_drop-behavior-tree.md)

~~行为树作为特殊的行为规则提供者：~~

```yaml
# 🛑 v3.4 已废弃 ai_tree 字段；保留示例仅供历史回溯
boss_commander:
  behavior:
    ai_tree: boss_commander_ai
```

---

## 六、目标对比

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| 新增单位 | 改5-8个文件 | 写1个YAML配置 |
| 新增行为 | 修改系统代码 | 添加生命周期规则 |
| 新增关卡 | 编写TS代码 | 编写YAML配置（可随机） |
| 渲染性能 | Canvas 2D瓶颈 | WebGL + 粒子优化 |
| 测试覆盖 | 0% | 核心逻辑全覆盖 |

---

# 七、v3.0 卡牌化分阶段实施（追加）

> 根据 [25-card-roguelike-refactor](../10-gameplay/10-roguelike-loop.md) 方案，将塔防游戏改造为「卡牌 + Roguelike 长征」。本节定义 v2.x → v3.0 的实施路线图。

## 7.1 v3.0 改造目标

| 维度 | v2.x（旧） | v3.0（新） |
|------|-----------|----------|
| 部署来源 | 工具栏按钮 + 金币 | 手牌区拖卡 + 能量 E |
| 关卡组织 | 5 个独立关卡 | 8 关 + 终战，连闯式 Run |
| 关间过渡 | 无 | 商店 vs 秘境二选一节点 |
| meta 进展 | 三星 + 无尽 | 永久卡池 + 火花碎片 |
| 存档 | LevelProgress + Endless | OngoingRun + CardCollection |

## 7.2 实施分阶段

### Phase A — 数据层与配置（1-2 周）

**目标**：建立卡牌系统数据底座，不影响现有战斗。

| 任务 | 涉及文件 | 验收 |
|------|---------|------|
| 定义 `CardConfig` 接口 | `src/types/card.ts` | TypeScript 编译通过 |
| 实现 `cardData.ts`（30 张开服卡） | `src/data/cardData.ts` | 卡片配置覆盖 21-MDA §8 |
| 扩展存档结构到 v2.0 | `src/save/types.ts` + `migrate.ts` | v1.1 → v2.0 迁移测试通过 |
| 实现 `CardCollection` / `PermanentUpgrades` 数据访问层 | `src/save/cardCollection.ts` | 单测通过 |
| 实现 `OngoingRun` 数据访问层 | `src/save/ongoingRun.ts` | 单测通过 |

### Phase B — 卡牌核心系统（2-3 周）

**目标**：实现卡组、手牌、抽卡、出卡、弃牌堆五大核心机制。

| 任务 | 涉及文件 | 验收 |
|------|---------|------|
| `DeckSystem`（卡组管理） | `src/systems/DeckSystem.ts` | 抽 12 张、洗牌、弃牌堆 |
| `HandSystem`（手牌管理） | `src/systems/HandSystem.ts` | 抽手牌、跨波保留、出卡 |
| `EnergySystem`（能量管理） | `src/systems/EnergySystem.ts` | 每波 +5、上限 10、出卡扣除 |
| `CardSpawnSystem`（卡 → 单位实例化） | `src/systems/CardSpawnSystem.ts` | 单位卡正确创建 Entity |
| `SpellCastSystem`（法术卡执行） | `src/systems/SpellCastSystem.ts` | 法术效果正确生效 |
| 卡牌随机抽取 PRNG | `src/utils/runRandom.ts` | 6 流隔离 |

### Phase C — Run 框架与关间节点（2-3 周）

**目标**：实现 Run 长征流程与关间节点。

| 任务 | 涉及文件 | 验收 |
|------|---------|------|
| `RunManager`（Run 生命周期） | `src/core/RunManager.ts` | 开 Run / 结算 Run / 失败重开 |
| 水晶 HP 继承逻辑 | `src/save/ongoingRun.ts` | 跨关 HP 正确传递（字段名 `baseHp` 保留以兼容存档） |
| `InterLevelNodeSystem`（关间节点） | `src/systems/InterLevelNodeSystem.ts` | 二选一面板 + 选择后正确路由 |
| `ShopSystem`（商店） | `src/systems/ShopSystem.ts` | 4 商品 + 移除 + 刷新 |
| `MysticSystem`（秘境事件） | `src/systems/MysticSystem.ts` | 12 事件池 + 效果生效 |
| 关 1-8 + 终战 关卡数据 | `src/data/levelData.ts` | 难度乘数与 21-MDA §16 一致 |

### Phase D — UI 改造（2 周）

**目标**：手牌区 + 关间面板 + 商店 + 秘境 + 卡池界面。

| 任务 | 涉及文件 | 验收 |
|------|---------|------|
| 删除旧工具栏 UI | `src/ui/Toolbar.ts` → 弃用 | 旧按钮被手牌区替代 |
| 新手牌区 UI（拖卡） | `src/ui/HandPanel.ts` | 拖卡 → 部署 / 释放完整流程 |
| 关间节点面板 | `src/ui/InterLevelPanel.ts` | 二选一 UI |
| 商店界面 | `src/ui/ShopPanel.ts` | 购卡 / 升级 / 移除 / 刷新 |
| 秘境界面 | `src/ui/MysticPanel.ts` | 事件文本 + 多选项 |
| 卡池界面（主菜单） | `src/ui/CardCollectionView.ts` | 解锁 / 升级卡 |
| 永久升级面板 | `src/ui/PermanentUpgradeView.ts` | 5 类升级项 |
| Run 结算界面 | `src/ui/RunResultPanel.ts` | 流派标签 + 碎片入账 |
| 主菜单改造 | `src/ui/MainMenu.ts` | 删除关卡选择 + 无尽，加入 Run/卡池/升级 |

### Phase E — 敌人与卡牌内容（2 周）

**目标**：v3.0 新增敌人 + 关底 Boss + 终战 Boss。

| 任务 | 涉及文件 | 验收 |
|------|---------|------|
| 实现 6 种新敌人（healer_priest, scattered_tentacle, summoner_skeleton, shielded_warrior, invisible_assassin, reflective_golem 等） | `src/data/gameData.ts` | 数值与 21-MDA §6 一致 |
| 实现 8 关底 Boss 数据 | `src/data/gameData.ts` | 复用 boss_commander_ai BT |
| 实现终战 Boss `abyss_lord` | `src/data/gameData.ts` + 新 BT 节点 | 3 阶段切换正常 |
| 敌方威胁度评分系统 | `src/systems/EnemyTargetSystem.ts` | 优先攻击 healer_priest |
| 关 1-9 关卡数据（含波次配置） | `src/data/levelData.ts` | 难度曲线符合预期 |

### Phase F — 测试与平衡（持续）

| 任务 | 涉及文件 | 验收 |
|------|---------|------|
| 卡牌系统单元测试 | `tests/card.test.ts` | 全绿 |
| Run 流程集成测试 | `tests/run.test.ts` | 全 9 关跑通 |
| 经济节奏校验 | `tests/economy.test.ts` | 符合 21-MDA §18 |
| 流派识别测试 | `tests/archetype.test.ts` | 4 种流派可成型 |
| 存档迁移测试 | `tests/save-migration.test.ts` | v1.1 → v2.0 迁移成功 |
| 手动平衡测试 | 人工 | Run 平均时长 30-45 分钟 |

## 7.3 兼容性策略

- **代码兼容**：保留 `Tower` / `Soldier` / `Enemy` 等 UnitConfig 概念不变，仅新增 CardConfig 层
- **行为树兼容**：现有 23 / 24 行为树继续使用，新增 `enemyTargetPriority` 字段不破坏旧 BT
- **数值兼容**：21-MDA §4-§9 旧数值表保留，新增 §12-§18 v3.0 数值表
- **存档兼容**：v1.1 存档自动迁移到 v2.0，发放补偿碎片（详见 [13-save §6.2](./61-save-system.md#62-迁移注册表)）
- **测试兼容**：旧测试中与单关 / 三星 / 无尽相关的 case 标记为 `.skip`，新测试覆盖 v3.0 功能

## 7.4 风险与缓解

| 风险 | 缓解策略 |
|------|---------|
| 玩家不喜欢 Roguelike 死亡惩罚 | 火花碎片让每次失败都有收获；初始解锁 6-8 张 Common 卡降低门槛 |
| 卡组随机性导致玩家挫败 | 关间商店让玩家可补足关键卡 |
| 30-45 分钟单局过长 | 关间存档点支持中断恢复 |
| 卡池扩展数据膨胀 | CardConfig 与 UnitConfig 解耦，扩展只需新增配置 |
| v1.1 旧存档无法迁移 | 提供"重置 + 补偿碎片"兜底；备份原存档可手动恢复 |

## 7.5 Phase Gantt（参考）

```
周次:     1  2  3  4  5  6  7  8  9 10
Phase A: ██████
Phase B:       ██████████
Phase C:                 ██████████
Phase D:                          █████████
Phase E:                                ███████
Phase F:        ███████████████████████████ (持续)
```

总计：约 8-10 周（不含打磨期）。
| 帧率（压力场景） | 30-45fps | 稳定60fps |
