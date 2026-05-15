---
title: 法术卡参数技能树详设（v3.4）
status: authoritative
version: 1.0.0
last-modified: 2026-05-15
authority-for:
  - spell-skill-tree
  - spell-path-nodes
  - spell-skill-tree-yaml
cross-refs:
  - 20-units/22-skill-tree-overview.md
  - 20-units/23-skill-buff.md
  - 20-units/21-unit-roster.md
  - 20-units/27-traps-spells-scene.md
  - 50-data-numerical/50-mda.md
  - 60-tech/60-architecture.md
  - v3.4-MAJOR-MIGRATION.md
---

# 法术卡参数技能树详设（v3.4）

> ⭐ **本文档是 14 张法术卡技能树的唯一权威详设**。所有节点 ID / 路径 ID / SP 单价 / RuleHandler 引用以本文档为准；通用骨架见 [22-skill-tree-overview](./22-skill-tree-overview.md)。

> 🆕 **本文档为 v3.4 全新创建**。v3.1 阶段法术卡仅有 [23-skill-buff §7 instanceLevel](./23-skill-buff.md#7-instancelevel-法术卡提升机制) 机制（关内单局战斗强化），无关外/本 Run 技能树。v3.4 引入 SP 系统后，**法术卡首次拥有参数维度技能树**，与 instanceLevel 形成正交两层强化。

> ⚠️ **关键正交铁律（vs 23-skill-buff §7）**：本文档的技能树节点 = **本 Run SP 投入的"参数维度永久强化"**；§7 instanceLevel = **关内单局战斗的"精炼术"临时提升**。两者完全独立，**节点 effects[] 严禁出现 `add_instance_level` RuleHandler**。

---

## 目录

- [1. 文档定位与读法](#1-文档定位与读法)
- [2. 通用约定](#2-通用约定)
- [3. 法术分类与路径维度选择](#3-法术分类与路径维度选择)
- [4. 即时打击型法术（4 张）](#4-即时打击型法术4-张)
  - [4.1 火球术 · `fireball_spell`](#41-火球术--fireball_spell)
  - [4.2 陨石术 · `meteor_spell`](#42-陨石术--meteor_spell)
  - [4.3 闪电链 · `chain_lightning_spell`](#43-闪电链--chain_lightning_spell)
  - [4.4 净化术 · `purification_spell`](#44-净化术--purification_spell)
- [5. 区域控制型法术（4 张）](#5-区域控制型法术4-张)
  - [5.1 全屏冰冻 · `freeze_all_spell`](#51-全屏冰冻--freeze_all_spell)
  - [5.2 减速术 · `slow_spell`](#52-减速术--slow_spell)
  - [5.3 箭雨术 · `arrow_rain_spell`](#53-箭雨术--arrow_rain_spell)
  - [5.4 龙卷术 · `tornado_spell`](#54-龙卷术--tornado_spell)
- [6. 增益持续型法术（3 张）](#6-增益持续型法术3-张)
  - [6.1 治疗脉冲 · `heal_pulse_spell`](#61-治疗脉冲--heal_pulse_spell)
  - [6.2 神圣庇护 · `divine_protection_spell`](#62-神圣庇护--divine_protection_spell)
  - [6.3 集结号 · `rally_horn_spell`](#63-集结号--rally_horn_spell)
- [7. 战略召唤/全局型法术（3 张）](#7-战略召唤全局型法术3-张)
  - [7.1 召唤骷髅 · `summon_skeletons_spell`](#71-召唤骷髅--summon_skeletons_spell)
  - [7.2 时间膨胀 · `time_dilation_spell`](#72-时间膨胀--time_dilation_spell)
  - [7.3 战术撤退 · `tactical_retreat_spell`](#73-战术撤退--tactical_retreat_spell)
- [8. 14 法术 SP 总需求与流派覆盖](#8-14-法术-sp-总需求与流派覆盖)
- [9. 与 instanceLevel 正交边界铁律](#9-与-instancelevel-正交边界铁律)
- [10. RuleHandler 引用清单](#10-rulehandler-引用清单)
- [11. v3.4 不变式核对](#11-v34-不变式核对)
- [12. 修订历史](#12-修订历史)

---

## 1. 文档定位与读法

### 1.1 本文档负责什么

本文档**只**负责法术卡（`type: spell`）的技能树详设。法术卡技能树设计核心：

- 4 个参数维度构成路径池：**伤害（damage）/ 范围（range）/ 冷却（CD）/ 持续时间（duration）**
- 每法术按其机制特性，**弹性选择 2-4 条相关路径**（不强求全 4 条）
- 每条路径 3 节点（depth=1/2/3 = 0/6/10 SP，与 22a-22c 一致）

### 1.2 本文档**不**负责什么

| 不负责的内容 | 权威文档 |
|---|---|
| 节点结构 / 路径互斥 / SP 单价锚点 | [22-skill-tree-overview](./22-skill-tree-overview.md)|
| 法术效果机制（伤害类型 / AOE 形状 / DOT 公式）| [27-traps-spells-scene §3](./27-traps-spells-scene.md#3-法术spell) |
| 法术基础数值（伤害 / 能量 / 范围 / 持续时间初始值）| [50-mda §21.2](../50-data-numerical/50-mda.md) + [21-unit-roster §7.2](./21-unit-roster.md#72-法术卡spelleffect-驱动14-张4-子分类) |
| 法术 `instanceLevel`（关内"精炼术"提升）| [23-skill-buff §7](./23-skill-buff.md#7-instancelevel-法术卡提升机制) |
| 法术能量成本 | [21-unit-roster §7.2](./21-unit-roster.md#72-法术卡spelleffect-驱动14-张4-子分类) + [50-mda](../50-data-numerical/50-mda.md)|

### 1.3 设计理念

| 维度 | 塔 22a / 士兵 22b / 陷阱 22c | 法术 22d（本文档）|
|---|---|---|
| 路径主线 | 形态切换 / 主动强化 / 耐久 vs 烈度 | **参数维度强化（4 维度可选）**|
| 路径数 | 1-3 / 2 / 2 | **2-4 弹性**（按法术机制选择相关维度）|
| 节点深度 | 1-4 / 1-3 / 1-3 | **统一 1-3** |
| 设计原因 | 单位机制差异大 | **法术维度结构化**：所有法术共用 4 维度参数池，便于代码统一处理 |

### 1.4 4 维度选择标准

每法术按以下标准从 4 维度中选择相关路径：

| 维度 | 适用法术 | 不适用法术 |
|---|---|---|
| **伤害（damage）** | 直接造成伤害的法术 | 治疗 / 净化 / 召唤 / 减速纯控制类 |
| **范围（range / radius / area）** | 有 AOE / 区域效果的法术 | 单体瞬时类 |
| **冷却（cooldown / CD）** | 可重复使用的法术（绝大多数）| 一次性单 Run 限定法术（暂无）|
| **持续时间（duration）** | DOT / Buff / Debuff / 召唤生存 / 区域持续的法术 | 瞬时一次性结算的法术 |

---

## 2. 通用约定

### 2.1 SP 单价锚点

同 22a / 22b / 22c：depth=1 → 0 SP / depth=2 → 6 SP / depth=3 → 10 SP。

### 2.2 路径数与 SP 总需求

| 路径数 | 单路径满级 SP | 全路径全满 SP |
|---|---|---|
| 2 | 16 SP | 32 SP |
| 3 | 16 SP | 48 SP |
| 4 | 16 SP | 64 SP |

14 法术全路径全满总 SP 远超单 Run SP 流量上限（80-130 SP），**设计预期单 Run 内对法术 SP 投入约 20-40 SP**（点 2-3 张法术的 1-2 条关键路径）。

### 2.3 effects[] 差量语义（沿用 22a-22c）

每节点 `effects[]` 仅描述相对上一节点的差量变化。

### 2.4 与法术能量成本的关系

技能树节点**不修改法术能量成本**（能量成本是法术基础属性，由 50-mda 锁定）。所有路径强化都是"花 SP 提升法术效果"，**不能降低能量成本**——避免与商店"功能卡"中可能存在的能量折扣机制冲突。

---

## 3. 法术分类与路径维度选择

### 3.1 14 法术路径分配总览

| 法术 ID | 分类 | 路径数 | 选中维度 | 略过维度（原因）|
|---|---|---|---|---|
| `fireball_spell` | 即时打击 | **4** | 伤害 / 范围 / CD / 持续时间（灼烧 DOT）| — |
| `meteor_spell` | 即时打击 | **3** | 伤害 / 范围 / CD | 持续时间（瞬时单格爆炸 + 溅射，无 DOT）|
| `chain_lightning_spell` | 即时打击 | **3** | 伤害 / 范围（链跳数）/ CD | 持续时间（瞬时弹射）|
| `purification_spell` | 即时打击 | **2** | 范围（影响目标数）/ CD | 伤害（净化效果，无伤害）+ 持续时间（瞬时）|
| `freeze_all_spell` | 区域控制 | **3** | 范围（影响目标比例）/ CD / 持续时间 | 伤害（纯控制）|
| `slow_spell` | 区域控制 | **4** | 伤害（减速量映射）/ 范围 / CD / 持续时间 | — |
| `arrow_rain_spell` | 区域控制 | **4** | 伤害（DPS）/ 范围 / CD / 持续时间 | — |
| `tornado_spell` | 区域控制 | **4** | 伤害 / 范围（推力路径宽度）/ CD / 持续时间 | — |
| `heal_pulse_spell` | 增益持续 | **3** | 范围（影响单位数）/ CD / 持续时间（HoT 时长）| 伤害（治疗类）|
| `divine_protection_spell` | 增益持续 | **3** | 范围（次数池）/ CD / 持续时间（保护期 N 波）| 伤害（防御类）|
| `rally_horn_spell` | 增益持续 | **3** | 范围（光环半径）/ CD / 持续时间 | 伤害（增益类）|
| `summon_skeletons_spell` | 战略召唤 | **3** | 范围（召唤数量）/ CD / 持续时间（骷髅生存时长）| 伤害（召唤类，骷髅伤害走单位属性）|
| `time_dilation_spell` | 战略召唤 | **2** | CD / 持续时间 | 伤害（无伤害）+ 范围（全屏固定）|
| `tactical_retreat_spell` | 战略召唤 | **2** | CD / 范围（返还能量比例）| 伤害（无伤害）+ 持续时间（瞬时）|

### 3.2 总节点数

- 路径总数：4+3+3+2+3+4+4+4+3+3+3+3+2+2 = **43 路径**
- 节点总数（含 depth=1 起点）：43 × 3 = **129 节点**
- 实点亮节点（不含 0 SP 起点）：43 × 2 = **86 节点**

### 3.3 统一节点命名规范

每路径命名遵循统一模板，便于策划与代码维护：

| 路径维度 | 路径 ID 后缀 | depth=1 名称 | depth=2 名称 | depth=3 名称 |
|---|---|---|---|---|
| 伤害 | `_damage` | 基础{法术名} | 强化{法术名} | 高伤{法术名}|
| 范围 | `_range` | 基础{法术名} | 扩散{法术名} | 广域{法术名}|
| 冷却 | `_cooldown` | 基础{法术名} | 急速{法术名} | 闪现{法术名}|
| 持续时间 | `_duration` | 基础{法术名} | 持久{法术名} | 永久{法术名}|

> 各法术具体节点名称根据法术风格微调（如火球术的"伤害路径" depth=2 = "烈焰火球"，箭雨术的"持续时间路径" depth=3 = "永恒箭雨"）。

---

## 4. 即时打击型法术（4 张）

### 4.1 火球术 · `fireball_spell`

**法术定位**：Common 即时打击，目标区域 r80 范围 80 火焰伤害。**4 维度全选**（火球同时有伤害 + 范围 + CD + 灼烧 DOT 持续时间）。

#### 4.1.1 4 路径概览

```
路径 1 · 伤害    [0]→[6]→[10]   基础火球 / 烈焰火球 / 地狱火球
路径 2 · 范围    [0]→[6]→[10]   基础火球 / 扩散火球 / 广域火球
路径 3 · 冷却    [0]→[6]→[10]   基础火球 / 急速火球 / 闪现火球
路径 4 · 灼烧    [0]→[6]→[10]   基础火球 / 持久火球 / 永焰火球
```

#### 4.1.2 4 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 伤害** | 基础火球（80 伤害）| 烈焰火球（伤害 ×1.4）| 地狱火球（伤害 ×1.4 累加 → ×1.96）|
| **2 · 范围** | 基础火球（r80）| 扩散火球（r ×1.3 → r104）| 广域火球（r ×1.3 累加 → r~135）|
| **3 · 冷却** | 基础火球（CD = 法术固有）| 急速火球（CD ×0.75）| 闪现火球（CD ×0.75 累加 → ×0.5625）|
| **4 · 灼烧持续** | 基础火球（命中附加灼烧 2s）| 持久火球（灼烧时长 +2s → 4s）| 永焰火球（灼烧时长 +3s 累加 → 7s）|

#### 4.1.3 YAML 配置

```yaml
fireball_spell:
  id: fireball_spell
  type: spell
  category: instant_strike
  skillTree:
    paths:
      - id: fireball_damage
        name: 伤害
        nodes:
          - id: fireball_basic_dmg
            name: 基础火球
            depth: 1
            spCost: 0
            effects: []
          - id: fireball_flame
            name: 烈焰火球
            depth: 2
            spCost: 6
            prerequisites: [fireball_basic_dmg]
            effects:
              - rule: mul_spell_damage
                value: 1.4
          - id: fireball_hellfire
            name: 地狱火球
            depth: 3
            spCost: 10
            prerequisites: [fireball_flame]
            effects:
              - rule: mul_spell_damage
                value: 1.4                      # 累加 → ×1.96
      - id: fireball_range
        name: 范围
        nodes:
          - id: fireball_basic_rng
            name: 基础火球
            depth: 1
            spCost: 0
            effects: []
          - id: fireball_diffuse
            name: 扩散火球
            depth: 2
            spCost: 6
            prerequisites: [fireball_basic_rng]
            effects:
              - rule: mul_spell_radius
                value: 1.3
          - id: fireball_wide
            name: 广域火球
            depth: 3
            spCost: 10
            prerequisites: [fireball_diffuse]
            effects:
              - rule: mul_spell_radius
                value: 1.3                      # 累加
      - id: fireball_cooldown
        name: 冷却
        nodes:
          - id: fireball_basic_cd
            name: 基础火球
            depth: 1
            spCost: 0
            effects: []
          - id: fireball_rapid
            name: 急速火球
            depth: 2
            spCost: 6
            prerequisites: [fireball_basic_cd]
            effects:
              - rule: mul_spell_cooldown
                value: 0.75
          - id: fireball_flash
            name: 闪现火球
            depth: 3
            spCost: 10
            prerequisites: [fireball_rapid]
            effects:
              - rule: mul_spell_cooldown
                value: 0.75                     # 累加 → ×0.5625
      - id: fireball_duration
        name: 灼烧持续
        nodes:
          - id: fireball_basic_dur
            name: 基础火球
            depth: 1
            spCost: 0
            effects: []
          - id: fireball_persistent
            name: 持久火球
            depth: 2
            spCost: 6
            prerequisites: [fireball_basic_dur]
            effects:
              - rule: add_burning_duration
                value: 2.0
          - id: fireball_eternal
            name: 永焰火球
            depth: 3
            spCost: 10
            prerequisites: [fireball_persistent]
            effects:
              - rule: add_burning_duration
                value: 3.0
```

### 4.2 陨石术 · `meteor_spell`

**法术定位**：Epic 即时打击，单格 300 火焰 + r80 30% 溅射。**3 路径**（无持续时间维度，单次爆炸结算）。

#### 4.2.1 路径概览

```
路径 1 · 伤害    [0]→[6]→[10]   基础陨石 / 致命陨石 / 灭世陨石
路径 2 · 范围    [0]→[6]→[10]   基础陨石 / 大型陨石 / 巨型陨石
路径 3 · 冷却    [0]→[6]→[10]   基础陨石 / 急速陨石 / 流星雨
```

#### 4.2.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 伤害** | 基础陨石（300 单格 + 30% 溅射）| 致命陨石（伤害 ×1.3）| 灭世陨石（伤害 ×1.3 累加 + 溅射比例 30% → 50%）|
| **2 · 范围** | 基础陨石（r80 溅射）| 大型陨石（溅射 r ×1.3 → r104）| 巨型陨石（溅射 r ×1.3 累加 → r~135）|
| **3 · 冷却** | 基础陨石 | 急速陨石（CD ×0.75）| 流星雨（CD ×0.75 累加 + 召唤后再连射 1 颗）|

#### 4.2.3 YAML 配置

```yaml
meteor_spell:
  id: meteor_spell
  type: spell
  category: instant_strike
  skillTree:
    paths:
      - id: meteor_damage
        name: 伤害
        nodes:
          - id: meteor_basic_dmg
            name: 基础陨石
            depth: 1
            spCost: 0
            effects: []
          - id: meteor_lethal
            name: 致命陨石
            depth: 2
            spCost: 6
            prerequisites: [meteor_basic_dmg]
            effects:
              - rule: mul_spell_damage
                value: 1.3
          - id: meteor_apocalypse
            name: 灭世陨石
            depth: 3
            spCost: 10
            prerequisites: [meteor_lethal]
            effects:
              - rule: mul_spell_damage
                value: 1.3                      # 累加
              - rule: add_splash_ratio
                value: 0.2                      # 30% → 50%
      - id: meteor_range
        name: 范围
        nodes:
          - id: meteor_basic_rng
            name: 基础陨石
            depth: 1
            spCost: 0
            effects: []
          - id: meteor_large
            name: 大型陨石
            depth: 2
            spCost: 6
            prerequisites: [meteor_basic_rng]
            effects:
              - rule: mul_spell_radius
                value: 1.3
          - id: meteor_giant
            name: 巨型陨石
            depth: 3
            spCost: 10
            prerequisites: [meteor_large]
            effects:
              - rule: mul_spell_radius
                value: 1.3                      # 累加
      - id: meteor_cooldown
        name: 冷却
        nodes:
          - id: meteor_basic_cd
            name: 基础陨石
            depth: 1
            spCost: 0
            effects: []
          - id: meteor_rapid
            name: 急速陨石
            depth: 2
            spCost: 6
            prerequisites: [meteor_basic_cd]
            effects:
              - rule: mul_spell_cooldown
                value: 0.75
          - id: meteor_shower
            name: 流星雨
            depth: 3
            spCost: 10
            prerequisites: [meteor_rapid]
            effects:
              - rule: mul_spell_cooldown
                value: 0.75                     # 累加
              - rule: add_extra_cast
                count: 1                        # 再连射 1 颗
```

### 4.3 闪电链 · `chain_lightning_spell`

**法术定位**：Rare 即时打击，单体 100 雷电 + 弹射 3 次（每次 -25%）。**3 路径**（范围 = 链跳数；无持续时间）。

#### 4.3.1 路径概览

```
路径 1 · 伤害    [0]→[6]→[10]   基础闪电链 / 高压闪电 / 雷神之锤
路径 2 · 链跳    [0]→[6]→[10]   基础闪电链 / 长链闪电 / 无穷链
路径 3 · 冷却    [0]→[6]→[10]   基础闪电链 / 急速闪电 / 连珠闪电
```

#### 4.3.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 伤害** | 基础闪电链（100 初始）| 高压闪电（伤害 ×1.3）| 雷神之锤（伤害 ×1.3 累加 + 衰减由 -25% → -15%）|
| **2 · 链跳** | 基础闪电链（3 跳）| 长链闪电（跳数 +1 → 4）| 无穷链（跳数 +2 累加 → 6 跳）|
| **3 · 冷却** | 基础闪电链 | 急速闪电（CD ×0.75）| 连珠闪电（CD ×0.75 累加）|

#### 4.3.3 YAML 配置

```yaml
chain_lightning_spell:
  id: chain_lightning_spell
  type: spell
  category: instant_strike
  skillTree:
    paths:
      - id: chain_damage
        name: 伤害
        nodes:
          - id: chain_basic_dmg
            name: 基础闪电链
            depth: 1
            spCost: 0
            effects: []
          - id: chain_high_voltage
            name: 高压闪电
            depth: 2
            spCost: 6
            prerequisites: [chain_basic_dmg]
            effects:
              - rule: mul_spell_damage
                value: 1.3
          - id: chain_thor_hammer
            name: 雷神之锤
            depth: 3
            spCost: 10
            prerequisites: [chain_high_voltage]
            effects:
              - rule: mul_spell_damage
                value: 1.3                      # 累加
              - rule: set_chain_decay
                value: 0.15                     # 衰减 -25% → -15%
      - id: chain_jumps
        name: 链跳
        nodes:
          - id: chain_basic_jp
            name: 基础闪电链
            depth: 1
            spCost: 0
            effects: []
          - id: chain_long
            name: 长链闪电
            depth: 2
            spCost: 6
            prerequisites: [chain_basic_jp]
            effects:
              - rule: add_chain_jumps
                value: 1
          - id: chain_infinite
            name: 无穷链
            depth: 3
            spCost: 10
            prerequisites: [chain_long]
            effects:
              - rule: add_chain_jumps
                value: 2
      - id: chain_cooldown
        name: 冷却
        nodes:
          - id: chain_basic_cd
            name: 基础闪电链
            depth: 1
            spCost: 0
            effects: []
          - id: chain_rapid
            name: 急速闪电
            depth: 2
            spCost: 6
            prerequisites: [chain_basic_cd]
            effects:
              - rule: mul_spell_cooldown
                value: 0.75
          - id: chain_machinegun
            name: 连珠闪电
            depth: 3
            spCost: 10
            prerequisites: [chain_rapid]
            effects:
              - rule: mul_spell_cooldown
                value: 0.75                     # 累加
```

### 4.4 净化术 · `purification_spell`

**法术定位**：Rare 即时打击（误归类），实际为单体净化 Buff（移除我方一个单位身上所有 Debuff + 回 30 HP）。**2 路径**（无伤害 + 无持续时间）。

#### 4.4.1 路径概览

```
路径 1 · 范围    [0]→[6]→[10]   基础净化 / 群体净化 / 圣光净化
路径 2 · 冷却    [0]→[6]→[10]   基础净化 / 急速净化 / 永恒净化
```

#### 4.4.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 范围** | 基础净化（单体）| 群体净化（影响 3 单位）| 圣光净化（影响 6 单位 + 治疗量 ×2）|
| **2 · 冷却** | 基础净化 | 急速净化（CD ×0.75）| 永恒净化（CD ×0.75 累加）|

#### 4.4.3 YAML 配置

```yaml
purification_spell:
  id: purification_spell
  type: spell
  category: instant_strike
  skillTree:
    paths:
      - id: purification_range
        name: 范围
        nodes:
          - id: purification_basic_rng
            name: 基础净化
            depth: 1
            spCost: 0
            effects: []
          - id: purification_mass
            name: 群体净化
            depth: 2
            spCost: 6
            prerequisites: [purification_basic_rng]
            effects:
              - rule: set_target_count
                value: 3
          - id: purification_holy
            name: 圣光净化
            depth: 3
            spCost: 10
            prerequisites: [purification_mass]
            effects:
              - rule: set_target_count
                value: 6
              - rule: mul_spell_heal
                value: 2.0
      - id: purification_cooldown
        name: 冷却
        nodes:
          - id: purification_basic_cd
            name: 基础净化
            depth: 1
            spCost: 0
            effects: []
          - id: purification_rapid
            name: 急速净化
            depth: 2
            spCost: 6
            prerequisites: [purification_basic_cd]
            effects:
              - rule: mul_spell_cooldown
                value: 0.75
          - id: purification_eternal
            name: 永恒净化
            depth: 3
            spCost: 10
            prerequisites: [purification_rapid]
            effects:
              - rule: mul_spell_cooldown
                value: 0.75                     # 累加
```

---

## 5. 区域控制型法术（4 张）

### 5.1 全屏冰冻 · `freeze_all_spell`

**法术定位**：Epic 区域控制，全屏敌人冰冻 2s。**3 路径**（无伤害；范围 = 影响目标比例）。

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 范围** | 基础全屏冰冻（100% 敌人）| 加强冰冻（含飞行敌）| 绝对冰封（含飞行敌 + Boss 50% 减速即使免疫冰冻）|
| **2 · 持续时间** | 基础冰冻（2s）| 持久冰冻（+1s → 3s）| 永冻领域（+2s 累加 → 5s）|
| **3 · 冷却** | 基础冷却 | 急速冰冻（CD ×0.75）| 闪现冰冻（CD ×0.75 累加）|

```yaml
freeze_all_spell:
  id: freeze_all_spell
  type: spell
  category: area_control
  skillTree:
    paths:
      - id: freeze_all_range
        name: 范围
        nodes:
          - {id: freeze_all_basic_rng, name: 基础全屏冰冻, depth: 1, spCost: 0, effects: []}
          - id: freeze_all_extended
            name: 加强冰冻
            depth: 2
            spCost: 6
            prerequisites: [freeze_all_basic_rng]
            effects: [{rule: add_target_filter, layer: LowAir}]
          - id: freeze_all_absolute
            name: 绝对冰封
            depth: 3
            spCost: 10
            prerequisites: [freeze_all_extended]
            effects: [{rule: add_partial_effect_on_immune, slowRatio: 0.5}]
      - id: freeze_all_duration
        name: 持续时间
        nodes:
          - {id: freeze_all_basic_dur, name: 基础全屏冰冻, depth: 1, spCost: 0, effects: []}
          - id: freeze_all_persistent
            name: 持久冰冻
            depth: 2
            spCost: 6
            prerequisites: [freeze_all_basic_dur]
            effects: [{rule: add_spell_duration, value: 1.0}]
          - id: freeze_all_eternal
            name: 永冻领域
            depth: 3
            spCost: 10
            prerequisites: [freeze_all_persistent]
            effects: [{rule: add_spell_duration, value: 2.0}]
      - id: freeze_all_cooldown
        name: 冷却
        nodes:
          - {id: freeze_all_basic_cd, name: 基础全屏冰冻, depth: 1, spCost: 0, effects: []}
          - id: freeze_all_rapid
            name: 急速冰冻
            depth: 2
            spCost: 6
            prerequisites: [freeze_all_basic_cd]
            effects: [{rule: mul_spell_cooldown, value: 0.75}]
          - id: freeze_all_flash
            name: 闪现冰冻
            depth: 3
            spCost: 10
            prerequisites: [freeze_all_rapid]
            effects: [{rule: mul_spell_cooldown, value: 0.75}]
```

### 5.2 减速术 · `slow_spell`

**法术定位**：Common 区域控制，目标区域所有敌人 -50% 移速 / 3s。**4 路径全选**。

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 减速量（伤害维度映射）** | -50% 移速 | -60% 移速 | -75% 移速 |
| **2 · 范围** | r80 | r ×1.3 → r104 | r ×1.3 累加 → r~135 |
| **3 · 冷却** | 基础冷却 | CD ×0.75 | CD ×0.75 累加 |
| **4 · 持续时间** | 3s | +2s → 5s | +3s 累加 → 8s |

```yaml
slow_spell:
  id: slow_spell
  type: spell
  category: area_control
  skillTree:
    paths:
      - id: slow_amount
        name: 减速量
        nodes:
          - {id: slow_basic_amt, name: 基础减速, depth: 1, spCost: 0, effects: []}
          - id: slow_severe
            name: 重度减速
            depth: 2
            spCost: 6
            prerequisites: [slow_basic_amt]
            effects: [{rule: add_slow_amount, value: 0.1}]
          - id: slow_paralyze
            name: 麻痹减速
            depth: 3
            spCost: 10
            prerequisites: [slow_severe]
            effects: [{rule: add_slow_amount, value: 0.15}]
      - id: slow_range
        name: 范围
        nodes:
          - {id: slow_basic_rng, name: 基础减速, depth: 1, spCost: 0, effects: []}
          - id: slow_wide
            name: 扩散减速
            depth: 2
            spCost: 6
            prerequisites: [slow_basic_rng]
            effects: [{rule: mul_spell_radius, value: 1.3}]
          - id: slow_area
            name: 广域减速
            depth: 3
            spCost: 10
            prerequisites: [slow_wide]
            effects: [{rule: mul_spell_radius, value: 1.3}]
      - id: slow_cooldown
        name: 冷却
        nodes:
          - {id: slow_basic_cd, name: 基础减速, depth: 1, spCost: 0, effects: []}
          - id: slow_rapid
            name: 急速减速
            depth: 2
            spCost: 6
            prerequisites: [slow_basic_cd]
            effects: [{rule: mul_spell_cooldown, value: 0.75}]
          - id: slow_flash
            name: 闪现减速
            depth: 3
            spCost: 10
            prerequisites: [slow_rapid]
            effects: [{rule: mul_spell_cooldown, value: 0.75}]
      - id: slow_duration
        name: 持续时间
        nodes:
          - {id: slow_basic_dur, name: 基础减速, depth: 1, spCost: 0, effects: []}
          - id: slow_persistent
            name: 持久减速
            depth: 2
            spCost: 6
            prerequisites: [slow_basic_dur]
            effects: [{rule: add_spell_duration, value: 2.0}]
          - id: slow_eternal
            name: 永恒减速
            depth: 3
            spCost: 10
            prerequisites: [slow_persistent]
            effects: [{rule: add_spell_duration, value: 3.0}]
```

### 5.3 箭雨术 · `arrow_rain_spell`

**法术定位**：Rare 区域控制，目标区域 5s 内每秒 30 物理。**4 路径全选**。

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 伤害** | 30 DPS | DPS ×1.3 → ~39 | DPS ×1.3 累加 → ~51 |
| **2 · 范围** | r80 | r ×1.3 → r104 | r ×1.3 累加 |
| **3 · 冷却** | 基础冷却 | CD ×0.75 | CD ×0.75 累加 |
| **4 · 持续时间** | 5s | +2s → 7s | +3s 累加 → 10s（"永恒箭雨"）|

```yaml
arrow_rain_spell:
  id: arrow_rain_spell
  type: spell
  category: area_control
  skillTree:
    paths:
      - id: arrow_rain_damage
        name: 伤害
        nodes:
          - {id: arrow_rain_basic_dmg, name: 基础箭雨, depth: 1, spCost: 0, effects: []}
          - {id: arrow_rain_heavy, name: 重型箭雨, depth: 2, spCost: 6, prerequisites: [arrow_rain_basic_dmg], effects: [{rule: mul_spell_dps, value: 1.3}]}
          - {id: arrow_rain_storm, name: 风暴箭雨, depth: 3, spCost: 10, prerequisites: [arrow_rain_heavy], effects: [{rule: mul_spell_dps, value: 1.3}]}
      - id: arrow_rain_range
        name: 范围
        nodes:
          - {id: arrow_rain_basic_rng, name: 基础箭雨, depth: 1, spCost: 0, effects: []}
          - {id: arrow_rain_wide, name: 扩散箭雨, depth: 2, spCost: 6, prerequisites: [arrow_rain_basic_rng], effects: [{rule: mul_spell_radius, value: 1.3}]}
          - {id: arrow_rain_area, name: 广域箭雨, depth: 3, spCost: 10, prerequisites: [arrow_rain_wide], effects: [{rule: mul_spell_radius, value: 1.3}]}
      - id: arrow_rain_cooldown
        name: 冷却
        nodes:
          - {id: arrow_rain_basic_cd, name: 基础箭雨, depth: 1, spCost: 0, effects: []}
          - {id: arrow_rain_rapid, name: 急速箭雨, depth: 2, spCost: 6, prerequisites: [arrow_rain_basic_cd], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
          - {id: arrow_rain_flash, name: 闪现箭雨, depth: 3, spCost: 10, prerequisites: [arrow_rain_rapid], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
      - id: arrow_rain_duration
        name: 持续时间
        nodes:
          - {id: arrow_rain_basic_dur, name: 基础箭雨, depth: 1, spCost: 0, effects: []}
          - {id: arrow_rain_persistent, name: 持久箭雨, depth: 2, spCost: 6, prerequisites: [arrow_rain_basic_dur], effects: [{rule: add_spell_duration, value: 2.0}]}
          - {id: arrow_rain_eternal, name: 永恒箭雨, depth: 3, spCost: 10, prerequisites: [arrow_rain_persistent], effects: [{rule: add_spell_duration, value: 3.0}]}
```

### 5.4 龙卷术 · `tornado_spell`

**法术定位**：Epic 区域控制，龙卷沿路径移动 5s，每秒推 40px、击退 + 20 物理。**4 路径全选**。

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 伤害** | 20 物理/s | ×1.3 → 26 | ×1.3 累加 → ~34 |
| **2 · 范围（推力宽度）**| 单路径宽度 | 路径宽 +1 trap_path 单元 | 路径宽 +2 累加 |
| **3 · 冷却** | 基础冷却 | CD ×0.75 | CD ×0.75 累加 |
| **4 · 持续时间** | 5s | +2s → 7s | +3s 累加 → 10s |

```yaml
tornado_spell:
  id: tornado_spell
  type: spell
  category: area_control
  skillTree:
    paths:
      - id: tornado_damage
        name: 伤害
        nodes:
          - {id: tornado_basic_dmg, name: 基础龙卷, depth: 1, spCost: 0, effects: []}
          - {id: tornado_heavy, name: 强力龙卷, depth: 2, spCost: 6, prerequisites: [tornado_basic_dmg], effects: [{rule: mul_spell_dps, value: 1.3}]}
          - {id: tornado_storm, name: 风暴龙卷, depth: 3, spCost: 10, prerequisites: [tornado_heavy], effects: [{rule: mul_spell_dps, value: 1.3}]}
      - id: tornado_width
        name: 宽度
        nodes:
          - {id: tornado_basic_w, name: 基础龙卷, depth: 1, spCost: 0, effects: []}
          - {id: tornado_wide, name: 扩散龙卷, depth: 2, spCost: 6, prerequisites: [tornado_basic_w], effects: [{rule: add_path_width, value: 1}]}
          - {id: tornado_area, name: 广域龙卷, depth: 3, spCost: 10, prerequisites: [tornado_wide], effects: [{rule: add_path_width, value: 2}]}
      - id: tornado_cooldown
        name: 冷却
        nodes:
          - {id: tornado_basic_cd, name: 基础龙卷, depth: 1, spCost: 0, effects: []}
          - {id: tornado_rapid, name: 急速龙卷, depth: 2, spCost: 6, prerequisites: [tornado_basic_cd], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
          - {id: tornado_flash, name: 闪现龙卷, depth: 3, spCost: 10, prerequisites: [tornado_rapid], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
      - id: tornado_duration
        name: 持续时间
        nodes:
          - {id: tornado_basic_dur, name: 基础龙卷, depth: 1, spCost: 0, effects: []}
          - {id: tornado_persistent, name: 持久龙卷, depth: 2, spCost: 6, prerequisites: [tornado_basic_dur], effects: [{rule: add_spell_duration, value: 2.0}]}
          - {id: tornado_eternal, name: 永恒龙卷, depth: 3, spCost: 10, prerequisites: [tornado_persistent], effects: [{rule: add_spell_duration, value: 3.0}]}
```

---

## 6. 增益持续型法术（3 张）

### 6.1 治疗脉冲 · `heal_pulse_spell`

**法术定位**：Rare 增益持续，我方全场 HP +100。**3 路径**（无伤害）。

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 治疗量（伤害维度）** | 100 HP | ×1.3 → 130 | ×1.3 累加 → ~169 |
| **2 · 冷却** | 基础冷却 | CD ×0.75 | CD ×0.75 累加 |
| **3 · HoT 持续** | 瞬时 | 改为 3s HoT 治疗 | 改为 5s HoT 治疗（同总治疗量分摊）|

```yaml
heal_pulse_spell:
  id: heal_pulse_spell
  type: spell
  category: sustained_buff
  skillTree:
    paths:
      - id: heal_pulse_amount
        name: 治疗量
        nodes:
          - {id: heal_pulse_basic_amt, name: 基础治疗脉冲, depth: 1, spCost: 0, effects: []}
          - {id: heal_pulse_strong, name: 强力治疗, depth: 2, spCost: 6, prerequisites: [heal_pulse_basic_amt], effects: [{rule: mul_spell_heal, value: 1.3}]}
          - {id: heal_pulse_divine, name: 神圣治疗, depth: 3, spCost: 10, prerequisites: [heal_pulse_strong], effects: [{rule: mul_spell_heal, value: 1.3}]}
      - id: heal_pulse_cooldown
        name: 冷却
        nodes:
          - {id: heal_pulse_basic_cd, name: 基础治疗脉冲, depth: 1, spCost: 0, effects: []}
          - {id: heal_pulse_rapid, name: 急速治疗, depth: 2, spCost: 6, prerequisites: [heal_pulse_basic_cd], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
          - {id: heal_pulse_flash, name: 闪现治疗, depth: 3, spCost: 10, prerequisites: [heal_pulse_rapid], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
      - id: heal_pulse_duration
        name: HoT 持续
        nodes:
          - {id: heal_pulse_basic_dur, name: 基础治疗脉冲, depth: 1, spCost: 0, effects: []}
          - {id: heal_pulse_hot, name: 持续治疗, depth: 2, spCost: 6, prerequisites: [heal_pulse_basic_dur], effects: [{rule: convert_to_hot, duration: 3.0}]}
          - {id: heal_pulse_eternal, name: 永恒治疗, depth: 3, spCost: 10, prerequisites: [heal_pulse_hot], effects: [{rule: add_spell_duration, value: 2.0}]}
```

### 6.2 神圣庇护 · `divine_protection_spell`

**法术定位**：Legendary 增益持续，水晶本波内额外承受 N 次秒杀不扣 HP（跨波保留）。**3 路径**。

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 次数（范围维度映射）** | 3 次秒杀保护 | +2 → 5 次 | +3 累加 → 8 次 |
| **2 · 冷却** | 基础冷却 | CD ×0.75 | CD ×0.75 累加 |
| **3 · 持续波数** | 本波（1 波）| 本波 +1 波 → 2 波 | 本波 +2 波累加 → 3 波 |

```yaml
divine_protection_spell:
  id: divine_protection_spell
  type: spell
  category: sustained_buff
  skillTree:
    paths:
      - id: divine_charges
        name: 保护次数
        nodes:
          - {id: divine_basic_chg, name: 基础神圣庇护, depth: 1, spCost: 0, effects: []}
          - {id: divine_more, name: 加强庇护, depth: 2, spCost: 6, prerequisites: [divine_basic_chg], effects: [{rule: add_protection_charges, value: 2}]}
          - {id: divine_supreme, name: 至高庇护, depth: 3, spCost: 10, prerequisites: [divine_more], effects: [{rule: add_protection_charges, value: 3}]}
      - id: divine_cooldown
        name: 冷却
        nodes:
          - {id: divine_basic_cd, name: 基础神圣庇护, depth: 1, spCost: 0, effects: []}
          - {id: divine_rapid, name: 急速庇护, depth: 2, spCost: 6, prerequisites: [divine_basic_cd], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
          - {id: divine_flash, name: 闪现庇护, depth: 3, spCost: 10, prerequisites: [divine_rapid], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
      - id: divine_duration
        name: 持续波数
        nodes:
          - {id: divine_basic_dur, name: 基础神圣庇护, depth: 1, spCost: 0, effects: []}
          - {id: divine_persistent, name: 持久庇护, depth: 2, spCost: 6, prerequisites: [divine_basic_dur], effects: [{rule: add_protection_waves, value: 1}]}
          - {id: divine_eternal, name: 永恒庇护, depth: 3, spCost: 10, prerequisites: [divine_persistent], effects: [{rule: add_protection_waves, value: 2}]}
```

### 6.3 集结号 · `rally_horn_spell`

**法术定位**：Rare 增益持续，我方全体 +25% 攻速 + 10% 移速 / 15s。**3 路径**。

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 光环半径（范围）** | 全屏 | 全屏 + 友方移速 +5% | 全屏 + 友方移速 +10% 累加 + 攻速 +10% 累加 |
| **2 · 冷却** | 基础冷却 | CD ×0.75 | CD ×0.75 累加 |
| **3 · 持续时间** | 15s | +5s → 20s | +10s 累加 → 30s |

```yaml
rally_horn_spell:
  id: rally_horn_spell
  type: spell
  category: sustained_buff
  skillTree:
    paths:
      - id: rally_buff_strength
        name: 光环效果
        nodes:
          - {id: rally_basic_buf, name: 基础集结号, depth: 1, spCost: 0, effects: []}
          - {id: rally_strong, name: 强力集结号, depth: 2, spCost: 6, prerequisites: [rally_basic_buf], effects: [{rule: add_move_speed_buff, value: 0.05}]}
          - {id: rally_supreme, name: 至高集结号, depth: 3, spCost: 10, prerequisites: [rally_strong], effects: [{rule: add_move_speed_buff, value: 0.1}, {rule: add_atk_speed_buff, value: 0.1}]}
      - id: rally_cooldown
        name: 冷却
        nodes:
          - {id: rally_basic_cd, name: 基础集结号, depth: 1, spCost: 0, effects: []}
          - {id: rally_rapid, name: 急速集结号, depth: 2, spCost: 6, prerequisites: [rally_basic_cd], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
          - {id: rally_flash, name: 闪现集结号, depth: 3, spCost: 10, prerequisites: [rally_rapid], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
      - id: rally_duration
        name: 持续时间
        nodes:
          - {id: rally_basic_dur, name: 基础集结号, depth: 1, spCost: 0, effects: []}
          - {id: rally_persistent, name: 持久集结号, depth: 2, spCost: 6, prerequisites: [rally_basic_dur], effects: [{rule: add_spell_duration, value: 5.0}]}
          - {id: rally_eternal, name: 永恒集结号, depth: 3, spCost: 10, prerequisites: [rally_persistent], effects: [{rule: add_spell_duration, value: 10.0}]}
```

---

## 7. 战略召唤/全局型法术（3 张）

### 7.1 召唤骷髅 · `summon_skeletons_spell`

**法术定位**：Legendary 战略召唤，召唤 5 个 30 HP / 8 ATK 骷髅。**3 路径**（无伤害）。

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 召唤数量（范围）** | 5 个骷髅 | +2 → 7 个 | +3 累加 → 10 个 |
| **2 · 冷却** | 基础冷却 | CD ×0.75 | CD ×0.75 累加 |
| **3 · 生存时长（持续时间）** | 整波 | 整波 + 跨波保留 | 整波 + 跨波保留 + 死亡 50% 概率复活 1 次 |

```yaml
summon_skeletons_spell:
  id: summon_skeletons_spell
  type: spell
  category: strategic_summon
  skillTree:
    paths:
      - id: summon_count
        name: 召唤数量
        nodes:
          - {id: summon_basic_cnt, name: 基础召唤骷髅, depth: 1, spCost: 0, effects: []}
          - {id: summon_more, name: 加强召唤, depth: 2, spCost: 6, prerequisites: [summon_basic_cnt], effects: [{rule: add_summon_count, value: 2}]}
          - {id: summon_horde, name: 骷髅大军, depth: 3, spCost: 10, prerequisites: [summon_more], effects: [{rule: add_summon_count, value: 3}]}
      - id: summon_cooldown
        name: 冷却
        nodes:
          - {id: summon_basic_cd, name: 基础召唤骷髅, depth: 1, spCost: 0, effects: []}
          - {id: summon_rapid, name: 急速召唤, depth: 2, spCost: 6, prerequisites: [summon_basic_cd], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
          - {id: summon_flash, name: 闪现召唤, depth: 3, spCost: 10, prerequisites: [summon_rapid], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
      - id: summon_duration
        name: 生存时长
        nodes:
          - {id: summon_basic_dur, name: 基础召唤骷髅, depth: 1, spCost: 0, effects: []}
          - {id: summon_persistent, name: 持久召唤, depth: 2, spCost: 6, prerequisites: [summon_basic_dur], effects: [{rule: enable_cross_wave_persistence}]}
          - {id: summon_eternal, name: 永恒召唤, depth: 3, spCost: 10, prerequisites: [summon_persistent], effects: [{rule: add_resurrection_chance, value: 0.5}]}
```

### 7.2 时间膨胀 · `time_dilation_spell`

**法术定位**：Legendary 战略召唤，全场敌人 50% 时间流速 8s（己方正常）。**2 路径**（无伤害 + 无范围 = 全屏固定）。

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 冷却** | 基础冷却 | CD ×0.75 | CD ×0.75 累加 |
| **2 · 持续时间** | 8s | +3s → 11s | +5s 累加 → 16s |

```yaml
time_dilation_spell:
  id: time_dilation_spell
  type: spell
  category: strategic_summon
  skillTree:
    paths:
      - id: time_dilation_cooldown
        name: 冷却
        nodes:
          - {id: time_basic_cd, name: 基础时间膨胀, depth: 1, spCost: 0, effects: []}
          - {id: time_rapid, name: 急速时间膨胀, depth: 2, spCost: 6, prerequisites: [time_basic_cd], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
          - {id: time_flash, name: 闪现时间膨胀, depth: 3, spCost: 10, prerequisites: [time_rapid], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
      - id: time_dilation_duration
        name: 持续时间
        nodes:
          - {id: time_basic_dur, name: 基础时间膨胀, depth: 1, spCost: 0, effects: []}
          - {id: time_persistent, name: 持久时间膨胀, depth: 2, spCost: 6, prerequisites: [time_basic_dur], effects: [{rule: add_spell_duration, value: 3.0}]}
          - {id: time_eternal, name: 永恒时间膨胀, depth: 3, spCost: 10, prerequisites: [time_persistent], effects: [{rule: add_spell_duration, value: 5.0}]}
```

### 7.3 战术撤退 · `tactical_retreat_spell`

**法术定位**：Common 战略召唤，选中我方单位返回手牌，退回 60% 能量。**2 路径**（无伤害 + 无持续时间）。

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 范围（返还能量比例）**| 60% 能量 | +15% → 75% 能量 | +25% 累加 → 100% 能量 |
| **2 · 冷却** | 基础冷却 | CD ×0.75 | CD ×0.75 累加 |

```yaml
tactical_retreat_spell:
  id: tactical_retreat_spell
  type: spell
  category: strategic_summon
  skillTree:
    paths:
      - id: retreat_refund
        name: 能量返还
        nodes:
          - {id: retreat_basic_rf, name: 基础战术撤退, depth: 1, spCost: 0, effects: []}
          - {id: retreat_better, name: 强化战术撤退, depth: 2, spCost: 6, prerequisites: [retreat_basic_rf], effects: [{rule: add_energy_refund_ratio, value: 0.15}]}
          - {id: retreat_full, name: 完美撤退, depth: 3, spCost: 10, prerequisites: [retreat_better], effects: [{rule: add_energy_refund_ratio, value: 0.25}]}
      - id: retreat_cooldown
        name: 冷却
        nodes:
          - {id: retreat_basic_cd, name: 基础战术撤退, depth: 1, spCost: 0, effects: []}
          - {id: retreat_rapid, name: 急速战术撤退, depth: 2, spCost: 6, prerequisites: [retreat_basic_cd], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
          - {id: retreat_flash, name: 闪现战术撤退, depth: 3, spCost: 10, prerequisites: [retreat_rapid], effects: [{rule: mul_spell_cooldown, value: 0.75}]}
```

---

## 8. 14 法术 SP 总需求与流派覆盖

### 8.1 SP 总需求矩阵

| 法术 ID | 路径数 | 单路径满级 | 全路径全满 |
|---|---|---|---|
| `fireball_spell` | 4 | 16 SP | 64 SP |
| `meteor_spell` | 3 | 16 SP | 48 SP |
| `chain_lightning_spell` | 3 | 16 SP | 48 SP |
| `purification_spell` | 2 | 16 SP | 32 SP |
| `freeze_all_spell` | 3 | 16 SP | 48 SP |
| `slow_spell` | 4 | 16 SP | 64 SP |
| `arrow_rain_spell` | 4 | 16 SP | 64 SP |
| `tornado_spell` | 4 | 16 SP | 64 SP |
| `heal_pulse_spell` | 3 | 16 SP | 48 SP |
| `divine_protection_spell` | 3 | 16 SP | 48 SP |
| `rally_horn_spell` | 3 | 16 SP | 48 SP |
| `summon_skeletons_spell` | 3 | 16 SP | 48 SP |
| `time_dilation_spell` | 2 | 16 SP | 32 SP |
| `tactical_retreat_spell` | 2 | 16 SP | 32 SP |
| **合计** | **43 路径** | — | **688 SP** |

### 8.2 单 Run SP 预算策略示范（基于 100 SP 中位流量）

| 策略 | SP 分配 | 适合玩法 |
|---|---|---|
| **法术速攻流** | 3 法术 × 16 SP = 48 SP（剩 52 SP 投塔/兵）| 主战略法术（如火球术伤害路径）+ 应急法术（如冰冻 CD 路径）|
| **法术全维度** | 1 法术 × 48-64 SP（剩 36-52 SP 投他处）| 单一关键法术全路径强化（适合 Boss 战 / 终战）|
| **法术辅助流** | 1 法术 × 16 SP + 余 84 SP 投塔/兵/陷阱 | 弱投入法术，仅强化最关键的 1 条路径 |

### 8.3 设计意图

- **法术单卡 SP 上限较高**（4 路径全满 64 SP）：留出"超深耕单法术"流派空间，但需要消耗 50%+ 单 Run SP 流量。
- **法术 SP 投入呈倒金字塔**：单路径强化（16 SP）即可大幅提升法术效果，双路径（32 SP）已是大投入。
- **法术 vs 塔 vs 士兵 vs 陷阱**：玩家在 4 类单位间分配 SP 是 Roguelike 策略核心。

---

## 9. 与 instanceLevel 正交边界铁律

### 9.1 两个机制的正交关系

| 维度 | 技能树（22d）| instanceLevel（[23-skill-buff §7](./23-skill-buff.md#7-instancelevel-法术卡提升机制)）|
|---|---|---|
| 强化时点 | 本 Run SP 投入（关后技能树面板）| 关内战斗中（"精炼术"法术卡触发）|
| 强化范围 | 本 Run 法术每次释放都生效 | 仅本局战斗，法术每次释放都生效 |
| 强化对象 | **法术参数维度**（伤害/范围/CD/持续时间）| **法术总伤害/总效果倍率**（不分维度）|
| 重置时机 | Run 结束清零 | 关卡结束清零 |
| 货币 | SP（技能点）| 战场能量 + 法术槽 |

### 9.2 正交关键点（**铁律**）

1. **technique tree 节点 `effects[]` 严禁出现 `add_instance_level` RuleHandler**。两个机制独立维护。
2. **运行时叠加**：法术效果 = `基础值 × 技能树效果 × instanceLevel 倍率`。例如：
   ```
   final_damage = baseDamage × pathDamageMul × (1 + instanceLevel × 0.1)
   ```
3. **UI 显示分离**：关后技能树面板只显示 SP 投入；关内 HUD 法术槽显示 instanceLevel。

### 9.3 玩家心智模型

| 玩家想要 | 选择 | 时机 |
|---|---|---|
| "我想让火球术整 Run 一直伤害更高" | **技能树**（22d 火球术伤害路径）| 关后面板，SP 投入 |
| "我想让本局某个火球术更强" | **instanceLevel**（精炼术法术卡）| 关内手牌触发 |

---

## 10. RuleHandler 引用清单

### 10.1 通用法术维度类（v3.4 法术新增）

| RuleHandler | 用途 | 引用法术（路径维度）|
|---|---|---|
| `mul_spell_damage` | 法术伤害倍率 | fireball / meteor / chain_lightning（伤害路径）|
| `mul_spell_radius` | 法术半径倍率 | fireball / meteor / slow / arrow_rain（范围路径）|
| `mul_spell_cooldown` | 法术 CD 倍率 | 所有 14 法术（冷却路径）|
| `mul_spell_dps` | 法术 DPS 倍率 | arrow_rain / tornado（伤害路径）|
| `mul_spell_heal` | 法术治疗量倍率 | purification / heal_pulse（治疗 / 范围路径）|
| `add_spell_duration` | 法术持续时间 +N 秒 | 多数有持续时间的法术 |

### 10.2 即时打击型专用

| RuleHandler | 用途 | 引用法术（节点）|
|---|---|---|
| `add_burning_duration` | 灼烧 DOT 持续时长 | fireball（灼烧持续）|
| `add_splash_ratio` | 溅射比例 | meteor（灭世）|
| `add_extra_cast` | 额外连射次数 | meteor（流星雨）|
| `add_chain_jumps` | 链跳数 +N | chain_lightning（链跳）|
| `set_chain_decay` | 链伤害衰减率 | chain_lightning（雷神之锤）|
| `set_target_count` | 设置目标数量 | purification（群体 / 圣光）|

### 10.3 区域控制型专用

| RuleHandler | 用途 | 引用法术（节点）|
|---|---|---|
| `add_target_filter` | 目标过滤器附加（如飞行敌）| freeze_all（加强冰冻）|
| `add_partial_effect_on_immune` | 对免疫单位生效部分效果 | freeze_all（绝对冰封）|
| `add_slow_amount` | 减速量 +N（绝对值，沿用 22c）| slow_spell（路径 1）|
| `add_path_width` | 路径覆盖宽度 +N | tornado（宽度路径）|

### 10.4 增益持续型专用

| RuleHandler | 用途 | 引用法术（节点）|
|---|---|---|
| `convert_to_hot` | 转换为 HoT 治疗模式 | heal_pulse（持续治疗）|
| `add_protection_charges` | 保护次数 +N | divine_protection（次数路径）|
| `add_protection_waves` | 保护持续波数 +N | divine_protection（持续波数）|
| `add_move_speed_buff` | 移速 Buff +N | rally_horn（强力）|
| `add_atk_speed_buff` | 攻速 Buff +N | rally_horn（至高）|

### 10.5 战略召唤型专用

| RuleHandler | 用途 | 引用法术（节点）|
|---|---|---|
| `add_summon_count` | 召唤数量 +N | summon_skeletons（数量路径）|
| `enable_cross_wave_persistence` | 启用跨波保留 | summon_skeletons（持久）|
| `add_resurrection_chance` | 死亡复活概率 | summon_skeletons（永恒）|
| `add_energy_refund_ratio` | 能量返还比例 +N | tactical_retreat（返还路径）|

**新增 RuleHandler 数量**：本文档共需新增 23 个 RuleHandler（其中 1 个与 22c 共享 `add_slow_amount`，22 个本文档新增 / 法术专用）。

---

## 11. v3.4 不变式核对

| 不变式 | 权威文档 | 本文档执行情况 |
|---|---|---|
| 火花碎片词汇彻底废弃 | [v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) | ✅ 全文 0 处「火花碎片」「shard」「碎片」|
| meta 永久积累机制取消 | [11-economy §4](../10-gameplay/11-economy.md) | ✅ 全文 0 处「永久解锁」「跨 Run」|
| 数值真理源唯一 | [50-mda](../50-data-numerical/50-mda.md) | ✅ 所有 `spCost` 严格命中 §17.3 锚点（0/6/10）|
| 节点深度 SP 单价锚点 | [50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点) | ✅ 全 14 法术 43 路径 depth=1/2/3 = 0/6/10 命中 |
| 单位卡入手默认形态 | [22-skill-tree-overview §7.3](./22-skill-tree-overview.md#73-depth1-起点-sp-单价为-0-还是-3) | ✅ 全部 depth=1 节点 spCost=0 |
| 路径互斥单装备 | [22-skill-tree-overview §4](./22-skill-tree-overview.md#4-路径互斥与装备切换) | ✅ 全文未引入"多路径同时装备"机制（法术 4 路径互斥单装备）|
| 关内禁止点亮 / 切换装备 | [22-skill-tree-overview §4.4](./22-skill-tree-overview.md#44-关内禁止点亮--切换装备) | ✅ 全文 0 处"关内升级"提及 |
| **与 instanceLevel 正交（铁律）**| [22-skill-tree-overview §6.2](./22-skill-tree-overview.md#62-正交关键点铁律) + 本文档 §9 | ✅ 全文 effects[] 0 处 `add_instance_level` 引用 |
| 法术能量成本不可由 SP 修改 | 本文档 §2.4 | ✅ 全文 effects[] 0 处 `mul_spell_energy_cost` / `add_spell_energy_refund`（除战术撤退本就基于法术机制设计的能量返还）引用 |

---

## 12. 修订历史

| 版本 | 日期 | 类型 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮第 5 份创建**：法术卡技能树详设权威。12 章覆盖：文档定位 / 通用约定 / 法术分类与路径维度选择（4 维度池）/ 4 即时打击型法术（fireball / meteor / chain_lightning / purification）+ 4 区域控制型法术（freeze_all / slow / arrow_rain / tornado）+ 3 增益持续型法术（heal_pulse / divine_protection / rally_horn）+ 3 战略召唤型法术（summon_skeletons / time_dilation / tactical_retreat）/ SP 总需求矩阵 / 与 instanceLevel 正交边界铁律 / RuleHandler 引用清单（23 个）/ v3.4 9 项不变式核对。**v3.4 全新创建（无 v3.1 蓝本）**。**用户决策（弹性 2-4 路径）**：14 法术按机制相关性弹性选择 2-4 路径，避免 168 节点膨胀；总计 43 路径 / 129 节点。 |
