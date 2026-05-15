# Tower Defender — 设计文档索引

> 版本: **v3.4** · 卡牌 + Roguelike 长征版 · **单 Run 闭环 · 技能点系统 · 火花碎片已废弃**
> 最后整理: 2026-05-15（v3.4 形态级重构：火花碎片彻底废弃 + 新增技能点资源 + 商店重构）

---

## ⚠️ 数值真理源（必读）

**[50-mda（MDA 驱动的全局数值设计）](./50-data-numerical/50-mda.md) 是全部游戏数值的唯一权威来源。**

- 修改数值时**只改 50-mda**，然后据此同步代码（`src/data/gameData.ts`）与测试。
- 其它文档只描述字段语义/公式骨架/规则边界，**不再持有数值表**。
- 若发现某文档残留数值与 50-mda 冲突，**视为 BUG，必须删除残留并以 50-mda 为准**。
- 提 PR 时若改了数值，PR 标题以 `[数值]` 前缀。

---

## 🛑 v3.4 形态级重构声明（最高优先级，必读）

**v3.4（2026-05-15）：火花碎片彻底废弃 + meta 永久积累机制取消 + 新增技能点资源 + 商店两栏重构。**

- ⭐ **[v3.4-MAJOR-MIGRATION](./v3.4-MAJOR-MIGRATION.md)** — v3.4 主声明 + 31 文档影响清单 + 4 轮迁移规划（**第一阅读**）
- ⭐ **[48-shop-redesign-v34](./40-presentation/48-shop-redesign-v34.md)** — v3.4 商店重构 + 技能点资源 + shop_item CardType 拓展（**第二阅读**）

**v3.4 核心变更**：

| 维度 | v3.3（旧） | v3.4（新） |
|---|---|---|
| 资源轴 | 能量 / 金币 / 火花碎片 | **能量 / 金币 / 技能点** |
| Meta 积累 | 火花碎片关外永久解锁 + 永久科技树 | **彻底废弃** —— 单 Run 闭环，死亡无回报 |
| 卡牌解锁 | 部分卡需 200 碎片解锁 | **所有卡开局即解锁** |
| 塔升级 | 关外科技树（永久持有） | **本 Run 内技能树**（技能点本 Run 临时分配） |
| Run 结算 | 金币 1:1 转碎片入账 | **金币随 Run 结束清零**，无 meta 收益 |
| 商店 UI | 单栏 4 件混排 | **左右两栏 + 8 槽 + 全卡牌化** |

**v3.4 已 deprecated 文档**：
- 🛑 [22-tower-tech-tree](./20-units/22-tower-tech-tree.md)（已 deprecated，由 [22-skill-tree-overview](./20-units/22-skill-tree-overview.md) + [22a-22e](./20-units/) 全单位技能树文档接替；v3.1 塔节点设计被 22a 蓝本式继承）

**v3.4 第 2 轮已完成（7/7 🎉，2026-05-15）**：
- ✅ [10-roguelike-loop](./10-gameplay/10-roguelike-loop.md) v2.0.0 — 13 节 Run 长征单 Run 闭环权威（旧 v1.0 已归档）
- ✅ [50-mda](./50-data-numerical/50-mda.md) v1.3.1 — §14 商店 8 槽 + §15 秘境事件池数值镜像 + §17 SP 系统 + §20 删除 + 多章 v3.4 audit
- ✅ [11-economy](./10-gameplay/11-economy.md) v3.0.0 — 三资源轴改能量/金币/SP + §4 技能点整章 + §3.5 金币→SP 兑换 + §5 流向图重画
- ✅ [40-ui-ux](./40-presentation/40-ui-ux.md) v3.0.0 — 14 节 / 509 行；§7 商店转交 48 / §9 卡池删除 / §10 Run 结算「干净起跑」/ §11 主菜单 6→5 项
- ✅ [61-save-system](./60-tech/61-save-system.md) v3.0.0 — 12 节 / 405 行；存档版本 v3.0.0；删 5 个 meta 字段（旧 v1.0 已归档）
- ✅ [27-traps-spells-scene](./20-units/27-traps-spells-scene.md) v1.1.0 — §5 秘境事件池整章新增（14 事件 + 5/14 高风险 35.7% + 混合奖励 5 类 + 零成本退出 + schema）
- ✅ [41-responsive-layout](./40-presentation/41-responsive-layout.md) v1.0.1 — 5 子节修订 + 2 子节废弃 + §八 v3.4 一致性核对（核心锚点系统完全保留）

