# 单位系统设计文档

## 1. 概述

在Tower Defender中，**单位（Unit）** 是游戏世界中所有实体的统一概念。包括士兵、敌人、塔、出生点、大本营、陷阱、机关、场景摆放物品等，都称为单位。

### 1.1 设计目标

- **统一性**：所有游戏实体共享相同的基础属性和生命周期
- **可配置性**：通过JSON配置定义单位行为
- **可扩展性**：易于添加新类型的单位
- **灵活性**：每个单位可以有独立的AI行为

## 2. 单位属性

所有单位都具有以下属性（某些属性可能为0或null）：

| 属性 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `hp` | number | 生命值 | 箭塔: 100, 小兵: 60 |
| `maxHp` | number | 最大生命值 | 箭塔: 100, 小兵: 60 |
| `atk` | number | 攻击力 | 箭塔: 10, 小兵: 10 |
| `defense` | number | 防御力 | 重装兵: 30, 箭塔: 0 |
| `attackSpeed` | number | 攻速（次/秒） | 箭塔: 1.0, 炮塔: 0.25 |
| `moveSpeed` | number | 移速（像素/秒） | 小兵: 70, 箭塔: 0 |
| `moveRange` | number | 移动范围（像素） | 剑士: 200, 箭塔: 0 |
| `attackRange` | number | 攻击范围（像素） | 箭塔: 180, 小兵: 0 |
| `magicResist` | number | 魔法抗性 | 默认: 0 |

### 2.1 属性说明

- **箭塔**：`moveSpeed = 0`, `moveRange = 0`, 其他属性 > 0
- **陷阱**：`moveSpeed = 0`, `moveRange = 0`, `atk > 0`, `attackRange = 0`（范围伤害）
- **大本营**：`hp > 0`, 其他战斗属性为0
- **出生点**：无战斗属性，仅作为标记

## 3. 单位层级系统

单位层级定义了单位在垂直空间中的位置，影响单位的可攻击性、碰撞检测和视觉渲染顺序。

### 3.1 层级定义

```typescript
enum UnitLayer {
  Abyss = 'abyss',           // 深渊层 - 无法抵达的最下层
  BelowGrid = 'below_grid',  // 地格下层 - 被封印的单位
  AboveGrid = 'above_grid',  // 地格上层 - 地刺等陷阱
  Ground = 'ground',         // 地面层 - 默认层级（大多数单位）
  LowAir = 'low_air',        // 低空层 - 飞行单位
  Space = 'space',           // 太空层 - 无法抵达的最上层
}
```

### 3.2 层级特性

| 层级 | 值 | 说明 | 典型单位 | 可被攻击 | 可攻击 |
|------|-----|------|----------|----------|--------|
| **深渊层** | `abyss` | 无法抵达的最下层 | 无（边界层） | 否 | 否 |
| **地格下层** | `below_grid` | 被封印/隐藏的单位 | 被封印的敌人 | 特殊条件 | 特殊条件 |
| **地格上层** | `above_grid` | 地面陷阱 | 地刺 | 是 | 是（仅对同层） |
| **地面层** | `ground` | 默认层级 | 塔、士兵、大多数敌人 | 是 | 是 |
| **低空层** | `low_air` | 飞行单位 | 飞行敌人、飞行士兵 | 特殊条件 | 是 |
| **太空层** | `space` | 无法抵达的最上层 | 无（边界层） | 否 | 否 |

### 3.3 层级交互规则

#### 攻击规则
- **地面层单位**：可以攻击地面层、地格上层、低空层单位
- **低空层单位**：可以攻击所有可攻击层级
- **地格上层单位**：只能攻击同层或被标记为"可被陷阱攻击"的单位
- **地格下层单位**：默认不可被攻击，需要特定技能/效果解除封印后才可被攻击

#### 碰撞规则
- 同层单位之间有碰撞
- 不同层单位之间默认无碰撞（特殊效果除外）

#### 渲染顺序
从下到上渲染：深渊层 → 地格下层 → 地格上层 → 地面层 → 低空层 → 太空层

### 3.4 层级配置示例

```typescript
// 地面单位（默认）
const GROUND_UNIT: UnitTypeConfig = {
  id: 'grunt',
  name: '小兵',
  layer: UnitLayer.Ground,  // 默认值，可省略
  // ...
};

// 飞行单位
const FLYING_UNIT: UnitTypeConfig = {
  id: 'flying_demon',
  name: '飞魔',
  layer: UnitLayer.LowAir,
  // ...
};

// 地刺陷阱
const SPIKE_TRAP: UnitTypeConfig = {
  id: 'spike_trap',
  name: '地刺',
  layer: UnitLayer.AboveGrid,
  // ...
};

// 被封印的单位
const SEALED_ENEMY: UnitTypeConfig = {
  id: 'sealed_demon',
  name: '封印恶魔',
  layer: UnitLayer.BelowGrid,
  // 需要特定条件解除封印
  special: {
    unsealCondition: 'destroy_seal_crystal',
  },
};
```

### 3.5 层级转换

