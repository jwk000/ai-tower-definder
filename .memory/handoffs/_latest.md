# Handoff — Wave 6 全部收官，等待 Wave 7+ 起跑

> 生成时间: 2026-05-16 08:00 (Asia/Shanghai)
> 当前会话 token 达 70.7%，按 AGENTS.md「上下文铁律」主动 handoff。
> 续跑请新建会话，第一动作读本文件，按「Next Steps」继续。

---

## 1. User Requests (As-Is, 不改写)

- "拉一个新的分支再重构，这个分支不动了，新分支可以删除旧代码。但是关卡和单位的yaml配置是根据新的设计生成的，应该可以复用"
- "我决定放弃使用行为树实现ai，你需要修改一下文档和计划，你可以先做完目前的工作再处理。"
- "虽然不再使用行为树，但士兵的ai需求是保留的"
- "这次会话接近token上限后不要自动压缩，直接handoff"
- "现在是mvp阶段，你不需要写详细测试用例，以快速开发为主"
- Wave 6 启动决策："插入 W6.0：RunManager + 状态机 (Recommended)"
- Wave 6 commit 1 启动："启动：一次性实现 RunManager+RunController+UISystem (Recommended)"
- Wave 6 续跑指令："继续 .memory/handoffs/_latest.md"

## 2. Final Goal

在 `rougelike-v34` 分支完成 v3.4 MVP 重写，交付可演示的 L1 单关闭环（菜单 → Run → L1 战斗 → 3 选 1 → Run 结算），三命令门（typecheck / 全量测试 / build）全绿。

---

## 3. Wave 进度

### Done

- **Wave 0/1/2/3/4 全部完成**（44 commits）
- **Wave 5 完成 16 commits + 收尾 + plan ✅**（含 W5.B SkillTreePanel）
- **AGENTS.md 治理 2 commits**（`497953b` L1/L2/L3 档位决策表 + `3e64831` 收敛冗余目录路径）
- **Wave 6 完整 4 commits ✅**（2026-05-16 完成）：
  - `dcd6fe5 feat(run): extend RunManager + add RunController + UIPresenter [W6.1-W6.3]`
  - `cdb910b feat(boot): wire RunController + MVP pipeline into main [W6.4]`
  - `ea6ad84 test(smoke): MVP run flow integration coverage [W6.5]`
  - `6d5b3b1 docs(plan): mark Wave 6 complete and record S20-S23 simplifications [W6.7]`

### Verification State

- HEAD `6d5b3b1`
- 分支 `rougelike-v34`，工作树 clean（仅 `.memory/` untracked）
- `npm run typecheck` 绿
- `npm test` **263/263** 全绿（W6 增量 +2 smoke case）
- `npm run build` 1.16s 通过
- Wave 6 命令门：`typecheck && npm test && build` 全绿 ✅
- §0 追溯表新增 S20-S23（W6.4 wire 4 项简化点）已就位

### Remaining

- **Wave 7+ 演示路径专项**（新 Wave，原 v2 计划未设）：
  - 补 `WaveSystem` / `ProjectileSystem` / `BuildSystem`（推迟到此期）
  - main.ts wire `HandSystem` / `DeckSystem` / `EnergySystem` / `CardSpawnSystem` / `CardRegistry`
  - 连 UI 输入回调（卡牌拖放 + 商店购买 + 秘境选择 + 技能树点投入）
  - main.ts wire `EconomySystem` + 注册 `drop_gold` ruleHandler
  - `HUD.RunState.phase` 真实切换（接 WaveSystem 后改 `'deployment'/'battle'/'wave-break'`）
  - 性能基线测量（50 实体 + WaveSystem 持续 spawn）→ Wave 6 计划里推迟到此
  - 这是 4 项简化点 S20-S23 的实际替换 Wave
- **Wave 7（原最终发布门）**：代码↔设计文档一致性审查 + 最终 dev-log
- 上述两者顺序：Wave 7+ 演示路径专项 → Wave 7 发布门

---

## 4. Active Working Context

### Branch & HEAD

- 分支 `rougelike-v34`（旧 `rougelike` 冻结作 v3.3 归档，禁动）
- HEAD `6d5b3b1 docs(plan): mark Wave 6 complete and record S20-S23 simplifications [W6.7]`
- 工作树 clean（仅 `.memory/` untracked，符合 git ignore 期望）

### 关键文件（含行数）

**Wave 6 三件套 + 装配**：
- `src/unit-system/RunManager.ts` 181 行（W6.1，状态机 + Run 级资源）
- `src/core/RunController.ts` 89 行（W6.2，phase 切容器 + Battle 相位 tick）
- `src/ui/UIPresenter.ts` 99 行（W6.3，HUD + HandPanel 呈现器）
- `src/main.ts` 129 行（W6.4，wire 完整启动栈）
- `src/__tests__/run.integration.test.ts` 273 行（W6.5，3 + 2 case，263 测试中此文件贡献 5）

