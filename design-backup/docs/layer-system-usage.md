# 单位层级系统使用指南

## 概述

单位层级系统定义了单位在垂直空间中的位置，影响单位的可攻击性、碰撞检测和视觉渲染顺序。

## 层级定义

```typescript
enum UnitLayer {
  Abyss = 'abyss',           // 深渊层 - 无法抵达的最下层
  BelowGrid = 'below_grid',  // 地格下层 - 被封印/隐藏的单位
  AboveGrid = 'above_grid',  // 地格上层 - 地面陷阱（如地刺）
  Ground = 'ground',         // 地面层 - 默认层级（大多数单位）
  LowAir = 'low_air',        // 低空层 - 飞行单位
  Space = 'space',           // 太空层 - 无法抵达的最上层
}
```

## 层级特性

| 层级 | 值 | 说明 | 典型单位 | 可被攻击 | 可攻击 |
|------|-----|------|----------|----------|--------|
| **深渊层** | `abyss` | 无法抵达的最下层 | 无（边界层） | 否 | 否 |
| **地格下层** | `below_grid` | 被封印/隐藏的单位 | 被封印的敌人 | 特殊条件 | 特殊条件 |
| **地格上层** | `above_grid` | 地面陷阱 | 地刺 | 是 | 是（仅对同层） |
| **地面层** | `ground` | 默认层级 | 塔、士兵、大多数敌人 | 是 | 是 |
| **低空层** | `low_air` | 飞行单位 | 飞行敌人、飞行士兵 | 特殊条件 | 是 |
| **太空层** | `space` | 无法抵达的最上层 | 无（边界层） | 否 | 否 |

## 层级交互规则

### 攻击规则

- **地面层单位**：可以攻击地面层、地格上层、低空层单位
- **低空层单位**：可以攻击所有可攻击层级
- **地格上层单位**：只能攻击同层或被标记为"可被陷阱攻击"的单位
- **地格下层单位**：默认不可被攻击，需要特定技能/效果解除封印后才可被攻击

### 碰撞规则

- 同层单位之间有碰撞
- 不同层单位之间默认无碰撞（特殊效果除外）

### 渲染顺序

从下到上渲染：深渊层 → 地格下层 → 地格上层 → 地面层 → 低空层 → 太空层

## 使用方法

### 1. 在单位配置中指定层级

```typescript
import { UnitLayer, UnitCategory } from '../types/index.js';

// 地面单位（默认，可省略layer属性）
const GROUND_UNIT: UnitTypeConfig = {
  id: 'grunt',
  name: '小兵',
  category: UnitCategory.Enemy,
  layer: UnitLayer.Ground,  // 默认值，可省略
  // ... 其他配置
};

// 飞行单位
const FLYING_UNIT: UnitTypeConfig = {
  id: 'flying_demon',
  name: '飞魔',
  category: UnitCategory.Enemy,
  layer: UnitLayer.LowAir,
  // ... 其他配置
};

// 地刺陷阱
const SPIKE_TRAP: UnitTypeConfig = {
  id: 'spike_trap',
  name: '地刺',
  category: UnitCategory.Trap,
  layer: UnitLayer.AboveGrid,
  // ... 其他配置
};

// 被封印的单位
const SEALED_ENEMY: UnitTypeConfig = {
  id: 'sealed_demon',
  name: '封印恶魔',
  category: UnitCategory.Enemy,
  layer: UnitLayer.BelowGrid,
  // ... 其他配置
};
```

### 2. 运行时检查和修改层级

```typescript
import { UnitTag } from '../components/UnitTag.js';
import { UnitLayer } from '../types/index.js';
import { CType } from '../types/index.js';

// 获取单位的UnitTag组件
const unitTag = world.getComponent<UnitTag>(entityId, CType.UnitTag);

if (unitTag) {
  // 检查当前层级
  console.log('当前层级:', unitTag.layer);
  
  // 切换层级（例如：飞行单位落地）
  unitTag.changeLayer(UnitLayer.Ground);
  
  // 检查是否可以攻击目标
  const targetTag = world.getComponent<UnitTag>(targetId, CType.UnitTag);
  if (targetTag) {
    const canAttack = unitTag.canAttackLayer(targetTag.layer);
    console.log('是否可以攻击:', canAttack);
  }
  
  // 检查是否可以被目标攻击
  const canBeAttacked = unitTag.canBeAttackedByLayer(UnitLayer.LowAir);
  console.log('是否可以被低空单位攻击:', canBeAttacked);
  
  // 检查是否与目标有碰撞
  const collides = unitTag.collidesWithLayer(UnitLayer.Ground);
  console.log('是否与地面单位碰撞:', collides);
}
```

### 3. 在行为树中使用层级

