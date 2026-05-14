# 设计文档重构 — 验收清单

> 配套文件: `refactor-plan.md`（路径动作表）+ `_template.md`（文档模板）
> 状态: 待用户 review · 通过后将作为 Phase R1-R6 的勾验依据
> 日期: 2026-05-14

---

## 使用说明

- 每条验收项是**可验证的**——给出明确的检查命令、grep 模式、或文件存在性。
- 验证方式分两类：
  - **🟦 客观**：可用 `rg`、`ls`、文件计数等命令验证。
  - **🟨 主观**：需要人工阅读核对。
- 重构完成的定义 = **本清单 100% 勾完**。

---

## 0. 全局验收

| # | 项 | 验证 |
|---|---|---|
| G1 | design/ 顶层 `.md` 文件 ≤ 5 个（README、_template、refactor-plan、refactor-acceptance、可选 CHANGELOG） | 🟦 `find design -maxdepth 1 -name "*.md" \| wc -l` ≤ 5 |
| G2 | design/ 下不再有数字开头的 `.md` 文件（01-30 全部进入子目录） | 🟦 `find design -maxdepth 1 -name "[0-9]*.md" \| wc -l` == 0 |
| G3 | 出现 7 个层级目录：00-vision / 10-gameplay / 20-units / 30-ai / 40-presentation / 50-data-numerical / 60-tech | 🟦 `ls -d design/*/` 应包含全部 7 个 |
| G4 | 出现 `archive/` 目录，含 ≥ 4 个文件 | 🟦 `ls design/archive/ \| wc -l` ≥ 4 |
| G5 | `dev-logs/` 内容未受损坏（2026-05-13.md / 2026-05-14.md 仍在） | 🟦 `ls design/dev-logs/` |
| G6 | 全部 `.md` 文件顶部都有 frontmatter（含 status / version / last-modified） | 🟨 抽查 6-8 个文件 |
| G7 | 全文搜索不再出现 "L3 解锁被动" / "L3 unlock passive" 等过时表述 | 🟦 `rg -i "L3.*解锁被动\|L3 passive\|L3 unlock" design/ --glob '!archive/' --glob '!dev-logs/'` 返回 0 行 |
| G8 | 全文搜索不再出现 "baseLevel=N → 解锁路径 1 前 N 节点" 类迁移描述 | 🟦 `rg -i "baseLevel.*迁移\|v2\.0.*v2\.1.*迁移\|补偿碎片" design/ --glob '!archive/' --glob '!dev-logs/' --glob '!refactor-*.md'` 返回 0 行 |
| G9 | 全文搜索不再出现 "毒藤塔"/"弩炮塔" 作为现役单位（仅 archive/ 允许） | 🟦 `rg -l "毒藤塔\|弩炮塔" design/ --glob '!archive/' --glob '!dev-logs/'` 仅返回科技树承接说明的文档 |
| G10 | 全文搜索不再出现 `ice_tower` 作为活跃 ID（应全部改为 `elemental_tower`） | 🟦 `rg "ice_tower" design/ --glob '!archive/' --glob '!dev-logs/'` 返回 0 行 |

---

## 1. 00-vision/ 验收

| # | 项 | 验证 |
|---|---|---|
| V1 | `00-vision/00-game-overview.md` 存在，内容来源于原 `01-game-overview.md` | 🟦 文件存在 + frontmatter 中 `supersedes: ["01-game-overview.md"]` |
| V2 | `00-vision/01-acceptance-criteria.md` 存在，内容来源于原 `14-acceptance-criteria.md` | 🟦 文件存在 + supersedes 字段 |
| V3 | 01 文档中的 v3.0 验收项与 v3.1 实现状态一一对应（M6 重审） | 🟨 用户人工核验：§3.x 各项的勾选状态是否反映了 dev-logs 中的最新进展 |
| V4 | 01 文档不再引用 v1.1 / 三星 / 工具栏部署 等已删机制 | 🟦 `rg -i "三星\|工具栏部署\|无尽模式" design/00-vision/` 返回 0 行（除非作为 "已删除" 说明） |

