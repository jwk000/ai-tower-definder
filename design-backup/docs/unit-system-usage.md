# 单位系统使用指南

## 概述

本项目已重构为统一的单位系统，所有游戏实体（塔、敌人、士兵、建筑、陷阱等）都使用相同的配置结构和组件系统。

## 文件结构

```
src/
├── components/
│   ├── UnitTag.ts          # 统一单位标记组件
│   ├── AI.ts               # AI组件
│   └── Lifecycle.ts        # 生命周期配置组件
├── systems/
│   ├── AISystem.ts         # AI系统（行为树执行）
│   ├── LifecycleSystem.ts  # 生命周期系统
│   └── UnitFactory.ts      # 单位工厂
├── ai/
│   ├── BehaviorTree.ts     # 行为树引擎
│   └── presets/
│       └── aiConfigs.ts    # AI配置预设
├── data/
│   └── units/
│       └── unitConfigs.ts  # 单位配置
└── unit-system/
    └── index.ts            # 统一导出
```

## 快速开始

### 1. 创建单位

使用 `UnitFactory` 创建单位实体：

```typescript
import { UnitFactory } from './systems/UnitFactory.js';

// 在游戏初始化时创建工厂
const unitFactory = new UnitFactory(world);

// 创建塔
const towerId = unitFactory.createTower('arrow_tower', x, y, { row: 1, col: 1 });

// 创建敌人
const enemyId = unitFactory.createEnemy('grunt', x, y);

// 创建士兵
const soldierId = unitFactory.createSoldier('shield_guard', x, y, { row: 2, col: 2 });

// 创建建筑
const buildingId = unitFactory.createBuilding('gold_mine', x, y, { row: 3, col: 3 });

// 创建陷阱
const trapId = unitFactory.createTrap('trap_spike', x, y, { row: 4, col: 4 });
```

### 2. 配置单位

单位配置在 `src/data/units/unitConfigs.ts` 中定义：

```typescript
export const ARROW_TOWER_CONFIG: UnitTypeConfig = {
  id: 'arrow_tower',
  name: '箭塔',
  category: UnitCategory.Tower,
  
  // 基础属性
  hp: 100,
  atk: 10,
  defense: 0,
  attackSpeed: 1.0,
  moveSpeed: 0,        // 塔不能移动
  moveRange: 0,        // 塔不能移动
  attackRange: 180,
  magicResist: 0,
  
  // 视觉
  color: '#4fc3f7',
  size: 40,
  shape: 'rect',
  
  // AI行为
  aiConfig: 'tower_basic',
  
  // 生命周期效果
  lifecycle: {
    onDeath: [{ type: 'destroy_entity' }],
    onHit: [{ type: 'flash_white', params: { duration: 0.12 } }],
  },
  
  // 经济
  cost: 50,
  sellValue: 25,
  upgradeCosts: [30, 60, 100, 150],
  
  // 特殊属性
  special: {
    damageType: 'physical',
    upgradeAtkBonus: [5, 8, 12, 18],
    upgradeRangeBonus: [20, 20, 30, 30],
  },
};
```

### 3. 配置AI行为

AI行为在 `src/ai/presets/aiConfigs.ts` 中使用行为树配置：

```typescript
export const TOWER_BASIC_AI: BehaviorTreeConfig = {
  id: 'tower_basic',
  name: '基础塔AI',
  description: '攻击范围内最近的敌人',
  root: {
    type: 'selector',      // 选择节点：依次尝试子节点
    children: [
      {
        type: 'sequence',  // 顺序节点：依次执行子节点
        children: [
          // 检查范围内是否有敌人
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          // 攻击最近的敌人
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      // 没有敌人时等待
      { type: 'wait', params: { duration: 0.1 } }
    ]
  }
};
```

### 4. 行为树节点类型

#### 条件节点
- `check_hp` - 检查血量比例
- `check_enemy_in_range` - 检查范围内敌人
- `check_ally_in_range` - 检查范围内友军
- `check_cooldown` - 检查技能冷却
- `check_phase` - 检查游戏阶段

#### 动作节点
- `attack` - 攻击目标
- `move_to` - 移动到目标
- `move_towards` - 向目标移动
- `flee` - 逃跑
- `use_skill` - 使用技能
- `wait` - 等待

