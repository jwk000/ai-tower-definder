# AGENTS.md — 塔防游戏（Tower Defender）

> 设计文档: `design/README.md` | 架构权威: `design/60-tech/60-architecture.md`

## 🚦 任务分类决策表（开工前先对号入座）

> **每次开始一个任务，先判断它属于哪一档；不同档位走不同流程，不要"一律走重流程"导致 AI 慢得离谱。**

| 档位 | 典型场景 | 设计先行 | 测试要求 | 修改前置 | 修改后置 |
|------|---------|---------|---------|---------|---------|
| **L1 配置/视觉/胶水** | 新增单位/卡牌/关卡 YAML、UI 微调、渲染特效、调数值、修文案 | ❌ 免 | ❌ 免单测；跑冒烟即可 | ❌ 直接动手 | `typecheck` + `debug/` 冒烟 |
| **L2 系统逻辑/功能扩展** | 新增 RuleHandler、新增系统、扩展已有系统行为、调整生命周期 | ⚠️ 简要列改动点即可，不必走完整设计文档流程 | ⚠️ 写**集成测试**（造 mini World 跑几帧验状态），不写细碎单测 | ❌ 直接动手 | `typecheck` + 相关集成测试 + 冒烟 |
| **L3 核心引擎/架构变更** | 改 `core/World`、`core/RuleEngine`、`core/pipeline`、`core/components`、`data/balance` 公式、新增 ECS Phase、跨模块契约变更 | ✅ **必须**先写/更新 `design/` 文档 | ✅ **必须** TDD（红 → 绿 → 重构） | ✅ 修改前先列受影响模块清单 | `typecheck` + `npm test` 全量通过 + 冒烟 |
| **🐛 Bugfix** | 修复明确 bug（不改架构、不扩功能） | ❌ 免 | ⚠️ **追加回归测试到 `tests/regression/`**（曾经坏过的场景） | ❌ 直接动手 | `typecheck` + 新回归测试通过 + 旧测试不破 |

**判定规则**：
- 不确定档位时，**就低不就高**（按 L1/L2 走），出问题再补救。
- 一个任务跨档时，按**最高档**执行（例：改 YAML 同时改了组件定义 → 走 L3）。
- 用户明确说"快速做一下"/"先 demo 一版" → 一律 L1。
- 用户明确说"重要功能"/"核心改动" → 至少 L2。

---

## ⛔ 核心铁律：每完成一个任务立即提交代码

> **这是最重要的规范，优先级高于一切。违反此规则视为任务未完成。**

- **触发时机**: 每完成一个逻辑任务单元（功能实现/修复/重构完成），不等用户提醒，立即执行 `git add` + `git commit`
- **提交信息**: 使用任务描述作为 commit message，格式：`feat/fix/refactor: <简短描述>`
- **绝不**: 累积多个任务的改动后一并提交
- **绝不**: 等待用户提醒才提交

## ⛔ 回归铁律：新增/修改需求不得破坏已有功能

> **信任基石。违反此规则比代码报错更严重。**

- **禁止行为**: 新增功能或修改需求时，导致其他已有需求对应的功能失效、行为异常或结果错误。
- **允许行为**: 在保持外部行为不变的前提下，等价重构原有功能的内部实现（优化结构、提取公共逻辑、改善可读性等）。
- **变更前检查**（轻量）: 修改前快速扫一眼**直接调用方**（grep / LSP 引用查询即可），无需提前穷举所有间接受影响的需求。L3 任务才需要列出受影响模块清单。
- **变更后验证**（强制）: 修改完成后必须执行——
  - `npm run typecheck` 通过；
  - 跑 `debug/` 下相关冒烟脚本（如一键通关、随机种子重放），观察是否有视觉/数值异常；
  - L2/L3 任务额外跑相关集成测试或 `npm test`；
  - 不确定影响范围时，主动列出疑似受影响的功能清单告知用户。
