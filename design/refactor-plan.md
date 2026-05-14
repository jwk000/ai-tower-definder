# 设计文档重构计划

> 状态: 待 review · 等待用户逐项打勾后方才动手任何 .md 源文件
> 日期: 2026-05-14
> 触发原因: 用户新增 v3.1 塔科技树后，文档总数 31，存在多权威并存、沿用文档未审、卡牌入口重复定义等问题
> 用户裁决记录见本文件末尾 §6

---

## 1. 重构目标

1. **层级化**：把扁平的 31 篇文档按职责分入 7 个层级目录（00-vision / 10-gameplay / 20-units / 30-ai / 40-presentation / 50-data-numerical / 60-tech / archive）。
2. **去矛盾**：基于用户对 M1-M7 的裁决（§6）彻底删除矛盾内容，不再保留 "DEPRECATED 但内文保留" 的模糊状态。
3. **元数据统一**：每篇文档顶部增加 frontmatter（status / version / last-modified / supersedes / authority-for）。
4. **唯一权威**：每个领域指定唯一权威文档，其它文档只允许 cross-ref，不允许重复定义。
5. **可读性**：README 不再列 31 行表格，而是先按层级讲故事，再给精简导航。

---

## 2. 目标目录结构

```
design/
├── README.md                          [新写：层级化导航]
├── _template.md                       [新写：文档模板]
├── refactor-plan.md                   [本文件，临时存在]
├── refactor-acceptance.md             [新写：重构验收清单，临时存在]
│
├── 00-vision/                         [愿景层]
│   ├── 00-game-overview.md
│   └── 01-acceptance-criteria.md
│
├── 10-gameplay/                       [玩法层]
│   ├── 10-roguelike-loop.md           [⭐ Roguelike 玩法唯一权威]
│   ├── 11-economy.md
│   ├── 12-game-modes.md
│   ├── 13-map-level.md
│   └── 14-weather.md
│
├── 20-units/                          [单位层]
│   ├── 20-unit-system.md              [体系/架构，不含具体单位数据]
│   ├── 21-unit-roster.md              [所有单位 + 卡 ID + 字段表，合并自 03+22]
│   ├── 22-tower-tech-tree.md          [⭐ 塔升级唯一权威]
│   ├── 23-skill-buff.md
│   ├── 24-combat.md
│   ├── 25-vulnerability.md
│   └── 26-missile-special.md          [21 的子专题，专门讲导弹塔特殊机制]
│
├── 30-ai/                             [AI 层]
│   ├── 30-behavior-tree.md
│   └── 31-soldier-ai.md
│
├── 40-presentation/                   [表现层]
│   ├── 40-ui-ux.md
│   ├── 41-responsive-layout.md
│   ├── 42-art-assets.md
│   ├── 43-scene-decoration.md
│   ├── 44-visual-effects.md
│   ├── 45-layer-system.md
│   └── 46-audio.md
│
├── 50-data-numerical/
│   └── 50-mda.md                      [⭐ 数值唯一真理源]
│
├── 60-tech/                           [技术与工程层]
│   ├── 60-architecture.md
│   ├── 61-save-system.md
│   ├── 62-faction-refactor.md         [📝 草案]
│   ├── 63-debug.md
│   └── 64-level-editor.md             [✅ v1.0 已批准]
│
├── archive/                           [归档]
│   ├── 塔防游戏单位设计参考.md
│   ├── 研究总结.md
│   ├── deprecated-l3-passives.md      [新建：从 04 §2.2 提取]
│   └── deprecated-units-vine-ballista.md [新建：从 22 §4.1/§4.3 提取]
│
└── dev-logs/                          [开发日志，原样保留]
    ├── 2026-05-13.md
    └── 2026-05-14.md
```

---

## 3. 文件迁移动作表

> 动作语义：MOVE = 仅迁移路径 / RENAME = 改名 / MERGE_INTO = 合并到目标 / EXTRACT_TO = 提取部分到目标 / DELETE = 删除内容 / REVIEW = 重审内文 / NEW = 新建

### 3.1 顶层

| 旧路径 | 动作 | 新路径 | 备注 |
|---|---|---|---|
| `design/README.md` | REWRITE | `design/README.md` | 按层级目录结构重写，导航更精简 |
| - | NEW | `design/_template.md` | 文档模板（frontmatter + 必备小节） |
| - | NEW（临时） | `design/refactor-plan.md` | 本文件，重构完成后可删 |
| - | NEW（临时） | `design/refactor-acceptance.md` | 验收清单，重构完成后可删 |

