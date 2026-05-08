# AI系统设计文档

## 1. 概述

AI系统采用**行为树（Behavior Tree）** 架构，为每个单位提供可配置的AI行为。行为树是一种树状结构，用于描述和控制游戏AI的决策逻辑。

### 1.1 设计目标

- **可配置**：通过JSON定义AI行为，无需编写代码
- **可复用**：预设AI可在多个单位间共享
- **可组合**：通过组合节点构建复杂行为
- **高性能**：支持大量单位同时运行AI

## 2. 行为树架构

### 2.1 节点类型

#### 组合节点（Composite）
控制子节点的执行顺序

| 节点 | 说明 | 执行逻辑 |
|------|------|----------|
| `sequence` | 顺序节点 | 依次执行子节点，一个失败则失败 |
| `selector` | 选择节点 | 依次执行子节点，一个成功则成功 |
| `parallel` | 并行节点 | 同时执行所有子节点 |

#### 装饰节点（Decorator）
修改子节点的行为

| 节点 | 说明 | 执行逻辑 |
|------|------|----------|
| `inverter` | 反转节点 | 反转子节点的结果 |
| `repeater` | 重复节点 | 重复执行子节点N次 |
| `until_fail` | 直到失败 | 重复执行直到子节点失败 |
| `always_succeed` | 总是成功 | 忽略子节点失败 |
| `cooldown` | 冷却节点 | 子节点执行后冷却N秒 |

#### 条件节点（Condition）
检查条件，返回成功或失败

| 节点 | 参数 | 说明 |
|------|------|------|
| `check_hp` | `{ "op": "<", "value": 0.5 }` | 检查血量比例 |
| `check_enemy_in_range` | `{ "range": 180 }` | 检查范围内敌人 |
| `check_ally_in_range` | `{ "range": 100 }` | 检查范围内友军 |
| `check_buff` | `{ "buff_id": "stun" }` | 检查是否有buff |
| `check_cooldown` | `{ "skill_id": "taunt" }` | 检查技能冷却 |
| `check_phase` | `{ "phase": "battle" }` | 检查游戏阶段 |
| `check_target_alive` | `{}` | 检查目标是否存活 |
| `check_distance_to_target` | `{ "op": "<", "value": 50 }` | 检查与目标距离 |
| `check_moving` | `{}` | 检查是否在移动 |
| `check_stunned` | `{}` | 检查是否被眩晕 |

#### 动作节点（Action）
执行具体行为

| 节点 | 参数 | 说明 |
|------|------|------|
| `attack` | `{ "target": "nearest_enemy" }` | 攻击目标 |
| `move_to` | `{ "target": "path_waypoint" }` | 移动到目标 |
| `move_towards` | `{ "target": "nearest_enemy" }` | 向目标移动 |
| `flee` | `{ "from": "nearest_enemy" }` | 远离目标 |
| `use_skill` | `{ "skill_id": "taunt" }` | 使用技能 |
| `wait` | `{ "duration": 1.0 }` | 等待时间 |
| `spawn` | `{ "unit_id": "grunt", "count": 3 }` | 生成单位 |
| `patrol` | `{ "waypoints": [...] }` | 巡逻 |
| `set_target` | `{ "target": "nearest_enemy" }` | 设置目标 |
| `clear_target` | `{}` | 清除目标 |
| `play_animation` | `{ "animation": "attack" }` | 播放动画 |

### 2.2 目标选择器

用于`target`参数的特殊值：

| 值 | 说明 |
|------|------|
| `nearest_enemy` | 最近的敌人 |
| `nearest_ally` | 最近的友军 |
| `weakest_enemy` | 最弱的敌人 |
| `strongest_enemy` | 最强的敌人 |
| `lowest_hp_ally` | 血量最低的友军 |
| `self` | 自己 |
| `path_waypoint` | 路径下一个点 |
| `home` | 回家点 |
| `specific:{id}` | 特定实体 |

## 3. 行为树配置格式

### 3.1 完整配置

```json
{
  "id": "tower_attack_ai",
  "name": "塔攻击AI",
  "description": "防御塔基础攻击AI",
  "version": "1.0",
  "blackboard": {
    "default_target": null,
    "attack_count": 0
  },
  "root": {
    "type": "selector",
    "children": [
      {
        "type": "sequence",
        "name": "攻击流程",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": 180 } },
          { "type": "set_target", "params": { "target": "nearest_enemy" } },
          { "type": "attack", "params": { "target": "self.target" } }
        ]
      },
      {
        "type": "wait",
        "params": { "duration": 0.1 }
      }
    ]
  }
}
```

