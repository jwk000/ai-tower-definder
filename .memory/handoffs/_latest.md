# Handoff — Wave 7 全部完成，准备进 Wave 8

> 生成时间: 2026-05-16 (Asia/Shanghai)
> 主动 handoff 原因：context 73%，Wave 7 全部 8 个子 wave 已提交完成，进 Wave 8 之前交接。
> 续跑请新建会话，第一动作读本文件。

---

## 1. User Requests (As-Is)

- 历史指令仍生效：roguelike 重构、不再用行为树、token 接近上限直接 handoff、MVP 阶段不写详细单测
- 本会话指令：「继续 .memory/handoffs/_latest.md」（W7.4e → W7.8 顺序续跑）

## 2. Final Goal

在 `rougelike-v34` 分支完成 v3.4 MVP 重写，交付可演示的 L1 单关闭环。
**Wave 7 = 演示路径专项已完成。下一步 Wave 8 = 真实 Pixi 事件链 + pathGraph + 内容扩展（按用户指令决定优先级）。**

---

## 3. Wave 进度

### Done（本会话完成了 Wave 7 全部 8 个子 wave）

| 子 wave | commit | 内容 |
|---|---|---|
| **W7.4e** | `10d18c6` | main.ts 全栈装配（274行）：Vite ?raw YAML 静态导入、5 unit-system、drop_gold handler、WaveConfig 秒→ms 转换、pipeline 7 system 顺序、RunController 注入 waveSystem+levelState、4 panel class setHandler、projectUIFrame 取 levelState.phase、ticker 含 energy.tick |
| **W7.5** | `b7d154d` | HUD.phase 真实切换集成测试（Wave 7.D case）：2 wave mini-World，验 phase 序列 deployment→battle→wave-break→deployment→battle→wave-break→victory + RunManager.Result+victory |
| **W7.6** | `f39d71b` | drop_gold 端到端集成测试（Wave 7.C case）：attachRules(onDeath)+Health=0+tick→economy.gold+5 |
| **W7.7** | `c2682ab` | 性能基线脚本 `debug/perf-baseline.ts` + dev-log：avg=0.010ms、p95=0.027ms，远低于目标 16.67/22ms（纯逻辑层，无 Pixi 渲染） |
| **W7.8** | `3a4f2f0` | 收尾：mvp-v3.4-rewrite.md S20-S23 全部标✅已替换、S24/S25 新增🟡Wave 8 跟进、修订历史 2.7 |

（Wave 7 前 4 个子 wave W7.1-W7.4d 在前一会话完成，handoff 文档见归档记录）

### Verification State（当前 HEAD）

- HEAD `3a4f2f0`，分支 `rougelike-v34`，**ahead origin 15 commits**（全部未 push）
- 工作树仅 `.memory/handoffs/_latest.md` 修改（本文件）
- `npm run typecheck` ✅
- `npm test` ✅ **287 passed | 0 skipped (287 total)（baseline 268 → +19）**
- `npm run build` ✅ 1.18s

---

## 4. Active Working Context

### Branch & HEAD

- 分支 `rougelike-v34`（旧 `rougelike` 冻结作 v3.3 归档，禁动）
- HEAD `3a4f2f0`，ahead origin 15，均未 push

### Wave 7 核心落地产物

**`src/vite-env.d.ts`**（新建）：
```ts
/// <reference types="vite/client" />
declare module '*.yaml?raw' { const content: string; export default content; }
```

**`src/main.ts` 关键装配**（274行）：
- Vite `?raw` 静态导入 4 个 YAML（level-01 / enemies / towers-units / towers-cards）
- `parseLevelConfig(level01Yaml)` → `level: LevelConfig`
- `loadUnitConfigsForLevel(level, unitYamlFiles)` → `unitConfigs: Map<id, UnitConfig>`
- `loadCardConfigsForLevel(level, cardYamlFiles)` → `cardConfigs: CardConfig[]`（派生 arrow_tower_card / cannon_tower_card）
- `EconomySystem / CardRegistry / DeckSystem / HandSystem / EnergySystem / CardSpawnSystem`（5 unit-system）
- `LevelState().reset(level.waves.length)` —— waveTotal = 8
- `WaveConfig[]` 秒→毫秒（startDelay*1000, interval*1000）
- `SpawnConfig[]` = level.spawns.map（x/y 已是世界坐标）
- `game.ruleEngine.registerHandler('drop_gold', ...)` → `economy.addGold(amount)`
- Pipeline 顺序（gameplay phase）: WaveSystem → Movement(level.path) → Attack → Projectile → Crystal
  lifecycle phase: Health → Lifecycle
- `RunController({ game, runManager, scenes, waveSystem, levelState })`
- 4 panel class + setHandler（MainMenu/Hand/InterLevel/RunResult）
- `globalThis.__td = { mainMenu, handPanel, interLevelPanel, runResultPanel, runController, waveSystem }`（dev hook）
- ticker: `runController.tick(dt)` + Battle 帧: `energySystem.tick(dt)` + `presenter.present(projectUIFrame(...))`
- `projectUIFrame` 新签名（5 参数）取 levelState.phase + hand.cards 真实 cost/playable

**`src/__tests__/run.integration.test.ts`**（+2 describe/2 case）：
- Wave 7.D: HUD.phase 序列验证（phaseLog 断言）
- Wave 7.C: drop_gold handler 端到端

**`debug/perf-baseline.ts`**（新建）：`npx tsx debug/perf-baseline.ts` 运行

### 关键决策（Wave 7 新增）