某些效果可以使单位在层级间转换：

```typescript
// 层级转换效果配置
interface LayerChangeEffect {
  type: 'change_layer';
  targetLayer: UnitLayer;
  duration?: number;  // 临时转换持续时间（秒）
  condition?: string; // 转换条件
}

// 示例：飞行单位落地
{
  lifecycle: {
    onHit: [{
      type: 'change_layer',
      targetLayer: UnitLayer.Ground,
      duration: 3,  // 被击中后落地3秒
    }]
  }
}

// 示例：解除封印
{
  lifecycle: {
    onDeath: [{
      type: 'unseal_nearby',
      range: 200,
      targetLayer: UnitLayer.Ground,
    }]
  }
}
```

### 3.6 层级相关的行为树节点

```typescript
// 检查目标层级
{
  type: 'check_target_layer',
  params: {
    allowed_layers: ['ground', 'low_air'],  // 允许攻击的层级
  }
}

// 切换层级
{
  type: 'change_layer',
  params: {
    target_layer: 'low_air',
    duration: 5,  // 持续5秒
  }
}
```

## 4. 单位生命周期

所有单位都有以下生命周期事件：

### 4.1 事件定义

| 事件 | 触发时机 | 关联效果 |
|------|----------|----------|
| **出生（Spawn）** | 单位被创建时 | 出生动画、出生音效、出生buff |
| **死亡（Death）** | `hp <= 0` 时 | 死亡动画、死亡音效、死亡掉落、触发死亡效果 |
| **升级（Upgrade）** | 单位等级提升 | 属性提升、升级动画、升级音效 |
| **降级（Downgrade）** | 单位等级降低 | 属性降低、降级动画 |
| **攻击（Attack）** | 单位发起攻击时 | 攻击动画、攻击音效、弹道生成 |
| **受击（Hit）** | 单位受到伤害时 | 受击动画、受击音效、伤害数字 |
| **销毁（Destroy）** | 单位被移除时 | 无死亡效果（直接移除） |

### 4.2 死亡 vs 销毁

- **死亡**：触发所有死亡效果（死亡动画、掉落、成就等）
- **销毁**：不触发死亡效果，直接从世界移除（用于回收、清理等）

## 5. 单位类型

### 5.1 分类

```typescript
enum UnitCategory {
  Tower = 'tower',           // 防御塔
  Enemy = 'enemy',           // 敌人
  Soldier = 'soldier',       // 士兵（玩家单位）
  Building = 'building',     // 建筑（生产建筑等）
  Trap = 'trap',             // 陷阱
  Decoration = 'decoration', // 场景装饰
  Objective = 'objective',   // 目标点（出生点、大本营等）
  Effect = 'effect',         // 特效单位
}
```

### 5.2 单位配置结构

```typescript
interface UnitConfig {
  id: string;
  name: string;
  category: UnitCategory;
  
  // 基础属性
  hp: number;
  atk: number;
  defense: number;
  attackSpeed: number;
  moveSpeed: number;
  moveRange: number;
  attackRange: number;
  magicResist: number;
  
  // 视觉
  color: string;
  size: number;
  shape: ShapeType;
  
  // AI行为
  aiConfig: AIConfig;
  
  // 生命周期效果
  lifecycle: LifecycleConfig;
  
  // 特殊属性（可选）
  special?: Record<string, unknown>;
}
```

## 5. AI系统设计

### 5.1 AI架构

采用**行为树（Behavior Tree）** 作为AI核心，支持：

- **序列节点（Sequence）**：按顺序执行子节点
- **选择节点（Selector）**：依次尝试子节点直到成功
- **条件节点（Condition）**：检查条件
- **动作节点（Action）**：执行动作
- **装饰节点（Decorator）**：修改子节点行为

### 5.2 行为树节点类型

```typescript
enum NodeType {
  // 组合节点
  Sequence = 'sequence',     // 顺序执行
  Selector = 'selector',     // 选择执行
  Parallel = 'parallel',     // 并行执行
  
  // 装饰节点
  Inverter = 'inverter',     // 反转结果
  Repeater = 'repeater',     // 重复执行
  UntilFail = 'until_fail',  // 直到失败
  
  // 条件节点
  CheckHP = 'check_hp',           // 检查血量
  CheckEnemyInRange = 'check_enemy_in_range',  // 检查范围内敌人
  CheckAllyInRange = 'check_ally_in_range',    // 检查范围内友军
  CheckBuff = 'check_buff',       // 检查buff
  CheckCooldown = 'check_cooldown', // 检查冷却
  CheckPhase = 'check_phase',     // 检查游戏阶段
  
  // 动作节点
  Attack = 'attack',         // 攻击
  Move = 'move',             // 移动
  MoveTo = 'move_to',        // 移动到目标
  Flee = 'flee',             // 逃跑
  UseSkill = 'use_skill',    // 使用技能
  Wait = 'wait',             // 等待
  Spawn = 'spawn',           // 生成单位
  Patrol = 'patrol',         // 巡逻
}
```

### 5.3 行为树配置示例

