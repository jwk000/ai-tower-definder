# Tower Defender — 设计文档索引

> 版本: v3.3 · 卡牌 + Roguelike 长征版 · 塔科技树 · 陷阱/法术/中立完整化 · 关卡路线图 UI
> 最后整理: 2026-05-15（v3.3 关卡路线图 + 关后 3 选 1 面板 + ESC 退出 Run 确认）

---

## ⚠️ 数值真理源（必读）

**[50-mda（MDA 驱动的全局数值设计）](./50-data-numerical/50-mda.md) 是全部游戏数值的唯一权威来源。**

- 修改数值时**只改 50-mda**，然后据此同步代码（`src/data/gameData.ts`）与测试。
- 其它文档只描述字段语义/公式骨架/规则边界，**不再持有数值表**。
- 若发现某文档残留数值与 50-mda 冲突，**视为 BUG，必须删除残留并以 50-mda 为准**。
- 提 PR 时若改了数值，PR 标题以 `[数值]` 前缀。

---

## ⚡ v3.0 / v3.1 形态变更声明（必读）

**v3.0 将塔防游戏改造为「卡牌 + Roguelike 长征」形态；v3.1 进一步把塔升级迁至关外科技树。**

- **核心权威文档**（⭐ = authoritative）：
  - ⭐ [10-roguelike-loop](./10-gameplay/10-roguelike-loop.md) — Run 长征循环、三资源、手牌区、关间节点、火花碎片 meta
  - ⭐ [22-tower-tech-tree](./20-units/22-tower-tech-tree.md) — 塔升级关外科技树（路径互斥 + 节点线性解锁）
  - ⭐ [50-mda](./50-data-numerical/50-mda.md) — 全局数值真理源
  - ⭐ [64-level-editor](./60-tech/64-level-editor.md) — 关卡编辑器（DEV-only，YAML schema 权威）
  - ⭐ [60-architecture](./60-tech/60-architecture.md) — 系统架构、ECS 规则、规则引擎、Pipeline 顺序

- **三资源**：能量 E（关内出卡）/ 金币 G（关间商店/秘境）/ 火花碎片（meta 永久解锁）；严格分层、不可互转（除 Run 结束金币 → 碎片）。
- **Run 长征**：8 关连闯 + 终战 Boss，水晶 HP 全程继承（无敌 + 秒杀机制），死亡从第 1 关重开。
- **塔升级**：v3.1 起改为**关外卡池科技树**，关内禁升级；废弃毒藤塔 / 弩炮塔（→ [archive/](./archive/deprecated-units-vine-ballista.md)）；`ice_tower` → `elemental_tower`（默认冰形态，路径覆盖冰/火/毒）。
- **存档版本**：v2.0.0（游戏未发布，无迁移代码）。

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
| [10-roguelike-loop](./10-gameplay/10-roguelike-loop.md) | ⭐ authoritative | **v3.0 单一权威**：卡牌化 + Roguelike 长征 14 章完整设计 |
| [11-economy](./10-gameplay/11-economy.md) | stable | 三资源分层规则、关内能量回收、关间金币消费 |
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
| [22-tower-tech-tree](./20-units/22-tower-tech-tree.md) | ⭐ authoritative | **v3.1 塔升级权威**：7 塔节点、路径互斥、碎片成本、YAML/存档结构 |
| [23-skill-buff](./20-units/23-skill-buff.md) | stable | 技能/Buff 系统、法术卡子分类、`instanceLevel` 通过法术卡递增 |
| [24-combat](./20-units/24-combat.md) | stable · v3.1 audit | 战斗公式骨架、攻速/移速、眩晕/弹道规范 |
| [25-vulnerability](./20-units/25-vulnerability.md) | stable · v3.1 audit | 玩家阵营 buff 保护规则、debuff 优先级、回归测试映射 |
| [26-missile-special](./20-units/26-missile-special.md) | stable | 导弹塔：战略武器、全图射程、地格评分、大范围爆炸 |
| [27-traps-spells-scene](./20-units/27-traps-spells-scene.md) | ⭐ authoritative · v3.2 | **三类单位权威**：9 陷阱 + 14 法术 + 11 场景中立完整设计；新增 Scene category / trap_path Tile / 3 Debuff |

### `30-ai/` — AI 行为

| 文档 | 状态 | 简介 |
|---|---|---|
| [30-behavior-tree](./30-ai/30-behavior-tree.md) | stable | BT 接管所有单位 AI、ScoreSelectTarget 评分节点 |
| [31-soldier-ai](./30-ai/31-soldier-ai.md) | stable · v3.1 audit | 士兵 AI 四状态机、三圈模型；§12 升级机制延后（M5） |

### `40-presentation/` — 视觉表现层