- **D-W7.4e-vite-raw-import**：用 Vite `?raw` 替代 `fs.readFileSync`（浏览器环境无 fs）
- **D-W7.4e-runController-forward-ref**：`let runController!: RunController` 前向引用解循环依赖（waveSystem 的 onAllWavesComplete 需要 runController）
- **D-W7.4e-path-level-driven**：MovementSystem 改用 `level.path`（loader 投影），不再 DEFAULT_PATH；S25 标 Wave 8 跟进
- **D-W7.4e-dev-hook-globalThis**：panel class 不绑 Pixi pointerdown（D-W7.4d-no-pixi-binding），`globalThis.__td` 暴露 dev hook，浏览器 console 可手动触发

---

## 5. Explicit Constraints (Verbatim Only)

- 中文沟通
- 原子提交 + commit message 即任务描述（子 wave 一次一 commit）
- roguelike 重构铁律：本分支属于推翻重写，旧分支冻结
- MVP 阶段不写详细单测（用户指令，仍生效）
- 接近 token 上限直接 handoff，不走自动压缩（用户指令）
- AI 不再用行为树（用户指令）
- 跳过外部 Momus 评审，Sisyphus 自查代评

---

## 6. Next Steps

### Wave 8 候选项（按优先级参考，具体由用户指令决定）

1. **Pixi 事件链真实绑定**（S24 清理）：panel class 绑 Pixi Container pointerdown/pointermove，替代 dev-hook 手动触发
2. **pathGraph 动态路由**（S25 清理）：MovementSystem 接 level.path 多节点真实路径（level-01 当前 path 只有 2 点直线，先 L1 测）
3. **内容扩展**：更多 enemy type（runner/heavy/mage/exploder）在 units/enemies.yaml 中的 UnitConfig 补全（当前 loadUnitConfigsForLevel 如找不到会 throw，需要同步补配置）
4. **EnergySystem 在 waveSystem.start 时重置**：目前 startRun 时只调一次 energySystem.reset，wave-break 后能量不额外重置（按设计 wave-break 时 energy 继续 regen）
5. **HUD 金币显示接 economy.gold**：目前 projectUIFrame 取 `runManager.gold`（RunManager 内置的金币），但 main.ts 里 drop_gold 加到 `economy.gold`（EconomySystem），两个金币系统未打通。需要决策：把 economy.gold 同步回 runManager.gold，或 projectUIFrame 改读 economy.gold

### 重要 Bug — Gold 双账本（Wave 8 修复）

**问题**：main.ts 里 drop_gold → `economy.addGold(amount)`（EconomySystem），但 `projectUIFrame` 读 `runManager.gold`（RunManager）。两个金币系统分离，HUD 显示的金币不含 drop_gold 收益。

**修复方向**（二选一）：
- A. `drop_gold` handler 改为调 `runManager.addGold(amount)` + 移除 EconomySystem 中的金币
- B. `projectUIFrame` 改读 `economy.gold` + `runManager.gold`（初始金币）合并

推荐方向 A（RunManager 是 Run 级持久资源权威，EconomySystem 是辅助计算器）。

---

## 7. Critical Gotchas（Wave 7 新增，沿用前会话遗留）

- **Gold 双账本**：见 §6 重要 Bug。
- **WaveSystem.start() 在 startRun 回调内调**：main.ts `mainMenu.setHandler` 里 `waveSystem.start()` 在 `runController.startRun()` 之后调，顺序正确。
- **energySystem.tick(dt) 在 Battle 且 phase ∈ {battle, wave-break} 时触发**：deployment 时 energy 不 regen（按现实设计，玩家在 deployment 阶段放置塔但 energy 不增长）。
- **`attachRules` 覆盖替换不追加**：`byEvent.set(event, [...rules])` 是替换，不是 push。测试里 spawnUnit（会附 GRUNT.lifecycle.onDeath 规则）后再手动 attachRules 会覆盖掉前者。
- **`loadUnitConfigsForLevel` 强契约**：缺任何一个 enemyId / tower_id 就 throw。level-01 需要 grunt/runner/heavy/mage/exploder 5 种敌人 + arrow_tower/cannon_tower 2 种塔。enemies.yaml 解析时 `parseUnitConfigsFromYaml` 宽容 skip（小写 category/非法 faction 的 entry），确保 5 种敌人都能正确解析（否则 loadUnitConfigsForLevel 会 throw）。
- **Vite ?raw 导入**：需要 `src/vite-env.d.ts` 的 `declare module '*.yaml?raw'`，否则 typecheck 报错。
- **waveSystem 前向引用**：`let runController!: RunController` + 先 createWaveSystem → 再 new RunController 赋值给 runController。这是循环依赖的惯用解。
- **LevelWave 字段单位是秒**，WaveSystem 是毫秒（spawnDelayMs / intervalMs）。调用方必须 `*1000`（已在 main.ts W7.4e 转换）。
- **`runController.phase`**（返回 `RunPhase`）对比字符串字面量 `'Battle'` 是 TypeScript 合法比较（RunPhase 是 const enum string）。

---

## 8. Delegated Agent Sessions

无活跃 agent。

---

## 9. 续跑会话第一动作

```
1. Read .memory/handoffs/_latest.md（本文件）
2. rtk git log --oneline -5（确认 HEAD = 3a4f2f0）
3. rtk git status（确认工作树仅 _latest.md 改动）
4. rtk npm test -- --run | tail -5（确认 287 passed）
5. 询问用户：Wave 8 优先推进哪个方向（Pixi 事件链 / pathGraph / Gold 双账本 fix / 内容扩展）
6. 按用户指令推进 Wave 8
7. token ≥ 70% 立即再 handoff
```