---

## 2. 10-gameplay/ 验收

| # | 项 | 验证 |
|---|---|---|
| G-1 | `10-gameplay/10-roguelike-loop.md` 存在，frontmatter `status: authoritative` + `authority-for` 含 card-system / run-flow / energy-cost / shop-mystic-node | 🟦 |
| G-2 | 10 文档 §2.4 卡牌升级状态：仅描述 "塔卡 instanceLevel 由法术卡提升"，无 "L2-L5 升级商品" / "技能卡升级塔卡" 表述 | 🟦 `rg -i "升级商品\|技能卡.*升级塔卡\|箭塔.*L2\|商店.*\[升级\]" design/10-gameplay/10-roguelike-loop.md` 返回 0 行 |
| G-3 | 10 文档 §3.2 商店表中无 "[升级] 箭塔→L2" 商品（M2 + M1） | 🟦 |
| G-4 | 10 文档不再含 v2.0→v2.1 迁移补偿条款（M3） | 🟦 |
| G-5 | `10-gameplay/11-economy.md` 三资源描述与 v3.0 一致：能量关内/金币关间/碎片 meta | 🟨 |
| G-6 | `10-gameplay/12-game-modes.md` 仅描述 Run 模式（不出现无尽模式作为现役模式） | 🟦 |
| G-7 | `10-gameplay/13-map-level.md` 含 21×9 网格、8 关 + 终战、6 流 PRNG | 🟨 |
| G-8 | `10-gameplay/14-weather.md` 中无任何 "天气影响金币/能量/被动回血" 描述（M4） | 🟦 `rg -i "天气.*金币\|天气.*能量\|天气.*被动回血\|天气.*经济" design/10-gameplay/14-weather.md` 返回 0 行 |
| G-9 | 14-weather.md 顶部加 frontmatter，并加一节 "v3.1 一致性核对：与 06-economy 解耦" | 🟨 |

---

## 3. 20-units/ 验收

| # | 项 | 验证 |
|---|---|---|
| U-1 | `20-units/20-unit-system.md` 存在；§8 卡牌生成入口改为 "详见 `10-roguelike-loop.md` §2"（cross-ref） | 🟦 grep 应该看到 cross-ref 而不是具体描述 |
| U-2 | `20-units/21-unit-roster.md` 存在，是 03 + 22 的合并产物 | 🟦 文件存在 + supersedes: ["03-unit-data.md","22-new-unit-design.md"] |
| U-3 | 21 中含全部友方单位（基础塔、士兵、生产、陷阱）+ 全部敌方单位（含 abyss_lord 终战 Boss） | 🟨 与原 03/22 单位列表逐项对照 |
| U-4 | 21 中不出现 ice_tower（全部为 elemental_tower）；不出现 vine_tower / ballista_tower 作为现役单位 | 🟦 `rg "vine_tower\|ballista_tower\|ice_tower" design/20-units/21-unit-roster.md` 返回 0 行 |
| U-5 | 21 §10 字段表：`baseLevel` 标 @deprecated 或移除；`instanceLevel` 注释为 "仅由法术卡提升，本局有效" | 🟦 |
| U-6 | 21 §8 卡 ID 索引保留（数据表组成部分），但不重复 "如何变成场上单位" 的逻辑描述（M7） | 🟦 |
| U-7 | `20-units/22-tower-tech-tree.md` 存在，frontmatter `status: authoritative` + `authority-for: ["tower-upgrade", "tech-tree-path", "shard-cost"]` | 🟦 |
| U-8 | 22 §10 数据迁移整段已删（M3） | 🟦 grep "数据迁移" 在 22 文件中 0 命中或仅剩占位说明 |
| U-9 | `20-units/23-skill-buff.md` 中 §2.2 L3 解锁被动整段已删 | 🟦 grep "L3.*解锁\|L3 解锁被动" 在 23 文件中 0 命中 |
| U-10 | 23 中新增一节 "法术卡如何提升 instanceLevel"（M1 决策落地点） | 🟦 grep "instanceLevel.*法术卡\|法术卡.*instanceLevel" 命中 ≥ 1 |
| U-11 | `archive/deprecated-l3-passives.md` 存在，含原 04 §2.2 的全部内容（仅作历史参考） | 🟦 |
| U-12 | `20-units/24-combat.md` 顶部加 "v3.1 一致性核对" 节，说明伤害/攻速公式仍生效 | 🟨 |
| U-13 | `20-units/25-vulnerability.md` 顶部加 "v3.1 一致性核对" 节 | 🟨 |
| U-14 | `20-units/26-missile-special.md` §二 升级机制章节已删；保留路径 1 多发射；头部声明 "本文是 21-unit-roster 的子专题" | 🟦 |

