# 23 — AI 行为树统一方案

> 审计现状、路线修正、遗留问题任务拆分、**节点接口规格冻结**
>
> 版本: v1.1 | 日期: 2026-05-12

---

## 零、节点接口规格冻结（Source of Truth）

> **本章是所有 BT 节点的唯一接口规格。** 实现侧（`src/ai/BehaviorTree.ts`）必须严格遵守此规格的入参/出参/语义。节点实现可分阶段补齐，但**接口一旦冻结不再改动**——后续只允许新增节点，不允许改已冻结节点的签名。
>
> 24-soldier-ai-behavior.md 中使用的所有节点必须在此处出现，否则视为缺失。

### 0.1 节点分类与返回值约定

所有节点的 `tick(ctx)` 返回三态枚举：

| 状态 | 含义 |
|------|------|
| `SUCCESS` | 本次 tick 完成预期 |
| `FAILURE` | 条件不满足 / 动作不可执行 |
| `RUNNING` | 跨多帧动作，下一帧继续 tick |

> 黑板（blackboard）：每个实体一个，跨 tick 持久；存储 `current_target`、`alert_state`、`wander_target_x/y`、`wander_pause_until` 等。

### 0.2 组合节点（Composite）

| 节点 | 行为 | 子节点失败时 | 子节点成功时 | 子节点 RUNNING 时 |
|------|------|------------|------------|------------------|
| `selector` | 按顺序 tick 子节点，任一 SUCCESS 即返回 | 继续下一个 | 返回 SUCCESS | 返回 RUNNING |
| `sequence` | 按顺序 tick，任一 FAILURE 即返回 | 返回 FAILURE | 继续下一个 | 返回 RUNNING |
| `parallel` | 同时 tick 所有子节点 | 按 `failurePolicy` 决定 | 按 `successPolicy` 决定 | 累计 RUNNING |

`parallel` 参数：
- `successPolicy`: `requireOne` / `requireAll`（默认 `requireAll`）
- `failurePolicy`: `requireOne` / `requireAll`（默认 `requireOne`）

### 0.3 装饰节点（Decorator）

| 节点 | 参数 | 语义 |
|------|------|------|
| `inverter` | — | SUCCESS↔FAILURE 互换，RUNNING 透传 |
| `repeater` | `count: int` (-1=无限) | 重复 tick 子节点 N 次后返回 SUCCESS |
| `cooldown` | `seconds: float` | 子节点 SUCCESS 后，CD 内 tick 直接返回 FAILURE |
| `once` | — | 子节点首次 SUCCESS 后永远返回 FAILURE（用于 Boss 阶段切换） |
| `ignore_invulnerable` | — | 包裹目标选择类节点；若选中的目标 `invulnerable=true`，强制返回 FAILURE |

### 0.4 条件节点（Condition，无副作用）

| 节点 | 参数 | 黑板读 | 黑板写 | SUCCESS 条件 |
|------|------|--------|--------|--------------|
| `check_enemy_in_range` | `range: float`, `set_target: bool=false`, `min_count: int=1`, `filter_faction: enum=Enemy` | `current_target` (可选验证) | `current_target` (当 set_target=true) | 范围内符合过滤的敌人数 ≥ min_count |
| `check_ally_in_range` | `range: float`, `set_target: bool=false`, `hp_below: float=1.0`, `min_count: int=1` | — | `current_target` (当 set_target=true) | 范围内 HP 比例 < hp_below 的友方 ≥ min_count |
| `check_hp` | `below: float=1.0`, `above: float=0.0`, `compare: "self"/"current_target"="self"` | `current_target`(条件需要时) | — | HP 比例落在 (above, below) 区间 |
| `check_cooldown` | `key: string` | `cooldowns[key]` | — | CD 已结束（剩余 ≤ 0） |
| `check_distance_from_home` | `min: float=0`, `max: float=Infinity` | — | — | 与 `homeX/Y` 距离落在 [min, max] |
| `check_current_target_alive` | — | `current_target` | — | 目标存在且 `Health.current > 0` |
| `check_current_target_in_range` | `range: float` | `current_target` | — | 当前目标存在且在 range 内 |
| `check_layer` | `layer: enum` | — | — | 自身层级匹配（详见 18） |
| `check_weather` | `weather: enum[]` | — | — | 当前天气在列表内（详见 11） |