| 文档 | 状态 | 简介 |
|---|---|---|
| [40-ui-ux](./40-presentation/40-ui-ux.md) | stable | 手牌区、关间面板、商店、秘境、卡池、Run 结算、主菜单 |
| [41-responsive-layout](./40-presentation/41-responsive-layout.md) | stable | 锚点定位系统、v3.0 9 类锚点（手牌区+关间+商店+秘境+卡池） |
| [42-art-assets](./40-presentation/42-art-assets.md) | stable | 11 层场景分层、复合几何、等级升级视觉、卡牌视觉规范 |
| [43-scene-decoration](./40-presentation/43-scene-decoration.md) | stable · v3.1 audit | 动态环境生物、全屏环境特效、静态装饰物升级 |
| [44-visual-effects](./40-presentation/44-visual-effects.md) | stable · v3.1 audit | PixiJS 图层结构、粒子特效、过渡动画 |
| [45-layer-system](./40-presentation/45-layer-system.md) | stable · v3.1 audit | 6 层垂直空间层级、层级交互规则、渲染排序 |
| [46-audio](./40-presentation/46-audio.md) | stable | 63 个音效（含卡牌/关间/商店/秘境/碎片新增 24 个） |
| [47-level-map-ui](./40-presentation/47-level-map-ui.md) | ⭐ authoritative · v3.3 | **关卡路线图 UI 权威**：Mario 风格 9 节点 + 三状态切换 + 关后 3 选 1（商店/秘境/跳过） + 终战特例 + ESC 退出 Run 确认 |

### `50-data-numerical/` — 数值

| 文档 | 状态 | 简介 |
|---|---|---|
| [50-mda](./50-data-numerical/50-mda.md) | ⭐ authoritative | **数值真理源**：能量表、商品价、难度乘数、卡解锁价、碎片价、科技节点数值 |

### `60-tech/` — 技术与工具

| 文档 | 状态 | 简介 |
|---|---|---|
| [60-architecture](./60-tech/60-architecture.md) | ⭐ authoritative | 系统架构、ECS 规则、规则引擎、Pipeline 8 阶段顺序 |
| [61-save-system](./60-tech/61-save-system.md) | stable | 存档 v2.0.0、CardCollection、OngoingRun、CardEntry.techTree |
| [62-faction-refactor](./60-tech/62-faction-refactor.md) | stable | 阵营语义重构：去 isEnemy 双轨、isHostileTo API |
| [63-debug](./60-tech/63-debug.md) | stable · v3.1 audit | 调试系统：跨界面调试入口、一键通关、行为树查看 |
| [64-level-editor](./60-tech/64-level-editor.md) | ⭐ authoritative | **关卡编辑器**：图模型路径、波次/池/难度全字段、一键试玩、Preact UI |

### `archive/` — 归档

不再作为需求来源，仅供回溯：
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
4. **行为树驱动 AI** — 单位行为统一由行为树配置驱动（[30-behavior-tree](./30-ai/30-behavior-tree.md)）。
5. **三资源轴** — 能量 / 金币 / 火花碎片 严格分层、不可互转。
6. **Run 长征** — 8 关连闯 + 终战，水晶 HP 全程继承（无敌 + 秒杀机制）。
7. **数值真理源** — [50-mda](./50-data-numerical/50-mda.md) 是数值唯一权威来源。

---

## 阅读路径建议

**首次了解 v3.1 全貌**：
1. ⭐ [10-roguelike-loop](./10-gameplay/10-roguelike-loop.md)（权威方案，必读）
2. [00-game-overview](./00-vision/00-game-overview.md)（认知锚点）
3. [40-ui-ux](./40-presentation/40-ui-ux.md)（界面流程）
4. ⭐ [22-tower-tech-tree](./20-units/22-tower-tech-tree.md)（塔升级新模型）

**开发实现 v3.1**：
1. ⭐ [60-architecture](./60-tech/60-architecture.md) §7 分阶段实施
2. [61-save-system](./60-tech/61-save-system.md) 数据结构
3. [20-unit-system](./20-units/20-unit-system.md) §8 + [21-unit-roster §7](./20-units/21-unit-roster.md) 卡牌定义
4. ⭐ [50-mda](./50-data-numerical/50-mda.md) §12-§20 v3.0/v3.1 数值
5. [42-art-assets](./40-presentation/42-art-assets.md) §13 卡牌视觉

**特定子系统**：
- 商店 / 秘境：[40-ui-ux](./40-presentation/40-ui-ux.md) + [10-roguelike-loop §3](./10-gameplay/10-roguelike-loop.md)
- 敌方 AI 智能化：[30-behavior-tree §6](./30-ai/30-behavior-tree.md)
- 火花碎片经济：[11-economy](./10-gameplay/11-economy.md) + [50-mda §17](./50-data-numerical/50-mda.md)
- 关卡编辑：⭐ [64-level-editor](./60-tech/64-level-editor.md)

---

## 文档贡献规范

- 新建文档：复制 [`_template.md`](./_template.md) 到对应层目录，填写 frontmatter（必填 `title` / `status` / `authority-for`）。
- 内部链接：同层用 `./文件名.md`，跨层用 `../目标层/文件名.md`。
- 任何重大改动 → 在 `修订历史` 表追加一行 + 同步更新 [dev-logs](./dev-logs/) 当日日志。
- 数值改动 → **只改 50-mda**，其它文档只描述字段语义。