- **提交说明**: 如果某次修改不可避免影响了已有行为，必须在 commit message 中明确说明影响范围和原因。
- **例外 —— Roguelike 重构**: 当任务被明确标记为「roguelike 重构」「玩法重构」或用户明确说明「推翻重写」时，本铁律**不适用**。这类重构属于玩法层面的颠覆性重做，不需要兼容原有代码/功能/测试，可以完全推翻重写。具体规则：
  - **允许**: 删除旧的玩法系统、抛弃旧的卡牌/单位/关卡配置、重写战斗循环、移除/重写不再适用的测试。
  - **要求**: 重构前必须在 `design/` 下有对应的新玩法设计文档（设计先行原则不变）。
  - **要求**: commit message 必须以 `refactor(roguelike):` 开头，并说明本次推翻了哪些旧功能。
  - **不豁免的底线**: 构建必须通过（`npm run typecheck && npm run build`）、新玩法必须有新测试覆盖、提交粒度仍需原子化。

## ⛔ 测试铁律：分层测试策略（按任务档位决定测试强度）

> **质量防线，但不一刀切。测试粒度必须匹配任务档位，否则会拖死 AI 开发速度。**

### 测试强度按档位决定（详见顶部「任务分类决策表」）

| 档位 | 测试要求 | 提交前检查 |
|------|---------|-----------|
| **L1 配置/视觉/胶水** | 免单测，靠 `debug/` 冒烟脚本 + 肉眼回归 | `npm run typecheck` + 冒烟通关 |
| **L2 系统逻辑** | 写**集成测试**（造 mini World 跑几帧验状态），不写细碎 mock 单测 | `npm run typecheck` + 该模块集成测试 |
| **L3 核心引擎** | **必须 TDD**（红 → 绿 → 重构），核心数值/规则必有单测 | `npm run typecheck` + `npm test` 全量通过 |
| **🐛 Bugfix** | **必须**追加回归测试到 `tests/regression/`，覆盖刚修的 bug 场景 | `npm run typecheck` + 新回归测试通过 + 旧测试不破 |

### 通用约束（任何档位都适用）

- **禁止行为**: 通过删除测试、跳过断言、`test.skip` 等方式"通过"测试。
- **允许行为**: 需求变更导致旧测试不再适用时，可修改测试以匹配新需求，但必须在 commit message 中说明。
- **回归测试只增不减**: `tests/regression/` 下的测试是项目的"历史伤疤"，除非对应功能被明确废弃，否则不得删除。
- **L3 提交红线**: 核心引擎变更若 `npm test` 不全绿，禁止提交。

### 反模式（明确禁止）

- ❌ 给 L1 任务（如新增单位 YAML）强制写单测——浪费时间，几乎无价值。
- ❌ 给渲染/UI 写大量 mock 单测——PixiJS 难 mock，价值低，靠冒烟更可靠。
- ❌ L2 任务写一堆细粒度单测覆盖单个工具函数——集成测试一次性验证更高效。
- ❌ 修 bug 不补回归测试——下次 AI 改代码同样的 bug 会再回来。

## ⛔ 上下文铁律：感知饱和主动 handoff

> **不要等系统自动压缩。自动压缩会静默丢失关键信息（决策理由、踩坑记录、临时约定），主动 handoff 才能把项目知识沉淀到 `.memory/handoffs/` 供下一会话续跑。**

- **触发条件**（满足任一即触发）:
  - 估算当前会话 token 使用率 ≥ **70%**（200K 上限 → 140K 即触发）。
  - 下一步操作明显会让单条响应超限（例如即将读多个大文件、长 diff 输出）。
  - 系统通知"OpenCode Token 监控"提示 ≥ 70%（由 `scripts/opencode-token-monitor.sh` 后台脚本发送）。
- **触发后动作**:
  1. 立即停止任何新工作，把手头 todo 推进到当前可收尾点。
  2. 调用 `/handoff` 生成交接文档到 `.memory/handoffs/_latest.md`。
  3. 向用户明确提示："已 handoff 至 `.memory/handoffs/_latest.md`，请新建会话用 '继续 `.memory/handoffs/_latest.md`' 启动续跑。"
  4. 不再继续新工作，等待用户确认。