### 3.2 节点配置格式

```json
{
  "type": "node_type",
  "name": "节点名称（可选）",
  "params": {
    "param1": "value1",
    "param2": "value2"
  },
  "children": []  // 仅组合节点和装饰节点需要
}
```

### 3.3 条件表达式

用于比较操作的参数：

```json
{
  "op": "<",  // 操作符: ==, !=, <, >, <=, >=
  "value": 0.5
}
```

## 4. 预设AI

### 4.1 塔类AI

#### tower_basic（基础塔）
```json
{
  "id": "tower_basic",
  "root": {
    "type": "selector",
    "children": [
      {
        "type": "sequence",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": "${attack_range}" } },
          { "type": "attack", "params": { "target": "nearest_enemy" } }
        ]
      },
      { "type": "wait", "params": { "duration": 0.1 } }
    ]
  }
}
```

#### tower_chain_lightning（闪电塔）
```json
{
  "id": "tower_chain_lightning",
  "root": {
    "type": "selector",
    "children": [
      {
        "type": "sequence",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": "${attack_range}" } },
          { "type": "attack", "params": { "target": "nearest_enemy", "chain": true } }
        ]
      },
      { "type": "wait", "params": { "duration": 0.1 } }
    ]
  }
}
```

### 4.2 敌人类AI

#### enemy_basic（基础敌人）
```json
{
  "id": "enemy_basic",
  "root": {
    "type": "selector",
    "children": [
      {
        "type": "sequence",
        "name": "攻击单位",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": 30, "target_type": "soldier" } },
          { "type": "attack", "params": { "target": "nearest_enemy" } }
        ]
      },
      {
        "type": "sequence",
        "name": "沿路径移动",
        "children": [
          { "type": "move_to", "params": { "target": "path_waypoint" } }
        ]
      }
    ]
  }
}
```

#### enemy_ranged（远程敌人）
```json
{
  "id": "enemy_ranged",
  "root": {
    "type": "selector",
    "children": [
      {
        "type": "sequence",
        "name": "攻击建筑",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": 150, "target_type": "tower" } },
          { "type": "attack", "params": { "target": "nearest_enemy", "projectile": true } }
        ]
      },
      {
        "type": "sequence",
        "name": "攻击单位",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": 30, "target_type": "soldier" } },
          { "type": "attack", "params": { "target": "nearest_enemy" } }
        ]
      },
      {
        "type": "move_to",
        "params": { "target": "path_waypoint" }
      }
    ]
  }
}
```

#### enemy_boss（Boss敌人）
```json
{
  "id": "enemy_boss",
  "root": {
    "type": "selector",
    "children": [
      {
        "type": "sequence",
        "name": "阶段2技能",
        "children": [
          { "type": "check_hp", "params": { "op": "<", "value": 0.5 } },
          { "type": "check_cooldown", "params": { "skill_id": "boss_special" } },
          { "type": "use_skill", "params": { "skill_id": "boss_special" } }
        ]
      },
      {
        "type": "sequence",
        "name": "攻击",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": 30 } },
          { "type": "attack", "params": { "target": "nearest_enemy" } }
        ]
      },
      {
        "type": "move_to",
        "params": { "target": "path_waypoint" }
      }
    ]
  }
}
```

### 4.3 士兵类AI

#### soldier_basic（基础士兵）
```json
{
  "id": "soldier_basic",
  "root": {
    "type": "selector",
    "children": [
      {
        "type": "sequence",
        "name": "玩家控制",
        "children": [
          { "type": "check_player_control", "params": {} },
          { "type": "move_to", "params": { "target": "player_target" } }
        ]
      },
      {
        "type": "sequence",
        "name": "攻击敌人",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": "${attack_range}" } },
          { "type": "attack", "params": { "target": "nearest_enemy" } }
        ]
      },
      {
        "type": "sequence",
        "name": "追击敌人",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": 200 } },
          { "type": "move_towards", "params": { "target": "nearest_enemy" } }
        ]
      },
      {
        "type": "wait",
        "params": { "duration": 0.2 }
      }
    ]
  }
}
```

