# 24 — 士兵AI行为设计

> 我方可移动单位（统称"士兵"）的AI行为：警戒/追击/战斗/游荡 状态机设计
>
> 版本: v2.1 | 日期: 2026-05-12 | 状态: §6.2 行为树已实装（4 套士兵 AI）

---

## 目录

1. [设计评审](#1-设计评审)
2. [概念定义：三圈模型](#2-概念定义三圈模型)
3. [状态机设计](#3-状态机设计)
4. [敌方士兵反击规则](#4-敌方士兵反击规则)
5. [视觉反馈规范](#5-视觉反馈规范)
6. [行为树映射](#6-行为树映射)
7. [组件与数据变更](#7-组件与数据变更)
8. [数值参考](#8-数值参考)
9. [验收标准](#9-验收标准)

---

## 1. 设计评审

### 1.1 原始提案

> 我方可移动单位统称为士兵。士兵以放置点为圆心有个移动距离，士兵自身有攻击距离和警戒距离。
> 给我方士兵增加：
> - 在攻击范围内随机游荡
> - 警戒范围内发现敌人 → 进入警戒状态（头顶红色叹号）→ 追击敌人 → 进入攻击距离后攻击
> 
> 给敌人士兵增加：
> - 如果被士兵攻击，需要停止移动攻击士兵

### 1.2 评审意见

**总体评价：方向正确，是经典塔防/RTS的防御单位行为模式。以下是具体评审：**

| 要点 | 评价 | 修正建议 |
|------|------|----------|
| 三层距离设计 | ✅ 合理 | 移动范围 > 警戒范围 > 攻击范围，符合直觉 |
| 红叹号警戒视觉 | ✅ 经典设计 | 当前代码无此机制，需新增视觉组件 |
| 追击后攻击 | ✅ 合理 | 已有基础设施（行为树 `MoveTowardsNode` + `AttackNode`） |
| 敌方反击 | ✅ 合理 | 需增加"伤害触发仇恨"机制（见 §4） |
| "攻击范围内游荡" | ❌ 术语错误 | 游荡应在**移动范围（home range）**内，非攻击范围 |
| 缺少"返回"状态 | ❌ 遗漏 | 敌人离开警戒范围后，士兵应返回部署点恢复游荡 |
| 敌方反击范围 | ⚠️ 需明确 | 哪些敌人类型会反击？反击触发条件是什么？ |

### 1.3 关键修正

**术语更正**：

| 错误表述 | 正确表述 | 含义 |
|----------|----------|------|
| 在攻击范围内随机游荡 | 在**移动范围**内随机游荡 | 空闲时在 `moveRange` 半径内漫步 |
| 警戒范围发现敌人追击 | 警戒范围发现敌人 → 追击（受移动范围约束） | 追击不能超出 `moveRange` |

**补充缺失**：
- **RETURN 状态**：敌人离开警戒范围后，士兵返回 `homeX/homeY`
- **仇恨机制**：敌人受到士兵伤害时，将攻击来源设为当前目标（见 §4）
- **反击条件**：仅携带 `Attack` 组件的敌人才能反击

---

## 2. 概念定义：三圈模型

```
           ┌──────────────────────────────┐
           │         移动范围 (moveRange)   │
           │    ┌──────────────────┐       │
           │    │  警戒范围 (alert)  │       │
           │    │  ┌─────────┐     │       │
           │    │  │攻击范围  │     │       │
           │    │  │(attack) │     │       │
           │    │  │  🗡️    │     │       │
           │    │  └─────────┘     │       │
           │    │                  │       │
           │    └──────────────────┘       │
           │                               │
           │            🏠 放置点           │
           └──────────────────────────────┘
```

| 范围 | 定义 | 当前代码位置 | 行为 |
|------|------|-------------|------|
| **移动范围** (`moveRange`) | 士兵离开放置点的最大距离 | `Movement.moveRange` + `Movement.homeX/Y` | 任何移动都不能超出此范围（绳索约束） |
| **警戒范围** (`alertRange`) | 能发现敌人的最远距离 | **新增字段**：`Attack.alertRange` | 范围内出现敌人 → 进入 ALERT 状态 |
| **攻击范围** (`attackRange`) | 能攻击到敌人的距离 | `Attack.range` | 范围内有敌人 → 进入 COMBAT 状态 |

**范围大小关系**：`moveRange > alertRange > attackRange`

> **远程兵抖动防护**（关键）：远程士兵（如弓手）的 `alertRange` **不允许 ≈ attackRange**，否则会出现"警戒到敌人 → 追击 1 帧 → 进入射程 → 停下 → 敌人后退一步 → 再次警戒"的抖动循环。
>
> **硬约束**：`alertRange ≥ attackRange × 1.1 + 20px`。
>
> - 近战士兵（盾卫/剑士）：`alertRange = attackRange × 4~5`（远距离发现，近身后战斗）
> - 远程士兵（弓手）：`alertRange = attackRange × 1.1 + 20px`（视野略大于射程，必能进入射程命中）
> - 治疗士兵（祭司）：`alertRange = attackRange × 1.5~2`（中等视野，走向需要治疗的友方）

### 2.1 状态优先级（显式声明）

状态切换由 BT 的 selector 强制按以下优先级判定，每 tick 重新评估：

```
COMBAT > ALERT > RETURN > IDLE
```

- **COMBAT**：当前目标存活 + 在 `attackRange` 内
- **ALERT**：`alertRange` 内有合法敌人（且不满足 COMBAT）
- **RETURN**：与 home 距离 > 10px 且无敌人在 `alertRange` 内
- **IDLE**：以上均不满足

> 任何 tick 都强制做这 4 个判定，不允许"状态保留惯性"。这确保不会卡在某状态下不动（如远程兵追击超界后陷入死循环）。

---

## 3. 状态机设计

### 3.1 状态转换图

```
                          ┌──────────────────┐
        无敌人             │                  │
    ┌─────────────────────►       IDLE        │
    │                     │    (游荡+等待)     │
    │                     │  moveMode=Patrol  │
    │                     └────────┬─────────┘
    │                              │
    │                    警戒范围发现敌人
    │                              │
    │                     ┌────────▼─────────┐
    │                     │                  │
    │  敌人全灭/全离开     │      ALERT       │
    │  警戒范围            │   (追击+红!)      │
    │                     │ moveMode=Chase   │
    │                     └────────┬─────────┘
    │                              │
    │                    进入攻击范围
    │                              │
    │                     ┌────────▼─────────┐
    │   敌人死亡/          │                  │
    │   离开攻击范围        │     COMBAT       │
    └─────────────────────│    (攻击+追击)     │
       回到IDLE            │ moveMode=Hold    │
                          └────────┬─────────┘
                                   │
                         目标移动到移动范围外
                         或超出警戒范围
                                   │
                          ┌────────▼─────────┐
                          │                  │
                          │     RETURN       │
                          │   (返回home)      │
                          │ moveMode=Patrol  │
                          │  target=homeX/Y  │
                          └────────┬─────────┘
                                   │
                            回到home位置
                                   │
                                   ▼
                                 IDLE
```

### 3.2 状态详解

#### IDLE — 空闲

| 属性 | 值 |
|------|-----|
| moveMode | `Patrol` (3) 或自定义 `Wander` |
| 行为 | 在 `moveRange` 半径内随机漫步，无目标时原地微动 |
| 触发条件 | 无敌人进入警戒范围 |
| 退出条件 | 警戒范围发现敌人 |
| 视觉 | 正常色，无感叹号 |

**游荡算法**：
- 每 2-4 秒随机选择移动范围内的一个点作为目标
- 使用 `Movement.targetX/Y` 设定目标，由 `UnitSystem` 执行移动
- 移动速度: 正常速度的 40-60%（悠闲漫步）
- 抵达目标后停顿 1-3 秒再选下一个点

```yaml
# 游荡参数
wander:
  speed_ratio: 0.5          # 移动速度比例
  pick_interval: [2, 4]     # 随机选点间隔 (秒)
  pause_interval: [1, 3]    # 抵达后停顿 (秒)
  jitter_radius: 40         # 原地微动幅度 (px)
```

#### ALERT — 警戒

| 属性 | 值 |
|------|-----|
| moveMode | `ChaseTarget` (1) |
| 行为 | 追击警戒范围内最近的敌人，保持 `targetId` 锁定 |
| 触发条件 | 警戒范围内出现敌人 |
| 退出条件 | 敌人进入攻击范围 → COMBAT；敌人离开警戒范围 → RETURN |
| 视觉 | 头顶**红色感叹号**（持续闪烁），移动速度提升至 100% |
| 音效 | `SFX_SOLDIER_ALERT`（短促警告音，每士兵最多 1 次/3秒） |

**追击逻辑**：
- 通过 `check_enemy_in_range(set_target=true)` **首次锁定**警戒范围内最近的敌人，写入 `current_target`
- 锁定后**目标稳定**：后续 tick 中只有 `on_target_dead_reselect` 节点能改写 `current_target`（详见 23 §0.6 全局约定 #1）
- 以 100% 速度通过 `move_towards(target=current_target, max_range=${move_range})` 向敌人移动
- **超界保护**：`move_towards` 在追击到达 `moveRange` 边界时返回 FAILURE，触发上层 selector 转入 RETURN 状态——而非死循环卡边界
- 每帧 `move_towards` 内部自动读取 `current_target` 的实时位置（敌人移动时追击点同步更新）

#### COMBAT — 战斗

| 属性 | 值 |
|------|-----|
| moveMode | `HoldPosition` (2)（近战）/ `ChaseTarget` (1)（远程微调） |
| 行为 | 攻击当前锁定的敌人 |
| 触发条件 | 敌人在攻击范围内 |
| 退出条件 | 敌人死亡、离开攻击范围但仍在警戒范围 → ALERT；敌人离开警戒范围 → RETURN |
| 视觉 | 红叹号常亮，攻击动画 |

**攻击逻辑**：
- 复用现有 `attack` 行为树节点（详见 23 §0.5）
- 攻击冷却由 `Attack.cooldownTimer` 管理
- 近战：直接伤害；远程：发射弹道（复用 `ProjectileSystem`）
- **目标死亡处理**：在 `attack` 节点之前插入 `on_target_dead_reselect(range=${alert_range})`，自动在警戒范围内重选最近敌人；选不到则返回 FAILURE，触发上层 selector 转入 ALERT/RETURN

#### RETURN — 返回

| 属性 | 值 |
|------|-----|
| moveMode | `Patrol` (3)（复用巡逻模式走向home） |
| 行为 | 向 `homeX/homeY` 移动 |
| 触发条件 | 无敌人处于警戒范围 |
| 退出条件 | 回到 home 位置 → IDLE；中途在警戒范围发现新敌人 → ALERT |
| 视觉 | 红叹号消失（0.3s 渐变），正常色 |

**返回逻辑**：
- 设置 `Movement.targetX/Y` 为 `homeX/homeY`
- 以 80% 速度返回
- 中途如果警戒范围出现敌人，立即切换到 ALERT

### 3.3 玩家操控与AI的优先级

| 优先级 | 来源 | 行为 |
|--------|------|------|
| **1（最高）** | 玩家拖拽 | `PlayerControllable.targetX/Y` 驱动，覆盖AI状态 |
| **2** | 战斗状态 | COMBAT 中如果玩家不操控，AI自动攻击 |
| **3** | 警戒/返回 | ALERT/RETURN 由AI自动处理 |
| **4（最低）** | 空闲游荡 | IDLE 中无玩家指令时自动游荡 |

> 玩家拖拽结束后（松手），AI 根据当前位置重新判断状态。如果玩家把士兵拖到敌人附近，AI 会进入 ALERT/COMBAT。

### 3.4 多士兵协同规则（P1-#10 修复）

> **修复背景**：多个士兵同时驻扎同一区域时，旧版会出现：(1) 多兵围攻同一弱敌而忽略其他敌人；(2) 士兵之间互相挤占同一格位导致抖动；(3) 士兵死亡时其它正在追击的士兵不重新判断目标。

#### 3.4.1 目标分配（防扎堆）

| 规则 | 说明 |
|------|------|
| **目标负载追踪** | 每个敌人维护 `attackerCount` 字段（当前正在攻击该敌人的我方士兵数） |
| **目标选择加权** | 士兵进入 ALERT 时，从警戒范围内选择：`score = distance + attackerCount × 80` |
| **解除超饱和** | 若敌人 `attackerCount ≥ 3` 且其他敌人在范围内 → 该敌人被排除候选 |
| **群伤敌例外** | 法师/萨满/虫母等高威胁目标 `attackerCount` 阈值放宽到 5（更值得多人围攻） |
| **目标重选触发** | (1) 当前目标死亡 → 立即重选；(2) 当前目标超出 max_range → 立即重选；(3) 战斗中每 2 秒检查一次更高优先级目标 |

#### 3.4.2 碰撞与抖动防护

| 规则 | 说明 |
|------|------|
| **软碰撞半径** | 同阵营士兵间保持 `personalSpace = unitRadius × 1.5` 的最小距离 |
| **推挤力（非物理）** | 两兵距离 < `personalSpace` 时，互相施加垂直于连线方向的偏移力（每帧 ≤ 4px），不能违反 home range 约束 |
| **目标位置抖动门槛** | 移动到目标时，距离 < 5px 即视为到位，停止位移（防 < 1px 抖动） |
| **攻击格位锁** | 士兵进入 COMBAT 时占据一个"攻击锚点"（敌人周围 N 个位置之一，N=ceil(2π×attackRange / personalSpace)），其他士兵选另一锚点 |
| **死锁解除** | 若 2 秒内位置变化 < 2px 且非 COMBAT 状态 → 强制随机偏移 8-16px |

#### 3.4.3 士兵死亡时的协同更新

| 事件 | 处理 |
|------|------|
| **士兵 A 死亡** | 其当前 target 的 `attackerCount` 自减；解除攻击格位锁；不通知其他士兵 |
| **士兵 B 死亡（与 A 同目标）** | A 检查目标 `attackerCount` 是否仍 ≥ 3，若否可触发目标重选 |
| **士兵全灭** | 敌人 `attackerCount` 归零，恢复路径移动（解除 HoldPosition） |
| **复活/重新部署** | 重新放置时回到 IDLE 状态，从 home 点开始游荡 |

#### 3.4.4 实现约束

- `attackerCount` 由 EnemyAttackSystem 在 `setTarget(enemyId)` / `clearTarget(enemyId)` 时维护，**不能让外部直接写**
- 攻击格位锁存储于敌人的 `combatAnchors: Map<anchorIndex, soldierId>` 字段
- 推挤力计算限定为 O(N²) 但仅在同一 `home range` 内的士兵参与（通常 N ≤ 5）

---

## 4. 敌方士兵反击规则

### 4.1 反击触发条件

当前代码中，敌人的目标选择是**距离驱动**的（`EnemyAttackSystem.findTarget` 选择最近玩家单位），而非**伤害驱动**。

**新增：伤害触发仇恨机制**

```
敌人受到士兵伤害 → 将伤害来源设为当前攻击目标 → 停止路径移动 → 开始攻击
```

### 4.2 反击规则

| 规则 | 说明 |
|------|------|
| **反击门槛** | 仅携带 `Attack` 组件的敌人才有反击能力 |
| **仇恨优先级** | 受到伤害 > 距离最近（伤害来源优先于距离选择） |
| **仇恨持续时间** | 3 秒。3 秒内未再次受到同一士兵伤害 → 重置为目标选择（距离驱动） |
| **仇恨切换** | 如果另一个士兵造成更多伤害 → 切换目标 |
| **停止移动** | 反击时 `moveMode` 设为 `HoldPosition`（已有逻辑） |
| **恢复移动** | 目标死亡或仇恨超时后，恢复 `FollowPath` 继续沿路行进 |
| **Boss 特殊** | Boss 反击不间断路径移动（Boss 有独立的目标选择逻辑） |

### 4.3 敌人反击能力清单

| 敌人类型 | 携带 Attack？ | 会反击？ | 攻击距离 | 备注 |
|----------|-------------|----------|---------|------|
| 小兵 | ❌ | ❌ | — | 纯路径移动，挨打不还手 |
| 快兵 | ❌ | ❌ | — | 速度型，挨打不还手 |
| 重装兵 | ✅ | ✅ | 近战 | 被士兵攻击后转向攻击士兵 |
| 法师 | ✅ | ✅ | 远程 | 被攻击后远程还击 |
| 自爆虫 | ❌ | ❌ | — | 死亡爆炸，不反击 |
| 指挥官(Boss) | ✅ | ✅ | 近战 | Boss 反击但不终止路径移动 |
| 攻城兽(Boss) | ✅ | ✅ | 近战 | Boss 反击但不终止路径移动 |
| 热气球 | ✅ | ⚠️ | 仅正下方 | 不因士兵攻击改变目标（优先轰炸建筑） |
| 萨满 | ✅ | ✅ | 近战 | 被攻击后还击（低伤害） |
| 幽鬼 | ❌ | ❌ | — | 渗透型，挨打不还手 |
| 虫母 | ❌ | ❌ | — | 靠召唤，本体不反击 |
| 擂鼓手 | ✅ | ✅ | 近战 | 被攻击后还击 |

---

## 5. 视觉反馈规范

### 5.1 红色感叹号

| 属性 | 值 |
|------|-----|
| 形状 | 三角形 `!`（PixiJS 绘制或复用 `ShapeVal.Triangle`） |
| 颜色 | `#FF1744`（鲜红） |
| 尺寸 | 16px 高 |
| 位置 | 单位头顶上方 20px |
| ALERT 状态 | 闪烁：亮 0.3s → 灭 0.3s 循环 |
| COMBAT 状态 | 常亮 |
| RETURN/IDLE | 0.3s 渐变消失 |

### 5.2 预警线（可选，降低视觉噪音）

当士兵进入 ALERT 状态时，可选绘制一条**半透明警戒线**从士兵指向目标敌人：

| 属性 | 值 |
|------|-----|
| 颜色 | `#FF1744`，alpha 0.25 |
| 线宽 | 1px |
| 持续时间 | 仅在 ALERT 状态，进入 COMBAT 后消失 |
| 性能考虑 | 如果场上士兵 ≥ 5 个，停止绘制警戒线 |

---

## 6. 行为树映射

### 6.1 现有行为树结构

当前三种士兵AI（`soldier_basic`/`soldier_tank`/`soldier_dps`）使用 Selector → Sequence 结构：

```json
// 现有: soldier_basic
{
  "type": "selector",
  "children": [
    { "type": "sequence", "children": [
      { "type": "check_enemy_in_range", "params": { "range": "${attack_range}" } },
      { "type": "attack", "params": { "target": "nearest_enemy" } }
    ]},
    { "type": "sequence", "children": [
      { "type": "check_enemy_in_range", "params": { "range": 200 } },
      { "type": "move_towards", "params": { "target": "nearest_enemy" } }
    ]},
    { "type": "wait", "params": { "duration": 0.2 } }
  ]
}
```

**现有问题**：
1. 追击范围硬编码为 200，而非按士兵类型配置的 `alertRange`
2. 缺少 IDLE 游荡、RETURN 返回状态
3. 缺少警戒视觉反馈节点
4. 移动和攻击在同一 Selector 中，可能导致"移动但永远到不了"的死循环

### 6.2 新版士兵行为树设计（✅ 已实装于 `src/ai/presets/aiConfigs.ts` 的 SOLDIER_GENERIC_AI / SOLDIER_BASIC_AI / SOLDIER_TANK_AI / SOLDIER_DPS_AI 四套配置）

```json
// 新版: soldier_generic (所有士兵的通用AI)
// 节点签名严格按 23 §0 节点接口规格冻结
{
  "id": "soldier_generic",
  "name": "通用士兵AI",
  "version": "2.1",
  "root": {
    "type": "selector",
    "comment": "4 状态严格优先级: COMBAT > ALERT > RETURN > IDLE",
    "children": [

      // ====== COMBAT: 当前目标存活且在攻击范围内 ======
      {
        "type": "sequence",
        "name": "战斗",
        "children": [
          { "type": "on_target_dead_reselect", "params": { "range": "${alert_range}", "set_target": true } },
          { "type": "check_current_target_in_range", "params": { "range": "${attack_range}" } },
          { "type": "set_state", "params": { "state": "combat" } },
          { "type": "show_alert_mark", "params": { "blink": false } },
          { "type": "attack", "params": { "target": "current_target" } }
        ]
      },

      // ====== ALERT: 警戒范围内有敌人（首次锁定目标） ======
      {
        "type": "sequence",
        "name": "警戒",
        "children": [
          { "type": "check_enemy_in_range", "params": { "range": "${alert_range}", "set_target": true } },
          { "type": "set_state", "params": { "state": "alert" } },
          { "type": "show_alert_mark", "params": { "blink": true } },
          { "type": "move_towards", "params": {
              "target": "current_target",
              "max_range": "${move_range}",
              "arrive_dist": "auto"
          }}
        ]
      },

      // ====== RETURN: 无敌人，不在home ======
      {
        "type": "sequence",
        "name": "返回",
        "children": [
          { "type": "check_distance_from_home", "params": { "min": 10 } },
          { "type": "set_state", "params": { "state": "return" } },
          { "type": "hide_alert_mark", "params": {} },
          { "type": "move_towards", "params": {
              "target": "home_position",
              "speed_ratio": 0.8,
              "max_range": "Infinity"
          }}
        ]
      },

      // ====== IDLE: 无敌人，在home附近 ======
      {
        "type": "sequence",
        "name": "空闲",
        "children": [
          { "type": "set_state", "params": { "state": "idle" } },
          { "type": "wander", "params": { "radius": "${move_range}", "speed_ratio": 0.5 } }
        ]
      }
    ]
  }
}
```

**新版关键变更（对齐 23 §0 节点接口）**：

1. COMBAT 分支首节点为 `on_target_dead_reselect`，保证目标死亡后能在同一帧切换新目标，无需依赖外层 selector 切到 ALERT 再回 COMBAT（避免 1 帧空窗）。
2. `move_towards.arrive_dist = "auto"`：当 `alert_range ≤ attack_range × 1.2` 时自动取 `attack_range × 0.9`（抖动防护，详见 23 §0.6 #4）。
3. 所有 `move_towards` 必须传 `max_range`，超界返回 FAILURE 触发 RETURN 转换（消除卡边界死循环）。
4. ALERT 分支唯一允许 `set_target=true`；COMBAT 分支只允许 `on_target_dead_reselect` 改写目标（目标稳定性原则）。

### 6.3 新增行为树节点（详细规格见 23 §0）

所有节点签名/语义已在 [23 §0 节点接口规格冻结](./23-ai-behavior-tree.md#零节点接口规格冻结source-of-truth) 中定义。本文档仅列出士兵 AI 涉及的节点清单（不再重复签名，避免双源漂移）：

| 节点 | 类型 | 用途 |
|------|------|------|
| `set_state` | Action | 写黑板状态标记 |
| `show_alert_mark` / `hide_alert_mark` | Action | 红叹号显隐 |
| `check_distance_from_home` | Condition | RETURN 触发判定 |
| `wander` | Action | IDLE 游荡 |
| `check_enemy_in_range` (set_target=true) | Condition | ALERT 首次锁定目标 |
| `check_current_target_in_range` | Condition | COMBAT 持续命中判定 |
| `on_target_dead_reselect` | Action | COMBAT 中目标死亡后重选 |
| `move_towards` (max_range, arrive_dist=auto) | Action | 通用移动，含超界保护与抖动防护 |
| `attack` | Action | 执行攻击 |

### 6.4 技能节点的保留

士兵特有的技能节点（`use_skill`）通过**嵌套 Selector** 插入到 COMBAT 状态之前：

```json
// 剑士 (soldier_dps) — 带旋风斩的战斗序列
{
  "type": "selector",
  "children": [
    // 技能优先
    {
      "type": "sequence",
      "children": [
        { "type": "check_enemy_in_range", "params": { "range": 60, "count": 2 } },
        { "type": "check_cooldown", "params": { "skill_id": "whirlwind" } },
        { "type": "use_skill", "params": { "skill_id": "whirlwind" } }
      ]
    },
    // 通用4状态
    { "type": "include", "params": { "ai": "soldier_generic" } }
  ]
}
```

---

## 7. 组件与数据变更

### 7.1 Attack 组件新增字段

在 `src/core/components.ts` 的 `Attack` 定义中新增：

```typescript
export const Attack = defineComponent({
  // ... 现有字段 ...
  alertRange: Types.f32,  // 警戒范围 (px)，> attack.range
});
```

### 7.2 新增 AlertMark 组件

用于控制红叹号的显示状态：

```typescript
export const AlertMark = defineComponent({
  visible: Types.ui8,      // 是否可见
  blink: Types.ui8,        // 是否闪烁
  timer: Types.f32,        // 闪烁计时器
});

export const AlertMarkVal = {
  Hidden: 0,
  Blinking: 1,  // ALERT 状态
  Solid: 2,     // COMBAT 状态
} as const;
```

### 7.3 单位配置新增字段

在 `src/data/units/unitConfigs.ts` 的士兵配置中新增：

```typescript
// 示例：剑士配置
{
  // ... 现有字段 ...
  alertRange: 200,    // 警戒范围 200px
  moveRange: 250,     // 移动范围 250px（已有）
}
```

### 7.4 EnemyAttackSystem 新增仇恨机制

在 `src/systems/EnemyAttackSystem.ts` 中新增：

```typescript
// 新增：仇恨映射表 — 被士兵伤害的敌人记住伤害来源
private aggroTable: Map<number, { targetId: number; expireTime: number; totalDamage: number }>;

// 在 applyDamageToTarget 调用后：
// if (damageSource has PlayerOwned component) → 更新仇恨表

// 在 findTarget 中：
// 优先返回仇恨表中的目标（如果仍存活且在攻击范围内）
```

### 7.5 士兵配置对照表

| 士兵 | attackRange | alertRange | moveRange | AI配置 |
|------|-------------|------------|-----------|--------|
| 盾卫 | 40 | 150 | 200 | soldier_tank (含通用4状态) |
| 剑士 | 35 | 200 | 250 | soldier_dps (含通用4状态) |
| 弓手(规划中) | 260 | 300 | 200 | soldier_ranged |
| 祭司(规划中) | 160 (治疗) | 200 | 180 | soldier_healer |
| 刺客(规划中) | 40 | 250 | 300 | soldier_assassin |

---

## 8. 数值参考

### 8.1 警戒范围设计原则

| 士兵类型 | alertRange / attackRange | 设计意图 |
|----------|------------------------|---------|
| 近战（盾卫/剑士） | 3-5x | 远距离发现敌人，走过去近战 |
| 远程（弓手） | 1-1.2x | 视野略大于射程，看到即能打到 |
| 治疗（祭司） | 1.5-2x | 中等视野，走向需要治疗的友方 |
| 爆发（刺客） | 5-8x | 极远发现敌人，快速切后排 |

### 8.2 移动范围设计原则

| 士兵类型 | moveRange | 设计意图 |
|----------|-----------|---------|
| 盾卫 | 200 | 近距防御，不能离塔太远 |
| 剑士 | 250 | 中等机动力 |
| 刺客 | 300-350 | 高机动力，可以深入敌后 |

---

## 9. 验收标准

### 9.1 我方士兵AI

- [ ] IDLE 状态：士兵在移动范围内随机漫步，无敌人时不攻击
- [ ] ALERT 状态：警戒范围内出现敌人时，头顶显示红色闪烁感叹号
- [ ] ALERT → 追击：士兵向最近的敌人移动
- [ ] 绳索约束：追击不超出 `moveRange`（到达边界后转为 RETURN）
- [ ] COMBAT 状态：敌人进入攻击范围后，感叹号常亮，开始攻击
- [ ] COMBAT → 追击：敌人离开攻击范围但仍在警戒范围，恢复追击（ALERT）
- [ ] RETURN 状态：无敌人时感叹号消失，士兵返回 home
- [ ] RETURN → IDLE：回到 home 后恢复游荡
- [ ] 玩家拖拽优先级最高：拖拽覆盖所有AI状态
- [ ] 目标切换：当前目标死亡后，自动选择警戒范围内下一个最近敌人
- [ ] 多敌人目标选择：优先最近敌人
- [ ] **远程兵抖动防护**：弓手追击时不在射程边界抖动（alert_range ≥ attack_range × 1.1 + 20）
- [ ] **目标稳定性**：士兵进入 ALERT 后锁定的目标在 COMBAT/ALERT 切换时不会随机变更，只在死亡时由 `on_target_dead_reselect` 切换
- [ ] **超界保护**：追击到 moveRange 边界时立即转 RETURN，不卡死边缘

### 9.2 敌方士兵AI

- [ ] 无 Attack 组件的敌人被攻击后不反击（小兵、快兵、自爆虫、幽鬼、虫母）
- [ ] 有 Attack 组件的敌人被士兵攻击后，将伤害来源设为当前目标
- [ ] 受到伤害的仇恨优先级高于距离搜索
- [ ] 反击时停止路径移动（`moveMode = HoldPosition`）
- [ ] 目标死亡后恢复路径移动（`moveMode = FollowPath`）
- [ ] Boss 被攻击后反击但不终止路径移动
- [ ] 热气球被士兵攻击后不改变目标（仍优先轰炸建筑）
- [ ] 3 秒未受同一士兵伤害 → 清除仇恨，恢复距离搜索

### 9.3 视觉反馈

- [ ] 红叹号在 ALERT 状态可见且闪烁
- [ ] 红叹号在 COMBAT 状态常亮
- [ ] 红叹号在 IDLE/RETURN 状态不可见
- [ ] 返回时感叹号 0.3s 渐变消失

### 9.4 回归验证

- [ ] 现有塔攻击逻辑不受影响
- [ ] 现有敌人路径移动逻辑不受影响（无仇恨时）
- [ ] 现有士兵部署/拖拽逻辑不受影响
- [ ] `npm test` 全量通过

---

> 版本: v1.0 | 日期: 2026-05-12 | 状态: 设计阶段
>
> **设计依据**：
> - 现有设计文档: `02-unit-system.md` (单位系统/行为规则), `05-combat-system.md` (战斗数值)
> - 现有代码: `src/systems/UnitSystem.ts`, `src/systems/EnemyAttackSystem.ts`, `src/systems/AISystem.ts`, `src/ai/BehaviorTree.ts`, `src/ai/presets/aiConfigs.ts`
> - 经典参考: Kingdom Rush 兵营单位（集结/反击）、皇室战争 单位AI（警戒/追击/返回）