**v3.4 第 3 轮已完成（6/6 🎉，2026-05-15）**：
- ✅ [22-skill-tree-overview](./20-units/22-skill-tree-overview.md) v1.0.0 — 641 行 / 13 章：技能树通用骨架（节点结构 + SP 单价 0/3/6/10/15 锚点 + 路径互斥单装备 + 与 instanceLevel 正交边界 + RunManager.skillTreeState 接口 + UI 草图 + 7 项不变式）
- ✅ [22a-skill-tree-tower](./20-units/22a-skill-tree-tower.md) v1.0.0 — 915 行：7 塔技能树详设（蓝本式继承 v3.1 22-tower-tech-tree 节点设计 + 字段重命名 shardCost→spCost / techTree→skillTree + 19 RuleHandler）
- ✅ [22b-skill-tree-soldier](./20-units/22b-skill-tree-soldier.md) v1.0.0 — 785 行：6 士兵技能树详设（v3.4 全新创建 + 2 路径 × 3 节点 × 6 = 36 节点 + 17 RuleHandler + 强化主动技能 vs 强化普攻分叉）
- ✅ [22c-skill-tree-trap](./20-units/22c-skill-tree-trap.md) v1.0.0 — 978 行：9 陷阱技能树详设（v3.4 全新创建 + 2 路径 × 3 节点 × 9 = 54 节点 + 26 RuleHandler + 触发机制 vs 区域效果分叉）
- ✅ [22d-skill-tree-spell](./20-units/22d-skill-tree-spell.md) v1.0.0 — ~1100 行：14 法术卡技能树详设（弹性 2-4 路径 / 43 路径 / 129 节点 + 4 维度池伤害/范围/CD/持续 + §9 与 23-skill-buff §7 instanceLevel 正交铁律 + 23 RuleHandler）
- ✅ [22e-skill-tree-production](./20-units/22e-skill-tree-production.md) v1.0.0 — 462 行：2 建筑技能树详设（金矿 + 能量水晶，v3.4 全新创建 + 2 路径 × 3 节点 × 2 = 12 节点 + 7 RuleHandler + §7 与等级系统 L1/L2/L3 正交铁律 + effects[] 黑名单）

**第 3 轮交付汇总**：6 文档 / **~4881 行** / **~92 RuleHandler 引用**（部分共享）/ **0 禁词违规** / **0 spCost 锚点偏离** / **0 instanceLevel 边界越界**。

**下一步（第 4 轮）**：21-unit-roster §2.3 + 23-skill-buff §6 反向 cross-ref 修复 + 18 一般文档「碎片」清理 + src 代码改造（按 61-save-system v3.0.0 §10 已删除字段清单 + 第 3 轮 ~70-80 个新增 RuleHandler 实现）。

---

## ⚡ v3.0 / v3.1 / v3.3 历史形态声明（背景理解）

> 以下为 v3.4 之前的形态历史，背景理解之用。**当前实施**请以 v3.4 + MIGRATION + 48 为准。

**v3.0 将塔防游戏改造为「卡牌 + Roguelike 长征」形态；v3.1 进一步把塔升级迁至关外科技树（v3.4 已废弃）；v3.3 引入关卡路线图 + 关后 3 选 1。**

