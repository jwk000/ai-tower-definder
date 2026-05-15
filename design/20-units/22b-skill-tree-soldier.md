---
title: 士兵技能树详设（v3.4）
status: authoritative
version: 1.0.0
last-modified: 2026-05-15
authority-for:
  - soldier-skill-tree
  - soldier-path-nodes
  - soldier-skill-tree-yaml
cross-refs:
  - 20-units/22-skill-tree-overview.md
  - 20-units/22a-skill-tree-tower.md
  - 20-units/21-unit-roster.md
  - 20-units/23-skill-buff.md
  - 30-ai/31-soldier-ai.md
  - 50-data-numerical/50-mda.md
  - 60-tech/60-architecture.md
  - v3.4-MAJOR-MIGRATION.md
---

# 士兵技能树详设（v3.4）

> ⭐ **本文档是 6 个士兵单位技能树的唯一权威详设**。所有节点 ID / 路径 ID / SP 单价 / RuleHandler 引用以本文档为准；通用骨架见 [22-skill-tree-overview](./22-skill-tree-overview.md)。

> 🆕 **本文档为 v3.4 全新创建（无 v3.1 蓝本继承）**。v3.1 22-tower-tech-tree 仅覆盖塔单位，士兵在 v3.1 阶段无关外科技树；v3.4 引入 SP 系统后，**士兵首次拥有技能树**，路径设计围绕"主动技能强化 + 行为模式切换"两条主线。

---

## 目录