### 3.2 00-vision/

| 旧路径 | 动作 | 新路径 | 备注 |
|---|---|---|---|
| `01-game-overview.md` | MOVE | `00-vision/00-game-overview.md` | 头部加 frontmatter，统一术语 |
| `14-acceptance-criteria.md` | MOVE + REVIEW | `00-vision/01-acceptance-criteria.md` | M6: 重审所有 v3.0 验收项与实现状态 |

### 3.3 10-gameplay/

| 旧路径 | 动作 | 新路径 | 备注 |
|---|---|---|---|
| `25-card-roguelike-refactor.md` | MOVE + EDIT | `10-gameplay/10-roguelike-loop.md` | 标记为 ⭐ 玩法唯一权威；M1: instanceLevel 改 "仅由法术卡提升"；M2: 删 L3 商品；M3: 删迁移补偿条款 |
| `06-economy-system.md` | MOVE | `10-gameplay/11-economy.md` | 头部加 frontmatter |
| `08-game-modes.md` | MOVE | `10-gameplay/12-game-modes.md` | 头部加 frontmatter |
| `07-map-level-system.md` | MOVE | `10-gameplay/13-map-level.md` | 头部加 frontmatter |
| `11-weather-system.md` | MOVE + REVIEW + DELETE | `10-gameplay/14-weather.md` | M4: 删除所有 "天气影响经济" 描述，仅保留战斗数值影响 |

### 3.4 20-units/

| 旧路径 | 动作 | 新路径 | 备注 |
|---|---|---|---|
| `02-unit-system.md` | MOVE + EDIT | `20-units/20-unit-system.md` | M7: §8 卡牌生成入口 → 改为 "详见 10-roguelike-loop.md §2"；保留体系/架构描述 |
| `03-unit-data.md` + `22-new-unit-design.md` | MERGE | `20-units/21-unit-roster.md` | 合并两表为唯一阵容表；ice_tower → elemental_tower 全表生效；删除毒藤塔/弩炮塔条目（移到 archive）；M7: §8 卡 ID 索引保留（卡 ID 是数据表的一部分） |
| `30-tower-tech-tree.md` | MOVE + EDIT | `20-units/22-tower-tech-tree.md` | 标 ⭐ 塔升级唯一权威；M3: §10 数据迁移整段删除 |
| `04-skill-buff-system.md` | MOVE + EDIT | `20-units/23-skill-buff.md` | M2: §2.2 L3 解锁被动整段删除，内容提取到 `archive/deprecated-l3-passives.md` |
| `05-combat-system.md` | MOVE + REVIEW | `20-units/24-combat.md` | M6: 校对所有公式字段是否与 v3.0 一致 |
| `26-vulnerability-status.md` | MOVE + REVIEW | `20-units/25-vulnerability.md` | M6: 校对引用字段（特别是塔等级相关） |
| `19-missile-tower.md` | MOVE + EDIT | `20-units/26-missile-special.md` | §二 升级机制整段删除；保留路径 1 多发射机制；头部加 "本文是 21-unit-roster 的子专题" 声明 |

### 3.5 30-ai/

| 旧路径 | 动作 | 新路径 | 备注 |
|---|---|---|---|
| `23-ai-behavior-tree.md` | MOVE | `30-ai/30-behavior-tree.md` | 头部加 frontmatter |
| `24-soldier-ai-behavior.md` | MOVE + EDIT | `30-ai/31-soldier-ai.md` | M5: §12 升级章节改写为 "TODO: 后期为士兵卡加路径升级，当前阶段士兵一次性消耗品，不可升级" |

### 3.6 40-presentation/

| 旧路径 | 动作 | 新路径 | 备注 |
|---|---|---|---|
| `09-ui-ux.md` | MOVE | `40-presentation/40-ui-ux.md` | |
| `20-responsive-layout.md` | MOVE | `40-presentation/41-responsive-layout.md` | |
| `16-art-assets-design.md` | MOVE | `40-presentation/42-art-assets.md` | |
| `17-scene-decoration.md` | MOVE + REVIEW | `40-presentation/43-scene-decoration.md` | M6: 校对引用的资源/字段是否仍存在 |
| `12-visual-effects.md` | MOVE + REVIEW | `40-presentation/44-visual-effects.md` | M6: 校对图层/粒子配置是否与 v3.0 一致 |
| `18-layer-system.md` | MOVE + REVIEW | `40-presentation/45-layer-system.md` | M6: 校对 6 层垂直空间是否仍生效 |
| `10-audio-system.md` | MOVE | `40-presentation/46-audio.md` | |