- **核心权威文档**（⭐ = authoritative，但部分已被 v3.4 改写）：
  - ⭐ [10-roguelike-loop](./10-gameplay/10-roguelike-loop.md) — Run 长征循环 / 手牌区 / 关后节点（**v2.0.0 v3.4 第 2 轮已完成**：13 节单 Run 闭环；旧 v1.0 归档至 [archive/10-roguelike-loop_v1.0_2026.05.15.md](./archive/10-roguelike-loop_v1.0_2026.05.15.md)）
  - ⭐ [50-mda](./50-data-numerical/50-mda.md) — 全局数值真理源（**v1.3.0 v3.4 第 2 轮已完成**：§14 商店 8 槽 + §17 SP 系统 + §20 删除 + §13 SP 兑换）
  - ⭐ [64-level-editor](./60-tech/64-level-editor.md) — 关卡编辑器（v3.4 不变）
  - ⭐ [60-architecture](./60-tech/60-architecture.md) — 系统架构、ECS 规则、规则引擎、Pipeline 顺序（v3.4 仅删 meta 系统提及）
  - ⭐ [47-level-map-ui](./40-presentation/47-level-map-ui.md) — 关卡路线图 UI（v3.4 已删除碎片余额显示）

- ~~**三资源（v3.3）**：能量 E / 金币 G / 火花碎片~~ → v3.4 改为 **能量 / 金币 / 技能点**
- **Run 长征**：8 关连闯 + 终战 Boss，水晶 HP 全程继承（无敌 + 秒杀机制），死亡从第 1 关重开。
- ~~**塔升级**：v3.1 关外卡池科技树~~ → v3.4 改为 **本 Run 内技能树**，废弃毒藤塔 / 弩炮塔依然有效。
- ~~**存档版本**：v2.0.0~~ → v3.4 升至 v3.0.0（删除 shardBalance / unlockedCards / techTree 持久化字段，待第 4 轮代码改造）。

---

## 分层目录

文档按职责分 7 层。每层一个子目录，文件名前两位数字 = 层号，后两位 = 层内顺序。

### `00-vision/` — 项目愿景与验收

| 文档 | 状态 | 简介 |
|---|---|---|
| [00-game-overview](./00-vision/00-game-overview.md) | stable | 游戏概述、Run 循环、三资源认知锚点 |
| [01-acceptance-criteria](./00-vision/01-acceptance-criteria.md) | stable | 验收清单（v3.0 全文重写，含 v1.1 保留项 + 回归项） |

### `10-gameplay/` — 玩法与系统

| 文档 | 状态 | 简介 |
|---|---|---|
| [10-roguelike-loop](./10-gameplay/10-roguelike-loop.md) | ⭐ authoritative · **v3.4 v2.0.0** | **v3.4 Run 长征单 Run 闭环权威（13 节）**：三资源 = 能量/金币/技能点；§3 关后 3 选 1（商店/秘境/跳过）；§5.2.4 水晶 HP 跨关继承；§6 单 Run 闭环结算；§11 10 条不变式。v1.0（v3.0/v3.1/v3.3 时期 14 章 893 行）已归档 [archive/10-roguelike-loop_v1.0_2026.05.15.md](./archive/10-roguelike-loop_v1.0_2026.05.15.md) |
| [11-economy](./10-gameplay/11-economy.md) | ⭐ authoritative · **v3.4 v3.0.0** | **v3.4 三资源轴权威**：能量 E（关内单波）/ 金币 G（本 Run 关间）/ **技能点 SP（本 Run 技能树）**；§3.5 金币→SP 兑换 50G/SP + §4 SP 系统（关 N×2 SP + 秘境 5-50 SP + 节点 3-15 SP）+ §5 资源流向总图（Run 结束清零）；~~火花碎片 meta~~ 整节删除 |
| [12-game-modes](./10-gameplay/12-game-modes.md) | stable | Run 模式（仅此一种）、关卡内难度 4 阶段 |
| [13-map-level](./10-gameplay/13-map-level.md) | stable | 21×9 网格、8 关 + 终战、6 个 PRNG 流隔离 |
| [14-weather](./10-gameplay/14-weather.md) | stable · v3.1 audit | 5 种天气、数值影响矩阵（仅影响战斗，不影响经济） |
| [15-level-themes](./10-gameplay/15-level-themes.md) | ⭐ authoritative | **8 关主题/敌人/数值权威**：8 主题、43 敌人档案（7 旧+36 新）、6 Boss（含 mini）、9 字段数值签名、跨关交叉校验 |
| [16-level-blueprints](./10-gameplay/16-level-blueprints.md) | ⭐ authoritative | **8 关详细蓝图**：每关 grid/tile/pathGraph/spawn/waves/obstacles/特殊机关完整蓝图，落地 YAML 配置的唯一权威 |

