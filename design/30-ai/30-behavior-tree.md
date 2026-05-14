---
title: AI 行为树统一方案
status: stable
version: 1.0.0
last-modified: 2026-05-14
authority-for:
  - behavior-tree-runtime
  - bt-nodes
supersedes: []
cross-refs:
  - 30-ai/31-soldier-ai.md
  - 20-units/20-unit-system.md
---

# AI 行为树统一方案

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
| `drop_bomb` | `damage: float`, `radius: float`, `cd: float`, `fall_speed: float=300`（`falloff` 暂未实现） | `current_target` | — | 调 spawnBomb（BombSystem），首次 tick 立即触发对齐气球出生即投弹；CD 未到 → FAILURE；CD 到 + 有目标 → spawnBomb + SUCCESS。ownerFaction 自动从 Faction 组件读，无 Faction 默认 Enemy |
| `aura_buff` | `buff_id: string`, `attribute: string='speed'`, `value: float`, `is_percent: bool=false`, `range: float`, `target_faction: enum='ally'`(ally/enemy/all), `duration: float=0.5` | — | 范围内符合阵营单位调 BuffSystem.addBuff（每帧 refresh duration） | 范围内有目标 → SUCCESS；无目标 → FAILURE。停止 tick 后 buff 自然衰减。faction 判断：有 Faction 组件取其值，否则按 UnitTag.isEnemy 兜底 |
| `select_missile_target` | — | — | `current_target_pos: {x,y,row,col}`, `current_target_score: float`, `current_target_enemy_count: int` | 调 evaluateMissileTarget 用地格评分（dist 0.35 + density 0.45 + tier 0.20）选最佳目标格；找到 → 写黑板 + SUCCESS；无目标 → 清黑板 + FAILURE。地格位置是「网格中心像素坐标」而非具体敌人 entity。已自动过滤飞行敌人（missileCfg.cantTargetFlying）和射程外格子（Attack.range[tower]） |
| `charge_attack` | `charge_time: float=0.6` | `current_target_pos` | 维护 MissileCharge 组件（chargeElapsed/chargeTime/targetX/targetY/markEntityId） | 首次进入：无黑板目标 → FAILURE；spawn TargetingMark entity + 添加 MissileCharge 组件 → RUNNING。继续 tick：chargeElapsed += dt，未满 → RUNNING；满 → SUCCESS（保留 MissileCharge 等 launch 节点消费）。注：MissileCharge 组件被 RenderSystem 用于渲染蓄力期红色脉动光效，故 charge 状态必须落到 ECS 而非纯 blackboard |
| `launch_missile_projectile` | — | — | 移除 MissileCharge 组件 + spawn missile projectile + 重置 Attack.cooldownTimer + 播 sound | 读 MissileCharge.targetX/Y/markEntityId（charge_attack 节点写的）→ spawnMissileProjectile（抛物线飞行 + AOE 由 ProjectileSystem 接管）+ Sound.play('tower_missile')；返回 SUCCESS。无 MissileCharge → FAILURE。AOE 130px / L5 中心 10% ×1.2 / 不命中飞行敌等行为仍在 ProjectileSystem.applySplash |
| `spawn_projectile_tower` | — | `current_target`（被 check_enemy_in_range 写入） | `Attack.targetId`, `Attack.cooldownTimer` | 通用弹道塔发射节点（服务 basic/cannon/ice/bat 4 塔）。读 `blackboard.current_target` → 调 `spawnProjectile(world, eid, targetId, towerType)`（AttackSystem 导出）→ set `Attack.targetId = targetId` + `Attack.cooldownTimer = 1/attackSpeed` + `Sound.play(TOWER_SHOOT_SOUNDS[type])`；返回 SUCCESS。`cooldownTimer > 0` 或无 target 或 layer 不可达 → FAILURE。splash/slow/stun/freeze/lifeSteal 等弹道修饰由 TOWER_CONFIGS[type] 透传到 Projectile 组件，由 ProjectileSystem 命中时执行 |
| `lightning_chain` | — | `current_target` | `Attack.targetId`, `Attack.cooldownTimer` | 闪电塔链式攻击节点。读 `blackboard.current_target` → 调 `doLightningAttack(world, eid, primaryId, level)`（AttackSystem 导出）→ chainCount = baseChain + (level-1) 跳，每跳衰减 chainDecay，每跳 spawn LightningBolt entity（视觉 0.5s）→ set cooldown + 首跳 Sound.play('lightning_hit')；返回 SUCCESS。`cooldownTimer > 0` 或无 target → FAILURE |
| `laser_beam` | — | — | `Attack.cooldownTimer` | 激光塔多束节点。每帧自行扫描 `Attack.range[eid]` 内全部敌人按距离排序，取前 N 束（L1-2: 1束 / L3-4: 2束 / L5: 3束），调 `doLaserAttack(world, eid, enemiesInRange, level)` spawn LaserBeam entity（视觉 1.0s + DOT 持续伤害）→ set cooldown + Sound.play('laser_fire')；返回 SUCCESS。`cooldownTimer > 0` 或 range 内无敌 → FAILURE。注：本节点自行选目标不依赖 `current_target`（多束激光语义需扫全范围） |
| `enemy_melee_attack` | — | `current_target` | `Attack.targetId`, `Attack.cooldownTimer`, `Movement.moveMode` | 敌人近战节点。读 `blackboard.current_target` → 验证 target alive + 距离 ≤ Attack.range → set `Movement.moveMode = HoldPosition` 暂停移动 → 调 `doEnemyAttack(...,canAttackBuildings=false)`（EnemyAttackSystem 导出）→ `applyDamageToTarget` 直接造成 Physical 伤害 + Sound.play('enemy_attack') → set cooldown + targetId；返回 SUCCESS。无 target / 超界 / target 已死 → 清 targetId + `Movement.moveMode = FollowPath` + FAILURE |
| `enemy_ranged_attack` | — | `current_target` | `Attack.targetId`, `Attack.cooldownTimer`, `Movement.moveMode`, spawn projectile entity | 敌人远程节点。同 `enemy_melee_attack` 但执行 `doEnemyAttack(...,canAttackBuildings=true)` → spawn 红色 Circle projectile（速度 200 px/s, damage = atk × buff, Physical）+ Sound.play('mage_attack')；返回 SUCCESS。失败条件与 melee 一致 |

