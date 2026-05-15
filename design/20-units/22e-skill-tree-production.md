---
title: 生产建筑技能树详设（v3.4）
status: authoritative
version: 1.0.0
last-modified: 2026-05-15
authority-for:
  - production-building-skill-tree
  - production-building-path-nodes
  - production-building-skill-tree-yaml
cross-refs:
  - 20-units/22-skill-tree-overview.md
  - 20-units/22a-skill-tree-tower.md
  - 20-units/22b-skill-tree-soldier.md
  - 20-units/21-unit-roster.md
  - 10-gameplay/11-economy.md
  - 50-data-numerical/50-mda.md
  - 60-tech/60-architecture.md
  - v3.4-MAJOR-MIGRATION.md
---

# 生产建筑技能树详设（v3.4）

> ⭐ **本文档是 2 个生产建筑（`gold_mine` / `energy_crystal`）技能树的唯一权威详设**。所有节点 ID / 路径 ID / SP 单价 / RuleHandler 引用以本文档为准；通用骨架见 [22-skill-tree-overview](./22-skill-tree-overview.md)。

> 🆕 **本文档为 v3.4 全新创建（无 v3.1 蓝本继承）**。v3.1 22-tower-tech-tree 仅覆盖塔单位，生产建筑在 v3.1 阶段无关外科技树；v3.4 引入 SP 系统后，**生产建筑首次拥有技能树**，路径设计围绕"产出强度 vs 产出模式切换"两条主线，与玩家"经济流"策略深度绑定。

---

## 目录