### `20-units/` — 单位与战斗

| 文档 | 状态 | 简介 |
|---|---|---|
| [20-unit-system](./20-units/20-unit-system.md) | stable | 统一单位概念、配置驱动、卡牌生成入口 |
| [21-unit-roster](./20-units/21-unit-roster.md) | stable | **R3 合并**（原 03 + 22）：单位字段语义、20 敌+20 友阵容、卡牌目录 |
| [22-tower-tech-tree](./20-units/22-tower-tech-tree.md) | 🛑 **deprecated (v3.4)** | ~~v3.1 塔升级权威~~ → v3.4 全文废弃，由 [22-skill-tree-overview](./20-units/22-skill-tree-overview.md)（通用骨架）+ [22a-skill-tree-tower](./20-units/22a-skill-tree-tower.md)（塔详设，蓝本式继承本文档节点设计）接替 |
| [22-skill-tree-overview](./20-units/22-skill-tree-overview.md) | ⭐ authoritative · **v3.4 v1.0.0** | **v3.4 技能树通用骨架权威**：13 章 / 641 行；节点结构 + SP 单价 0/3/6/10/15 锚点 + 路径互斥单装备 + 与 23-skill-buff §7 instanceLevel 正交边界 + YAML schema（skillTree 字段替代 v3.1 techTree）+ RunManager.skillTreeState 接口 + UI 草图 + 7 项不变式核对 |
| [22a-skill-tree-tower](./20-units/22a-skill-tree-tower.md) | ⭐ authoritative · **v3.4 v1.0.0** | **7 塔技能树详设权威**：915 行；蓝本式继承 v3.1 22-tower-tech-tree 节点 ID / 名称 / 形态梯度；箭塔 / 炮塔 / 元素塔（原冰塔）/ 电塔 / 激光塔 / 蝙蝠塔 / 导弹塔；19 RuleHandler；spCost 严格 0/6/10/15 锚点（电塔含 depth=4） |
| [22b-skill-tree-soldier](./20-units/22b-skill-tree-soldier.md) | ⭐ authoritative · **v3.4 v1.0.0** | **6 士兵技能树详设权威**：785 行；v3.4 全新创建；盾卫 / 剑士 / 弓手 / 牧师 / 工程师 / 刺客；统一 2 路径 × 3 节点；17 RuleHandler；强化主动技能 vs 强化普攻分叉模板 |
| [22c-skill-tree-trap](./20-units/22c-skill-tree-trap.md) | ⭐ authoritative · **v3.4 v1.0.0** | **9 陷阱技能树详设权威**：978 行；v3.4 全新创建；9 陷阱 × 2 路径 × 3 节点 = 54 节点；26 RuleHandler；触发机制 vs 区域效果分叉模板 |
| [22d-skill-tree-spell](./20-units/22d-skill-tree-spell.md) | ⭐ authoritative · **v3.4 v1.0.0** | **14 法术卡技能树详设权威**：~1100 行；v3.4 全新创建；弹性 2-4 路径设计；43 路径 / 129 节点；4 维度池（伤害/范围/CD/持续时间）；§9 与 23-skill-buff §7 instanceLevel 正交铁律；23 RuleHandler |
| [22e-skill-tree-production](./20-units/22e-skill-tree-production.md) | ⭐ authoritative · **v3.4 v1.0.0** | **2 生产建筑技能树详设权威**：462 行；v3.4 全新创建；金矿 + 能量水晶 × 2 路径 × 3 节点 = 12 节点；7 RuleHandler；§7 与等级系统 L1/L2/L3 正交铁律 + effects[] 黑名单；严守 v3.0 能量水晶重命名机制不回退 |
| [23-skill-buff](./20-units/23-skill-buff.md) | stable | 技能/Buff 系统、法术卡子分类、`instanceLevel` 通过法术卡递增 |
| [24-combat](./20-units/24-combat.md) | stable · v3.1 audit | 战斗公式骨架、攻速/移速、眩晕/弹道规范 |
| [25-vulnerability](./20-units/25-vulnerability.md) | stable · v3.1 audit | 玩家阵营 buff 保护规则、debuff 优先级、回归测试映射 |
| [26-missile-special](./20-units/26-missile-special.md) | stable | 导弹塔：战略武器、全图射程、地格评分、大范围爆炸 |
| [27-traps-spells-scene](./20-units/27-traps-spells-scene.md) | ⭐ authoritative · **v3.4 v1.1.0** | **三类单位 + 秘境事件池权威**：9 陷阱 + 14 法术 + 11 场景中立完整设计；§5 秘境事件池 v3.4 新增（14 事件 + 35.7% 高风险 + 混合奖励 5 类）；新增 Scene category / trap_path Tile / 3 Debuff |