**MVP Pipeline 现状**（main.ts 已 wire 5 system）：
- `src/systems/MovementSystem.ts` 92 行（gameplay）
- `src/systems/AttackSystem.ts` 57 行（gameplay）
- `src/systems/CrystalSystem.ts` 45 行（gameplay）
- `src/systems/HealthSystem.ts` 23 行（lifecycle）
- `src/systems/LifecycleSystem.ts` 26 行（lifecycle）
- **缺**（Wave 7+ 待加）：WaveSystem / ProjectileSystem / BuildSystem

**未接入 main 但已实现**：
- `src/unit-system/HandSystem.ts` / `DeckSystem.ts` / `EnergySystem.ts` / `CardSpawnSystem.ts` / `CardRegistry.ts`
- `src/systems/EconomySystem.ts`（不是 System，是 helper；main 未实例化）

**核心契约文件**（不动）：
- `src/core/Game.ts` 27 行（World + Pipeline + RuleEngine）
- `src/core/pipeline.ts` 58 行（PHASE_ORDER 8 阶段）
- `src/render/Renderer.ts` 53 行（4 层 Container：mapLayer/entityLayer/projectileLayer/uiLayer）

**计划与设计**：
- `design/_plans/mvp-v3.4-rewrite.md`（**Wave 6 已标 ✅**，§0 含 S1-S23 追溯表 + guardrail，修订历史 2.6 已追加）
- `.sisyphus/plans/wave-6-detailed.md`（Wave 6 v2 详细计划，已落地，gitignored）

### MVP Pipeline wire 状态

`main.ts` 已注册到 `game.pipeline`：
```
Movement -> Attack -> Crystal -> (lifecycle phase) -> Health -> Lifecycle
```
按 `PHASE_ORDER` 自动调度。`drop_gold` ruleHandler **未注册**（S23）。

### `projectUIFrame()` 投影策略（main.ts）

```ts
run: {
  gold: runManager.gold,
  crystalHp: runManager.crystalHp,
  crystalHpMax: runManager.crystalHpMax,
  waveIndex: 1, waveTotal: 1,   // MVP 写死（S21）
  phase: 'battle',              // MVP 写死（S21）
}
hand: { cards: [], energy: 0 }  // MVP 空集合（S22）
```

### Pixi v8 API 形式

- `new Text({ text, style: { fill, fontSize } })`
- `Graphics().rect(x,y,w,h).fill({ color, alpha }).stroke({ width, color })`

---

## 5. Explicit Constraints (Verbatim Only)

- 中文沟通（AGENTS.md 第 5 条）
- TDD 红绿配对（MVP 快开发模式下宽松，集成测试兜底）
- 原子提交 + commit message 即任务描述
- roguelike 重构铁律：本分支属于推翻重写，旧分支冻结
- 工作计划须 Momus 评审
- MVP 阶段不写详细测试用例（用户最新指令）
- 接近 token 上限直接 handoff，不走自动压缩（用户最新指令）
- AI 不再用行为树，但士兵 AI 产品需求保留（规则引擎驱动）

---

## 6. Key Decisions

- **D1 RunController 独立文件**（不扩 Game.ts）—— Momus ✅
- **D2 字段分布**：Run 级（gold/sp/crystalHp/skillTrees/hasSavedRun）归 RunManager；单关瞬时（cards/energy/waveIndex）归 Game/LevelState
- **D3 UIPresenter 不进 Pipeline**：Pipeline 签名 `update(world, dt)` 与 HUD/Hand 数据源（RunManager + LevelState）解耦，改由 RunController 在 Battle 相位 `present(frame)`
- **D4 MVP 快开发模式合并 commit**：v2 计划 9-13 commit 压缩到 4 commits（W6.1-W6.3 三合一 + W6.4 + W6.5 + W6.7）
- **D5 W6.5 冒烟扩现有 `run.integration.test.ts`**（不另起新 smoke 文件），spy game.tick 验 phase 切换
- **D6 Wave 6 不补 WaveSystem/ProjectileSystem/BuildSystem**：推迟到 Wave 7+ 演示路径专项 Wave
- **D7 性能基线推迟**：v2 计划「50 实体 FPS ≥ 60」推迟到 Wave 7+（MVP wire 阶段无 WaveSystem 持续 spawn，测量无意义）
- **D8 S20-S23 同 W6.7 commit 落地**：满足 guardrail 三规则（同 commit + 三字段齐备 + 不作逃逸口），均指向 Wave 7+ 实质替换

---

## 7. Next Steps（按顺序）

### Step 1 — 起跑 Wave 7+（演示路径专项 Wave）

