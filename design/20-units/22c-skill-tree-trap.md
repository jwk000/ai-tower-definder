---
title: 陷阱技能树详设（v3.4）
status: authoritative
version: 1.0.0
last-modified: 2026-05-15
authority-for:
  - trap-skill-tree
  - trap-path-nodes
  - trap-skill-tree-yaml
cross-refs:
  - 20-units/22-skill-tree-overview.md
  - 20-units/22a-skill-tree-tower.md
  - 20-units/22b-skill-tree-soldier.md
  - 20-units/21-unit-roster.md
  - 20-units/27-traps-spells-scene.md
  - 50-data-numerical/50-mda.md
  - 60-tech/60-architecture.md
  - v3.4-MAJOR-MIGRATION.md
---

# 陷阱技能树详设（v3.4）

> ⭐ **本文档是 9 个陷阱单位技能树的唯一权威详设**。所有节点 ID / 路径 ID / SP 单价 / RuleHandler 引用以本文档为准；通用骨架见 [22-skill-tree-overview](./22-skill-tree-overview.md)。

> 🆕 **本文档为 v3.4 全新创建**。v3.1 阶段陷阱无技能树。v3.4 引入 SP 系统后，陷阱获得轻量级 2 路径技能树，围绕 **"耐久 / 触发次数"** 与 **"范围 / 烈度"** 两条主线。

---

## 目录