> **三节点协作模式**: missile 行为按 `select → charge → launch` 三段拆分，每节点单一职责。`charge_attack` 用 MissileCharge ECS 组件作为「BT ↔ RenderSystem 通信总线」，与 `drop_bomb` 用 BombSystem、`aura_buff` 用 BuffSystem 的副作用模式一致（节点持有语义，专用系统执行渲染/物理副作用）。

> **P4 攻击节点协作模式（5 个新节点）**: 6 非-missile 塔 + 3 敌人的 BT v1.0 attack 节点为死代码（实际由 AttackSystem/EnemyAttackSystem 接管）。P4 通过 5 个**能力节点**（`spawn_projectile_tower` / `lightning_chain` / `laser_beam` / `enemy_melee_attack` / `enemy_ranged_attack`）让 BT 真接管。各节点统一遵循：①读 `blackboard.current_target`（由 `check_enemy_in_range` 节点上游写入，§0.6 #1 目标稳定性原则）→②调 AttackSystem/EnemyAttackSystem 导出的工具函数（`spawnProjectile` / `doLightningAttack` / `doLaserAttack` / `doEnemyAttack`）→③节点自行 set `Attack.cooldownTimer = 1/attackSpeed` + targetId（与 missile launch 节点 cooldown 重置语义一致）。AttackSystem.update / EnemyAttackSystem.update 仅保留 `Attack.cooldownTimer -= dt` 的 tick 责任（line 139 + EnemyAttackSystem line 50），各塔 dispatch case 全部薄化为 no-op（类比 P3 handleMissileTower）。`laser_beam` 例外不读 `current_target`（多束语义需自扫全 range，由节点内部扫描）。

### 0.6 全局约定