**先做计划 + Momus 评审**（不要直接动代码）。Wave 7+ 涉及 3 个新 system + main 大改 + 输入回调链，复杂度等同 Wave 5/6，必须先有计划。

建议工作流：
1. 询问用户是否要 Wave 7+ 计划走完整 Momus 流程（推荐：是）
2. 用 `task(subagent_type="plan", run_in_background=false)` 或直接写 `.sisyphus/plans/wave-7-plus-detailed.md`
3. 计划必含：WaveSystem 设计 + ProjectileSystem 设计 + main 输入连线方案 + 测试策略（哪些走集成测试，哪些走 e2e smoke）
4. 计划完成后用 `task(subagent_type="momus", session_id="ses_1d201ace0ffe7EVyBEVKzwturA", ...)` 复用 Wave 6 Momus session 评审
5. APPROVED 后按 Wave 6 节奏推进（合并 commit + 集成测试兜底）

### Step 2 — Wave 7+ 实施（按 Momus 通过的计划）

预估 commits（参考 Wave 6 节奏）：
- W7+.1 WaveSystem + 集成测试
- W7+.2 ProjectileSystem + 集成测试（如确需，否则继续 hit-scan）
- W7+.3 main wire HandSystem/DeckSystem/EnergySystem/CardSpawn + 输入回调
- W7+.4 main wire EconomySystem + 注册 drop_gold handler
- W7+.5 HUD.phase 真实切换接 WaveSystem（替换 S21）
- W7+.6 性能基线测量 + dev-log
- W7+.7 收尾：plan.md Wave 7+ 标 ✅ + §0 标 S20-S23 为「已替换」

### Step 3 — Wave 7 发布门

- 代码↔设计文档一致性审查（oracle agent）
- 最终 dev-log + 三命令门

---

## 8. Delegated Agent Sessions（可复用）

- **Momus Wave 6 计划评审 session** `ses_1d201ace0ffe7EVyBEVKzwturA`（APPROVED-WITH-ENRICHMENT）
  - **复用规则**：Wave 7+ 计划评审继续复用此 session_id（保留 Wave 6 上下文，省 70% tokens）
- **Explore 三份并行报告 session**（结果已吸收，session 不必复用）
  - `ses_1d204754fffe9WjIiiNGTWyp9e` RunManager 现状
  - `ses_1d2044ad1ffes5RopXNNg6E24U` 8 面板 stub 字段并集
  - `ses_1d2044a0dffemLzxFmfdgoSC1E` Game+main+Pipeline 装配现状

---

## 9. Critical Gotchas

- **happy-dom 测试环境**：EntityViewSink 模式可单测 RenderSystem 无 Pixi App；UIPresenter 真 Pixi Text/Graphics 不在 happy-dom 单测（Wave 6 跳过此覆盖，状态机 spy 已兜住核心逻辑）
- **LayoutManager singleton**：每个测试 beforeEach 须 `LayoutManager.update(1920, 1080)` 重置
- **HUD.RunState 与 RunManager.phase 字段名不一致**：`main.ts:projectUIFrame()` 写死 phase=`'battle'`，Wave 7+ 接 WaveSystem 后才真实切换
- **EconomySystem 不是 ECS System**：是普通 class，不进 pipeline；需要在 main.ts 手工注册 `drop_gold` ruleHandler 让它收金（Wave 7+ 做）
- **§0 追溯表 guardrail 三规则**：同 commit 落地 + 三字段齐备（替换阶段+影响模块+设计章节）+ 不作逃逸口
- **AGENTS.md L1/L2/L3 档位决策表**：Wave 7+ 新增 3 个 system 属于 L3（核心引擎扩 PHASE 节点），main wire 输入连线属于 L2（系统装配）；先看顶部决策表再下手
- **Renderer 视口固定 1344×576**（21 cols × 9 rows × 64 cell），不是 1920×1080；UIPresenter 必须用真实视口
- **Pipeline 中 EconomySystem 不在**：它不是 `System` 接口；只能通过 `ruleEngine.registerHandler('drop_gold', cb)` 拿到死敌掉金事件
- **MVP 单关 path**：main.ts 写死 `[{x:0, y:288}, {x:1344, y:288}]` 横穿地图（DEFAULT_PATH），Wave 7+ LevelLoader 接入再改

---

## 10. 续跑会话第一动作

```
1. Read .memory/handoffs/_latest.md（本文件）
2. Run: rtk git log --oneline -6（确认 HEAD = 6d5b3b1，Wave 6 4 commits 完整）
3. Run: rtk git status（确认 clean）
4. Run: rtk npm test -- --run | tail -5（确认 263/263）
5. 与用户确认是否 Wave 7+ 起跑（推荐先 Momus 评审计划）
6. 若 Yes → Step 1（写 .sisyphus/plans/wave-7-plus-detailed.md + Momus 评审）
7. 若 No / 用户有其他指令 → 按用户指令执行
```
