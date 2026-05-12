# 02 — 单位系统

> 统一单位概念、配置驱动架构、动态行为规则
>
> **v3.0 扩展**：根据 [25-card-roguelike-refactor](./25-card-roguelike-refactor.md)，**所有玩家可部署单位都从卡牌生成**。本文档保持 ECS 单位概念不变，新增「卡牌作为生成入口」说明（§8）。

---

## 1. 核心理念

**一切皆单位**。塔是我方单位，敌人是敌方单位，可移动角色是我方单位，中立机关也是单位。它们的本质相同——都有一组属性、一组行为规则、一组视觉表现。**不同单位只是配置不同**。

> **v3.0 补充**：在玩家可控的范围内，**单位实例由卡牌出牌时实例化**——卡牌是部署入口，单位是运行时实体。详见 §8。

```
┌─────────────────────────────────────────────────────┐
│                    单位配置                          │
│                                                     │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐           │
│  │ 静态属性 │  │ 行为规则  │  │ AI决策   │           │
│  │          │  │          │  │          │           │
│  │ HP/ATK  │  │ 生命周期 │  │ 行为树   │           │
│  │ 速度/范围│  │ 攻击模式 │  │ (复杂AI  │           │
│  │ 造价/人口│  │ 目标选择 │  │  补充)   │           │
│  └────┬────┘  └────┬─────┘  └────┬─────┘           │
│       │            │             │                 │
│       └────────────┼─────────────┘                 │
│                    ▼                               │
│               单位实例                              │
│  ┌─────────────────────────────────────┐           │
│  │ 塔 · 我方单位 · 敌人 · 中立单位 · BOSS │           │
│  └─────────────────────────────────────┘           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 2. 单位属性分类

| 分类 | 说明 | 谁有 |
|------|------|------|
| **生存属性** | HP、护甲、魔抗 | 所有单位 |
| **战斗属性** | ATK、攻速、射程、伤害类型 | 有攻击能力的单位 |
| **机动属性** | 移速、移动范围 | 可移动单位（非塔） |
| **经济属性** | 造价、回收价、升级费、人口占用 | 玩家可部署的单位 |
| **视觉属性** | 形状轮廓、颜色、尺寸、符号特征、待机动画、弹道样式 | 所有单位 |
| **分类属性** | 所属阵营、类别、层级 | 所有单位 |

> **视觉属性**不以文字标签区分单位，而是通过形状轮廓+符号特征+动态特效的组合让玩家一眼识别。详见 [12-视觉特效](./12-visual-effects.md)。

---

## 3. 动态行为规则

> **核心原则：行为树统一驱动。** 所有单位的行为（目标选择、攻击、移动、技能释放）由行为树配置驱动。专用系统（AttackSystem/MovementSystem 等）仅执行行为树委派的原子动作，不再自主决策。

详见 [23-AI行为树统一方案](./23-ai-behavior-tree.md)。

### 3.1 生命周期事件规则

单位在生命周期关键节点触发声明式规则。以下是完整的生命周期事件体系：

| 事件 | 触发时刻 | 典型规则 |
|------|----------|----------|
| **onCreate** | 单位被创建（建造/生成/召唤） | 播放出生特效、施加初始Buff、广播音效 |
| **onDeath** | HP归零，即将从世界移除 | 爆炸伤害、掉落金币/能量、生成子单位、播放死亡动画、留下废墟 |
| **onHit** | 受到伤害（每次） | 闪白反馈、触发反击、叠受伤层数 |
| **onAttack** | 发起一次攻击（发射弹道） | 生成弹道、播放攻击音效、叠攻击层数 |
| **onKill** | 击杀另一个单位 | 回血、获得Buff、获得额外金币 |
| **onUpgrade** | 等级提升 | 解锁技能、改变视觉、播放升级特效 |
| **onDestroy** | 非死亡移除（回收/出售） | 返还资源、播放回收特效 |
| **onEnter** | 踏入某个区域 | 触发陷阱、获得区域Buff |
| **onLeave** | 离开某个区域 | 移除区域Buff |

### 3.2 行为规则（声明式）

规则引擎通过组合以下原子规则实现各种单位行为：

#### 3.2.1 目标选择规则

| 规则 | 参数 | 说明 |
|------|------|------|
| `nearest` | - | 选择最近的合法目标 |
| `farthest` | - | 选择最远的 |
| `weakest` | - | 选择HP最低的 |
| `strongest` | - | 选择HP最高的 |
| `random` | - | 随机选择 |
| `type_priority` | `["Tower", "Soldier"]` | 按类型优先级选取 |
| `target_marker` | `"taunted_by"` | 攻击施放嘲讽的单位 |

#### 3.2.2 攻击模式规则

| 规则 | 说明 | 适用单位 |
|------|------|----------|
| `single_target` | 单体攻击，弹道命中主目标 | 箭塔、弓手 |
| `aoe_splash` | 命中时对半径内造成溅射伤害 | 炮塔 |
| `chain` | 弹跳攻击N个目标，每次衰减 | 电塔 |
| `piercing` | 贯穿路径上所有敌人 | 激光塔 |
| `dot_aoe` | 持续对范围内敌人造成伤害 | 陷阱 |
| `heal` | 对范围内友方恢复HP | 祭司、泉水 |

#### 3.2.3 移动模式规则

| 规则 | 说明 |
|------|------|
| `follow_path` | 沿预设路径从出生点走向终点 |
| `chase_target` | 追击当前目标 |
| `hold_position` | 固定位置不移动 |
| `patrol` | 在几个路径点间巡逻 |
| `flee` | 远离目标 |

#### 3.2.4 能力使用规则

| 规则 | 说明 |
|------|------|
| `on_cooldown_ready` | 冷却完毕时使用 |
| `on_hp_below` | HP低于阈值时使用 |
| `on_enemies_in_range` | 范围内敌人数量达标时使用 |
| `on_ally_died` | 友方单位死亡时触发 |

### 3.3 行为树（统一AI驱动）

所有单位的运行时行为由行为树配置决定。每个单位通过 `aiConfig` 字符串引用一套行为树配置（`src/ai/presets/aiConfigs.ts`），`AISystem` 每帧 tick 行为树，动作节点委派到专用系统执行。

| 使用场景 | 说明 |
|----------|------|
| 塔的自动攻击 | `check_enemy_in_range` → `attack` |
| 敌人的沿路进攻 | `move_to(path_waypoint)` 或 `check_enemy_in_range` → `attack` |
| 士兵的智能战斗 | `check_enemy_in_range` → `attack` / `move_towards(nearest_enemy)` |
| Boss 阶段切换 | `check_hp` → 切换行为子树 |
| 多技能优先级 | Selector 决定技能释放顺序 |

行为树节点类型：Sequence、Selector、Inverter、CheckHP、CheckEnemyInRange、Attack、MoveTo、MoveTowards、Wait。详见 [23-AI行为树统一方案](./23-ai-behavior-tree.md)。

---

## 4. 阵营与层级

### 4.1 阵营

| 阵营 | 说明 | 相互攻击 |
|------|------|----------|
| **Player** | 玩家方 | 攻击 Enemy |
| **Enemy** | 敌方 | 攻击 Player |
| **Neutral** | 中立 | 双方均可攻击 |

### 4.2 空间层级

| 层级 | 说明 | 典型单位 |
|------|------|----------|
| `Ground` | 地面（默认） | 塔、大多数敌人、单位 |
| `AboveGrid` | 地表陷阱层 | 地刺 |
| `LowAir` | 低空 | 飞行敌人 |
| `BelowGrid` | 地下/封印层 | 被封印的敌人 |

- 地面单位可攻击 Ground + AboveGrid + LowAir
- 低空单位可攻击所有层
- AboveGrid 仅攻击同层
- BelowGrid 默认不可攻击
- 层级可被技能/效果临时改变

---

## 5. 单位分类

| 分类 | 前缀 | 说明 | 示例 |
|------|------|------|------|
| `Tower` | 塔 | 固定防御建筑，自动攻击 | 箭塔、冰塔 |
| `Soldier` | 兵 | 玩家操控的移动单位 | 盾卫、剑士 |
| `Enemy` | 敌 | 沿路径进攻的单位 | 小兵、BOSS |
| `Building` | 建 | 生产建筑 | 金矿、能量塔 |
| `Trap` | 陷 | 地面机关 | 尖刺陷阱 |
| `Neutral` | 中 | 中立资源/机关 | 泉水、宝箱 |
| `Objective` | 标 | 目标点 | 基地、出生点 |

---

## 6. 配置示例（规则为主）

```yaml
# 箭塔 — 声明式规则配置
arrow_tower:
  category: Tower
  faction: Player
  layer: Ground
  
  stats: {hp: 100, atk: 10, attackSpeed: 1.0, range: 200, armor: 0, mr: 0}
  cost: {build: 50, upgrade: [40, 70, 110, 160]}
   visual: {shape: "复合几何体", color: "#4fc3f7", size: 36}
  
  # 行为规则
  behavior:
    targetSelection: nearest      # 选择最近目标
    attackMode: single_target     # 单体攻击
    movementMode: hold_position   # 不移动
  
  # 生命周期规则
  lifecycle:
    onDeath:                      # 死亡时
      - type: leave_ruins
      - type: play_effect
        effect: destruction_particles
    onHit:                        # 受击时
      - type: flash_color
        color: "#ffffff"
        duration: 0.1
    onAttack:                     # 攻击时
      - type: spawn_projectile
        projectile: arrow
      - type: play_sound
        sound: SFX_ARROW_SHOOT
