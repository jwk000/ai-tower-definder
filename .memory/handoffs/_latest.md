# Handoff — W8.2 完成（含 W8.2b），W8.3 验证已落地，W8.4 待开干

> 生成时间: 2026-05-16 (Asia/Shanghai)
> 主动 handoff 原因：context 72%，命中上下文铁律阈值。
> 续跑请新建会话，第一动作读本文件。

---

## 1. User Requests (As-Is)

- 历史指令仍生效：roguelike 重构、不再用行为树、token 接近上限直接 handoff、MVP 阶段不写详细单测
- 上一会话指令仍生效："技术细节不要问我，我只关心产品最终结果，对结果没有影响你自己决定就行"
- 上一会话指令仍生效：Wave 8 按产品价值顺序自主推进 → W8.1 → W8.2 → W8.3 → W8.4
- 本会话指令：续跑 `.memory/handoffs/_latest.md`，按 W8.2b 步骤接入 main.ts

## 2. Final Goal

`rougelike-v34` 分支完成 v3.4 MVP 重写。
**Wave 8 = 把 MVP 从"能跑通"推到"能演示"**:
1. ✅ W8.1 Gold 双账本修复（d363b8e）
2. ✅ W8.2a Pixi 事件链基础设施（e348e6b）
3. ✅ **W8.2b Pixi 事件链接入 main.ts（ee1484b，本会话）**
4. ✅ **W8.3 内容扩展：5 种敌人已在 enemies.yaml 中存在，无需新增（本会话验证）**
5. ⏳ **W8.4 pathGraph 多节点路径（下个会话首要任务）**

---

## 3. Wave 进度

### Done（本会话完成）

| 子 wave | commit | 内容 |
|---|---|---|
| **W8.2b** | `ee1484b` | main.ts 实例化 3 个 PanelRenderer + prevPhase 转换观察器 + runStats 跟踪击杀/金币/时长 + buildInterLevelOffers MVP 模板 + buildRunResultState 真实数据组装；UIPresenter 接收 handPanel 参数，battleContainer 绑 pointerdown/pointerup → hitTestHandSlot → handPanel.trigger 完成出牌闭环 |
| **W8.3 验证** | — | 验证 enemies.yaml 已含 grunt/runner/heavy/mage/exploder 5 种敌人（每种独特 stats + visual.color），level-01.yaml 8 波仅引用这 5 种，content.integration.test.ts 2 cases 通过，loadUnitConfigsForLevel 不 throw。**无代码变更，W8.3 已被前置阶段实现，跳过。** |

### Verification State（当前 HEAD）

- HEAD `ee1484b`，分支 `rougelike-v34`，**ahead origin 4 commits**（全部未 push）
- 工作树 clean
- `npm run typecheck` ✅
- `npm test` ✅ **300 passed | 0 skipped**（无新增测试，本次纯接线 + 验证）
- `npm run build` ✅ 1.12s
- `npm run check:doc` ✅（ECS 组件/系统/RuleHandler 与 architecture.md 一致）

---

## 4. Active Working Context

### Branch & HEAD

- 分支 `rougelike-v34`，HEAD `ee1484b`，ahead origin 4，均未 push
- 旧分支 `rougelike` 冻结（v3.3 归档，禁动）

### W8.2b 落地产物

**`src/main.ts`** 关键改动（+108 行）:

1. 顶部 import 新增：
   ```ts
   import { MainMenuRenderer, InterLevelRenderer, RunResultRenderer } from './render/PanelRenderers.js';
   import { InterLevelPanel, type InterLevelIntent, type InterLevelOffer } from './ui/InterLevelPanel.js';
   import { RunResultPanel, type RunResultState } from './ui/RunResultPanel.js';
   ```

2. drop_gold handler 同时统计击杀：
   ```ts
   const runStats = { enemiesKilled: 0, goldEarned: 0, runStartMs: 0, runEndMs: 0 };
   game.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
     const amount = typeof params?.amount === 'number' ? params.amount : 0;
     if (amount > 0) { runManager.addGold(amount); runStats.goldEarned += amount; }
     runStats.enemiesKilled += 1;
   });
   ```
   ⚠️ 即便 `amount=0` 也计数击杀（注释中已说明，因 drop_gold = 死亡触发点）。