- **禁止行为**:
  - 感知到接近上限仍硬塞工作、依赖系统自动压缩兜底。
  - 在 handoff 文档中略写——必须包含：当前进度、未完成 todo、关键决策与坑、受影响模块清单、下一步建议。
- **续跑会话的第一动作**: 读 `.memory/handoffs/_latest.md` → 同步该文档中的 todo 列表 → 按文档"下一步建议"继续。

## ⛔ 沟通铁律：不要向人类询问代码实现细节

> **人类关心产品设计和技术框架设计，不关心代码实现细节。实现层面的决策由你自主完成。**

- **禁止行为**: 就具体实现方式向人类提问，例如：
  - "应该用哪个变量名？"
  - "这个函数放在 A 文件还是 B 文件？"
  - "用 for 循环还是 map？"
  - "这里要不要加个缓存？"
  - "类型应该定义成 interface 还是 type？"
  - 其他任何只涉及代码层面、不影响产品体验和架构边界的细节决策。
- **允许行为（应该问）**: 涉及以下层面的问题必须与人类确认：
  - **产品设计**: 玩法机制、数值规则、交互流程、UI 表现、用户体验取舍。
  - **技术框架设计**: 模块边界划分、新增系统/组件的职责定位、跨模块依赖关系、关键架构变更（如引入新的状态管理方式、渲染管线调整、ECS 规则变动等）。
  - **需求歧义**: 用户描述存在多种合理解读且效果差异显著时。
- **判断标准**: 提问前自问 ——"这个问题的答案会改变玩家看到/感受到的东西吗？会改变模块之间的契约吗？" 如果都不会，那就是实现细节，自己决策。
- **决策原则**: 实现细节遵循"匹配现有代码风格 → 遵循最佳实践 → 选择最简单可行方案"的优先级，必要时在提交说明里简述选择理由即可。

## 构建与运行

```bash
npm run dev          # 启动开发服务器 (localhost:3000)
npm run build        # tsc --noEmit && vite build
npm run typecheck    # 仅类型检查，不产出文件
npm test             # 运行 vitest 测试
npm run release      # clean + typecheck + build
.\build.ps1 <cmd>    # Windows 包装脚本（或使用 `make <cmd>`）
```

构建流水线强制执行顺序：`typecheck → clean → build`。类型错误 = 构建失败。

## 架构

**配置驱动 + 规则引擎 + bitecs ECS + PixiJS WebGL** 四层架构。详见 [`design/60-tech/60-architecture.md`](./design/60-tech/60-architecture.md) §2-§5。