- [1. 文档定位与读法](#1-文档定位与读法)
- [2. 通用约定（与 22a/22b/22c/22d 一致）](#2-通用约定与-22a22b22c22d-一致)
- [3. 两建筑技能树清单（概览）](#3-两建筑技能树清单概览)
- [4. 金矿 · `gold_mine`](#4-金矿--gold_mine)
- [5. 能量水晶 · `energy_crystal`](#5-能量水晶--energy_crystal)
- [6. 两建筑 SP 总需求与流派覆盖](#6-两建筑-sp-总需求与流派覆盖)
- [7. 与现有等级系统（L1/L2/L3）的边界](#7-与现有等级系统l1l2l3的边界)
- [8. RuleHandler 引用清单](#8-rulehandler-引用清单)
- [9. v3.4 不变式核对](#9-v34-不变式核对)
- [10. 修订历史](#10-修订历史)

---

## 1. 文档定位与读法

### 1.1 本文档负责什么

本文档**只**负责生产建筑（`category: Building`）的技能树详设，每建筑一节，内容包括：

- 建筑定位（一句话功能描述 + 经济角色）
- 路径表（每条路径的节点梯度、节点能力、形态名）
- YAML 配置示例
- 节点 effects[] 的 RuleHandler 引用说明
- 与建筑等级系统（L1/L2/L3）的边界划分

### 1.2 本文档**不**负责什么

| 不负责的内容 | 权威文档 |
|---|---|
| 节点结构 / 路径互斥 / SP 单价锚点 | [22-skill-tree-overview](./22-skill-tree-overview.md) |
| SP 数值锚点 | [50-mda §17](../50-data-numerical/50-mda.md#17-技能点-sp-系统v34-新增) |
| RuleHandler 注册 | `src/core/RuleHandlers.ts` + [60-architecture §5.3](../60-tech/60-architecture.md) |
| 建筑基础属性（HP / 占位 / 卡稀有度）| [21-unit-roster §5.1](./21-unit-roster.md#51-生产建筑building) |
| 金矿产出数值表（L1/L2/L3 = 2.5/5/8 G/s）| [50-mda §7.2](../50-data-numerical/50-mda.md#72-金矿) |
| 能量水晶 v3.0 重命名背景与机制 | [21-unit-roster §5.1 备注](./21-unit-roster.md#51-生产建筑building) |
| 经济流向（金币→技能点兑换 / SP 流量）| [11-economy §3.5 / §4](../10-gameplay/11-economy.md) + [50-mda §17.2](../50-data-numerical/50-mda.md) |

### 1.3 设计理念差异（vs 塔 / 士兵 / 陷阱 / 法术技能树）

| 维度 | 塔（22a）| 士兵（22b）| 陷阱（22c）| 法术（22d）| **生产建筑（本文档）** |
|---|---|---|---|---|---|
| 节点效果方向 | 形态切换 + 弹道机制 | 主动技能 + 普攻强化 | 触发机制 + 区域效果 | 4 维度数值（伤害/范围/CD/持续）| **产出强度 + 产出模式切换** |
| 路径数量 | 1-3 条 | 2 条 | 2 条 | 弹性 2-4 条 | **统一 2 条** |
| 节点深度 | 1-4 节点 | 1-3 节点 | 1-3 节点 | 1-3 节点 | **统一 1-3 节点**（无 depth=4）|
| 与"等级系统"关系 | 无重叠 | 无重叠 | 无重叠 | 无重叠（与 instanceLevel 正交）| **必须正交**（与 L1/L2/L3 升级机制不冲突，详 §7）|
| Run 内重要性 | 主输出来源 | 辅助强化 | 战场清场 | 法术枪手 | **经济流玩法核心**（无经济流派则可不投）|

### 1.4 阅读建议

1. 先读 [22-skill-tree-overview](./22-skill-tree-overview.md) 通用骨架。
2. 数值校验：所有 `spCost` 必须命中 [50-mda §17.3 锚点](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点)。
3. 等级边界：所有 path effects[] **禁止修改建筑等级**（L1/L2/L3），等级升级走金币购买路径，详 §7。

---

## 2. 通用约定（与 22a/22b/22c/22d 一致）

### 2.1 节点深度与 SP 单价（[50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点) 锚点）

| 节点深度 | spCost | 说明 |
|---|---|---|
| **depth=1**（路径起点）| **0 SP** | 单位卡入手默认形态 |
| **depth=2**（路径进阶）| **6 SP** | 路径关键流派成型 |
| **depth=3**（路径终点）| **10 SP** | 流派满级 |

> ⚠️ **生产建筑全部不含 depth=4 节点**（与士兵 / 陷阱 / 法术保持一致）。本文档全部 `spCost` 严格命中 0/6/10 锚点。

### 2.2 effects[] 写法（差量语义）

每个节点 `effects[]` 仅描述相对上一节点的差量变化。配置加载器在装备路径时合并所有已点亮节点的 effects[]（与 22a-22d 一致）。

### 2.3 单建筑单路径 SP 总需求

- 单路径满级 = 0 + 6 + 10 = **16 SP**
- 双路径全满 = **32 SP**
- 2 建筑全部单路径满级 = 2 × 16 = **32 SP**
- 2 建筑全部双路径全满 = 2 × 32 = **64 SP**（在单 Run 100 SP 中位流量内，但通常不会全投建筑）

### 2.4 与等级系统（L1/L2/L3）的边界

每个生产建筑都有金币购买的关内等级系统（详 [50-mda §7.2/§7.3](../50-data-numerical/50-mda.md)）：

| 建筑 | L1 造价 | L2 升级费 | L3 升级费 |
|---|---|---|---|
| `gold_mine` | 85G | 55G | 100G |
| `energy_crystal` | 详 11-economy / 50-mda | — | — |

**铁律**：本文档技能树节点 **只修改建筑的产出参数与模式**，不修改等级数值（不会让 L1 金矿"实际表现 L2"），也不替代金币升级（不会让玩家"跳过 L2 直接 L3"）。详 §7。

---

## 3. 两建筑技能树清单（概览）

| 建筑 ID | 中文名 | 经济角色 | 路径数 | 单路径满级 SP | 双路径全满 SP |
|---|---|---|---|---|---|
| `gold_mine` | 金矿 | 持续产金（关内） | 2 | 16 SP | 32 SP |
| `energy_crystal` | 能量水晶 | 波间能量爆发 / 能量上限 | 2 | 16 SP | 32 SP |

### 3.1 共同设计模板

每建筑两条路径采用以下分叉模板：

- **路径 A · 强度方向**：增大产出数值 / 提速 / 延长生效时间
- **路径 B · 模式方向**：增加辅助产出 / 改变触发条件 / 扩展生效维度

具体路径设计因建筑产出机制不同而调整：金矿是"持续 G/s 产出"，路径 A = 提速、路径 B = 命中事件附加金币；能量水晶是"波间充能 / 能量上限"，路径 A = 单次充能加量、路径 B = 改为永久上限 / 持续回流。

---

## 4. 金矿 · `gold_mine`

**建筑定位**：持续产金；关内每秒产出固定金币（L1 = 2.5 G/s，L2 = 5 G/s，L3 = 8 G/s，详 [50-mda §7.2](../50-data-numerical/50-mda.md#72-金矿)）。技能树**只调整产出参数**，不改造等级。

### 4.1 节点图

```
路径 1 · 高产矿脉  [depth=1] 普通金矿 ●────[depth=2] 高产金矿 ○ 6SP────[depth=3] 富矿脉 ○ 10SP
路径 2 · 战利金脉  [depth=1] 普通金矿 ●────[depth=2] 战利金矿 ○ 6SP────[depth=3] 财富诅咒 ○ 10SP
```

### 4.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 高产矿脉** | 普通金矿（默认 G/s 产出）| 高产金矿（产出速率 +30%）| 富矿脉（产出速率 +30% 累加 → 共 +60% + 每 10s 额外大量金币 20G）|
| **2 · 战利金脉** | 普通金矿 | 战利金矿（80px 内敌人死亡时本金矿额外 +2G）| 财富诅咒（死亡金币 +2G 累加 → +4G + 本关结束时按本关累计产出额外 +20% 返还）|

### 4.3 YAML 配置

```yaml
gold_mine:
  id: gold_mine
  name: 金矿
  category: Building
  skillTree:
    paths:
      - id: rich_vein
        name: 高产矿脉
        nodes:
          - id: gold_basic
            name: 普通金矿
            depth: 1
            spCost: 0
            effects: []
          - id: gold_productive
            name: 高产金矿
            depth: 2
            spCost: 6
            prerequisites: [gold_basic]
            effects:
              - rule: mul_production_rate
                resource: gold
                value: 1.3                      # G/s 产出 +30%
          - id: gold_rich_vein
            name: 富矿脉
            depth: 3
            spCost: 10
            prerequisites: [gold_productive]
            effects:
              - rule: mul_production_rate
                resource: gold
                value: 1.23                     # 累加 → 共 1.6×
              - rule: add_periodic_bonus
                resource: gold
                period: 10
                amount: 20                      # 每 10s 额外 +20G
      - id: spoils_vein
        name: 战利金脉
        nodes:
          - id: gold_basic_sv
            name: 普通金矿
            depth: 1
            spCost: 0
            effects: []
          - id: gold_spoils
            name: 战利金矿
            depth: 2
            spCost: 6
            prerequisites: [gold_basic_sv]
            effects:
              - rule: add_kill_bonus_nearby
                radius: 80
                resource: gold
                amount: 2                       # 80px 内敌人死亡 +2G
          - id: gold_curse_of_wealth
            name: 财富诅咒
            depth: 3
            spCost: 10
            prerequisites: [gold_spoils]
            effects:
              - rule: add_kill_bonus_nearby
                radius: 80
                resource: gold
                amount: 2                       # 累加 → +4G
              - rule: add_level_end_bonus
                resource: gold
                ratio: 0.2                      # 关结束时累计产出 +20% 返还
```

### 4.4 设计说明

- **路径 1（高产矿脉）**：纯粹的产出加成路径。`mul_production_rate` 是差量倍率合并，depth=2 + depth=3 两个 1.3× 与 1.23× 累乘 ≈ 1.6×（接近 L1→L2 升级的产出梯度，但成本是 16 SP 而非 55G）。`add_periodic_bonus` 是 v3.4 首次引入的"定时事件类"建筑节点。
- **路径 2（战利金脉）**：把金矿绑定到战场击杀事件，**鼓励"金矿放在前线"的进攻性布局**（而非传统经济流的"后方角落布雷"）。`add_level_end_bonus` 让玩家最后阶段"卖矿"风险大幅降低（关结束才返还 20%）。
- **不引入 depth=4**：金矿的"经济强度"已由路径 1 高产矿脉的累乘 + 路径 2 战利金脉的关结束返还覆盖；无需"终极爆点"。
- **与金矿等级系统的关系**：路径 1 的 `mul_production_rate` 是**百分比倍率**，不论 L1/L2/L3 都生效。例如 L3 金矿（8 G/s）+ 路径 1 满级（×1.6）= 12.8 G/s（不会突破 L3 上限到 L4）。详 §7。

---

## 5. 能量水晶 · `energy_crystal`

**建筑定位**：波间能量爆发（v3.0 重命名自 `energy_tower`，旧版"每秒持续产能"已废弃）。当前机制为「**下波开始 +3 E**」或「**+1 能量上限**」（二者择一，由该建筑实例的等级 / 状态决定）。技能树**只增强这两个机制**，不引入"每秒持续产能"（避免回退到 v3.0 前的旧设计）。

### 5.1 节点图

```
路径 1 · 充能爆发  [depth=1] 普通水晶 ●────[depth=2] 高能水晶 ○ 6SP────[depth=3] 超载水晶 ○ 10SP
路径 2 · 容量扩展  [depth=1] 普通水晶 ●────[depth=2] 大容量水晶 ○ 6SP────[depth=3] 共鸣水晶 ○ 10SP
```

### 5.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 充能爆发** | 普通水晶（默认下波 +3 E）| 高能水晶（下波开始 +5 E）| 超载水晶（下波开始 +7 E + 当波内每死亡 5 个敌人额外 +1 E）|
| **2 · 容量扩展** | 普通水晶 | 大容量水晶（能量上限 +1 → +2）| 共鸣水晶（能量上限 +2 累加 → +3 + 关内每波结束时把本水晶提供的上限增量短暂回流为即时能量）|

### 5.3 YAML 配置

```yaml
energy_crystal:
  id: energy_crystal
  name: 能量水晶
  category: Building
  skillTree:
    paths:
      - id: surge_burst
        name: 充能爆发
        nodes:
          - id: crystal_basic
            name: 普通水晶
            depth: 1
            spCost: 0
            effects: []
          - id: crystal_high_yield
            name: 高能水晶
            depth: 2
            spCost: 6
            prerequisites: [crystal_basic]
            effects:
              - rule: add_wave_start_energy
                value: 2                        # 下波 +3 默认 → +5 总（差量 +2）
          - id: crystal_overload
            name: 超载水晶
            depth: 3
            spCost: 10
            prerequisites: [crystal_high_yield]
            effects:
              - rule: add_wave_start_energy
                value: 2                        # 累加 → +7 总
              - rule: add_kill_bonus_global
                period: 5                       # 每死亡 5 个敌人触发一次
                resource: energy
                amount: 1
      - id: capacity_expansion
        name: 容量扩展
        nodes:
          - id: crystal_basic_ce
            name: 普通水晶
            depth: 1
            spCost: 0
            effects: []
          - id: crystal_large_capacity
            name: 大容量水晶
            depth: 2
            spCost: 6
            prerequisites: [crystal_basic_ce]
            effects:
              - rule: add_energy_cap
                value: 1                        # +1 → +2 总（差量 +1，默认水晶 +1）
          - id: crystal_resonance
            name: 共鸣水晶
            depth: 3
            spCost: 10
            prerequisites: [crystal_large_capacity]
            effects:
              - rule: add_energy_cap
                value: 1                        # 累加 → +3 总
              - rule: add_wave_end_energy_reflow
                ratio: 1.0                      # 波结束时按本水晶提供的上限增量等额转化为即时能量
```

### 5.4 设计说明

- **路径 1（充能爆发）**：把"下波 +3 E"的爆发量翻倍至 +7 E，并在 depth=3 引入"杀敌联动充能"（与法术能量收集机制呼应，详 [11-economy §2.3](../10-gameplay/11-economy.md)）。适合"高能量法术高频投放"流派。
- **路径 2（容量扩展）**：把"+1 能量上限"扩到 +3，深度节点把能量上限增量"波结束时转化为即时能量"（一次性回流），是"上限 + 即时"的双重收益。适合"波间储能 + 关键时刻爆释"流派。
- **路径间显著互斥**：路径 1 走"瞬时爆发"，路径 2 走"上限永驻"，两者机制完全不重叠，玩家必须根据玩法选择（与 22d 法术分路径的"维度分叉"设计哲学一致）。
- **不引入"每秒持续产能"**：本路径设计严格遵守 v3.0 能量水晶机制重设，**杜绝任何 `mul_production_rate energy` 类 RuleHandler 引用**（避免回退到 v3.0 前的"能量塔"旧设计）。

---

## 6. 两建筑 SP 总需求与流派覆盖

### 6.1 各建筑 SP 总需求矩阵

| 建筑 | 路径 1 单满 | 路径 2 单满 | 双路径全满 |
|---|---|---|---|
| `gold_mine` | 16 SP | 16 SP | 32 SP |
| `energy_crystal` | 16 SP | 16 SP | 32 SP |

**统一格式**：2 建筑均为 2 路径 × 3 节点（depth=1/2/3 = 0/6/10 SP）。

### 6.2 单 Run SP 预算策略示范（基于 100 SP 中位流量）

| 策略 | SP 分配 | 建筑投入 | 适合玩法 |
|---|---|---|---|
| **纯塔流** | 0 SP 投建筑 | 0 路径 | 全部 SP 给塔/士兵；金矿等级 + 默认水晶足够 |
| **轻经济流** | 16 SP 投金矿路径 1 | 1 路径满级 | 金矿提速，剩 84 SP 投塔 / 士兵 |
| **重经济流** | 16 SP 金矿 + 16 SP 水晶 = 32 SP | 2 个 1 路径满级 | 金币产能 + 能量爆发同步加强（剩 68 SP 投塔）|
| **法术流配套** | 16 SP 水晶路径 1 | 充能爆发 | 把波间能量从 3 拉到 7，配合高能量法术（如 meteor 40E）|
| **极端经济流** | 32 SP 金矿双满 | 金矿全开 | 战利金脉 + 富矿脉双开，深度收益（前线放矿）|

### 6.3 设计意图

- **生产建筑不是 SP 主投方向**：本文档每建筑 32 SP 上限（双路径全满），相对 22a 塔技能树（普遍 32 SP 双满，元素塔 48 SP / 电塔 31 SP）来说投入收益偏低。
- **设计预期**：玩家单 Run 内对建筑的 SP 投入约 0-32 SP（0-2 条路径），具体取决于是否打"经济流"或"法术流"。
- **建筑技能树主要价值**：让"经济流"和"法术流"成为可行策略而不被"纯塔流"压倒（vs v3.4 之前金矿/水晶只有金币升级的"线性强度"）。

---

## 7. 与现有等级系统（L1/L2/L3）的边界

### 7.1 双层系统并存

生产建筑同时拥有**两层系统**，必须严格正交：

| 系统 | 资源 | 时机 | 作用 |
|---|---|---|---|
| **等级系统**（L1/L2/L3）| 金币（关内） | 关内随时（部署阶段或战斗中）| 跃迁式提升基础产出（如金矿 L1→L2 从 2.5 → 5 G/s）|
| **技能树**（本文档）| 技能点 SP（关外）| 关外（卡池界面 / 关后节点）| 倍率或附加效果（如金矿路径 1 满级 ×1.6 倍率）|

### 7.2 正交关键点（铁律）

| 边界 | 允许 | 禁止 |
|---|---|---|
| 修改基础产出 | 技能树倍率（如 ×1.6 `mul_production_rate`）| ❌ 技能树修改 `level` 字段或基础 `productionRate` 字段 |
| 等级跃迁 | 金币购买 L1→L2→L3 | ❌ 技能树自动升级 / "跳过等级"节点 |
| 等级与路径共存 | L3 金矿 + 路径 1 满级 = 8 × 1.6 = 12.8 G/s | ❌ 路径节点检查"当前等级"作为条件（避免耦合）|
| 等级解锁路径 | 不绑定（所有等级都可应用路径效果）| ❌ "L3 金矿才能点亮 depth=3" |

### 7.3 effects[] 黑名单（v3.4 强约束）

**生产建筑技能树 effects[] 严禁使用以下规则**：

- ❌ `set_level` —— 强制设置建筑等级
- ❌ `add_level` —— 等级 +N
- ❌ `mul_level_cost` —— 升级费率倍率（这归 22d 法术 / 商店功能卡管）
- ❌ `set_production_rate` —— 直接设置 G/s 值（基础值是 50-mda 权威）
- ❌ `enable_continuous_energy_production` —— 让 energy_crystal 回退到旧版"每秒持续产能"

### 7.4 与 instanceLevel 的关系

生产建筑当前**不通过法术卡获得 instanceLevel 强化**（法术卡 instanceLevel 机制详 [23-skill-buff §7](./23-skill-buff.md)）。如未来要引入"建筑卡 refining"机制，应在 22-overview §6 单独章节扩展，不直接修改本文档。

---

## 8. RuleHandler 引用清单

本文档共引用以下 RuleHandler（注册在 `src/core/RuleHandlers.ts`，详 [60-architecture §5.3](../60-tech/60-architecture.md)）：

### 8.1 产出强度类（v3.4 新增）

| RuleHandler | 用途 | 引用建筑（节点）|
|---|---|---|
| `mul_production_rate` | 持续产出倍率（按资源类型）| 金矿（高产 / 富矿脉）|
| `add_periodic_bonus` | 定时事件额外产出 | 金矿（富矿脉）|

### 8.2 能量水晶专用（v3.4 新增）

| RuleHandler | 用途 | 引用建筑（节点）|
|---|---|---|
| `add_wave_start_energy` | 下波开始时额外能量（差量）| 能量水晶（高能 / 超载）|
| `add_energy_cap` | 能量上限增量 | 能量水晶（大容量 / 共鸣）|
| `add_wave_end_energy_reflow` | 波结束时把上限增量转化为即时能量 | 能量水晶（共鸣）|

### 8.3 击杀联动类（与 22a/22b 共享 / 部分新增）

| RuleHandler | 用途 | 引用建筑（节点）|
|---|---|---|
| `add_kill_bonus_nearby` | 局部范围内击杀附加资源 | 金矿（战利 / 财富诅咒）|
| `add_kill_bonus_global` | 全图击杀计数附加资源 | 能量水晶（超载）|

### 8.4 关卡周期类（v3.4 新增）

| RuleHandler | 用途 | 引用建筑（节点）|
|---|---|---|
| `add_level_end_bonus` | 关结束时按累计产出比例返还 | 金矿（财富诅咒）|

**新增 RuleHandler 数量**：本文档共引用 7 个 RuleHandler，全部为 v3.4 建筑专用新增（与 22a-22d 无共享）。

### 8.5 RuleHandler 实现要点（指引 src 实现，非本文档权威）

- `mul_production_rate` 必须按资源类型 dispatch（gold / energy）：建筑组件持有 `productionResource` 字段，加成只作用于该资源。
- `add_wave_start_energy` 在 WaveSystem 进入 `WaveBreak → 下一波 Battle 起始`时触发，差量值与默认水晶 +3 E 累加。
- `add_energy_cap` 修改的是 EconomySystem 内 `energyCap` 上限值，**注意：水晶被摧毁时上限增量应回收**（与 add_aura 类似的生命周期清理）。
- `add_kill_bonus_nearby` 与 `add_kill_bonus_global` 都挂在 LifecycleSystem 的 `onDeath` 事件上，差别仅在范围判定。
- `add_level_end_bonus` 在 GamePhase 切到 `Victory` 时触发，按本建筑本关累计产出 × ratio 一次性发放（应避免重复发放）。
- `add_wave_end_energy_reflow` 在 WaveSystem 切到 `WaveBreak` 时触发，把本建筑当前提供的能量上限增量（不含其他来源）作为即时能量入账。

---

## 9. v3.4 不变式核对

| 不变式 | 权威文档 | 本文档执行情况 |
|---|---|---|
| 火花碎片词汇彻底废弃 | [v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) | ✅ 全文 0 处「火花碎片」「shard」「shardCost」「碎片」|
| meta 永久积累机制取消 | [11-economy §4](../10-gameplay/11-economy.md) | ✅ 全文 0 处「永久解锁」「跨 Run」「meta 进度」|
| 数值真理源唯一 | [50-mda](../50-data-numerical/50-mda.md) | ✅ 所有 `spCost` 严格命中 §17.3 锚点（0/6/10），不出现锚点外数值 |
| 节点深度 SP 单价锚点 | [50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点) | ✅ 2 建筑 4 路径 12 节点 depth=1/2/3 = 0/6/10 命中（4×0 + 4×6 + 4×10）|
| 单位卡入手默认形态 | [22-skill-tree-overview §7.3](./22-skill-tree-overview.md#73-depth1-起点-sp-单价为-0-还是-3) | ✅ 全部 depth=1 节点 spCost=0 |
| 路径互斥单装备 | [22-skill-tree-overview §4](./22-skill-tree-overview.md#4-路径互斥与装备切换) | ✅ 全文未引入"多路径同时装备"机制 |
| 关内禁止点亮 / 切换装备 | [22-skill-tree-overview §4.4](./22-skill-tree-overview.md#44-关内禁止点亮--切换装备) | ✅ 全文 0 处"关内升级"提及 |
| 与 instanceLevel 正交 | [22-skill-tree-overview §6.2](./22-skill-tree-overview.md#62-正交关键点铁律) | ✅ 全文 effects[] 0 处 `add_instance_level` 引用 |
| 与等级系统 L1/L2/L3 正交 | 本文档 §7 | ✅ effects[] 0 处 `set_level` / `add_level` / `set_production_rate` 等违禁规则 |
| 能量水晶 v3.0 重命名机制不回退 | [21-unit-roster §5.1](./21-unit-roster.md#51-生产建筑building) | ✅ 全文 0 处 `enable_continuous_energy_production` 或"每秒持续产能"类设计 |

---

## 10. 修订历史

| 版本 | 日期 | 类型 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮第 5 份创建**：生产建筑技能树详设权威。10 章覆盖：文档定位 / 通用约定 / 两建筑技能树清单 / 2 建筑详设（金矿 / 能量水晶）/ SP 总需求矩阵 / 与等级系统 L1/L2/L3 边界（§7 双层正交铁律 + effects[] 黑名单）/ RuleHandler 引用清单（7 个新增）/ v3.4 10 项不变式核对（含建筑专用 2 项）。**v3.4 全新创建（无 v3.1 蓝本）**：v3.1 阶段生产建筑无关外科技树，v3.4 引入 SP 系统后建筑首次拥有技能树。统一模板：每建筑 2 路径 × 3 节点（depth=1/2/3 = 0/6/10 SP），路径分叉模板为"强化产出强度 vs 切换产出模式"。金矿路径 = 高产矿脉 + 战利金脉；能量水晶路径 = 充能爆发 + 容量扩展（严守 v3.0 重命名机制，不回退到"每秒持续产能"）。 |