### `30-ai/` — AI 行为

> **⚠️ v3.4 实现层决策（2026-05-16）**：放弃**行为树作为实现方式**，但 AI 产品需求保留。所有 AI（含士兵四状态机、Boss、高级敌人）改走规则引擎驱动的 `targetSelection` / `attackMode` / `movementMode` 配置路径 + 生命周期 `RuleHandler`。
> 决策溯源：[00-vision/decisions/2026-05-16_drop-behavior-tree.md](./00-vision/decisions/2026-05-16_drop-behavior-tree.md)

| 文档 | 状态 | 简介 |
|---|---|---|
| [30-behavior-tree](./30-ai/30-behavior-tree.md) | 🛑 **deprecated (v3.4)** | ~~BT 引擎、节点接口规格、ScoreSelectTarget 评分节点~~（整体作废，BT 不再使用） |
| [31-soldier-ai](./30-ai/31-soldier-ai.md) | ⚠️ **partial deprecated (v3.4)** | **§1-§5 / §10-§12 需求段保留**（四状态机 / 三圈模型 / 嘲讽 / AOE 主目标 / 升级 = 产品权威）；§6-§7 行为树映射段作废 |

### `40-presentation/` — 视觉表现层

| 文档 | 状态 | 简介 |
|---|---|---|
| [40-ui-ux](./40-presentation/40-ui-ux.md) | ⭐ authoritative · **v3.4 v3.0.0** | **v3.4 UI/UX 单 Run 闭环权威**：14 节 / 509 行；§3 手牌区固定 4 张上限；§6 关间 3 选 1 cross-ref 47；§7 商店整节转交 48；§9 卡池整节删除；§10 Run 结算「干净起跑」（无碎片入账）；§11 主菜单 5 项（删继续 Run/卡池/永久升级）；§13 累计删除清单 8 项 v3.4 新增删除 |
| [41-responsive-layout](./40-presentation/41-responsive-layout.md) | stable | 锚点定位系统、v3.0 9 类锚点（手牌区+关间+商店+秘境+卡池） |
| [42-art-assets](./40-presentation/42-art-assets.md) | stable | 11 层场景分层、复合几何、等级升级视觉、卡牌视觉规范 |
| [43-scene-decoration](./40-presentation/43-scene-decoration.md) | stable · v3.1 audit | 动态环境生物、全屏环境特效、静态装饰物升级 |
| [44-visual-effects](./40-presentation/44-visual-effects.md) | stable · v3.1 audit | PixiJS 图层结构、粒子特效、过渡动画 |
| [45-layer-system](./40-presentation/45-layer-system.md) | stable · v3.1 audit | 6 层垂直空间层级、层级交互规则、渲染排序 |
| [46-audio](./40-presentation/46-audio.md) | stable | 63 个音效（含卡牌/关间/商店/秘境/碎片新增 24 个） |
| [47-level-map-ui](./40-presentation/47-level-map-ui.md) | ⭐ authoritative · v3.3 + v3.4 audit | **关卡路线图 UI 权威**：Mario 风格 9 节点 + 三状态切换 + 关后 3 选 1（商店/秘境/跳过） + 终战特例 + ESC 退出 Run 确认（v3.4 已删除火花碎片显示） |
| [48-shop-redesign-v34](./40-presentation/48-shop-redesign-v34.md) | ⭐ authoritative · **v3.4 新增** | **v3.4 商店 + 技能点资源权威**：两栏 UI / 8 槽（前 4 单位 + 后 4 功能）/ shop_item CardType 拓展 / 4 种功能卡 / RunManager 锁定 |

