---
title: 阵营语义重构
status: stable
version: 1.0.0
last-modified: 2026-05-14
authority-for:
  - faction-semantics
supersedes: []
cross-refs:
  - 60-tech/60-architecture.md
  - 20-units/20-unit-system.md
---

# 阵营语义重构

> 状态：草案 v0.1 | 日期：2026-05-13 | 触发原因：导弹塔锁友军 bug 暴露 isEnemy 双轨语义陷阱

---

## 一、背景与触发事件

### 1.1 现状双轨问题

代码中"敌我判定"存在**两套并行机制**：

| 维度 | `UnitTag.isEnemy` (ui8) | `Faction.value` (ui8) |
|------|------------------------|----------------------|
| 语义 | 0/1 布尔——"是否敌方" | 0/1/2 枚举——Player/Enemy/Neutral |
| 起源 | 老代码主导（38+ 处读取，18+ 文件） | 后引入（设计文档真理源），6 系统已用 |
| 真理源 | ❌ 散落硬编码 | ✅ design/02-unit-system.md §4.1 |
| 阵营覆盖 | 二元（缺中立） | 三元（含 Neutral） |

### 1.2 触发 bug 链

| Commit | Bug | 根因 |
|--------|-----|------|
| `fb2263f` | 导弹首帧误判命中 + splash 伤友军 | 多处 splash 未过滤 isEnemy |
| `997ca37` | 导弹选目标会锁友军 | `enemyTargetQuery = defineQuery([Position,Health,UnitTag])` — bitecs `defineQuery` 仅按组件 presence 交集，**无法过滤数值字段** |

`enemyTargetQuery` 名字暗示"敌方专属 query"，但实现层级根本做不到——这是命名与实现错位导致的语义陷阱。每次有人新增 query 调用点，都需要记得手工补 `if (UnitTag.isEnemy[eid] !== 1) continue;` 守卫，遗忘即 bug。

### 1.3 现状双轨数据点

代码扫描结果（截至 `997ca37`）：

- **UnitTag.isEnemy 读取**：38+ 处，分布 18 文件
  - `=== 1` / `!== 1`（"敌方"过滤）：25+ 处
  - `=== 0` / `!== 0`（"玩家方"过滤）：7 处，集中在 `main.ts` UI/渲染层
- **Faction.value 读取**：分布 6 系统（BombSystem/RuleEngine/RuleHandlers/BuffSystem/HotAirBalloonSystem/JuggernautSystem/BehaviorTree）
- **`isEnemy:` 字面量赋值**：BuildSystem/WaveSystem/main.ts/测试 fixture 大量散布

完整清单见附录 A。

---

## 二、设计目标

### 2.1 核心诉求

> 把绝对的 "enemy" 概念替换为**相对的阵营**判定，去除 `UnitTag.isEnemy` 双轨。

**用户原话锚定**（不可背离）：

- "isEnemy 的含义应该是相对的敌方"
- "塔和敌方单位互为敌对阵营"
- "增加判断目标是否为敌方阵营的函数"
- "代码里不要用 enemy 特指敌方"（去硬编码）

### 2.2 真理源固化

`Faction.value` + `FactionVal` 枚举为**唯一阵营真理源**：

```ts
// src/core/components.ts L18-23（已存在）
export const FactionVal = {
  Player: 0,
  Enemy: 1,
  Neutral: 2,
} as const;
```

设计文档中 `02-unit-system.md §4.1` 既已固化此三元划分，本次重构是**对齐代码到设计文档**，不创造新概念。

### 2.3 不在范围

- **不**改阵营名称：沿用 Player/Enemy/Neutral，不引入"邪恶/正义"等新术语（保证 8+ 文档零返工）
- **不**改存档格式：FactionVal 数值编码不变（0/1/2）
- **不**改 BT 节点接口对外语义：`target_type: 'enemy'/'tower'/'soldier'` 之类的字符串参数保持不变

---

## 三、API 设计

### 3.1 核心 API：`isHostileTo(a, b)`

**位置**：`src/core/components.ts`（紧邻 Faction 组件定义）