```

```yaml
# 自爆虫 — 声明式规则配置
exploder:
  category: Enemy
  faction: Enemy
  layer: Ground
  
  stats: {hp: 40, atk: 10, speed: 90, armor: 0, mr: 0}
  reward: {gold: 12}
   visual: {shape: "复合几何体", color: "#ff8a65", size: 12}
  
  behavior:
    targetSelection: nearest
    attackMode: single_target
    movementMode: follow_path
  
  lifecycle:
    onDeath:
      - type: deal_aoe_damage    # 死亡爆炸
        radius: 100
        damage: 50
        targets: [Player]        # 仅伤害玩家方
      - type: play_effect
        effect: explosion_red
      - type: play_sound
        sound: SFX_ENEMY_DIE
    onHit:
      - type: flash_color
        color: "#ffffff"
        duration: 0.1
    onCreate:
      - type: visual_flash_loop   # 出生后持续闪烁
        alpha_range: [0.5, 1.0]
        speed: 8
```

```yaml
# 指挥官 BOSS — 规则 + 行为树
boss_commander:
  category: Enemy
  tier: Boss
  faction: Enemy
  
  stats: {hp: 800, atk: 30, speed: 40, armor: 60, mr: 40}
   visual: {shape: "复合几何体", color: "#ffd54f", size: 36, crown: true}
  
  behavior:
    targetSelection: nearest
    attackMode: single_target
    movementMode: follow_path
  
  # Boss使用行为树处理复杂决策
  ai_tree: boss_commander_ai
  
  lifecycle:
    onHit:
      - type: flash_color
        color: "#ffffff"
        duration: 0.1
    onCreate:
      - type: hp_bar_boss    # Boss专用大血条
    # 阶段转换
    onCondition:
      condition: "hp_ratio < 0.5"
      fireOnce: true
      effects:
        - type: enter_phase2
        - type: play_effect
          effect: boss_rage
        - type: pause_world
          duration: 0.3
        - type: change_color
          color: "#d32f2f"
          blend: 0.35
