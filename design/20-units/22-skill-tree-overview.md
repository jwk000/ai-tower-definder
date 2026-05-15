---
title: 技能树系统总览（v3.4）
status: authoritative
version: 1.0.0
last-modified: 2026-05-15
authority-for:
  - skill-tree-overview
  - skill-tree-node-structure
  - skill-tree-path-mutex
  - skill-tree-equip-switch
  - skill-tree-sp-economy-binding
  - skill-tree-yaml-schema
  - skill-tree-ui-sketch
supersedes:
  - 22-tower-tech-tree.md（v3.1，2026-05-15 deprecated；本文档接替"通用骨架"职能，单位详设由 22a-22e 接替）
cross-refs:
  - 10-gameplay/10-roguelike-loop.md      # v2.0.0 单 Run 闭环 / §11 不变式
  - 10-gameplay/11-economy.md             # v3.0.0 §4 技能点 SP 系统
  - 40-presentation/48-shop-redesign-v34.md   # §2 技能点资源 / §9 技能树占位 cross-ref
  - 50-data-numerical/50-mda.md           # §17 技能点 SP 系统（数值真理源）
  - 20-units/23-skill-buff.md             # §7 instanceLevel 法术卡提升边界（与本文档正交）
  - 20-units/22a-skill-tree-tower.md      # 7 塔详设
  - 20-units/22b-skill-tree-soldier.md    # 6 士兵详设
  - 20-units/22c-skill-tree-trap.md       # 9 陷阱详设
  - 20-units/22d-skill-tree-spell.md      # 14 法术参数树
  - 20-units/22e-skill-tree-production.md # 生产建筑详设
  - 60-tech/61-save-system.md             # v3.0.0 RunHistory.archetype（本会话荣誉）
  - v3.4-MAJOR-MIGRATION.md
---

# 技能树系统总览（v3.4）

> **v3.4 形态级新机制权威**：本文档定义全单位技能树的**通用骨架** —— 节点结构、路径互斥规则、装备切换、SP 经济衔接、YAML schema、UI 草图、与 23-skill-buff §7 instanceLevel 机制的边界。
>
> **数值锚点**：所有 SP 单价、Run 流量、节点深度 SP 价格统一来自 [50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点)。本文档**只描述字段语义、机制骨架、设计原则**，不持有任何具体数值。
>
> **单位详设**：本文档**不**描述具体单位的节点效果，请阅读：
> - 7 塔 → [22a-skill-tree-tower](./22a-skill-tree-tower.md)
> - 6 士兵 → [22b-skill-tree-soldier](./22b-skill-tree-soldier.md)
> - 9 陷阱 → [22c-skill-tree-trap](./22c-skill-tree-trap.md)
> - 14 法术 → [22d-skill-tree-spell](./22d-skill-tree-spell.md)
> - 2 生产建筑 → [22e-skill-tree-production](./22e-skill-tree-production.md)

---

## 目录

