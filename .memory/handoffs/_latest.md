# Handoff — MVP 验收补齐进行中：状态机已扩，3 子面板待 wire

> 生成时间: 2026-05-16 (Asia/Shanghai)
> 主动 handoff 原因：context 70.0%，命中上下文铁律阈值（≥70%）。
> 续跑请新建会话，第一动作读本文件。

---

## 1. User Requests (As-Is)

- 历史指令仍生效：roguelike 重构、不再用行为树、token 接近上限直接 handoff、MVP 阶段不写详细单测
- 上一会话指令仍生效："技术细节不要问我，我只关心产品最终结果，对结果没有影响你自己决定就行"
- **本会话新指令**："注意：如果mvp版本完成了要提醒我可以验收了"
- **本会话用户决策**：选「补齐 Shop/Mystic/SkillTree 三面板」，目标让 MVP 验收清单 6/7/8/9 条达成

## 2. Final Goal

把 MVP 验收清单 13 条全部打绿，让用户能"开始验收"。

### MVP 验收清单逐条复检（截至 HEAD = 8f2f975）

| # | 验收项 | 状态 | 备注 |
|---|---|---|---|
| 1 | `npm run typecheck && npm test && npm run build` 全绿 | ✅ | 308 tests passed |
| 2 | 冒烟测试覆盖菜单→Run→L1→通关→3 选 1→结算→菜单 | ⚠️ 部分 | run.integration.test.ts 有 'MVP run flow smoke' 但只覆盖 skip 分支；shop/mystic/skilltree 分支仍走"假兜底" |
| 3 | 浏览器闭环可玩（菜单→Run→L1→通关→3 选 1→结算） | ⚠️ 假 3 选 1 | shop/mystic/skilltree 三按钮存在但点了相当于跳过 |
| 4 | 6 类单位各 1 个可用（塔/士兵/陷阱/法术/生产/水晶） | ❓ 未逐一验证 | 配置 YAML 都在，但实际可玩性未抽测 |
| 5 | 能量上限 10 自动恢复 | ❓ 未抽测 | EnergySystem.test.ts 13 测试通过，但 main.ts wire 是否正确未手动验证 |
| 6 | **商店：可买 1 单位卡 + 用金币换 SP** | ❌ | ShopPanel.ts 纯函数模块完整 + 7 测试，但**无 Pixi renderer、main.ts 无 wire** |
| 7 | **秘境：可选 1 事件 + 零成本退出** | ❌ | MysticPanel.ts 纯函数模块完整 + 4 测试，同上 |
| 8 | **跳过：零代价进入下一阶段** | ✅ | InterLevelPanel "跳过/skilltree" 路径走通 |
| 9 | **技能树：箭塔「连射」2 节点可解锁 + 效果生效** | ❌ | SkillTreePanel.ts 纯函数模块完整 + 6 测试，同上 |
| 10 | Run 结算面板展示战绩 | ✅ | RunResultPanel 接入 + RunResultRenderer 渲染 |
| 11 | MVP-SIMPLIFICATION 代码注释 | ❌ | 全代码 0 处该注释（设计稿要求标记简化点供回溯） |
| 12 | 性能基线（50 实体 FPS ≥ 60） | ⚠️ | Wave 7 script 跑过 avg 0.010ms，但无回归 perf.budget.test.ts |
| 13 | 2026-05-16 dev-log | ❌ | 未写 |

**MVP 完成度 ≈ 7/13**。核心缺口：**6/7/9 三面板 wire** + 2/3 冒烟 + 11 注释 + 13 dev-log。

## 3. 本会话完成进度

| commit | 内容 |
|---|---|
| `af7bc6c` | feat(level): L1 可用塔卡扩展到 6 种（arrow/cannon/ice/lightning/laser/bat）[P1-content] |
| `8f2f975` | refactor(run): RunManager 扩展 Shop/Mystic/SkillTree 三子相位 [MVP-acceptance] |

### Verification State（当前 HEAD = 8f2f975）

- 分支 `rougelike-v34`，**ahead origin 10 commits**（全部未 push）
- 工作树 clean（除 _latest.md 即将写）
- `npm run typecheck` ✅
- `npm test` ✅ **308 passed**（+8 from RunManager 新增）
- `npm run build` ✅
- `npm run check:doc` ✅

---

## 4. Active Working Context

### Branch & HEAD

- 分支 `rougelike-v34`，HEAD `8f2f975`，ahead origin 10，均未 push
- 旧分支 `rougelike` 冻结（v3.3 归档，禁动）

### 已建立的状态机扩展（8f2f975）

**RunPhase 从 4 相位扩展为 7 相位**：
```
Idle → Battle ⇄ InterLevel → {Shop|Mystic|SkillTree} → Battle (level++)
                ↘ Result
```

