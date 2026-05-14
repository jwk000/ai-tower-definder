---
title: 单位与卡牌阵容总表
status: authoritative
version: 1.0.0
last-modified: 2026-05-14
authority-for:
  - 单位字段与机制语义（schema）
  - 单位 ID 命名与分类
  - v3.0/v3.1 完整阵容清单（20 敌 + 20 友）
  - 卡牌 ↔ UnitConfig 映射目录
supersedes:
  - ../03-unit-data.md
  - ../22-new-unit-design.md
cross-refs:
  - ../02-unit-system.md
  - ../21-mda-numerical-design.md
  - ../30-tower-tech-tree.md
  - ../25-card-roguelike-refactor.md
  - ../16-art-assets-design.md
  - ../23-ai-behavior-tree.md
  - ../24-soldier-ai-behavior.md
  - ../04-skill-buff-system.md
  - ../19-missile-tower.md
---

# 单位与卡牌阵容总表

> 本文档是**单位字段语义**与 **v3.0/v3.1 阵容清单**的唯一权威。所有单位 ID、分类、机制语义、与卡牌的映射关系以此为准。
>
> **本文档不包含**：
> - 具体数值（HP/ATK/造价等）→ [21-MDA](../50-data-numerical/50-mda.md)
> - 卡牌系统机制（抽弃牌/出卡/关间节点）→ [25-card-roguelike-refactor](../10-gameplay/10-roguelike-loop.md)
> - 塔升级机制（科技树路径/节点解锁）→ [30-tower-tech-tree](./22-tower-tech-tree.md)
> - 视觉规范（形状/颜色/动画）→ [16-art-assets-design](../40-presentation/42-art-assets.md)
> - AI 行为树具体节点 → [23-ai-behavior-tree](../30-ai/30-behavior-tree.md) / [24-soldier-ai-behavior](../30-ai/31-soldier-ai.md)
> - 战斗公式（伤害/护甲减伤）→ [05-combat-system](./24-combat.md)

> **v3.1（2026-05-14）变更摘要**：
> - 塔升级模型从"关内 L1-L5 线性"重构为"关外科技树（路径互斥 + 节点线性解锁）"，权威见 [30](./22-tower-tech-tree.md)。
> - `ice_tower` 重命名为 `elemental_tower`（默认冰形态，路径覆盖冰/火/毒三系）。
> - 已废弃单位：`poison_vine_tower`（毒藤塔）、`ballista_tower`（弩炮塔）—— 角色由元素塔毒系路径、炮塔狙击穿透路径承接。详见 [archive/deprecated-units-vine-ballista.md](../archive/deprecated-units-vine-ballista.md)。
> - `baseLevel` 字段已废弃；`instanceLevel` 语义见 §6。

---

## 0. 元信息

- **目标读者**：策划 / 客户端开发 / QA / 美术 / 全员
- **前置阅读**：`02-unit-system.md`（单位概念边界）、`25-card-roguelike-refactor.md`（卡牌系统）
- **关联代码**：`src/config/units/*.yaml`、`src/config/cards/*.yaml`、`src/core/components.ts`、`src/types/index.ts`

---

## 1. 通用字段约定（Schema）

每个单位配置由以下分类字段构成。具体取值见 [21-MDA](../50-data-numerical/50-mda.md)。

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
| | `killReward` | 击杀奖励（仅敌人） |
| **视觉** | `color` | 主色（阵营色），详见 [16 §9 阵营色规范](../40-presentation/42-art-assets.md) |
| | `shape` | 复合几何体描述（详见 [16 §5](../40-presentation/42-art-assets.md)） |
| | `size` / `radius` | 渲染尺寸 |
| | `layer` | 渲染层级（详见 [18 图层系统](../40-presentation/45-layer-system.md)） |
| **机制** | `attackMode` | 见 §1.1 攻击模式枚举 |
| | `specialEffects[]` | 见 §1.2 特殊机制枚举 |
| | `skill` | 主动技能引用（详见 [04](./23-skill-buff.md)） |
| | `aiBehavior` | 行为树 ID（详见 [23](../30-ai/30-behavior-tree.md)） |

### 1.1 攻击模式枚举（`attackMode`）

| 枚举值 | 含义 | 关键参数（在 21-MDA 中定义） |
|--------|------|----------------------|
| `single_target` | 单体攻击 | — |
| `aoe_splash` | 溅射 AOE | `splashRadius` / `splashRatio` |
| `chain` | 链式攻击 | `chainCount` / `searchRadius` / `falloff` |
| `piercing` | 贯穿 | `pierceFalloff` |
| `heal` | 治疗（无伤害） | `healAmount` / `healRadius` |
| `global_aoe` | 大范围 AOE（导弹塔类） | `explosionRadius` / `flightSpeed` |
| `can_attack_buildings` | 可攻击建筑 | — |