- [1. 文档定位与读法](#1-文档定位与读法)
- [2. 通用约定](#2-通用约定)
- [3. 九陷阱技能树清单（概览）](#3-九陷阱技能树清单概览)
- [4. 触发式陷阱（4 种）](#4-触发式陷阱4-种)
  - [4.1 尖刺陷阱 · `spike_trap`](#41-尖刺陷阱--spike_trap)
  - [4.2 地雷 · `landmine`](#42-地雷--landmine)
  - [4.3 焦油坑 · `tar_pit`](#43-焦油坑--tar_pit)
  - [4.4 捕兽夹 · `bear_trap`](#44-捕兽夹--bear_trap)
- [5. 区域式陷阱（3 种）](#5-区域式陷阱3-种)
  - [5.1 火墙 · `fire_wall`](#51-火墙--fire_wall)
  - [5.2 寒霜雾 · `frost_mist`](#52-寒霜雾--frost_mist)
  - [5.3 引力井 · `gravity_well`](#53-引力井--gravity_well)
- [6. 占路式陷阱（2 种）](#6-占路式陷阱2-种)
  - [6.1 巨石 · `boulder`](#61-巨石--boulder)
  - [6.2 诱饵假人 · `decoy_dummy`](#62-诱饵假人--decoy_dummy)
- [7. 九陷阱 SP 总需求与流派覆盖](#7-九陷阱-sp-总需求与流派覆盖)
- [8. RuleHandler 引用清单](#8-rulehandler-引用清单)
- [9. v3.4 不变式核对](#9-v34-不变式核对)
- [10. 修订历史](#10-修订历史)

---

## 1. 文档定位与读法

### 1.1 本文档负责什么

本文档**只**负责陷阱单位（`category: Trap`）的技能树详设，每陷阱一节，内容包括：

- 陷阱定位 + 占位类型（trap_path / 多格区域 / blocked tile）
- 路径表（2 路径方向：耐久向 vs 范围/烈度向）
- YAML 配置示例
- RuleHandler 引用说明

### 1.2 本文档**不**负责什么

| 不负责的内容 | 权威文档 |
|---|---|
| 节点结构 / 路径互斥 / SP 单价锚点 | [22-skill-tree-overview](./22-skill-tree-overview.md) |
| 陷阱机制（触发条件 / DOT 公式 / AOE 形状）| [27-traps-spells-scene §2](./27-traps-spells-scene.md#2-陷阱障碍trap--obstacle)|
| 陷阱基础属性（HP / 触发次数 / 伤害）| [21-unit-roster §5.2](./21-unit-roster.md#52-陷阱阵容trap9-种) + [50-mda §21.1](../50-data-numerical/50-mda.md)|
| 陷阱配额（5/关 / 3/关 / 2/关）| [21-unit-roster §5.2](./21-unit-roster.md)|

### 1.3 设计理念（vs 塔/士兵技能树）

| 维度 | 塔 22a | 士兵 22b | 陷阱（本文档）|
|---|---|---|---|
| 路径主线 | 形态切换 | 主动技能强化 | **耐久 vs 烈度** |
| 路径数 | 1-3 | 2 | **统一 2** |
| 节点深度 | 1-4 | 1-3 | **统一 1-3** |
| 设计简化原因 | — | — | **陷阱机制本身较简单**（一次性 / 周期触发），无需复杂分叉 |

---

## 2. 通用约定

### 2.1 SP 单价锚点（同 22a / 22b）

| depth | spCost |
|---|---|
| 1 | 0（起点）|
| 2 | 6 |
| 3 | 10 |

### 2.2 统一路径模板

每陷阱两条路径采用 **"耐久 vs 烈度"** 分叉：

- **路径 A · 耐久向**：触发次数 +N / HP +N% / 持续时间 +N%
- **路径 B · 烈度向**：单次伤害 +N% / 范围 +N% / 附加状态（灼烧 / 中毒 / 减速等）

### 2.3 单陷阱 SP 总需求

- 单路径满级 = 16 SP
- 双路径全满 = 32 SP
- 9 陷阱全部单路径满级 = 9 × 16 = **144 SP**（远超单 Run SP 流量）
- **设计意图**：玩家单 Run 内对陷阱 SP 投入约 16-32 SP（1-2 个关键陷阱），不强求所有陷阱都投。

---

## 3. 九陷阱技能树清单（概览）

| 陷阱 ID | 中文名 | 占位类型 | 触发方式 | 引入关 | 路径 A 主题 | 路径 B 主题 |
|---|---|---|---|---|---|---|
| `spike_trap` | 尖刺陷阱 | trap_path | 触发式 | L1 | 加固耐久（触发次数 +N）| 致命毒刺（伤害 + DOT）|
| `landmine` | 地雷 | trap_path | 一次性 | L2 | 集束地雷（范围 +N%）| 烈焰地雷（伤害 + 灼烧）|
| `tar_pit` | 焦油坑 | trap_path | 区域 | L3 | 黏稠焦油（减速强化 + 持续时间↑）| 易燃焦油（被火引爆伤害 ×N）|
| `bear_trap` | 捕兽夹 | trap_path | 一次性 | L4 | 重型捕兽夹（定身时长 +N% + 承伤↑）| 致命陷阱（咬伤瞬间伤害 +N%）|
| `fire_wall` | 火墙 | 3 trap_path | 区域 | L3 | 长城火墙（持续时间 +N%）| 烈焰风暴（DPS + 范围↑）|
| `frost_mist` | 寒霜雾 | 5×3 区域 | 区域 | L4 | 永冻领域（持续时间整波）| 冰封效果（减速 / 减攻强化）|
| `gravity_well` | 引力井 | r100 区域 | 区域 | L5 | 持久引力场（持续时间 +N%）| 强力拉拽（拉拽速度 + 伤害）|
| `boulder` | 巨石 | blocked tile | 占路式 | L2 | 钢铁巨石（HP +N%）| 滚石冲撞（死亡滚动距离 + 伤害）|
| `decoy_dummy` | 诱饵假人 | 空地 | 占路式 | L4 | 加固假人（HP +N%）| 真实塔形（伪装更强 + 反击伤害）|

---

## 4. 触发式陷阱（4 种）

### 4.1 尖刺陷阱 · `spike_trap`

**陷阱定位**：基础触发式陷阱，5 次触发后损坏；单体物理伤害。

#### 4.1.1 节点图

```
路径 1 · 加固耐久  [depth=1] 普通尖刺 ●────[depth=2] 加固尖刺 ○ 6SP────[depth=3] 永固尖刺 ○ 10SP
路径 2 · 致命毒刺  [depth=1] 普通尖刺 ●────[depth=2] 重伤尖刺 ○ 6SP────[depth=3] 剧毒尖刺 ○ 10SP
```

#### 4.1.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 加固耐久** | 普通尖刺（5 次触发）| 加固尖刺（触发次数 +3 → 8 次）| 永固尖刺（触发次数 +5 累加 → 13 次）|
| **2 · 致命毒刺** | 普通尖刺 | 重伤尖刺（伤害 ×1.5）| 剧毒尖刺（伤害 ×1.5 累加 + 命中附加中毒 DOT 3s）|

#### 4.1.3 YAML 配置

```yaml
spike_trap:
  id: spike_trap
  name: 尖刺陷阱
  category: Trap
  skillTree:
    paths:
      - id: durability
        name: 加固耐久
        nodes:
          - id: spike_basic
            name: 普通尖刺
            depth: 1
            spCost: 0
            effects: []
          - id: spike_reinforced
            name: 加固尖刺
            depth: 2
            spCost: 6
            prerequisites: [spike_basic]
            effects:
              - rule: add_trap_charges
                value: 3
          - id: spike_eternal
            name: 永固尖刺
            depth: 3
            spCost: 10
            prerequisites: [spike_reinforced]
            effects:
              - rule: add_trap_charges
                value: 5
      - id: lethal_poison
        name: 致命毒刺
        nodes:
          - id: spike_basic_lp
            name: 普通尖刺
            depth: 1
            spCost: 0
            effects: []
          - id: spike_severe
            name: 重伤尖刺
            depth: 2
            spCost: 6
            prerequisites: [spike_basic_lp]
            effects:
              - rule: mul_trap_damage
                value: 1.5
          - id: spike_venom
            name: 剧毒尖刺
            depth: 3
            spCost: 10
            prerequisites: [spike_severe]
            effects:
              - rule: add_poison_on_trigger
                duration: 3.0
                tickRatio: 0.2
```

### 4.2 地雷 · `landmine`

**陷阱定位**：一次性 AOE 触发陷阱，r80 半径 150 伤害。

#### 4.2.1 节点图

```
路径 1 · 集束地雷  [depth=1] 普通地雷 ●────[depth=2] 加宽地雷 ○ 6SP────[depth=3] 集束地雷 ○ 10SP
路径 2 · 烈焰地雷  [depth=1] 普通地雷 ●────[depth=2] 重型地雷 ○ 6SP────[depth=3] 烈焰地雷 ○ 10SP
```

#### 4.2.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 集束地雷** | 普通地雷（r80）| 加宽地雷（r 累加 +20% → 96px）| 集束地雷（r 累加 +30% → ~125px + 击退 30px）|
| **2 · 烈焰地雷** | 普通地雷 | 重型地雷（伤害 ×1.5）| 烈焰地雷（伤害 ×1.5 累加 + 命中附加灼烧 DOT 4s）|

#### 4.2.3 YAML 配置

```yaml
landmine:
  id: landmine
  name: 地雷
  category: Trap
  skillTree:
    paths:
      - id: cluster_mine
        name: 集束地雷
        nodes:
          - id: mine_basic
            name: 普通地雷
            depth: 1
            spCost: 0
            effects: []
          - id: mine_wide
            name: 加宽地雷
            depth: 2
            spCost: 6
            prerequisites: [mine_basic]
            effects:
              - rule: mul_trap_radius
                value: 1.2
          - id: mine_cluster
            name: 集束地雷
            depth: 3
            spCost: 10
            prerequisites: [mine_wide]
            effects:
              - rule: mul_trap_radius
                value: 1.3
              - rule: add_knockback_on_trigger
                distance: 30
      - id: incendiary
        name: 烈焰地雷
        nodes:
          - id: mine_basic_inc
            name: 普通地雷
            depth: 1
            spCost: 0
            effects: []
          - id: mine_heavy
            name: 重型地雷
            depth: 2
            spCost: 6
            prerequisites: [mine_basic_inc]
            effects:
              - rule: mul_trap_damage
                value: 1.5
          - id: mine_flame
            name: 烈焰地雷
            depth: 3
            spCost: 10
            prerequisites: [mine_heavy]
            effects:
              - rule: add_burning_on_trigger
                duration: 4.0
                tickRatio: 0.25
```

### 4.3 焦油坑 · `tar_pit`

**陷阱定位**：触发式减速陷阱 + 易燃属性（可被火属性引燃）。

#### 4.3.1 节点图

```
路径 1 · 黏稠焦油  [depth=1] 普通焦油坑 ●────[depth=2] 加深焦油 ○ 6SP────[depth=3] 永恒焦油 ○ 10SP
路径 2 · 易燃焦油  [depth=1] 普通焦油坑 ●────[depth=2] 浓缩焦油 ○ 6SP────[depth=3] 火油弹 ○ 10SP
```

#### 4.3.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 黏稠焦油** | 普通焦油坑（-60% 移速）| 加深焦油（-70% 移速 + 持续时间 +50%）| 永恒焦油（-80% 移速 + 持续时间整波）|
| **2 · 易燃焦油** | 普通焦油坑 | 浓缩焦油（被火引爆伤害 ×5，原版 ×4）| 火油弹（被火引爆 + AOE 伤害扩散 r100）|

#### 4.3.3 YAML 配置

```yaml
tar_pit:
  id: tar_pit
  name: 焦油坑
  category: Trap
  skillTree:
    paths:
      - id: viscous_tar
        name: 黏稠焦油
        nodes:
          - id: tar_basic
            name: 普通焦油坑
            depth: 1
            spCost: 0
            effects: []
          - id: tar_deep
            name: 加深焦油
            depth: 2
            spCost: 6
            prerequisites: [tar_basic]
            effects:
              - rule: add_slow_amount
                value: 0.1                      # -60% → -70%
              - rule: mul_trap_duration
                value: 1.5
          - id: tar_eternal
            name: 永恒焦油
            depth: 3
            spCost: 10
            prerequisites: [tar_deep]
            effects:
              - rule: add_slow_amount
                value: 0.1                      # 累加 → -80%
              - rule: set_trap_duration
                duration: wave                  # 整波持续
      - id: flammable
        name: 易燃焦油
        nodes:
          - id: tar_basic_fl
            name: 普通焦油坑
            depth: 1
            spCost: 0
            effects: []
          - id: tar_concentrated
            name: 浓缩焦油
            depth: 2
            spCost: 6
            prerequisites: [tar_basic_fl]
            effects:
              - rule: mul_ignite_damage
                value: 1.25                     # 引爆 ×4 → ×5
          - id: tar_napalm
            name: 火油弹
            depth: 3
            spCost: 10
            prerequisites: [tar_concentrated]
            effects:
              - rule: add_aoe_on_ignite
                radius: 100
                damageRatio: 1.0
```

### 4.4 捕兽夹 · `bear_trap`

**陷阱定位**：一次性定身陷阱（精英也定，Boss 免疫）+ 承伤 +30%。

#### 4.4.1 节点图

```
路径 1 · 重型捕兽夹  [depth=1] 普通捕兽夹 ●────[depth=2] 加重捕兽夹 ○ 6SP────[depth=3] 钢铁捕兽夹 ○ 10SP
路径 2 · 致命陷阱    [depth=1] 普通捕兽夹 ●────[depth=2] 锋利捕兽夹 ○ 6SP────[depth=3] 致命咬合 ○ 10SP
```

#### 4.4.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 重型捕兽夹** | 普通捕兽夹（定身 2s + 承伤 +30%）| 加重捕兽夹（定身 +1s → 3s）| 钢铁捕兽夹（定身 +1s 累加 → 4s + 承伤 +20% → +50%）|
| **2 · 致命陷阱** | 普通捕兽夹 | 锋利捕兽夹（咬伤瞬间伤害 +50%）| 致命咬合（咬伤 +50% 累加 + 中毒 DOT 5s）|

#### 4.4.3 YAML 配置

```yaml
bear_trap:
  id: bear_trap
  name: 捕兽夹
  category: Trap
  skillTree:
    paths:
      - id: heavy_trap
        name: 重型捕兽夹
        nodes:
          - id: bear_basic
            name: 普通捕兽夹
            depth: 1
            spCost: 0
            effects: []
          - id: bear_heavy
            name: 加重捕兽夹
            depth: 2
            spCost: 6
            prerequisites: [bear_basic]
            effects:
              - rule: add_root_duration
                value: 1.0
          - id: bear_steel
            name: 钢铁捕兽夹
            depth: 3
            spCost: 10
            prerequisites: [bear_heavy]
            effects:
              - rule: add_root_duration
                value: 1.0
              - rule: add_vulnerability
                value: 0.2                      # +30% → +50%
      - id: lethal_trap
        name: 致命陷阱
        nodes:
          - id: bear_basic_lt
            name: 普通捕兽夹
            depth: 1
            spCost: 0
            effects: []
          - id: bear_sharp
            name: 锋利捕兽夹
            depth: 2
            spCost: 6
            prerequisites: [bear_basic_lt]
            effects:
              - rule: mul_trap_damage
                value: 1.5
          - id: bear_lethal
            name: 致命咬合
            depth: 3
            spCost: 10
            prerequisites: [bear_sharp]
            effects:
              - rule: add_poison_on_trigger
                duration: 5.0
                tickRatio: 0.15
```

---

## 5. 区域式陷阱（3 种）

### 5.1 火墙 · `fire_wall`

**陷阱定位**：区域式火墙，8s 持续 20 DPS；飞行敌免疫；可被油坑引爆。

#### 5.1.1 节点图

```
路径 1 · 长城火墙  [depth=1] 普通火墙 ●────[depth=2] 持久火墙 ○ 6SP────[depth=3] 不灭火墙 ○ 10SP
路径 2 · 烈焰风暴  [depth=1] 普通火墙 ●────[depth=2] 高温火墙 ○ 6SP────[depth=3] 烈焰风暴 ○ 10SP
```

#### 5.1.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 长城火墙** | 普通火墙（8s 持续）| 持久火墙（持续 +4s → 12s）| 不灭火墙（持续 +4s 累加 → 16s）|
| **2 · 烈焰风暴** | 普通火墙（20 DPS）| 高温火墙（DPS ×1.5 → 30）| 烈焰风暴（DPS ×1.5 累加 + 范围 +1 trap_path 单元宽度）|

#### 5.1.3 YAML 配置

```yaml
fire_wall:
  id: fire_wall
  name: 火墙
  category: Trap
  skillTree:
    paths:
      - id: great_wall
        name: 长城火墙
        nodes:
          - id: fire_wall_basic
            name: 普通火墙
            depth: 1
            spCost: 0
            effects: []
          - id: fire_wall_persist
            name: 持久火墙
            depth: 2
            spCost: 6
            prerequisites: [fire_wall_basic]
            effects:
              - rule: mul_trap_duration
                value: 1.5                      # 8s → 12s
          - id: fire_wall_eternal
            name: 不灭火墙
            depth: 3
            spCost: 10
            prerequisites: [fire_wall_persist]
            effects:
              - rule: mul_trap_duration
                value: 1.33                     # 累加 → 16s
      - id: firestorm
        name: 烈焰风暴
        nodes:
          - id: fire_wall_basic_fs
            name: 普通火墙
            depth: 1
            spCost: 0
            effects: []
          - id: fire_wall_hot
            name: 高温火墙
            depth: 2
            spCost: 6
            prerequisites: [fire_wall_basic_fs]
            effects:
              - rule: mul_trap_dps
                value: 1.5
          - id: fire_wall_storm
            name: 烈焰风暴
            depth: 3
            spCost: 10
            prerequisites: [fire_wall_hot]
            effects:
              - rule: mul_trap_dps
                value: 1.5
              - rule: add_trap_width
                value: 1                        # 多覆盖 1 trap_path 宽度
```

### 5.2 寒霜雾 · `frost_mist`

**陷阱定位**：5×3 trap_path 区域 + 整波持续 -40% 移速 -25% 攻速。

#### 5.2.1 节点图

```
路径 1 · 永冻领域  [depth=1] 普通寒霜雾 ●────[depth=2] 加密寒霜雾 ○ 6SP────[depth=3] 永冻领域 ○ 10SP
路径 2 · 冰封效果  [depth=1] 普通寒霜雾 ●────[depth=2] 严寒寒霜雾 ○ 6SP────[depth=3] 绝对零度 ○ 10SP
```

#### 5.2.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 永冻领域** | 普通寒霜雾（5×3 范围）| 加密寒霜雾（范围 +1 行 → 5×4）| 永冻领域（范围 +1 行累加 → 5×5）|
| **2 · 冰封效果** | 普通寒霜雾（-40% 移速 / -25% 攻速）| 严寒寒霜雾（-55% 移速 / -35% 攻速）| 绝对零度（-70% 移速 / -50% 攻速 + 5% 概率冰冻 1s）|

#### 5.2.3 YAML 配置

```yaml
frost_mist:
  id: frost_mist
  name: 寒霜雾
  category: Trap
  skillTree:
    paths:
      - id: eternal_freeze
        name: 永冻领域
        nodes:
          - id: frost_basic
            name: 普通寒霜雾
            depth: 1
            spCost: 0
            effects: []
          - id: frost_dense
            name: 加密寒霜雾
            depth: 2
            spCost: 6
            prerequisites: [frost_basic]
            effects:
              - rule: add_trap_height
                value: 1                        # 5×3 → 5×4
          - id: frost_eternal
            name: 永冻领域
            depth: 3
            spCost: 10
            prerequisites: [frost_dense]
            effects:
              - rule: add_trap_height
                value: 1                        # 5×4 → 5×5
      - id: deep_freeze
        name: 冰封效果
        nodes:
          - id: frost_basic_df
            name: 普通寒霜雾
            depth: 1
            spCost: 0
            effects: []
          - id: frost_severe
            name: 严寒寒霜雾
            depth: 2
            spCost: 6
            prerequisites: [frost_basic_df]
            effects:
              - rule: add_slow_amount
                value: 0.15                     # -40% → -55%
              - rule: add_atk_speed_debuff
                value: 0.1                      # -25% → -35%
          - id: frost_absolute
            name: 绝对零度
            depth: 3
            spCost: 10
            prerequisites: [frost_severe]
            effects:
              - rule: add_slow_amount
                value: 0.15                     # 累加 → -70%
              - rule: add_atk_speed_debuff
                value: 0.15                     # 累加 → -50%
              - rule: add_freeze_chance
                probability: 0.05
                duration: 1.0
```

### 5.3 引力井 · `gravity_well`

**陷阱定位**：r100 区域 + 5s 持续拉拽（含飞行敌）。

#### 5.3.1 节点图

```
路径 1 · 持久引力场  [depth=1] 普通引力井 ●────[depth=2] 加长引力井 ○ 6SP────[depth=3] 持久引力场 ○ 10SP
路径 2 · 强力拉拽    [depth=1] 普通引力井 ●────[depth=2] 强化引力井 ○ 6SP────[depth=3] 黑洞引力井 ○ 10SP
```

#### 5.3.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 持久引力场** | 普通引力井（5s）| 加长引力井（持续 +2s → 7s）| 持久引力场（持续 +3s 累加 → 10s）|
| **2 · 强力拉拽** | 普通引力井 | 强化引力井（拉拽速度 ×1.5）| 黑洞引力井（拉拽速度 ×2.0 + 范围内每秒造成 5% 最大 HP 伤害）|

#### 5.3.3 YAML 配置

```yaml
gravity_well:
  id: gravity_well
  name: 引力井
  category: Trap
  skillTree:
    paths:
      - id: persistent_field
        name: 持久引力场
        nodes:
          - id: gravity_basic
            name: 普通引力井
            depth: 1
            spCost: 0
            effects: []
          - id: gravity_extended
            name: 加长引力井
            depth: 2
            spCost: 6
            prerequisites: [gravity_basic]
            effects:
              - rule: add_trap_duration
                value: 2.0
          - id: gravity_persistent
            name: 持久引力场
            depth: 3
            spCost: 10
            prerequisites: [gravity_extended]
            effects:
              - rule: add_trap_duration
                value: 3.0
      - id: strong_pull
        name: 强力拉拽
        nodes:
          - id: gravity_basic_sp
            name: 普通引力井
            depth: 1
            spCost: 0
            effects: []
          - id: gravity_enhanced
            name: 强化引力井
            depth: 2
            spCost: 6
            prerequisites: [gravity_basic_sp]
            effects:
              - rule: mul_pull_speed
                value: 1.5
          - id: gravity_blackhole
            name: 黑洞引力井
            depth: 3
            spCost: 10
            prerequisites: [gravity_enhanced]
            effects:
              - rule: mul_pull_speed
                value: 1.33                     # 累加 → ×2.0
              - rule: add_dot_in_zone
                ratio: 0.05                     # 每秒 5% 最大 HP 伤害
```

---

## 6. 占路式陷阱（2 种）

### 6.1 巨石 · `boulder`

**陷阱定位**：800 HP 占路 + 死亡沿路径滚动 1 格造成 150 伤害。

#### 6.1.1 节点图

```
路径 1 · 钢铁巨石  [depth=1] 普通巨石 ●────[depth=2] 加固巨石 ○ 6SP────[depth=3] 钢铁巨石 ○ 10SP
路径 2 · 滚石冲撞  [depth=1] 普通巨石 ●────[depth=2] 重型巨石 ○ 6SP────[depth=3] 滚石冲撞 ○ 10SP
```

#### 6.1.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 钢铁巨石** | 普通巨石（800 HP）| 加固巨石（HP ×1.3 → 1040）| 钢铁巨石（HP ×1.3 累加 → ~1350）|
| **2 · 滚石冲撞** | 普通巨石（滚动 1 格 / 150 伤害）| 重型巨石（滚动距离 +1 格 → 2 格）| 滚石冲撞（滚动 +1 格累加 → 3 格 + 单格伤害 ×1.5）|

#### 6.1.3 YAML 配置

```yaml
boulder:
  id: boulder
  name: 巨石
  category: Trap
  skillTree:
    paths:
      - id: steel_boulder
        name: 钢铁巨石
        nodes:
          - id: boulder_basic
            name: 普通巨石
            depth: 1
            spCost: 0
            effects: []
          - id: boulder_reinforced
            name: 加固巨石
            depth: 2
            spCost: 6
            prerequisites: [boulder_basic]
            effects:
              - rule: mul_max_hp
                value: 1.3
          - id: boulder_steel
            name: 钢铁巨石
            depth: 3
            spCost: 10
            prerequisites: [boulder_reinforced]
            effects:
              - rule: mul_max_hp
                value: 1.3                      # 累加
      - id: rolling_smash
        name: 滚石冲撞
        nodes:
          - id: boulder_basic_rs
            name: 普通巨石
            depth: 1
            spCost: 0
            effects: []
          - id: boulder_heavy
            name: 重型巨石
            depth: 2
            spCost: 6
            prerequisites: [boulder_basic_rs]
            effects:
              - rule: add_roll_distance
                value: 1                        # 滚动 +1 格
          - id: boulder_smash
            name: 滚石冲撞
            depth: 3
            spCost: 10
            prerequisites: [boulder_heavy]
            effects:
              - rule: add_roll_distance
                value: 1                        # 累加 → 3 格
              - rule: mul_roll_damage
                value: 1.5
```

### 6.2 诱饵假人 · `decoy_dummy`

**陷阱定位**：200 HP 空地占位 + 伪装成箭塔骗刺客类敌人。

#### 6.2.1 节点图

```
路径 1 · 加固假人  [depth=1] 普通假人 ●────[depth=2] 加固假人 ○ 6SP────[depth=3] 钢铁假人 ○ 10SP
路径 2 · 真实塔形  [depth=1] 普通假人 ●────[depth=2] 精装假人 ○ 6SP────[depth=3] 反击假人 ○ 10SP
```

#### 6.2.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 加固假人** | 普通假人（200 HP）| 加固假人（HP ×1.5 → 300）| 钢铁假人（HP ×1.5 累加 → 450）|
| **2 · 真实塔形** | 普通假人 | 精装假人（被攻击时伪装更逼真 → 吸引半径 +50%）| 反击假人（死亡时对周围 80px 半径敌人造成 100 伤害）|

#### 6.2.3 YAML 配置

```yaml
decoy_dummy:
  id: decoy_dummy
  name: 诱饵假人
  category: Trap
  skillTree:
    paths:
      - id: reinforced_decoy
        name: 加固假人
        nodes:
          - id: decoy_basic
            name: 普通假人
            depth: 1
            spCost: 0
            effects: []
          - id: decoy_reinforced
            name: 加固假人
            depth: 2
            spCost: 6
            prerequisites: [decoy_basic]
            effects:
              - rule: mul_max_hp
                value: 1.5
          - id: decoy_steel
            name: 钢铁假人
            depth: 3
            spCost: 10
            prerequisites: [decoy_reinforced]
            effects:
              - rule: mul_max_hp
                value: 1.5                      # 累加
      - id: real_tower_form
        name: 真实塔形
        nodes:
          - id: decoy_basic_rt
            name: 普通假人
            depth: 1
            spCost: 0
            effects: []
          - id: decoy_refined
            name: 精装假人
            depth: 2
            spCost: 6
            prerequisites: [decoy_basic_rt]
            effects:
              - rule: mul_attract_radius
                value: 1.5
          - id: decoy_retaliate
            name: 反击假人
            depth: 3
            spCost: 10
            prerequisites: [decoy_refined]
            effects:
              - rule: add_death_explosion
                radius: 80
                damage: 100
                factionFilter: [Enemy]
```

---

## 7. 九陷阱 SP 总需求与流派覆盖

### 7.1 SP 总需求矩阵

| 陷阱 | 路径 1 单满 | 路径 2 单满 | 双路径全满 |
|---|---|---|---|
| `spike_trap` | 16 SP | 16 SP | 32 SP |
| `landmine` | 16 SP | 16 SP | 32 SP |
| `tar_pit` | 16 SP | 16 SP | 32 SP |
| `bear_trap` | 16 SP | 16 SP | 32 SP |
| `fire_wall` | 16 SP | 16 SP | 32 SP |
| `frost_mist` | 16 SP | 16 SP | 32 SP |
| `gravity_well` | 16 SP | 16 SP | 32 SP |
| `boulder` | 16 SP | 16 SP | 32 SP |
| `decoy_dummy` | 16 SP | 16 SP | 32 SP |

**统一格式**：所有 9 陷阱均为 2 路径 × 3 节点。

### 7.2 单 Run SP 预算策略示范

| 策略 | SP 分配 | 满级陷阱数 | 适合玩法 |
|---|---|---|---|
| **2-3 陷阱单路径** | 2-3 × 16 = 32-48 SP | 2-3 个陷阱 | 配合塔阵线 |
| **1 陷阱双路径** | 32 SP | 1 个万能陷阱 | 关键路口卡死 |
| **不投陷阱** | 0 SP | 0 | 纯塔流 / 士兵流 |

### 7.3 设计意图

- 陷阱单次性 / 周期触发本质决定其 SP 价值低于塔与士兵。
- 设计预期：玩家单 Run 内对陷阱 SP 投入约 16-32 SP（1-2 个关键陷阱）。
- 9 陷阱全部双路径全满共 288 SP，远超单 Run SP 流量上限，**确保陷阱不会成为唯一 SP 投入方向**。

---

## 8. RuleHandler 引用清单

### 8.1 通用数值类（继承自 22a / 22b）

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `mul_max_hp` | 最大 HP 倍率 | boulder（加固 / 钢铁）/ decoy_dummy（加固 / 钢铁）|
| `mul_trap_damage` | 陷阱伤害倍率 | spike_trap（重伤）/ landmine（重型）/ bear_trap（锋利）|

### 8.2 触发次数 / 持续时间类（v3.4 陷阱新增）

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `add_trap_charges` | 陷阱触发次数 +N | spike_trap（加固 / 永固）|
| `mul_trap_duration` | 陷阱持续时间倍率 | tar_pit（加深）/ fire_wall（持久 / 不灭）|
| `add_trap_duration` | 陷阱持续时间 +N 秒 | gravity_well（加长 / 持久）|
| `set_trap_duration` | 设置陷阱持续模式 | tar_pit（永恒，duration=wave）|

### 8.3 范围 / 形状类

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `mul_trap_radius` | 陷阱半径倍率 | landmine（加宽 / 集束）|
| `add_trap_width` | 陷阱宽度 +N 单元 | fire_wall（烈焰风暴）|
| `add_trap_height` | 陷阱区域高度 +N 单元 | frost_mist（加密 / 永冻）|

### 8.4 触发附加效果类

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `add_poison_on_trigger` | 触发附加中毒 DOT | spike_trap（剧毒）/ bear_trap（致命）|
| `add_burning_on_trigger` | 触发附加灼烧 DOT | landmine（烈焰）|
| `add_knockback_on_trigger` | 触发附加击退 | landmine（集束）|
| `add_root_duration` | 定身时长 +N 秒 | bear_trap（加重 / 钢铁）|
| `add_vulnerability` | 承伤倍率 +N | bear_trap（钢铁）|
| `add_freeze_chance` | 概率冰冻 | frost_mist（绝对零度）|
| `add_slow_amount` | 减速量 +N（绝对值）| frost_mist（严寒 / 绝对零度）/ tar_pit（加深 / 永恒）|
| `add_atk_speed_debuff` | 攻速减益 +N | frost_mist（严寒 / 绝对零度）|

### 8.5 引力井专用

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `mul_pull_speed` | 拉拽速度倍率 | gravity_well（强化 / 黑洞）|
| `add_dot_in_zone` | 区域内每秒 N% 最大 HP DOT | gravity_well（黑洞）|

### 8.6 火墙 / 焦油坑专用

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `mul_trap_dps` | 陷阱 DPS 倍率 | fire_wall（高温 / 烈焰风暴）|
| `mul_ignite_damage` | 引爆伤害倍率 | tar_pit（浓缩）|
| `add_aoe_on_ignite` | 引爆时 AOE 扩散 | tar_pit（火油弹）|

### 8.7 占路式专用

| RuleHandler | 用途 | 引用陷阱 |
|---|---|---|
| `add_roll_distance` | 滚动距离 +N 格 | boulder（重型 / 滚石冲撞）|
| `mul_roll_damage` | 滚动伤害倍率 | boulder（滚石冲撞）|
| `mul_attract_radius` | 吸引半径倍率 | decoy_dummy（精装）|
| `add_death_explosion` | 死亡 AOE 爆炸 | decoy_dummy（反击）|

**新增 RuleHandler 数量**：本文档共需新增 26 个 RuleHandler（其中 2 个与 22a/22b 共享，24 个本文档新增 / 陷阱专用）。

---

## 9. v3.4 不变式核对

| 不变式 | 权威文档 | 本文档执行情况 |
|---|---|---|
| 火花碎片词汇彻底废弃 | [v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) | ✅ 全文 0 处「火花碎片」「shard」「碎片」|
| meta 永久积累机制取消 | [11-economy §4](../10-gameplay/11-economy.md) | ✅ 全文 0 处「永久解锁」「跨 Run」 |
| 数值真理源唯一 | [50-mda](../50-data-numerical/50-mda.md) | ✅ 所有 `spCost` 严格命中 §17.3 锚点（0/6/10）|
| 节点深度 SP 单价锚点 | [50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点) | ✅ 全 9 陷阱 depth=1/2/3 = 0/6/10 命中 |
| 单位卡入手默认形态 | [22-skill-tree-overview §7.3](./22-skill-tree-overview.md#73-depth1-起点-sp-单价为-0-还是-3) | ✅ 全部 depth=1 节点 spCost=0 |
| 路径互斥单装备 | [22-skill-tree-overview §4](./22-skill-tree-overview.md#4-路径互斥与装备切换) | ✅ 全文未引入"多路径同时装备"机制 |
| 关内禁止点亮 / 切换装备 | [22-skill-tree-overview §4.4](./22-skill-tree-overview.md#44-关内禁止点亮--切换装备) | ✅ 全文 0 处"关内升级"提及 |
| 与 instanceLevel 正交 | [22-skill-tree-overview §6.2](./22-skill-tree-overview.md#62-正交关键点铁律) | ✅ 全文 effects[] 0 处 `add_instance_level` 引用 |

---

## 10. 修订历史

| 版本 | 日期 | 类型 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮第 4 份创建**：陷阱技能树详设权威。10 章覆盖：文档定位 / 通用约定 / 九陷阱技能树清单 / 4 触发式陷阱（spike_trap / landmine / tar_pit / bear_trap）+ 3 区域式陷阱（fire_wall / frost_mist / gravity_well）+ 2 占路式陷阱（boulder / decoy_dummy）/ SP 总需求矩阵 / RuleHandler 引用清单（26 个）/ v3.4 8 项不变式核对。**v3.4 全新创建（无 v3.1 蓝本）**。统一模板：每陷阱 2 路径 × 3 节点（depth=1/2/3 = 0/6/10 SP），路径分叉为"耐久向 vs 烈度向"。 |