**契约**：

```ts
/**
 * 判定两个实体是否互为敌对阵营。
 *
 * 规则：
 *   - Player vs Enemy → true
 *   - Enemy vs Player → true
 *   - 任一方为 Neutral → false（中立单位不与任何阵营敌对，但所有阵营可主动攻击中立）
 *   - 同阵营 → false
 *   - 任一方缺失 Faction 组件 → false（不假设，调用方负责保证组件存在）
 *
 * @returns 是否敌对（可互相攻击）
 */
export function isHostileTo(world: BitecsWorld, a: number, b: number): boolean;
```

### 3.2 辅助 API：`isFaction(eid, faction)`

替换所有 `UnitTag.isEnemy[eid] === 1` 风格：

```ts
/** 判定实体是否属于指定阵营 */
export function isFaction(eid: number, faction: FactionVal): boolean;
```

### 3.3 Query helper：`factionQuery(world, faction)`

替换 `enemyQuery` / `enemyTargetQuery` 的虚假承诺：

```ts
/**
 * 返回当前所有归属指定阵营的实体列表。
 *
 * 实现：内部用 bitecs defineQuery 拿全量 Faction 实体，
 * 再按 Faction.value 字段过滤——defineQuery 无法直接过滤数值字段，此函数封装该限制。
 */
export function factionQuery(world: BitecsWorld, faction: FactionVal): readonly number[];
```

调用示例：

```ts
// 旧：const enemies = enemyTargetQuery(world);  // 虚假承诺，可能含友军
// 新：
const enemies = factionQuery(world, FactionVal.Enemy);
```

### 3.4 决策矩阵

调用场景 → 推荐 API：

| 场景 | 旧写法 | 新写法 |
|------|--------|--------|
| 判断单个实体是敌方 | `UnitTag.isEnemy[e] === 1` | `isFaction(e, FactionVal.Enemy)` |
| 判断单个实体是玩家方 | `UnitTag.isEnemy[e] === 0` | `isFaction(e, FactionVal.Player)` |
| 双实体敌对判定（AI 选目标） | `UnitTag.isEnemy[attacker] !== UnitTag.isEnemy[target]` ❌ 漏 Neutral | `isHostileTo(world, attacker, target)` |
| 拉某阵营实体列表 | `enemyQuery(world)` + 手工守卫 | `factionQuery(world, FactionVal.Enemy)` |

---

## 四、迁移路径（分阶段）

每个 phase 独立 commit，独立通过 `npm run typecheck && npm test`。

### Phase A：API 落地 + 不动旧代码

**目标**：新建 `isHostileTo` / `isFaction` / `factionQuery`，不替换任何调用点。

- 在 `components.ts` 加 3 个 API + 单元测试
- 红绿验证：测试覆盖 Player vs Enemy / Player vs Neutral / 同阵营 / 缺 Faction 组件四象限
- 风险：零（纯新增）

### Phase B：数据写入侧统一 Faction 组件

**目标**：所有创建实体的代码点保证同时写 Faction 与 UnitTag.isEnemy（双轨并存阶段）。

扫描结果（待 Phase A 完成后再次确认）：

- `WaveSystem.spawnEnemy` — 写 isEnemy:1 + Faction:Enemy（确认已同步）
- `BuildSystem.buildTower` — 写 isEnemy:0 + Faction:Player（确认已同步）
- `main.ts` 初始化基地/出生点 — 检查 Faction 是否写入
- 测试 fixture（BehaviorTree.test.ts 等）— 列单核对

**验收**：grep `isEnemy:` 与对应 `Faction` 一一对应；无 isEnemy 单写、无 Faction 单写。

### Phase C：读取侧逐文件迁移（单 commit/文件）

按风险递减序逐文件替换 `UnitTag.isEnemy[*] === 1/0/!== 1/!== 0` → `isFaction(*, FactionVal.Enemy/Player)`。

推荐序列（先低风险，最后系统级关键路径）：

