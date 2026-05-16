# Handoff — Wave 8.1 完成 + Wave 8.2a 部分完成（hit-test + Renderer 骨架），W8.2b 待续

> 生成时间: 2026-05-16 (Asia/Shanghai)
> 主动 handoff 原因：context 70%，命中上下文铁律阈值，W8.2 拆分为 a/b 两步、a 已落地。
> 续跑请新建会话，第一动作读本文件。

---

## 1. User Requests (As-Is)

- 历史指令仍生效：roguelike 重构、不再用行为树、token 接近上限直接 handoff、MVP 阶段不写详细单测
- 本会话新增指令：
  - **"技术细节不要问我，我只关心产品最终结果，对结果没有影响你自己决定就行"** —— 所有实现层决策（变量名、文件组织、是否拆类、内部 API 风格）由 AI 自决，不再问用户；只在产品体验/架构边界变更时才询问。
  - Wave 8 优先方向：**Gold 双账本修复（W8.1）** 已完成，按产品价值排序自主推进 W8.2 → W8.3 → W8.4。

## 2. Final Goal

在 `rougelike-v34` 分支完成 v3.4 MVP 重写，交付可演示的 L1 单关闭环。
**Wave 8 = 把 MVP 从"能跑通"推到"能演示"，按产品价值顺序：**
1. ✅ W8.1 Gold 双账本修复（HUD 显示金币）
2. 🟡 W8.2 Pixi 事件链真实绑定（玩家能用鼠标玩，当前部分完成）
3. ⏳ W8.3 内容扩展（5 种敌人 UnitConfig 在 enemies.yaml 中补齐）
4. ⏳ W8.4 pathGraph 多节点路径（敌人走曲线，纯视觉提升）

---

## 3. Wave 进度

### Done（本会话完成）

| 子 wave | commit | 内容 |
|---|---|---|
| **W8.1** | `d363b8e` | Gold 双账本修复：drop_gold + onWaveComplete 改调 runManager.addGold（统一金币权威）；移除 main.ts 中孤立的 EconomySystem 实例；新增 Wave 8.A 回归测试 3 cases |
| **W8.2a** | `e348e6b` | Pixi 事件链基础设施层：4 个 panel 增加 layout + hit-test 纯函数，`__triggerForTest` → `trigger` 公开 API，新增 `src/render/PanelRenderers.ts`（3 个 Renderer 类，含 pointerdown 绑定），10 个 hit-test 集成测试。**但 main.ts 还未实例化任何 Renderer，玩家鼠标仍无效。** |

### Verification State（当前 HEAD）

- HEAD `e348e6b`，分支 `rougelike-v34`，**ahead origin 17 commits**（全部未 push）
- 工作树 clean
- `npm run typecheck` ✅
- `npm test` ✅ **300 passed | 0 skipped**（baseline 287 → +13：W8.1 +3、W8.2a +10）
- `npm run build` ✅ 1.14s

---

## 4. Active Working Context

### Branch & HEAD

- 分支 `rougelike-v34`，HEAD `e348e6b`，ahead origin 17，均未 push
- 旧分支 `rougelike` 冻结（v3.3 归档，禁动）

### W8.1 落地产物

**`src/main.ts`** 关键改动:
- 顶部新增常量 `const WAVE_COMPLETE_GOLD = 20`
- 移除 `import { EconomySystem } from './systems/EconomySystem.js'`
- 移除 `const economy = new EconomySystem({ waveCompleteGold: 20 })`
- **顺序调换**：先 `new RunManager(...)`、再 `game.ruleEngine.registerHandler('drop_gold', ...)` —— 因 handler 闭包引用 runManager
- drop_gold handler: `runManager.addGold(amount)` 替代 `economy.addGold(amount)`
- waveSystem.onWaveComplete: `runManager.addGold(WAVE_COMPLETE_GOLD)` 替代 `economy.grantWaveCompleteBonus()`

**`src/__tests__/run.integration.test.ts`** 新增 `describe('Wave 8.A — Gold 单账本回归 ...')` 3 cases:
- 单次击杀 → runManager.gold 增加
- 多次击杀累加
- wave 完成奖励通过 addGold

**EconomySystem 类未删除**，仍被 ShopPanel 商店逻辑、SP 计算和自己的单元测试使用，只是从 main.ts 主流程剥离。

