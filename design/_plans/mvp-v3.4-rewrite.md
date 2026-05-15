# 塔防 v3.4 MVP 重写任务计划（Wave 驱动 · TDD 优先）

> **版本**：2.2
> **创建日期**：2026-05-15
> **依据**：design/ v3.4 文档全集（10-roguelike-loop v2.0.0 / 60-architecture v1.0.0 / 50-mda v1.3.1 / 16-level-blueprints / 48-shop-redesign-v34 等）
> **执行策略**：roguelike 重构铁律 + TDD 铁律 + 原子提交铁律。新分支 `rougelike-v34` 上**直接清空 src/**（旧分支 `rougelike` 即归档），保留 `src/config/**` YAML 作复用基线，按 v3.4 设计从空白搭建。**Wave 顺序按系统稳定性，而非文件归属**。
> **Plan Critic（Momus）评审**：v2.1 已最终批准。v2.2 在批准基础上调整 Wave 0 反映新分支策略，其他 Wave 不变。

---

## 0. MVP 范围决策（已与用户对齐）

| 维度 | MVP 范围 | 后续阶段补全 |
|---|---|---|
| **代码起点** | 新分支 `rougelike-v34` 上清空 src/ 非 config/ 内容；旧分支 `rougelike` 冻结作 v3.3 归档；`src/config/**` YAML 作复用基线 | — |
| **单位覆盖** | 每大类各 1 个：1 塔（箭塔）+ 1 士兵（盾卫）+ 1 陷阱（尖刺）+ 1 法术（火球术）+ 1 生产建筑（金矿）+ 1 水晶 + 3 敌人（grunt/runner/heavy） | 扩展至 7 塔 / 6 士兵 / 9 陷阱 / 14 法术 / 2 生产 / 11 中立 / 40+ 敌人 |
| **关卡** | L1 草原序章简化版（蓝图骨架 + MVP 单位池） | L2-L8 + 终战 |
| **能量模型** | **MVP 临时**：固定速率自动恢复（1 E/s，上限 10） | 切换至文档规定：每波 +5 + 能量水晶 + 击杀回能 |
| **Run 流程** | L1 单关闭环：开 Run → 战斗 → 关后 3 选 1 → Run 结算 | L1-L8 + 终战连闯 |
| **关后节点** | 商店 / 秘境 / 跳过三向都可走通；商店可买卡 + 买 SP；秘境含 ≥1 个事件 + 零成本退出；跳过零代价 | 商店 8 槽完整、秘境 14 事件池 |
| **技能树** | 1 个单位（箭塔）的 1 条路径 × 2 节点，验证 SP 投入→效果生效闭环 | 7 塔 + 6 士兵 + 9 陷阱 + 14 法术 + 2 生产共 ~200 节点 |
| **存档** | v3.0.0 schema 骨架（仅 RunHistory + 累计统计 + 设置） | 成就、Hero Score 完整公式 |

**MVP 临时简化追溯表**（必须在代码注释 `// MVP-SIMPLIFICATION:` 显式标注，便于后续替换）：

| 编号 | 简化点 | 偏离的文档要求 | 影响模块 | 计划替换阶段 |
|---|---|---|---|---|
| S1 | 能量按 1 E/s 自动恢复（满 10） | 11-economy §4：每波 +5 + 能量水晶生产 + 击杀回能 | `src/unit-system/EnergySystem.ts` | P1 |
| S2 | 卡组开局只抽 8 张（保底比例同 v3.4） | 10-roguelike-loop §2.3：抽 12 张 | `src/unit-system/DeckSystem.ts` | P1 |
| S3 | 关卡通关无 3 选 1 单位卡抽卡 | 10-roguelike-loop §2.6 | `src/unit-system/RunManager.ts` | P1 |
| S4 | Hero Score 公式 = `通关数 × 1000 + 击杀数 × 10` | 10-roguelike-loop §6.3 / 50-mda（完整公式） | `src/unit-system/RunManager.ts` | P7 |
| S5 | 天气始终 Sunny | 14-weather：5 种天气 + 50-mda §9 数值矩阵 | `src/systems/WeatherSystem.ts`（MVP 不实现） | P2 |
| S6 | 单位 AI 用配置规则（targetSelection:closest, attackMode:simple_ranged），不接行为树 | 30-behavior-tree §2 | `src/systems/AttackSystem.ts` | P5 |
| S7 | 渲染只画方块 / 圆形 / 文字血条，无粒子 / buff 图标 / 装饰 | 42-art-assets / 43-scene-decoration / 44-visual-effects | `src/render/EntityRenderer.ts` | P6 |
| S8 | 商店仅 2 槽（1 单位卡 + 1 SP 兑换） | 48-shop-redesign-v34 §1：8 槽 | `src/ui/ShopPanel.ts` | P3 |
| S9 | 秘境仅 2 事件（零成本退出 + 30G→5SP） | 27-traps-spells-scene §5：14 事件池 | `src/config/mystic-events.yaml` | P3 |
| S10 | 技能树仅箭塔 1 路径 2 节点 | 22a-22e：~200 节点全单位树 | `src/config/units/tower_arrow.yaml` | P4 |

---

## 1. 架构契约（不可妥协）

来自 `design/60-tech/60-architecture.md` v1.0.0：

1. **bitecs ECS**：组件用 `defineComponent({field: Types.f32})`，SoA 内存布局；系统用 `defineQuery` 自管查询。
2. **PixiJS WebGL**：分层 Container，`RenderSystem` 同步 ECS → Display Object，按 Y 排序。
3. **8 阶段 Pipeline**：MANAGERS → VFX → MODIFIERS → GAMEPLAY → LIFECYCLE → CREATION → AI → RENDER。
4. **配置驱动**：所有单位/卡牌/关卡用 YAML 定义，代码仅读取注册表。
5. **规则引擎**：生命周期事件（onCreate/onDeath/onHit/onAttack/onKill）由 `RuleEngine.dispatch` 分发。
6. **TypeScript**：`strict: true` + `noUncheckedIndexedAccess: true`；import 使用 `.js` 后缀；禁用 `as any` / `@ts-ignore`。
7. **三资源不可互转**（除商店内金币→SP）：能量 / 金币 / 技能点。
8. **单 Run 闭环**：Run 结束清零，无 meta 入账。

---

## 2. 测试架构（三层）

### Layer 1 — 单元测试（vitest，必须）
- `src/core/**` — World 生命周期 / Pipeline 阶段顺序 / RuleEngine 分发
- `src/systems/**` — 每个系统的纯逻辑（用确定性手动 tick，不依赖真实时间）
- `src/unit-system/**` — RunManager / DeckSystem / HandSystem / EnergySystem
- 单元测试**测行为不测实现细节**；用 manual stepping（`game.tick(dt)`）代替真实时间

### Layer 2 — 集成测试（vitest + happy-dom）
- 配置加载 + 注册表联动
- 多系统组合（一次完整战斗 / 一个完整 Run 切换）
- 配置 → 运行时实体的端到端实例化

### Layer 3 — 冒烟 / 视觉测试（vitest 简化版）
- **类型**：以**状态机驱动的冒烟测试**为主（不依赖真实 DOM、不依赖屏幕截图）
- **关键玩家流程**：主菜单 → Run → L1 → 通关 → 3 选 1（三个分支）→ 结算 — 全程通过驱动 `RunManager` + 模拟 `InputManager` 事件入队来走完
- **UI 流程测试**：少量用 happy-dom 验证 UI 组件挂载与按钮回调路由（如 InterLevelPanel 三按钮分别触发正确 RunManager 转移）
- **渲染回归**：MVP 阶段以 PixiJS Display Object 层级 / 子对象数量 / 关键属性快照为主，**不做像素级截图比对**
- **MVP 阶段不引入 Playwright E2E**（推迟到 P7）

### 测试铁律
- 每个 feature commit 必须配套 test commit；TDD Red-Green-Refactor 严格执行
- 不要用 UI 测试弥补缺失的逻辑测试
- 不要测试 PixiJS / bitecs 框架内部行为
- 所有时间敏感测试必须用确定性 dt 步进（如 `game.tick(1/60)`），不允许 `setTimeout`/`await sleep`

---

## 3. Wave 执行计划

> 每个 Wave 内的任务按 TDD 顺序展开：先写 test（红），再实现（绿），最后视情况 refactor（保绿）。
> 每个原子提交满足：**1 逻辑变更 + 1 可测结果 + 1 回滚单元**。
> Commit 前缀：`refactor(roguelike):`（roguelike 重构铁律生效）/ `test:`（仅添加测试）/ `feat:`（在已有架构上新增功能）/ `fix:`/ `docs:`。

### Wave 0 — 范围锁定与清空（约 0.3 天 · 2 commits） ✅ **已完成**（2026-05-15）

**目标**：在新分支 `rougelike-v34` 上**直接删除 v3.3 实现**（旧分支 `rougelike` 即归档），保留可复用的 YAML 配置基线，建立空白工程入口。

**前置**：已从 `rougelike` 切出新分支 `rougelike-v34`，旧分支冻结作为 v3.3 参考。**不再需要 `src/legacy/` 归档**。

| # | 任务 | TDD 步骤 | 产出 | 提交 |
|---|---|---|---|---|
| W0.1 | 删除 `src/` 下所有非 `config/` 子目录与文件（systems / render / ui / unit-system / core / components / ai / data / debug / input / types / utils / 旧 main.ts 等）；保留 `src/config/**`（已按 v3.4 设计生成的 YAML，作 Wave 4 裁剪复用基线）；创建最简 `src/main.ts` 渲染 "Hello v3.4 MVP" 文字（仅依赖 PixiJS Application + Text，不引入其他模块）；在 `vitest.config` 中清空或排除已删除的测试路径；运行 `npm run typecheck && npm test && npm run build` 三命令全绿 | — | 干净的 `src/`（仅 `main.ts` + `config/`）、可启动的最小 PixiJS 应用 | `refactor(roguelike): purge v3.3 implementation, keep YAML configs for v3.4 reuse` |
| W0.2 | 核查并 finalize 本计划 §5 MVP 验收矩阵（设计需求 → 测试用例的完整映射，覆盖 Wave 1-6 所有 DoD 测试） | — | 本计划 §5 锁定 | `docs: lock v3.4 MVP acceptance matrix` |

**Wave 0 命令门**：`npm run typecheck && npm test && npm run build` 三个全绿；浏览器 `npm run dev` 渲染 "Hello v3.4 MVP"。

**Wave 0 DoD**：`src/` 仅剩 `main.ts` 与 `config/`；YAML 配置原样保留待 Wave 4 复用；最小 PixiJS 入口可运行；§5 验收矩阵锁定。

> 备注：`src/config/**` 的具体复用 / 裁剪由 Wave 4 处理。本 Wave 不做配置改动，仅"保留作基线"。

---

### Wave 1 — 运行时基石（约 1.5 天 · 8 commits） ✅ **已完成**（2026-05-15）

**目标**：建立 World + Pipeline + RuleEngine + 核心组件契约。所有后续 Wave 依赖本 Wave。

**完成验证**（2026-05-15）：
- 三命令门：`npm run typecheck`、`npm test`（53/53 pass）、`npm run build`（1.13s）均绿
- 5 个测试文件：World(10) + pipeline(8) + RuleEngine(14) + components(15) + Game(6)
- 浏览器渲染验证延后到 Wave 6 smoke 测试阶段（happy-dom 不支持 WebGL，无法在 unit 测试中验证 21×9 网格画面 —— 已在 W1.8 渲染 commit 的 commit message 中记录此延后）
- Wave 1 契约冻结：World API / Pipeline 8 阶段 / RuleEngine 9 事件 + handler 签名 / 8 组件 + 3 枚举 / Game.tick(dt) 入口

| # | 任务 | TDD 步骤 | 产出 | 提交 |
|---|---|---|---|---|
| W1.1 | World 生命周期测试：createEntity / destroyEntity（延迟清理）/ hasComponent / addComponent | 先写测试（red） | `src/core/__tests__/World.test.ts` | `test: add World lifecycle and deferred cleanup coverage` |
| W1.2 | 实现 World 封装 | 实现（green） | `src/core/World.ts`、`src/core/Game.ts` | `refactor(roguelike): implement bitecs World wrapper with deferred cleanup` |
| W1.3 | Pipeline 阶段顺序测试：注册 3 个系统到不同阶段 → 验证执行顺序 = 8 阶段拓扑 | 红 | `src/core/__tests__/pipeline.test.ts` | `test: add pipeline phase ordering coverage` |
| W1.4 | 实现 Pipeline | 绿 | `src/core/pipeline.ts` | `refactor(roguelike): implement 8-phase pipeline orchestration` |
| W1.5 | RuleEngine 分发测试：registerHandler + dispatch 调用正确 handler；未注册事件静默忽略 | 红 | `src/core/__tests__/RuleEngine.test.ts` | `test: add RuleEngine dispatch and handler registration coverage` |
| W1.6 | 实现 RuleEngine 分发核心（仅引擎，**handler 推迟到 W2** —— 依赖未定义的组件，强行写会违反 TDD） | 绿 | `src/core/RuleEngine.ts` | `refactor(roguelike): implement RuleEngine dispatch core` |
| W1.7 | 核心组件定义（Position / Health / Movement / Visual / Faction / UnitTag / Lifecycle / Owner） | 同步写 schema 测试 | `src/core/components.ts`、`src/core/__tests__/components.test.ts` | `refactor(roguelike): define core ECS components for v3.4 MVP` |
| W1.8 | 主循环装配：PixiJS App + Game.tick(dt) 手动可步进；浏览器渲染 21×9 × 64px 黑底网格 | 集成测试用 manual stepping | `src/main.ts`、`src/render/Renderer.ts`、`src/core/__tests__/Game.test.ts` | `feat: wire PixiJS app with deterministic Game.tick stepping` |

**Wave 1 命令门**：`npm run typecheck && npm test`

**Wave 1 DoD**：浏览器渲染网格；FPS ≥ 60；World / Pipeline / RuleEngine **核心运行时契约**（生命周期、阶段顺序、事件分发、确定性步进）均有单元测试覆盖；`Game.tick(dt)` 可被测试代码确定性驱动。

**🔒 Wave 1 契约冻结（重要）**：本 Wave 完成后，下列接口进入"冻结"状态，Wave 2-5 不得变更（如必须变更，需先在计划中说明并回顾测试影响）：
- 组件名称与字段集（`src/core/components.ts`）
- 8 阶段 Pipeline 顺序与阶段名
- RuleEngine 事件名（`onCreate / onDeath / onHit / onAttack / onKill / onUpgrade / onDestroy / onEnter / onLeave`）与 handler 签名 `(eid, params, world) => void`
- 主循环步进 API：`Game.tick(dt: number): void`

冻结目的：保护 Wave 2-5 不被底层契约变动反复打断。

---

### Wave 2 — 战斗垂直切片（约 2 天 · 10 commits）

**目标**：证明一个完整战斗回路可工作（spawn → 移动 → 攻击 → 死亡）。**先证明运行时正确，再处理内容广度**。

> **W1.6 推迟的 4 个 MVP RuleHandler 在本 Wave 内分散落地**（每个 handler 配对其首次使用的系统）：
> - `deal_damage` 与 W2.4 AttackSystem 同提交
> - `deal_aoe_damage` 与 W2.4 同提交（火球术 / 爆炸塔需要）
> - `apply_buff` 在 BuffSystem 任务中（如未来的燃烧 DoT；MVP 仅引入骨架）
> - `remove_self` 与 W2.10 TrapSystem / Crystal 死亡触发同提交

| # | 任务 | TDD 步骤 | 产出 | 提交 |
|---|---|---|---|---|
| W2.1 | MovementSystem 测试：实体沿节点列表行进；到达终点触发 `onEnter` 事件 | 红 | `src/systems/__tests__/MovementSystem.test.ts` | `test: add movement progression and endpoint trigger coverage` |
| W2.2 | 实现 MovementSystem（GAMEPLAY 阶段） | 绿 | `src/systems/MovementSystem.ts` | `refactor(roguelike): implement MovementSystem with path traversal` |
| W2.3 | AttackSystem 测试：选最近敌人 / 冷却时间 / 伤害计算 | 红 | `src/systems/__tests__/AttackSystem.test.ts` | `test: add target selection and attack cooldown coverage` |
| W2.4 | 实现 AttackSystem（hit-scan 直击；**ProjectileSystem 推迟**：MVP 单兵种箭塔无需弹道实体，留给后续 Wave 需要弹道型单位时再加） | 绿 | `src/systems/AttackSystem.ts` | `refactor(roguelike): implement AttackSystem with hit-scan damage` |
| W2.5 | HealthSystem + LifecycleSystem 测试：HP≤0 → onDeath 触发 → 实体被销毁 | 红 | `src/systems/__tests__/HealthSystem.test.ts` | `test: add health depletion and lifecycle dispatch coverage` |
| W2.6 | 实现 HealthSystem + LifecycleSystem（LIFECYCLE 阶段） | 绿 | `src/systems/HealthSystem.ts`、`src/systems/LifecycleSystem.ts` | `refactor(roguelike): implement health and lifecycle dispatch` |
| W2.7 | UnitFactory 测试：从 UnitConfig 创建实体 → 组件挂载正确 | 红 | `src/systems/__tests__/UnitFactory.test.ts` | `test: add UnitFactory config-to-entity coverage` |
| W2.8 | 实现 UnitFactory（CREATION 阶段） | 绿 | `src/systems/UnitFactory.ts` | `refactor(roguelike): implement UnitFactory for config-driven entity creation` |
| W2.9 | 水晶秒杀机制测试：进入射程的敌人被秒杀 + 水晶 HP -1；Boss 携 `immune_to_crystal_kill` 例外 | 红 | `src/systems/__tests__/CrystalSystem.test.ts` | `test: add crystal instant-kill and boss immunity coverage` |
| W2.10 | 实现 CrystalSystem + 集成测试（一个完整战斗：spawn 3 敌人 → 部分被塔击杀 → 部分到水晶被秒杀） | 绿 + 集成 | `src/systems/CrystalSystem.ts`、`src/systems/__tests__/combat.integration.test.ts` | `feat: complete v3.4 combat vertical slice with crystal mechanic` |

**Wave 2 命令门**：`npm run typecheck && npm test`（聚焦 `src/systems/__tests__/**` 与 `src/__tests__/combat.integration.test.ts`）

**Wave 2 DoD**：集成测试通过完整战斗回路；浏览器可见敌人沿路径移动 + 塔射击 + 死亡 + 水晶秒杀；所有系统 dt 可手动步进。

---

### Wave 3 — Run 循环垂直切片（约 2 天 · 10 commits）

**目标**：证明 Run 存在于单关之外（卡组 / 手牌 / 能量 / 关后过渡）。

| # | 任务 | TDD 步骤 | 产出 | 提交 |
|---|---|---|---|---|
| W3.1 | RunManager 状态机测试：Idle → Battle → InterLevel → Result 切换；非法转移被拒绝 | 红 | `src/unit-system/__tests__/RunManager.test.ts` | `test: add RunManager state machine coverage` |
| W3.2 | 实现 RunManager | 绿 | `src/unit-system/RunManager.ts` | `refactor(roguelike): implement RunManager state machine for v3.4 single-run` |
| W3.3 | DeckSystem 测试：抽 8 张组卡组（按稀有度权重）/ 抽到手牌 / 弃牌 / 洗弃牌堆 | 红 | `src/unit-system/__tests__/DeckSystem.test.ts` | `test: add deck draw, discard, and reshuffle coverage` |
| W3.4 | 实现 DeckSystem + HandSystem（手牌上限 4，超出入弃牌） | 绿 | `src/unit-system/DeckSystem.ts`、`src/unit-system/HandSystem.ts` | `refactor(roguelike): implement deck and hand for v3.4 MVP` |
| W3.5 | EnergySystem 测试（MVP 简化）：1 E/s 自动恢复 / 上限 10 / 出卡扣除 | 红 | `src/unit-system/__tests__/EnergySystem.test.ts` | `test: add MVP energy auto-recovery coverage` |
| W3.6 | 实现 EnergySystem（带 `// MVP-SIMPLIFICATION:` 注释） | 绿 | `src/unit-system/EnergySystem.ts` | `refactor(roguelike): implement MVP energy system with auto-recovery` |
| W3.7 | CardSpawnSystem + SpellCastSystem 测试：单位卡 → UnitFactory 调用；法术卡 → RuleEngine 触发 | 红 | `src/unit-system/__tests__/CardSpawn.test.ts` | `test: add card-to-unit and card-to-spell dispatch coverage` |
| W3.8 | 实现 CardSpawnSystem + SpellCastSystem | 绿 | `src/unit-system/CardSpawnSystem.ts`、`src/unit-system/SpellCastSystem.ts` | `refactor(roguelike): implement card-to-runtime resolution` |
| W3.9 | EconomySystem 测试：击杀 → 金币；波末 → 金币；L1 通关 → SP 奖励（公式 N×2） | 红 | `src/systems/__tests__/EconomySystem.test.ts` | `test: add gold and SP reward coverage` |
| W3.10 | 实现 EconomySystem + Run 切换集成测试（开 Run → 战斗 → 关后状态 → 结算） | 绿 + 集成 | `src/systems/EconomySystem.ts`、`src/unit-system/__tests__/run.integration.test.ts` | `feat: complete v3.4 run vertical slice with economy` |

**Wave 3 命令门**：`npm run typecheck && npm test`（聚焦 `src/unit-system/__tests__/**` 与 `src/__tests__/run.integration.test.ts`）

**Wave 3 DoD**：集成测试通过完整 Run 流程（无 UI）；能量 / 金币 / SP 三资源独立工作；状态机切换正确。

---

### Wave 4 — 配置驱动内容迁移（约 1.5 天 · 7 commits）

**目标**：用 YAML 替代代码硬编码内容。**只迁移 MVP 需要的内容**。

| # | 任务 | TDD 步骤 | 产出 | 提交 |
|---|---|---|---|---|
| W4.1 | 配置加载器测试：加载有效 YAML / 拒绝无效 schema / 注册表查找 | 红 | `src/config/__tests__/loader.test.ts` | `test: add config loader validation and registry coverage` |
| W4.2 | 实现 loader + registry（用 `import.meta.glob` 内嵌打包） | 绿 | `src/config/loader.ts`、`src/config/registry.ts` | `refactor(roguelike): implement YAML config loader with strict schema` |
| W4.3 | MVP 单位 YAML：箭塔 / 盾卫 / 尖刺陷阱 / 火球术法术（spell 用 RuleHandler 引用）/ 金矿 / 水晶 + 3 敌人（grunt / runner / heavy）；数值从 `50-mda` 复制 | 数据回填，配单元测试验证字段 | `src/config/units/*.yaml` | `feat: migrate MVP unit configurations from 50-mda` |
| W4.4 | MVP 卡牌 YAML：5 张卡（箭塔卡 / 盾卫卡 / 尖刺卡 / 火球术卡 / 金矿卡）| 验证测试 | `src/config/cards/*.yaml` | `feat: migrate MVP card configurations` |
| W4.5 | L1 关卡 YAML：按 `16-level-blueprints` L1 §2 实现 grid / 路径 / spawn / 3-5 波简化版 | 验证测试 | `src/config/levels/level-01.yaml` | `feat: migrate L1 level blueprint for MVP` |
| W4.6 | 秘境事件配置：MVP 2 个事件（零成本退出 + 30G 换 5SP） | 验证测试 | `src/config/mystic-events.yaml` | `feat: add MVP mystic event pool` |
| W4.7 | 集成测试：从 YAML 配置端到端走完一次战斗 + 资源结算 | 集成 | `src/__tests__/content.integration.test.ts` | `test: add config-to-runtime integration coverage` |

**Wave 4 命令门**：`npm run typecheck && npm test`（聚焦 `src/config/__tests__/**` 与 `src/__tests__/content.integration.test.ts`）

**Wave 4 DoD**：所有 MVP 内容由 YAML 驱动；无硬编码数值在代码中；集成测试从 YAML 加载并运行完整战斗。

---

### Wave 5 — UI 与渲染集成（约 2 天 · 9 commits）

**目标**：让 MVP 通过预期界面可玩。**UI 状态映射用单元测试，关键流程用冒烟测试**。

| # | 任务 | TDD 步骤 | 产出 | 提交 |
|---|---|---|---|---|
| W5.1 | EntityRenderer / RenderSystem 测试：ECS Position/Visual → PixiJS Display Object 同步；按 Y 排序 | 红（用 mock PixiJS Container） | `src/render/__tests__/RenderSystem.test.ts` | `test: add render synchronization coverage` |
| W5.2 | 实现 RenderSystem（RENDER 阶段，始终最后）+ EntityRenderer（矩形 / 圆形 + 文字 HP 条） | 绿 | `src/render/EntityRenderer.ts`、`src/systems/RenderSystem.ts` | `refactor(roguelike): implement minimal PixiJS render layer` |
| W5.3 | InputManager 测试：事件入队 / 每帧 flush / UI 优先级 | 红 | `src/input/__tests__/InputManager.test.ts` | `test: add input dispatch priority coverage` |
| W5.4 | 实现 InputManager + 手牌区拖卡 UI（HandPanel） | 绿 | `src/input/InputManager.ts`、`src/ui/HandPanel.ts` | `feat: implement drag-from-hand deployment flow` |
| W5.5 | HUD：金币 / 能量 / SP / 水晶 HP / 关卡-波次 显示（响应 RunManager 状态） | 单元测试 UI 状态映射 | `src/ui/HUD.ts`、`src/ui/__tests__/HUD.test.ts` | `feat: implement HUD with reactive state mapping` |
| W5.6 | 关后 3 选 1 节点 UI（InterLevelPanel）：商店 / 秘境 / 跳过三按钮 | 单元测试按钮路由 | `src/ui/InterLevelPanel.ts`、`src/ui/__tests__/InterLevelPanel.test.ts` | `feat: implement inter-level 3-choice panel` |
| W5.7 | 商店 UI（48 简化版）：2 槽 = 1 单位卡 + 1 SP 兑换（1 SP = 50 G） | 单元测试 + 集成 | `src/ui/ShopPanel.ts`、`src/ui/__tests__/ShopPanel.test.ts` | `feat: implement MVP shop with unit card and SP purchase` |
| W5.8 | 秘境 UI（MysticPanel）+ Run 结算面板（RunResultPanel）+ 主菜单（仅 "开始新 Run"） | 单元测试 + 集成 | `src/ui/MysticPanel.ts`、`src/ui/RunResultPanel.ts`、`src/ui/MainMenu.ts` | `feat: implement mystic, result, and main menu panels` |
| W5.9 | 技能树 UI + 实现：箭塔「连射」路径 2 节点（+20% 攻速 / +1 同时目标）；在商店内入口 | 单元测试 + 集成 | `src/ui/SkillTreePanel.ts`、`src/core/RuleHandlers.ts`（新增 `boost_attack_speed` / `add_extra_target`）、`src/config/units/tower_arrow.yaml`（追加 skillTree） | `feat: implement MVP skill tree for arrow tower` |

**Wave 5 命令门**：`npm run typecheck && npm test`（聚焦 `src/ui/__tests__/**` 与 `src/render/__tests__/**`）

**Wave 5 DoD**：浏览器手动操作可走通完整 Run 流程；技能树解锁后战斗中效果可见；HUD 实时更新；所有 UI 状态映射单元测试覆盖。

---

### Wave 6 — 回归加固（约 1 天 · 4-6 commits）

**目标**：消除重写过程中的漂移，证明系统作为整体可工作。

| # | 任务 | TDD 步骤 | 产出 | 提交 |
|---|---|---|---|---|
| W6.1 | 冒烟测试：主菜单 → 开 Run → L1 → 通关 → 3 选 1（依次测三个选项）→ 结算 → 主菜单 | 集成 | `src/__tests__/smoke.test.ts` | `test: add end-to-end smoke coverage for MVP flow` |
| W6.2 | 修复冒烟测试发现的回归（每个 bug：先写失败测试，再修复，再绿） | TDD | 视情况 | `fix: ...`（视情况多个 commit） |
| W6.3 | 性能基线：50 实体 + 全特效场景 FPS ≥ 60；记录基线数据 | 手动测量 | `design/dev-logs/2026-05-15-mvp-perf-baseline.md` | `docs: record MVP performance baseline` |
| W6.4 | 删除已被新实现完全替代且无引用的脚手架（保守策略：MVP 不删 `src/legacy/`，仅删 W0.2 期间引入的临时桥接代码） | — | — | `refactor(roguelike): remove verified-unused rewrite scaffolding` |

**Wave 6 命令门**：`npm run typecheck && npm test && npm run build`

**Wave 6 DoD**：冒烟测试全绿；性能基线达标；无已知回归。

---

### Wave 7 — 发布门（约 0.5 天 · 2 commits）

**目标**：代码、文档、验收对齐。

| # | 任务 | TDD 步骤 | 产出 | 提交 |
|---|---|---|---|---|
| W7.1 | 代码 ↔ 设计文档一致性审查：用 oracle agent 审查 MVP 实现是否符合 v3.4 设计文档；不一致 → 写 issue 或更新文档 | — | 审查记录 | `docs: record v3.4 MVP design compliance review` |
| W7.2 | 最终绿色门：`npm run typecheck && npm test && npm run build` 全绿；写 dev-log 总结 MVP 阶段 | — | `design/dev-logs/2026-05-15-mvp-rewrite-complete.md` | `docs: finalize v3.4 MVP acceptance and release notes` |

**Wave 7 命令门（最终门）**：`npm run typecheck && npm test && npm run build` 全部退出码 0

**Wave 7 DoD**：3 命令全绿；dev-log 完整；MVP 可演示。

---

## 4. 并行化模型

> 主线由单一开发者顺序执行；如需并行（subagent 委托）按以下边界：

**Wave 1 完成后可安全并行**：
- combat 系统测试（W2.1-W2.10 部分）
- 配置 schema 测试
- handler 注册表测试

**Wave 2 完成后可安全并行**：
- Run 系统（Wave 3）
- 内容迁移（Wave 4 部分，对已有契约的 YAML）
- UI 状态映射单元测试

**Wave 3 完成后可安全并行**：
- 关后节点 UI（W5.6-W5.8）
- 更大范围配置迁移
- 冒烟测试编写

**永远不并行**：
- World 生命周期变更
- Pipeline 阶段顺序变更
- 顶层状态权威变更

---

## 5. MVP 验收矩阵（设计需求 → 测试映射）

> **使用约定**：每一行代表一条不可缺失的 MVP 验收条件。实现该需求的代码必须有以下表格中**至少一列**的测试覆盖。Wave DoD 验证以本矩阵为准。

### 5.1 架构契约（Wave 1）

| 设计需求 | 来源文档 | 单元测试 | 集成测试 | 冒烟测试 |
|---|---|---|---|---|
| bitecs World 创建、延迟实体销毁 | 60-architecture §3.2 | `core/__tests__/World.test.ts` | — | — |
| 8 阶段 Pipeline 顺序与依赖 | 60-architecture §3.1 | `core/__tests__/pipeline.test.ts` | — | — |
| RuleEngine 事件分发（9 种生命周期事件） | 60-architecture §5.1 | `core/__tests__/RuleEngine.test.ts` | — | — |
| `Game.tick(dt)` 确定性步进 | 60-architecture §2 | `core/__tests__/Game.test.ts` | — | — |
| 核心组件 SoA 字段定义 | 60-architecture §3.3 | `core/__tests__/components.test.ts` | — | — |

### 5.2 战斗垂直切片（Wave 2）

| 设计需求 | 来源文档 | 单元测试 | 集成测试 | 冒烟测试 |
|---|---|---|---|---|
| 单位沿路径移动 + 到达终点触发 | 16-level-blueprints §2 / 60-arch §4 | `systems/__tests__/MovementSystem.test.ts` | `__tests__/combat.integration.test.ts` | — |
| 塔目标选择 + 攻击冷却 + 弹道命中 | 60-architecture §5.2 | `systems/__tests__/AttackSystem.test.ts`、`ProjectileSystem.test.ts` | `combat.integration.test.ts` | — |
| 生命值衰减 → onDeath 分发 → 实体清理 | 60-architecture §5.1 | `systems/__tests__/HealthSystem.test.ts`、`LifecycleSystem.test.ts` | `combat.integration.test.ts` | — |
| 火球术 AoE + 燃烧 Buff（DoT） | 27-traps-spells-scene §3 | `systems/__tests__/BuffSystem.test.ts`、`RuleHandlers.test.ts`（`deal_aoe_damage`、`apply_buff`） | `combat.integration.test.ts` | — |
| 波次生成 + 间隔推进 + 波次结束触发 | 16-level-blueprints §3 | `systems/__tests__/WaveSystem.test.ts` | `combat.integration.test.ts` | — |
| 水晶秒杀（敌人到达水晶即水晶死亡，Boss 例外但 MVP 无 Boss） | 10-roguelike-loop §5.2.3 | `systems/__tests__/CrystalSystem.test.ts` | `combat.integration.test.ts` | `smoke.test.ts`（L1 失败路径） |

### 5.3 Run 循环垂直切片（Wave 3）

| 设计需求 | 来源文档 | 单元测试 | 集成测试 | 冒烟测试 |
|---|---|---|---|---|
| RunManager 状态机（Run 开始 / L1 战斗 / 关后选择 / Run 结算） | 10-roguelike-loop §2 | `unit-system/__tests__/RunManager.test.ts` | `__tests__/run.integration.test.ts` | `smoke.test.ts`（完整流程） |
| 单 Run 闭环（Run 结束三资源清零，水晶 HP 不跨 Run 继承） | 10-roguelike-loop §11.1 | `RunManager.test.ts` | `run.integration.test.ts` | `smoke.test.ts` |
| 水晶 HP 跨关继承（MVP 仅 L1，验证 L1 内水晶 HP 状态保留语义） | 10-roguelike-loop §5.2.4 | — | `run.integration.test.ts` | — |
| 死亡从第 1 关重开（B2a；MVP 仅 L1 → 失败 → 重开） | 10-roguelike-loop §6.2 | `RunManager.test.ts` | `run.integration.test.ts` | `smoke.test.ts`（失败分支） |
| 卡组初始抽 8 张（S2 简化）、洗牌、抽卡循环 | 10-roguelike-loop §2.3 | `unit-system/__tests__/DeckSystem.test.ts` | `run.integration.test.ts` | — |
| 手牌上限固定 4 | 10-roguelike-loop §11.6 | `unit-system/__tests__/HandSystem.test.ts` | — | — |
| 能量上限 10 + 1 E/s 自动恢复（S1 简化） | 10-roguelike-loop §11.5（简化偏离记录 §0 S1） | `unit-system/__tests__/EnergySystem.test.ts` | `combat.integration.test.ts` | — |
| 三资源互相独立、无互转（除商店金币 → SP 单向） | 10-roguelike-loop §11.8 | `EnergySystem.test.ts`、`EconomySystem.test.ts` | `run.integration.test.ts` | — |
| 金币 → SP 单向兑换（商店内，1 SP = 50 G） | 10-roguelike-loop §11.8 / 48 §5.3 | `ui/__tests__/ShopPanel.test.ts` | `run.integration.test.ts` | — |
| Hero Score 公式（S4 简化 = 通关数 × 1000 + 击杀数 × 10） | 10-roguelike-loop §6.3（简化偏离 §0 S4） | `RunManager.test.ts` | `run.integration.test.ts` | — |
| 存档 schema v3.0.0 骨架（RunHistory + 累计统计 + 设置） | 10-roguelike-loop §7 | `unit-system/__tests__/SaveSystem.test.ts` | — | — |

### 5.4 配置驱动内容（Wave 4）

| 设计需求 | 来源文档 | 单元测试 | 集成测试 | 冒烟测试 |
|---|---|---|---|---|
| YAML 加载器（zod 校验，错误明确） | 60-architecture §3.3 | `config/__tests__/loader.test.ts` | `__tests__/content.integration.test.ts` | — |
| 单位注册表（按 ID / Category 查询） | 60-architecture §3.3 | `config/__tests__/registry.test.ts` | — | — |
| 卡牌注册表（5 卡：箭塔卡 + 盾卫卡 + 尖刺卡 + 火球术 + 金矿卡） | 10-roguelike-loop §2.4 | `config/__tests__/cardRegistry.test.ts` | `content.integration.test.ts` | — |
| 6 单位 YAML 配置（箭塔 / 盾卫 / 尖刺 / 火球术 / 金矿 / 水晶 + 3 敌人）通过加载校验 | §0 单位覆盖 | `config/__tests__/units.schema.test.ts` | — | — |
| L1 蓝图（grid 21×9、路径、波次池）通过加载校验 | 16-level-blueprints §2 | `config/__tests__/levels.schema.test.ts` | `content.integration.test.ts` | `smoke.test.ts` |
| UnitFactory 从配置生成实体（含规则挂载） | 60-architecture §5.3 | `core/__tests__/UnitFactory.test.ts` | `content.integration.test.ts`、`combat.integration.test.ts` | — |
| 秘境事件配置（≥1 事件 + 零成本退出，S9 简化） | 27-traps-spells-scene §5（简化偏离 §0 S9） | `config/__tests__/mystic.schema.test.ts` | `run.integration.test.ts` | — |

### 5.5 UI 与渲染（Wave 5）

| 设计需求 | 来源文档 | 单元测试 | 集成测试 | 冒烟测试 |
|---|---|---|---|---|
| 手牌区拖卡 → 战场放置 → 扣能量 + 抽新卡 | 10-roguelike-loop §2.5 | `ui/__tests__/HandPanel.test.ts` | `run.integration.test.ts` | `smoke.test.ts` |
| 关后 3 选 1 面板（商店 / 秘境 / 跳过三向互斥触发正确状态转移） | 10-roguelike-loop §11.9 | `ui/__tests__/InterLevelPanel.test.ts` | `run.integration.test.ts` | `smoke.test.ts`（3 分支各一次） |
| 商店面板 2 槽（S8 简化：1 单位卡槽 + 1 SP 兑换槽） | 48-shop-redesign-v34 §1（简化偏离 §0 S8） | `ui/__tests__/ShopPanel.test.ts` | `run.integration.test.ts` | `smoke.test.ts` |
| 秘境面板（≥1 事件按钮 + 零成本退出按钮） | 27-traps-spells-scene §5 | `ui/__tests__/MysticPanel.test.ts` | `run.integration.test.ts` | `smoke.test.ts` |
| 技能树面板 SP 投入 → 节点解锁 → 战斗中效果可见（仅箭塔「连射」2 节点） | 22-skill-tree-overview / 22a | `ui/__tests__/SkillTreePanel.test.ts` | `run.integration.test.ts` | `smoke.test.ts` |
| HUD 实时映射三资源（能量 / 金币 / SP） | 10-roguelike-loop §11 | `ui/__tests__/HUD.test.ts` | — | `smoke.test.ts` |
| 主菜单 → 开 Run → 进入战斗 | 10-roguelike-loop §1 | `ui/__tests__/MainMenu.test.ts` | `run.integration.test.ts` | `smoke.test.ts` |
| Run 结算面板（显示 Hero Score、击杀数、通关数） | 10-roguelike-loop §6.3 | `ui/__tests__/RunResultPanel.test.ts` | `run.integration.test.ts` | `smoke.test.ts` |
| EntityRenderer 程序化几何（方块塔、圆形敌人、文字血条；S7 简化无粒子无装饰） | 42-art-assets / 44-visual-effects（简化偏离 §0 S7） | `render/__tests__/EntityRenderer.test.ts` | — | — |
| 渲染分层（背景 / 实体 / 弹道 / UI） + Y 排序 | 60-architecture §4 | `render/__tests__/Renderer.test.ts` | — | — |

### 5.6 回归与发布（Wave 6-7）

| 设计需求 | 来源文档 | 单元测试 | 集成测试 | 冒烟测试 |
|---|---|---|---|---|
| L1 完整正向流程（菜单 → 开 Run → 通关 → 3 选 1 → Run 结算） | §0 Run 流程 | — | — | `smoke.test.ts`（happy path） |
| L1 失败流程（菜单 → 开 Run → 水晶死亡 → 重开） | 10-roguelike-loop §6.2 | — | — | `smoke.test.ts`（failure path） |
| 性能基线 FPS ≥ 60（手动验证 + 帧时 budget 检查） | 60-architecture §7 | `__tests__/perf.budget.test.ts` | — | — |
| 三命令最终绿色门：`npm run typecheck && npm test && npm run build` 全部 exit 0 | AGENTS.md 构建流水线 | — | — | CI / 手动 |

---

## 6. 验收清单（MVP 完成判定）

MVP 完成 = 以下全部通过：

- [ ] `npm run typecheck && npm test && npm run build` 全绿
- [ ] 冒烟测试覆盖主菜单 → Run → L1 → 通关 → 3 选 1（3 个分支）→ 结算 → 主菜单
- [ ] 浏览器闭环可玩：主菜单 → 开 Run → L1 → 战斗（3-5 波）→ 通关 → 3 选 1（任选一项）→ Run 结算 → 返回主菜单
- [ ] 6 类单位各 1 个均可使用：1 塔 / 1 士兵 / 1 陷阱 / 1 法术 / 1 生产建筑 / 1 水晶
- [ ] 能量按 MVP 简化规则自动恢复，上限 10
- [ ] 商店：可买 1 单位卡 + 用金币换 SP
- [ ] 秘境：可选 1 事件 + 零成本退出
- [ ] 跳过：零代价进入下一阶段
- [ ] 技能树：箭塔「连射」路径 2 节点可解锁，解锁后战斗中效果生效
- [ ] Run 结算面板展示战绩
- [ ] 所有 `// MVP-SIMPLIFICATION:` 注释位置完整、可被搜索
- [ ] 性能基线：50 实体场景 FPS ≥ 60
- [ ] dev-log 完成

---

## 7. 后续阶段路线图（MVP 之后）

| 阶段 | 范围 | 预估 |
|---|---|---|
| **P1 — 内容扩展** | 补齐 7 塔 + 6 士兵 + 9 陷阱 + 14 法术 + 2 生产建筑 + 40+ 敌人；切换能量模型为水晶+击杀 | 2-3 周 |
| **P2 — 关卡扩展** | L2-L8 + 终战；波次蓝图全实现；天气系统接入 | 1-2 周 |
| **P3 — 商店 + 秘境完整** | 8 槽商店 + 14 事件秘境 + 30% 高风险事件 | 1 周 |
| **P4 — 技能树完整** | 22a-22e 所有单位技能树共 ~200 节点 + ~92 RuleHandler | 2-3 周 |
| **P5 — AI 完整化（规则引擎）** | 士兵四状态机 / Boss 阶段切换 / 威胁度评分 等 AI 需求按 [`30-ai/31-soldier-ai.md`](../30-ai/31-soldier-ai.md) §1-§5 / §10-§12 + `RuleHandler` 落地；~~BehaviorTree 引擎接入~~ 已于 v2.5 移除（[决策](../00-vision/decisions/2026-05-16_drop-behavior-tree.md)） | 1-2 周 |
| **P6 — 渲染打磨** | 粒子特效 / 装饰 / 天气视觉 / buff 图标 / 受伤闪烁等 | 1-2 周 |
| **P7 — 测试与平衡** | Playwright E2E / 数值平衡 / Hero Score 完整公式 / 成就 | 持续 |

---

## 8. 提交计划速查（前 20 个原子提交）

按 Wave 顺序的提交节奏示例：

1. `docs: lock v3.4 MVP acceptance matrix`
2. `refactor(roguelike): bootstrap v3.4 entry alongside legacy main`
3. `refactor(roguelike): archive v3.3 codebase into src/legacy/`
4. `refactor(roguelike): promote v3.4 entry to src/main.ts`
5. `test: add World lifecycle and deferred cleanup coverage`
6. `refactor(roguelike): implement bitecs World wrapper with deferred cleanup`
7. `test: add pipeline phase ordering coverage`
8. `refactor(roguelike): implement 8-phase pipeline orchestration`
9. `test: add RuleEngine dispatch and handler registration coverage`
10. `refactor(roguelike): implement RuleEngine with MVP handler set`
11. `refactor(roguelike): define core ECS components for v3.4 MVP`
12. `feat: wire PixiJS app with deterministic Game.tick stepping`
13. `test: add movement progression and endpoint trigger coverage`
14. `refactor(roguelike): implement MovementSystem with path traversal`
15. `test: add target selection and attack cooldown coverage`
16. `refactor(roguelike): implement attack and projectile resolution`
17. `test: add health depletion and lifecycle dispatch coverage`
18. `refactor(roguelike): implement health and lifecycle dispatch`
19. `test: add UnitFactory config-to-entity coverage`
20. `refactor(roguelike): implement UnitFactory for config-driven entity creation`

后续提交按 Wave 2.9 起及 Wave 3-7 任务表逐条对应。

---

## 9. 修订历史

| 版本 | 日期 | 变更 |
|---|---|---|
| 1.0 | 2026-05-15 | 初版 —— MVP 重写 8 个里程碑 32 个任务（按模块分组） |
| 2.0 | 2026-05-15 | **Momus 第 1 轮评审后大改**：按 Wave 0-7（系统稳定性顺序）重新组织；每个任务显式 TDD 红绿步骤；加入 §2 三层测试架构、§4 并行化模型、§5 设计需求 → 测试映射矩阵、§8 提交计划速查；commit 节奏从「按任务粒度」改为「test commit + impl commit 配对」 |
| 2.1 | 2026-05-15 | **Momus 第 2 轮评审后修订**：（1）Wave 0 分 4 步保绿归档，避免「全量 mv 后红一整段」；改用 `src/legacy/` 而非顶层 `src.legacy/`；（2）Wave 1 DoD 措辞从「100% 覆盖」改为「核心运行时契约行为覆盖」+ 新增 Wave 1 后契约冻结条款；（3）Wave 6 `chore:` 改 `refactor(roguelike):`；（4）每 Wave 加显式命令门；（5）§2.3 Layer 3 明确为状态机驱动 + happy-dom 少量 + 不做像素截图；（6）§0 简化清单升级为 10 项追溯表带「计划替换阶段」列。**注**：Momus 提出的「英文重写」未采纳——本项目 AGENTS.md 第 5 条铁律要求中文沟通，计划文档面向中文团队 |
| **2.2** | **2026-05-15** | **新分支策略调整**（Momus v2.1 已批准，本次为分支策略相关 Wave 0 简化）：（1）从 `rougelike` 切出新分支 `rougelike-v34`，旧分支冻结作 v3.3 归档；（2）确认现有 `src/config/**` YAML（按 v3.4 设计生成）可复用作 Wave 4 基线；（3）Wave 0 从「4 步保绿归档到 `src/legacy/`」简化为「2 步直接清空 src/ 非 config/ 内容」；commits 从 4 降至 2；总 commits ~50 降至 ~48；（4）§0 代码起点表述更新；（5）后续 Wave 1-7 不变 |
| **2.3** | **2026-05-15** | **W1.6 RuleHandler 推迟到 Wave 2**：执行过程中发现原 W1.6 计划「实现 RuleEngine + 4 个 MVP handler」存在依赖反转 —— 4 个 handler (deal_damage / deal_aoe_damage / apply_buff / remove_self) 操作 Health / Position / Buff 组件，而组件在 W1.7 才定义。如果在 W1.6 时写 handler 会写出"为凑数而存在"的占位代码，违反 TDD 红绿原则。修订：W1.6 仅 ship RuleEngine 引擎核心（注册表 + 分发 + entityRules 表），4 handler 分散到 Wave 2 各系统中"配对首次使用的系统"同提交。Wave 1 契约冻结条款不受影响：API 表面（registerHandler / attachRules / dispatch / clearRules）与 9 个事件名都在 W1.6 冻结，只是 handler 群体的实现推迟 |
| **2.4** | **2026-05-15** | **W2.4 ProjectileSystem 推迟 + deal_damage handler 不引入**：实施 W2.4 时确认 MVP 只有箭塔一种攻击单位，hit-scan（同帧扣血）已足够。引入 Projectile 实体 + 飞行插值 + 命中判定 system 是过度工程，不为 MVP 验收提供任何新功能。修订：W2.4 只 ship AttackSystem hit-scan 版本；deal_damage RuleHandler 也不在此 Wave 引入（hit-scan 直接写 Health.current，无需走 handler 调度）；deal_damage 调整为「首次需要间接伤害的 Wave 引入」，例如未来的 AoE 法术、爆炸塔、Trap 触发。ProjectileSystem 同理 —— 加入第一个弹道型单位时一并实现 |
| **2.5** | **2026-05-16** | **形态级决策：放弃行为树作为 AI 实现方式**（产品 owner 决策，本会话于 W2.6 完成后归档）。AI 产品需求**全部保留**（士兵四状态机、Boss 阶段切换、嘲讽、AOE 主目标、威胁度评分等），仅实现方式由 BT 改为规则引擎驱动的 `targetSelection` / `attackMode` / 生命周期 `RuleHandler` 配置路径。S6 已实质降级（追溯表早已写「不接行为树」），P5 标题从「AI 行为树」改为「AI 完整化（规则引擎）」。文档影响：30-behavior-tree 整体 deprecated；31-soldier-ai 局部 deprecated（仅 §6/§7 行为树映射段作废，§1-§5 / §10-§12 需求段保留为权威）；60-architecture §5.3 整节 deprecated；README 30-ai 层描述同步。新增决策文档 [`00-vision/decisions/2026-05-16_drop-behavior-tree.md`](../00-vision/decisions/2026-05-16_drop-behavior-tree.md)。**代码层零影响**：本决策落地时 rougelike-v34 尚未引入任何 BT 代码（W2.6 完成，71/71 测试绿）；Wave 5/7 实装高级 AI 时按规则引擎路径设计 |