#### soldier_tank（坦克士兵）
```json
{
  "id": "soldier_tank",
  "root": {
    "type": "selector",
    "children": [
      {
        "type": "sequence",
        "name": "嘲讽技能",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": 100, "count": 3 } },
          { "type": "check_cooldown", "params": { "skill_id": "taunt" } },
          { "type": "use_skill", "params": { "skill_id": "taunt" } }
        ]
      },
      {
        "type": "sequence",
        "name": "攻击",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": "${attack_range}" } },
          { "type": "attack", "params": { "target": "nearest_enemy" } }
        ]
      },
      {
        "type": "sequence",
        "name": "移动",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": 200 } },
          { "type": "move_towards", "params": { "target": "nearest_enemy" } }
        ]
      },
      {
        "type": "wait",
        "params": { "duration": 0.2 }
      }
    ]
  }
}
```

### 4.4 建筑类AI

#### building_production（生产建筑）
```json
{
  "id": "building_production",
  "root": {
    "type": "sequence",
    "children": [
      { "type": "produce_resource", "params": {} },
      { "type": "wait", "params": { "duration": 1.0 } }
    ]
  }
}
```

### 4.5 陷阱类AI

#### trap_damage（伤害陷阱）
```json
{
  "id": "trap_damage",
  "root": {
    "type": "sequence",
    "children": [
      { "type": "check_enemy_in_range", "params": { "range": 0, "same_tile": true } },
      { "type": "attack", "params": { "target": "all_in_range", "damage_type": "dot" } }
    ]
  }
}
```

## 5. 实现细节

### 5.1 行为树节点基类

```typescript
abstract class BTNode {
  abstract tick(context: AIContext): NodeStatus;
}

enum NodeStatus {
  Success = 'success',
  Failure = 'failure',
  Running = 'running',
}
```

### 5.2 AI上下文

```typescript
interface AIContext {
  entityId: number;
  world: World;
  unit: UnitTag;
  position: Position;
  health: Health;
  attack?: Attack;
  blackboard: Map<string, unknown>;
  dt: number;
}
```

### 5.3 行为树执行流程

```
1. 获取单位的AI组件
2. 创建/复用AI上下文
3. 从根节点开始执行行为树
4. 根据节点状态决定下一步
5. 更新黑板数据
6. 返回执行结果
```

### 5.4 性能优化

- **节点缓存**：复用已创建的节点实例
- **条件缓存**：短时间内不重复计算相同条件
- **频率控制**：不同单位在不同帧执行AI
- **LOD**：远处单位降低AI更新频率

## 6. 变量系统

### 6.1 变量引用

在配置中使用`${variable}`引用变量：

```json
{ "type": "check_enemy_in_range", "params": { "range": "${attack_range}" } }
```

### 6.2 内置变量

| 变量 | 说明 |
|------|------|
| `${hp}` | 当前血量 |
| `${max_hp}` | 最大血量 |
| `${hp_ratio}` | 血量比例 |
| `${atk}` | 攻击力 |
| `${defense}` | 防御力 |
| `${attack_speed}` | 攻速 |
| `${move_speed}` | 移速 |
| `${attack_range}` | 攻击范围 |
| `${move_range}` | 移动范围 |
| `${level}` | 等级 |
| `${x}` | X坐标 |
| `${y}` | Y坐标 |

### 6.3 黑板变量

单位私有的黑板数据，可在节点间共享：

```json
{
  "blackboard": {
    "target_id": null,
    "patrol_index": 0,
    "last_attack_time": 0
  }
}
```

## 7. 调试支持

### 7.1 可视化调试

- 显示当前执行的节点
- 显示条件判断结果
- 显示目标选择
- 显示移动路径

### 7.2 日志输出

```typescript
const AI_DEBUG = true;

function logAI(entityId: number, message: string): void {
  if (AI_DEBUG) {
    console.log(`[AI][${entityId}] ${message}`);
  }
}
```

### 7.3 性能监控

- 记录每个节点的执行时间
- 统计AI更新频率
- 识别性能瓶颈节点

## 8. 扩展性

### 8.1 自定义节点

通过注册机制添加新的节点类型：

```typescript
BehaviorTree.registerNode('custom_node', (params) => {
  return new CustomNode(params);
});
```

### 8.2 插件系统

支持通过插件扩展AI功能：

```typescript
interface AIPlugin {
  name: string;
  onBeforeTick?(context: AIContext): void;
  onAfterTick?(context: AIContext): void;
  customNodes?: Record<string, NodeFactory>;
}
```