**SP 双账本问题**未处理：当前无 `drop_sp` handler，现状无 bug，等扩展 SP 掉落时再统一（同样 drop_sp → runManager.grantSp）。

### W8.2a 落地产物

**`src/ui/MainMenu.ts`** 扩展:
- 新增 `MainMenuButtonRect` 接口（含 x/y/width/height）
- 新增 `MainMenuLayout` 接口（titleLabel + titleX/Y + buttons[]）
- 新增 `layoutMainMenu(state, vw, vh)` —— 中心对齐 5 个按钮，宽 320、高 56、间距 16、title 在按钮组上方 64px
- 新增 `hitTestMainMenu(layout, px, py): MainMenuAction | null` —— 命中 disabled 按钮返回 null
- 类方法 `__triggerForTest` → `trigger`

**`src/ui/InterLevelPanel.ts`** 扩展:
- 新增 `InterLevelLayout` 接口（提取自 layoutInterLevel 返回类型）
- 新增 `hitTestInterLevel(layout, px, py): string | null`（offerId）
- 类方法 `__triggerForTest` → `trigger`

**`src/ui/HandPanel.ts`** 扩展:
- 新增 `hitTestHandSlot(layout, px, py): number | null`（slot 编号）
- 类方法 `__triggerForTest` → `trigger`

**`src/ui/RunResultPanel.ts`** 重写:
- `RunResultLayout` 增加 `footer: RunResultFooterRect` 字段（label/x/y/width/height）
- `projectRunResult(state, viewportWidth=1920, viewportHeight=1080)` —— 默认参数兼容旧测试
- 新增 `hitTestRunResultFooter(layout, px, py): boolean`
- 类构造函数接受 viewport 参数，与其他 panel 对齐
- 类方法 `__triggerForTest` → `trigger`

**`src/render/PanelRenderers.ts`** 全新 (~270 行):
- 3 个 class: `MainMenuRenderer` / `InterLevelRenderer` / `RunResultRenderer`
- 共享配色常量（DIM_BG / BUTTON_ENABLED/DISABLED / TEXT_PRIMARY/DIM / TITLE_COLOR）
- 每个 Renderer:
  - constructor(config: { container, viewportWidth, viewportHeight }, panel, [initialState])
  - 持有自己 Container 内的子 Graphics + Text
  - `container.eventMode = 'static'` + `hitArea = { contains: () => true }` + `on('pointerdown', ...)`
  - pointerdown 内调 `container.toLocal(e.global)` → `hitTest...` → `panel.trigger(...)`
  - `refresh(state)` 同步状态 + panel.refresh + 重绘
  - 使用 Pixi 7+ Graphics 链式 API: `g.rect(x,y,w,h).fill({color, alpha}).stroke({width, color})`

**测试** 新增 10 cases，分布在 4 个 panel test 文件:
- `MainMenu.test.ts` +4: 居中布局、disabled 不命中、空白返回 null、savedRun 时 continue-run 命中
- `InterLevelPanel.test.ts` +3: 3 张卡命中、空白返回 null、间隙返回 null
- `HandPanel.test.ts` +2: slot 中心命中、外侧 null
- `RunResultPanel.test.ts` +1: footer 中心命中 true、四周边界外 false

### 关键决策（本会话新增）

- **D-W8.1-method-A**：drop_gold 改调 runManager.addGold（方向 A），EconomySystem 类保留供 ShopPanel/SP 兑换/单元测试使用，主流程剥离。理由：handoff §6 推荐方向 + RunManager 注释 §0 明确"金币是 Run 级权威"。
- **D-W8.2a-rename-trigger**：`__triggerForTest` → `trigger`。理由：Renderer 的 pointerdown 是真实使用路径，方法名不应再带 ForTest 暗示"仅测试用"。
- **D-W8.2a-renderer-pattern**：3 个 Renderer 聚合在单文件 `PanelRenderers.ts`，不每个 panel 一个文件。理由：3 个类结构高度相似（container + graphics + texts + onPointerDown + render），单文件便于一致维护。
- **D-W8.2a-hitTest-pure**：hit-test 函数完全纯（无 Pixi 依赖），放在 panel 类同文件，便于单测；Renderer 仅做"接事件 → 调 hit-test → 调 panel.trigger"的薄壳。理由：渲染层难 mock，逻辑层好测；分离让 100% 覆盖率回到逻辑层。
- **D-W8.2a-partial-commit**：W8.2 拆为 a/b 两步，a 只做基础设施不接 main.ts。理由：token 已 70%，必须可提交收尾再 handoff，避免脏工作树。