### 3.7 50-data-numerical/

| 旧路径 | 动作 | 新路径 | 备注 |
|---|---|---|---|
| `21-mda-numerical-design.md` | MOVE | `50-data-numerical/50-mda.md` | 标 ⭐ 数值唯一真理源；§17 火花碎片同步 M3 决策（无老存档补偿） |

### 3.8 60-tech/

| 旧路径 | 动作 | 新路径 | 备注 |
|---|---|---|---|
| `15-refactoring-plan.md` | MOVE | `60-tech/60-architecture.md` | 改名以反映其本质是架构文档 |
| `13-save-system.md` | MOVE + EDIT | `60-tech/61-save-system.md` | M3: §6.2 v2.0→v2.1 迁移整段删除，直接以 v2.1.0 为新基线 |
| `28-faction-refactoring.md` | MOVE | `60-tech/62-faction-refactor.md` | 保留草案状态 |
| `27-debug-system.md` | MOVE + REVIEW | `60-tech/63-debug.md` | M6: 校对调试入口列表 |
| `29-level-editor.md` | MOVE | `60-tech/64-level-editor.md` | ✅ v1.0 已批准，无内容改动 |

### 3.9 archive/

| 旧路径/动作 | 新路径 | 备注 |
|---|---|---|
| `塔防游戏单位设计参考.md` MOVE | `archive/塔防游戏单位设计参考.md` | 孤儿文档，无 cross-ref |
| `研究总结.md` MOVE | `archive/研究总结.md` | 孤儿文档 |
| EXTRACT_TO（来自 04 §2.2） | `archive/deprecated-l3-passives.md` | M2 决策：彻底删除 L3 被动设计 |
| EXTRACT_TO（来自 22 §4.1/§4.3） | `archive/deprecated-units-vine-ballista.md` | 毒藤塔/弩炮塔设计存档备份 |

---

## 4. 文档元数据头规范（在 §5 模板中定型）

每篇文档顶部 frontmatter 字段：

```yaml
---
title: <文档标题>
status: authoritative | stable | draft | deprecated | archived
version: <语义化版本，如 1.0.0>
last-modified: YYYY-MM-DD
authority-for: [<由本文档单独裁定的领域列表>]   # 可为空
supersedes: [<已被本文档取代的旧文件名列表>]    # 可为空
cross-refs: [<本文档主要引用的同级文档>]
---
```

> 例：`10-roguelike-loop.md` 的 frontmatter 中 `authority-for: ["card-system", "run-flow", "energy-cost", "shop-mystic-node"]`。

---

## 5. 处理矛盾的位置索引（M1-M7）

| # | 决策摘要 | 改动位置 |
|---|---|---|
| M1 | instanceLevel 仅由法术卡提升 | `10-roguelike-loop.md` §2.4；`21-unit-roster.md` §10 字段表；`22-tower-tech-tree.md` §2 全局规则；`23-skill-buff.md` 新增 §7 "法术卡如何提升 instanceLevel" |
| M2 | L3 被动彻底删除 | `23-skill-buff.md` §2.2 整段删 → 提取到 `archive/deprecated-l3-passives.md` |
| M3 | 无老存档，不做迁移补偿 | `61-save-system.md` §6.2 整段删；`22-tower-tech-tree.md` §10 整段删；`50-mda.md` §17/§20 移除迁移补偿条款 |
| M4 | 天气不影响经济 | `14-weather.md` 中删除所有经济相关描述；`11-economy.md` 中删除任何天气交互假设（若存在） |
| M5 | 士兵升级延后 | `31-soldier-ai.md` §12 改写为 TODO 标记 + 设计意图说明 |
| M6 | 全部沿用文档重审 | 5 篇标 REVIEW：05/11/12/17/18/24/26/27 → 在新路径中各加一节 "v3.1 一致性核对：xxx" |
| M7 | 25 是卡牌权威 | `20-unit-system.md` §8 改 cross-ref；`21-unit-roster.md` §8 保留卡 ID 表但删除"如何变成场上单位"描述 |

---

## 6. 用户裁决记录（2026-05-14 三轮对话）

### 第一轮：重构总策略
- **重构粒度**：彻底重构（推荐选项）
- **矛盾裁决方式**：用户逐条决策（推荐选项）
- **新需求范围**：没有，就用现在文档里反映的需求