```

```yaml
# 尖刺陷阱 — 中立单位配置
spike_trap:
  category: Trap
  faction: Neutral
  layer: AboveGrid
  
  stats: {hp: 1, atk: 30}
  cost: {build: 40}
   visual: {shape: "复合几何体", color: "#e53935", size: 28}
  
  behavior:
    targetSelection: nearest
    attackMode: dot_aoe           # 持续范围伤害
    aoe_radius: 32
    trigger_condition: enemy_on_tile
  
  lifecycle:
    onCreate:
      - type: visual_dim
        alpha: 0.6
    onAction:                     # 触发时
      - type: visual_flash_bright
        color: "#ff0000"
        duration: 0.2
```

---

## 7. 规则引擎架构

```
                    ┌──────────────────┐
                    │   单位配置文件    │
                    │  (YAML/JSON)     │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   配置解析器      │
                    │   加载时执行      │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
  ┌───────▼───────┐  ┌──────▼──────┐  ┌───────▼───────┐
  │  静态属性模块  │  │ 行为规则模块 │  │  AI模块       │
  │  stats        │  │  rules       │  │  behavior_tree│
  │  cost         │  │  lifecycle   │  │  presets      │
  │  visual       │  │  behavior    │  │               │
  └───────┬───────┘  └──────┬──────┘  └───────┬───────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼─────────┐
                    │   单位实例管理器  │
                    │   运行时管理      │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  ECS World       │
                    │  所有单位以Entity│
                    │  形式存在        │
                    └──────────────────┘