---

## 5. Explicit Constraints (Verbatim Only)

- 中文沟通
- 原子提交 + commit message 即任务描述（子 wave 一次一 commit）
- roguelike 重构铁律：本分支属于推翻重写，旧分支冻结
- MVP 阶段不写详细单测（用户指令，仍生效）
- 接近 token 上限直接 handoff，不走自动压缩
- AI 不再用行为树
- 跳过外部 Momus 评审，Sisyphus 自查代评
- **本会话新增**：技术细节不问用户，AI 自决；只在产品体验/架构边界变更时询问

---

## 6. Next Steps（W8.2b 是首选，因为补完 W8.2 整体目标才达成）

### W8.2b — Pixi 事件链接入 main.ts（剩余的产品价值兑现）

**目标**：让玩家用鼠标真正能玩，无需 console 调 `__td`。

**步骤**:
1. 在 `src/main.ts` `bootstrap()` 内创建 3 个 Renderer：
   ```ts
   import { MainMenuRenderer, InterLevelRenderer, RunResultRenderer } from './render/PanelRenderers.js';
   const mainMenuRenderer = new MainMenuRenderer(
     { container: mainMenuContainer, viewportWidth: VIEWPORT_WIDTH, viewportHeight: VIEWPORT_HEIGHT },
     mainMenu,
   );
   const interLevelRenderer = new InterLevelRenderer(
     { container: interLevelContainer, viewportWidth: VIEWPORT_WIDTH, viewportHeight: VIEWPORT_HEIGHT },
     interLevelPanel,
   );
   const runResultRenderer = new RunResultRenderer(
     { container: runResultContainer, viewportWidth: VIEWPORT_WIDTH, viewportHeight: VIEWPORT_HEIGHT },
     runResultPanel,
   );
   ```
2. **关键**：需要在 phase 切换时 `renderer.refresh(state)` 喂数据：
   - InterLevel 进入时调 `interLevelRenderer.refresh({ nextLevel: ..., offers: [...] })`
   - Result 进入时调 `runResultRenderer.refresh({ outcome, stats, sparkAwarded })`
   - MainMenu 一次性 refresh 即可（hasSavedRun 不会变）
3. **数据来源问题**：MVP 阶段 InterLevelState 的 3 个 offers 和 RunResultState 的 stats 还没"真实"数据源 —— 可暂时硬编码模板（offers = [shop/mystic/skilltree 三选一固定描述]，stats = 用 runManager.gold/crystalHp 简单填充）。
4. **HandPanel pointerdown 扩展**：HandPanel 已被 UIPresenter 渲染（slotGraphics + slotLabels），缺事件。两种方案选其一（自决）：
   - **方案 A**：在 UIPresenter 内绑 handContainer.eventMode='static' + pointerdown → 用 layoutHand 算命中 → 调 handPanel.trigger(slot, dropX, dropY)。简单。
   - **方案 B**：再起 `HandRenderer` 类与其他 3 个对齐。重复但一致。
   推荐 A（HandPanel 渲染已在 UIPresenter，事件就近绑）。
5. **保留 dev hook**：`globalThis.__td.{mainMenu, handPanel, interLevelPanel, runResultPanel, runController, waveSystem}` 不动，作为冒烟兜底。
6. **冒烟验证**：手工开浏览器（或写一个 debug 脚本 `debug/click-smoke.ts` 用 dev hook 模拟点击序列：start-run → 等 wave → 选 shop/skip → 等通关 → 看 RunResult → return menu）。

**预计 commit 数**: 1-2

### W8.3 — 内容扩展（产品价值次之）

**问题**：`loadUnitConfigsForLevel` 严格契约，缺任一 enemyId 就 throw。当前 `units/enemies.yaml` 是否真的有 grunt/runner/heavy/mage/exploder 5 种？

**步骤**:
1. `rtk cat src/config/units/enemies.yaml` 确认现有内容
2. 对照 `src/config/levels/level-01.yaml` 中 waves[].groups[].enemyId 看缺哪些
3. 补齐 4 种新敌人 UnitConfig（每种独特 stats + visual.color）
4. 没有专门设计文档要求时按 L1 档处理（直接动手）
5. 跑 `debug/perf-baseline.ts` 验性能仍 < 16.67ms