1. **目标稳定性原则**: 一旦黑板的 `current_target` 被 `set_target=true` 节点写入，后续 tick 中**只有 `on_target_dead_reselect` 可重写它**；其它任何节点不得修改。这是消除"目标抖动"的硬约束。
2. **状态优先级**: 4 状态切换通过 selector 顺序表达，必须严格按 `COMBAT > ALERT > RETURN > IDLE`。状态切换时由 `set_state` 写入黑板，下一帧从该状态分支重新进入。
3. **范围继承**: 节点 params 中以 `${var}` 引用单位配置字段（如 `${attack_range}`、`${alert_range}`、`${move_range}`），实现侧必须支持此模板插值。
4. **远程兵 alert/attack 半径抖动防护**: 当 `alert_range ≤ attack_range × 1.2` 时，`move_towards` 节点的 `arrive_dist` 自动改为 `attack_range × 0.9`，确保进入射程后停下而非贴脸。
5. **超界保护**: 所有 `move_towards` 必须传 `max_range`（士兵传 `${move_range}`，敌人传 `Infinity`）。超界时返回 FAILURE，触发上层 selector 转入 RETURN。
6. **节点适用阵营约束**: `on_target_dead_reselect` 当前实现仅作用于我方单位（`UnitTag.isEnemy=0`）——节点内部搜索 `isEnemy=1` 的敌人作为重选候选。**敌人 AI 不应使用此节点**，敌人的目标重选由 `check_enemy_in_range` 每帧重搜兜底（敌人攻击模型不依赖 `current_target` 持久化）。若未来需要敌人版重选，应新增 `on_target_dead_reselect_enemy` 或为节点增加 `target_faction` 参数。
7. **`attack` 节点 target 解析**: `target` 参数支持 4 种取值：`"self.target"`（读 `Attack.targetId[eid]`）/ `"current_target"`（读 `blackboard.current_target`）/ `"nearest_enemy"`（读 `blackboard.found_enemies[0]` 或回退到 `findNearestEnemy`）/ 直接传 entity id。士兵 COMBAT 分支统一使用 `"current_target"` 以保证 §0.6 #1 目标稳定性。

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
| `drop_bomb` | ✅ 已实现（P2 R1，依赖 BombSystem） | falloff 衰减留 P3 优化 |
| `aura_buff` | ✅ 已实现（P2 R2，依赖 BuffSystem.addBuff + getEffectiveValue） | 替代 ShamanSystem.auraTargets 直改 Movement.speed 的旧实现 |
| `select_missile_target` / `charge_attack` / `launch_missile_projectile` | ✅ 已实现（P3 R2-R5，b7217ef） | 三节点协作完成 TOWER_MISSILE_AI 0.1-stub → v1.0 升级；select 包装 evaluateMissileTarget，charge 维护 MissileCharge 组件（RenderSystem 依赖）+ cooldown 守卫，launch 包装 spawnMissileProjectile；AttackSystem.handleMissileTower 已薄化 no-op |
| `spawn_projectile_tower` / `lightning_chain` / `laser_beam` / `enemy_melee_attack` / `enemy_ranged_attack` | ✅ P4 R1-R7 全部实装 | 服务 6 非-missile 塔 + 3 敌人 BT 真接管；包装 AttackSystem 导出的 spawnProjectile/doLightningAttack/doLaserAttack/findEnemiesInRange + EnemyAttackSystem 导出的 doEnemyAttack；R5+R6 合并提交：6 塔 aiConfigs v2.0 + AttackSystem.update 薄化（保留 cleanupOrphanedTargetingMarks + missile dispatch）；R7 合并提交：3 敌 aiConfigs v2.0 + EnemyAttackSystem.update 薄化为 no-op；问题⑦完全解决 |
| `boid_step` | ⏳ 未实现 | Phase 3（特殊单位迁移时再做） |

> Phase 4 节点已全部落地（Q1-Q3 批 1/1.5/2/3）。架构关键修复：节点级状态（RepeaterNode 计数 / CooldownNode CD / OnceNode fired）已迁移到 blackboard，按 nodeId 隔离，解决多实体共享 BT 实例时的状态串扰（aad2237）。`ignore_invulnerable` 通过约定 `blackboard.invulnerable_set: Set<number>` 实现，等待 BuffSystem 维护该集合；`check_cooldown` 留作 stub，等到 SkillSystem 与 BT 进一步联动时接入。

### 0.8 AI 配置实现进度表

