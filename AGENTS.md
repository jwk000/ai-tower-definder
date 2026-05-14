# AGENTS.md — 塔防游戏（Tower Defender）

> 设计文档: `design/README.md` | 架构权威: `design/60-tech/60-architecture.md`

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
- **变更前检查**: 修改任何已有模块前，必须先理解该模块当前服务的所有需求 —— 不清楚就先查，不要猜。
- **变更后验证**: 修改完成后，必须验证所有关联需求仍然正常工作。不确定影响范围时，主动列出受影响的需求清单向用户确认。
- **提交说明**: 如果某次修改不可避免影响了已有行为，必须在 commit message 中明确说明影响范围和原因。
- **例外 —— Roguelike 重构**: 当任务被明确标记为「roguelike 重构」「玩法重构」或用户明确说明「推翻重写」时，本铁律**不适用**。这类重构属于玩法层面的颠覆性重做，不需要兼容原有代码/功能/测试，可以完全推翻重写。具体规则：
  - **允许**: 删除旧的玩法系统、抛弃旧的卡牌/单位/关卡配置、重写战斗循环、移除/重写不再适用的测试。
  - **要求**: 重构前必须在 `design/` 下有对应的新玩法设计文档（设计先行原则不变）。
  - **要求**: commit message 必须以 `refactor(roguelike):` 开头，并说明本次推翻了哪些旧功能。
  - **不豁免的底线**: 构建必须通过（`npm run typecheck && npm run build`）、新玩法必须有新测试覆盖、提交粒度仍需原子化。

## ⛔ 测试铁律：测试驱动开发（TDD），每次变更必须全量测试通过

> **质量防线。测试不通过 = 任务未完成。**

- **需求即测试**: 每个需求必须有对应的测试用例，无测试的需求视为未完成。
- **TDD 流程**: 先写测试 → 测试失败（红）→ 实现功能（绿）→ 重构优化（不破绿）。
- **全量通过**: 每次需求变更完成后，必须运行 `npm test` 确保所有已有测试通过。任何测试失败都必须在提交前修复。
- **禁止行为**: 通过删除测试、跳过断言、`test.skip` 等方式"通过"测试。
- **允许行为**: 当需求确实变更导致旧测试不再适用时，可以修改测试以匹配新需求，但必须在 commit message 中说明。
- **提交前检查**: `npm run typecheck && npm test` 均通过后方可提交。

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
  ai/                行为树（复杂 AI 补充，简单 AI 走配置规则）
    BehaviorTree.ts
    presets/         boss_commander_ai / abyss_lord_ai 等行为树定义
  render/            PixiJS 渲染层
    Renderer.ts / MapRenderer.ts / EntityRenderer.ts
    ProjectileRenderer.ts / ParticleRenderer.ts / UIRenderer.ts
  unit-system/       v3.0 卡牌/Run 子系统（DeckSystem / HandSystem / EnergySystem
                     / CardSpawnSystem / SpellCastSystem / RunManager 等）
  ui/                HUD / 手牌区 / 关间面板 / 商店 / 秘境 / 卡池 / Run 结算
  components/        旧版组件包装（重构遗留，逐步迁移到 core/components.ts）
  input/             InputManager.ts —— 事件队列，每帧 flush
  data/              运行时数据/公式（balance.ts、EndlessWaveGenerator.ts）
  debug/             调试系统（一键通关、行为树查看等）
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
  7. `PHASE_AI` —— 行为树执行
  8. `PHASE_RENDER` —— `RenderSystem` + `UISystem`，始终最后
- **死亡实体清理**: `destroyEntity(eid)` 标记延迟删除，在 `World.update()` 末尾统一 `removeEntity` 清理。

### 规则引擎

- **生命周期事件**: `onCreate` / `onDeath` / `onHit` / `onAttack` / `onKill` / `onUpgrade` / `onDestroy` / `onEnter` / `onLeave`。
- **触发流程**: 系统检测事件 → 调用 `ruleEngine.dispatch(event, entity, context)` → 引擎查找该单位配置的规则 → 执行对应 `RuleHandler`（如 `deal_aoe_damage`、`apply_buff`、`spawn_unit`）。
- **行为规则**: 单位配置中声明 `targetSelection` / `attackMode` / `movementMode`，规则引擎在 AttackSystem / MovementSystem 中提供决策。
- **行为树补充**: 若单位配置了 `ai_tree`，则行为树接管目标选择和攻击决策；生命周期规则仍由规则引擎处理。两者互不冲突。
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
- **新增行为树节点**: 在 `ai/BehaviorTree.ts` 添加节点类型 → 在 `ai/presets/` 中编写行为树预设 → 单位配置 `ai_tree` 字段引用。

## 开发流程

1. **设计先行，代码在后。** 任何功能从设计文档开始。代码必须与文档一致 —— 文档是事实来源。
2. **代码与文档一致性审查。** 写完代码后由审查 agent 校验代码与文档的一致性。文档优先级最高，代码必须改成与文档一致。
3. **原子任务、原子提交。** 把开发工作拆分成只做一件事的任务。完成后立刻提交，commit message 即任务描述。
4. **变更先入文档。** 任何验收问题或需求变更必须先写入文档，再修改代码。
5. **始终用中文回复。** 本项目所有沟通必须使用中文。
6. **开发日志。** 每次对话结束时，agent 必须写一份开发日志。日志按日期归档（每天一个文件），保留完整历史。
