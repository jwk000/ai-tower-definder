---
title: 陷阱、法术、场景中立单位 + 秘境事件池 设计方案
status: authoritative
version: 1.1.0
last-modified: 2026-05-15
authority-for:
  - trap-unit-design
  - spell-card-taxonomy
  - scene-neutral-unit
  - scene-interactable
  - environmental-threat
  - mystic-event-pool-v34      # v1.1 新增：秘境事件池权威
supersedes: []
cross-refs:
  - v3.4-MAJOR-MIGRATION.md
  - 20-units/20-unit-system.md
  - 20-units/21-unit-roster.md
  - 20-units/23-skill-buff.md
  - 10-gameplay/10-roguelike-loop.md  # v1.1 新增：§5 秘境事件池依赖
  - 10-gameplay/11-economy.md          # v1.1 新增：奖励池 SP/金币锚点
  - 10-gameplay/13-map-level.md
  - 60-tech/64-level-editor.md
  - 50-data-numerical/50-mda.md        # §15 数值镜像
---

> ✅ **v3.4 第 2 轮收尾完成（2026-05-15）**：本文档秘境奖励改写已落地。
>
> **核心变更**：
> - **§5「秘境事件池」整节新增**（v3.4 决策 E1c + E2b 权威落地）：14 个事件 + 30% 高风险标记 + 混合奖励（金币/SP/单位卡/HP/能量 5 类）
> - **原 §5「协同链清单」→ 重编号 §6**；原 §6/§7/§8/§9 → §7/§8/§9/§10
> - **核心单位设计 v3.4 完全不变**：陷阱 9 / 法术 14 / 中立 11，全部保留
> - **同步重写 50-mda §15**：本节为事件设计权威，50-mda §15 仅作数值镜像表
> - 详见 [v3.4-MAJOR-MIGRATION §3.2](../v3.4-MAJOR-MIGRATION.md) 第 2 轮收尾

# 陷阱、法术、场景中立单位 设计方案

> 本文档是「陷阱障碍 / 法术 / 场景中立单位」三类单位的**机制权威**。所有这些单位的子分类、行为规则、设计意图、与系统的协议以此为准。

> **本文档不包含**：
> - 具体数值（HP/ATK/能量/造价等）→ [50-mda §21](../50-data-numerical/50-mda.md)
> - 单位 ID 命名与卡牌目录映射 → [21-unit-roster §5](./21-unit-roster.md)（清单层）
> - 卡牌系统机制（抽弃牌/出卡/关间节点）→ [10-roguelike-loop](../10-gameplay/10-roguelike-loop.md)
> - Buff/Debuff 叠加规则与生命周期 → [23-skill-buff §3](./23-skill-buff.md)
> - 关卡 Tile 类型与寻路 → [13-map-level §1.2](../10-gameplay/13-map-level.md)
> - 关卡编辑器 schema → [64-level-editor](../60-tech/64-level-editor.md)

---

## 0. 元信息

- **目标读者**：策划 / 客户端开发 / QA / 全员
- **前置阅读**：
  - [20-unit-system](./20-unit-system.md)（单位概念 + 规则引擎）
  - [21-unit-roster](./21-unit-roster.md)（已设计塔/兵/敌人阵容）
  - [23-skill-buff](./23-skill-buff.md)（Buff 框架）
- **关联代码**：
  - `src/config/units/traps.yaml`（新建）
  - `src/config/units/scene.yaml`（新建）
  - `src/config/cards/spells.yaml`（扩展）
  - `src/systems/TrapSystem.ts`、`src/systems/SpellCastSystem.ts`、`src/systems/SceneInteractableSystem.ts`（新建）
- **设计参考**：植物大战僵尸（情境主导）、怪物火车（堆叠 Buff 协同）、皇室战争（弹道 + 法术读条）、保卫萝卜（场景互动机关）

---

## 1. 设计哲学（核心铁律）

### 1.1 一句话定位
> **每个单位都必须能改变玩家这把的决策。不能只是「+5% 数值」。**

凡是不能让玩家说出"这把因为它，我做了 X 选择"的设计，**视为鸡肋设定，直接抛弃**。

### 1.2 三类单位的分工

| 维度 | 塔（已设计） | 士兵（已设计） | 敌人（已设计） | **陷阱障碍** | **法术** | **场景中立** |
|---|---|---|---|---|---|---|
| 部署 | 玩家出卡 | 玩家出卡 | 关卡生成 | 玩家出卡 | 玩家出卡（无实体） | 关卡预置 |
| 输出方式 | 持续 DPS | 移动 DPS | 沿路径攻击 | **瞬间爆发 / 一次性** | **瞬时 / 延迟生效** | **可争夺 / 可触发** |
| 位置 | 路径**旁**空地 | 自由移动 | 沿路径 | **路径上**（占格） | 无（指令） | 关卡固定格 |
| 决策点 | 选位置 | 选位置 + 走位 | — | **选位置 + 时机** | **选目标 + 时机** | **选用 vs 摧毁** |
| 能量典型 | 3-5 | 2-4 | — | **1-4**（鼓励多铺） | **1-10**（覆盖光谱） | 0（关卡预置） |
| 寿命 | 整局或被摧毁 | 整局或死亡 | 死亡即消失 | **耗尽即消失 / 限次** | 即时 / 区域计时 | 关内永久 / 被摧毁 |

### 1.3 设计反例（鸡肋设定，本设计**禁止**出现）

- ❌ "+5% 攻击力的光环建筑" — 没有决策点
- ❌ "持续 5s 的 +10% 暴击 buff 法术" — 玩家感觉不到
- ❌ "可摧毁的装饰物，给 1 金币" — 影响为零
- ❌ "30 HP 的减速塔（弱化版冰塔）" — 与现有重复
- ❌ "纯视觉机关（只是看着会动）" — 应属于装饰物体系（→ [43-scene-decoration](../40-presentation/43-scene-decoration.md)）

---

## 2. 陷阱障碍（Trap / Obstacle）

### 2.1 总体设计原则

1. **陷阱占据路径格**（核心差异化）—— 与塔占空地形成鲜明对比，部署即改路径。
2. **三子类心智模型**：
   - **触发式**（埋伏型）：踩到才生效
   - **区域式**（地形改造型）：存在期间持续生效
   - **占路式**（结构型）：物理阻挡 / 欺骗 AI
3. **协同链显式存在**：油坑 + 火墙、引力场 + 流星 等组合**故意设计**，让玩家发现 → 形成 roguelike 卡组乐趣。
4. **配额按类型区分**（防止单一陷阱刷屏 / 完全堵死路径）：

| 子类 | 单关单种类上限 | 说明 |
|---|---|---|
| 触发式 | 5 | 同 spike_trap 现有规则 |
| 区域式 | 3 | 区域占用较大，限制密度 |
| 占路式 | 2 | 防止单路径地图被完全封死 |

5. **Boss 抗性统一**：陷阱伤害对 Boss × 0.5（与现有 `boss_immune_stun` 系列对齐）。

### 2.2 陷阱占路径格机制（与塔最大差异）

#### 2.2.1 占位规则

| 子类 | 占用 Tile 类型 | 部署条件 | 寻路影响 |
|---|---|---|---|
| 触发式 | 1 个 `trap_path` tile | 必须放置在 `path` tile 上，部署后该 tile 转为 `trap_path`（仍可通行） | **不触发**寻路重算（仍可通行） |
| 区域式 | N 个 `trap_path` tile（取决于陷阱形状） | 同上 | **不触发**寻路重算（仍可通行） |
| 占路式 | 1 个 `blocked` tile | 路径上 OR 路径毗邻空地（见 §2.4.8）| **触发**寻路重算 |