> **关键设计**: `check_enemy_in_range` 的 `set_target=true` 形态是士兵 ALERT 状态发现目标的唯一入口；其它节点（move/attack）都只读 `current_target`，不重新选目标。这避免了"每帧重选→目标抖动"的死循环。

### 0.5 动作节点（Action，有副作用）

| 节点 | 参数 | 黑板读 | 黑板写 | 完成条件 |
|------|------|--------|--------|---------|
| `attack` | `target: "current_target"` | `current_target` | 记录 `last_attack_time` | 单次攻击执行完毕（命中或弹道发射）→ SUCCESS；目标无效 → FAILURE |
| `move_towards` | `target: "current_target"/"home_position"/literal`, `max_range: float=Infinity`, `speed_ratio: float=1.0`, `arrive_dist: float=8` | `current_target`(若 target=current_target) | 写 `Movement.targetX/Y` | 到达 arrive_dist → SUCCESS；超出 max_range → FAILURE；移动中 → RUNNING |
| `wander` | `radius: float`, `speed_ratio: float=0.5`, `pick_interval: [min,max]=[2,4]`, `pause_interval: [min,max]=[1,3]` | `wander_target_x/y`, `wander_pause_until` | 同左 | 持续返回 RUNNING；内部自管选点/停顿 |
| `set_state` | `state: "idle"/"alert"/"combat"/"return"` | — | `ai_state` | 写完即 SUCCESS |
| `show_alert_mark` | `blink: bool=false` | — | `AlertMark.visible/blink` | 写完即 SUCCESS |
| `hide_alert_mark` | — | — | `AlertMark.visible=0` | 写完即 SUCCESS |
| `use_skill` | `skill_id: string` | `current_target`(技能需要时) | — | 调用 SkillSystem，能量/CD 不足 → FAILURE；触发成功 → SUCCESS |
| `heal` | `target: "current_target"/"all_in_range"`, `amount: float`, `range: float` | `current_target` | — | 调用 HealingSystem，无目标 → FAILURE，否则 SUCCESS |
| `produce_resource` | `resource: "gold"/"energy"`, `rate: float` | — | `Production.accumulator` | 累加产出，永远 SUCCESS |
| `trigger_trap` | `damage: float`, `radius: float`, `cd: float` | — | `Cooldown` | CD 未到 → FAILURE；触发后 → SUCCESS |
| `on_target_dead_reselect` | `range: float`, `set_target: bool=true` | `current_target` | `current_target`(新目标) | 当前目标存活 → SUCCESS；目标死亡且能选到新目标 → SUCCESS；选不到 → FAILURE |
| `boid_step` | `cohesion/separation/alignment/wanderJitter` 权重 | `boid_velocity` | 同左 | 每帧 RUNNING（boid 物理） |
| `drop_bomb` | `damage: float`, `radius: float`, `falloff: float` | `current_target` | — | 调用 BombSystem，CD 未到 → FAILURE；否则 SUCCESS |
| `aura_buff` | `buff_id: string`, `range: float`, `faction: enum` | — | 范围内单位 `BuffStack` | 应用 Buff，永远 SUCCESS |

### 0.6 全局约定

1. **目标稳定性原则**: 一旦黑板的 `current_target` 被 `set_target=true` 节点写入，后续 tick 中**只有 `on_target_dead_reselect` 可重写它**；其它任何节点不得修改。这是消除"目标抖动"的硬约束。
2. **状态优先级**: 4 状态切换通过 selector 顺序表达，必须严格按 `COMBAT > ALERT > RETURN > IDLE`。状态切换时由 `set_state` 写入黑板，下一帧从该状态分支重新进入。
3. **范围继承**: 节点 params 中以 `${var}` 引用单位配置字段（如 `${attack_range}`、`${alert_range}`、`${move_range}`），实现侧必须支持此模板插值。
4. **远程兵 alert/attack 半径抖动防护**: 当 `alert_range ≤ attack_range × 1.2` 时，`move_towards` 节点的 `arrive_dist` 自动改为 `attack_range × 0.9`，确保进入射程后停下而非贴脸。
5. **超界保护**: 所有 `move_towards` 必须传 `max_range`（士兵传 `${move_range}`，敌人传 `Infinity`）。超界时返回 FAILURE，触发上层 selector 转入 RETURN。

### 0.7 节点实现进度表