1. `src/systems/WeatherSystem.ts`（1 处，叶子系统）
2. `src/systems/BatSwarmSystem.ts`（1 处）
3. `src/systems/ShamanSystem.ts`（2 处）
4. `src/systems/JuggernautSystem.ts`（1 处）
5. `src/systems/HotAirBalloonSystem.ts`（1 处）
6. `src/systems/SkillSystem.ts`（2 处）
7. `src/systems/ProjectileSystem.ts`（1 处）
8. `src/systems/UISystem.ts`（1 处）
9. `src/systems/MovementSystem.ts`（1 处）
10. `src/systems/WaveSystem.ts`（1 处）
11. `src/systems/AttackSystem.ts`（4 处）
12. `src/systems/HealthSystem.ts`（3 处）
13. `src/ai/BehaviorTree.ts`（10 处，最复杂；含 `target_type` 参数路径）
14. `src/main.ts`（5 处，含 UI 渲染层 `isEnemy === 0` 玩家方过滤）

每文件迁移完后跑全量测试，确认零回归。

### Phase D：Query 层重构

**目标**：替换所有 `enemyQuery` / `enemyTargetQuery` 用法。

- `src/core/components.ts` 的 `enemyQuery` 改 deprecated 别名指向 `factionQuery(world, FactionVal.Enemy)`，或直接删除并改名调用点
- `src/ai/BehaviorTree.ts` L25 `enemyTargetQuery` alias 删除，调用点改用 `factionQuery`
- 局部 defineQuery 副本（ProjectileSystem.ts L34/ShamanSystem.ts L14/BatSwarmSystem.ts L61）同样替换

**关键测试**：再次跑 `npx vitest run src/systems/MissileTargeting.test.ts src/ai/BehaviorTree.test.ts` — 嘲讽机制 + 友军过滤 zero 回归。

### Phase E：UnitTag.isEnemy 字段退役

**前提**：Phase C+D 已完全删除所有读取点。

- `src/core/components.ts`：从 UnitTag 组件移除 `isEnemy: Types.ui8` 字段
- 数据写入点（Phase B 标定）：删除 `isEnemy:` 字面量
- 测试 fixture：批量改名（建议 sed 脚本或 ast-grep）

**风险检查**：

- 存档兼容性：检查 `src/save/*.ts`（如存在）是否序列化 UnitTag.isEnemy
- 调试工具：`design/27-debug-system.md` 提到的行为树查看弹窗是否显示 isEnemy

### Phase F：去 "enemy" 硬编码命名

用户原话"代码里不要用 enemy 特指敌方"——审视代码符号命名：

- 变量 `enemies` / `enemy` 在表示"Enemy 阵营实体"语境下保留（语义匹配）
- 变量 `enemies` 在表示"敌对目标列表"语境下改名为 `hostiles` / `targets`（语义解耦）
- `enemyQuery` 函数名按 Phase D 处理（已退役）
- `enemyTargetQuery` 别名（BehaviorTree.ts L25）按 Phase D 退役

此 phase 影响小，可压缩到 Phase D 内一并完成。

---

## 五、影响清单（附录 A）

**38 处 UnitTag.isEnemy 读取**详细位置见 audit log（commit message 引用 task `bg_90fb14ec`）。

按文件汇总：

| 文件 | 读取次数 | 主要语义 |
|------|---------|---------|
| `src/ai/BehaviorTree.ts` | 10 | 敌方过滤 + 玩家方过滤混用 |
| `src/main.ts` | 5 | 渲染/UI/选中（玩家方过滤为主） |
| `src/systems/AttackSystem.ts` | 4 | 敌方候选过滤 |
| `src/systems/HealthSystem.ts` | 3 | 敌方死亡/扣血逻辑 |
| `src/systems/ShamanSystem.ts` | 2 | 敌方目标过滤 |
| `src/systems/SkillSystem.ts` | 2 | 敌方目标过滤 |
| `src/systems/ProjectileSystem.ts` | 1 | splash 友军过滤（已加守卫） |
| `src/systems/MovementSystem.ts` | 1 | 敌方沿路径移动 |
| `src/systems/WaveSystem.ts` | 1 | 存活敌人统计 |
| `src/systems/BatSwarmSystem.ts` | 1 | 蝙蝠目标 |
| `src/systems/WeatherSystem.ts` | 1 | 天气仅减速敌方 |
| `src/systems/JuggernautSystem.ts` | 1 | 巨兽目标 |
| `src/systems/HotAirBalloonSystem.ts` | 1 | 气球目标 |
| `src/systems/UISystem.ts` | 1 | 敌方血条 |

