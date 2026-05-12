# 03 — 单位字段语义与机制目录

> **本文档不再持有数值**。所有具体属性数值见 [21-MDA数值设计](./21-mda-numerical-design.md)（**唯一真理源**）。
> 动态行为规则见 [02-单位系统](./02-unit-system.md)。视觉规范见 [16-美术资产](./16-art-assets-design.md)。
>
> 本文档定义：每个单位的**字段集合、机制语义、配置项语义**，作为读懂 21 文档数值表的索引。

---

## 0. 通用字段约定

每个单位配置由以下分类字段构成（具体取值见 21）：

| 字段类别 | 字段 | 语义 |
|---------|------|------|
| **标识** | `id` | 配置主键（snake_case） |
| | `name` | 显示名（仅供调试，运行时零文字） |
| | `category` | `Tower` / `Soldier` / `Enemy` / `Building` / `Trap` / `Neutral` / `Objective` |
| **数值** | `hp` | 最大生命值 |
| | `atk` | 基础攻击力 |
| | `attackSpeed` | 每秒攻击次数 |
| | `range` | 攻击射程（像素） |
| | `armor` / `magicResist` | 物理护甲 / 魔法抗性 |
| | `moveSpeed` | 移动单位的基础移速（像素/秒） |
| | `damageType` | `physical` / `magic` / `true` |
| | `population` | 占用人口（仅 Soldier） |
| | `cost` | 建造造价（金币） |
| | `upgradeCost[]` | 各级升级费用（L1→L2 起算） |
| | `atkGrowth[]` | 各级 ATK 增量 |
| | `rangeGrowth[]` | 各级射程增量 |
| | `killReward` | 击杀奖励（仅敌人） |
| **视觉** | `color` | 主色（阵营色），详见 16 §9 阵营色规范 |
| | `shape` | 复合几何体描述（详见 16 §5） |
| | `size` / `radius` | 渲染尺寸 |
| | `layer` | 渲染层级（详见 18 图层系统） |
| **机制** | `attackMode` | 见 §0.1 攻击模式枚举 |
| | `specialEffects[]` | 见 §0.2 特殊机制枚举 |
| | `levelPassive` | L3+ 解锁的被动（如有） |
| | `skill` | 主动技能引用（详见 04） |
| | `aiBehavior` | 行为树 ID（详见 23） |

### 0.1 攻击模式枚举（`attackMode`）

| 枚举值 | 含义 | 关键参数（在 21 中定义） |
|--------|------|----------------------|
| `single_target` | 单体攻击 | — |
| `aoe_splash` | 溅射 AOE | `splashRadius` / `splashRatio` |
| `chain` | 链式攻击 | `chainCount` / `searchRadius` / `falloff` |
| `piercing` | 贯穿 | `pierceFalloff` |
| `heal` | 治疗（无伤害） | `healAmount` / `healRadius` |
| `global_aoe` | 大范围 AOE（导弹塔类） | `explosionRadius` / `flightSpeed` |
| `can_attack_buildings` | 可攻击建筑 | — |

> 注：`can_attack_buildings` 是修饰符，可与上述其它模式并存。

### 0.2 特殊机制枚举（`specialEffects[]`）

| 机制 | 行为 | 关键参数（在 21 中定义） |
|------|------|----------------------|
| `stun_on_hit` | 命中后眩晕（Boss 免疫） | `stunDuration` |
| `slow_on_hit` | 命中后减速（可叠层） | `slowPerStack` / `maxStacks` / `slowDuration` |
| `freeze_at_max_stacks` | 满层冰冻 | `freezeDuration` |
| `lifesteal_on_hit` | 攻击吸血 | `lifestealRatio` |
| `weather_dependent_atk` | 攻击力随天气变动 | 详见 11 |
| `death_explosion` | 死亡爆炸 AOE | `explosionRadius` / `explosionDamage` / `factionFilter` |
| `boss_phase_transition` | 血量阈值阶段切换 | `phaseHpThreshold` / `phaseModifiers` |
| `boss_immune_stun` | 免疫眩晕 | — |
| `summon_minions` | 召唤小兵 | `summonId` / `summonCount` / `summonCd` |
| `aoe_faction_filter` | AOE 阵营过滤 | `[Player|Enemy|Neutral]` |
| `invulnerable` | 无敌 / 不可摧毁（仅特殊场景） | — |