```

- **配置是蓝图**：每个单位类型对应一份配置，定义了所有属性和规则
- **实例是运行时对象**：从配置创建单位实例，实例独立运行
- **规则是驱动**：运行时系统（RuleEngine）每帧检查并执行匹配的规则
- **行为树是补充**：仅复杂AI使用，行为树节点本身也可引用生命周期规则

---

## 8. 卡牌作为生成入口（v3.0 新增）

### 8.1 单位 vs 卡牌的概念边界

| 概念 | 范围 | 持久性 | 数据来源 |
|------|------|--------|---------|
| **CardConfig（卡片配置）** | 设计时蓝图 | 静态配置文件 | `src/data/cards.ts`（新增）|
| **CardInstance（卡片实例）** | 本局 Run 内 | 整局 Run | `ongoingRun.deck[]`（每张含临时等级） |
| **UnitConfig（单位配置）** | 设计时蓝图 | 静态配置文件 | `src/data/gameData.ts`（保留） |
| **Unit Entity（单位实例）** | 关内战场 | 关内生命周期 | ECS World（实时） |

### 8.2 卡牌 → 单位 实例化流程

```
玩家出卡（拖卡到合法位置）
   │
   ▼
1. 卡牌系统检查：能量足够？目标合法？
   │
   ▼
2. 消耗能量 E
   │
   ▼
3. 按卡牌类型分支：
   │
   ├─ 单位卡 / 建筑卡：
   │     │
   │     ▼
   │  根据 cardConfig.spawnUnitId 实例化单位
   │  - 读取 UnitConfig（与旧版完全相同）
   │  - 创建 ECS Entity（带 Position/Render/Health/Attack 等组件）
   │  - 应用本局临时等级（实例 baseLevel = card 实例等级）
   │  - 该实例**死亡后不回弃牌堆**
   │     │
   │     ▼
   │  卡片进入弃牌堆
   │
   └─ 法术卡：
         │
         ▼
      根据 cardConfig.spellEffect 立即生效
      - 不创建持久 Entity（瞬时效果 / 短暂 VFX 实体）
      - 范围/数值由 cardConfig + 临时升级决定
         │
         ▼
      卡片进入弃牌堆（除非 persistAcrossWaves=true）
```

### 8.3 CardConfig 字段（与 UnitConfig 关联）

```typescript
interface CardConfig {
  id: string;                  // 卡 ID（如 'arrow_tower_card'）
  name: string;                // 卡名（中文）
  type: 'unit' | 'building' | 'spell';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';

  energyCost: number;          // 出卡能量消耗
  description: string;         // 卡片简介

  // 单位/建筑卡：指向 UnitConfig
  spawnUnitId?: string;        // 引用 src/data/gameData.ts 中的 unit ID

  // 法术卡：效果配置
  spellEffect?: SpellEffectConfig;