| 节点 | 当前状态 | 目标阶段 |
|------|---------|---------|
| `selector` / `sequence` / `inverter` / `repeater` | ✅ 已实现 | — |
| `check_enemy_in_range` / `attack` / `move_towards` | ✅ 已实现 | — |
| `check_ally_in_range` / `heal` / `all_in_range` DOT | ✅ 已实现（1807ae1） | — |
| `parallel` / `cooldown` / `once` | ✅ 已实现（187641e / aad2237） | — |
| `until_fail` / `always_succeed` | ✅ 已实现（187641e） | — |
| `set_state` / `show_alert_mark` / `hide_alert_mark` / `check_distance_from_home` / `wander` | ✅ 已实现 | — |
| `use_skill` | ✅ 已实现（批 3） | — |
| `check_cooldown` | ⚠️ 已注册但 stub（永远 FAILURE） | 后续接入 SkillSystem.isSkillReady |
| `on_target_dead_reselect` / `check_current_target_alive` / `check_current_target_in_range` | ✅ 已实现（b4de1e0 / 批 3） | — |
| `produce_resource` | ✅ 已实现 | — |
| `trigger_trap` | ✅ 已实现（批 3） | — |
| `ignore_invulnerable` | ✅ 已实现（批 3，依赖 blackboard.invulnerable_set） | invulnerable 数据源待 BuffSystem 提供 |
| `check_layer` / `check_weather` | ✅ 已实现（b4de1e0） | — |
| `boid_step` / `drop_bomb` / `aura_buff` | ⏳ 未实现 | Phase 3（特殊单位迁移时再做） |

> Phase 4 节点已全部落地（Q1-Q3 批 1/1.5/2/3）。架构关键修复：节点级状态（RepeaterNode 计数 / CooldownNode CD / OnceNode fired）已迁移到 blackboard，按 nodeId 隔离，解决多实体共享 BT 实例时的状态串扰（aad2237）。`ignore_invulnerable` 通过约定 `blackboard.invulnerable_set: Set<number>` 实现，等待 BuffSystem 维护该集合；`check_cooldown` 留作 stub，等到 SkillSystem 与 BT 进一步联动时接入。

---

## 一、现状审计

### 1.1 架构偏移

原设计定位「规则为主，行为树为补充」——但实际代码演进中，行为树已为所有单位类型（塔/敌/兵/建筑/陷阱）编写了 14 套 AI 配置（`src/ai/presets/aiConfigs.ts`）。然而由于以下问题，大量单位并未真正由行为树驱动：

### 1.2 审计发现（2026-05-12）

| # | 问题 | 严重度 |
|---|------|--------|
| ① | **AI ID 数值映射错位** — `AI_CONFIG_ID` / `ENEMY_AI_IDS` / `AI_NUM_IDS` 三套映射表的数值索引与 `ALL_AI_CONFIGS` 注册顺序不匹配，敌人/士兵的 `configId` 指向错误的行为树 | 🔴 P0 |
| ② | **UnitSystem 硬编码 AI** — 士兵的攻击选目标、追击移动全部在 `UnitSystem.ts` 中硬编码，与 `AISystem` 行为树并行运行（已修复） | ✅ 已修 |
| ③ | **缺少 `move_towards` BT 节点** — 士兵 AI 配置引用的 `move_towards` 节点未实现，静默降级为 0.1s Wait（已修复） | ✅ 已修 |
| ④ | **BuildSystem 陷阱/建筑无 AI 组件** — `createTrapEntity` / `createProductionEntity` 不挂载 AI 组件（已修复） | ✅ 已修 |
| ⑤ | **缺少 4 套 AI 配置** — `tower_missile`, `tower_vine`, `enemy_shaman`, `enemy_balloon` 在映射表中引用但无对应行为树定义 | 🟡 P1 |
| ⑥ | **6 个系统完全绕过行为树** — `BatSwarmSystem`, `ShamanSystem`, `HotAirBalloonSystem`, `TrapSystem`, `HealingSystem`, `ProductionSystem` 全部硬编码 AI 逻辑 | 🟡 P1 |
| ⑦ | **AttackSystem / EnemyAttackSystem 覆盖 BT** — 塔和敌人的行为树 `attack` 节点是死代码，因为 AttackSystem 在同一帧内独立处理了所有攻击逻辑 | 🟡 P1 |
| ⑧ | **行为树多个节点未实现** — `parallel`, `repeater`, `cooldown`, `use_skill`, `heal`, `check_ally_in_range`, `produce_resource`, `check_cooldown` 均为存根或降级 | 🟢 P2 |
| ⑨ | **双重创建路径** — `UnitFactory`（新）和 `BuildSystem`/`WaveSystem`（旧）均可创建同类型单位，AI 挂载行为不一致 | 🟢 P2 |