- [1. 设计目标与核心原则](#1-设计目标与核心原则)
- [2. v3.1 → v3.4 迁移说明](#2-v31--v34-迁移说明)
- [3. 节点结构](#3-节点结构)
- [4. 路径互斥与装备切换](#4-路径互斥与装备切换)
- [5. SP 经济衔接](#5-sp-经济衔接)
- [6. 与 23-skill-buff §7 instanceLevel 的边界](#6-与-23-skill-buff-7-instancelevel-的边界)
- [7. YAML 配置 Schema](#7-yaml-配置-schema)
- [8. RunManager 接口](#8-runmanager-接口)
- [9. UI 草图（关后技能树面板）](#9-ui-草图关后技能树面板)
- [10. 验收清单](#10-验收清单)
- [11. v3.4 不变式核对](#11-v34-不变式核对)
- [12. 影响文档清单](#12-影响文档清单)
- [13. 修订历史](#13-修订历史)

---

## 1. 设计目标与核心原则

### 1.1 设计目标

1. **本 Run 临时持有** —— 技能树**仅本 Run 内有效**，Run 结束清零，与 v3.4「单 Run 闭环」原则完全一致（详 [10-roguelike-loop §11 不变式 INV-04 / INV-08](../10-gameplay/10-roguelike-loop.md)）。
2. **流派成型感** —— 全 Run SP 流量 80-130 SP（[50-mda §17.2.4](../50-data-numerical/50-mda.md#1724-总流量校验)），目标"实质性升级 1-2 个塔的关键节点（点亮 5-15 个节点）"，让玩家**主动选择 1-2 个核心单位深耕**而不是均摊。
3. **路径互斥鼓励策略分叉** —— 同一单位多条路径中，单 Run 仅装备一条，鼓励"明确流派 + 一条路径打到底"。
4. **配置驱动** —— 节点结构、效果差量、SP 单价全部 YAML 化，策划可改不动代码（规则引擎 dispatch handler 沿用 [60-architecture §5.3 规则引擎](../60-tech/60-architecture.md)）。
5. **零 meta 持久化** —— 严禁出现"跨 Run 解锁"概念，所有节点状态在 `RunManager.skillTreeState` 内存中，不写入存档 [61-save-system v3.0.0 §1](../60-tech/61-save-system.md)。

### 1.2 与 v3.1 旧科技树的差异

| 维度 | v3.1 旧科技树（已 deprecated） | v3.4 新技能树 |
|---|---|---|
| 持久化范围 | meta 永久（跨 Run） | **本 Run 临时**（Run 结束清零）|
| 解锁货币 | 火花碎片（已废弃） | **技能点 SP**（详 [50-mda §17](../50-data-numerical/50-mda.md#17-技能点-sp-系统v34-新建替换火花碎片)）|
| 路径重置 | 消耗碎片重置（返还 50%） | **不可重置**（本 Run 临时，无返还需求）|
| 装备切换 | 关外卡池 UI 切换 | **关后节点 UI** 或 **关内单位部署前**切换（详 §4.3）|
| 覆盖单位 | 仅 7 塔 | **6 类 / 38 单位**：7 塔 + 6 士兵 + 9 陷阱 + 14 法术 + 2 生产建筑（含未来扩展）|
| 配置字段 | `techTree.paths[].nodes[].shardCost` | `skillTree.paths[].nodes[].spCost`（语义对齐，字段重命名）|
| 存档字段 | `CardEntry.techTree.unlockedNodes[]` | **不存档**（仅 `RunManager` 内存）|

### 1.3 核心原则

| 原则 | 描述 | 锁定方文档 |
|---|---|---|
| **本 Run 闭环** | 技能树状态在 `RunManager` 内存中，Run 结束清零；存档无 `skillTree` 持久字段 | [61-save-system v3.0.0 §10](../60-tech/61-save-system.md) |
| **SP 单价区间** | depth=1 → 3 SP / depth=2 → 6 SP / depth=3 → 10 SP / depth=4 → 15 SP | [50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点) |
| **路径互斥单装备** | 同单位多路径只能装备 1 条，点亮但不装备的路径不生效 | 本文档 §4 |
| **跨路径独立点亮** | 路径 A 与路径 B 节点解锁互不影响（SP 够都可点亮）| 本文档 §4.2 |
| **装备切换零成本** | 已点亮的两路径之间切换装备：0 SP | 本文档 §4.3 |
| **不可重置** | 已点亮的节点不可"忘记"返还 SP（Run 结束清零）| [50-mda §17.4](../50-data-numerical/50-mda.md#174-sp-消耗路径切换本-run-内) |
| **与 instanceLevel 正交** | 技能树升塔形态 / 数值上限，instanceLevel 升塔临时数值 | 本文档 §6 + [23-skill-buff §7](./23-skill-buff.md#7-instancelevel-法术卡提升机制) |
| **关内禁止点亮** | 关内不出现"购买节点"按钮，仅关后/关间 SP 消耗 | 本文档 §4.4 |

---

## 2. v3.1 → v3.4 迁移说明

### 2.1 字段映射

| v3.1 字段 | v3.4 字段 | 迁移方式 |
|---|---|---|
| `techTree.paths[]` | `skillTree.paths[]` | 重命名（YAML 字段全替）|
| `nodes[].shardCost` | `nodes[].spCost` | 重命名（语义对齐：N SP 而非 N 碎片）|
| `nodes[].id` / `name` / `effects[]` | 保持不变 | 节点设计完整继承 |
| `CardEntry.techTree.unlockedNodes[]` | **删除** | v3.4 不持久化技能树状态 |
| `CardEntry.techTree.equippedPath` | **删除** | 同上 |
| `RunManager.skillTreeState.activeNodes` | 新建 | v3.4 内存状态（详 §8）|
| `RunManager.skillTreeState.equippedPaths` | 新建 | 同上 |

### 2.2 单位详设映射

| 文档 | v3.1 蓝本 | v3.4 改造方式 |
|---|---|---|
| [22a 塔](./22a-skill-tree-tower.md) | 22-tower-tech-tree §4（7 塔 13 路径）| **蓝本式重写**：节点设计全继承，仅字段名变 + SP 单价对齐 50-mda §17.3 |
| [22b 士兵](./22b-skill-tree-soldier.md) | 无（v3.1 士兵无升级机制）| **从零设计**：6 士兵 × 2 路径 × 2-3 节点 |
| [22c 陷阱](./22c-skill-tree-trap.md) | 无（v3.1 陷阱无升级机制）| **从零设计**：9 陷阱 × 2 路径方向（耐久/范围）|
| [22d 法术](./22d-skill-tree-spell.md) | 无（v3.1 法术 instanceLevel 仅由"精炼术"提升）| **从零设计**：14 法术 × 4 参数路径（伤害/范围/CD/持续）|
| [22e 生产](./22e-skill-tree-production.md) | 无 | **从零设计**：2 建筑 × 2 路径（产出速率/种类）|

### 2.3 旧文档归档策略

- [22-tower-tech-tree](./22-tower-tech-tree.md) 文档**保留作 deprecated**（已加顶部废弃声明 + 4 个 authority-for 失效列出），仅供回溯。
- v3.4 新开发禁止参考 22-tower-tech-tree，所有塔技能树问题查 [22a](./22a-skill-tree-tower.md)。

---

## 3. 节点结构

### 3.1 节点是技能树的最小单位

每个节点包含：
- `id`（字符串，全局唯一）
- `name`（中文显示名）
- `pathId`（所属路径 ID）
- `depth`（路径上第几个节点，1-4）
- `spCost`（点亮花费的 SP，由 50-mda §17.3 锚点决定）
- `effects[]`（节点效果数组，描述"相对于上一深度新增/覆盖的差量"，由规则引擎 dispatch handler 实现）
- `prerequisites`（前置节点 ID，必须同路径 depth N-1 节点已点亮）

### 3.2 节点深度与 SP 单价（50-mda §17.3 锚点）

| 节点深度（路径上第 N 个节点）| SP 单价 | 设计意图 |
|---|---|---|
| **depth=1**（路径起点）| 3 SP | 路径关键性能解锁（"差异化进场"）|
| **depth=2**（路径进阶）| 6 SP | 路径强化（"流派成型"）|
| **depth=3**（路径高阶 / 部分单位终点）| 10 SP | 路径深化（"成型流派的明显跃迁"）|
| **depth=4**（部分单位终极节点）| 15 SP | 终极爆点（仅 4 节点路径，如电塔闪电塔，"流派满级独有"）|

> **单塔单路径满级（3 节点）SP 成本** = 3 + 6 + 10 = **19 SP**
> **电塔 4 节点路径满级 SP 成本** = 3 + 6 + 10 + 15 = **34 SP**
> **同塔两路径全满（不切换装备）SP 成本** = 19 × 2 = **38 SP（3 节点路径）** 或 19 + 34 = **53 SP（一 3 节点 + 一 4 节点）**

### 3.3 节点效果（effects 数组）

每个节点 `effects[]` 是规则引擎 RuleHandler 引用数组，按声明顺序应用。

```yaml
effects:
  - rule: add_projectile_count       # RuleHandler 名（[60-architecture §5.3](../60-tech/60-architecture.md)）
    value: 1                         # handler 参数
  - rule: mul_attack_interval
    value: 0.4
```

**effects 是"差量"语义**：节点 N 的 effects 只描述"相对于节点 N-1 新增/覆盖什么"，便于策划读懂"这个节点比前一个强在哪"。

**累积叠加由配置加载器在装备路径时全节点合并**为单位实际属性（详 §4.5）。

### 3.4 节点效果类型枚举

按效果类型对 RuleHandler 分类（具体注册在 `src/core/RuleHandlers.ts`）：

| 类型 | 例子 RuleHandler | 应用场景 |
|---|---|---|
| **数值修饰** | `add_atk` / `mul_attack_interval` / `add_range` / `add_hp_max` | 数值加成（最常见）|
| **形态切换** | `set_form_id` / `set_element_type` / `set_visual` | 改变单位形态/外观/元素属性（元素塔特有）|
| **能力新增** | `add_projectile_count` / `add_burning_on_hit` / `add_chain_jump` | 新增主动/被动能力 |
| **特殊机制** | `trigger_screen_lightning_with_cd` / `add_focus_charge` / `unlock_path_block` | 单单位特化机制 |

> 完整 RuleHandler 注册表见 `src/core/RuleHandlers.ts`，22a-22e 各单位详设引用具体 handler 名。

### 3.5 节点效果的局限（边界）

- 节点效果**只能修改单位静态属性 / 注入行为规则**，不能修改全局规则（如金币奖励倍率、能量上限）—— 这些是 [23-skill-buff §3 法术](./23-skill-buff.md#3-法术spell-子类) 全局规则改写法术的职责。
- 节点效果**不能跨单位生效**（不能 A 塔的节点 buff B 塔），跨单位增益由法术卡 + 23-skill-buff Aura 机制实现。
- 节点效果**不能触发胜负条件**（如不能直接降水晶 HP）—— 胜负判定走 [10-roguelike-loop §5 水晶机制](../10-gameplay/10-roguelike-loop.md)。

---

## 4. 路径互斥与装备切换

### 4.1 路径概念

- **路径（path）**：一条由若干节点串联的升级线，节点必须按 `depth=1 → 2 → 3 → (4)` 线性解锁。
- **每个单位 1-3 条路径**，路径之间设计上互斥（每路径代表一种"流派"，玩家选其一）。

| 单位类型 | 典型路径数 | 路径深度 |
|---|---|---|
| 塔（22a）| **2 条 / 多重路径**（元素塔 3 条，电塔 1 条 4 节点）| 大多 3 节点，电塔 4 节点 |
| 士兵（22b）| **2 条**（攻击型 / 辅助型）| 2-3 节点 |
| 陷阱（22c）| **2 条**（耐久型 / 范围型）| 2-3 节点 |
| 法术（22d）| **4 条**（伤害 / 范围 / CD / 持续时间）| 2 节点 |
| 生产（22e）| **2 条**（速率 / 种类）| 2 节点 |

### 4.2 跨路径独立点亮规则

- 路径 A 与路径 B 的节点解锁**互不影响**。
- SP 充足时，玩家可"两条路径都点满"（前提是 SP 够付 19 SP × 2 = 38 SP，可能性低但允许）。
- 已点亮的两路径之间**自由切换装备**，无 SP 成本。

### 4.3 装备切换规则

- **装备**：一个单位在某时刻**仅装备一条路径**（即"哪条路径生效"）；未装备的路径节点虽点亮但不生效。
- **切换时机**：
  - **关后节点界面**（详 [47-level-map-ui §3](../40-presentation/47-level-map-ui.md)）—— 主要切换场景，玩家可统一调整本 Run 所有单位的装备路径
  - **关内单位部署前**（手牌区拖出单位卡到战场前）—— 玩家可在拖出前快捷切换当前卡的装备路径（次要场景）
- **切换成本**：**0 SP**（已点亮的路径之间自由切换）。
- **切换限制**：
  - 关内单位**已部署后**不可切换装备（避免战斗中突变形态破坏战术决策）
  - 切换装备**不重置 instanceLevel**（法术卡施加的临时数值层数保留，与装备路径正交，详 §6）

### 4.4 关内禁止点亮 / 切换装备

- 关内**不出现"购买节点 SP"按钮 / "切换装备路径"快捷键**。
- 玩家在关内仅可"放置单位 / 移除单位 / 施放法术"。
- 此规则保证关内战术节奏不被 meta 决策打断，符合 v3.4「分层清晰」原则。

### 4.5 effects 合并算法

装备某条路径时，配置加载器合并该路径**所有已点亮节点**的 `effects[]`，按以下顺序应用到单位实例：

```
单位基础属性 (config/units/*.yaml baseStats)
  → 装备路径 depth=1 节点 effects[]
  → 装备路径 depth=2 节点 effects[]（仅已点亮）
  → 装备路径 depth=3 节点 effects[]（仅已点亮）
  → 装备路径 depth=4 节点 effects[]（仅已点亮，部分单位有）
  → instanceLevel 法术卡效果（独立层，详 §6）
  → 战场 Buff 临时效果（独立层，[23-skill-buff §4](./23-skill-buff.md)）
```

合并算法以 RuleHandler 类型分类：
- `add_*` 类（加法）—— 直接累加
- `mul_*` 类（乘法）—— 直接乘积（叠加遵循 [25-vulnerability §2 优先级表](./25-vulnerability.md)）
- `set_*` 类（覆盖）—— 后写覆盖先写
- `add_capability_*` 类（能力新增）—— 标志位 OR

---

## 5. SP 经济衔接

### 5.1 SP 来源（[50-mda §17.2](../50-data-numerical/50-mda.md#172-sp-获取流量) 锚点）

| 来源 | 单 Run 流量 | 备注 |
|---|---|---|
| 关卡通关 SP | 2 + 4 + 6 + 8 + 10 + 12 + 14 + 16 + 20 = **92 SP** | 关 N 通关给 N × 2 SP，终战给 20 SP（突出最终奖励）|
| 秘境节点 SP 奖励 | **0-50 SP/事件**（5/15/30/50 4 档 + 20%/35%/40%/5% 权重）| 单 Run 秘境 ≈ 2-4 次，期望约 **63 SP（满秘境路径）**|
| 商店金币兑换 | 单商店上限 3 SP（50 G/1 SP）| 单 Run 4-8 次商店，理论上限 24 SP，实际 5-15 SP |

**单 Run SP 流量目标**：80-130 SP（[50-mda §17.2.4](../50-data-numerical/50-mda.md#1724-总流量校验)）

### 5.2 SP 消耗：技能树节点（本文档）+ 商店功能卡（[48 §3](../40-presentation/48-shop-redesign-v34.md)）

| 消耗端 | 单 Run 期望 SP 流量 | 优先级 |
|---|---|---|
| **本文档：技能树节点点亮** | 50-80 SP（满 1 塔关键节点 + 半 1 塔）| **高**（主流派成型）|
| 48 §3 "技能点限量包" | 0-20 SP（机会型）| 低（仅当玩家有冗余 SP）|

> 设计意图：90% 以上 SP 应流向"技能树节点点亮"，确保 v3.4 SP 系统的核心价值（流派成型）落地。

### 5.3 SP 不可转出（[50-mda §13.4](../50-data-numerical/50-mda.md#134-资源转化规则汇总) 锚点）

- SP ⇏ 金币（不可逆兑换）
- SP ⇏ 能量（v3.4 INV-08 跨货币锁）
- SP ⇏ 火花碎片（v3.4 火花碎片已废弃，词汇不存在）
- SP ⇏ HP（无 SP→HP 路径）

唯一转入：**金币 → SP**（商店槽 5 "技能点卡"，50 G/1 SP，单商店上限 3 SP，[50-mda §13.3](../50-data-numerical/50-mda.md#133-跨货币兑换条款v34-新建)）。

---

## 6. 与 23-skill-buff §7 instanceLevel 的边界

### 6.1 两个机制的正交关系

v3.4 单位升级有**两套独立机制**，各管各的，互不干扰：

| 机制 | 升级对象 | 升级层级数 | 升级来源 | 持久性 | 数值/形态 |
|---|---|---|---|---|---|
| **技能树（本文档）** | 单位形态 / 能力上限 / 静态属性 | **节点（路径上 1-4 个）** | SP 消耗 | **本 Run 临时**（Run 结束清零）| 形态切换 + 数值上限 |
| **instanceLevel（[23-skill-buff §7](./23-skill-buff.md#7-instancelevel-法术卡提升机制)）** | 单位**实例**临时数值 | **3 层上限**（[23 §7.2](./23-skill-buff.md)）| 法术卡（仅"精炼术"refining）| **本局战斗**（塔死亡 / 关卡结束清零）| 纯数值 + 30% / 层 |

### 6.2 正交关键点（**铁律**）

| 边界规则 | 描述 |
|---|---|
| **技能树不提升 instanceLevel** | 节点 effects[] 不允许出现 `add_instance_level` handler |
| **instanceLevel 不点亮节点** | 法术卡（精炼术）只能 `instanceLevel += 1`，不能解锁/装备技能树节点 |
| **触发优先级** | 数值合并顺序：技能树 effects → instanceLevel 数值层 → 战场 Buff（[23 §4](./23-skill-buff.md)）|
| **持久化层级** | 技能树：RunManager 内存（本 Run 临时，但跨关保留）；instanceLevel：单位实例（本局战斗，关结束清零）|
| **切换装备影响范围** | 切换技能树装备 → 重新合并 effects，**保留** instanceLevel 数值层；instanceLevel 清零 → **不影响**技能树节点状态 |

### 6.3 玩家心智模型

| 玩家想做 | 走哪条路径 |
|---|---|
| 给箭塔升 3 重射击形态 | **技能树**（22a 箭塔路径 1 depth=3 节点）|
| 给单个箭塔实例临时 +90% 伤害（本局救场）| **instanceLevel**（[23 §7](./23-skill-buff.md) refining 法术 ×3）|
| 给全场所有塔 +30% 攻速 | **战场 Buff**（[23 §4](./23-skill-buff.md) 全局规则法术或 Aura）|

> 这三套机制设计目的是**让玩家在不同决策时点投入不同资源**：长期规划用 SP 走技能树；本局战术高峰用法术能量走 instanceLevel；瞬时救场用法术能量走战场 Buff。

---

## 7. YAML 配置 Schema

### 7.1 单位 YAML 增加 `skillTree` 字段

旧 v3.1 `techTree` 字段彻底废弃。新 `skillTree` 字段 schema：

```yaml
arrow_tower:
  id: arrow_tower
  name: 箭塔
  category: tower
  baseStats:
    hp: 100
    atk: 20
    range: 200
    attackInterval: 1.0
  skillTree:
    paths:
      - id: multi_shot
        name: 多重射击
        nodes:
          - id: arrow_basic
            name: 普通箭塔
            depth: 1                 # 路径起点
            spCost: 0                # 默认拥有（depth=1 起点为 0 SP 还是 3 SP？详 §7.3）
            effects: []
          - id: arrow_double
            name: 双重箭塔
            depth: 2
            spCost: 6                # 50-mda §17.3 锚点：depth=2 → 6 SP
            prerequisites: [arrow_basic]
            effects:
              - rule: add_projectile_count
                value: 1
          - id: arrow_triple
            name: 三重箭塔
            depth: 3
            spCost: 10               # 50-mda §17.3 锚点：depth=3 → 10 SP
            prerequisites: [arrow_double]
            effects:
              - rule: add_projectile_count
                value: 2
      - id: rapid_fire
        name: 高频火力
        nodes:
          - id: arrow_crossbow
            name: 连弩箭塔
            depth: 2
            spCost: 6
            prerequisites: [arrow_basic]
            effects:
              - rule: mul_attack_interval
                value: 0.4
              - rule: mul_atk
                value: 0.5
          - id: arrow_crossbow_fire
            name: 连弩火箭塔
            depth: 3
            spCost: 10
            prerequisites: [arrow_crossbow]
            effects:
              - rule: add_burning_on_hit
                duration: 2.0
                tickRatio: 0.2
```

### 7.2 关键字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `skillTree.paths[]` | 数组 | 是 | 该单位所有路径 |
| `paths[].id` | string | 是 | 路径全局唯一 ID |
| `paths[].name` | string | 是 | 中文显示名 |
| `paths[].nodes[]` | 数组 | 是 | 该路径所有节点 |
| `nodes[].id` | string | 是 | 节点全局唯一 ID |
| `nodes[].name` | string | 是 | 中文显示名 |
| `nodes[].depth` | int | 是 | 路径上深度（1-4）|
| `nodes[].spCost` | int | 是 | 点亮花费 SP（50-mda §17.3 锚点）|
| `nodes[].prerequisites` | string[] | 否 | 前置节点 ID（depth=1 起点无前置）|
| `nodes[].effects` | object[] | 否 | RuleHandler 引用数组（差量语义，详 §3.3）|

### 7.3 depth=1 起点 SP 单价为 0 还是 3？

**决策：depth=1 起点 spCost = 0**（路径起点自动获得，单位卡入手即可用）。

- 玩家从手牌打出单位 → 该单位**默认拥有所有路径的 depth=1 节点形态**（如箭塔默认是"普通箭塔"形态）
- 玩家从 depth=1 起 SP 选择**走哪条路径的 depth=2**（路径分叉点）
- depth=1 设计为 0 SP 的好处：玩家不必为"激活基础形态"付费，SP 全部投入"真正流派分化"

> 此决策与 [50-mda §17.3 锚点表](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点) 中"depth=1 → 3 SP"看似冲突，但 50-mda §17.3 描述的是**实际购买的节点深度区间**，路径起点 depth=1 形态作为单位卡入手默认形态不算"购买"，spCost = 0。

### 7.4 路径互斥的 YAML 声明（可选）

如果某些路径在设计上**完全互斥**（如元素塔的冰/火/毒），可在 path 级别声明 `mutex` 标签辅助 UI 显示：

```yaml
- id: ice_path
  name: 冰系
  mutex: elemental    # 同 mutex 组的路径在 UI 上明确显示"互斥"
  nodes: [...]
- id: fire_path
  name: 火系
  mutex: elemental
  nodes: [...]
```

> `mutex` 字段**仅影响 UI 显示**，不影响实际点亮规则（"路径互斥单装备" §4.1 才是机制层）。多数单位路径不需要 `mutex` 标签。

---

## 8. RunManager 接口

### 8.1 RunManager.skillTreeState 数据结构

```typescript
interface RunManager {
  skillPoints: number              // 当前 SP 余额（[48 §2](../40-presentation/48-shop-redesign-v34.md)）
  skillTreeState: SkillTreeState   // 本 Run 技能树状态（v3.4 新增）
  // ... 其他字段
}

interface SkillTreeState {
  // key = unitCardId（如 'arrow_tower'）
  units: Record<string, UnitSkillTreeState>
}

interface UnitSkillTreeState {
  activeNodes: Set<string>         // 已点亮节点 ID 集合（跨所有路径）
  equippedPath: string | null      // 当前装备的路径 ID（null = 仅起点 depth=1 默认形态）
}
```

### 8.2 核心接口

```typescript
class RunManager {
  // 点亮节点（消耗 SP）
  // 返回 false 表示失败：SP 不足 / 节点不存在 / 前置未点亮
  activateNode(unitCardId: string, nodeId: string): boolean

  // 切换装备路径（0 SP）
  // 返回 false 表示失败：路径不存在 / 路径上无任何节点已点亮 / 关内已部署该单位
  equipPath(unitCardId: string, pathId: string | null): boolean

  // 查询单位当前生效的 effects（合并算法详 §4.5）
  resolveUnitEffects(unitCardId: string): Effect[]

  // Run 结束清零（[10-roguelike-loop §6](../10-gameplay/10-roguelike-loop.md)）
  resetSkillTreeState(): void
}
```

### 8.3 边界检查

`activateNode(unitCardId, nodeId)` 的失败条件：

| 失败原因 | 错误码 |
|---|---|
| SP 不足 | `INSUFFICIENT_SP` |
| 节点 ID 不存在于该单位 skillTree 配置 | `NODE_NOT_FOUND` |
| 前置节点未点亮（depth=2 但 depth=1 未亮，或 depth=3 但 depth=2 未亮）| `PREREQUISITE_NOT_MET` |
| 节点已点亮 | `NODE_ALREADY_ACTIVE` |

`equipPath(unitCardId, pathId)` 的失败条件：

| 失败原因 | 错误码 |
|---|---|
| 路径 ID 不存在 | `PATH_NOT_FOUND` |
| 路径上无任何节点已点亮（深度 ≥ 2 的节点未亮）| `PATH_NOT_ACTIVATABLE` |
| 关内已部署该单位实例（不可热切换装备）| `UNIT_DEPLOYED` |
| 已装备同路径（无需切换）| `ALREADY_EQUIPPED` |

---

## 9. UI 草图（关后技能树面板）

### 9.1 入口

玩家关后从 **47-level-map-ui §3 关后 3 选 1 节点**（商店 / 秘境 / 跳过）进入下一个节点前，**也可独立访问技能树面板**（一般通过关后路线图屏幕上的"技能树"独立按钮，与 3 选 1 路径平行）。

技能树面板**不消耗节点机会**（独立于商店/秘境/跳过），玩家可自由进入、规划、退出。

### 9.2 面板布局

```
┌─────────────────────────────────────────────────────────────────┐
│  技能树            SP: 23                          关 4 通关后  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ 我方单位列表（左侧 30%）──┐  ┌─ 选中单位技能树（右侧 70%）─┐│
│  │                            │  │                              ││
│  │  🏹 箭塔                    │  │  箭塔 · 已装备：多重射击     ││
│  │  💣 炮塔                    │  │                              ││
│  │  🧊 元素塔                  │  │  路径 1：多重射击 (已装备 ✓) ││
│  │  ⚡ 电塔                    │  │  ●━━●━━○                     ││
│  │  🔫 激光塔                  │  │  普通  双重  三重(6 SP)      ││
│  │  🦇 蝙蝠塔                  │  │                              ││
│  │  🚀 导弹塔                  │  │  路径 2：高频火力            ││
│  │  ──────                    │  │  ●━━○━━○                     ││
│  │  🛡 盾兵                    │  │  普通  连弩(6 SP) 火连弩    ││
│  │  ⚔ 剑士                    │  │                              ││
│  │  ... (28 单位)             │  │  ─────                       ││
│  │                            │  │  [切换装备到路径 2]          ││
│  └────────────────────────────┘  └──────────────────────────────┘│
│                                                                 │
│  ┌─ 底部状态栏 ─────────────────────────────────────────────────┐│
│  │  本 Run 累计点亮：5 节点  / 累计消耗 SP：14 / 装备路径数：3 ││
│  │  [关闭]                                                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 视觉规范

| 元素 | 视觉处理 |
|---|---|
| 已点亮节点 | 实心圆（路径色饱和） |
| 未点亮但可点亮节点 | 空心圆（路径色淡）+ SP 单价显示 |
| 未点亮且不可点亮节点（前置未亮 / SP 不足）| 灰色禁用圆 |
| 已装备路径 | 路径头部加 "✓" 标记 + 连接线高亮 |
| 互斥路径标签 | 多路径头部加 "⚡互斥" 标签（仅 path.mutex 不为空时显示）|

### 9.4 交互流程

1. 进入面板 → 左栏单位列表（按 6 大类分组：塔 / 士兵 / 陷阱 / 法术 / 生产 / 其他）
2. 选中某单位 → 右栏显示该单位完整技能树（多路径并排）
3. 点击节点 → 弹出节点详情（名称 / 效果 / SP 单价 / 前置）+ "点亮"按钮（若可点亮 + SP 够）
4. 点击"点亮"→ 扣 SP / 节点高亮 / 自动更新合并 effects 预览（若该路径已装备）
5. 点击"切换装备到路径 X"按钮 → 切换装备（0 SP）
6. 关闭面板 → 返回 3 选 1 路径

### 9.5 SP 预算可视化

底部状态栏显示**本 Run SP 流量进度**：
- 当前 SP / 预期剩余可获 SP（基于剩余关卡 + 平均秘境/商店 SP）
- 鼓励玩家"评估剩余资源 → 决定继续点节点还是留 SP 给商店"

---

## 10. 验收清单

### 10.1 机制层

- [ ] 节点 `depth` 字段 1-4，`spCost` 严格遵循 50-mda §17.3 锚点（3/6/10/15）
- [ ] depth=1 起点 spCost = 0（单位入手默认形态）
- [ ] `prerequisites` 校验通过：depth=N 节点要求同路径 depth=N-1 节点已点亮
- [ ] 路径互斥：单单位同时装备路径数 ≤ 1
- [ ] 跨路径独立点亮：路径 A 节点解锁不影响路径 B 节点解锁
- [ ] 切换装备：0 SP 成本，关内已部署单位禁止切换
- [ ] Run 结束清零：`RunManager.resetSkillTreeState()` 在 [10-roguelike-loop §6.2](../10-gameplay/10-roguelike-loop.md) 结算时调用

### 10.2 与 instanceLevel 边界

- [ ] 节点 effects[] 不出现 `add_instance_level` handler
- [ ] 装备切换不影响 instanceLevel 数值层（保留）
- [ ] instanceLevel 清零（关卡结束）不影响技能树节点状态

### 10.3 数据持久化

- [ ] [61-save-system v3.0.0 §1](../60-tech/61-save-system.md) `SaveData` 无 `skillTree` 字段（确认不持久化）
- [ ] `RunManager.skillTreeState` 仅内存状态，Run 结束清零

### 10.4 UI

- [ ] 技能树面板独立入口（关后路线图按钮，非 3 选 1 路径之一）
- [ ] 节点视觉三态：已点亮（实心）/ 可点亮（空心）/ 不可点亮（灰色）
- [ ] 已装备路径头部 "✓" 标记
- [ ] 底部 SP 流量进度可视化

### 10.5 配置

- [ ] 所有单位 YAML 含 `skillTree` 字段，无 v3.1 `techTree` 残留
- [ ] effects[] 仅引用已注册 RuleHandler（运行时校验）
- [ ] 路径 `mutex` 标签可选，不影响实际点亮规则

---

## 11. v3.4 不变式核对

| 不变式 | 来源 | 本文档核对 |
|---|---|---|
| INV-01 单 Run 闭环 | [10-roguelike-loop §11](../10-gameplay/10-roguelike-loop.md) | ✅ 技能树状态本 Run 临时，Run 结束清零 |
| INV-03 起始 SP = 0 | [10-roguelike-loop §11](../10-gameplay/10-roguelike-loop.md) | ✅ 每 Run 从 0 SP 起步，无 meta 累计 |
| INV-04 Run 不可中断 | [10-roguelike-loop §11](../10-gameplay/10-roguelike-loop.md) | ✅ 技能树状态在 RunManager 内存，无持久化中断点 |
| INV-08 跨货币锁 | [10-roguelike-loop §11](../10-gameplay/10-roguelike-loop.md) | ✅ SP 不可转出，技能树节点不可转换为其他资源 |
| 50-mda §17.3 SP 单价 | [50-mda](../50-data-numerical/50-mda.md) | ✅ depth 1-4 = 0/3/6/10/15（depth=1 起点 0，purchased 1-4 = 3/6/10/15）|
| 23-skill-buff §7 instanceLevel 边界 | [23-skill-buff](./23-skill-buff.md) | ✅ §6 明确正交，effects[] 禁止 add_instance_level |
| 火花碎片词汇禁用 | [v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) | ✅ 全文不含"火花碎片"/"shard"（仅作为 v3.1 历史对照）|

---

## 12. 影响文档清单

### 12.1 接替关系

| 旧文档 | 接替方式 |
|---|---|
| [22-tower-tech-tree](./22-tower-tech-tree.md) v3.1 | 本文档（通用骨架）+ [22a](./22a-skill-tree-tower.md)（塔详设）共同接替 |

### 12.2 引用本文档的文档

| 文档 | 引用本文档的章节 |
|---|---|
| [48-shop-redesign-v34 §9](../40-presentation/48-shop-redesign-v34.md) | spendSkillPoints 接口与节点 ID 字符串占位（v3.4 第 3 轮已落地，待第 4 轮代码改造）|
| [50-mda §17.3](../50-data-numerical/50-mda.md) | SP 单价锚点 |
| [50-mda §17.5](../50-data-numerical/50-mda.md) | SP 与商店优先级权衡 |
| [10-roguelike-loop §6.2](../10-gameplay/10-roguelike-loop.md) | Run 结算清零接口 `RunManager.resetSkillTreeState()` |
| [61-save-system v3.0.0 §1](../60-tech/61-save-system.md) | SkillTreeState 不进存档 |
| [40-ui-ux v3.0.0 §6](../40-presentation/40-ui-ux.md) | 关后 3 选 1 路径外独立技能树入口 |
| [47-level-map-ui §3](../40-presentation/47-level-map-ui.md) | 关后路线图 UI 集成技能树按钮 |

### 12.3 单位详设文档（22a-22e）

详 §1.1 + §2.2 / [README.md `20-units/` 目录](../README.md)。

---

## 13. 修订历史

| 版本 | 日期 | 修订者 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮创建**：技能树通用骨架。13 章覆盖：设计目标 / v3.1→v3.4 迁移 / 节点结构（depth=1-4 + SP 单价 0/3/6/10/15）/ 路径互斥单装备 / SP 经济衔接 / 与 23-skill-buff §7 instanceLevel 正交边界 / YAML schema（skillTree 字段替代 v3.1 techTree）/ RunManager.skillTreeState 接口 / UI 草图 + 视觉规范 + 交互流程 / 验收清单 / v3.4 7 项不变式核对 / 影响文档清单。接替 v3.1 22-tower-tech-tree 的"通用骨架"职能。 |