---

## 4. 30-ai/ 验收

| # | 项 | 验证 |
|---|---|---|
| A-1 | `30-ai/30-behavior-tree.md` 存在 | 🟦 |
| A-2 | `30-ai/31-soldier-ai.md` §12 改写为 TODO 标记 + "士兵卡科技树将在后期实现" 说明（M5） | 🟦 grep "TODO.*士兵\|士兵.*后期实现" 在 §12 命中 ≥ 1 |
| A-3 | 30 文档加 "v3.1 一致性核对" 节 | 🟨 |

---

## 5. 40-presentation/ 验收

| # | 项 | 验证 |
|---|---|---|
| P-1 | 40-46 共 7 篇全部存在于 `40-presentation/` | 🟦 `ls design/40-presentation/*.md \| wc -l` == 7 |
| P-2 | 17/12/18/27（沿用类）顶部都新加 "v3.1 一致性核对" 节（M6） | 🟨 |
| P-3 | 41-responsive-layout.md 中 v3.0 手牌区/关间/商店/秘境/卡池锚点仍存在 | 🟨 |
| P-4 | 42-art-assets.md 中 §12 等级升级 + §13 卡牌视觉规范仍存在 | 🟨 |

---

## 6. 50-data-numerical/ 验收

| # | 项 | 验证 |
|---|---|---|
| N-1 | `50-data-numerical/50-mda.md` 存在，frontmatter `status: authoritative` + `authority-for: ["all-numerical-truth"]` | 🟦 |
| N-2 | §20 塔科技树数值章节完整保留 | 🟨 |
| N-3 | §17 火花碎片章节中无 "v2.0→v2.1 迁移补偿" 类条款（M3） | 🟦 grep "迁移.*补偿碎片\|v2\.0.*v2\.1" 在 50-mda.md 中 0 命中 |
| N-4 | 全文搜索其它文档不持有数值表（除占位说明引用 50 之外） | 🟨 抽查 5 篇非数值文档，确认无与 50 冲突的数值表 |

---

## 7. 60-tech/ 验收

| # | 项 | 验证 |
|---|---|---|
| T-1 | 60-64 共 5 篇全部存在 | 🟦 `ls design/60-tech/*.md \| wc -l` == 5 |
| T-2 | `61-save-system.md` §6.2 v2.0→v2.1 迁移整段已删（M3） | 🟦 grep "v2\.0.*v2\.1\|baseLevel.*迁移" 在 61 中 0 命中 |
| T-3 | 61 中 CardEntry.techTree 字段保留，instanceLevel 注释为 "仅本局/由法术卡提升" | 🟨 |
| T-4 | `62-faction-refactor.md` 仍标 `status: draft` | 🟦 |
| T-5 | `63-debug.md` 加 "v3.1 一致性核对" 节 | 🟨 |
| T-6 | `64-level-editor.md` 内容无改动（已批准状态） | 🟨 |

---

## 8. archive/ 验收