---

## 六、测试策略

### 6.1 新增测试（Phase A 同步）

`src/core/components.test.ts`（新建或扩展）：

- `isHostileTo` 真值表覆盖：Player-Enemy / Enemy-Player / Player-Player / Enemy-Enemy / Player-Neutral / Enemy-Neutral / Neutral-Neutral / 缺组件
- `isFaction` 三阵营匹配 + 缺组件
- `factionQuery` 返回结果集仅含指定阵营

### 6.2 回归测试基线

每个 Phase 完成后必跑：

- `npm run typecheck`
- `npm test`（当前 462 测试基线，重构期间不应低于此数）

### 6.3 关键回归点

下列已知"易碎"测试在 Phase C/D 期间重点观察：

- `src/ai/BehaviorTree.test.ts` — 嘲讽机制 4 项（曾因 enemyQuery 改造回归）
- `src/systems/MissileTargeting.test.ts` — 自攻击守卫 + 友军过滤
- `src/systems/ProjectileSystem.test.ts` — splash 友军过滤

---

## 七、决策记录（ADR）

### ADR-1：沿用 Player/Enemy/Neutral 而非"邪恶/正义"

用户初提"邪恶阵营/正义阵营"命名，但调研发现 8+ 设计文档已锁定 Player/Enemy/Neutral 术语（02 §4.1 / 03 §1 / 04 §3.2.2 / 12 / 19 / 22 / 24 / 26）。改名将引发：

- 8 份文档同步重写
- 存档 schema 字符串字段迁移（如有）
- 调试工具术语更新
- commit history 中术语断层

成本收益不匹配，**决议沿用现有命名**，重构焦点回归"去 isEnemy 双轨"主线。用户已批准（2026-05-13）。

### ADR-2：保留 UnitTag 组件，仅删除 isEnemy 字段

UnitTag 仍承载 `isBoss / popCost / level / maxLevel` 等非阵营字段，组件本身不退役，仅退役 `isEnemy: ui8` 字段。

### ADR-3：bitecs defineQuery 限制不变，用 helper 函数封装

bitecs `defineQuery` 仅按组件 presence 求交集，无法过滤数值字段（此次 bug 根因）。重构后用 `factionQuery(world, faction)` 函数封装"先 query 再过滤"模式，命名直白警示读者：**没有零成本的阵营 query**。

---

## 八、与其他文档关系

- **真理源**：`02-unit-system.md §4.1`（阵营定义不变）
- **被参考**：`23-ai-behavior-tree.md`（target_type 参数语义保持）、`24-soldier-ai-behavior.md`（嘲讽机制不受影响）
- **过渡 commit**：`997ca37 fix(missile-target): SelectMissileTargetNode 加 isEnemy 守卫`（本次重构的导火索 bug 修复）

---

## 九、风险与缓解

| 风险 | 缓解 |
|------|------|
| 大规模重构破坏 BT 嘲讽机制（前车之鉴） | Phase C 单文件 commit + 全量测试守门 |
| `Faction` 组件未写入的实体导致 isHostileTo 失效 | Phase B 先补齐写入侧，再迁读取侧 |
| 测试 fixture 大量 `isEnemy:` 字面量遗漏 | Phase E 退役字段时编译失败自动捕获 |
| 性能回归（多函数调用替代直接数组访问） | `isFaction` 实现为单行 `Faction.value[eid] === faction`，inline 友好；如热点路径回归再考虑 |

---

## 十、当前进度

- ✅ Phase 0（点状修复）：commit `997ca37` 已落地 SelectMissileTargetNode 守卫
- ⏳ Phase A：待启动
- 后续 Phase B-F：按本文档执行