### `50-data-numerical/` — 数值

| 文档 | 状态 | 简介 |
|---|---|---|
| [50-mda](./50-data-numerical/50-mda.md) | ⭐ authoritative · **v3.4 v1.3.1** | **v3.4 数值真理源**：§14 商店 8 槽（前 4 单位 30/60/120/240G + 后 4 功能卡）+ §15 秘境事件池数值镜像（v3.4 14 事件 + 35.7% 高风险） + §17 技能点 SP 系统（关 N×2 SP + 秘境 5-50 SP + 节点 3-15 SP）+ §13 SP 兑换条款；~~§20 塔科技树~~ 整节删除；其他章节 v3.4 audit 不变 |

### `60-tech/` — 技术与工具

| 文档 | 状态 | 简介 |
|---|---|---|
| [60-architecture](./60-tech/60-architecture.md) | ⭐ authoritative | 系统架构、ECS 规则、规则引擎、Pipeline 8 阶段顺序 |
| [61-save-system](./60-tech/61-save-system.md) | ⭐ authoritative · **v3.4 v3.0.0** | **v3.4 单 Run 闭环存档契约权威**：12 节 / 405 行；存档版本 v3.0.0；§1 SaveData 仅 RunHistory + 累计统计 + 成就 + 设置（删 5 个 meta 字段）；§3 §4 整节删除（永久解锁/碎片/OngoingRun）；§5 流派识别 = 本会话荣誉；§10 累计已删除字段 11 项。旧 v1.0 归档 archive/61-save-system_v1.0_2026.05.15.md |
| [62-faction-refactor](./60-tech/62-faction-refactor.md) | stable | 阵营语义重构：去 isEnemy 双轨、isHostileTo API |
| [63-debug](./60-tech/63-debug.md) | stable · v3.1 audit | 调试系统：跨界面调试入口、一键通关、行为树查看 |
| [64-level-editor](./60-tech/64-level-editor.md) | ⭐ authoritative | **关卡编辑器**：图模型路径、波次/池/难度全字段、一键试玩、Preact UI |

### `archive/` — 归档

不再作为需求来源，仅供回溯：
- 🛑 [10-roguelike-loop_v1.0_2026.05.15](./archive/10-roguelike-loop_v1.0_2026.05.15.md) — v3.0/v3.1/v3.3 时期 10-roguelike-loop v1.0 完整快照（v3.4 第 2 轮 2026-05-15 被 v2.0.0 完全重写）
- 🛑 [61-save-system_v1.0_2026.05.15](./archive/61-save-system_v1.0_2026.05.15.md) — v3.0/v3.1 时期 61-save-system v1.0 完整快照（v3.4 第 2 轮 2026-05-15 被 v3.0.0 完全重写，含 SparkShards / CardCollection / PermanentUpgrades / OngoingRun / CardEntry.techTree 已废弃字段定义）
- [deprecated-units-vine-ballista](./archive/deprecated-units-vine-ballista.md) — 毒藤塔 / 弩炮塔完整原设计
- [deprecated-l3-passives](./archive/deprecated-l3-passives.md) — L3 被动技能表（已被科技树节点取代）
- [塔防游戏单位设计参考](./archive/塔防游戏单位设计参考.md) — 早期单位研究笔记
- [研究总结](./archive/研究总结.md) — 早期总览研究

### `dev-logs/` — 开发日志

按日期归档，记录每日决策与重构详情。

---

## 架构核心思想