| AI 配置 | 当前状态 | 备注 |
|---------|---------|------|
| `tower_basic` / `tower_cannon` / `tower_ice` / `tower_bat` | ✅ v2.0（P4 R5+R6，96793c2） | spawn_projectile_tower 节点真接管：BT 选目标 → 节点 spawnProjectile + sound + cooldown reset；AttackSystem.update 不再处理这 4 塔 |
| `tower_lightning` | ✅ v2.0（P4 R5+R6，96793c2） | lightning_chain 节点真接管：BT 选目标 → 节点 doLightningAttack（链跳 + LightningBolt）+ cooldown；AttackSystem.update 不再处理 |
| `tower_laser` | ✅ v2.0（P4 R5+R6，96793c2） | laser_beam 节点真接管：节点自扫多束（findEnemiesInRange + getLaserBeamCount）+ doLaserAttack + cooldown；v2.0 删除 check_enemy_in_range 前置（节点自管） |
| `tower_vine` | ✅ v1.0（P2 R3） | BT 选目标 + 攻击触发；ProjectileSystem 处理 DOT 持续伤害周期 |
| `tower_ballista` | ✅ v1.0（P2 R3） | BT 选最远目标 + 攻击触发；AttackSystem 处理弹道穿透 |
| `tower_missile` | ✅ v1.0（P3 R5，b7217ef） | 三节点接管：select_missile_target → charge_attack → launch_missile_projectile；AttackSystem.handleMissileTower 已薄化为 no-op，BT 完整接管选目标 / 蓄力 / 发射 / cooldown 重置全流程 |
| `enemy_basic` / `enemy_boss` | ✅ v2.0（P4 R7，20ed006） | enemy_melee_attack 节点真接管：节点 doEnemyAttack（Physical 直伤 + sound）+ HoldPosition + cooldown；EnemyAttackSystem.update 薄化为 no-op |
| `enemy_ranged` | ✅ v2.0（P4 R7，20ed006） | enemy_ranged_attack 节点真接管：节点 doEnemyAttack（spawn 红色 Circle projectile 200 px/s）+ HoldPosition + cooldown；保留 enemy_melee_attack 兜底（近距离切近战） |
| `enemy_shaman` | ✅ v1.0（P2 R3） | move_to + aura_buff 节点；治疗逻辑仍在 ShamanSystem 接管（涉及 boss 半治疗 / 视觉 flash，留 P3） |
| `enemy_balloon` | ✅ v1.0（P2 R3） | 仅 move_to；drop_bomb 因「正下方建筑」目标选择无对应 BT 节点，HotAirBalloonSystem 继续接管，待 P3 引入 select_building_below 节点后再迁移 |
| `soldier_basic` / `soldier_tank` / `soldier_dps` / `soldier_generic` | ✅ v1.0 | 士兵 BT 全套已实现（含 SOLDIER_GENERIC_AI 4 状态模板） |
| `building_production` | ✅ v1.0 | 资源生产建筑 BT |
| `trap_damage` / `trap_healing` | ✅ v1.0 | 陷阱 BT |

> P3 R5 完成后，**15/15 AI 配置全部达 v1.0**。所有 v1.0 配置：BT 描述单位行为语义；部分行为（DOT 周期、弹道穿透、boss 半治疗、正下方建筑选择）由专门系统接管的实现细节，已在各配置 docstring 中明确说明。导弹塔三节点（select_missile_target / charge_attack / launch_missile_projectile）是 BT 接管复杂战术单位的范例：BT 描述「选目标→蓄力→发射」时序，MissileCharge 组件作为 BT↔RenderSystem 通信总线，ProjectileSystem 负责抛物线+AOE 物理。
>
> P4 R7 完成后，**问题⑦完全解决**：6 非-missile 塔（basic/cannon/ice/bat/lightning/laser）+ 3 敌人（basic/boss/ranged）的 BT v2.0 全部真接管，AttackSystem.update 仅保留 cleanupOrphanedTargetingMarks + missile dispatch（约 24 行），EnemyAttackSystem.update 薄化为 no-op。攻击节点不再是死代码——BT 是唯一 AI 真理源，AttackSystem 仅提供工具函数（spawnProjectile / doLightningAttack / doLaserAttack / findEnemiesInRange / getLaserBeamCount）与组件清理。cooldown tick 由 AISystem 全权负责（line 130-133，每帧 dt 递减 0 ceil）。

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
| ⑤ | **缺少 4 套 AI 配置** — `tower_vine`, `tower_ballista`, `enemy_shaman`, `enemy_balloon` 已升 v1.0（P2 R3）；`tower_missile` P3 R5（b7217ef）三节点 v1.0 完成 | ✅ 5/5 已修 |
| ⑥ | **6 个系统完全绕过行为树** — `BatSwarmSystem`, `ShamanSystem`, `HotAirBalloonSystem`, `TrapSystem`, `HealingSystem`, `ProductionSystem` 全部硬编码 AI 逻辑 | 🟡 P1 |
| ⑦ | **AttackSystem / EnemyAttackSystem 覆盖 BT** — 塔和敌人的行为树 `attack` 节点是死代码，因为 AttackSystem 在同一帧内独立处理了所有攻击逻辑 | ✅ 完全解决（missile P3 R5；6 非-missile 塔 P4 R5+R6；3 敌人 P4 R7。AttackSystem.update 仅保留 cleanupOrphanedTargetingMarks + missile dispatch；EnemyAttackSystem.update 薄化为 no-op；cooldown tick 由 AISystem 全权负责） |
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