3. handPanel 提前到 UIPresenter 之前实例化，并作为参数传入：
   ```ts
   const handPanel = new HandPanel({ viewportWidth, viewportHeight });
   const presenter = new UIPresenter({ battleContainer, ..., handPanel });
   handPanel.setHandler(...);  // 这一段仍在原位置（presenter 之后）
   ```
   handPanel 在 setHandler 前就传给 presenter 是 OK 的——pointerup 走的是 handPanel.trigger → resolveDropIntent → handler，handler 在 ticker 启动前就已设置。

4. MainMenu.setHandler 内 startRun 后初始化 runStats：
   ```ts
   runStats.enemiesKilled = 0; runStats.goldEarned = 0;
   runStats.runStartMs = performance.now(); runStats.runEndMs = 0;
   ```

5. 3 个 Renderer 实例化后置（在所有 panel handler 设置之后，devHooks 注册之前），Pixi 容器作为构造参数：
   ```ts
   const mainMenuRenderer = new MainMenuRenderer({ container: mainMenuContainer, viewportWidth, viewportHeight }, mainMenu, { hasSavedRun: false });
   const interLevelRenderer = new InterLevelRenderer({ container: interLevelContainer, ... }, interLevelPanel);
   const runResultRenderer = new RunResultRenderer({ container: runResultContainer, ... }, runResultPanel);
   ```
   MainMenuRenderer 构造函数内调 render() 立即绘制初始主菜单（看 PanelRenderers.ts 行 70）。

6. devHooks 扩展：`__td` 现在多了 mainMenuRenderer / interLevelRenderer / runResultRenderer。

7. buildInterLevelOffers() 硬编码模板（MVP 占位，注释已说明）:
   ```ts
   [{ id: 'shop-offer', kind: 'shop', title: '商店', description: '...' },
    { id: 'mystic-offer', kind: 'mystic', title: '神秘事件', description: '...' },
    { id: 'skilltree-offer', kind: 'skilltree', title: '跳过', description: '...' }]
   ```
   注意 kind='skilltree' 会被 main.ts 的 InterLevelPanel handler 翻成 'skip'（看 line 231）。这是兼容当前 RunManager 只接受 shop/mystic/skip 的 hack。

8. buildRunResultState() 从 runManager + runStats 组装：outcome 取自 runManager.outcome，elapsedSeconds 用 runStartMs/runEndMs 差，sparkAwarded 胜+10 / 败+0（占位），totalLevels=1（MVP），levelsCleared 胜=currentLevel / 败=max(0, currentLevel-1)。

9. ticker 内新增 prevPhase 观察：
   ```ts
   let prevPhase: typeof runController.phase = runController.phase;
   // 每帧：
   const phase = runController.phase;
   if (phase !== prevPhase) {
     if (phase === 'InterLevel') interLevelRenderer.refresh({ nextLevel: runManager.currentLevel + 1, offers: buildInterLevelOffers() });
     else if (phase === 'Result') { if (runStats.runEndMs === 0) runStats.runEndMs = now; runResultRenderer.refresh(buildRunResultState()); }
     else if (phase === 'Idle') mainMenuRenderer.refresh({ hasSavedRun: false });
     prevPhase = phase;
   }
   ```

**`src/ui/UIPresenter.ts`** 改动（+39 行）:

1. import 增加 `FederatedPointerEvent`、`HandPanel`、`hitTestHandSlot`
2. `UIPresenterConfig` 增加可选 `handPanel?: HandPanel`
3. 类内新增 `handPanel`、`lastHandState`、`dragSlot` 字段
4. 构造函数末尾 `if (this.handPanel) this.bindHandEvents();`
5. bindHandEvents() 内：
   ```ts
   this.battleContainer.eventMode = 'static';
   this.battleContainer.hitArea = { contains: () => true };
   this.battleContainer.on('pointerdown', ...);
   this.battleContainer.on('pointerup', ...);
   this.battleContainer.on('pointerupoutside', () => { this.dragSlot = null; });
   ```
6. onPointerDown: 用 lastHandState 算 layout → hitTestHandSlot 设 dragSlot
7. onPointerUp: 若 dragSlot != null → handPanel.trigger(dragSlot, local.x, local.y) → 清空
8. present() 顶部新增 `this.lastHandState = frame.hand;` 缓存最新 hand 状态供事件命中

### 关键决策（本会话新增）