#### 组合节点
- `sequence` - 顺序执行（全部成功才成功）
- `selector` - 选择执行（一个成功就成功）

#### 装饰节点
- `inverter` - 反转结果
- `repeater` - 重复执行
- `cooldown` - 冷却时间

### 5. 变量系统

在配置中可以使用变量引用：

```json
{
  "type": "check_enemy_in_range",
  "params": { "range": "${attack_range}" }  // 引用单位的攻击范围
}
```

内置变量：
- `${hp}`, `${max_hp}`, `${hp_ratio}` - 生命值相关
- `${atk}`, `${defense}` - 攻防属性
- `${attack_speed}`, `${move_speed}` - 速度属性
- `${attack_range}`, `${move_range}` - 范围属性
- `${level}` - 等级
- `${x}`, `${y}` - 坐标

### 6. 生命周期事件

单位支持以下生命周期事件：

```typescript
enum LifecycleEvent {
  Spawn = 'spawn',         // 出生
  Death = 'death',         // 死亡（触发死亡效果）
  Destroy = 'destroy',     // 销毁（不触发死亡效果）
  Upgrade = 'upgrade',     // 升级
  Downgrade = 'downgrade', // 降级
  Attack = 'attack',       // 攻击
  Hit = 'hit',             // 受击
}
```

**死亡 vs 销毁**：
- 死亡：触发 `onDeath` 效果（如掉落金币、播放死亡动画）
- 销毁：不触发 `onDeath` 效果，直接移除（用于回收单位）

### 7. 效果系统

效果在生命周期事件触发时执行：

```typescript
// 注册自定义效果处理器
lifecycleSystem.registerEffectHandler('my_effect', (entityId, params) => {
  // 自定义逻辑
  console.log(`Effect triggered for entity ${entityId}`, params);
});

// 在单位配置中使用
{
  lifecycle: {
    onDeath: [
      { type: 'my_effect', params: { value: 42 } },
      { type: 'destroy_entity' }
    ]
  }
}
```

内置效果：
- `destroy_entity` - 销毁实体
- `reward_gold` - 金币奖励
- `release_population` - 释放人口
- `death_effect` - 死亡特效
- `explode` - 爆炸效果

### 8. 升级单位

```typescript
// 升级单位（自动应用属性加成）
const success = unitFactory.upgradeUnit(entityId);
if (success) {
  console.log('Unit upgraded!');
}
```

### 9. 销毁/杀死单位

```typescript
// 销毁单位（不触发死亡效果）
unitFactory.destroyUnit(entityId);

// 杀死单位（触发死亡效果）
unitFactory.killUnit(entityId);
```

## 添加新单位

1. 在 `src/data/units/unitConfigs.ts` 中添加配置
2. 在 `src/ai/presets/aiConfigs.ts` 中添加AI配置（如需要）
3. 在单位配置中引用AI配置ID

```typescript
// 1. 添加单位配置
export const MY_NEW_UNIT: UnitTypeConfig = {
  id: 'my_new_unit',
  name: '我的新单位',
  category: UnitCategory.Soldier,
  // ... 其他配置
  aiConfig: 'my_custom_ai',
};

// 2. 添加AI配置
export const MY_CUSTOM_AI: BehaviorTreeConfig = {
  id: 'my_custom_ai',
  name: '自定义AI',
  root: {
    // ... 行为树配置
  }
};

// 3. 注册到配置表
export const UNIT_CONFIGS: Record<string, UnitTypeConfig> = {
  // ... 其他配置
  'my_new_unit': MY_NEW_UNIT,
};

export const ALL_AI_CONFIGS: BehaviorTreeConfig[] = [
  // ... 其他配置
  MY_CUSTOM_AI,
];
```

## 性能优化

- AI系统会自动跳过未激活的单位
- 行为树实例会被缓存复用
- 可以通过 `ai.updateInterval` 控制AI更新频率
- 使用黑板（blackboard）存储单位私有数据，避免重复计算

## 调试

```typescript
// 获取AI上下文（用于调试）
const context = aiSystem.getAIContext(entityId);
if (context) {
  console.log('AI State:', context.ai.state);
  console.log('Target:', context.ai.targetId);
  console.log('Blackboard:', Object.fromEntries(context.ai.blackboard));
}

// 获取性能统计
const stats = aiSystem.getStats();
console.log('AI Stats:', stats);
```