---

## 1. 塔类（Tower）

> 所有塔具体数值见 [21 §4](./21-mda-numerical-design.md#4-塔类单位数值重设计)。

| 塔 ID | 战术角色 | 攻击模式 | 关键机制 | L3 被动 |
|-------|---------|---------|---------|---------|
| `arrow_tower` | 稳定单体输出 | `single_target` | — | 精准射击（暴击） |
| `cannon_tower` | 群体控制 | `aoe_splash` | `stun_on_hit` | 集束弹药（AOE 增幅） |
| `ice_tower` | 战场减速 | `single_target` | `slow_on_hit` + `freeze_at_max_stacks` | 碎裂（冰冻结束 AOE） |
| `lightning_tower` | 群怪清剿 | `chain` | — | 过载（弹跳+衰减优化） |
| `laser_tower` | 远程贯穿 | `piercing` | — | 聚焦光束（衰减降低） |
| `bat_tower` | 暗夜杀手 | `single_target` | `weather_dependent_atk` + `lifesteal_on_hit` | 声波探测（无视雾天射程惩罚） |
| `missile_tower` | 战略打击 | `global_aoe` | 地格评分系统（详见 19） | 详见 19 |

> 共同字段：均为 `category: Tower`，部署在地面层（Ground），不可移动。
> 升级体系：L1~L5，共 4 次升级。

### 1.1 蝙蝠塔天气依赖说明

蝙蝠塔的 ATK 受 `weather_dependent_atk` 机制影响，具体倍率在 [21 §9 天气矩阵](./21-mda-numerical-design.md#9-天气系统数值优化)定义。**蝙蝠塔不再"休眠"**——所有天气下都能正常攻击，仅 ATK 倍率不同。

### 1.2 导弹塔说明

导弹塔的攻击不是单体或简单 AOE，而是"地格评分系统驱动的全场 AOE 战略打击"。详细机制（评分维度、爆炸物理、热压弹头等）见 [19-missile-tower.md](./19-missile-tower.md)。

---

## 2. 我方移动单位（Soldier）

> 所有兵具体数值见 [21 §5](./21-mda-numerical-design.md#5-我方移动单位数值重设计)。

| 兵 ID | 战术角色 | 攻击模式 | 主动技能（详见 04） |
|-------|---------|---------|---------------------|
| `shield_guard` | 肉盾 | `single_target` | 嘲讽 |
| `swordsman` | 前排输出 | `single_target` | 旋风斩（AOE） |
| `archer` | 远程 DPS | `single_target` | 狙击（高单体伤） |
| `priest` | 治疗支援 | `heal` | 治疗链 |
| `engineer` | 修理建造 | `single_target` | 紧急修复 |
| `assassin` | 近战爆发 | `single_target` | 暗杀（瞬移） |

> 共同字段：均为 `category: Soldier`，可移动，占用人口（数值见 21），死亡后人口释放。
> AI 行为详见 [24-soldier-ai-behavior.md](./24-soldier-ai-behavior.md)。

---

## 3. 敌方单位（Enemy）

> 所有敌人具体数值见 [21 §6](./21-mda-numerical-design.md#6-敌方单位数值重设计)。

| 敌人 ID | 层级 | 关键机制 | AI 行为 |
|---------|------|---------|---------|
| `grunt` | L1 普通 | — | 沿路径 → 攻击基地 |
| `runner` | L1 普通 | 不攻击建筑，直冲基地 | 高速冲刺 |
| `heavy` | L2 精英 | `can_attack_buildings`（近战） | 路径优先，遇塔可攻击 |
| `mage` | L2 精英 | `can_attack_buildings`（远程） | 保持距离远程 |
| `exploder` | L2 精英 | `death_explosion` + `aoe_faction_filter: [Player]` | 自杀冲锋 |
| `boss_commander` | L3 BOSS | `summon_minions` + `boss_phase_transition` + `boss_immune_stun` | `boss_commander_ai`（详见 23） |
| `boss_beast` | L3 BOSS | `boss_phase_transition`（分裂） + `boss_immune_stun` | `boss_beast_ai`（详见 23） |

### 3.1 自爆虫 AOE 规则（明确）

`exploder` 的死亡爆炸 **仅伤害 Player 阵营**（塔/兵/基地），不伤害敌方友军，不伤害中立单位。配置项 `aoe_faction_filter: [Player]` 强制约束。

### 3.2 Boss 阶段切换规则（明确）

`boss_phase_transition` 通过 BT 的 `Once` 装饰节点封装，确保 HP 跨过阈值时**只触发一次**，阶段切换瞬间重置当前 BT 子树。具体节点规范详见 [23-ai-behavior-tree.md](./23-ai-behavior-tree.md) §节点规格冻结。

---

## 4. 生产建筑（Building）

> 所有具体数值见 [21 §7](./21-mda-numerical-design.md#7-经济系统数值重设计)。

| 建筑 ID | 产出 | 最高等级 |
|---------|------|---------|
| `gold_mine` | 金币 | L3 |
| `energy_tower` | 能量 | L3 |

---

## 5. 中立单位（Neutral / Trap）

> 所有具体数值见 [21 §7](./21-mda-numerical-design.md#7-经济系统数值重设计) 及附录。

| 单位 ID | 类型 | 关键机制 |
|---------|------|---------|
| `spike_trap` | Trap | 触发型物理伤害，CD，每关上限 5 |
| `healing_spring` | Neutral | **可摧毁**的治疗光环源（高 HP，非无敌） |
| `gold_chest` | Neutral | 击破后随机奖励金币 |

### 5.1 治疗泉水修订（重要）

`healing_spring` **不再设置为不可摧毁**。改为高 HP（具体值见 21）的脆弱光环源——双方均可攻击破坏。一旦摧毁，治疗光环消失。

行为树评估目标时若遇到 `invulnerable=true` 的单位，应通过 `ignore_invulnerable` 装饰器跳过（节点规格见 23）。

---

## 6. 目标点（Objective）

| 目标 ID | 阵营 | 说明 |
|---------|------|------|
| `base` | Player | 玩家基地，HP 归零=失败。具体 HP 见 21 §7。 |
| `spawn_point` | Enemy | 敌人出生点，`invulnerable=true`，不可作为塔的攻击目标。 |

> 出生点的"无敌"属性会被 `ignore_invulnerable` 装饰器过滤，塔不会浪费攻击。

---

## 7. 数值与字段映射回顾

| 需要查 | 查这里 |
|--------|--------|
| 单位的具体 HP/ATK/造价/移速等 | [21 §4-§7](./21-mda-numerical-design.md) |
| 公式骨架（护甲减伤、攻速上限等） | [05-combat-system.md](./05-combat-system.md) |
| 升级体系深度（L1-L5 解锁） | [21 §4](./21-mda-numerical-design.md#4-塔类单位数值重设计) |
| 攻击模式/特殊机制语义 | 本文档 §0.1 / §0.2 |
| 视觉规范（形状/颜色） | [16-art-assets-design.md](./16-art-assets-design.md) |
| AI 行为树 | [23-ai-behavior-tree.md](./23-ai-behavior-tree.md) / [24-soldier-ai-behavior.md](./24-soldier-ai-behavior.md) |
| 波次缩放 | [21 §8](./21-mda-numerical-design.md#8-波次难度曲线重校准) |
| 天气矩阵 | [21 §9](./21-mda-numerical-design.md#9-天气系统数值优化) |
| 技能与 Buff | [04-skill-buff-system.md](./04-skill-buff-system.md) |