**新 API**：
- `RunPhase.Shop / .Mystic / .SkillTree`
- `InterLevelChoice = 'shop' | 'mystic' | 'skilltree'`（原 'skip' 已废）
- `RunManager.closeShop() / closeMystic() / closeSkillTree()` → Battle, level++
- `RunController.closeShop() / closeMystic() / closeSkillTree()`
- `RunSceneContainers.shop / mystic / skillTree` 字段

**main.ts 当前临时兼底（line 230-238）**：
```typescript
interLevelPanel.setHandler((intent) => {
  if (intent.kind !== 'enter-node') return;
  runController.pickInterLevel(intent.node);
  // TODO[panel-wire]: 接入真面板后删除以下三行
  if (intent.node === 'shop') runController.closeShop();
  else if (intent.node === 'mystic') runController.closeMystic();
  else if (intent.node === 'skilltree') runController.closeSkillTree();
});
```
**下一会话第一件事**：接入 Shop/Mystic/SkillTree 真面板后，删掉这 3 行兜底，让子面板自己的"退出"按钮调 closeXxx。

### 下一步任务清单（按依赖顺序）

> 每个任务一个 atomic commit。预计 5-7 commits 把 MVP 验收剩下 6 条全部打绿。

1. **ShopPanel class 包装**（`src/ui/ShopPanel.ts`）
   - 当前是纯函数模块（attemptPurchase/applyPurchase）+ 7 测试
   - 加 `ShopPanel` class 同构于 `InterLevelPanel`：`setHandler / refresh(state) / triggerPurchase(itemId) / triggerClose()`
   - MVP 简化：2 槽 = `unit-card`（grunt_card 30G + 抽 1 张）+ `sp-exchange`（50G→1SP）
   - 测试照旧通过，新加 1-2 class 行为测试

2. **MysticPanel class 包装**（`src/ui/MysticPanel.ts`）
   - 当前纯函数 + 4 测试
   - 加 class：`setHandler / refresh(state) / triggerEvent(eventId) / triggerExit()`
   - MVP 简化：1 事件「获得 10 金币」+ 零成本退出

3. **SkillTreePanel class 包装**（`src/ui/SkillTreePanel.ts`）
   - 当前纯函数 + 6 测试
   - 加 class：`setHandler / refresh(state) / triggerUnlock(nodeId) / triggerExit()`
   - MVP 简化：箭塔「连射」路径 2 节点（rapid_fire_1 → rapid_fire_2），各消耗 3 SP
   - 解锁后由 RuleHandler 写入 RunManager.skillTreeState（需要新增）
   - 战斗中效果生效：让 AttackSystem 读 skillTreeState，命中 rapid_fire 时 attackCooldown × 0.8

4. **PanelRenderers.ts 新增 3 个 Pixi 渲染器**
   - `ShopRenderer` / `MysticRenderer` / `SkillTreeRenderer`
   - 同构于现有 `InterLevelRenderer`（PanelRenderers.ts:118）
   - 每个 ~80-100 行 PixiJS 程序化几何（按钮+文字+卡片背景）

5. **main.ts wire 3 panel + 3 renderer**（删掉 line 234-238 兜底）
   - 新增 3 个 panel 实例 + setHandler 回调（点购买 → runController.closeShop()）
   - 新增 3 个 renderer 实例 + uiLayer.addChild
   - 让 interLevelPanel.setHandler 不再调 closeXxx——交给子面板按钮

6. **集成测试**: `run.integration.test.ts` 加 3 个 smoke case：
   - 选 shop → 进 Shop 相位 → 买东西 → close → Battle (gold 减、可选 sp 增)
   - 选 mystic → 进 Mystic → 选事件 → close → Battle (gold 增 10)
   - 选 skilltree → 进 SkillTree → 解锁 rapid_fire_1 → close → Battle (sp 减 3)

7. **dev-log + 提醒用户验收**
   - 写 `design/dev-logs/2026-05-16.md`
   - **明确告知用户：MVP 验收清单全打绿，可以验收**
   - 浏览器闭环手动验证一次（启动 dev server，肉眼跑通菜单→Run→L1→通关→shop→Battle→……）

### 注意事项 / Gotchas