## 六、v3.0 敌方威胁度评分扩展（追加）

> 根据 [25-card-roguelike-refactor](../10-gameplay/10-roguelike-loop.md) 与 [02-unit-system §9](../20-units/20-unit-system.md#9-敌方攻击优先级v30) 方案，敌方单位 AI 默认沿路径移动，但应能识别"高威胁目标"并主动停下攻击。本节定义威胁度评分机制及行为树扩展。
>
> 本节是 v3.0 敌方威胁度评分的唯一权威设计。

### 6.1 设计动机

v1.1 之前，敌方 AI 通常采用以下逻辑之一：
- A) 完全无视塔/兵，沿路径直冲基地（仅 boss 例外）
- B) 进入射程内的塔/兵不区分优先级，按距离最近一律攻击

这导致两种问题：
1. 玩家放置高威胁的辅助塔（如治疗塔、产钱塔）不会被敌人针对
2. 敌人攻击行为缺乏"智能感"，无法体现单位个性

v3.0 引入"威胁度评分"：敌人按可配置的优先级规则识别**最优攻击目标**，从而：
- 治疗类辅助单位（如 priest）会被对应敌人优先攻击
- 不同类型的敌人有不同的目标偏好（如 wolf_rider 偏好近战兵，mage 偏好塔）
- 敌人能体现出"知道在打什么"的智能感

### 6.2 威胁度评分接口

#### 6.2.1 EnemyTargetPriority 配置字段

