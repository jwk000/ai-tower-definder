---
title: 塔技能树详设（v3.4）
status: authoritative
version: 1.0.0
last-modified: 2026-05-15
authority-for:
  - tower-skill-tree
  - tower-path-nodes
  - tower-skill-tree-yaml
cross-refs:
  - 20-units/22-skill-tree-overview.md
  - 20-units/21-unit-roster.md
  - 20-units/26-missile-special.md
  - 50-data-numerical/50-mda.md
  - 60-tech/60-architecture.md
  - 40-presentation/48-shop-redesign-v34.md
  - v3.4-MAJOR-MIGRATION.md
supersedes:
  - 20-units/22-tower-tech-tree.md（v3.1，已 deprecated）
---

# 塔技能树详设（v3.4）

> ⭐ **本文档是 7 个塔单位技能树的唯一权威详设**。所有节点 ID / 路径 ID / SP 单价 / RuleHandler 引用以本文档为准；通用骨架（路径互斥、SP 经济、装备切换、YAML schema）见 [22-skill-tree-overview](./22-skill-tree-overview.md)。

> 🛑 **本文档蓝本式继承 v3.1 [22-tower-tech-tree §4](./22-tower-tech-tree.md#4-七塔完整科技树) 七塔节点设计**，节点 ID / 名称 / 形态梯度 / 路径机制 / 能力描述完整保留；仅做 v3.4 字段重命名（`shardCost`→`spCost`、`techTree`→`skillTree`、`unlockedNodes`→`runActiveNodes`）与 SP 单价锚点对齐（[50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点)）。

---

## 目录

- [1. 文档定位与读法](#1-文档定位与读法)
- [2. 通用约定](#2-通用约定)
- [3. 七塔技能树清单（概览）](#3-七塔技能树清单概览)
- [4. 箭塔 · `arrow_tower`](#4-箭塔--arrow_tower)
- [5. 炮塔 · `cannon_tower`](#5-炮塔--cannon_tower)
- [6. 元素塔 · `elemental_tower`（原冰塔）](#6-元素塔--elemental_tower原冰塔)
- [7. 电塔 · `lightning_tower`](#7-电塔--lightning_tower)
- [8. 激光塔 · `laser_tower`](#8-激光塔--laser_tower)
- [9. 蝙蝠塔 · `bat_tower`](#9-蝙蝠塔--bat_tower)
- [10. 导弹塔 · `missile_tower`](#10-导弹塔--missile_tower)
- [11. 七塔 SP 总需求与流派覆盖](#11-七塔-sp-总需求与流派覆盖)
- [12. RuleHandler 引用清单](#12-rulehandler-引用清单)
- [13. v3.4 不变式核对](#13-v34-不变式核对)
- [14. 修订历史](#14-修订历史)

---

## 1. 文档定位与读法

### 1.1 本文档负责什么

本文档**只**负责塔单位（`category: tower`）的技能树详设，每塔一节，内容包括：

- 塔定位（一句话功能描述）
- 路径表（每条路径的节点梯度、节点能力、形态名）
- YAML 配置示例（完整 `skillTree` 字段示例，可直接 copy 到 `config/units/towers.yaml`）
- 节点 effects[] 的 RuleHandler 引用说明
- 路径切换的特殊机制（如元素塔切元素属性、导弹塔同坐标多发射）

### 1.2 本文档**不**负责什么

| 不负责的内容 | 权威文档 |
|---|---|
| 节点结构 / 路径互斥 / SP 单价锚点 / 关内禁止点亮 | [22-skill-tree-overview](./22-skill-tree-overview.md)（通用骨架）|
| SP 数值 / 锚点表 / SP 流量 | [50-mda §17](../50-data-numerical/50-mda.md#17-技能点-sp-系统v34-新增) |
| RuleHandler 注册表 / 实现 | `src/core/RuleHandlers.ts` + [60-architecture §5.3](../60-tech/60-architecture.md) |
| 塔单位基础属性（HP / ATK / range / interval） | [21-unit-roster §2](./21-unit-roster.md) |
| 塔实例临时强化（instanceLevel）| [23-skill-buff §7](./23-skill-buff.md) |
| 导弹塔地格评分逻辑 | [26-missile-special](./26-missile-special.md) |
| 蝙蝠塔天气依赖逻辑 | [21-unit-roster §2.2 蝙蝠塔](./21-unit-roster.md#蝙蝠塔bat_tower天气依赖) + [14-weather](../10-gameplay/14-weather.md) |

### 1.3 阅读建议

1. **第一次读**：先读 [22-skill-tree-overview](./22-skill-tree-overview.md) 通用骨架（§3 节点结构 + §4 路径互斥 + §7 YAML schema）→ 再读本文档某塔节点设计。
2. **数值校验**：所有 `spCost` 必须命中 [50-mda §17.3 锚点表](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点)，否则视为 BUG。
3. **配置落地**：本文档 YAML 示例可直接 copy 到 `config/units/towers.yaml`，但具体单位基础属性（baseStats）以 [21-unit-roster](./21-unit-roster.md) 为准。

---

## 2. 通用约定

### 2.1 节点深度与 SP 单价（[50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点) 锚点）

| 节点深度 | spCost | 说明 |
|---|---|---|
| **depth=1**（路径起点） | **0 SP** | 单位卡入手默认形态，无需购买（详 [22-overview §7.3](./22-skill-tree-overview.md#73-depth1-起点-sp-单价为-0-还是-3)）|
| **depth=2**（路径进阶） | **6 SP** | 路径关键流派成型 |
| **depth=3**（路径高阶 / 大部分塔的终点）| **10 SP** | 流派深化 |
| **depth=4**（仅电塔闪电塔有）| **15 SP** | 终极爆点（panic button 类）|

> ⚠️ **本文档全部 `spCost` 严格命中以上锚点**。若某节点设计上需要"中间价位"（如 4 SP / 8 SP），视为锚点表 BUG，应先改 50-mda §17.3 再回填本文档，**严禁本文档擅自偏离锚点**。

### 2.2 effects[] 写法（差量语义）

每个节点 `effects[]` 是 RuleHandler 引用数组，**只描述相对上一节点（depth-1）的差量变化**。

```yaml
- id: arrow_double                # depth=2
  name: 双重箭塔
  depth: 2
  spCost: 6
  prerequisites: [arrow_basic]    # depth=1 节点 ID
  effects:
    - rule: add_projectile_count  # 弹丸数 +1（差量）
      value: 1
```

配置加载器在装备路径时合并所有已点亮节点的 effects[]，生成单位最终运行时属性（详 [22-overview §4.5 effects 合并算法](./22-skill-tree-overview.md#45-effects-合并算法)）。

### 2.3 路径互斥（单装备）

每塔可同时点亮多条路径的节点（本 Run 内 SP 预算限制），但**单局只装备一条路径**：

- 卡池界面切换装备：免费、无冷却
- 关内禁止切换 / 点亮（详 [22-overview §4.4](./22-skill-tree-overview.md#44-关内禁止点亮--切换装备)）

### 2.4 SP 节点深度图例

每塔节标题下使用统一图例：

```
路径 A · {路径名}      [depth=1] ●────[depth=2] ○────[depth=3] ○
路径 B · {路径名}      [depth=1] ●────[depth=2] ○────[depth=3] ○
```

- ● = 默认拥有（depth=1 spCost=0）
- ○ = 待点亮节点
- 数字 = 该节点 spCost

---

## 3. 七塔技能树清单（概览）

| 塔 ID | 中文名 | 路径数 | 节点总数 | 单路径满级 SP | 双路径满级 SP | 备注 |
|---|---|---|---|---|---|---|
| `arrow_tower` | 箭塔 | 2 | 2 + 3 = 5 实点亮节点 | 16 SP | 32 SP | 物理单体远程，经济友好 |
| `cannon_tower` | 炮塔 | 2 | 2 + 2 = 4 实点亮节点 | 16 SP | 32 SP | 物理 AOE，主清杂兵 |
| `elemental_tower` | 元素塔（原冰塔）| 3 | 2 + 2 + 2 = 6 实点亮节点 | 16 SP | 48 SP（三满）| 控制 / 元素效果，唯一 3 路径 |
| `lightning_tower` | 电塔 | 1 | 3 实点亮节点 | 31 SP | — | 链式弹跳，唯一 4 深节点路径 |
| `laser_tower` | 激光塔 | 2 | 2 + 2 = 4 实点亮节点 | 16 SP | 32 SP | 聚焦 / 持续输出 |
| `bat_tower` | 蝙蝠塔 | 1 | 2 实点亮节点 | 16 SP | — | 群体单位，天气依赖 |
| `missile_tower` | 导弹塔 | 2 | 2 + 2 = 4 实点亮节点 | 16 SP | 32 SP | 战略全图打击 |

### 3.1 关键数字解读

- **"实点亮节点"**：不含 depth=1 起点（spCost=0 默认拥有），仅算 depth ≥ 2 的购买节点。
- **"单路径满级 SP"**：从 depth=1 起点（0 SP）→ depth=2（6 SP）→ depth=3（10 SP）→ 共 16 SP；电塔单路径 4 节点 = 6+10+15 = 31 SP。
- **"双路径满级 SP"**：同塔两条路径都点满（共 32 SP）；元素塔 3 路径全满共 48 SP。

### 3.2 单 Run SP 流量对照（[50-mda §17.2.4](../50-data-numerical/50-mda.md#1724-典型-run-总-sp-流量) 锚点）

- 单 Run SP 流量典型值：**80-130 SP**（关 N×2 SP × 8 关 = 16 SP 保底 + 秘境 5-50 SP × 4 次 ≈ 60-100 SP + 金币兑换 50G/SP × ~10 次 ≈ 50 SP）
- 故玩家单 Run 内**最多点满 4-5 塔的单路径**（16 SP × 5 = 80 SP）或**点满 2-3 塔的双路径**（32 SP × 2-3 = 64-96 SP）
- 这是设计意图：**SP 是稀缺资源**，玩家每 Run 必须在"广撒网"和"深耕一塔"之间取舍

---

## 4. 箭塔 · `arrow_tower`

**塔定位**：物理单体远程，基础经济友好型。

### 4.1 节点图

```
路径 1 · 多重射击    [depth=1] 普通箭塔 ●────[depth=2] 双重箭塔 ○ 6SP────[depth=3] 三重箭塔 ○ 10SP
路径 2 · 高频火力    [depth=1] 普通箭塔 ●────[depth=2] 连弩箭塔 ○ 6SP────[depth=3] 连弩火箭塔 ○ 10SP
```

### 4.2 路径详表

| 路径 | depth=1（起点 0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 多重射击** | 普通箭塔（单发） | 双重箭塔（同时射出 2 支箭，可锁不同目标）| 三重箭塔（同时射出 3 支箭）|
| **2 · 高频火力** | 普通箭塔（单发） | 连弩箭塔（攻速大幅↑、单发伤害↓，单体高频）| 连弩火箭塔（连弩 + 命中附加小范围灼烧 DOT）|

### 4.3 YAML 配置

```yaml
arrow_tower:
  id: arrow_tower
  name: 箭塔
  category: tower
  # baseStats 见 21-unit-roster §2.1
  skillTree:
    paths:
      - id: multi_shot
        name: 多重射击
        nodes:
          - id: arrow_basic
            name: 普通箭塔
            depth: 1
            spCost: 0
            effects: []                       # 默认形态，无差量
          - id: arrow_double
            name: 双重箭塔
            depth: 2
            spCost: 6
            prerequisites: [arrow_basic]
            effects:
              - rule: add_projectile_count
                value: 1                      # 弹丸数 +1（差量）
          - id: arrow_triple
            name: 三重箭塔
            depth: 3
            spCost: 10
            prerequisites: [arrow_double]
            effects:
              - rule: add_projectile_count
                value: 1                      # 累加 → 共 +2
      - id: rapid_fire
        name: 高频火力
        nodes:
          - id: arrow_basic_rf
            name: 普通箭塔
            depth: 1
            spCost: 0
            effects: []
          - id: arrow_crossbow
            name: 连弩箭塔
            depth: 2
            spCost: 6
            prerequisites: [arrow_basic_rf]
            effects:
              - rule: mul_attack_interval
                value: 0.4                    # 攻击间隔 × 0.4（攻速大幅↑）
              - rule: mul_atk
                value: 0.5                    # 单发伤害 × 0.5
          - id: arrow_crossbow_fire
            name: 连弩火箭塔
            depth: 3
            spCost: 10
            prerequisites: [arrow_crossbow]
            effects:
              - rule: add_burning_on_hit
                duration: 2.0
                tickRatio: 0.2                # DOT 数值参 50-mda §3-§5
```

### 4.4 设计说明

- 两条路径互斥，体现"质 vs 量"取舍：路径 1 = 多目标分散输出，路径 2 = 单体高频压制。
- 路径 2 节点 2 的"攻速↑伤害↓"组合属于战斗机制变更，本质是改变 DPS 曲线形状（更稳定但峰值降低）。
- 路径 2 节点 3 的灼烧 DOT 覆盖小范围（仅命中目标附近 1 格），不构成 AOE 塔角色。

---

## 5. 炮塔 · `cannon_tower`

**塔定位**：物理 AOE 范围伤害，主清杂兵。

### 5.1 节点图

```
路径 1 · 控场 AOE    [depth=1] 普通炮塔 ●────[depth=2] 重炮塔 ○ 6SP────[depth=3] 超级炮塔 ○ 10SP
路径 2 · 狙击穿透    [depth=1] 普通炮塔 ●────[depth=2] 狙击炮塔 ○ 6SP────[depth=3] 战术炮塔 ○ 10SP
```

### 5.2 路径详表

| 路径 | depth=1（起点 0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 控场 AOE** | 普通炮塔（AOE 范围伤害） | 重炮塔（AOE + 概率眩晕命中目标）| 超级炮塔（AOE + 眩晕 + 击退）|
| **2 · 狙击穿透** | 普通炮塔（AOE 范围伤害） | 狙击炮塔（攻击间隔↑、射程↑、单发伤害↑，转为低频高伤单体）| 战术炮塔（狙击模式 + **弹道贯穿，单发命中沿途 ≤2 个敌人**）|

### 5.3 YAML 配置

```yaml
cannon_tower:
  id: cannon_tower
  name: 炮塔
  category: tower
  skillTree:
    paths:
      - id: aoe_control
        name: 控场 AOE
        nodes:
          - id: cannon_basic
            name: 普通炮塔
            depth: 1
            spCost: 0
            effects: []
          - id: heavy_cannon
            name: 重炮塔
            depth: 2
            spCost: 6
            prerequisites: [cannon_basic]
            effects:
              - rule: add_stun_on_hit
                probability: 0.3              # 数值占位，权威值在 50-mda
                duration: 0.5
          - id: super_cannon
            name: 超级炮塔
            depth: 3
            spCost: 10
            prerequisites: [heavy_cannon]
            effects:
              - rule: add_knockback_on_hit
                distance: 60                  # 击退距离（像素）
      - id: sniper_pierce
        name: 狙击穿透
        nodes:
          - id: cannon_basic_sp
            name: 普通炮塔
            depth: 1
            spCost: 0
            effects: []
          - id: sniper_cannon
            name: 狙击炮塔
            depth: 2
            spCost: 6
            prerequisites: [cannon_basic_sp]
            effects:
              - rule: mul_attack_interval
                value: 2.0                    # 攻击间隔 × 2.0
              - rule: mul_range
                value: 1.5
              - rule: mul_atk
                value: 2.5
              - rule: set_attack_mode
                mode: single_target           # 退出 AOE 模式
          - id: tactical_cannon
            name: 战术炮塔
            depth: 3
            spCost: 10
            prerequisites: [sniper_cannon]
            effects:
              - rule: add_pierce
                maxTargets: 2                 # 单发命中沿途 ≤2 敌人
```

### 5.4 设计说明

- 路径 1 = AOE + 控制（眩晕→击退），适合大波杂兵入场。
- 路径 2 = 单体狙击 + 贯穿，承接旧版 **弩炮塔** 的核心能力（弩炮塔已废弃，见 [22-tower-tech-tree §8](./22-tower-tech-tree.md#8-废弃单位清单)）。
- 路径 2 节点 2 通过 `set_attack_mode: single_target` 切换 AOE→单体模式，是规则引擎"行为规则"切换的典型示例。

---

## 6. 元素塔 · `elemental_tower`（原冰塔）

**塔定位**：控制 / 元素效果，是 v3.4 中**唯一拥有 3 条路径**的塔。

### 6.1 改名说明

- 旧"冰塔"（`ice_tower`）→ **元素塔**（`elemental_tower`）。
- 默认形态 = **元素塔 · 冰**，沿用旧冰塔的减速效果，保证兼容。
- 切换路径 = 切换默认元素属性（冰/火/毒），UI 与外观随之变化。

### 6.2 节点图

```
路径 1 · 冰系    [depth=1] 元素塔·冰 ●────[depth=2] 冰冻塔 ○ 6SP────[depth=3] 霜冻塔 ○ 10SP
路径 2 · 火系    [depth=1] 元素塔·冰 ●────[depth=2] 火焰塔 ○ 6SP────[depth=3] 真火塔 ○ 10SP
路径 3 · 毒系    [depth=1] 元素塔·冰 ●────[depth=2] 巫毒塔 ○ 6SP────[depth=3] 病毒塔 ○ 10SP
```

### 6.3 路径详表

| 路径 | depth=1（起点 0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 冰系** | 元素塔 · 冰（命中减速） | 冰冻塔（命中按概率触发"冰冻"硬控）| 霜冻塔（冰冻 + 命中目标攻击力 Debuff）|
| **2 · 火系** | 元素塔 · 冰（命中减速） | 火焰塔（命中附加灼烧 DOT，**覆盖减速效果**）| 真火塔（灼烧 + **击杀按概率额外 +1 能量**）|
| **3 · 毒系** | 元素塔 · 冰（命中减速） | 巫毒塔（命中附加中毒 DOT，**覆盖减速效果**）| 病毒塔（中毒 **传染**：跳数 ≤3、半径 ≤80px、每跳伤害衰减 50%）|

### 6.4 YAML 配置

```yaml
elemental_tower:
  id: elemental_tower
  name: 元素塔
  category: tower
  elementType: ice                            # 默认属性 = 冰（depth=1 起点）
  skillTree:
    paths:
      - id: ice_path
        name: 冰系
        nodes:
          - id: elem_ice_basic
            name: 元素塔·冰
            depth: 1
            spCost: 0
            effects: []                       # 默认带减速命中效果
          - id: freeze_tower
            name: 冰冻塔
            depth: 2
            spCost: 6
            prerequisites: [elem_ice_basic]
            effects:
              - rule: add_freeze_on_hit
                probability: 0.25
                duration: 1.0                 # 硬控（不可动作）
          - id: frost_tower
            name: 霜冻塔
            depth: 3
            spCost: 10
            prerequisites: [freeze_tower]
            effects:
              - rule: add_atk_debuff_on_hit
                value: -0.3                   # 命中目标 ATK -30%
                duration: 3.0
      - id: fire_path
        name: 火系
        nodes:
          - id: elem_fire_basic               # 注：装备火系时 elementType 切换为 fire
            name: 元素塔·冰
            depth: 1
            spCost: 0
            effects: []
          - id: flame_tower
            name: 火焰塔
            depth: 2
            spCost: 6
            prerequisites: [elem_fire_basic]
            effects:
              - rule: set_element_type
                element: fire                 # 切换属性 → 命中改附加灼烧
              - rule: add_burning_on_hit
                duration: 3.0
                tickRatio: 0.25
              - rule: remove_slow_on_hit      # 移除减速（被灼烧覆盖）
          - id: true_fire_tower
            name: 真火塔
            depth: 3
            spCost: 10
            prerequisites: [flame_tower]
            effects:
              - rule: add_energy_on_kill
                probability: 0.2
                amount: 1                     # 击杀按概率 +1 能量（复用 EnergySystem）
      - id: poison_path
        name: 毒系
        nodes:
          - id: elem_poison_basic
            name: 元素塔·冰
            depth: 1
            spCost: 0
            effects: []
          - id: voodoo_tower
            name: 巫毒塔
            depth: 2
            spCost: 6
            prerequisites: [elem_poison_basic]
            effects:
              - rule: set_element_type
                element: poison
              - rule: add_poison_on_hit
                duration: 4.0
                tickRatio: 0.2
              - rule: remove_slow_on_hit
          - id: virus_tower
            name: 病毒塔
            depth: 3
            spCost: 10
            prerequisites: [voodoo_tower]
            effects:
              - rule: add_poison_contagion
                maxJumps: 3
                radius: 80                    # px
                damageDecay: 0.5              # 每跳衰减 50%
```

### 6.5 元素塔机制说明

- 路径之间的元素效果**不叠加**：在火系路径下，命中只附加灼烧，不附加减速；切换路径前的旧元素效果完全清除。
- 真火塔的"额外能量"按击杀点结算，每次结算独立 roll，不与卡牌本身的能量回收冲突。
- 路径 3 病毒塔承接旧版 **毒藤塔** 的传染机制（毒藤塔已废弃，见 [22-tower-tech-tree §8](./22-tower-tech-tree.md#8-废弃单位清单)）。
- **3 条路径全满共 48 SP**（≈ 单 Run SP 流量 80-130 的 37%-60%），是单 Run 内对单一塔种最大的 SP 投入选择。

---

## 7. 电塔 · `lightning_tower`

**塔定位**：链式弹跳，群体压制。**v3.4 唯一拥有 depth=4 节点的塔**。

### 7.1 节点图（单路径 4 节点）

```
[depth=1] 普通电塔 ●────[depth=2] 热电塔 ○ 6SP────[depth=3] 核电塔 ○ 10SP────[depth=4] 闪电塔 ○ 15SP
```

### 7.2 节点详表

| 节点 | 名称 | depth | spCost | 能力（差量） |
|---|---|---|---|---|
| 1 | 普通电塔 | 1 | 0 | 1 次弹跳（默认）|
| 2 | 热电塔 | 2 | 6 | 弹跳次数 +1 → 共 2 次 |
| 3 | 核电塔 | 3 | 10 | 弹跳次数 +1 → 共 3 次 |
| 4 | 闪电塔 | 4 | 15 | **概率触发"全屏闪电"**：随机攻击全图敌人一次，CD ≥10s，单次伤害 ≈ 1.5× 普攻 |

### 7.3 YAML 配置

```yaml
lightning_tower:
  id: lightning_tower
  name: 电塔
  category: tower
  skillTree:
    paths:
      - id: chain_lightning
        name: 链式弹跳
        nodes:
          - id: lightning_basic
            name: 普通电塔
            depth: 1
            spCost: 0
            effects: []                       # 默认 1 次弹跳
          - id: thermal_lightning
            name: 热电塔
            depth: 2
            spCost: 6
            prerequisites: [lightning_basic]
            effects:
              - rule: add_chain_bounce
                value: 1                      # 弹跳 +1
          - id: nuclear_lightning
            name: 核电塔
            depth: 3
            spCost: 10
            prerequisites: [thermal_lightning]
            effects:
              - rule: add_chain_bounce
                value: 1                      # 累加 → 共 3 次
          - id: storm_lightning
            name: 闪电塔
            depth: 4
            spCost: 15
            prerequisites: [nuclear_lightning]
            effects:
              - rule: add_global_strike
                probability: 0.15             # 数值占位，权威 50-mda
                cooldown: 10.0                # CD（秒）
                damageMul: 1.5                # 倍率
                targetCount: -1               # -1 = 全图
```

### 7.4 全屏闪电规则

- **触发逻辑**：每次普通攻击后掷骰，CD 内不可重复触发。
- **目标**：随机敌人池（不限阵营/状态/位置），单次伤害独立计算。
- **定位**：末期 panic button，**不是清屏 AI 必胜键**。
- **数值**（概率、CD、倍率）以 [50-mda](../50-data-numerical/50-mda.md) 为准。

### 7.5 单路径设计因素

- 电塔的"变量"已经内嵌在链式弹跳次数 + 末位全屏闪电，足够策略深度，**无需再加路径**。
- depth=4 节点 15 SP，是 v3.4 全单位最高单节点投入，体现"终极爆点"定位（[50-mda §17.3 锚点 depth=4 = 15 SP](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点)）。
- 单路径 4 节点 SP 总计 **0 + 6 + 10 + 15 = 31 SP**，约占单 Run SP 流量 30%-40%，与"高投入终极塔"定位匹配。

---

## 8. 激光塔 · `laser_tower`

**塔定位**：聚焦 / 持续输出。

### 8.1 节点图

```
路径 1 · 扇形覆盖    [depth=1] 普通激光塔 ●────[depth=2] 中级激光塔 ○ 6SP────[depth=3] 高级激光塔 ○ 10SP
路径 2 · 蓄能聚焦    [depth=1] 普通激光塔 ●────[depth=2] 稳压激光塔 ○ 6SP────[depth=3] 充能激光塔 ○ 10SP
```

### 8.2 路径详表

| 路径 | depth=1（起点 0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 扇形覆盖** | 普通激光塔（1 道激光） | 中级激光塔（2 道激光，同时锁不同目标）| 高级激光塔（3 道激光 + 攻击 CD↓）|
| **2 · 蓄能聚焦** | 普通激光塔（1 道激光） | 稳压激光塔（**在攻击范围内持续锁单体**，不切换目标）| 充能激光塔（蓄能机制：**持续锁同一目标越久伤害越高**，目标切换 / 死亡后清零）|

### 8.3 YAML 配置

```yaml
laser_tower:
  id: laser_tower
  name: 激光塔
  category: tower
  skillTree:
    paths:
      - id: fan_coverage
        name: 扇形覆盖
        nodes:
          - id: laser_basic
            name: 普通激光塔
            depth: 1
            spCost: 0
            effects: []
          - id: laser_mid
            name: 中级激光塔
            depth: 2
            spCost: 6
            prerequisites: [laser_basic]
            effects:
              - rule: add_beam_count
                value: 1                      # 激光道数 +1（→ 2 道）
          - id: laser_high
            name: 高级激光塔
            depth: 3
            spCost: 10
            prerequisites: [laser_mid]
            effects:
              - rule: add_beam_count
                value: 1                      # 累加 → 3 道
              - rule: mul_attack_interval
                value: 0.7                    # CD↓
      - id: focus_charge
        name: 蓄能聚焦
        nodes:
          - id: laser_basic_fc
            name: 普通激光塔
            depth: 1
            spCost: 0
            effects: []
          - id: laser_stable
            name: 稳压激光塔
            depth: 2
            spCost: 6
            prerequisites: [laser_basic_fc]
            effects:
              - rule: set_target_lock
                mode: persistent              # 范围内持续锁单体
          - id: laser_charge
            name: 充能激光塔
            depth: 3
            spCost: 10
            prerequisites: [laser_stable]
            effects:
              - rule: add_charge_damage
                rampPerSecond: 0.5            # 每秒伤害递增 50%
                maxMul: 5.0                   # 倍率上限
                resetOnTargetChange: true
```

### 8.4 设计说明

- 路径 1 = 广泛覆盖（多目标低烈度），路径 2 = 单体高烈度（蓄能爆发）。
- 充能激光塔（原方案命名"特变激光塔"）已改名为更直白的"充能激光塔"。
- 路径 2 节点 3 的蓄能机制需要 `ChargeBuffComponent` 跟踪锁定目标 + 锁定时长，目标切换 / 死亡触发 `resetCharge`（详 `src/systems/AttackSystem.ts` 实现）。

---

## 9. 蝙蝠塔 · `bat_tower`

**塔定位**：群体单位类塔，受天气影响。

### 9.1 节点图（单路径 3 节点）

```
[depth=1] 普通蝙蝠塔 ●────[depth=2] 中级蝙蝠塔 ○ 6SP────[depth=3] 高级蝙蝠塔 ○ 10SP
```

### 9.2 节点详表

| 节点 | 名称 | depth | spCost | 能力（差量） |
|---|---|---|---|---|
| 1 | 普通蝙蝠塔 | 1 | 0 | 3 蝙蝠（默认）|
| 2 | 中级蝙蝠塔 | 2 | 6 | 蝙蝠数 +1 → 共 4 + 单蝙蝠 ATK↑ |
| 3 | 高级蝙蝠塔 | 3 | 10 | 蝙蝠数 +1 → 共 5 + 单蝙蝠 ATK↑ |

### 9.3 YAML 配置

```yaml
bat_tower:
  id: bat_tower
  name: 蝙蝠塔
  category: tower
  skillTree:
    paths:
      - id: swarm_growth
        name: 蝙蝠群成长
        nodes:
          - id: bat_basic
            name: 普通蝙蝠塔
            depth: 1
            spCost: 0
            effects: []                       # 默认 3 蝙蝠
          - id: bat_mid
            name: 中级蝙蝠塔
            depth: 2
            spCost: 6
            prerequisites: [bat_basic]
            effects:
              - rule: add_bat_count
                value: 1                      # 蝙蝠数 +1
              - rule: mul_atk
                value: 1.2                    # 单蝙蝠 ATK × 1.2
          - id: bat_high
            name: 高级蝙蝠塔
            depth: 3
            spCost: 10
            prerequisites: [bat_mid]
            effects:
              - rule: add_bat_count
                value: 1                      # 累加 → 5 只
              - rule: mul_atk
                value: 1.2                    # 累加 → 1.44×
```

### 9.4 蝙蝠塔机制说明

- 所有节点沿用 [21-unit-roster §2.2 蝙蝠塔天气依赖](./21-unit-roster.md#蝙蝠塔bat_tower天气依赖) 的 `weather_dependent_atk` 天气影响。
- **单路径设计因素**：蝙蝠塔的"变量"来自天气系统（5 种天气 × 多种状态），已经具备策略深度，无需再加路径。
- 节点 2/3 的"+蝙蝠数"通过 `add_bat_count` RuleHandler 直接修改单位生成数量（详 [20-unit-system §蝙蝠生成](./20-unit-system.md)）。

---

## 10. 导弹塔 · `missile_tower`

**塔定位**：战略大射程打击（600px）。**v1.2 起目标选择默认为「手动指挥」**（玩家点击塔拖动指示器手动选目标），可右键塔切换为「托管」走原地格评分系统。两种模式与本节科技树节点（双联齐射 / 战略弹头）正交——无论节点 1 还是节点 3，都既可手动也可托管。详见 [26-missile-special](./26-missile-special.md)（特别是 §3 双模式状态机 + §9 交互速查）。

### 10.1 节点图

```
路径 1 · 双联齐射    [depth=1] 普通导弹塔 ●────[depth=2] 双联导弹塔 ○ 6SP────[depth=3] 集束导弹塔 ○ 10SP
路径 2 · 战略弹头    [depth=1] 普通导弹塔 ●────[depth=2] 温压弹塔 ○ 6SP────[depth=3] 核弹塔 ○ 10SP
```

### 10.2 路径详表

| 路径 | depth=1（起点 0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 双联齐射** | 普通导弹塔（单发） | 双联导弹塔（**同一地格同时发射 2 个导弹**，单发伤害↓，总伤害↑）| 集束导弹塔（同一地格同时发射 3 个导弹，单发伤害再↓，总伤害再↑）|
| **2 · 战略弹头** | 普通导弹塔（单发） | 温压弹塔（爆炸范围内附加灼烧 DOT）| 核弹塔（爆炸范围扩大 + 灼烧）|

### 10.3 YAML 配置

```yaml
missile_tower:
  id: missile_tower
  name: 导弹塔
  category: tower
  skillTree:
    paths:
      - id: salvo_volley
        name: 双联齐射
        nodes:
          - id: missile_basic
            name: 普通导弹塔
            depth: 1
            spCost: 0
            effects: []
          - id: missile_dual
            name: 双联导弹塔
            depth: 2
            spCost: 6
            prerequisites: [missile_basic]
            effects:
              - rule: add_missile_count
                value: 1                      # 同坐标多发射 +1（→ 2 发）
              - rule: mul_atk
                value: 0.6                    # 单发伤害 × 0.6（总伤害 ≈ 1.2×）
          - id: missile_cluster
            name: 集束导弹塔
            depth: 3
            spCost: 10
            prerequisites: [missile_dual]
            effects:
              - rule: add_missile_count
                value: 1                      # 累加 → 3 发
              - rule: mul_atk
                value: 0.7                    # 累加 → 0.42× × 3 ≈ 1.26×
      - id: strategic_warhead
        name: 战略弹头
        nodes:
          - id: missile_basic_sw
            name: 普通导弹塔
            depth: 1
            spCost: 0
            effects: []
          - id: thermobaric_missile
            name: 温压弹塔
            depth: 2
            spCost: 6
            prerequisites: [missile_basic_sw]
            effects:
              - rule: add_burning_on_explosion
                duration: 3.0
                tickRatio: 0.25
          - id: nuke_missile
            name: 核弹塔
            depth: 3
            spCost: 10
            prerequisites: [thermobaric_missile]
            effects:
              - rule: mul_explosion_radius
                value: 1.6                    # 爆炸范围 × 1.6
              - rule: mul_atk
                value: 1.4                    # 爆炸伤害 × 1.4
```

### 10.4 同坐标多发射机制说明

- **评分逻辑（选哪个地格）不变**，复用 [26-missile-special](./26-missile-special.md) 地格评分。
- **同坐标多发射**：`ProjectileSystem` 在选定地格后，按节点数量循环 N 次发射相同弹道，弹道之间错开极短延迟（视觉区分用，伤害互独立）。
- 总伤害 ≈ 单发 × N，但单发 < 普通导弹塔单发伤害（数值进 [50-mda](../50-data-numerical/50-mda.md)）。
- **实现优势**：复用现有评分流水线，比"打多个地格"简单；视觉效果更冲击。

### 10.5 路径 2 设计说明

- 路径 2 = 战略弹头方向，强化单次爆炸的烈度与范围（伤害质而非量）。
- 温压弹塔通过 `add_burning_on_explosion` 给爆炸范围内所有敌人附加灼烧 DOT，是 v3.4 中唯一"爆炸 + DOT"双效塔节点。
- 核弹塔通过 `mul_explosion_radius` × 1.6 + `mul_atk` × 1.4，对比 depth=2 的温压弹塔，本质是"伤害 + 范围"的总量级提升。

---

## 11. 七塔 SP 总需求与流派覆盖

### 11.1 各塔 SP 总需求矩阵

| 塔 | 路径 1 单满 | 路径 2 单满 | 路径 3 单满 | 路径 4 单满 | 双路径全满 | 三路径全满 |
|---|---|---|---|---|---|---|
| `arrow_tower` | 16 SP | 16 SP | — | — | 32 SP | — |
| `cannon_tower` | 16 SP | 16 SP | — | — | 32 SP | — |
| `elemental_tower` | 16 SP | 16 SP | 16 SP | — | 32 SP | **48 SP** |
| `lightning_tower` | **31 SP** | — | — | — | — | — |
| `laser_tower` | 16 SP | 16 SP | — | — | 32 SP | — |
| `bat_tower` | 16 SP | — | — | — | — | — |
| `missile_tower` | 16 SP | 16 SP | — | — | 32 SP | — |

### 11.2 单 Run SP 预算策略示范

假设玩家单 Run SP 流量为 **100 SP**（中位数，参 [50-mda §17.2.4](../50-data-numerical/50-mda.md#1724-典型-run-总-sp-流量)）：

| 策略 | SP 分配 | 满级塔数 | 适合玩法 |
|---|---|---|---|
| **广撒网** | 5 塔 × 16 SP = 80 SP（剩 20 SP 买商店功能卡）| 5 个单路径塔 | 测试多种塔的协同 / 防御阵容多样性 |
| **深耕双塔** | 2 塔 × 32 SP = 64 SP + 1 塔 × 16 SP = 80 SP（剩 20 SP）| 2 个双路径塔 + 1 单路径塔 | 主力塔最大化 |
| **元素塔三路径** | 元素塔 48 SP + 2 塔 × 16 SP = 32 SP + 剩 20 SP | 1 个三路径 + 2 个单路径 | 极致元素流派 |
| **闪电塔终极** | 电塔 31 SP + 4 塔 × 16 SP = 64 SP + 剩 5 SP | 1 个 4 深节点 + 4 个单路径 | 末期 panic button |

### 11.3 SP 流量对设计的反馈

- **80-130 SP 单 Run 流量**意味着玩家**永远无法点满所有塔的所有路径**（7 塔满 = 32×6+48+31 = 271 SP）。
- 这是设计意图：**塔选择 + 路径选择 + SP 预算 = Roguelike 玩法的核心决策三角**。
- 若实测发现玩家平均 SP 流量 >150，应回头调整 [50-mda §17.2](../50-data-numerical/50-mda.md#172-sp-获取流量) SP 流量；**严禁通过降低本文档 spCost 解决 SP 过剩问题**（否则锚点失效）。

---

## 12. RuleHandler 引用清单

本文档共引用以下 RuleHandler（注册在 `src/core/RuleHandlers.ts`，详 [60-architecture §5.3](../60-tech/60-architecture.md)）：

### 12.1 数值修改类

| RuleHandler | 用途 | 引用塔（节点）|
|---|---|---|
| `mul_atk` | 攻击力倍率 | 箭塔（连弩）/ 炮塔（狙击）/ 蝙蝠塔（中高）/ 导弹塔（双联/核弹）|
| `mul_attack_interval` | 攻击间隔倍率 | 箭塔（连弩）/ 炮塔（狙击）/ 激光塔（高级）|
| `mul_range` | 射程倍率 | 炮塔（狙击）|
| `mul_explosion_radius` | 爆炸半径倍率 | 导弹塔（核弹）|

### 12.2 弹丸/单位数量类

| RuleHandler | 用途 | 引用塔（节点）|
|---|---|---|
| `add_projectile_count` | 弹丸数 +N | 箭塔（双重/三重）|
| `add_beam_count` | 激光道数 +N | 激光塔（中级/高级）|
| `add_chain_bounce` | 弹跳次数 +N | 电塔（热电/核电）|
| `add_bat_count` | 蝙蝠数 +N | 蝙蝠塔（中级/高级）|
| `add_missile_count` | 同坐标导弹数 +N | 导弹塔（双联/集束）|

### 12.3 命中/击杀效果类

| RuleHandler | 用途 | 引用塔（节点）|
|---|---|---|
| `add_burning_on_hit` | 命中附加灼烧 DOT | 箭塔（连弩火箭）/ 元素塔（火焰）|
| `add_freeze_on_hit` | 命中按概率冰冻硬控 | 元素塔（冰冻）|
| `add_poison_on_hit` | 命中附加中毒 DOT | 元素塔（巫毒）|
| `add_poison_contagion` | 中毒传染 | 元素塔（病毒）|
| `add_stun_on_hit` | 命中按概率眩晕 | 炮塔（重炮）|
| `add_knockback_on_hit` | 命中击退 | 炮塔（超级）|
| `add_atk_debuff_on_hit` | 命中目标 ATK Debuff | 元素塔（霜冻）|
| `add_pierce` | 弹道贯穿 | 炮塔（战术）|
| `add_burning_on_explosion` | 爆炸范围内附加灼烧 | 导弹塔（温压）|
| `add_energy_on_kill` | 击杀按概率 +能量 | 元素塔（真火）|
| `add_global_strike` | 概率触发全屏闪电 | 电塔（闪电）|

### 12.4 行为模式切换类

| RuleHandler | 用途 | 引用塔（节点）|
|---|---|---|
| `set_attack_mode` | 切换攻击模式（single / aoe）| 炮塔（狙击）|
| `set_target_lock` | 切换目标锁定模式 | 激光塔（稳压）|
| `set_element_type` | 切换元素属性 | 元素塔（火焰/巫毒）|
| `remove_slow_on_hit` | 移除命中减速效果 | 元素塔（火焰/巫毒）|

### 12.5 蓄能/递增类

| RuleHandler | 用途 | 引用塔（节点）|
|---|---|---|
| `add_charge_damage` | 蓄能伤害递增 | 激光塔（充能）|

**新增 RuleHandler 数量**：本文档共需新增 19 个 RuleHandler（其中 4 个继承 v3.1 22-tower-tech-tree，15 个本文档新增或重命名）。具体注册由代码改造阶段完成（详 [v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) 第 4 轮）。

---

## 13. v3.4 不变式核对

| 不变式 | 权威文档 | 本文档执行情况 |
|---|---|---|
| 火花碎片词汇彻底废弃 | [v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) | ✅ 全文 0 处「火花碎片」「shard」「shardCost」「碎片」（已全部替为 SP / spCost）|
| meta 永久积累机制取消 | [11-economy §4](../10-gameplay/11-economy.md) | ✅ 全文 0 处「永久解锁」「meta 进度」「跨 Run」（已强调本 Run 临时）|
| 数值真理源唯一 | [50-mda](../50-data-numerical/50-mda.md) | ✅ 所有 `spCost` 严格命中 §17.3 锚点（0/6/10/15），不出现锚点外数值 |
| 节点深度 SP 单价锚点 | [50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点) | ✅ depth=1/2/3/4 = 0/6/10/15 全部命中 |
| 单位卡入手默认形态 | [22-skill-tree-overview §7.3](./22-skill-tree-overview.md#73-depth1-起点-sp-单价为-0-还是-3) | ✅ 全部 depth=1 节点 spCost=0 |
| 路径互斥单装备 | [22-skill-tree-overview §4](./22-skill-tree-overview.md#4-路径互斥与装备切换) | ✅ 全文未引入"多路径同时装备"机制；元素塔 3 路径明确"单局只装一条" |
| 关内禁止点亮 / 切换装备 | [22-skill-tree-overview §4.4](./22-skill-tree-overview.md#44-关内禁止点亮--切换装备) | ✅ 全文 0 处"关内升级"「关内点亮」"关内切换路径"提及 |
| 与 instanceLevel 正交 | [22-skill-tree-overview §6.2](./22-skill-tree-overview.md#62-正交关键点铁律) | ✅ 全文 effects[] 0 处 `add_instance_level` RuleHandler 引用 |

---

## 14. 修订历史

| 版本 | 日期 | 类型 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮第 2 份创建**：塔技能树详设权威。14 章覆盖：文档定位 / 通用约定 / 七塔技能树清单 / 7 个塔（箭塔 2 路径 / 炮塔 2 路径 / 元素塔 3 路径 / 电塔 1 路径 4 节点 / 激光塔 2 路径 / 蝙蝠塔 1 路径 / 导弹塔 2 路径）/ 七塔 SP 总需求矩阵 / RuleHandler 引用清单（19 个）/ v3.4 8 项不变式核对。**蓝本式继承 v3.1 [22-tower-tech-tree §4](./22-tower-tech-tree.md#4-七塔完整科技树)**，节点 ID / 名称 / 形态梯度完整保留；字段重命名（`shardCost`→`spCost`、`techTree`→`skillTree`）+ SP 单价命中 50-mda §17.3 锚点（0/6/10/15）+ depth=1 起点 spCost=0。 |
