---
title: 陷阱、法术、场景中立单位 设计方案
status: authoritative
version: 1.0.0
last-modified: 2026-05-15
authority-for:
  - trap-unit-design
  - spell-card-taxonomy
  - scene-neutral-unit
  - scene-interactable
  - environmental-threat
supersedes: []
cross-refs:
  - 20-units/20-unit-system.md
  - 20-units/21-unit-roster.md
  - 20-units/23-skill-buff.md
  - 10-gameplay/13-map-level.md
  - 60-tech/64-level-editor.md
  - 50-data-numerical/50-mda.md
---

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

## 5. 协同链清单（roguelike 抽卡乐趣）

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

## 6. 工程影响清单（实施代价）

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

### 6.1 推荐实施分阶段

- **M1（地基）**：Tile 系统、Scene category、占路寻路重算、9 个陷阱基础部署 + 触发
- **M2（机制扩展）**：14 张法术（含读条 + 自损 + 全局规则）、3 Debuff、协同链
- **M3（场景层）**：11 个场景中立单位、levelEditor UI、环境威胁动态生成

---

## 7. 验收标准（设计层面）

设计阶段验收（实现 ≠ 设计验收）：

- [ ] 每个单位都明确写出"决策点是什么"（§1.3 反例不出现）
- [ ] 三类单位与塔/兵/敌人**无功能重复**
- [ ] 陷阱三子类（触发/区域/占路）配额规则一致（5/3/2）
- [ ] 法术 4 子类**定位无重复**（每张卡只能归属一个子类）
- [ ] 场景中立子类清晰（C1 资源点 / C2 机关 / C3 威胁）
- [ ] §5 协同链清单 ≥ 9 条，每条有具体效果
- [ ] 与现有 23-skill-buff、21-unit-roster、13-map-level 字段无冲突
- [ ] 所有数值在 [50-mda §21](../50-data-numerical/50-mda.md) 有占位
- [ ] 主题限定明确（C2/C3 都关联到具体关卡）
- [ ] 接口扩展（`delayed_effect` / `friendly_damage` / `global_modifier` / `return_to_hand`）字段完整

---

## 8. 与已有体系的边界（兼容性核对）

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
| [62-faction-refactor](../60-tech/62-faction-refactor.md) | `Scene` category 阵营默认 `Neutral`，`isHostileTo` 不冲突 | ✅ 兼容 |
| [42-art-assets](../40-presentation/42-art-assets.md) | 三类单位需要视觉规范补充（不在本文档） | 🟡 后续 |
| [44-visual-effects](../40-presentation/44-visual-effects.md) | 协同链 VFX（油坑引燃、读条预警圈、撤回闪光）需补充 | 🟡 后续 |
| [46-audio](../40-presentation/46-audio.md) | 新增音效（陷阱触发、读条警报、机关触发） | 🟡 后续 |

> 🔶 = 本批次同步更新；🟡 = 后续补充（不在本批 PR 范围）

---

## 9. v3.1 一致性核对

| v3.0/v3.1 关键变更 | 本文档影响 | 状态 |
|---|---|---|
| 三资源（能量/金币/碎片）替换金币/人口/能量 | 法术从能量 E 池扣 ✅；陷阱卡同 ✅；场景单位关卡预置不消耗能量 ✅ | ✅ |
| 工具栏部署 → 手牌区出卡 | 陷阱卡走手牌区 ✅；场景机关关卡预置不入手牌 ✅ | ✅ |
| 塔升级 L1-L5 → 关外科技树 | `instanceLevel` 通道唯一为 `refining` 法术 ✅；`ancient_altar` 临时祭坛不持久化 ✅ | ✅ |
| 毒藤塔/弩炮塔废弃 | 不复活原塔；`vine_overgrowth` 是 Scene 威胁不是塔 ✅；`fire_wall` / `tar_pit` 协同覆盖原毒藤思路 ✅ | ✅ |

---

## 修订历史

| 版本 | 日期 | 修订者 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-15 | refactor | 创建陷阱/法术/场景中立单位三类完整设计方案。新增 9 陷阱 + 14 法术（含 4 子分类重组）+ 11 场景中立单位（含新 category `Scene`）+ 3 Debuff + 9 条协同链。参考 PvZ / 怪物火车 / 皇室战争 / 保卫萝卜。 |