---

## 二、路线修正

### 原定位 → 新定位

| | 原 | 新 |
|---|-----|-----|
| 普通单位 AI | 声明式规则（`nearest` + `attack`） | 行为树（`check_enemy_in_range` + `attack`） |
| 复杂单位 AI | 行为树 | 行为树 |
| 专用系统 | AttackSystem 等 | 行为树动作节点调用系统函数 |

> **理由**: 行为树框架已完成（含调试可视化），14 套 AI 配置已编写。与其重构为规则引擎再做行为树补充，不如以行为树为主体，将现有系统的攻击/移动逻辑收归为行为树可调用的原子动作。

### 架构目标

```
┌──────────────────────────────────────────────────┐
│                  AISystem (PHASE_AI)               │
│                                                    │
│  configId → BehaviorTree.tick() → 读写组件存储     │
│                                                    │
│  行为树节点:                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ 条件节点  │  │ 动作节点  │  │ 装饰器节点        │ │
│  │ hp/range │  │ attack   │  │ inverter/repeat  │ │
│  │ cooldown │  │ move_to  │  │                  │ │
│  │ allies   │  │ use_skill│  │                  │ │
│  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                    │
│  动作节点委托到现有系统（不重复实现）:               │
│  AttackNode  → 调用 AttackSystem 的伤害/弹道逻辑    │
│  MoveToNode  → 设置 Movement.target → UnitSystem   │
│  SkillNode   → 调用 SkillSystem                    │
│  HealNode    → 调用 HealingSystem                  │
└──────────────────────────────────────────────────┘

UnitSystem → 纯移动物理（碰撞/边界/BT目标跟随）
AttackSystem → 仅执行攻击（弹道生成/伤害计算），不再自主选目标
EnemyAttackSystem → 合并到 AISystem 行为树
```

---

## 三、任务拆分

### Phase 1: 修基础（P0）

#### T1.1 统一 AI ID 映射 — 全部使用字符串 ID

**当前**: `AI.configId` 是 `ui16`，靠 `AI_CONFIG_ID` / `ENEMY_AI_IDS` / `AI_NUM_IDS` 三套硬编码映射表

**目标**: `AI.configId` 直接使用字符串（或改用 `configIndex` 统一注册表），消除数值索引偏差

**范围**:
- `src/components/AI.ts` — `configId` 改为字符串存储
- `src/systems/AISystem.ts` — 改用 `configMap` 按字符串查找，弃用 `configIndex`
- `src/systems/BuildSystem.ts` — 删除 `AI_CONFIG_ID`，直接写字符串
- `src/systems/WaveSystem.ts` — 删除 `ENEMY_AI_IDS`，直接写字符串
- `src/main.ts` — 删除 `AI_NUM_IDS`，直接写字符串
- `src/systems/ShamanSystem.ts` — 删除 `SHAMAN_AI_ID`，用字符串比较

#### T1.2 补齐缺失的 AI 配置

**目标**: 为 `tower_missile`, `tower_vine`, `enemy_shaman`, `enemy_balloon` 编写行为树配置

**范围**:
- `src/ai/presets/aiConfigs.ts` — 添加 4 个新配置
- `src/ai/BehaviorTree.ts` — 实现 `check_ally_in_range`（萨满治疗需要）

---

### Phase 2: 行为树接管（P1）

#### T2.1 拆除 UnitSystem 的 AI 逻辑 ✅ 已完成

- 移除 `attackPhase` + 自寻敌追击
- 保留碰撞/移动/玩家指挥
- 实现 `MoveTowardsNode`

#### T2.2 行为树接管敌人 AI

**当前**: `EnemyAttackSystem` 全权处理敌人的目标选择和攻击

**目标**: 删除 `EnemyAttackSystem`，敌人行为完全由 AISystem 驱动

**范围**:
- `src/ai/BehaviorTree.ts` — `AttackNode` 改为调用 AttackSystem 的伤害函数（而非直接减 HP）
- `src/systems/AttackSystem.ts` — 提取 `applyTowerDamage()` 等公共函数供 BT 调用
- `src/systems/EnemyAttackSystem.ts` — **删除**
- 验证敌人 `check_enemy_in_range` + `attack` BT 节点正常工作

#### T2.3 行为树接管塔 AI

**当前**: `AttackSystem` 全权处理塔的目标选择和攻击