- **ECS 框架**: [`bitecs`](https://github.com/NateTheGreatt/bitecs) —— 数据导向 ECS，SoA（Structure of Arrays）内存布局，类型安全查询。
- **渲染**: PixiJS WebGL —— `Graphics`（几何图形）+ `ParticleContainer`（粒子特效）+ `Container`（分层管理），程序化几何图形构成所有视觉元素。
- **配置驱动**: 单位/卡牌/关卡/技能 Buff 全部由 YAML 配置定义，策划可编辑、运行时加载。
- **规则引擎**: 将声明式配置（如 `onDeath`、`onHit` 生命周期、目标选择/攻击模式行为规则）转换为运行时行为，在 ECS 系统之间提供配置驱动的调度层。

```
src/
  main.ts            入口 —— 装配 PixiJS App + bitecs World + 系统管线 + 输入派发
  core/              引擎核心
    Game.ts          主循环 + 协调器
    World.ts         bitecs World 封装（TowerWorld）
    components.ts    所有组件 defineComponent 定义（SoA 数据）
    pipeline.ts      系统管线（8 阶段拓扑排序）
    RuleEngine.ts    规则引擎（生命周期 + 行为规则分发）
    RuleHandlers.ts  规则处理器实现（deal_aoe_damage、apply_buff 等）
  config/            配置层（策划可编辑）
    loader.ts        YAML 配置加载器
    registry.ts      单位/卡牌配置注册表
    units/           单位 YAML：towers / soldiers / enemies / buildings / neutrals / objectives
    levels/          关卡 YAML：8 关 + 终战 + 波次 + 随机池
    cards/           v3.0 卡牌配置：单位卡 / 法术卡 / 陷阱卡 / 生产卡
  systems/           系统逻辑（纯函数 + bitecs query）
                     MovementSystem / AttackSystem / ProjectileSystem / WaveSystem
                     HealthSystem / EconomySystem / BuildSystem / UnitSystem
                     SkillSystem / BuffSystem / BossSystem / ProductionSystem
                     TrapSystem / WeatherSystem / LifecycleSystem / RenderSystem 等
  render/            PixiJS 渲染层
    Renderer.ts / MapRenderer.ts / EntityRenderer.ts
    ProjectileRenderer.ts / ParticleRenderer.ts / UIRenderer.ts
  unit-system/       v3.0 卡牌/Run 子系统（DeckSystem / HandSystem / EnergySystem
                     / CardSpawnSystem / SpellCastSystem / RunManager 等）
  ui/                HUD / 手牌区 / 关间面板 / 商店 / 秘境 / 卡池 / Run 结算
  components/        旧版组件包装（重构遗留，逐步迁移到 core/components.ts）
  input/             InputManager.ts —— 事件队列，每帧 flush
  data/              运行时数据/公式（balance.ts、EndlessWaveGenerator.ts）
  debug/             调试系统（一键通关等）
  utils/             通用工具（runRandom 6 流 PRNG、debugLog 等）
  types/             共享类型、配置接口、枚举
```

### ECS 规则（bitecs）

- **组件**: 使用 `defineComponent({ field: Types.f32 })` 定义，组件即字段集合，数据以 SoA 形式存储。组件本体没有方法，纯数据。
- **实体**: `addEntity(world)` 返回 `eid: number`；`addComponent(world, Component, eid)` 挂载组件。
- **查询**: 系统内部用 `defineQuery([CompA, CompB])` 声明，每帧调用查询函数获取匹配实体数组（AND 逻辑）。查询有类型推断，避免字符串标签。
- **系统**: 实现 `System` 接口 —— `{ name: string; update(world: TowerWorld, dt: number): void }`。系统自管查询，不再依赖 World 预过滤。
- **管线顺序**: 8 阶段拓扑排序（详见 `core/pipeline.ts`），不可随意调换：
  1. `PHASE_MANAGERS` —— 经济 / 波次 / 天气等独立管理器
  2. `PHASE_VFX` —— 死亡 / 爆炸 / 闪电 / 激光等视觉计时
  3. `PHASE_MODIFIERS` —— Buff / 治疗等状态修改
  4. `PHASE_GAMEPLAY` —— 移动 / 攻击 / 弹道 / 技能 / 陷阱 / 生产
  5. `PHASE_LIFECYCLE` —— 生命周期事件分发 + 死亡检测
  6. `PHASE_CREATION` —— 建造 / 实体新建
  7. `PHASE_AI` —— 高级 AI 决策（预留阶段，v3.4 暂未启用任何 AI 系统；所有单位决策走规则引擎驱动的目标选择/攻击模式）
  8. `PHASE_RENDER` —— `RenderSystem` + `UISystem`，始终最后
- **死亡实体清理**: `destroyEntity(eid)` 标记延迟删除，在 `World.update()` 末尾统一 `removeEntity` 清理。

### 规则引擎

- **生命周期事件**: `onCreate` / `onDeath` / `onHit` / `onAttack` / `onKill` / `onUpgrade` / `onDestroy` / `onEnter` / `onLeave`。
- **触发流程**: 系统检测事件 → 调用 `ruleEngine.dispatch(event, entity, context)` → 引擎查找该单位配置的规则 → 执行对应 `RuleHandler`（如 `deal_aoe_damage`、`apply_buff`、`spawn_unit`）。
- **行为规则**: 单位配置中声明 `targetSelection` / `attackMode` / `movementMode`，规则引擎在 AttackSystem / MovementSystem 中提供决策。所有 AI 决策（含 Boss、高级敌人）一律走该路径，v3.4 起不再使用行为树。
- **新增规则**: 在 `core/RuleHandlers.ts` 注册新 handler，再在单位 YAML 中引用，无需改动系统代码。

### 渲染层级（PixiJS）

- PixiJS Stage 分层 Container，渲染顺序由 Container 添加顺序决定（无需手动命令缓冲）。
- `RenderSystem` 同步实体组件到 PixiJS Display Object，按 Y 坐标排序场景实体。
- `UIRenderer` / `UISystem` 在最顶层 Container 绘制 HUD、工具栏、手牌区、弹窗等。
- 文本使用 PixiJS `Text` 对象，与图形共用同一渲染管线。
- 设计分辨率 1920×1080，UI 锚点定位详见 [`design/40-presentation/41-responsive-layout.md`](./design/40-presentation/41-responsive-layout.md)。

### 输入派发

- `InputManager` 将原始事件入队，每帧 `flush()` 处理，避免在事件回调中操作 ECS。
- `onPointerDown` 派发优先级：UI 按钮 → 手牌区拖卡 → 战场建造放置 → 单位选择。
- UI 面板区域（坐标根据响应式布局动态计算）不进入战场点击逻辑。

### TypeScript 注意事项

- `noUncheckedIndexedAccess: true` —— 任何数组下标访问返回 `T | undefined`，必须处理。
- 导入使用 `.js` 后缀（如 `import { Foo } from './bar.js'`）—— Vite 的 `bundler` moduleResolution 要求。
- 路径别名：`@/`、`@core/`、`@components/`、`@systems/`、`@data/`、`@ui/`、`@render/`、`@input/`、`@utils/`、`@types/`。
- 启用：`strict: true`、`noImplicitOverride: true`、`forceConsistentCasingInFileNames: true`。

### 游戏状态

- **关内阶段**: `GamePhase` 枚举驱动 —— `Deployment（部署）→ Battle（战斗）→ WaveBreak（波间）→ Victory/Defeat（胜利/失败）`。系统通过回调读取阶段，而不是直接访问状态。
- **Run 长征**（v3.0）: `RunManager` 管理 8 关 + 终战连闯流程；关间在 `InterLevelNode`（商店 / 秘境）二选一；水晶 HP 跨关继承；死亡从第 1 关重开，结算金币 → 火花碎片。

### 新增内容（配置驱动）

- **新增单位**（塔 / 士兵 / 敌人 / 中立机关）: 在 `config/units/*.yaml` 添加配置（含 `stats` / `behavior` / `lifecycle` / `ai` / `visual`），无需改代码。规则引擎与渲染层自动接管。
- **新增卡牌**（v3.0）: 在 `config/cards/*.yaml` 添加 `CardConfig`，并关联单位/法术配置；卡池界面与 Run 抽卡逻辑自动生效。
- **新增关卡**: 在 `config/levels/*.yaml` 编写波次与随机池配置。
- **新增组件**: 在 `core/components.ts` 用 `defineComponent` 定义新字段集合 → 在需要的系统中 `defineQuery` 引用 → 添加挂载/移除逻辑。
- **新增生命周期/行为规则**: 在 `core/RuleHandlers.ts` 注册新 handler → 在单位 YAML 中通过名字引用，无需改系统。


## 开发流程

### 通用规则（任何档位都适用）

1. **原子任务、原子提交。** 把开发工作拆分成只做一件事的任务。完成后立刻提交，commit message 即任务描述。
2. **始终用中文回复。** 本项目所有沟通必须使用中文。
3. **匹配现有代码风格。** 实现细节优先级：匹配现有风格 → 遵循最佳实践 → 选择最简方案。

### 设计先行（按任务档位分级，不是一刀切）

| 档位 | 设计文档要求 |
|------|-------------|
| **L1 配置/视觉/胶水** | ❌ 免。直接动手，commit message 说清楚做了啥即可。 |
| **L2 系统逻辑** | ⚠️ 写代码前在对话里**简要列改动点**（哪些文件、新增什么接口、影响什么），不必走完整 `design/` 流程。 |
| **L3 核心引擎/架构变更** | ✅ **必须**先写或更新 `design/` 下对应文档，再写代码。文档与代码不一致时，**文档优先**——代码改成与文档一致。 |
| **🐛 Bugfix** | ❌ 免。但若 bug 暴露了文档错误，需顺手更新文档。 |

### 文档一致性审查（仅 L3 触发）

- L3 任务完成后，必须扫一遍相关 `design/` 文档与代码的一致性。
- L1/L2/Bugfix **不触发**审查流程，节省时间。

### 开发日志（重大变更才写，不再每次对话都写）

- **必须写日志的场景**: 新增系统/模块、架构调整、跨模块契约变更、玩法重构、引入新依赖。
- **不必写日志的场景**: 新增 YAML 配置、调数值、修文案、UI 微调、修 bug——这些靠 `git log` + commit message 已足够。
- **日志位置**: `.memory/handoffs/` 或 `.memory/decisions/`（架构决策用 ADR 格式）。
- **handoff 仍按上下文铁律执行**: token ≥ 70% 时必须主动 handoff，与本规则独立。

<!-- UBF_MEMORY_SYSTEM_START -->
## 记忆系统

### ⚠️ 路径约束

记忆分两级存储，根目录不同：

- **项目记忆**：`ubf_agent_root/.memory/` — 项目目录下的子目录，存本项目的知识
- **全局知识**：`$UBF_AI_ROOT/.memory/` — **独立的 git 仓库**（不在项目目录内），通过环境变量 `$UBF_AI_ROOT` 定位，存跨项目共享知识（me.md、conventions.md、stack.md 等）

> `$UBF_AI_ROOT` 由 `/ubf_init` 自动发现并持久化到 shell 环境。访问全局知识前先确认该变量存在。

> **⛔ 项目级记忆只写 `ubf_agent_root/.memory/`。全局仓库是只读参考，禁止在其中创建项目子目录。**

### 目录分类

| 目录 | 放什么 | 判定 |
|------|--------|------|
| **`modules/`** | 架构分析、技术原理、接口说明 | **会随理解加深而迭代** |
| **`references/`** | 需求文档、产品规格、现状快照 | **不会迭代的只读基线**（⛔ 不可修改删除） |
| `decisions/` | ADR 格式的取舍记录 | — |
| `handoffs/` | 会话交接摘要 | — |
| `known-issues/` | bug、workaround | — |

### 读写规则

- **读取**：先查 `_index.md`，再按需读具体文件
- **写入**：写入后告知用户路径；`_index.md` 由脚本生成，**禁止手工编辑**
- **命名**：`{中文标题}_V{版本}_{YYYY.MM.DD_HH.mm.ss}.md`（禁止冒号和空格）

> **⚠️ 凡涉及记忆读写操作（检索、写入、交接、索引重建、归档），必须先加载 `ubf-memory` skill 再执行。** 该 skill 包含完整的操作规范、权限边界和脚本调用流程。

### 项目记忆路径

- 模块知识: `ubf_agent_root/.memory/modules/_index.md`
- 参考资料: `ubf_agent_root/.memory/references/_index.md`
- 项目决策: `ubf_agent_root/.memory/decisions/_index.md`
- 最近交接: `ubf_agent_root/.memory/handoffs/_latest.md`
- 已知问题: `ubf_agent_root/.memory/known-issues/_index.md`
<!-- UBF_MEMORY_SYSTEM_END -->