- **D-W8.2b-drag-pattern**: 拖拽采用 pointerdown 锁 slot + pointerup 落点的"点按-拖动-释放"模式（非"两次点击"）。理由：契合 HandPanel.resolveDropIntent 已设计的 dropX/dropY 接口，单次手势完成；pointerupoutside 兜底防止 drag 卡住。
- **D-W8.2b-events-on-battle**: 事件绑在 battleContainer 而非 handContainer。理由：用户从手牌拖到战场，需要在战场区域接收 pointerup；若绑 handContainer 则离开手牌区就丢事件。battleContainer 是 hand+hud 的父容器，事件冒泡自然到位。
- **D-W8.2b-stats-non-authoritative**: runStats 仅用于 RunResult 展示，不参与玩法权威。golden source 仍是 runManager.gold。在 drop_gold handler 内同步累加 runStats.goldEarned 是冗余但安全的（runManager.gold 可能被 ShopPanel 减少，runStats.goldEarned 永远只增）。
- **D-W8.2b-offers-hardcoded**: InterLevel offers 用固定模板而非随机/动态生成。理由：MVP 阶段无 InterLevelService，handoff §6 步骤 3 明示可硬编码；未来真实化时只需替换 buildInterLevelOffers() 实现。
- **D-W8.3-skip**: W8.3 跳过。原 handoff 推测 enemies.yaml 缺敌人，实际所有 5 种 (grunt/runner/heavy/mage/exploder) 都齐全（每种独特 stats + visual.color），content.integration.test 一直 passing。可能在前置 wave 已补完，handoff 信息陈旧。

---

## 5. Explicit Constraints (Verbatim Only)

- 中文沟通
- 原子提交 + commit message 即任务描述
- roguelike 重构铁律：本分支属于推翻重写，旧分支冻结
- MVP 阶段不写详细单测
- 接近 token 上限直接 handoff
- AI 不再用行为树
- 跳过外部 Momus 评审，Sisyphus 自查代评
- 技术细节不问用户，AI 自决；只在产品体验/架构边界变更时询问

---

## 6. Next Steps（W8.4 是首选）

### W8.4 — pathGraph 多节点路径（剩余的产品价值兑现）

**目标**：敌人走 L 形或 S 形路径而非直线，增强视觉趣味。

**关键文件**：
- `src/config/levels/level-01.yaml` —— 改 `map.tiles`、`map.pathGraph.nodes`、`map.pathGraph.edges`
- `src/systems/MovementSystem.ts` —— 已支持多节点（看 line 22-78），无需改

**当前 level-01.yaml 状态**：
- `pathGraph` 只有 2 个 node：n0(row=4, col=0, spawn)、n1(row=4, col=20, crystal_anchor)，1 条 edge n0→n1
- `map.tiles` row 4 全是 'path'，其余 row 全是 'empty'

**W8.4 实施步骤**:

1. 选定一个 L 形或 S 形路径，例如 S 形：
   ```
   起点 (row=4, col=0) → 东到 (row=4, col=6) → 南到 (row=7, col=6) → 东到 (row=7, col=14) → 北到 (row=2, col=14) → 东到 (row=2, col=20)
   ```
   但 crystal anchor 当前在 (row=4, col=20)，改路径需同步移动 anchor。或者保持 anchor 不动，路径回到 row=4 收尾。

2. 改 `map.tiles`：
   - row 4 改回部分 'empty'，只 col 0-6 是 path
   - 新增 path 列覆盖弯道
   - 调整 obstacles 避免与新 path 重叠（当前 obstacles 在 row 1/2/6/7 散布，会跟新路径冲突，要么删要么挪）

3. 改 `map.pathGraph`：
   ```yaml
   pathGraph:
     nodes:
       - { id: n0, row: 4, col: 0, role: spawn, spawnId: spawn_0 }
       - { id: n1, row: 4, col: 6 }
       - { id: n2, row: 7, col: 6 }
       - { id: n3, row: 7, col: 14 }
       - { id: n4, row: 2, col: 14 }
       - { id: n5, row: 2, col: 20 }   # 或保持 row=4 接 anchor
       - { id: n6, row: 4, col: 20, role: crystal_anchor }
     edges:
       - { from: n0, to: n1 }
       - { from: n1, to: n2 }
       - { from: n2, to: n3 }
       - { from: n3, to: n4 }
       - { from: n4, to: n5 }
       - { from: n5, to: n6 }
   ```

4. 验证 loader 的 `orderPath` 算法能正确 DFS 多节点（看 src/config/loader.ts 行 318，`orderPath(edges, spawnId, anchorId, nodesById)`）。

5. 跑 `npm run typecheck` + `npm test` —— 注意 `src/__tests__/yaml.fixtures.test.ts` 可能锁了路径节点数，要看一眼。

6. 浏览器冒烟（手动）—— 看敌人是否真的走曲线。

**预计 commit 数**: 1