  // 视觉
  visual: {
    artworkSymbol: string;     // 卡牌主图几何符号（80×60 区域）
    bgTheme: string;           // 卡背主题色
  };

  // 升级路径（永久 + 临时）
  upgradePath?: {
    baseLevel: 1 | 2 | 3 | 4 | 5;
    statsPerLevel: Partial<UnitStats>;  // 等级递增数值
    spellEffectPerLevel?: SpellEffectConfig;
  };

  // 特殊标记
  persistAcrossWaves?: boolean; // 法术卡是否跨波保留
  removable?: boolean;          // 是否可在商店移除（默认 true）
}
```

### 8.4 关键设计取舍

- **卡牌不持有单位的运行时数据**——只持有"如何生成"的元信息
- **临时升级影响实例化**——出卡时，引擎读取 CardInstance 的当前等级，把对应数值施加到新实例上
- **场上实例死亡不回弃牌堆**——卡是"召唤令"，使用一次即弃
- **法术卡的范围扩散逻辑等仍走 SkillSystem**——卡只是把目标格 + 等级传给现有 SkillSystem

### 8.5 配置示例

```yaml
# 剑士卡 — 单位卡
swordsman_basic:
  id: swordsman_basic
  name: 剑士
  type: unit
  rarity: common
  energyCost: 2
  description: "近战单位，对地面敌人造成中等伤害"
  spawnUnitId: swordsman    # 引用既有的 swordsman UnitConfig
  visual:
    artworkSymbol: cross_sword
    bgTheme: warm_red
  upgradePath:
    baseLevel: 1
    statsPerLevel:
      hp: 30           # 每级 +30 HP
      atk: 4           # 每级 +4 ATK
  removable: true

# 火球术卡 — 法术卡
fireball_spell:
  id: fireball_spell
  name: 火球术
  type: spell
  rarity: common
  energyCost: 3
  description: "对目标区域造成 80 火焰伤害，半径 80px"
  spellEffect:
    type: aoe_damage
    damageType: fire
    damage: 80
    radius: 80
    visualEffect: fireball_explosion
  visual:
    artworkSymbol: fireball
    bgTheme: warm_red
  upgradePath:
    baseLevel: 1
    spellEffectPerLevel:
      damage: 30       # 每级 +30 damage
  persistAcrossWaves: false
  removable: true
```

---

## 9. 单位的 AI 行为优先级（v3.0 新增·敌方）

v3.0 引入「敌方单位攻击优先级」机制：敌人沿路径行进时，如果路径附近有高优先级目标，停下来攻击。

| 字段 | 类型 | 说明 |
|------|------|------|
| `enemyTargetPriority` | `EnemyTargetPriority[]` | 攻击优先级配置列表 |
| `engagementRange` | `number` | 评估范围（px），默认 80 |
| `disengagementRange` | `number` | 脱离范围（px），默认 120 |

```typescript
interface EnemyTargetPriority {
  filter: {
    category?: 'Tower' | 'Soldier' | 'Building' | 'Trap' | 'Objective';
    tags?: string[];             // 如 ['healer', 'support']
    threat?: 'high' | 'medium' | 'low';
  };
  weight: number;                // 0-100，越高越优先
}
```

### 9.1 默认行为规则

- 路径敌人默认 `targetSelection: follow_path + check_priority_target`
- 评估范围内有匹配 priority 的目标 → 停下攻击
- 该目标超出 disengagementRange 或被消灭 → 恢复 follow_path
- 多个目标同时匹配 → 按 weight 加权随机选择（防止扎堆）

### 9.2 示例

```yaml
# 远程刺客敌人 — 优先攻击我方治疗类塔/单位
enemy_assassin:
  enemyTargetPriority:
    - filter: { category: Soldier, tags: [healer] }
      weight: 100
    - filter: { category: Tower, tags: [support] }
      weight: 80
    - filter: { category: Tower }
      weight: 30
  engagementRange: 90
  disengagementRange: 130
```

详见 [23-ai-behavior-tree §X 威胁度评分扩展](./23-ai-behavior-tree.md)。