> `can_attack_buildings` 是修饰符，可与上述其它模式并存。

### 1.2 特殊机制枚举（`specialEffects[]`）

| 机制 | 行为 | 关键参数 |
|------|------|----------------------|
| `stun_on_hit` | 命中后眩晕（Boss 免疫） | `stunDuration` |
| `slow_on_hit` | 命中后减速（可叠层） | `slowPerStack` / `maxStacks` / `slowDuration` |
| `freeze_at_max_stacks` | 满层冰冻 | `freezeDuration` |
| `burn_on_hit` | 命中后燃烧 DOT | `burnDps` / `burnDuration` |
| `poison_on_hit` | 命中附毒 DOT | `poisonDps` / `poisonDuration` |
| `lifesteal_on_hit` | 攻击吸血 | `lifestealRatio` |
| `weather_dependent_atk` | 攻击力随天气变动 | 详见 [11-weather-system](../10-gameplay/14-weather.md) |
| `death_explosion` | 死亡爆炸 AOE | `explosionRadius` / `explosionDamage` / `factionFilter` |
| `boss_phase_transition` | 血量阈值阶段切换 | `phaseHpThreshold` / `phaseModifiers` |
| `boss_immune_stun` | 免疫眩晕 | — |
| `summon_minions` | 召唤小兵 | `summonId` / `summonCount` / `summonCd` |
| `aoe_faction_filter` | AOE 阵营过滤 | `[Player|Enemy|Neutral]` |
| `invulnerable` | 无敌 / 不可摧毁（仅特殊场景） | — |

---

## 2. 塔类（Tower）

