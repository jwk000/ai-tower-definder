# 23 — AI 行为树统一方案

> 审计现状、路线修正、遗留问题任务拆分

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