**目标**: 塔的目标选择由行为树决定，`AttackSystem` 仅执行攻击（弹道/伤害）

**范围**:
- `src/ai/BehaviorTree.ts` — `AttackNode` 重构为委托模式
- `src/systems/AttackSystem.ts` — 目标选择逻辑移到 BT 的 `check_enemy_in_range`，保留弹道生成/命中逻辑
- `src/ai/presets/aiConfigs.ts` — 确保所有塔 AI 配置覆盖完整目标选择

#### T2.4 行为树接管陷阱/建筑 AI

**当前**: `TrapSystem` / `HealingSystem` / `ProductionSystem` 硬编码处理

**目标**: AISystem 行为树决定是否触发，专用系统仅执行效果

**范围**:
- `src/ai/BehaviorTree.ts` — 实现 `produce_resource` / `trigger_trap` / `heal` 动作节点
- `src/systems/TrapSystem.ts` — 保留伤害计算，移除目标检测
- `src/systems/HealingSystem.ts` — 保留治疗计算，移除范围检测
- `src/systems/ProductionSystem.ts` — 由 BT 节点直接操作 `Production.accumulator`

---

### Phase 3: 特殊单位迁移（P2）

#### T3.1 蝙蝠群行为树

**目标**: 将 `BatSwarmSystem` 的 boid 逻辑转化为行为树节点

- 实现 `boid_wander` / `boid_attack` / `boid_return` 动作节点
- 或保留 BatSwarmSystem 但标记为「物理模拟系统」而非 AI 系统

#### T3.2 萨满行为树

**目标**: `ShamanSystem` → 行为树驱动

- 实现 `heal` 节点（调用 ShamanSystem 的治疗逻辑）
- 实现 `aura_buff` 节点
- 编写 `enemy_shaman` 行为树配置

#### T3.3 热气球行为树

**目标**: `HotAirBalloonSystem` → 行为树驱动

- 实现 `drop_bomb` 动作节点
- 编写 `enemy_balloon` 行为树配置

---

### Phase 4: 补齐节点 & 清理（P2）

#### T4.1 实现未完成的 BT 节点

| 节点 | 类型 | 用途 |
|------|------|------|
| `parallel` | Composite | 同时执行多个子节点 |
| `repeater` | Decorator | 重复执行 N 次 |
| `cooldown` | Decorator | 冷却时间内跳过 |
| `use_skill` | Action | 调用 SkillSystem |
| `check_ally_in_range` | Condition | 检测范围内友方 |
| `produce_resource` | Action | 生产建筑产出 |
| `heal` | Action | 治疗友方单位 |

#### T4.2 统一单位创建路径

- 删除 `BuildSystem` 中的 `createTrapEntity` / `createProductionEntity` / `createTowerEntity`
- 全部统一到 `UnitFactory.createUnit()` → 从 `unitConfigs.ts` 读取配置
- `BuildSystem` 退化为仅处理拖拽交互和网格占用检测

#### T4.3 行为树调试工具完善

- `BehaviorTreeViewer` 支持实时切换查看不同实体的行为树运行状态
- 支持暂停/单步调试
- 节点执行耗时统计

---

## 四、任务依赖图

```
T1.1 (统一ID) ──→ T1.2 (补齐配置)
                      │
                      ▼
               T2.2 (敌人BT) ──→ T2.3 (塔BT) ──→ T2.4 (陷阱/建筑)
                      │                              │
                      ▼                              ▼
               T3.1 (蝙蝠)    T3.2 (萨满)    T3.3 (热气球)
                      │            │              │
                      └────────────┼──────────────┘
                                   ▼
                            T4.1 (补齐节点)
                                   │
                                   ▼
                            T4.2 (统一路径)
                                   │
                                   ▼
                            T4.3 (调试工具)
```

---

## 五、验收标准

- [ ] 所有单位的行为树 AI 配置已定义（`getAIConfig(id)` 不返回 undefined）
- [ ] `AttackSystem` / `EnemyAttackSystem` 不再独立进行目标选择
- [ ] `BehaviorTreeViewer` 可实时查看任意单位的行为树执行状态
- [ ] `npm test` 全量通过，无新增失败
- [ ] 士兵可被玩家拖拽指挥（行为树自动跟随 + 玩家覆盖）
- [ ] 炮塔/冰塔/电塔行为与 AI 配置定义一致

---

> 版本: v1.0 | 日期: 2026-05-12 | 基于审计结果编写