> 数值见 [21-MDA §4](../50-data-numerical/50-mda.md#4-塔类单位数值重设计)。升级体系（v3.1 科技树）见 [30](./22-tower-tech-tree.md)。

### 2.1 塔阵容清单

| # | 塔 ID | 战术角色 | 默认攻击模式 | 默认关键机制 | 卡稀有度 | 科技树路径 |
|---|-------|---------|---------|---------|---------|---------|
| 1 | `arrow_tower` | 稳定单体输出 | `single_target` | — | Common | 多重射击 / 高频火力（→ [30 §4.1](./22-tower-tech-tree.md#41-箭塔)） |
| 2 | `cannon_tower` | 群体控制 | `aoe_splash` | `stun_on_hit` | Common | 控场 AOE / 狙击穿透（→ [30 §4.2](./22-tower-tech-tree.md#42-炮塔)） |
| 3 | `elemental_tower` | 元素效果（默认冰） | `single_target` | `slow_on_hit` (冰) / `burn_on_hit` (火) / `poison_on_hit` (毒) | Rare | 冰系 / 火系 / 毒系（→ [30 §4.3](./22-tower-tech-tree.md#43-元素塔原冰塔)） |
| 4 | `lightning_tower` | 群怪清剿 | `chain` | — | Rare | 单路径 4 节点（→ [30 §4.4](./22-tower-tech-tree.md#44-电塔单路径-4-节点)） |
| 5 | `laser_tower` | 远程持续输出 | 激光 | — | Epic | 扇形覆盖 / 蓄能聚焦（→ [30 §4.5](./22-tower-tech-tree.md#45-激光塔)） |
| 6 | `bat_tower` | 暗夜杀手 | 群体单位 | `weather_dependent_atk` | Epic | 单路径 3 节点（→ [30 §4.6](./22-tower-tech-tree.md#46-蝙蝠塔单路径-3-节点)） |
| 7 | `missile_tower` | 战略打击 | `global_aoe` | 地格评分系统（详见 [19](./26-missile-special.md)） | Legendary | 双联齐射 / 战略弹头（→ [30 §4.7](./22-tower-tech-tree.md#47-导弹塔)） |

> - 共同字段：均为 `category: Tower`，部署在地面层（Ground），不可移动。
> - 升级体系（v3.1）：**关内禁升级**，关外卡池按科技树路径解锁（碎片货币），详见 [30 §2 全局规则](./22-tower-tech-tree.md#2-全局规则)。
> - v3.1 重命名：`ice_tower` → `elemental_tower`，默认形态 = 元素塔 · 冰，沿用原 `slow_on_hit` 机制，向后兼容。
> - 已废弃单位：`poison_vine_tower`（毒藤塔）、`ballista_tower`（弩炮塔），见 [archive/deprecated-units-vine-ballista.md](../archive/deprecated-units-vine-ballista.md)；功能由元素塔毒系路径、炮塔狙击穿透路径承接。

### 2.2 塔机制说明

#### 蝙蝠塔（`bat_tower`）天气依赖

蝙蝠塔的 ATK 受 `weather_dependent_atk` 机制影响，倍率在 [21-MDA §9 天气矩阵](../50-data-numerical/50-mda.md#9-天气系统数值优化) 定义。**蝙蝠塔不再"休眠"**——所有天气下都能正常攻击，仅 ATK 倍率不同。

#### 导弹塔（`missile_tower`）

导弹塔的攻击不是单体或简单 AOE，而是"地格评分系统驱动的全场 AOE 战略打击"。详细机制（评分维度、爆炸物理、热压弹头等）见 [19-missile-tower.md](./26-missile-special.md)。

#### 元素塔（`elemental_tower`）路径切换

路径切换时同步切换 `elementType` 字段（`ice` / `fire` / `poison`），规则引擎据此决定命中附加的 DOT/Debuff。

### 2.3 塔科技树字段规范（v3.1）

塔单位 YAML 增加 `techTree` 字段，旧 `upgrades` / `maxLevel` 字段废弃。完整结构与路径定义见 [30 §5 配置结构](./22-tower-tech-tree.md#5-配置结构yaml)。字段语义索引：

| 字段 | 类型 | 语义 |
|------|------|------|
| `techTree.paths[]` | array | 该塔的所有升级路径 |
| `path.id` | string | 路径主键（如 `multi_shot` / `rapid_fire`） |
| `path.name` | string | 路径显示名（如「多重射击」） |
| `path.nodes[]` | array | 路径节点（线性解锁顺序） |
| `node.id` | string | 节点主键（如 `arrow_double`） |
| `node.name` | string | 节点形态名（如「双重箭塔」），关内塔实际显示 |
| `node.shardCost` | int | 解锁该节点的火花碎片成本（数值在 21-MDA） |
| `node.effects[]` | array | 该节点新增/覆盖的能力，引用 RuleHandler |

---

## 3. 我方移动单位（Soldier）

> 数值见 [21-MDA §5](../50-data-numerical/50-mda.md#5-我方移动单位数值重设计)。AI 行为详见 [24-soldier-ai-behavior.md](../30-ai/31-soldier-ai.md)。

### 3.1 士兵阵容清单（6 种核心）

| # | 兵 ID | 战术角色 | 攻击模式 | 主动技能（详见 [04](./23-skill-buff.md)） | 卡稀有度 |
|---|-------|---------|---------|---------------------|---------|
| 1 | `shield_guard` | 肉盾 | `single_target` | 嘲讽 | Common |
| 2 | `swordsman` | 前排输出 | `single_target` | 旋风斩（AOE） | Common |
| 3 | `archer` | 远程 DPS | `single_target` | 狙击（高单体伤） | Common |
| 4 | `priest` | 治疗支援 | `heal` | 治疗链 | Rare |
| 5 | `engineer` | 修理建造 | `single_target` | 紧急修复 | Rare |
| 6 | `assassin` | 近战爆发 | `single_target` | 暗杀（瞬移） | Epic |

> 共同字段：均为 `category: Soldier`，可移动，占用人口（数值见 21-MDA），死亡后人口释放。

### 3.2 未来扩展士兵（v3.0 暂不收入开服卡池）

以下士兵已完成核心设计但不在开服默认卡池，作为后续扩展卡：

| 兵 ID | 战术角色 | 关键机制 |
|-------|---------|---------|
| `battle_mage` | 魔法远程 DPS | 魔法伤害对高甲敌人效率远超弓手；主动技能「魔法飞弹」3 连发 |
| `bannerman` | 光环辅助 | 鼓舞光环（150px 内 +ATK/+攻速，不叠加）；主动「集结号」全图集结 + 加速 |
| `alchemist` | 减益投掷 | 被动破甲药剂（每 3 次攻击 -15 护甲）；主动「酸雾」范围减速 + DOT |

> 数值与详细机制保留在设计储备中（旧 22-new-unit-design.md v1.1 §5），正式入池时移入 §3.1。

---

## 4. 敌方单位（Enemy）

> 数值见 [21-MDA §6](../50-data-numerical/50-mda.md#6-敌方单位数值重设计)。完整阵容 = **20 种**（13 种 v3.0 扩展 + 7 种 v2 旧 = 19 种沿用 + 1 终战 boss `abyss_lord`，关底 Boss 系列另计）。

### 4.1 敌方阵容清单（20 种）

| # | ID | 引入关 | 类型 | 关键机制 | 威胁优先级建议 |
|---|----|-------|------|---------|--------------|
| 1 | `grunt` | L1 | 普通 | — | 沿路径 → 攻击基地 |
| 2 | `goblin_archer` | L1 | 普通（远程） | 远程攻击 100px | 中 |
| 3 | `runner` | L1 | 普通 | 不攻击建筑，直冲基地 | 高速冲刺 |
| 4 | `wolf` | L2 | 普通 | 高速 + 群体出现 | 低 |
| 5 | `wolf_rider` | L2 | 精英 | 高速冲刺 + `can_attack_buildings` | 高 |
| 6 | `heavy` | L2 | 精英 | `can_attack_buildings`（近战） | 路径优先，遇塔可攻击 |
| 7 | `mage` | L3 | 精英 | `can_attack_buildings`（远程） | 保持距离远程 |
| 8 | `poison_snake` | L3 | 普通 | 攻击带毒（5s DOT） | 中 |
| 9 | `healer_priest` | L3 | 精英 | 治疗周围敌人 100 HP/s | **最高**（敌人优先级表标记） |
| 10 | `bat_swarm` | L4 | LowAir | 飞行 + 群体 | 中（仅反空塔可击） |
| 11 | `wisp` | L4 | LowAir | 飞行 + 出生 3s 隐形 | 中 |
| 12 | `exploder` | L4 | 精英 | `death_explosion` + `aoe_faction_filter: [Player]` | 自杀冲锋 |
| 13 | `scattered_tentacle` | L5 | 普通 | 周期散开/聚拢 + 抗 AoE | 中 |
| 14 | `summoner_skeleton` | L6 | 精英 | 死亡召唤 3 小骷髅 | 高 |
| 15 | `shielded_warrior` | L6 | 精英 | 护盾未破时免疫伤害 | 高（必须破盾） |
| 16 | `elite_exploder` | L7 | 精英 | 强化自爆（半径 150 / 100 伤害） | 高 |
| 17 | `invisible_assassin` | L8 | 精英 | 出生 3s 内隐形 | 高 |
| 18 | `reflective_golem` | L8 | 精英 | 反弹 30% 受到伤害 | 中（避免高 ATK 集火） |
| 19 | `boss_commander` | 关底 | BOSS | `summon_minions` + `boss_phase_transition` + `boss_immune_stun` | `boss_commander_ai`（→ [23](../30-ai/30-behavior-tree.md)） |
| 20 | `abyss_lord` | L9 终战 | BOSS | 3 阶段切换 + 阶段 1 召唤普通敌 + 阶段 2 召唤精英 + 阶段 3 范围 DOT 大招 | `abyss_lord_ai`（→ [23](../30-ai/30-behavior-tree.md)） |

> 旧版 `boss_beast`（分裂巨兽）作为 `boss_commander` 的变体融合，BT 模板复用。

### 4.2 关底 Boss 配对（8 关 + 终战）

| 关卡 | 关底 Boss | 备注 |
|------|----------|------|
| L1 | `boss_orc_chieftain` | 兽人首领（boss_commander 草原变体） |
| L2 | `boss_wolf_king` | 狼王（boss_commander 森林变体） |
| L3 | `boss_snake_queen` | 毒蛇女王 |
| L4 | `boss_yeti` | 雪原巨人 |
| L5 | `boss_sand_worm` | 沙虫 |
| L6 | `boss_skeleton_lord` | 骷髅领主 |
| L7 | `boss_fire_elemental` | 火元素 |
| L8 | `boss_dark_knight` | 黑暗骑士 |
| L9 终战 | `abyss_lord` | 深渊领主 |

> 各关底 Boss 复用 `boss_commander` / `abyss_lord` BT 模板，仅修改数值 + 视觉。

### 4.3 敌方机制说明

#### 自爆虫 (`exploder`) AOE 阵营过滤

`exploder` 的死亡爆炸 **仅伤害 Player 阵营**（塔/兵/基地），不伤害敌方友军，不伤害中立单位。配置项 `aoe_faction_filter: [Player]` 强制约束。`elite_exploder` 沿用同一规则，仅提升半径与伤害。

#### Boss 阶段切换规则

`boss_phase_transition` 通过 BT 的 `Once` 装饰节点封装，确保 HP 跨过阈值时**只触发一次**，阶段切换瞬间重置当前 BT 子树。具体节点规范详见 [23-ai-behavior-tree.md §节点规格冻结](../30-ai/30-behavior-tree.md)。

#### 飞行敌（LowAir 层级）

`bat_swarm` / `wisp` / `hot_air_balloon` 等飞行敌位于 LowAir 层级，**免疫地面陷阱**（AboveGrid 层级），仅可被 LowAir 层级或 Ground 层级塔（即所有塔）攻击。详见 [18-layer-system](../40-presentation/45-layer-system.md)。

#### 隐形/不可锁定敌

`wisp`（出生 3s）、`invisible_assassin`（出生 3s）、设计储备中的 `phantom`（持续半透明）等隐形敌在不可见状态下**不被物理塔锁定**（箭塔/炮塔/导弹塔），但溅射/AOE 伤害仍可波及。可锁定来源：电塔链击（非首目标）、激光塔 L3+、弓手狙击技能、蝙蝠塔（声波探测）。

#### 召唤型敌（`summoner_skeleton` / `brood_mother` 储备）

`summoner_skeleton` 在死亡时召唤 3 只小骷髅。设计储备中的 `brood_mother` 周期产卵——已生成的幼虫在母体死亡后**继续存活**，最多并存 8 只。两者均通过 ECS 的 `summon_minions` 配置项驱动。

#### 反伤型 (`reflective_golem`)

`reflective_golem` 将受到伤害的 **30%** 反弹至攻击者。注：反弹不触发二次反弹（防止循环），且对自爆类直接秒杀无效。

### 4.4 设计储备敌人（v3.0 暂未入池）

以下敌人已完成详细设计但当前未纳入 20 种官方阵容，作为后续关卡或资料片素材：

| ID | 战术角色 | 关键机制 |
|----|---------|---------|
| `hot_air_balloon` | 飞行轰炸 | LowAir 层 + 经过塔上方投弹（3.5s 间隔，60px AOE） |
| `shaman` | 增益辅助 | 治疗光环（每 4s 治疗 25 HP）+ 增益光环（+15% 移速 / +10% ATK） |
| `phantom` | 持续隐形渗透 | 物理塔无法锁定；蝙蝠塔/激光 L3+/弓手狙击可解锁 |
| `brood_mother` | 周期产卵 | 每 6s 产生 2 只幼虫，最多并存 8 |
| `drummer` | 加速光环 | 周围 150px 敌人 +25% 移速 / +10% 攻速（光环不叠加） |
| `juggernaut` | 建筑破坏者 | 主动攻击射程内塔，冲锋时 +50% 移速；眩晕/冰冻抵抗 |
| `mutant` | 死后进化 | 被物理杀→进化硬壳（+护甲）；被魔法杀→进化魔力（+魔抗+远程）；被 DOT/冰杀→直接死亡（克制方法） |

> 详细设计存于设计储备（旧 22-new-unit-design.md v1.1 §3）。正式入池时整合到 §4.1。

---

## 5. 建筑、陷阱、中立单位、目标点

### 5.1 生产建筑（Building）

> 数值见 [21-MDA §7](../50-data-numerical/50-mda.md#7-经济系统数值重设计)。

| 建筑 ID | 产出 | 最高等级 | 卡稀有度 | v3.0 备注 |
|---------|------|---------|---------|----------|
| `gold_mine` | 金币 | L3 | Common | 持续产金 |
| `energy_crystal` | 能量 | L3 | Rare | v3.0 重命名（旧名 `energy_tower`），效果改为「下波开始 +3 E」或「+1 能量上限」，不再是被动产出 |

### 5.2 陷阱 / 中立单位（Trap / Neutral）

> 数值见 [21-MDA §7](../50-data-numerical/50-mda.md#7-经济系统数值重设计) 及附录。

| 单位 ID | 类型 | 关键机制 |
|---------|------|---------|
| `spike_trap` | Trap | 触发型物理伤害，CD，每关上限 5；卡稀有度 Common |
| `healing_spring` | Neutral | **可摧毁**的治疗光环源（高 HP，非无敌） |
| `gold_chest` | Neutral | 击破后随机奖励金币 |

#### 治疗泉水（`healing_spring`）重要修订

`healing_spring` **不再设置为不可摧毁**。改为高 HP（具体值见 21-MDA）的脆弱光环源——双方均可攻击破坏。一旦摧毁，治疗光环消失。

行为树评估目标时若遇到 `invulnerable=true` 的单位，应通过 `ignore_invulnerable` 装饰器跳过（节点规格见 [23](../30-ai/30-behavior-tree.md)）。

### 5.3 路障（Barricade）—— 独立类型 Structure

> **设计原则**：路障**不是塔**，是独立的 `Structure`（防御建筑）类型。原因：路障无攻击、占据路径格、不可升级到改变机制类型、AI 行为完全不同。强行作为 Tower 子类会污染塔系统的所有抽象。
>
> v3.0 暂不收入开服卡池，作为后续扩展卡。

#### 路障与塔的本质差异

| 维度 | 塔 (Tower) | 路障 (Barricade / Structure) |
|------|-----------|------------------------------|
| **基础属性集** | ATK / 攻速 / 射程 / 弹道 | HP / 护甲 / 吸引半径 |
| **是否攻击** | ✅ 主动攻击 | ❌ 无攻击（仅 L3+ 反伤被动） |
| **放置位置** | 空地（非路径） | 空地（且必须毗邻路径） |
| **是否改变路径** | ❌ 不改变 | ✅ 占据格位 + 改变可通行性 + 触发寻路重算 |
| **是否可被攻击** | 不可被攻击 | ✅ 可被攻击（HP 归零摧毁） |
| **数据类型** | `TowerConfig` | `StructureConfig`（新增） |
| **每关限制** | 受金币限制 | **硬限 3 个**（防止围墙阻塞） |
| **图标/UI 分组** | 工具栏"塔"页签 | 工具栏"建筑"页签 |

#### 关键机制

| 机制 | 规则 |
|------|------|
| **放置限制** | 必须放在**空地**上，且至少有一侧毗邻路径格 |
| **阻挡逻辑** | 路障占据空地格位，改变该格位的可通行性。寻路系统重新计算路径 |
| **完全堵死处理** | 如果路障完全堵死唯一路径，敌人优先攻击该路障（而非绕行） |
| **飞行敌豁免** | LowAir 层级（如热气球）可飞越 Ground 路障 |
| **可被攻击者** | 重装兵、法师、铁甲巨兽、Boss 会主动攻击挡路的路障；其他敌人优先绕行 |
| **反伤（L3+）** | 任何敌人对路障执行近战攻击时，每秒承受 5 点真实伤害（无视护甲） |
| **回血（L5）** | HP < 30% 时自动 50HP/s 回血 |
| **回收** | 可回收返还累计造价的 50% |
| **每关限制** | 最多 3 个 |

#### 数据结构（实现约定）

```typescript
// 不要把 Barricade 塞进 TowerConfig
interface StructureConfig {
  id: string;
  name: string;
  type: 'barricade' | 'producer' | 'wall';  // 未来可扩展
  layer: 'Ground';
  maxLevel: number;
  levels: StructureLevel[];
  placement: {
    onTerrain: 'empty';
    requiresAdjacentPath: boolean;   // Barricade=true
    occupiesPathCell: boolean;        // Barricade=true
    triggersRepath: boolean;          // Barricade=true
  };
  perLevelLimit: number;             // Barricade=3
  refundRatio: number;               // Barricade=0.5
}

interface StructureLevel {
  upgradeCost: number;
  hp: number;
  armor: number;
  magicResist: number;
  aggroRadius: number;
  passives: StructurePassive[];      // 反伤/回血等
}
```

### 5.4 设计储备塔（v3.0 暂未入池）

以下塔已完成详细设计但当前未纳入 7 种官方塔阵容，作为后续扩展卡：

| 塔 ID | 战术角色 | 关键机制 |
|-------|---------|---------|
| `command_tower` | 光环增益（号令塔） | 不直接攻击；周围塔 +攻速/+射程/+ATK；多塔不叠加 |
| `bounty_tower` | 击杀经济（赏金塔） | 标记敌人，标记敌被击杀时金币 ×1.5~2.5；L3+ Boss ×3 |
| `totem_tower` | 减益破甲（图腾塔） | 减护甲/魔抗，可堆叠 3 层；L3+ 满层额外 -10 护甲；L5 攻击附 5% 当前护甲减甲 |

### 5.5 目标点（Objective）

| 目标 ID | 阵营 | 说明 |
|---------|------|------|
| `base` | Player | 玩家基地，HP 归零=失败。具体 HP 见 [21-MDA §7](../50-data-numerical/50-mda.md#7-经济系统数值重设计)。v3.0 改为"水晶"语义：无敌但秒杀入侵敌人，每杀 -1 HP，跨关继承 |
| `spawn_point` | Enemy | 敌人出生点，`invulnerable=true`，不可作为塔的攻击目标 |

> 出生点的"无敌"属性会被 `ignore_invulnerable` 装饰器过滤，塔不会浪费攻击。

---

## 6. v3.0/v3.1 字段约定补充

| 字段 | 适用 | 说明 |
|------|------|------|
| `enemyTargetPriority[]` | Enemy | 攻击优先级配置（详见 [02 §9](./20-unit-system.md#9-单位的-ai-行为优先级v30-新增敌方)） |
| `cardId` | 单位实例（运行时） | 该实例由哪张卡生成（用于追溯） |
| `instanceLevel` | 单位实例（运行时） | 关内单实例临时强化层级。**v3.1：仅本局有效，塔死亡/关结束清零，不持久化到 CardCollection，不切换形态**（仅调数值）。提升通道：仅法术卡（如"精炼术"），详见 [04 §7](./23-skill-buff.md#7-instancelevel-法术卡提升机制)。形态切换走科技树，详见 [30 §2.3](./22-tower-tech-tree.md#23-关内临时升级instancelevel保留) |
| `techTree.pathDepth` | CardCollection（塔卡） | 该塔卡每条路径已解锁到第几个节点（v3.1 新增） |
| `techTree.equippedPath` | CardCollection（塔卡） | 该塔卡当前装备的路径 ID（v3.1 新增） |
| `persistAcrossWaves` | CardConfig | 法术卡是否跨波保留 |
| `removable` | CardConfig | 卡是否可在商店移除 |

> 已废弃字段：`baseLevel`（CardCollection 上的永久 L1–L5 模型，v3.1 由科技树取代，存档无需迁移，详见 [13 §6](../60-tech/61-save-system.md)）。

---

## 7. 卡牌目录（v3.0）

> 本节是「哪张卡引用哪个 UnitConfig」的**对照表（reference data）**。
>
> **卡牌系统机制权威** → [25-card-roguelike-refactor](../10-gameplay/10-roguelike-loop.md)（含 CardConfig 字段、出卡流程、抽弃牌、关间节点、卡池）
> **卡牌数值权威** → [21-MDA §8](../50-data-numerical/50-mda.md)
> **塔卡科技树权威** → [30-tower-tech-tree](./22-tower-tech-tree.md)
> **卡牌与单位的边界** → [02 §8](./20-unit-system.md#8-卡牌作为生成入口v30)

### 7.1 单位/建筑/陷阱卡（指向 UnitConfig）

| 卡 ID | 类型 | 稀有度 | 引用 UnitConfig | 备注 |
|-------|------|--------|----------------|------|
| `arrow_tower_card` | 建筑卡 | Common | `arrow_tower` | 基础远程塔 |
| `cannon_tower_card` | 建筑卡 | Common | `cannon_tower` | 基础群伤塔 |
| `elemental_tower_card` | 建筑卡 | Rare | `elemental_tower` | 元素塔（默认冰形态），路径详见 [30 §4.3](./22-tower-tech-tree.md#43-元素塔原冰塔)；v3.1 重命名自 `ice_tower_card` |
| `lightning_tower_card` | 建筑卡 | Rare | `lightning_tower` | 链击塔 |
| `laser_tower_card` | 建筑卡 | Epic | `laser_tower` | 贯穿塔 |
| `bat_tower_card` | 建筑卡 | Epic | `bat_tower` | 暗夜塔 |
| `missile_tower_card` | 建筑卡 | Legendary | `missile_tower` | 战略塔 |
| `gold_mine_card` | 建筑卡 | Common | `gold_mine` | 经济卡 |
| `energy_crystal_card` | 建筑卡 | Rare | `energy_crystal` | 能量水晶（v3.0 重命名自 `energy_tower`） |
| `spike_trap_card` | 陷阱卡 | Common | `spike_trap` | 触发型陷阱 |
| `shield_guard_card` | 单位卡 | Common | `shield_guard` | 肉盾 |
| `swordsman_card` | 单位卡 | Common | `swordsman` | 前排 |
| `archer_card` | 单位卡 | Common | `archer` | 远程 |
| `priest_card` | 单位卡 | Rare | `priest` | 治疗支援 |
| `engineer_card` | 单位卡 | Rare | `engineer` | 修复辅助 |
| `assassin_card` | 单位卡 | Epic | `assassin` | 爆发位 |

### 7.2 法术卡（`spellEffect` 驱动，不指向 UnitConfig）

| 卡 ID | 稀有度 | 类型 | 效果（简述） | 跨波保留 |
|-------|--------|------|------------|---------|
| `fireball_spell` | Common | AOE 伤害 | 目标区域 80 火焰伤害（半径 80） | ❌ |
| `slow_spell` | Common | AOE 减速 | 目标区域所有敌人减速 50%，持续 3s | ❌ |
| `arrow_rain_spell` | Rare | AOE 持续 | 目标区域 5s 内每秒 30 物理伤害 | ❌ |
| `heal_pulse_spell` | Rare | AOE 治疗 | 我方单位全场 HP +100 | ❌ |
| `freeze_all_spell` | Epic | 全屏控制 | 全屏敌人冰冻 2s | ❌ |
| `meteor_spell` | Epic | 单点爆发 | 单格 300 火焰伤害 + 30% 范围 80 溅射 | ❌ |
| `divine_protection_spell` | Legendary | 持续 buff | 水晶本波内额外承受 N 次秒杀消耗不扣 HP | ✅（跨波保留） |
| `summon_skeletons_spell` | Legendary | 召唤 | 召唤 5 个 30 HP / 8 ATK 骷髅兵 | ❌ |

> 法术卡子分类（AOE / 单体 / 召唤 / 增益 / 控制）见 [04 §6](./23-skill-buff.md)。  
> 「精炼术」类提升 `instanceLevel` 的法术见 [04 §7](./23-skill-buff.md#7-instancelevel-法术卡提升机制)，本质属法术卡子类，单独通道，不出现在上表。

### 7.3 完整卡池规模（开服默认）

| 稀有度 | 卡数 | 说明 |
|--------|------|------|
| Common | 12 | 基础塔/兵/建筑 + 基础法术 |
| Rare | 8 | 进阶塔/辅助兵/能量水晶 + 进阶法术 |
| Epic | 6 | 高级塔/刺客 + 高级法术 |
| Legendary | 4 | 战略塔 + 终极法术 |
| **总计** | **30** | 满足"开局抽 12 张"的足够多样性 |

> 开服默认解锁 6-8 张 Common 卡（详见 [13-save-system §1.2 默认初始状态](../60-tech/61-save-system.md)），其余通过火花碎片解锁。

### 7.4 卡牌配置统一格式

详见 [25-card-roguelike-refactor §CardConfig 字段](../10-gameplay/10-roguelike-loop.md)。

---

## 8. 引入节奏建议（关卡 → 新单位）

> v3.0/v3.1 推荐的关卡进度与单位解锁节奏。具体波次配置见 `src/config/levels/*.yaml`。

| 关卡 | 解锁的新单位 | 教学重点 |
|------|------------|---------|
| L1 平原（基础） | grunt / goblin_archer / runner | 基础步兵 + 远程 + 速度兵的塔防三角 |
| L2 沙漠 | wolf / wolf_rider / heavy + 关底 boss_wolf_king | 群体高速 + 冲锋骑兵 + 物理坦克 |
| L3 冰原 | mage / poison_snake / healer_priest + 关底 boss_snake_queen | 远程法师 + DOT + 治疗（最高优先级） |
| L4 火山 | bat_swarm / wisp / exploder + 关底 boss_yeti | 飞行 + 隐形 + 自爆 AOE |
| L5 城堡 | scattered_tentacle + 关底 boss_sand_worm | 抗 AoE + 形态变化 |
| L6 暗渊 | summoner_skeleton / shielded_warrior + 关底 boss_skeleton_lord | 召唤 + 护盾未破免疫 |
| L7 火域 | elite_exploder + 关底 boss_fire_elemental | 强化自爆 |
| L8 黑暗领域 | invisible_assassin / reflective_golem + 关底 boss_dark_knight | 隐形渗透 + 伤害反弹 |
| L9 终战 | abyss_lord | 三阶段切换 + 召唤 + 范围 DOT 大招 |

> 玩家阵营的塔/兵卡解锁节奏由科技树碎片成本决定（→ [30](./22-tower-tech-tree.md)），不与关卡硬绑定。

---

## 9. 数值与字段映射回顾（查表索引）

| 需要查 | 查这里 |
|--------|--------|
| 单位的具体 HP/ATK/造价/移速等 | [21-MDA §4-§7](../50-data-numerical/50-mda.md) |
| 公式骨架（护甲减伤、攻速上限等） | [05-combat-system.md](./24-combat.md) |
| 塔升级体系（路径/节点/碎片成本） | [30-tower-tech-tree.md](./22-tower-tech-tree.md) |
| 攻击模式/特殊机制语义 | 本文档 §1.1 / §1.2 |
| 视觉规范（形状/颜色） | [16-art-assets-design.md](../40-presentation/42-art-assets.md) |
| AI 行为树 | [23-ai-behavior-tree.md](../30-ai/30-behavior-tree.md) / [24-soldier-ai-behavior.md](../30-ai/31-soldier-ai.md) |
| 波次缩放 | [21-MDA §8](../50-data-numerical/50-mda.md#8-波次难度曲线重校准) |
| 天气矩阵 | [11-weather-system.md](../10-gameplay/14-weather.md) / [21-MDA §9](../50-data-numerical/50-mda.md#9-天气系统数值优化) |
| 技能与 Buff（含 `instanceLevel` 法术卡） | [04-skill-buff-system.md](./23-skill-buff.md) |
| 卡牌系统机制 | [25-card-roguelike-refactor.md](../10-gameplay/10-roguelike-loop.md) |
| 已废弃单位（毒藤塔/弩炮塔）历史档案 | [archive/deprecated-units-vine-ballista.md](../archive/deprecated-units-vine-ballista.md) |
| 已废弃 L3 被动技能历史档案 | [archive/deprecated-l3-passives.md](../archive/deprecated-l3-passives.md) |

---

## 10. 文档沿革（信息性）

| 版本 | 日期 | 关键变更 |
|------|------|---------|
| v1.0.0 | 2026-05-14 | **R3 重构**：合并原 `03-unit-data.md` + `22-new-unit-design.md` 为本文。`ice_tower` → `elemental_tower` 全量切换；新增 §2.3 塔科技树字段规范；§3.2 / §4.4 / §5.4 引入「设计储备」分类，将 v1.1 设计但暂未入池的单位与暂废弃单位分离。 |

> 数值变更记录请查 [21-MDA](../50-data-numerical/50-mda.md)。卡牌系统变更请查 [25](../10-gameplay/10-roguelike-loop.md)。塔升级变更请查 [30](./22-tower-tech-tree.md)。