> `trap_path` 是新增 Tile 子类型，详见 [13-map-level §1.2](../10-gameplay/13-map-level.md#12-tile-类型)。语义：「曾经是路径，被陷阱占据，但仍可通行 + 视觉标记为陷阱」。

#### 2.2.2 完全堵死处理

- 占路式陷阱（`boulder`）如果完全堵死唯一路径 → 敌人**优先攻击该陷阱**（不绕路）
- 系统在部署占路式陷阱时**预校验**：是否会完全封死所有 spawn → crystal 的路径
  - 是 → 仍允许部署，但 UI 红色警告（不阻止）
  - 否 → 正常部署
- 配额上限 2 是为了防止玩家无意中刷屏完全封路

#### 2.2.3 飞行敌豁免

- LowAir 层级敌人（蝙蝠、鬼火、热气球）**完全免疫**所有占据 Ground 层的陷阱
- 但**可被 `gravity_well` 拉拽**（引力场作用于全层级）
- 详见 [45-layer-system](../40-presentation/45-layer-system.md)

### 2.3 陷阱阵容（9 种）

#### 2.3.1 触发式陷阱（4 种）

##### `spike_trap` — 尖刺陷阱 ⭐ 沿用
- **定位**：基础款，对群体不实用
- **触发**：任意敌人踩到该 tile
- **效果**：30 物理伤害（单体，仅伤踩到者）
- **耐久**：5 次触发后损坏消失
- **特色**：低成本（1 E）适合开局铺设，但群体波次效率低 → 推动玩家学习更强陷阱
- **特殊机制（specialEffects）**：`oneshot=false`、`charges=5`

##### `landmine` — 地雷
- **定位**：群体杀手，一次性高爆
- **触发**：任意敌人踩到
- **效果**：150 AOE r80 物理伤害
- **耐久**：**1 次触发即消耗**
- **特色**：高爆 + 一次性 → 玩家必须**预判敌人密度**；爆炸后留下焦黑空格作为视觉记忆
- **特殊机制**：`oneshot=true`、`explosionRadius=80`、`explosionDamage=150`、`aoe_faction_filter=[Enemy]`

##### `tar_pit` — 焦油坑
- **定位**：减速 + 协同链触发器
- **触发**：进入区域
- **效果**：区域内（1×1 tile）敌人 -60% 移速 + 施加「易燃」标记
- **协同**：被任意火属性命中（火球术、火墙、火属性塔）→ 油坑**整片转为 5s 燃烧地**，对内伤害 ×4
- **耐久**：整波次持续，波次结束消失
- **特色**：**不直接造伤**，价值完全在协同 → 鼓励搭配火系卡组
- **特殊机制**：`area_persistent=true`、`flammable_marker=true`、`onIgnite: convert_to_burn_zone`

##### `bear_trap` — 捕兽夹
- **定位**：精英杀手 / 单点定身
- **触发**：单个敌人踩到
- **效果**：**定身 2s**（精英也能定，Boss 免疫）+ 该敌人承伤 +30% 持续期间
- **耐久**：1 次触发即消耗
- **特色**：**唯一能定精英的陷阱**；对单个高威胁目标定点处理；与狙击塔/暗杀组合形成"定身→爆发"链
- **特殊机制**：`oneshot=true`、`stunDuration=2.0`、`affectsElite=true`、`affectsBoss=false`、`damageVulnerability=0.3`

#### 2.3.2 区域式陷阱（3 种）

##### `fire_wall` — 火墙
- **定位**：画线型区域伤害
- **部署方式**：玩家拖卡时**画出方向**，沿路径形成 3 格连续火墙
- **效果**：穿过的敌人承受 20 DPS
- **耐久**：8s 后自然熄灭
- **协同**：可被点燃 `tar_pit` → 触发 ×4 燃烧
- **限制**：飞行敌免疫
- **特殊机制**：`area_persistent=true`、`duration=8.0`、`flying_immune=true`、`length=3`、`ignites_tar_pit=true`

##### `frost_mist` — 寒雾
- **定位**：唯一减攻速陷阱（克制远程反击型敌人）
- **效果**：5×3 区域内敌人 -40% 移速 + **-25% 攻速**
- **耐久**：整波次持续，波次结束消失
- **特色**：远程敌人（哥布林弓手、法师）的克星；与"分散+远程射击"波次形成对位
- **特殊机制**：`area_persistent=true`、`slowMult=0.4`、`attackSpeedMult=-0.25`、`waveLifetime=true`

##### `gravity_well` — 引力场
- **定位**：聚拢机器 + 飞行敌克星
- **效果**：r100 范围内**持续将敌人拉向中心**（每秒 30 px，向中心方向叠加位移）
- **作用层级**：包括 LowAir（飞行敌）
- **耐久**：5s 后消失
- **协同典型**：引力场 + 流星术（meteor）= 必杀群体；引力场 + 火墙 = 持续燃烧
- **特殊机制**：`area_persistent=true`、`duration=5.0`、`pull_speed=30`、`affects_layers=[Ground, LowAir]`

#### 2.3.3 占路式陷阱（2 种）

##### `boulder` — 巨石
- **定位**：物理阻挡 + 二段杀伤
- **HP**：800（高 HP，强迫敌人攻击而非绕路）
- **效果**：占据 1 个 `blocked` tile，触发寻路重算
- **死亡机制**：HP 归零时**沿路径方向滚动 1 格**，沿途单体造成 150 物理伤害（致敬保卫萝卜）
- **限制**：每关上限 2 个 + 部署预校验
- **特殊机制**：`path_block=true`、`onDeath: roll_along_path`、`rollDamage=150`、`rollDistance=1`

##### `decoy_dummy` — 假人塔
- **定位**：AI 欺骗 + 牺牲诱饵
- **位置**：空地（毗邻路径，类似塔的部署规则）
- **HP**：200
- **效果**：视觉伪装成箭塔（同等外观 + 微微抖动）
- **特色**：**欺骗敌人的 `enemyTargetPriority`** —— 刺客类敌人（`invisible_assassin`、`mage`）会优先攻击它（被骗）；死亡时播放"卸装"特效（揭穿伪装）
- **机制实现**：通过给假人塔配置 `enemyTargetPriority` 表中识别为 `Tower` 的 tag 来骗 AI
- **特殊机制**：`decoy=true`、`disguised_as=arrow_tower`、`unmask_on_death=true`

### 2.4 陷阱字段规范（在 [21-unit-roster §1.2 specialEffects](./21-unit-roster.md#12-特殊机制枚举specialeffects) 新增）

| 字段 | 适用 | 说明 |
|---|---|---|
| `oneshot` | 所有 | bool，true = 触发一次即消耗 |
| `charges` | 触发式 | int，可触发次数（默认 1） |
| `area_persistent` | 区域式 | bool，存在期间持续作用 |
| `path_block` | 占路式 | bool，占据 blocked tile，触发寻路重算 |
| `decoy` | 占路式 | bool，欺骗 AI 的诱饵单位 |
| `disguised_as` | decoy=true | 引用其他单位 ID，视觉伪装 |
| `flammable_marker` | tar_pit | bool，可被火属性引燃 |
| `onIgnite` | flammable_marker=true | RuleHandler 引用 |
| `rollDamage` / `rollDistance` | boulder onDeath | int，死亡滚动伤害 + 距离 |

### 2.5 陷阱与现有 Trap category 的关系

- 全部 9 种陷阱 `category: Trap`（与现有 `spike_trap` 一致）
- `decoy_dummy` 虽然占空地但仍属 Trap（不属 Tower，因为不自动攻击）
- 通过 `path_block` / `area_persistent` / `oneshot` 字段在 yaml 层区分子类，**不引入新的 category**

---

## 3. 法术（Spell / Skill / Buff）

### 3.1 法术 4 大子分类（重写 [23-skill-buff §5](./23-skill-buff.md#5-v30-法术卡子分类追加)）

> v3.1 调整：原 `damage / control / heal / summon / shield` 五子类（功能分类）改为 **战术身份四子类**（决策意图分类）。功能仍由 `SpellEffect` 接口实现，但卡牌设计层按身份分类。

| 子类 | 决策意图 | 玩家心智 | 代表机制 |
|---|---|---|---|
| **即时战术** | 节奏拐点：现在 vs 不现在 | 应急 / 爆发 | 瞬时 AOE、控制 |
| **延迟读条** | 预判：3s 后敌人在哪 | 计算 | 延迟落点、延迟召唤 |
| **定向增益** | 资源分配：强化哪个单位 | 投资 | 升级目标塔、自损增益 |
| **全局规则** | 改变战场规则 | 颠覆 | 时停、双倍金币、撤回 |

> **每张法术只能归属一个子类**（防止定位重复）；新法术加入时必须 PR 评审子类归属。

### 3.2 法术阵容（14 张）

#### 3.2.1 即时战术（4 张）

##### `fireball_spell` — 火球术 ⭐ 沿用
- 能量 3、Common
- 80 AOE r80（火属性，可引爆 tar_pit）

##### `chain_lightning` — 连锁闪电 **新**
- 能量 3、Common
- 4 跳，每跳 -25% 伤害（100/75/56/42）
- **特色（自损机制）**：**会跳到己方塔/兵造成 25% 该跳伤害**（友伤代价）
- 设计意图：怪物火车风格"善恶交易"——爆发力大但需要规避自家阵线
- 与 `wet` debuff 协同：伤害 ×1.5

##### `meteor_spell` — 流星术 ⭐ 沿用
- 能量 6、Epic
- 300 单点 + 30% r80 溅射（火属性）
- 与 `gravity_well` 协同形成必杀链

##### `freeze_all_spell` — 全屏冰冻 ⭐ 沿用
- 能量 8、Epic
- 全屏敌人 2s 冰冻（含飞行敌，Boss 减半为 1s）

#### 3.2.2 延迟读条（2 张）

##### `airstrike` — 空袭 **新**
- 能量 4、Rare
- **机制（核心创新）**：选定 4×4 区域 → 红圈预警 → **3s 后** 落 5 发 60 伤导弹（随机分布在区域内）
- 决策点：玩家需要**预测 3s 后敌人位置**或配合 `gravity_well` 锁人
- 视觉：3s 内目标区域显示红色锁定圈 + 倒计时
- 新字段：`delayedEffect: { delay: 3.0, effect: SpellEffect[] }`

##### `summon_skeletons_spell` — 召唤骷髅 ⭐ 沿用
- 能量 8、Legendary
- 选位置 → 1s 延迟（骷髅爬出地面动画）→ 召唤 5 骷髅（30 HP / 8 ATK）
- 延迟期间骷髅可被敌人秒杀 → 选位置是技巧

#### 3.2.3 定向增益（4 张）

> 与塔/兵单体目标的法术。区别于 §3.2.4 全局规则。

##### `refining` — 精炼术 ⭐ 已在 [23-skill-buff §7](./23-skill-buff.md#7-instancelevel-法术卡提升机制) 落地
- 能量 3、Rare
- 选定塔：`instanceLevel +1`（本局上限 3 层）
- **唯一**的 instanceLevel 提升通道

##### `berserk` — 狂热 **新**
- 能量 2、Rare
- 选定我方单位（塔或兵）：**攻速 +80% 但每秒 -3% maxHP**，持续 10s
- 自损机制（怪物火车风格）：高输出换风险
- 与 `priest`（治疗祭司）士兵协同：可中和 HP 损失

##### `rooted` — 扎根 **新**
- 能量 2、Common
- 选定塔：**5s 内不可被破坏 + 射程 +50%**，但 5s 内不能升降级
- 救场卡：应对 Boss 集火 / 关键塔被狙击
- 短期无敌 buff，触发后塔身视觉变化（缠绕藤蔓）

##### `enchant_arrow` — 附魔之弦 **新**
- 能量 4、Epic
- 选定塔：**本波内**攻击附加 20 真伤 + 减甲（永久 -10 护甲 debuff）
- 反高甲 Boss 专用 → 特化战术法术
- 不可作用于无攻击单位（路障/陷阱/Building）

#### 3.2.4 全局规则改写（4 张）

> 改变战场规则的高价法术。需要 World 级 `GlobalModifierSystem` 支持。

##### `time_dilation` — 时停 **新**
- 能量 10、Legendary
- **效果**：3s 内全场敌人冻结，塔/兵正常攻击
- 等价于"3s 自由射击" → 比 `freeze_all` 强（含输出）→ 定价高（10 E）
- 与 `enchant_arrow` 组合形成 3s 真伤暴风

##### `gold_rush` — 金潮 **新**
- 能量 3、Rare
- 本波内击杀金币奖励 ×2
- 经济局救场 / 滚雪球
- 跨波后失效

##### `divine_protection_spell` — 神圣保护 ⭐ 沿用
- 能量 5、Legendary
- 跨波保留卡：水晶本波再吸收 N 次秒杀消耗（N = 3）
- `persistAcrossWaves=true`

##### `recall` — 撤回 **新**
- 能量 1、Common
- 选定我方单位（塔/兵）：**返回手牌**（恢复满 HP，**返还该单位部署能量 50%**）
- 战略救援 + 阵型调整 + 新手纠错
- 不可作用于：陷阱、场景机关、Boss
- 卡片放回手牌时 `instanceLevel` 清零（避免无限刷强化）

### 3.3 法术接口扩展

`SpellEffect` 接口在 [23-skill-buff §5.2](./23-skill-buff.md#52-法术卡执行接口) 基础上新增：

```ts
type SpellEffect =
  | { type: 'aoe_damage'; ... }
  | { type: 'dot_zone'; ... }
  | { type: 'apply_buff'; ... }
  | { type: 'summon'; ... }
  | { type: 'heal'; ... }
  | { type: 'shield'; ... }
  // v3.1 新增 4 类
  | { type: 'delayed_effect'; delay: number; effects: SpellEffect[]; warningVfx: string }
  | { type: 'friendly_damage'; chainBehavior: 'lightning' | 'splash'; ratio: number }
  | { type: 'global_modifier'; modifier: GlobalModifier; duration: number | 'this_wave' }
  | { type: 'return_to_hand'; targetUnitId: number; refundEnergyRatio: number };

type GlobalModifier =
  | { kind: 'freeze_enemies'; ... }
  | { kind: 'gold_multiplier'; multiplier: number }
  | { kind: 'crystal_shield'; absorb_count: number };
```

### 3.4 法术与天气矩阵协同

新增 3 个 Debuff（[23-skill-buff §3.3](./23-skill-buff.md#33-预定义buff效果) 追加表）：

| Debuff | 触发来源 | 效果 | 协同 |
|---|---|---|---|
| `marked` | 标记类塔（赏金塔储备）/ 弓手狙击 | 受伤 +25%，所有塔自动优先攻击 | 任何塔的目标选择优先级覆盖 |
| `wet` | 水洼装饰 / 雨天 / 油坑潮湿变体 | 雷电伤害 ×1.5，火焰伤害 ×0.5 | 与 `chain_lightning` 协同 + 反制火系 |
| `cursed` | 暗影类塔（储备）/ 法术储备 | 死亡不掉金币 + 不触发死亡爆炸 | 克制 `exploder` / `summoner_skeleton` 死亡机制 |

### 3.5 法术与塔主动技能能量池

- 法术卡从**玩家能量 E 池**扣除（沿用 [23-skill-buff §5.3](./23-skill-buff.md#53-法术卡能量消耗规则)）
- 塔主动技能从**塔内置能量**扣除（独立）
- 两套能量系统**不互通**

---

## 4. 场景中立单位（Scene Neutral）

### 4.1 新增 category：`Scene`

> 在 [20-unit-system §5 单位分类](./20-unit-system.md#5-单位分类) 表中新增独立类别。

| category | 谁部署 | 持久性 | 卡牌入口 |
|---|---|---|---|
| `Neutral` | 关卡随机生成 | 关内 | ❌ 不可作为卡 |
| **`Scene`**（新增） | 关卡预置（设计师配置） | 关内 | ❌ 不可作为卡 |

**区别**：
- `Neutral` = 可争夺**资源点**（双方都受益，位置可随机），如 `gold_chest`
- `Scene` = **主题绑定的固定机关 / 环境威胁**（位置固定，关卡设计师配置），如 `explosive_barrel`、`vine_overgrowth`

### 4.2 三子类设计

#### 4.2.1 C1：可争夺资源点（`category: Neutral`，关卡可随机生成）

##### `gold_chest` — 金币宝箱 ⭐ 沿用
- HP 30、双方可击破
- 玩家击破：随机 50-100 金币
- **新增**：敌人击破 → 获得 30s "贪婪" buff（+15% 移速）→ **敌人也想抢**

##### `healing_spring` — 治疗泉水 ⭐ 调整（从"不可摧毁"改为"可破坏"）
- **HP 200**（与 [21-unit-roster §5.2](./21-unit-roster.md#52-陷阱--中立单位trap--neutral) 已修订一致）
- r120 内每秒 +5 HP，双方受益
- 战略博弈：玩家可主动毁掉以剥夺敌人治疗（沼泽 / 古城关战术价值高）

##### `mana_crystal` — 法力水晶 **新**
- HP 150
- 玩家击破：**返还 5 E 能量**给玩家
- 敌人击破：该波内敌方能量法术 ×2（如治疗祭司治疗量加倍、召唤师召唤数量+1）
- **双方都想抢** → 优先级博弈

##### `ancient_altar` — 远古祭坛 **新**
- HP 300
- 每 20s 触发：随机选场上 1 个单位（不限阵营）+1 instanceLevel（持续整波）
- **不可控的命运祭坛**：可能强化敌方也可能强化我方
- 玩家可主动击破阻止
- 与 `refining` 法术不冲突（同样写 instanceLevel，但本祭坛**不持久化**）

#### 4.2.2 C2：场景互动机关（`category: Scene`，关卡预置，主题绑定）

> ⚠️ **关键决策**：这些机关**关卡预置，不消耗能量**。玩家通过"利用"它们改变战局，而不是"建造"它们。这是保卫萝卜核心玩法的引入。

##### `explosive_barrel` — 火药桶
- **主题限定**：火山 L7 / 王城 L8（设计师可在 levelEditor 放置）
- 触发方式（任一）：
  - 玩家点击（任何 phase 都可）
  - 敌人误碰（路径上的桶）
  - 爆炸链锁（其他桶/陷阱爆炸 r100 内）
- 效果：r100 AOE 200 物理伤害
- 视觉：明显红色 + 闪烁，玩家一眼可识别可利用资源
- 数量典型：L7 关卡 4-8 个

##### `boulder_perch` — 危石平台
- **主题限定**：雪山 L4 / 王城 L8
- 触发方式：玩家点击或塔射击命中
- 效果：巨石沿路径滚落 3 格，沿途单体 150 物理伤害（致敬 Kingdom Rush 雪崩点）
- 数量典型：每关 1-2 个

##### `falling_icicle` — 钟乳冰柱
- **主题限定**：雪山 L4
- 位置：路径正上方某格
- 触发方式（任一）：
  - 玩家攻击（攻击悬挂图标）
  - 自动重力（每 30s 自动落下一次）
- 效果：单格 80 + 冰冻 1.5s
- 预兆：触发前 0.5s 显示警告震动 → 玩家可微调时机

##### `geyser` — 间歇泉
- **主题限定**：沼泽 L3
- 触发方式：**每 15s 自动喷发**
- 效果：r80 击退敌人 + 2s 击飞（无伤害，纯位移控制）
- 大幅改变路径计时 → 玩家围绕喷发周期布局

#### 4.2.3 C3：环境威胁（`category: Scene`，主题绑定的负面元素）

> 这类单位**对玩家施压**，存在感强但**可被玩家主动消除**——保持挑战感而不剥夺行动力。

##### `tombstone` — 墓碑
- **主题限定**：废墟 L6 / 终战 L9
- HP 200
- 机制：
  - 波次开始时立在路径上 1 格（不阻塞）
  - 从**第 3 波起**每波概率裂开
  - 裂开时**复活之前击杀的敌人**（属性 60%）
- 玩家可主动攻击粉碎（200 HP，无金币奖励）
- 致敬 PvZ 屋顶墓碑

##### `vine_overgrowth` — 藤蔓
- **主题限定**：沼泽 L3 / 林地 L2
- HP 80
- 机制：
  - 缠绕路径相邻 1 格的塔
  - 该塔每 5s **损失 5% 当前 HP**
  - 藤蔓自身**不会扩散到新塔**（仅锁定生成时的目标塔）
- 玩家可攻击藤蔓本体清除（80 HP）
- 动态威胁感：玩家必须**分配资源除草**（PvZ "Wallnut First Aid" 风格）

##### `cursed_shrine` — 诅咒神龛
- **主题限定**：深渊 L9
- HP 300
- 机制：周围 r150 内**所有塔减攻速 -30%**
- 玩家可击破 300 HP（无金币奖励）消除诅咒
- 纯负面但可主动消除 → 战略选择：是否消耗火力打神龛

### 4.3 关卡预置 vs 动态生成

| 子类 | 生成方式 | 数量来源 | 配置位置 |
|---|---|---|---|
| C1 可争夺资源点 | 关卡随机生成（mapRandom 流） | `levelConfig.neutralPool[]` 权重 | `src/config/levels/*.yaml` |
| C2 场景互动机关 | **关卡预置（固定位置）** | 设计师在 levelEditor 配置 | `levelConfig.sceneInteractables[]` |
| C3 环境威胁 | 关卡预置 OR 波次动态生成（如 tombstone 第 3 波起裂开） | 同上 + WaveSystem hook | `levelConfig.sceneInteractables[]` + 波次配置 |

### 4.4 `SceneInteractableConfig` 字段（新数据结构）

```ts
interface SceneInteractableConfig {
  id: string;                              // 如 explosive_barrel
  name: string;
  category: 'Neutral' | 'Scene';           // C1 = Neutral, C2/C3 = Scene
  themeLock?: LevelTheme[];                // 主题限定（仅 C2/C3）
  hp: number;
  position?: GridPos;                      // 关卡预置位置（C2/C3 必填）
  triggerCondition:
    | { type: 'on_click' }                 // 玩家点击
    | { type: 'on_enemy_touch' }           // 敌人触碰
    | { type: 'on_attack_received' }       // 受到攻击
    | { type: 'periodic'; interval: number } // 周期触发
    | { type: 'on_chain'; sourceTags: string[] } // 链锁
    | { type: 'on_wave_start'; minWave: number } // 波次触发
    | { type: 'periodic_destroy_chance'; chancePerWave: number }; // 每波概率
  effectOnTrigger: SpellEffect[] | RuleHandler[];
  destroyable: boolean;
  destroyReward?: { gold?: number; energy?: number };
  ambientVfx?: string;                     // 待机视觉效果
}
```

### 4.5 与 `levelConfig` 的集成

在 [13-map-level §2.1 关卡结构](../10-gameplay/13-map-level.md#21-关卡结构) 表追加：

| 配置项 | 说明 |
|---|---|
| `sceneInteractables[]` | 场景互动机关 + 环境威胁的预置列表（位置 + ID） |
| `neutralPool[]` | C1 资源点随机生成池（含权重） |

---

## 5. 秘境事件池

> v3.4 第 2 轮收尾新增 · v1.1（2026-05-15）

> **本节是 v3.4 秘境节点事件池的设计权威**。事件文本、选项分支、收益/代价类型在本节定义；具体数值映射在 [50-mda §15 秘境事件效果数值](../50-data-numerical/50-mda.md#15-秘境事件效果数值v11-镜像-27-traps-spells-scene-5)（自动同步本节）。

> **本节不包含**：
> - 秘境节点 UI 表现 → [40-ui-ux §8](../40-presentation/40-ui-ux.md#8-秘境节点ui)（v3.0.0）
> - 秘境节点在 Run 路径中的出现规则 → [10-roguelike-loop §3.3](../10-gameplay/10-roguelike-loop.md#33-秘境节点v34-重设--决策-e1c--e2b)（v2.0.0）
> - SP 流量预算 / 节点单价 → [50-mda §17](../50-data-numerical/50-mda.md#17-技能点-sp-系统v34-新建替换火花碎片)

### 5.1 设计原则（v3.4 决策 E1c + E2b）

1. **混合奖励池（E1c）**：v1.0 单一"碎片"奖励 → v3.4 五类资源混合（**金币 G / 技能点 SP / 单位卡 / 水晶 HP / 能量上限**），每个事件至少覆盖其中 1-2 类
2. **30% 高风险事件（E2b）**：14 事件中 5 个标记 `⚠️ 高风险`（占比 35.7%，落在 25-35% 允许区间），代价类型限定为 4 类：
   - **损 HP ≥ 100**：直接扣水晶 HP
   - **删卡 ≥ 1**：从本 Run 卡组永久删除卡（不影响"已解锁卡池"，v3.4 卡池已废弃）
   - **减能量上限**：本关 / 下关临时 -1 能量上限（恢复到 11-economy §3.5 锁定的 maxEnergy=10 不变）
   - **下关敌人 HP +20%**：仅影响下一关，不持续到再下一关
3. **零成本退出**：每个事件至少有一个"离开 / 拒绝 / 不参与"零成本选项，玩家可无代价退出（保留 10-roguelike-loop §3.3 v3.4 特性）
4. **单 Run 闭环**：所有奖励 / 代价在本 Run 内生效，Run 结束清零（10-roguelike-loop §11 INV-01）；删卡仅作用本 Run 卡组，不触碰 meta 持久层（v3.4 已删除）
5. **奖励梯度匹配 SP 池**（50-mda §17.2.2）：纯 SP 奖励事件按关卡分档 5/15/30/50 SP；混合奖励事件中的 SP 部分参照同梯度

### 5.2 事件池总览（14 事件）

| ID | 事件名 | 主奖励类 | 主代价类 | 风险标 | 选项数 | 关卡可用区间 |
|---|---|---|---|---|---|---|
| `ancient_altar` | 远古祭坛 | SP / HP | HP / 金币 | — | 3 | 关 2-9 |
| `healing_spring` | 治疗泉水 | HP | 删卡 | ⚠️ 高风险 | 2 | 关 1-9 |
| `wandering_merchant` | 流浪商人 | 单位卡 / 折扣 | 金币 | — | 2 | 关 1-9 |
| `mysterious_chest` | 神秘宝箱 | 金币 / SP | HP（30% 概率）| — | 2 | 关 1-9 |
| `forge` | 卡组熔炉 | 卡升级 | 金币 | — | 2 | 关 3-9 |
| `pact_of_blood` | 鲜血契约 | 全局 ATK +30% | 能量上限 -1 | ⚠️ 高风险 | 2 | 关 4-9 |
| `arcane_library` | 奥术图书馆 | 法术卡 (Rare) | 金币 | — | 2 | 关 2-9 |
| `wolves_nest` | 狼穴遭遇 | 金币 + 单位卡 | HP / 下关敌强 | ⚠️ 高风险 | 2 | 关 3-9 |
| `divine_blessing` | 神圣祝福 | HP +300 | 金币 (-30% 累计) | — | 2 | 关 5-9 |
| `cursed_idol` | 诅咒神像 | 金币 | 下关敌人 HP +20% | ⚠️ 高风险 | 2 | 关 2-9 |
| `shadow_dealer` | 影子商人 | SP +30 / 高价值 | 删卡 (本 Run) | ⚠️ 高风险 | 2 | 关 4-9 |
| `mana_well` | 法力涌泉 | 能量上限 +1 (本关) | 金币 | — | 2 | 关 1-9 |
| `traveler_camp` | 旅人营地 | 纯 SP (按关卡分档) | — | — | 2 | 关 1-9 |
| `forgotten_shrine` | 遗忘圣坛 | 卡 + SP | HP | — | 3 | 关 4-9 |

**高风险事件占比**：5/14 = 35.7%（含 `healing_spring` 删卡代价 + `pact_of_blood` 能量上限 + `wolves_nest` 失败惩罚 + `cursed_idol` 下关敌强 + `shadow_dealer` 删卡），实际覆盖 4 类代价全部出现。`mysterious_chest` 30% 概率损 HP 80（期望损 HP 24）为"中度风险"事件，不计入 ⚠️ 高风险。

> 数值精确表见 [50-mda §15 秘境事件效果数值](../50-data-numerical/50-mda.md#15-秘境事件效果数值v11-镜像-27-traps-spells-scene-5)（v3.4 同步重写）。

### 5.3 事件详细设计

#### 5.3.1 `ancient_altar` — 远古祭坛

> 一座古老的祭坛矗立在路径中央，传说触碰它能获得力量，但需付出代价。

| 选项 | 收益 | 代价 |
|---|---|---|
| **触碰水晶** | +15 SP | -100 HP |
| **献祭金币** | +200 HP | -100 G |
| **离开**（零成本） | — | — |

**设计意图**：v1.0 原"+1 Epic 卡 / -100 HP" → v3.4 改为"+15 SP / -100 HP"（卡池机制已废弃，SP 是新等价物）。三选一提供"献血 → SP" / "献金 → 回血" / "保守离开"三向博弈。

#### 5.3.2 `healing_spring` — 治疗泉水 ⚠️ 高风险

> 清澈泉水散发疗愈光辉，但传说泉水会"消化"踏入者最珍视的回忆。

| 选项 | 收益 | 代价 |
|---|---|---|
| **浸入** | +250 HP | 从本 Run 卡组随机失去 1 张卡（不可手选）|
| **离开**（零成本） | — | — |

**v3.4 调整说明**：v1.0 浸入代价为"失去 1 张随机卡"，v3.4 保留该机制但明确**仅作用本 Run 卡组**（v3.4 永久卡池已废弃，删卡不影响"已解锁卡池"概念）。Run 结束时卡组清零，删卡代价仅作用于本 Run 余下关卡。

**高风险标定**：删卡 ≥ 1（4 类高风险代价之一）。

#### 5.3.3 `wandering_merchant` — 流浪商人

> 神秘商人推车而来，提供单位卡折扣销售。

| 选项 | 收益 | 代价 |
|---|---|---|
| **折扣购卡** | 任选 1 张 Rare/Epic 单位卡（价格 80%）| -G（按 50-mda §14.1 单位卡价格 × 0.8）|
| **离开**（零成本） | — | — |

**设计意图**：与商店分支差异化——秘境的商人只售卡 + 折扣 + 强制 1 张选取，而商店是 8 槽自由选购（48-shop-redesign-v34）。

#### 5.3.4 `mysterious_chest` — 神秘宝箱（中度风险）

> 一个未知魔法封印的宝箱，70% 是金币，30% 是陷阱。

| 选项 | 收益 | 代价 |
|---|---|---|
| **开启** | 70% 概率 +150 G + 10 SP | 30% 概率 -80 HP（陷阱触发） |
| **离开**（零成本） | — | — |

**v3.4 调整**：v1.0 仅金币奖励 → v3.4 改为"金币 + 小额 SP"组合，强化"金币 vs SP"双轨经济感。

**风险标定**：30% 概率损 HP 80（期望损 HP 24 < 100 阈值，**不标**为 ⚠️ 高风险，仅为"中度风险"事件，UI 上不使用红边框）。

#### 5.3.5 `forge` — 卡组熔炉

> 一座神秘熔炉，可以将本 Run 卡组中的一张卡精炼强化。

| 选项 | 收益 | 代价 |
|---|---|---|
| **升级 1 张卡** | 任选本 Run 卡组中 1 张单位卡 `instanceLevel +1`（详 [23-skill-buff §7](./23-skill-buff.md#7-instancelevel-法术卡提升机制)）| -50 G |
| **离开**（零成本） | — | — |

**设计意图**：v1.0 直接套用 `refining` 法术效果，v3.4 保留 —— `instanceLevel` 是 v3.4 唯一未删除的非 SP 单位强化通道（[23-skill-buff §7](./23-skill-buff.md)）。

#### 5.3.6 `pact_of_blood` — 鲜血契约 ⚠️ 高风险

> 黑暗祭司提出契约：以血肉换取本 Run 所有单位的攻击力暴涨。

| 选项 | 收益 | 代价 |
|---|---|---|
| **接受契约** | 本 Run 所有单位卡 ATK +30%（永久至 Run 结束）| 能量上限本关 + 下关各 -1（恢复后回到 maxEnergy=10）|
| **拒绝**（零成本） | +50 G（拒绝奖励）| — |

**v3.4 调整说明**：v1.0 代价是"水晶 HP 上限 -100"（违反 INV-08 不可逆 HP 损失），v3.4 改为"临时减能量上限 2 关"——既符合 11-economy §3.5 的 maxEnergy=10 锁定（仅"临时减"，2 关后自然恢复），又保留高风险张力。拒绝奖励 +50 G 是 v3.4 新增（鼓励玩家"思考后再选择"，避免"全跳过"路径）。

**高风险标定**：减能量上限（4 类高风险代价之一，强制本关+下关战斗强度提升）。

#### 5.3.7 `arcane_library` — 奥术图书馆

> 一间静谧的图书馆，藏有古老的法术卷轴。

| 选项 | 收益 | 代价 |
|---|---|---|
| **学习** | 获得 1 张 Rare 法术卡（加入本 Run 卡组）| -80 G |
| **离开**（零成本） | — | — |

**设计意图**：与 `wandering_merchant` 区分——商人卖单位卡，图书馆只给法术卡（且强制 Rare）。

#### 5.3.8 `wolves_nest` — 狼穴遭遇 ⚠️ 高风险

> 误闯狼群巢穴，是战还是退？

| 选项 | 收益 | 代价 |
|---|---|---|
| **战斗** | 触发即时小战斗（3 波低强度敌人）；胜利 +200 G + 1 张 Rare 单位卡；失败 -100 HP + 下关敌人 HP +10% | 战斗时间消耗 |
| **撤退**（零成本） | — | — |

**v3.4 调整**：v1.0 失败仅 -100 HP，v3.4 增加"失败 → 下关敌人 HP +10%"（4 类高风险代价之一）。胜率取决于玩家当前卡组强度（约 60-80%）。

**高风险标定**：损 HP + 下关敌强（双重代价类型）。

#### 5.3.9 `divine_blessing` — 神圣祝福

> 神圣光辉沐浴水晶，但需要献上财富作为信仰证明。

| 选项 | 收益 | 代价 |
|---|---|---|
| **接受祝福** | 水晶 +300 HP | 失去本局累计金币的 30%（向下取整）|
| **拒绝**（零成本） | — | — |

**设计意图**：v1.0 保留。HP 是 v3.4 最珍稀的"不可恢复资源"之一（除非主动触发恢复事件），300 HP 在 8 关闯关中价值极高，30% 金币代价是合理的"高峰期付出"。

#### 5.3.10 `cursed_idol` — 诅咒神像 ⚠️ 高风险

> 神像散发着诡异光辉，传说亵渎它能获得不义之财。

| 选项 | 收益 | 代价 |
|---|---|---|
| **摸金** | +200 G | 下一关敌人 HP +20% |
| **离开**（零成本） | — | — |

**v3.4 调整**：v1.0 保留。下关敌人 HP +20% 是 4 类高风险代价之一，且**仅作用下一关**，不持续。

**高风险标定**：下关敌人 HP +20%（4 类高风险代价之一）。

#### 5.3.11 `shadow_dealer` — 影子商人 ⚠️ 高风险

> 黑市商人提供高价 SP，但需要付出"灵魂的一部分"——本 Run 卡组中的一张随机卡。

| 选项 | 收益 | 代价 |
|---|---|---|
| **交易** | **+30 SP**（大额 SP 奖励）| 从本 Run 卡组随机失去 1 张卡（不可手选） |
| **离开**（零成本） | — | — |

**v3.4 调整说明**：v1.0 奖励是"+500 碎片"（meta 持久资源），v3.4 改为"+30 SP"（本 Run 资源）。SP 价值 = 50 G/SP × 30 = 1500 G 等价物，是秘境最高单次 SP 奖励（30 SP = 50-mda §17.2.2 中"大档"奖励）。删卡代价同 `healing_spring`（v3.4 仅作用本 Run 卡组）。

**高风险标定**：删卡 ≥ 1（4 类高风险代价之一）。

#### 5.3.12 `mana_well` — 法力涌泉

> 涌泉散发着浓郁的法力，能短暂提升施法能力。

| 选项 | 收益 | 代价 |
|---|---|---|
| **饮用** | 本关能量上限临时 +1（本关结束恢复 maxEnergy=10）| -100 G |
| **离开**（零成本） | — | — |

**设计意图**：v3.4 新增。提供与 `pact_of_blood` 镜像的"正向能量上限"事件，符合 11-economy §3.5 的"能量上限 10 锁定，仅临时修改"原则——本关 +1 → 本关结束自动回落。

#### 5.3.13 `traveler_camp` — 旅人营地

> 一群旅人围在篝火边，乐意分享旅途中获得的智慧。

| 选项 | 收益 | 代价 |
|---|---|---|
| **加入**（按关卡分档） | 关 1-3：+5 SP；关 4-6：+15 SP；关 7-8：+30 SP；终战秘境（关 9 前）：+50 SP | — |
| **离开**（零成本） | — | — |

**设计意图**：v3.4 新增。**纯 SP 奖励事件**，对应 50-mda §17.2.2 的 SP 奖励池四档（5/15/30/50）。无代价，无选择压力——是秘境节点中的"保底事件"，覆盖 50-mda §17.2.2 期望流量计算的基础。

#### 5.3.14 `forgotten_shrine` — 遗忘圣坛

> 一座几乎被遗忘的圣坛，似乎曾承载强大力量。三个供奉，三种回报。

| 选项 | 收益 | 代价 |
|---|---|---|
| **献血强化** | 获得 1 张 Epic 单位卡（加入本 Run 卡组）| -150 HP |
| **献金获得 SP** | +20 SP | -150 G |
| **离开**（零成本） | — | — |

**设计意图**：v3.4 新增三选项事件，对应"卡 / SP / 保守"三向博弈。损 HP 150 接近"高风险"阈值但**不标记为高风险**（玩家可选择 SP 替代方案，不强制承担 HP 代价）。

### 5.4 事件抽取规则

#### 5.4.1 关卡可用区间

每个事件有 `availableLevels: [N_min, N_max]` 字段（详 §5.2 总览表），秘境节点抽取时仅从"本关 N 所在区间"的事件池中随机：

- 关 1-2：可用事件 = 6 个（`healing_spring` / `wandering_merchant` / `mysterious_chest` / `mana_well` / `traveler_camp` / 不含 `pact_of_blood` 等高阶事件）
- 关 3-4：扩展到 10 个
- 关 5-7：全部 14 个
- 关 8 / 终战 9 前：全部 14 个 + 强化版（如 `traveler_camp` 解锁 +50 SP "巨"档）

#### 5.4.2 高风险事件占比保障

抽取时确保**至少 25%** 抽中事件为高风险（标 ⚠️），上限 35%。具体实现：

```
if (drawnEvents.filter(e => e.highRisk).length / drawnEvents.length < 0.25) {
  // 强制替换一个非高风险事件为高风险事件
}
```

#### 5.4.3 重复防控

同一 Run 内同一事件至多出现 2 次（避免连续抽到同事件削弱探索感）。

#### 5.4.4 唯一性事件

- `pact_of_blood`：单 Run 最多触发 1 次（接受后本 Run 不再抽到）
- `forgotten_shrine`：单 Run 最多触发 1 次
- `traveler_camp` 的 +50 SP "巨"档：单 Run 最多触发 1 次（其余档可重复）

### 5.5 事件数据 schema（新增字段）

事件池在 `src/config/mystic-events.yaml`（v3.4 新建）中定义：

```yaml
- id: ancient_altar
  name: 远古祭坛
  intro: "一座古老的祭坛矗立在路径中央..."
  availableLevels: [2, 9]
  highRisk: false
  uniquePerRun: false
  maxOccurrencePerRun: 2
  options:
    - id: touch_crystal
      label: "触碰水晶"
      gains: { sp: 15 }
      costs: { hp: 100 }
    - id: sacrifice_gold
      label: "献祭金币"
      gains: { hp: 200 }
      costs: { gold: 100 }
    - id: leave
      label: "离开"
      gains: {}
      costs: {}
      zeroCost: true
```

**字段说明**：
- `gains` / `costs`：5 类资源键 `gold` / `sp` / `hp` / `cards` / `energyMax`
- `zeroCost`：true = 零成本退出选项（每个事件必须至少一个）
- `highRisk`：true = 红边框 UI 警示（v3.4 决策 E2b）
- `uniquePerRun`：true = 单 Run 唯一
- `maxOccurrencePerRun`：单 Run 内最多触发次数

### 5.6 与 v3.4 不变式核对

| 不变式 | 检查项 | 状态 |
|---|---|---|
| INV-01 单 Run 闭环 | 所有奖励/代价仅作用本 Run，Run 结束清零 | ✅ |
| INV-02 起始金币 0 | 秘境给金币是 +G，不修改 startingGold=0 设定 | ✅ |
| INV-03 起始 SP 0 | 秘境给 SP 是 +SP，不修改 startingSP=0 设定 | ✅ |
| INV-04 不可中断 | 秘境节点在关后 3 选 1 内，不打断关内战斗 | ✅ |
| INV-08 跨货币锁 | 不出现"SP → 金币 / 金币 → 能量"等违规转换 | ✅ |
| INV-09 能量上限 10 | `pact_of_blood` / `mana_well` 仅"临时修改"，自动恢复 maxEnergy=10 | ✅ |
| 卡池废弃 | 删卡仅作用本 Run 卡组，不触碰"已解锁卡池" | ✅ |

---

## 6. 协同链清单（roguelike 抽卡乐趣）

> 显式列出**故意设计的协同组合**，让玩家发现 = 卡组构筑乐趣。怪物火车风格。

| 协同链 | 触发方式 | 效果 | 卡组方向 |
|---|---|---|---|
| 油坑 + 火球术 | 火球点燃 tar_pit | 5s 燃烧地，伤害 ×4 | 火系控制流 |
| 油坑 + 火墙 | 火墙覆盖 tar_pit | 整片转为持续燃烧地 | 火系区域流 |
| 引力场 + 流星术 | 引力聚拢 → 流星单点爆发 | 必杀群体 | AOE 爆发流 |
| 引力场 + 全屏冰冻 | 聚拢 → 冻结 | 全员定身集火 | 控场流 |
| `wet` + `chain_lightning` | 雨天/水洼 → 连锁闪电 | 闪电伤害 ×1.5 | 雷电流 |
| 捕兽夹 + 暗杀 / 狙击 | 定身 → 爆发单体 | 精英定点处理 | 单点爆发流 |
| 时停 + 附魔之弦 | 3s 时停 + 真伤附加 | 3s 真伤暴风 | 终极反 Boss 组合 |
| 撤回 + 精炼术 | 撤回错位塔 → 重部署后精炼 | 阵型修正 + 强化 | 灵活流 |
| 假人塔 + 任意陷阱 | 假人吸引刺客 → 周围陷阱埋伏 | 反隐形/反精英 | 反 AI 流 |

> **不在此表的组合不保证有特殊效果**——避免组合爆炸。所有协同必须在本表显式声明 + 实现。

---

## 7. 工程影响清单（实施代价）

> 给开发同学预判工作量。**不是 API 设计，仅是依赖梳理**。

| 改动点 | 涉及模块 | 复杂度 | 优先级 |
|---|---|---|---|
| 陷阱占路径格 + Tile 类型扩展 | `13-map-level §1.2`、`MapRenderer`、`PathfindingSystem` | **高** | M1 |
| 占路式陷阱的寻路重算（boulder） | `PathfindingSystem` 已有动态寻路？需确认 | 中-高 | M1 |
| 新 category `Scene` | `core/components.ts`、`types/index.ts` | 低 | M1 |
| 关卡预置场景机关 | `levelConfig.sceneInteractables[]` schema + `level-editor` UI | 中 | M2 |
| `delayed_effect` 读条法术 | `SpellCastSystem` 增加 `delay_then_effect` RuleHandler + 预警 VFX | 中 | M2 |
| `friendly_damage` 自损法术 | `SpellCastSystem` + `chain_lightning` 链式逻辑包含我方实体 | 中 | M2 |
| 全局 modifier 系统（time_dilation/gold_rush） | 新建 `GlobalModifierSystem` | 中 | M3 |
| 撤回法术（单位回手牌） | `HandSystem.returnToHand()` + `RunManager` 能量返还 | 中 | M3 |
| 环境威胁动态生成（tombstone/vine） | `WaveSystem` 增加 `environmentalSpawn` 钩子 | 中 | M3 |
| 协同链触发（油坑引燃、引力链锁） | `RuleEngine` 增加 `onIgnite` / `onChainTrigger` 生命周期事件 | 中 | M2 |
| 新增 3 个 Debuff（marked/wet/cursed） | `BuffSystem` + 预定义 Buff 表 | 低 | M2 |

### 7.1 推荐实施分阶段

- **M1（地基）**：Tile 系统、Scene category、占路寻路重算、9 个陷阱基础部署 + 触发
- **M2（机制扩展）**：14 张法术（含读条 + 自损 + 全局规则）、3 Debuff、协同链
- **M3（场景层）**：11 个场景中立单位、levelEditor UI、环境威胁动态生成

---

## 8. 验收标准（设计层面）

设计阶段验收（实现 ≠ 设计验收）：

- [ ] 每个单位都明确写出"决策点是什么"（§1.3 反例不出现）
- [ ] 三类单位与塔/兵/敌人**无功能重复**
- [ ] 陷阱三子类（触发/区域/占路）配额规则一致（5/3/2）
- [ ] 法术 4 子类**定位无重复**（每张卡只能归属一个子类）
- [ ] 场景中立子类清晰（C1 资源点 / C2 机关 / C3 威胁）
- [ ] §6 协同链清单 ≥ 9 条，每条有具体效果
- [ ] §5 秘境事件池 ≥ 12 个事件，每个事件 2-3 选项 + 明确收益/代价
- [ ] §5 高风险事件占比约 30%，4 类代价（损 HP / 删卡 / 减能量上限 / 下关敌人 HP +20%）各有出现
- [ ] §5 每个事件至少有一个零成本选项（保留 v3.4 玩家可无代价退出原则）
- [ ] 与现有 23-skill-buff、21-unit-roster、13-map-level 字段无冲突
- [ ] 所有数值在 [50-mda §21](../50-data-numerical/50-mda.md) 有占位
- [ ] 主题限定明确（C2/C3 都关联到具体关卡）
- [ ] 接口扩展（`delayed_effect` / `friendly_damage` / `global_modifier` / `return_to_hand`）字段完整

---

## 9. 与已有体系的边界（兼容性核对）

| 已有体系 | 本设计影响 | 状态 |
|---|---|---|
| [20-unit-system §5 单位分类](./20-unit-system.md#5-单位分类) | 新增 `Scene` category | 🔶 需更新 |
| [21-unit-roster §1.2 specialEffects](./21-unit-roster.md#12-特殊机制枚举specialeffects) | 新增 `oneshot/charges/area_persistent/path_block/decoy` 等 | 🔶 需更新 |
| [21-unit-roster §5.2 陷阱/中立](./21-unit-roster.md#52-陷阱--中立单位trap--neutral) | 阵容从 3 个 → 9 + 11 = 20 个 | 🔶 需更新 |
| [21-unit-roster §7.2 法术卡](./21-unit-roster.md#72-法术卡spelleffect-驱动不指向-unitconfig) | 法术从 8 张 → 14 张 | 🔶 需更新 |
| [23-skill-buff §5 法术卡子分类](./23-skill-buff.md#5-v30-法术卡子分类追加) | 5 子类 → 4 子类（战术身份分类） | 🔶 需更新 |
| [23-skill-buff §3.3 Buff 表](./23-skill-buff.md#33-预定义buff效果) | 新增 marked / wet / cursed 3 个 Debuff | 🔶 需更新 |
| [13-map-level §1.2 Tile 类型](../10-gameplay/13-map-level.md#12-tile-类型) | 新增 `trap_path` 子类型 | 🔶 需更新 |
| [13-map-level §2.1 关卡结构](../10-gameplay/13-map-level.md#21-关卡结构) | 新增 `sceneInteractables[]` / `neutralPool[]` 字段 | 🔶 需更新 |
| [50-mda](../50-data-numerical/50-mda.md) | 新增 §21 三类单位数值表（占位） | 🔶 需更新 |
| [64-level-editor](../60-tech/64-level-editor.md) | schema 增加 `sceneInteractables[]` 编辑能力 | 🔶 需更新 |
| [10-roguelike-loop §3.3](../10-gameplay/10-roguelike-loop.md#33-秘境节点v34-重设--决策-e1c--e2b) | §5 秘境事件池接 v3.4 E1c 混合奖励 + E2b 30% 高风险 | ✅ v1.1 落地 |
| [11-economy §4](../10-gameplay/11-economy.md) | §5 秘境奖励中 SP / 金币按 11-economy 三资源轴规范使用 | ✅ v1.1 兼容 |
| [50-mda §15](../50-data-numerical/50-mda.md#15-秘境事件效果数值v11-镜像-27-traps-spells-scene-5) | §5 是秘境事件设计权威，50-mda §15 仅为数值镜像表（v3.4 同步重写）| ✅ 第 2 轮同步完成 |
| [62-faction-refactor](../60-tech/62-faction-refactor.md) | `Scene` category 阵营默认 `Neutral`，`isHostileTo` 不冲突 | ✅ 兼容 |
| [42-art-assets](../40-presentation/42-art-assets.md) | 三类单位需要视觉规范补充（不在本文档） | 🟡 后续 |
| [44-visual-effects](../40-presentation/44-visual-effects.md) | 协同链 VFX（油坑引燃、读条预警圈、撤回闪光）需补充 | 🟡 后续 |
| [46-audio](../40-presentation/46-audio.md) | 新增音效（陷阱触发、读条警报、机关触发） | 🟡 后续 |

> 🔶 = 本批次同步更新；🟡 = 后续补充（不在本批 PR 范围）

---

## 10. v3.1 一致性核对

| v3.0/v3.1 关键变更 | 本文档影响 | 状态 |
|---|---|---|
| 三资源（能量/金币/碎片）替换金币/人口/能量 | 法术从能量 E 池扣 ✅；陷阱卡同 ✅；场景单位关卡预置不消耗能量 ✅ | ✅ |
| 工具栏部署 → 手牌区出卡 | 陷阱卡走手牌区 ✅；场景机关关卡预置不入手牌 ✅ | ✅ |
| 塔升级 L1-L5 → 关外科技树 | `instanceLevel` 通道唯一为 `refining` 法术 ✅；`ancient_altar` 临时祭坛不持久化 ✅ | ✅ |
| 毒藤塔/弩炮塔废弃 | 不复活原塔；`vine_overgrowth` 是 Scene 威胁不是塔 ✅；`fire_wall` / `tar_pit` 协同覆盖原毒藤思路 ✅ | ✅ |

---

## 11. v3.4 一致性核对（v1.1 新增）

| v3.4 关键变更 | 本文档影响 | 状态 |
|---|---|---|
| **碎片经济彻底废弃** | §5 秘境事件池所有"+N 碎片"奖励**全部改为 +N SP**（按 50-mda §17.2.2 SP 奖励池 5/15/30/50 梯度）；C1 资源点 `mana_crystal` / `ancient_altar` 等 in-game 效果保留（产能量 / 临时强化），与 meta 碎片无关 | ✅ §5 落地 |
| **单 Run 闭环 / 死亡不保留** | §5 事件池所有奖励仅在本 Run 内生效（SP / HP / 卡 / 能量上限），Run 结束清零（10-roguelike-loop §11 INV-01）；删卡代价仅作用于"本 Run 卡组"，不触碰 v3.4 已删除的"永久解锁卡池" | ✅ §5 落地 |
| **关后 3 选 1（商店 / 秘境 / 跳过）** | §5 秘境节点作为"冒险分支"提供高方差奖励，配合 11-economy §4 SP 系统形成"商店稳健 vs 秘境冒险"的关后博弈 | ✅ §5 落地 |
| **30% 高风险事件占比（E2b）** | §5 标记 5/14 事件为"⚠️ 高风险"（35.7%，落在 25-35% 允许区间，详 [50-mda §15.2](../50-data-numerical/50-mda.md#152-高风险事件占比校验)），4 类代价（损 HP ≥ 100 / 删卡 ≥ 1 / 减能量上限 / 下关敌人 HP +20%）各有覆盖；UI 用红边框区分 | ✅ §5 落地 |
| **混合奖励池（E1c）** | §5 14 事件奖励覆盖 5 类资源：金币 / SP / 单位卡 / 水晶 HP / 能量上限；不出现单一类型主导 | ✅ §5 落地 |
| **能量上限锁定 10**（11-economy §3.5）| §5 "减能量上限"代价仅作用于"本关 / 下关临时减"，不修改 11-economy 的 maxEnergy=10 全局常量 | ✅ §5 落地 |
| **零成本退出保障** | §5 每个事件至少一个零成本选项（如"离开" / "拒绝"），保留 10-roguelike-loop §3.3 v3.4 特性 | ✅ §5 落地 |

---

## 修订历史

| 版本 | 日期 | 修订者 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-15 | refactor | 创建陷阱/法术/场景中立单位三类完整设计方案。新增 9 陷阱 + 14 法术（含 4 子分类重组）+ 11 场景中立单位（含新 category `Scene`）+ 3 Debuff + 9 条协同链。参考 PvZ / 怪物火车 / 皇室战争 / 保卫萝卜。 |
| 1.1.0 | 2026-05-15 | refactor | **v3.4 第 2 轮收尾**：新增 §5「秘境事件池」整章（14 事件 + 30% 高风险标记 + 混合奖励 5 类）；原 §5-§9 重编号为 §6-§10；新增 §11「v3.4 一致性核对」；§9 兼容性表新增 3 行（10-roguelike-loop / 11-economy / 50-mda §15 镜像）；§8 验收标准新增 3 条（事件池数量 / 高风险占比 / 零成本退出）。同步重写 50-mda §15 为数值镜像表（详见 50-mda v1.3.x）。 |