- **InterLevelPanel.ts 已有 3 个 offer kind: shop/mystic/skilltree**，前端不需改。后端 (RunManager) 也已支持 'skilltree' 作 InterLevelChoice。
- ShopPanel 当前 `ShopItemKind = 'unit-card' | 'sp-exchange'`，已与 50-mda v3.4 §13 一致。
- `RunManager.skillTreeState` 字段**不存在**——SkillTree 第 3 步需要先加这个字段。设计参考 [22-skill-tree-overview §10](../../design/20-units/22-skill-tree-overview.md)。MVP 简化可以只存 `Set<string>` 已解锁节点 id。
- SP 当前由 `RunManager.grantSp / spendSp` 管理。SkillTreePanel 解锁节点 → `spendSp(3)` → 写 skillTreeState。
- 删除 main.ts line 234-238 兜底之后，**所有 interLevelPanel 三选一不再立即回 Battle**，必须确保 3 个子面板都有"退出/购买/选择"按钮触发 closeXxx，否则会卡死。
- 跑 typecheck 不要忘了 RunSceneContainers 新增 3 字段，所有创建 scenes 的地方都得带上（已修 3 处：run.integration.test.ts 2 处 + main.ts 1 处）。
- L3 任务铁律：核心引擎变更必须 TDD。本会话已对 RunManager 走过 TDD 红绿。下一会话改 SkillTree 涉及 RuleHandler + AttackSystem 时也要 TDD。

---

## 5. Explicit Constraints (Verbatim Only)

- 中文沟通
- 原子提交 + commit message 即任务描述
- roguelike 重构铁律：本分支属于推翻重写，旧分支冻结
- MVP 阶段不写详细单测（但 L3 引擎变更仍要 TDD）
- 接近 token 上限直接 handoff
- AI 不再用行为树
- 跳过外部 Momus 评审，Sisyphus 自查代评
- 技术细节不问用户，AI 自决；只在产品体验/架构边界变更时询问
- **MVP 完成时主动提醒用户可以验收**

---

## 6. 关键技术决策（本会话新增）

- **D-MVP-1: RunPhase 扩展为 7 相位**。原计划"InterLevel → pickInterLevelChoice → Battle"直接 advance level。改为"InterLevel → pick → 子相位 → close → Battle (advance level)"两步走，给 Shop/Mystic/SkillTree 子面板留出独立相位。代价：现有 1 个 pickInterLevelChoice 测试改写 + 新增 6 个 close 转移测试。
- **D-MVP-2: InterLevelChoice 'skip' 字面值废除**。改为 shop/mystic/skilltree 三选一。"零代价退出"语义下放到各子面板的"退出"按钮（即 closeXxx 调用）。这样 MVP 验收第 8 条「跳过零代价」由"skilltree 子面板的退出按钮"承载——本意一致，状态机更清晰。
- **D-MVP-3: main.ts 临时兼底**。8f2f975 在 InterLevel handler 内"立即 closeXxx"，让本 commit 自包含（不破坏现有 happy path）。**这是债务**，下一会话第一件事是接入真面板后删除。

---

## 7. 沿用前会话遗留 Gotchas（仍有效）

- runStats 是非权威只追加缓存：goldEarned 与 runManager.gold 是两套
- drop_gold 计数 amount=0 的死亡
- MainMenuRenderer 构造内立即调 render()，InterLevelRenderer/RunResultRenderer 构造不调
- pointerupoutside 已处理（clearDrag），防止 drag 卡住
- EconomySystem 类未删（ShopPanel/SP 兑换/单元测试仍依赖）
- SP 双账本未统一（无 drop_sp handler 触发）
- WaveSystem.start() 在 startRun 回调内调
- energySystem.tick(dt) 仅 Battle + phase ∈ {battle, wave-break} 触发
- Vite ?raw 导入需要 src/vite-env.d.ts declare module
- waveSystem 前向引用：`let runController!: RunController` 解循环依赖
- LevelWave 字段单位是秒，WaveSystem 内部是毫秒
- Pixi 7+ Graphics 链式 API: `g.rect(x,y,w,h).fill({color, alpha}).stroke({width, color})`
- `projectRunResult(state, vw=1920, vh=1080)` 默认参数兼容旧测试
- loader 用 `.passthrough()` 静默丢弃 v3.3 残留字段

---

## 8. Delegated Agent Sessions

无活跃 agent。

---

## 9. 续跑会话第一动作

```
1. Read .memory/handoffs/_latest.md（本文件）
2. git log --oneline -5（确认 HEAD = 8f2f975）
3. git status（确认工作树 clean）
4. 按"§4 下一步任务清单"顺序推进，每步原子提交：
   step 1: ShopPanel class 包装 + onPurchase/onClose 回调
   step 2: MysticPanel class 包装 + onEvent/onExit 回调
   step 3: SkillTreePanel class 包装 + 加 RunManager.skillTreeState 字段
   step 4: PanelRenderers.ts 新增 3 个 Pixi 渲染器
   step 5: main.ts wire 3 panel + 3 renderer，删 line 234-238 兜底
   step 6: run.integration.test.ts 加 3 smoke case
   step 7: 浏览器手动验证 + 写 design/dev-logs/2026-05-16.md
   step 8: **明确提醒用户：MVP 验收清单全打绿，可以验收**
5. 每个 step 后跑 typecheck + test + build + check:doc 四命令门
6. token ≥ 70% 立即再 handoff
```

**预计**：5-7 commits 把 MVP 剩余 6 条验收全打绿。