每个敌方 `UnitConfig` 可携带 `enemyTargetPriority` 字段（详见 [02 §9.1](../20-units/20-unit-system.md#91-enemytargetpriority-字段)）：

```ts
interface EnemyTargetPriority {
  // 是否启用威胁度评分（false 时纯走路径）
  enabled: boolean;

  // 评分扫描半径，0 表示仅在原攻击射程内扫描
  scanRange?: number;

  // 类型权重：对每个目标类型给予基础分
  typeWeights?: Partial<Record<UnitTagKind, number>>;

  // 标签权重：单位有特定 tag 时额外加分
  tagWeights?: Partial<Record<string, number>>;

  // 是否优先攻击带 buff 治疗属性的单位
  preferHealers?: boolean;

  // 距离衰减系数（0-1）：1 表示完全按距离反比，0 表示忽略距离
  distanceFactor?: number;

  // 切换阈值：当前目标分 / 最高分低于该值时切换
  switchThreshold?: number;
}
```

#### 6.2.2 评分公式

```
score(target) = baseTypeWeight + sumTagWeights + healerBonus * (target.hasHealAura ? 1 : 0)
score *= max(0, 1 - distanceFactor * (distance / scanRange))
```

最终选定 `max(score)` 对应的单位为攻击目标。

### 6.3 行为树节点扩展

#### 6.3.1 新增节点 `ScoreSelectTarget`

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `'ScoreSelectTarget'` | 节点类型 |
| `range` | `number?` | 扫描半径（不填时取单位攻击射程） |
| `priority` | `EnemyTargetPriority` | 评分规则（也可指向 UnitConfig 的 enemyTargetPriority） |
| `setKey` | `string?` | Blackboard 存储键（默认 `'target'`） |

行为：在 `range` 内扫描所有可攻击单位，按 6.2.2 公式计算分数，选最高分写入 Blackboard。如果没有任何可攻击目标，节点 Fail。

#### 6.3.2 与现有 `SelectTarget` 节点的关系

| 维度 | `SelectTarget`（旧） | `ScoreSelectTarget`（新） |
|------|-------------------|------------------------|
| 选择逻辑 | 取最近 / 最弱 / 最强 | 加权评分 |
| 数据源 | 单一字段（distance/hp） | 多维（type/tag/heal/distance） |
| 适用单位 | 简单敌人 / 塔 | 中高级敌人，关键 boss |

向后兼容：现有单位 AI 配置不需要改动，继续用 `SelectTarget`。新增敌人才用 `ScoreSelectTarget`。

### 6.4 v3.0 敌方 AI 配置示例

#### 6.4.1 `mage`（远程法师）— 偏好优先攻击塔

```yaml
mage:
  behavior:
    ai_tree:
      type: Sequence
      children:
        - type: ScoreSelectTarget
          range: 200
          priority:
            enabled: true
            scanRange: 200
            typeWeights:
              Tower: 100         # 塔加 100
              Soldier: 30        # 兵加 30
              Production: 10     # 生产建筑加 10
            distanceFactor: 0.3
            switchThreshold: 0.7
          setKey: target
        - type: MoveToTarget
          stoppingDistance: 180
        - type: AttackTarget
          range: 200
```

#### 6.4.2 `wolf_rider`（狼骑兵）— 偏好近战单位

```yaml
wolf_rider:
  behavior:
    ai_tree:
      type: Sequence
      children:
        - type: ScoreSelectTarget
          range: 100
          priority:
            enabled: true
            typeWeights:
              Soldier: 80
              Tower: 40
            tagWeights:
              "tank": 50          # 肉盾兵额外加 50
              "ranged": -20       # 远程兵减 20（不喜欢追远程）
            distanceFactor: 0.5
          setKey: target
        - type: Selector
          children:
            - type: AttackTarget
              range: 30
            - type: MoveToTarget
              stoppingDistance: 30
```

#### 6.4.3 `boss_dark_knight`（关 8 Boss）— 优先击杀治疗单位

```yaml
boss_dark_knight:
  behavior:
    ai_tree:
      type: Selector
      children:
        # 优先击杀治疗单位
        - type: Sequence
          children:
            - type: ScoreSelectTarget
              range: 300
              priority:
                enabled: true
                preferHealers: true
                healerBonus: 500       # 治疗单位极高优先
                typeWeights:
                  Soldier: 50
                  Tower: 80
                distanceFactor: 0.2
              setKey: target
            - type: AttackTarget
              range: 60
        # 其他单位
        - type: SelectTarget
          mode: nearest
          setKey: target
        - type: AttackTarget
          range: 60
```

### 6.5 实现步骤

| 步骤 | 涉及文件 | 说明 |
|------|---------|------|
| 1. 定义 `EnemyTargetPriority` 接口 | `src/types/ai.ts` | 类型声明 |
| 2. `UnitConfig` 增加可选字段 | `src/types/unit.ts` | 不破坏旧配置 |
| 3. 实现 `ScoreSelectTarget` BT 节点 | `src/ai/nodes/ScoreSelectTarget.ts` | 评分逻辑 |
| 4. `UnitTag` 增加 tag 数组字段 | `src/components/UnitTag.ts` | 用于 tagWeights 查询 |
| 5. 配置 v3.0 新敌人 AI | `src/data/gameData.ts` | mage/wolf_rider/healer_priest 等 |
| 6. 单元测试覆盖评分公式 | `tests/scoreSelect.test.ts` | 数学边界 + 距离衰减 |
| 7. BT 查看器显示当前评分 | `src/debug/BehaviorTreeViewer.ts` | 调试可视化 |

### 6.6 验收标准（v3.0 扩展）

- [ ] `EnemyTargetPriority` 接口完整定义且向后兼容
- [ ] `ScoreSelectTarget` 节点单元测试覆盖所有评分维度
- [ ] `mage` 在场景中优先攻击塔而非士兵（观察行为可验证）
- [ ] `wolf_rider` 优先攻击近战单位
- [ ] `boss_dark_knight` 优先击杀 priest
- [ ] 不配置 `enemyTargetPriority` 的旧敌人行为不受影响
- [ ] `BehaviorTreeViewer` 可显示当前评分排行

---

> 版本: v3.0 | 日期: 2026-05-12 | 基于审计结果 + 卡牌系统重构编写