**预计 commit 数**: 1

### W8.4 — pathGraph 多节点路径

**问题**：level-01.yaml 的 path 只有 2 个节点（直线），玩家看到敌人走直线很无聊。

**步骤**:
1. 在 level-01.yaml 中加 4-6 个 path 节点形成 L 形或 S 形路径
2. 验证 MovementSystem 已支持多节点（理论上已支持，看 `src/systems/MovementSystem.ts`）
3. 浏览器冒烟

**预计 commit 数**: 1

---

## 7. Critical Gotchas（本会话新增 + 沿用前会话遗留）

### 本会话新增

- **EconomySystem 类未删**：W8.1 只从 main.ts 主流程剥离，类本身仍存（ShopPanel/SP 计算依赖）。如果 W8.3+ 看到 EconomySystem 时考虑是否要清理，先 grep `EconomySystem`、`economy\.` 看依赖再决策。
- **SP 双账本仍存在**：EconomySystem.sp 与 RunManager.sp 分离，但当前无 drop_sp handler 触发 → 无 bug。将来扩展 SP 掉落时统一到 runManager.grantSp。
- **`__triggerForTest` 已全网重命名为 `trigger`**：搜索代码若发现 `__triggerForTest` 是历史 git 记录或 stash。
- **`projectRunResult` 签名变了**：从 `(state)` 变为 `(state, vw=1920, vh=1080)`。旧测试用单参数依赖默认值，OK。新代码请传完整 viewport。
- **`RunResultPanel` 构造函数签名变了**：现在接受 `{ viewportWidth, viewportHeight }` 可选参数。
- **`PanelRenderers.ts` 还未被 main.ts 使用**：3 个 Renderer 类已就绪但没实例化。W8.2b 首要任务就是接入。
- **Pixi 7+ Graphics API**：用 `g.rect(x,y,w,h).fill({color, alpha}).stroke({width, color})` 链式，**不是** `g.beginFill / drawRect / endFill`（Pixi 5/6 API）。PanelRenderers.ts 已用新 API。
- **`hitArea = { contains: () => true }` 是简化 hitArea**：让 container 整个区域都可接收点击。如果将来需要更精细的命中（如圆形按钮），改成 Pixi 内置 `new Rectangle(...)` 等。
- **`container.toLocal(e.global)`**：把全局坐标转 container 本地坐标，因为 UI layer 可能被父容器变换过（虽然 Renderer 配置里的 viewportWidth/Height 是设计坐标，目前没有缩放，但 toLocal 保险）。

### 沿用前会话遗留（仍然有效）

- **WaveSystem.start() 在 startRun 回调内调**
- **energySystem.tick(dt) 仅在 Battle 且 phase ∈ {battle, wave-break} 时触发**
- **`attachRules` 覆盖替换不追加**
- **`loadUnitConfigsForLevel` 强契约**：缺任一 enemyId 就 throw（W8.3 待修）
- **Vite ?raw 导入**：需要 `src/vite-env.d.ts` 的 declare module
- **waveSystem 前向引用**：`let runController!: RunController` 解循环依赖
- **LevelWave 字段单位是秒**，WaveSystem 是毫秒
- **`runController.phase` 对比字符串字面量** 是 TS 合法（RunPhase 是 const enum string）

---

## 8. Delegated Agent Sessions

无活跃 agent。

---

## 9. 续跑会话第一动作

```
1. Read .memory/handoffs/_latest.md（本文件）
2. rtk git log --oneline -5（确认 HEAD = e348e6b）
3. rtk git status（确认工作树 clean）
4. rtk npm test -- --run | tail -5（确认 300 passed）
5. 按 W8.2b 步骤开干：
   a) 编辑 src/main.ts 实例化 3 个 Renderer
   b) 在适当位置 refresh 数据（注意 InterLevel/Result 进入时要喂 state）
   c) UIPresenter 加 HandPanel pointerdown（方案 A）
   d) 跑 typecheck + test + build
   e) 提交 W8.2b commit
6. W8.2b 后按产品价值序：W8.3（内容） → W8.4（路径）
7. token ≥ 70% 立即再 handoff（沿用上下文铁律）
```