### 第二轮：M1-M3 核心机制
- **M1 instanceLevel**：保留 instanceLevel，但仅通过法术卡提升（推荐）
- **M2 L3 被动**：完全删除，科技树全面接管（推荐）
- **M3 存档迁移**：游戏没做完，现在还没有老玩家，不用考虑这种情况

### 第三轮：M4-M7 边角问题
- **M4 天气**：天气仅影响战斗数值不影响经济（推荐）
- **M5 士兵升级**：士兵也有路径升级（后期、当前不做）
- **M6 沿用文档**：重审所有沿用文档，修订到与 v3.1 一致（推荐）
- **M7 卡牌入口**：25 权威，其他只保留 cross-ref（推荐）

### 第四轮：推进方式
- **实施顺序**：先起文档 + 验收清单，再动手重构（推荐）

---

## 7. 阶段划分（重构动手时）

> 注意：以下阶段在你 review 并批准本文件 + refactor-acceptance.md + _template.md 之后才会启动。每个阶段独立 commit。

### Phase R1 — 骨架与归档（低风险，无内容修改）
1. 创建 7 个层级目录
2. 创建 `archive/`、`_template.md`
3. 把孤儿文档（研究总结 / 单位参考）移到 archive
4. `commit: docs(refactor): R1 创建目录骨架与归档孤儿文档`

### Phase R2 — 矛盾内容清除（破坏性，按 §5 索引执行）
1. 从 04 提取 L3 被动 → archive
2. 从 22 提取毒藤/弩炮塔条目 → archive
3. 删除 13 §6.2 迁移、30 §10 迁移、21 中迁移条款
4. 删除 11 中经济相关
5. 改写 24 §12 为 TODO
6. `commit: refactor(roguelike): R2 清除 M1-M7 矛盾内容（按 refactor-plan §5）`

### Phase R3 — 单位合并（核心结构变更）
1. 合并 03 + 22 → 新 `21-unit-roster.md`
2. 改写 02 §8 / 03 §8 / 25 的卡牌入口边界
3. `commit: refactor(roguelike): R3 合并单位数据与新单位为统一阵容表`

### Phase R4 — 整体迁移（路径迁移 + frontmatter 注入）
1. 按 §3 表格逐个 MOVE/RENAME
2. 给每篇加 frontmatter
3. `commit: refactor(roguelike): R4 按层级迁移所有文档并注入 frontmatter`

### Phase R5 — 沿用文档重审（M6 批量动作）
1. 逐个 review 05/11/12/17/18/24/26/27（已在 §3 中按位置标记 REVIEW）
2. 每篇加一节 "v3.1 一致性核对"
3. 一次 commit / 一篇 commit，由动手时决定粒度
4. `commit: docs(roguelike): R5 沿用文档重审至 v3.1 一致`（或多个）

### Phase R6 — README 重写 + 收尾
1. 按层级结构重写 README
2. 删除 refactor-plan.md、refactor-acceptance.md（任务完成）
3. 写 dev-log
4. `commit: docs(refactor): R6 重写 README + 收尾`

---

## 8. 风险与回滚

- **风险 1**：合并 03+22 时若漏掉某单位字段，会导致代码引用断裂。**缓解**：合并前先列出两文档的所有单位 ID 并集，逐项校对。
- **风险 2**：沿用文档重审可能引入新的与 v3.1 的不一致。**缓解**：每篇 review 前先用 grep 找 v1/v2 字段名（gold/population/three-star 等），列出可疑点。
- **风险 3**：frontmatter 格式与现有 Markdown 工具不兼容。**缓解**：采用 GitHub-flavored YAML frontmatter（已在 GFM、VSCode、Hugo、Jekyll 普遍支持）。
- **回滚**：每个 Phase 都是独立 commit，任一阶段失败可 `git revert` 到上一 Phase。

---

## 9. 后续可能的设计任务（不在本次重构范围）

- 士兵卡科技树（M5 延后项）
- 天气与战斗数值的精细化矩阵（M4 决策后简化的副产品）
- 28 阵营语义重构是否要落地（草案状态超过 2 周）

---

## 10. 待用户 review 的本次三份交付

- [ ] **本文件**（refactor-plan.md）—— 路径图与动作表
- [ ] **refactor-acceptance.md** —— 验收清单
- [ ] **_template.md** —— 文档模板

review 通过后才会进入 Phase R1。