```json
{
  "id": "arrow_tower_ai",
  "name": "箭塔AI",
  "root": {
    "type": "selector",
    "children": [
      {
        "type": "sequence",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": 180 } },
          { "type": "attack", "params": { "target": "nearest_enemy" } }
        ]
      },
      { "type": "wait", "params": { "duration": 0.1 } }
    ]
  }
}
```

```json
{
  "id": "grunt_ai",
  "name": "小兵AI",
  "root": {
    "type": "sequence",
    "children": [
      {
        "type": "selector",
        "children": [
          {
            "type": "sequence",
            "children": [
              { "type": "check_enemy_in_range", "params": { "range": 30 } },
              { "type": "attack", "params": { "target": "nearest_enemy" } }
            ]
          },
          { "type": "move_to", "params": { "target": "path_waypoint" } }
        ]
      }
    ]
  }
}
```

### 5.4 状态机备选方案

对于简单AI，也可以使用有限状态机（FSM）：

```typescript
enum AIState {
  Idle = 'idle',
  Patrol = 'patrol',
  Chase = 'chase',
  Attack = 'attack',
  Flee = 'flee',
  Dead = 'dead',
}

interface StateTransition {
  from: AIState;
  to: AIState;
  condition: string;
  params?: Record<string, unknown>;
}
```

## 6. 重构方案

### 6.1 新增组件

1. **UnitTag组件**：统一标记所有单位
   ```typescript
   interface UnitTag {
     type: 'UnitTag';
     unitId: string;        // 配置ID
     category: UnitCategory;
     level: number;
   }
   ```

2. **AI组件**：存储AI状态
   ```typescript
   interface AIComponent {
     type: 'AI';
     configId: string;      // AI配置ID
     state: AIState;        // 当前状态
     blackboard: Map<string, unknown>;  // AI黑板数据
     tree?: BehaviorTree;   // 行为树实例
   }
   ```

3. **Lifecycle组件**：生命周期事件配置
   ```typescript
   interface Lifecycle {
     type: 'Lifecycle';
     onSpawn?: EffectConfig[];
     onDeath?: EffectConfig[];
     onUpgrade?: EffectConfig[];
     onDowngrade?: EffectConfig[];
     onAttack?: EffectConfig[];
     onHit?: EffectConfig[];
     onDestroy?: EffectConfig[];
   }
   ```

### 6.2 修改现有组件

- **Health**：添加`defense`和`magicResist`
- **Movement**：合并到统一属性系统
- **Attack**：保持现有功能

### 6.3 新增系统

1. **AISystem**：处理所有单位的AI逻辑
2. **LifecycleSystem**：处理生命周期事件和效果

### 6.4 数据配置重构

将分散的配置统一为单位配置：

```typescript
// data/units/towers.json
{
  "arrow_tower": {
    "id": "arrow_tower",
    "name": "箭塔",
    "category": "tower",
    "hp": 100,
    "atk": 10,
    "defense": 0,
    "attackSpeed": 1.0,
    "moveSpeed": 0,
    "moveRange": 0,
    "attackRange": 180,
    "magicResist": 0,
    "color": "#4fc3f7",
    "size": 40,
    "shape": "rect",
    "aiConfig": { "preset": "tower_attack" },
    "lifecycle": {
      "onDeath": [{ "type": "destroy_entity" }],
      "onHit": [{ "type": "flash_white", "duration": 0.12 }]
    }
  }
}
```

## 7. 实施计划

### 阶段1：基础重构
1. 创建UnitTag组件
2. 修改Health组件添加防御属性
3. 更新类型定义
4. 创建单位配置文件

### 阶段2：AI系统
1. 定义行为树节点
2. 实现行为树引擎
3. 创建AISystem
4. 创建AI配置文件

### 阶段3：生命周期系统
1. 创建Lifecycle组件
2. 实现LifecycleSystem
3. 连接现有效果系统

### 阶段4：系统集成
1. 重构现有系统使用统一单位概念
2. 更新BuildSystem创建单位
3. 更新HealthSystem处理死亡/销毁
4. 测试验证

## 8. 文件结构

```
src/
├── components/
│   ├── UnitTag.ts          # 新增：统一单位标记
│   ├── AI.ts               # 新增：AI组件
│   ├── Lifecycle.ts        # 新增：生命周期配置
│   └── ...existing...
├── systems/
│   ├── AISystem.ts         # 新增：AI系统
│   ├── LifecycleSystem.ts  # 新增：生命周期系统
│   └── ...existing...
├── ai/
│   ├── BehaviorTree.ts     # 新增：行为树引擎
│   ├── nodes/              # 新增：行为树节点
│   └── presets/            # 新增：预设AI
├── data/
│   ├── units/              # 新增：单位配置
│   │   ├── towers.json
│   │   ├── enemies.json
│   │   ├── soldiers.json
│   │   └── buildings.json
│   └── ai/                 # 新增：AI配置
│       ├── tower_ai.json
│       ├── enemy_ai.json
│       └── soldier_ai.json
└── docs/
    └── unit-system-design.md  # 本文档
```