| # | 项 | 验证 |
|---|---|---|
| AR-1 | 含 `塔防游戏单位设计参考.md` 与 `研究总结.md` | 🟦 |
| AR-2 | 含 `deprecated-l3-passives.md`（含原 04 §2.2 完整内容） | 🟦 |
| AR-3 | 含 `deprecated-units-vine-ballista.md`（含原 22 §4.1/§4.3 完整内容） | 🟦 |
| AR-4 | archive 中所有文件顶部都有 frontmatter `status: archived` | 🟦 grep 抽查 |
| AR-5 | archive 中不被 design 主线（00-60）任何文档引用，除非作为 "历史参考" | 🟨 |

---

## 9. README 验收

| # | 项 | 验证 |
|---|---|---|
| R-1 | README 不再是 30 行的扁平表格 | 🟨 |
| R-2 | README 包含 7 个层级目录的导航段落 | 🟨 |
| R-3 | README 包含 4 条 ⭐ 权威标记（玩法 / 塔升级 / 数值 / 关卡编辑器） | 🟨 |
| R-4 | README 包含 "v3.1 阅读路径建议" 章节，含 3 条不同读者画像（首次了解 / 开发实施 / 数值平衡） | 🟨 |
| R-5 | README 顶部有 `last-modified: 2026-05-14` | 🟦 |

---

## 10. Cross-Reference 验收

| # | 项 | 验证 |
|---|---|---|
| C-1 | 全部内部链接 `.md` 路径仍可达（不存在断链） | 🟦 markdown 链接检查器（可用简单 grep + ls） |
| C-2 | "卡牌如何变成场上单位" 这一概念只在 10-roguelike-loop.md §2 详述，其它处均为 cross-ref（M7） | 🟦 grep "playCard 事务\|出卡三步事务" 在非 10-roguelike-loop.md 命中 0 |
| C-3 | 数值表仅在 50-mda.md 中存在，其它处均为 cross-ref（数值真理源） | 🟨 |
| C-4 | 塔升级机制仅在 22-tower-tech-tree.md 中详述，其它处均为 cross-ref | 🟦 grep "节点解锁\|路径互斥\|路径重置" 在非 22 文件命中 0（dev-logs 与 refactor-* 例外） |

---

## 11. dev-log 验收

| # | 项 | 验证 |
|---|---|---|
| L-1 | 重构完成时新增 `dev-logs/2026-05-XX.md`，记录本次重构动作 + 决策摘要 | 🟦 |
| L-2 | 日志包含 §6 M1-M7 决策表的引用 | 🟨 |

---

## 12. 构建与代码层面验收（重构不应破坏代码）

| # | 项 | 验证 |
|---|---|---|
| B-1 | `npm run typecheck` 通过 | 🟦 |
| B-2 | `npm run build` 通过 | 🟦 |
| B-3 | `npm test` 全过（重构前后测试数应一致） | 🟦 |
| B-4 | 代码中如果有 `import` 引用 design/ 路径，更新到新路径 | 🟦 `rg "design/\d+" src/` 应已更新（一般不会有） |
| B-5 | AGENTS.md 中如果引用 design/ 路径，更新到新路径 | 🟦 |

---

## 13. 重构未完成项 / 风险点（计划带过来的）

> 这些不阻塞重构验收，但需要在 dev-log 中列出待办：

- 士兵卡科技树（M5 延后）
- 天气与战斗数值矩阵的精细化（M4 副产品）
- 28 阵营语义重构是否落地（仍为草案）
- 03+22 合并时若发现某单位字段缺失，需在 dev-log 单独列出

---

## 14. 完成定义

**本次重构视为完成的标准**：

1. § 0-12 所有 🟦 客观项 100% 通过
2. § 0-12 所有 🟨 主观项已被用户人工核验并打勾
3. `refactor-plan.md` 与 `refactor-acceptance.md` 已删除（任务收尾）
4. dev-log 已写入
5. 一个 `refactor(roguelike): R6 文档重构收尾` commit 已落地

完成后，AGENTS.md 中 "设计文档" 段落如果有引用旧路径，需同步更新（B-5 项）。