```typescript
// 检查目标层级
const CHECK_TARGET_LAYER_AI: BehaviorTreeConfig = {
  id: 'check_layer_ai',
  name: '层级检查AI',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        children: [
          // 检查目标是否在允许的层级
          {
            type: 'check_target_layer',
            params: {
              allowed_layers: ['ground', 'low_air'],
            }
          },
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      { type: 'wait', params: { duration: 0.1 } }
    ]
  }
};

// 切换层级
const FLYING_UNIT_AI: BehaviorTreeConfig = {
  id: 'flying_unit_ai',
  name: '飞行单位AI',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '被击中后落地',
        children: [
          { type: 'check_buff', params: { buff_id: 'grounded' } },
          { type: 'change_layer', params: { target_layer: 'ground', duration: 3 } }
        ]
      },
      {
        type: 'sequence',
        name: '正常飞行攻击',
        children: [
          { type: 'check_enemy_in_range', params: { range: 150 } },
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      { type: 'wait', params: { duration: 0.1 } }
    ]
  }
};
```

### 4. 层级转换效果

```typescript
// 在生命周期效果中使用层级转换
const LAYER_CHANGE_UNIT: UnitTypeConfig = {
  id: 'flying_demon',
  name: '飞魔',
  category: UnitCategory.Enemy,
  layer: UnitLayer.LowAir,
  lifecycle: {
    // 被击中后落地3秒
    onHit: [{
      type: 'change_layer',
      params: {
        targetLayer: UnitLayer.Ground,
        duration: 3,
      }
    }],
    // 死亡时解除附近单位的封印
    onDeath: [{
      type: 'unseal_nearby',
      params: {
        range: 200,
        targetLayer: UnitLayer.Ground,
      }
    }]
  },
  // ... 其他配置
};
```

## 默认层级交互规则

```typescript
export const LAYER_INTERACTION_RULES: Record<UnitLayer, {
  canBeAttackedBy: UnitLayer[];
  canAttack: UnitLayer[];
  collidesWith: UnitLayer[];
}> = {
  [UnitLayer.Abyss]: {
    canBeAttackedBy: [],  // 深渊层不可被攻击
    canAttack: [],        // 深渊层不能攻击
    collidesWith: [],     // 深渊层无碰撞
  },
  [UnitLayer.BelowGrid]: {
    canBeAttackedBy: [],  // 默认不可被攻击（需要解除封印）
    canAttack: [],        // 默认不能攻击
    collidesWith: [UnitLayer.BelowGrid],  // 仅与同层碰撞
  },
  [UnitLayer.AboveGrid]: {
    canBeAttackedBy: [UnitLayer.Ground, UnitLayer.LowAir],
    canAttack: [UnitLayer.Ground, UnitLayer.AboveGrid],
    collidesWith: [UnitLayer.AboveGrid],
  },
  [UnitLayer.Ground]: {
    canBeAttackedBy: [UnitLayer.Ground, UnitLayer.LowAir, UnitLayer.AboveGrid],
    canAttack: [UnitLayer.Ground, UnitLayer.AboveGrid, UnitLayer.LowAir],
    collidesWith: [UnitLayer.Ground],
  },
  [UnitLayer.LowAir]: {
    canBeAttackedBy: [UnitLayer.Ground, UnitLayer.LowAir],
    canAttack: [UnitLayer.Ground, UnitLayer.LowAir, UnitLayer.AboveGrid],
    collidesWith: [UnitLayer.LowAir],
  },
  [UnitLayer.Space]: {
    canBeAttackedBy: [],  // 太空层不可被攻击
    canAttack: [],        // 太空层不能攻击
    collidesWith: [],     // 太空层无碰撞
  },
};
```

## 自定义层级交互规则

可以在单位配置中覆盖默认规则：

```typescript
const CUSTOM_LAYER_UNIT: UnitTypeConfig = {
  id: 'anti_air_tower',
  name: '防空塔',
  category: UnitCategory.Tower,
  layer: UnitLayer.Ground,
  // 自定义层级交互规则
  layerInteraction: {
    canBeAttackedBy: [UnitLayer.Ground, UnitLayer.LowAir],
    canAttack: [UnitLayer.LowAir, UnitLayer.Space],  // 只能攻击空中单位
    collidesWith: [UnitLayer.Ground],
  },
  // ... 其他配置
};
```

## 设计新单位时的层级选择

| 单位类型 | 建议层级 | 说明 |
|----------|----------|------|
| 防御塔 | `Ground` | 默认地面层 |
| 士兵 | `Ground` | 默认地面层 |
| 地面敌人 | `Ground` | 默认地面层 |
| 飞行敌人 | `LowAir` | 需要特殊攻击手段 |
| 地刺陷阱 | `AboveGrid` | 在地格上层，不影响地面单位移动 |
| 治疗泉 | `Ground` | 默认地面层 |
| 被封印的敌人 | `BelowGrid` | 需要解除封印才能攻击 |
| Boss（地面） | `Ground` | 默认地面层 |
| Boss（飞行） | `LowAir` | 需要特殊攻击手段 |

## 注意事项

1. **默认层级**：如果不指定`layer`属性，单位默认为`Ground`层级
2. **边界层级**：`Abyss`和`Space`是边界层级，通常不用于实际单位
3. **封印机制**：`BelowGrid`层级的单位需要特殊机制解除封印
4. **渲染顺序**：层级决定了单位的渲染顺序，低层先渲染，高层后渲染
5. **碰撞检测**：只有同层单位之间才有碰撞（除非特殊配置）