**潜在坑**：
- obstacles 与 path 重叠会被 Renderer/Game 视作非法布塔位置（看 LevelState/Renderer 是否校验）
- 渲染层 Renderer.ts 用什么数据画 path tiles？若它直接读 map.tiles，多节点没问题；若它读 pathGraph 自己插值，可能需要看一眼
- yaml.fixtures.test.ts 可能预期 path.length=2，要么扩它要么改

### W8.5+ 后续探索（可选）

- 真实 InterLevelService 生成 offers（替换 buildInterLevelOffers 硬编码）
- 真实 sparkAwarded 计算（基于 levelsCleared/enemiesKilled）
- HandPanel 拖拽视觉反馈（拖动时 ghost card 跟手）
- 测试覆盖：W8.2b 的 main.ts 接线整体走集成测试更划算（造 mini canvas + 模拟 pointerdown/up 完整闭环），但 Pixi 难 mock，MVP 阶段先跳过

---

## 7. Critical Gotchas（本会话新增 + 沿用前会话遗留）

### 本会话新增

- **runStats 是非权威只追加缓存**：goldEarned 与 runManager.gold 是两套东西。前者只增（累计金币收入），后者会被 ShopPanel 扣减。RunResult 上展示的 goldEarned 是"赚到多少"，不是"剩多少"。crystalHpRemaining 才是看 runManager 实时值。
- **drop_gold 计数 amount=0 的死亡**：未来若引入"死亡不掉金"的敌人，enemiesKilled 仍会计数（OK），但若不希望计数，要在 handler 里加 `if (amount > 0) enemiesKilled += 1`。当前所有 enemies.yaml 的 drop_gold 都有正 amount，无影响。
- **MainMenuRenderer 构造内立即调 render()**：所以引擎一启动就能看到主菜单。InterLevelRenderer / RunResultRenderer 构造不调 render（无 state），等 phase 转换 refresh 后才绘制。
- **devHooks 仍可用作冒烟**：手动开浏览器后 `__td.runController.startRun()`、`__td.mainMenu.trigger('start-run')` 等都还能用。
- **pointerupoutside 兜底**：用户在 hand zone 按下，拖出 canvas 外释放，会触发 pointerupoutside（不是 pointerup），需清空 dragSlot 防止下次点击异常触发出牌。已处理。
- **lastHandState 初始 = {cards:[], energy:0}**：游戏未进 Battle 前 dragSlot 永远 null，安全。

### 沿用前会话遗留（仍有效）

- EconomySystem 类未删（ShopPanel/SP 兑换/单元测试仍依赖）
- SP 双账本未统一（无 drop_sp handler 触发，现状无 bug）
- WaveSystem.start() 在 startRun 回调内调
- energySystem.tick(dt) 仅 Battle + phase ∈ {battle, wave-break} 触发
- attachRules 覆盖替换不追加
- loadUnitConfigsForLevel 强契约
- Vite ?raw 导入需要 src/vite-env.d.ts declare module
- waveSystem 前向引用：`let runController!: RunController` 解循环依赖
- LevelWave 字段单位是秒，WaveSystem 内部是毫秒
- runController.phase 对比字符串字面量是 TS 合法（RunPhase const enum string）
- Pixi 7+ Graphics 链式 API: `g.rect(x,y,w,h).fill({color, alpha}).stroke({width, color})`
- `__triggerForTest` 已全网重命名为 `trigger`
- `projectRunResult(state, vw=1920, vh=1080)` 默认参数兼容旧测试
- `RunResultPanel` 构造函数接受 `{ viewportWidth, viewportHeight }`

---

## 8. Delegated Agent Sessions

无活跃 agent。

---

## 9. 续跑会话第一动作

```
1. Read .memory/handoffs/_latest.md（本文件）
2. rtk git log --oneline -5（确认 HEAD = ee1484b）
3. rtk git status（确认工作树 clean）
4. rtk npm test -- --run | tail -5（确认 300 passed）
5. 按 W8.4 步骤开干：
   a) 决定 S 形/L 形路径形状（自决）
   b) 编辑 src/config/levels/level-01.yaml: tiles + pathGraph nodes/edges
   c) 检查 src/__tests__/yaml.fixtures.test.ts 是否锁了 2 节点
   d) 跑 typecheck + test + build
   e) 浏览器冒烟（可选，肉眼看敌人走曲线）
   f) 提交 W8.4 commit
6. W8.4 后无剩余 Wave 8 任务；可考虑 W8.5+ 探索或推进 Wave 9
7. token ≥ 70% 立即再 handoff
```