1. **一切皆单位** — 塔、士兵、敌人、中立机关本质相同，差别只在配置。
2. **一切皆卡牌** — v3.0 所有可部署内容都是卡牌（单位卡 / 法术卡 / 陷阱卡 / 生产卡）。
3. **配置驱动** — 单位/卡牌静态属性 + 动态行为规则全在配置中。
4. **规则引擎驱动 AI**（v3.4） — 单位行为由配置中的 `targetSelection` / `attackMode` / `movementMode` + 生命周期 `RuleHandler` 共同驱动，统一走规则引擎。~~v3.0/v3.1 时期的行为树方案~~ 已于 2026-05-16 决策放弃（详见 [decisions/2026-05-16_drop-behavior-tree.md](./00-vision/decisions/2026-05-16_drop-behavior-tree.md)）。
5. **三资源轴（v3.4）** — 能量 / 金币 / **技能点** 严格分层、不可互转。Run 结束全部清零，无 meta 积累。
6. **Run 长征** — 8 关连闯 + 终战，水晶 HP 全程继承（无敌 + 秒杀机制）。
7. **数值真理源** — [50-mda](./50-data-numerical/50-mda.md) 是数值唯一权威来源。

---

## 阅读路径建议

**首次了解 v3.4 全貌（推荐）**：
1. 🛑 [v3.4-MAJOR-MIGRATION](./v3.4-MAJOR-MIGRATION.md)（v3.4 形态变更主声明，**第一必读**）
2. ⭐ [48-shop-redesign-v34](./40-presentation/48-shop-redesign-v34.md)（v3.4 商店 + 技能点资源）
3. ⭐ [47-level-map-ui](./40-presentation/47-level-map-ui.md)（关卡推进 UI，v3.4 已 audit）
4. ⭐ [10-roguelike-loop](./10-gameplay/10-roguelike-loop.md)（Run 长征循环，部分章节 v3.4 重构中）

**开发实现 v3.4（第 1-2 轮已完成）**：
1. 🛑 [v3.4-MAJOR-MIGRATION §3](./v3.4-MAJOR-MIGRATION.md#3-迁移轮次划分) 4 轮迁移规划
2. ⭐ [48-shop-redesign-v34 §8](./40-presentation/48-shop-redesign-v34.md#8-与-runmanager-状态机锁定) RunManager 拓展骨架
3. ⭐ [50-mda §14 / §17 / §13.3](./50-data-numerical/50-mda.md)（**v1.3.0 已落地**：商店 8 槽 + 技能点 SP 系统 + SP 兑换条款）
4. ⭐ [10-roguelike-loop v2.0.0](./10-gameplay/10-roguelike-loop.md)（**第 2 轮已落地**：单 Run 闭环 13 节）
5. [42-art-assets](./40-presentation/42-art-assets.md) §13 卡牌视觉（v3.4 shop_item 视觉规范待补）

**特定子系统**：
- 商店（v3.4 权威）：⭐ [48-shop-redesign-v34](./40-presentation/48-shop-redesign-v34.md)
- 秘境：[40-ui-ux](./40-presentation/40-ui-ux.md) + [10-roguelike-loop §3](./10-gameplay/10-roguelike-loop.md)（v3.4 待重构）
- 敌方 AI 智能化：~~[30-behavior-tree §6](./30-ai/30-behavior-tree.md)~~ → **v3.4 已 deprecated**；改由 `targetSelection: threat_score` 配置规则在 AttackSystem 中处理，待 v3.4 第 4 轮代码改造时补充设计文档
- ~~火花碎片经济~~ → **v3.4 已废弃**，改为技能点：[48-shop-redesign-v34 §2](./40-presentation/48-shop-redesign-v34.md#2-资源架构v34-三资源)
- 关卡编辑：⭐ [64-level-editor](./60-tech/64-level-editor.md)

---

## 文档贡献规范

- 新建文档：复制 [`_template.md`](./_template.md) 到对应层目录，填写 frontmatter（必填 `title` / `status` / `authority-for`）。
- 内部链接：同层用 `./文件名.md`，跨层用 `../目标层/文件名.md`。
- 任何重大改动 → 在 `修订历史` 表追加一行 + 同步更新 [dev-logs](./dev-logs/) 当日日志。
- 数值改动 → **只改 50-mda**，其它文档只描述字段语义。