- [1. 文档定位与读法](#1-文档定位与读法)
- [2. 通用约定（与 22a 一致）](#2-通用约定与-22a-一致)
- [3. 六士兵技能树清单（概览）](#3-六士兵技能树清单概览)
- [4. 盾卫 · `shield_guard`](#4-盾卫--shield_guard)
- [5. 剑士 · `swordsman`](#5-剑士--swordsman)
- [6. 弓手 · `archer`](#6-弓手--archer)
- [7. 牧师 · `priest`](#7-牧师--priest)
- [8. 工程师 · `engineer`](#8-工程师--engineer)
- [9. 刺客 · `assassin`](#9-刺客--assassin)
- [10. 六士兵 SP 总需求与流派覆盖](#10-六士兵-sp-总需求与流派覆盖)
- [11. RuleHandler 引用清单](#11-rulehandler-引用清单)
- [12. v3.4 不变式核对](#12-v34-不变式核对)
- [13. 修订历史](#13-修订历史)

---

## 1. 文档定位与读法

### 1.1 本文档负责什么

本文档**只**负责士兵单位（`category: Soldier`）的技能树详设，每士兵一节，内容包括：

- 士兵定位（一句话功能描述 + 战术身份）
- 路径表（每条路径的节点梯度、节点能力、形态名）
- YAML 配置示例
- 节点 effects[] 的 RuleHandler 引用说明
- 与主动技能的关联说明（详 [23-skill-buff](./23-skill-buff.md)）

### 1.2 本文档**不**负责什么

| 不负责的内容 | 权威文档 |
|---|---|
| 节点结构 / 路径互斥 / SP 单价锚点 | [22-skill-tree-overview](./22-skill-tree-overview.md)|
| SP 数值锚点 | [50-mda §17](../50-data-numerical/50-mda.md#17-技能点-sp-系统v34-新增) |
| RuleHandler 注册 | `src/core/RuleHandlers.ts` + [60-architecture §5.3](../60-tech/60-architecture.md) |
| 士兵基础属性（HP / ATK / 速度 / 人口）| [21-unit-roster §3](./21-unit-roster.md) |
| 士兵 AI 行为（三圈模型 / 四状态机）| [31-soldier-ai](../30-ai/31-soldier-ai.md) |
| 士兵主动技能数值（伤害 / 治疗量 / CD）| [23-skill-buff](./23-skill-buff.md) + [50-mda §5](../50-data-numerical/50-mda.md) |

### 1.3 设计理念差异（vs 塔技能树）

| 维度 | 塔技能树（22a）| 士兵技能树（本文档）|
|---|---|---|
| 节点效果方向 | 形态切换（外观 + 弹道 + 战斗机制）| **主动技能强化 + AI 行为微调** |
| 路径数量 | 1-3 条 | **统一 2 条**（保持简洁，士兵不需要"3 元素互斥"那种复杂度）|
| 节点深度 | 1-4 节点 | **统一 1-3 节点**（无 depth=4，电塔级"终极爆点"留给塔）|
| 视觉变化 | 显著（双重箭塔 / 充能激光塔等）| **较弱**（小幅外观差异 + 特效附加）|
| Run 内重要性 | 主输出来源，SP 主投 | **辅助强化**，单 Run 内点 1-2 个士兵已足够 |

---

## 2. 通用约定（与 22a 一致）

### 2.1 节点深度与 SP 单价（[50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点) 锚点）

| 节点深度 | spCost | 说明 |
|---|---|---|
| **depth=1**（路径起点） | **0 SP** | 单位卡入手默认形态 |
| **depth=2**（路径进阶） | **6 SP** | 路径关键流派成型 |
| **depth=3**（路径终点）| **10 SP** | 流派满级 |

> ⚠️ **士兵单位全部不含 depth=4 节点**（终极爆点仅塔单位电塔有）。本文档全部 `spCost` 严格命中 0/6/10 锚点。

### 2.2 effects[] 写法（差量语义）

每个节点 `effects[]` 仅描述相对上一节点的差量变化。配置加载器在装备路径时合并所有已点亮节点的 effects[]（与 22a 一致）。

### 2.3 单士兵单路径 SP 总需求

- 单路径满级 = 0 + 6 + 10 = **16 SP**
- 双路径全满 = **32 SP**
- 6 士兵全部单路径满级 = 6 × 16 = **96 SP**（接近单 Run SP 流量上限）
- 6 士兵全部双路径全满 = 6 × 32 = **192 SP**（远超单 Run SP 流量，几乎不可能）

### 2.4 与主动技能的关系

每个士兵都有一个由 [23-skill-buff](./23-skill-buff.md) 定义的**主动技能**（如盾卫嘲讽、剑士旋风斩、牧师治疗链等）。本文档的节点效果分两类：

| 节点效果类 | 说明 | 示例 |
|---|---|---|
| **强化主动技能** | 提升主动技能数值 / 范围 / CD | 嘲讽范围扩大 / 旋风斩伤害提升 |
| **强化普攻 / 行为** | 提升基础攻击或 AI 行为参数 | 弓手攻速提升 / 工程师修理速率提升 |

每士兵 2 条路径常采用 **"强化主动 vs 强化普攻"** 的分叉设计，让玩家根据战局选择"特殊技能为王"还是"日常输出为王"。

---

## 3. 六士兵技能树清单（概览）

| 士兵 ID | 中文名 | 战术角色 | 路径数 | 单路径满级 SP | 双路径全满 SP |
|---|---|---|---|---|---|
| `shield_guard` | 盾卫 | 肉盾 | 2 | 16 SP | 32 SP |
| `swordsman` | 剑士 | 前排输出 | 2 | 16 SP | 32 SP |
| `archer` | 弓手 | 远程 DPS | 2 | 16 SP | 32 SP |
| `priest` | 牧师 | 治疗支援 | 2 | 16 SP | 32 SP |
| `engineer` | 工程师 | 修理建造 | 2 | 16 SP | 32 SP |
| `assassin` | 刺客 | 近战爆发 | 2 | 16 SP | 32 SP |

### 3.1 共同设计模板

每士兵两条路径采用以下分叉模板：

- **路径 A**：强化主动技能方向（数值 + 范围 + CD 优化）
- **路径 B**：强化普攻 / 行为方向（攻速 / 移速 / 生存 / 输出风格优化）

具体路径设计因士兵战术角色不同而调整（如刺客 B 路径强调"瞬移频率"，工程师 B 路径强调"修理速度"）。

---

## 4. 盾卫 · `shield_guard`

**士兵定位**：肉盾，吸引仇恨 + 抗伤；主动技能「嘲讽」让范围内敌人优先攻击自己。

### 4.1 节点图

```
路径 1 · 嘲讽王    [depth=1] 普通盾卫 ●────[depth=2] 嘲讽盾卫 ○ 6SP────[depth=3] 圣盾骑士 ○ 10SP
路径 2 · 钢铁壁垒  [depth=1] 普通盾卫 ●────[depth=2] 重甲盾卫 ○ 6SP────[depth=3] 不动如山 ○ 10SP
```

### 4.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 嘲讽王** | 普通盾卫（默认嘲讽，半径 80px）| 嘲讽盾卫（嘲讽范围 +50% → 120px）| 圣盾骑士（嘲讽 + 嘲讽期间受到伤害 -20%）|
| **2 · 钢铁壁垒** | 普通盾卫 | 重甲盾卫（HP 上限 +30%）| 不动如山（HP +30% 累加 → +60% + 免疫击退 / 眩晕）|

### 4.3 YAML 配置

```yaml
shield_guard:
  id: shield_guard
  name: 盾卫
  category: Soldier
  skillTree:
    paths:
      - id: taunt_master
        name: 嘲讽王
        nodes:
          - id: shield_basic
            name: 普通盾卫
            depth: 1
            spCost: 0
            effects: []
          - id: shield_taunter
            name: 嘲讽盾卫
            depth: 2
            spCost: 6
            prerequisites: [shield_basic]
            effects:
              - rule: mul_skill_range
                skillId: taunt
                value: 1.5
          - id: shield_paladin
            name: 圣盾骑士
            depth: 3
            spCost: 10
            prerequisites: [shield_taunter]
            effects:
              - rule: add_skill_buff
                skillId: taunt
                buffId: damage_reduction_20
                duration: same_as_skill         # 与技能持续时间同步
      - id: steel_bulwark
        name: 钢铁壁垒
        nodes:
          - id: shield_basic_sb
            name: 普通盾卫
            depth: 1
            spCost: 0
            effects: []
          - id: heavy_shield
            name: 重甲盾卫
            depth: 2
            spCost: 6
            prerequisites: [shield_basic_sb]
            effects:
              - rule: mul_max_hp
                value: 1.3
          - id: immovable_object
            name: 不动如山
            depth: 3
            spCost: 10
            prerequisites: [heavy_shield]
            effects:
              - rule: mul_max_hp
                value: 1.23                     # 累加 → 共 1.6×
              - rule: add_cc_immunity
                effects: [knockback, stun]
```

### 4.4 设计说明

- 路径 1 = 主动技能流，扩大嘲讽影响圈 + 嘲讽期间生存能力。
- 路径 2 = 被动生存流，最大化 HP 池 + CC 免疫，适合"嘲讽 CD 期"的硬抗。
- 路径 2 终点 `add_cc_immunity` 是 v3.4 新增 RuleHandler，提供配置驱动的 CC 免疫列表（参考 [25-vulnerability](./25-vulnerability.md) 的 buff 保护规则）。

---

## 5. 剑士 · `swordsman`

**士兵定位**：前排输出；主动技能「旋风斩」AOE 范围伤害。

### 5.1 节点图

```
路径 1 · 旋风之王  [depth=1] 普通剑士 ●────[depth=2] 旋风剑士 ○ 6SP────[depth=3] 飓风战将 ○ 10SP
路径 2 · 利刃锋芒  [depth=1] 普通剑士 ●────[depth=2] 双刃剑士 ○ 6SP────[depth=3] 致命斩击 ○ 10SP
```

### 5.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 旋风之王** | 普通剑士（默认旋风斩 AOE）| 旋风剑士（旋风斩范围 +40%）| 飓风战将（旋风斩 + 命中附加击退 30px）|
| **2 · 利刃锋芒** | 普通剑士 | 双刃剑士（普攻每 2 次攻击命中第 1 击对周围 50px 半径附加 25% 溅射伤害）| 致命斩击（普攻 15% 概率暴击 ×2）|

### 5.3 YAML 配置

```yaml
swordsman:
  id: swordsman
  name: 剑士
  category: Soldier
  skillTree:
    paths:
      - id: whirlwind_king
        name: 旋风之王
        nodes:
          - id: sword_basic
            name: 普通剑士
            depth: 1
            spCost: 0
            effects: []
          - id: sword_whirlwind
            name: 旋风剑士
            depth: 2
            spCost: 6
            prerequisites: [sword_basic]
            effects:
              - rule: mul_skill_range
                skillId: whirlwind
                value: 1.4
          - id: sword_hurricane
            name: 飓风战将
            depth: 3
            spCost: 10
            prerequisites: [sword_whirlwind]
            effects:
              - rule: add_skill_effect
                skillId: whirlwind
                effect: knockback
                distance: 30
      - id: blade_edge
        name: 利刃锋芒
        nodes:
          - id: sword_basic_be
            name: 普通剑士
            depth: 1
            spCost: 0
            effects: []
          - id: sword_dual
            name: 双刃剑士
            depth: 2
            spCost: 6
            prerequisites: [sword_basic_be]
            effects:
              - rule: add_aoe_on_attack
                period: 2                       # 每 2 次攻击触发一次
                radius: 50
                damageRatio: 0.25
          - id: sword_lethal
            name: 致命斩击
            depth: 3
            spCost: 10
            prerequisites: [sword_dual]
            effects:
              - rule: add_crit_chance
                probability: 0.15
                multiplier: 2.0
```

### 5.4 设计说明

- 路径 1 = 主动技能强化（范围 → 击退），适合大波杂兵阵线。
- 路径 2 = 普攻强化（溅射 → 暴击），适合精英 / Boss 单点击杀。
- 路径 2 节点 2 的"周期溅射"是士兵层级首次引入 AOE 普攻，承接旧版"AOE 士兵"角色。

---

## 6. 弓手 · `archer`

**士兵定位**：远程 DPS；主动技能「狙击」高单体伤害。

### 6.1 节点图

```
路径 1 · 狙击大师  [depth=1] 普通弓手 ●────[depth=2] 神射手 ○ 6SP────[depth=3] 一发必杀 ○ 10SP
路径 2 · 连射速攻  [depth=1] 普通弓手 ●────[depth=2] 速射弓手 ○ 6SP────[depth=3] 箭雨大师 ○ 10SP
```

### 6.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 狙击大师** | 普通弓手（默认狙击主动）| 神射手（狙击伤害 +50%）| 一发必杀（狙击 + 命中目标 HP < 30% 时直接处决）|
| **2 · 连射速攻** | 普通弓手 | 速射弓手（攻击间隔 ×0.7，单发伤害 ×0.85）| 箭雨大师（攻速持续 + 每 5 次普攻附加范围伤害）|

### 6.3 YAML 配置

```yaml
archer:
  id: archer
  name: 弓手
  category: Soldier
  skillTree:
    paths:
      - id: sniper_master
        name: 狙击大师
        nodes:
          - id: archer_basic
            name: 普通弓手
            depth: 1
            spCost: 0
            effects: []
          - id: archer_marksman
            name: 神射手
            depth: 2
            spCost: 6
            prerequisites: [archer_basic]
            effects:
              - rule: mul_skill_damage
                skillId: snipe
                value: 1.5
          - id: archer_executor
            name: 一发必杀
            depth: 3
            spCost: 10
            prerequisites: [archer_marksman]
            effects:
              - rule: add_skill_execute
                skillId: snipe
                hpThreshold: 0.3                # 命中 HP < 30% 直接处决
      - id: rapid_fire
        name: 连射速攻
        nodes:
          - id: archer_basic_rf
            name: 普通弓手
            depth: 1
            spCost: 0
            effects: []
          - id: archer_quickshot
            name: 速射弓手
            depth: 2
            spCost: 6
            prerequisites: [archer_basic_rf]
            effects:
              - rule: mul_attack_interval
                value: 0.7
              - rule: mul_atk
                value: 0.85
          - id: archer_arrowstorm
            name: 箭雨大师
            depth: 3
            spCost: 10
            prerequisites: [archer_quickshot]
            effects:
              - rule: add_aoe_on_attack
                period: 5
                radius: 80
                damageRatio: 0.6
```

### 6.4 设计说明

- 路径 1 = 狙击单点处决，针对精英 / Boss；处决机制是 v3.4 首次引入"HP 阈值秒杀"。
- 路径 2 = 连射 + AOE 箭雨，针对杂兵清场。

---

## 7. 牧师 · `priest`

**士兵定位**：治疗支援；主动技能「治疗链」。

### 7.1 节点图

```
路径 1 · 群体救赎  [depth=1] 普通牧师 ●────[depth=2] 慈悲牧师 ○ 6SP────[depth=3] 救世牧师 ○ 10SP
路径 2 · 圣光涤荡  [depth=1] 普通牧师 ●────[depth=2] 圣光牧师 ○ 6SP────[depth=3] 神圣审判 ○ 10SP
```

### 7.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 群体救赎** | 普通牧师（默认治疗链 3 跳）| 慈悲牧师（治疗链跳数 +1 → 4 跳）| 救世牧师（治疗链 + 每跳额外恢复 5% 最大 HP）|
| **2 · 圣光涤荡** | 普通牧师 | 圣光牧师（普攻附加治疗：友军命中时按 30% 普攻值治疗目标）| 神圣审判（治疗链命中敌方时改为伤害 ×0.8 × 治疗量）|

### 7.3 YAML 配置

```yaml
priest:
  id: priest
  name: 牧师
  category: Soldier
  skillTree:
    paths:
      - id: group_redemption
        name: 群体救赎
        nodes:
          - id: priest_basic
            name: 普通牧师
            depth: 1
            spCost: 0
            effects: []
          - id: priest_mercy
            name: 慈悲牧师
            depth: 2
            spCost: 6
            prerequisites: [priest_basic]
            effects:
              - rule: add_skill_chain
                skillId: heal_chain
                value: 1                        # 链跳数 +1
          - id: priest_savior
            name: 救世牧师
            depth: 3
            spCost: 10
            prerequisites: [priest_mercy]
            effects:
              - rule: add_skill_bonus_heal
                skillId: heal_chain
                ratio: 0.05                     # 每跳额外 +5% 最大 HP
      - id: holy_light
        name: 圣光涤荡
        nodes:
          - id: priest_basic_hl
            name: 普通牧师
            depth: 1
            spCost: 0
            effects: []
          - id: priest_holy
            name: 圣光牧师
            depth: 2
            spCost: 6
            prerequisites: [priest_basic_hl]
            effects:
              - rule: add_attack_heal
                friendlyHealRatio: 0.3          # 普攻同时治疗友军 30% 普攻值
          - id: priest_judge
            name: 神圣审判
            depth: 3
            spCost: 10
            prerequisites: [priest_holy]
            effects:
              - rule: add_skill_damage_mode
                skillId: heal_chain
                enemyDamageRatio: 0.8           # 治疗链对敌方变为伤害 0.8× 治疗量
```

### 7.4 设计说明

- 路径 1 = 治疗扩散方向，治疗链跳数 + 单跳治疗量。
- 路径 2 = 攻防一体方向，普攻治疗友军 + 治疗链对敌伤害（罕见的"治疗→伤害"模式切换）。

---

## 8. 工程师 · `engineer`

**士兵定位**：修理建造；主动技能「紧急修复」单次大量恢复友方建筑/塔。

### 8.1 节点图

```
路径 1 · 急救专家  [depth=1] 普通工程师 ●────[depth=2] 急救工程师 ○ 6SP────[depth=3] 抢修大师 ○ 10SP
路径 2 · 持续维护  [depth=1] 普通工程师 ●────[depth=2] 维护工程师 ○ 6SP────[depth=3] 守护工匠 ○ 10SP
```

### 8.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 急救专家** | 普通工程师（默认紧急修复主动）| 急救工程师（紧急修复修复量 +50%）| 抢修大师（紧急修复 + CD 减半）|
| **2 · 持续维护** | 普通工程师 | 维护工程师（被动光环：80px 内友方建筑每秒 +1% 最大 HP）| 守护工匠（光环范围 +50% → 120px + 友方建筑受到伤害 -10%）|

### 8.3 YAML 配置

```yaml
engineer:
  id: engineer
  name: 工程师
  category: Soldier
  skillTree:
    paths:
      - id: emergency_expert
        name: 急救专家
        nodes:
          - id: engineer_basic
            name: 普通工程师
            depth: 1
            spCost: 0
            effects: []
          - id: engineer_paramedic
            name: 急救工程师
            depth: 2
            spCost: 6
            prerequisites: [engineer_basic]
            effects:
              - rule: mul_skill_heal
                skillId: emergency_repair
                value: 1.5
          - id: engineer_master_fixer
            name: 抢修大师
            depth: 3
            spCost: 10
            prerequisites: [engineer_paramedic]
            effects:
              - rule: mul_skill_cooldown
                skillId: emergency_repair
                value: 0.5                      # CD 减半
      - id: continuous_maintenance
        name: 持续维护
        nodes:
          - id: engineer_basic_cm
            name: 普通工程师
            depth: 1
            spCost: 0
            effects: []
          - id: engineer_maintainer
            name: 维护工程师
            depth: 2
            spCost: 6
            prerequisites: [engineer_basic_cm]
            effects:
              - rule: add_aura
                radius: 80
                target: building
                effect: regen_per_second
                ratio: 0.01                     # 每秒 +1% 最大 HP
          - id: engineer_guardian_artisan
            name: 守护工匠
            depth: 3
            spCost: 10
            prerequisites: [engineer_maintainer]
            effects:
              - rule: mul_aura_radius
                value: 1.5
              - rule: add_aura_effect
                target: building
                effect: damage_reduction
                value: 0.1
```

### 8.4 设计说明

- 路径 1 = 主动单点抢救方向（爆发治疗 + 高频）。
- 路径 2 = 被动光环维护方向（持续小幅治疗 + 减伤），偏防御阵线维持。
- 工程师是 v3.4 中唯一拥有"光环类"节点效果的士兵，与 [05 (M5 后)] 设计储备的 `bannerman` 鼓舞光环（[21-unit-roster §3.2](./21-unit-roster.md#32-未来扩展士兵v30-暂不收入开服卡池)）共用 `add_aura` RuleHandler。

---

## 9. 刺客 · `assassin`

**士兵定位**：近战爆发；主动技能「暗杀」瞬移 + 高伤害单次斩击。

### 9.1 节点图

```
路径 1 · 影刃舞    [depth=1] 普通刺客 ●────[depth=2] 影刃刺客 ○ 6SP────[depth=3] 暗影使者 ○ 10SP
路径 2 · 致命毒刃  [depth=1] 普通刺客 ●────[depth=2] 毒刃刺客 ○ 6SP────[depth=3] 死亡之契 ○ 10SP
```

### 9.2 路径详表

| 路径 | depth=1（0 SP）| depth=2（6 SP）| depth=3（10 SP）|
|---|---|---|---|
| **1 · 影刃舞** | 普通刺客（默认暗杀主动）| 影刃刺客（暗杀 CD ×0.7）| 暗影使者（暗杀击杀目标后 CD 立即重置）|
| **2 · 致命毒刃** | 普通刺客 | 毒刃刺客（普攻附加中毒 DOT，3s 内每秒 20% ATK）| 死亡之契（中毒目标被任意来源击杀时，刺客回复 20% 最大 HP）|

### 9.3 YAML 配置

```yaml
assassin:
  id: assassin
  name: 刺客
  category: Soldier
  skillTree:
    paths:
      - id: shadow_blade_dance
        name: 影刃舞
        nodes:
          - id: assassin_basic
            name: 普通刺客
            depth: 1
            spCost: 0
            effects: []
          - id: assassin_shadow_blade
            name: 影刃刺客
            depth: 2
            spCost: 6
            prerequisites: [assassin_basic]
            effects:
              - rule: mul_skill_cooldown
                skillId: assassinate
                value: 0.7
          - id: assassin_shadow_emissary
            name: 暗影使者
            depth: 3
            spCost: 10
            prerequisites: [assassin_shadow_blade]
            effects:
              - rule: add_skill_reset_on_kill
                skillId: assassinate
      - id: lethal_poison
        name: 致命毒刃
        nodes:
          - id: assassin_basic_lp
            name: 普通刺客
            depth: 1
            spCost: 0
            effects: []
          - id: assassin_poison
            name: 毒刃刺客
            depth: 2
            spCost: 6
            prerequisites: [assassin_basic_lp]
            effects:
              - rule: add_poison_on_hit
                duration: 3.0
                tickRatio: 0.2
          - id: assassin_death_pact
            name: 死亡之契
            depth: 3
            spCost: 10
            prerequisites: [assassin_poison]
            effects:
              - rule: add_heal_on_poison_kill
                healRatio: 0.2                  # 中毒目标被击杀时刺客 +20% 最大 HP
```

### 9.4 设计说明

- 路径 1 = 暗杀高频化（CD ↓ → 击杀重置），适合 Boss 战 / 精英爆发。
- 路径 2 = 中毒续航流（DOT + 击杀回血），适合长期战线消耗。
- 路径 2 节点 3 的 `add_heal_on_poison_kill` 是 v3.4 首次引入"友方间接受益于中毒"，与元素塔 22a §6 路径 3 病毒塔形成协同。

---

## 10. 六士兵 SP 总需求与流派覆盖

### 10.1 各士兵 SP 总需求矩阵

| 士兵 | 路径 1 单满 | 路径 2 单满 | 双路径全满 |
|---|---|---|---|
| `shield_guard` | 16 SP | 16 SP | 32 SP |
| `swordsman` | 16 SP | 16 SP | 32 SP |
| `archer` | 16 SP | 16 SP | 32 SP |
| `priest` | 16 SP | 16 SP | 32 SP |
| `engineer` | 16 SP | 16 SP | 32 SP |
| `assassin` | 16 SP | 16 SP | 32 SP |

**统一格式**：所有 6 士兵均为 2 路径 × 3 节点（depth=1 起点 0 SP + depth=2 6 SP + depth=3 10 SP）。

### 10.2 单 Run SP 预算策略示范（基于 100 SP 中位流量）

| 策略 | SP 分配 | 满级士兵数 | 适合玩法 |
|---|---|---|---|
| **3 士兵单路径** | 3 × 16 = 48 SP（剩 52 SP 投塔）| 3 个士兵 + 主力塔 | 多面手士兵阵 |
| **1 士兵双路径** | 32 SP + 剩 68 SP 投塔 | 1 个全面士兵 + 主力塔 | 单士兵卡位深化 |
| **不投士兵** | 0 SP，全部 100 SP 投塔 | 0 士兵 | 纯塔流 |

### 10.3 设计意图

- **士兵不是 SP 主投方向**：本文档每士兵 32 SP 上限（双路径全满），相对塔技能树普遍 32 SP 双满（且元素塔 48 SP / 电塔 31 SP）来说更友好。
- **设计预期**：玩家单 Run 内对士兵的 SP 投入约 20-40 SP（1-2 个士兵的关键路径），其余 SP 集中投塔。
- 士兵技能树主要价值：**让"士兵流"玩法成为可能**（vs 纯塔流），不强求所有玩家都投。

---

## 11. RuleHandler 引用清单

本文档共引用以下 RuleHandler（注册在 `src/core/RuleHandlers.ts`，详 [60-architecture §5.3](../60-tech/60-architecture.md)）：

### 11.1 数值修改类（继承自 22a / 通用）

| RuleHandler | 用途 | 引用士兵（节点）|
|---|---|---|
| `mul_atk` | 攻击力倍率 | 弓手（速射）|
| `mul_attack_interval` | 攻击间隔倍率 | 弓手（速射）|
| `mul_max_hp` | 最大 HP 倍率 | 盾卫（重甲/不动如山）|
| `add_poison_on_hit` | 命中附加中毒 DOT | 刺客（毒刃）|

### 11.2 主动技能强化类（v3.4 士兵新增）

| RuleHandler | 用途 | 引用士兵（节点）|
|---|---|---|
| `mul_skill_range` | 主动技能范围倍率 | 盾卫（嘲讽）/ 剑士（旋风）|
| `mul_skill_damage` | 主动技能伤害倍率 | 弓手（神射手）|
| `mul_skill_heal` | 主动技能治疗量倍率 | 工程师（急救）|
| `mul_skill_cooldown` | 主动技能 CD 倍率 | 工程师（抢修）/ 刺客（影刃）|
| `add_skill_buff` | 主动技能附加 Buff | 盾卫（圣盾骑士）|
| `add_skill_effect` | 主动技能附加效果（击退/眩晕等）| 剑士（飓风）|
| `add_skill_chain` | 主动技能链跳数 +N | 牧师（慈悲）|
| `add_skill_bonus_heal` | 主动技能额外治疗 | 牧师（救世）|
| `add_skill_execute` | 主动技能附加处决（HP 阈值秒杀）| 弓手（一发必杀）|
| `add_skill_damage_mode` | 主动技能对敌方变伤害模式 | 牧师（神圣审判）|
| `add_skill_reset_on_kill` | 主动技能击杀重置 CD | 刺客（暗影使者）|

### 11.3 普攻 / 行为类

| RuleHandler | 用途 | 引用士兵（节点）|
|---|---|---|
| `add_aoe_on_attack` | 周期性普攻 AOE | 剑士（双刃）/ 弓手（箭雨）|
| `add_crit_chance` | 普攻暴击概率 + 倍率 | 剑士（致命）|
| `add_attack_heal` | 普攻附加治疗友军 | 牧师（圣光）|

### 11.4 光环 / Buff 类

| RuleHandler | 用途 | 引用士兵（节点）|
|---|---|---|
| `add_aura` | 光环效果（半径 + 目标 + 效果）| 工程师（维护）|
| `mul_aura_radius` | 光环范围倍率 | 工程师（守护工匠）|
| `add_aura_effect` | 光环新增效果 | 工程师（守护工匠）|
| `add_cc_immunity` | CC 免疫列表 | 盾卫（不动如山）|

### 11.5 死亡 / 击杀触发类

| RuleHandler | 用途 | 引用士兵（节点）|
|---|---|---|
| `add_heal_on_poison_kill` | 中毒目标被击杀时回血 | 刺客（死亡之契）|

**新增 RuleHandler 数量**：本文档共需新增 17 个 RuleHandler（其中 4 个与 22a 共享，13 个本文档新增）。

---

## 12. v3.4 不变式核对

| 不变式 | 权威文档 | 本文档执行情况 |
|---|---|---|
| 火花碎片词汇彻底废弃 | [v3.4-MAJOR-MIGRATION](../v3.4-MAJOR-MIGRATION.md) | ✅ 全文 0 处「火花碎片」「shard」「shardCost」「碎片」|
| meta 永久积累机制取消 | [11-economy §4](../10-gameplay/11-economy.md) | ✅ 全文 0 处「永久解锁」「跨 Run」「meta 进度」|
| 数值真理源唯一 | [50-mda](../50-data-numerical/50-mda.md) | ✅ 所有 `spCost` 严格命中 §17.3 锚点（0/6/10），不出现锚点外数值 |
| 节点深度 SP 单价锚点 | [50-mda §17.3](../50-data-numerical/50-mda.md#173-sp-消耗技能树节点单价v34-锚点) | ✅ 全 6 士兵 depth=1/2/3 = 0/6/10 命中 |
| 单位卡入手默认形态 | [22-skill-tree-overview §7.3](./22-skill-tree-overview.md#73-depth1-起点-sp-单价为-0-还是-3) | ✅ 全部 depth=1 节点 spCost=0 |
| 路径互斥单装备 | [22-skill-tree-overview §4](./22-skill-tree-overview.md#4-路径互斥与装备切换) | ✅ 全文未引入"多路径同时装备"机制 |
| 关内禁止点亮 / 切换装备 | [22-skill-tree-overview §4.4](./22-skill-tree-overview.md#44-关内禁止点亮--切换装备) | ✅ 全文 0 处"关内升级"提及 |
| 与 instanceLevel 正交 | [22-skill-tree-overview §6.2](./22-skill-tree-overview.md#62-正交关键点铁律) | ✅ 全文 effects[] 0 处 `add_instance_level` 引用 |

---

## 13. 修订历史

| 版本 | 日期 | 类型 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-15 | refactor | **v3.4 第 3 轮第 3 份创建**：士兵技能树详设权威。13 章覆盖：文档定位 / 通用约定 / 六士兵技能树清单 / 6 士兵详设（盾卫 / 剑士 / 弓手 / 牧师 / 工程师 / 刺客）/ 六士兵 SP 总需求矩阵 / RuleHandler 引用清单（17 个）/ v3.4 8 项不变式核对。**v3.4 全新创建（无 v3.1 蓝本）**：v3.1 阶段士兵无关外科技树，v3.4 引入 SP 系统后士兵首次拥有技能树。统一模板：每士兵 2 路径 × 3 节点（depth=1/2/3 = 0/6/10 SP），路径分叉模板为"强化主动技能 vs 强化普攻/行为"。 |
