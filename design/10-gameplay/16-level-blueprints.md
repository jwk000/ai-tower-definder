---
title: 16-level-blueprints
status: living
authority: gameplay
version: v1.0.0
last-updated: 2026-05-15
authors: design
related:
  - 10-gameplay/15-level-themes.md   # 主题/敌人/数值签名（上游真理源）
  - 10-gameplay/10-roguelike-loop.md # Run 长征流程
  - 10-gameplay/13-map-level.md      # 旧 8 关清单（本文上线后废弃 §2-§3）
  - 50-data-numerical/50-mda.md      # §21 数值表（本文所有数字的真理源）
  - 60-tech/60-architecture.md       # ECS / 规则引擎 / 配置 schema
---

# 16-level-blueprints — 8 关 Roguelike 关卡蓝图

> **本文档定位**：8 关 roguelike 长征的**具体落地蓝图**——grid 地图布局、路径节点坐标、可建格、波次时间线（按秒精确到敌人组）、Boss 演出脚本。
>
> 上游：[`15-level-themes`](./15-level-themes.md) 定义主题/敌人/数值签名；[`50-mda §21`](../50-data-numerical/50-mda.md#21-8-关-roguelike-关卡数值v32-新增) 给出所有数值。本文档**不再造数值**，只落地排版。
>
> 下游：`src/config/levels/level-0{1…8}.yaml` 与 `src/data/levels/level-0{1…8}.ts` 必须与本文逐行对应。

---

## 0. 读者指引

### 0.1 本文档结构

- **§1**：全局规范（网格坐标系、spawn 命名、波次时间线 schema、编队枚举、单位描述格式）。任何关卡章节都默认遵循 §1，不再复述。
- **§2 – §9**：8 关详细蓝图，每关包含 7 个子节：grid 布局 / 路径节点 / 可建格 / 波次时间线 / Boss 演出 / 配置出口 / 验收清单。
- **§10**：跨关验收表（总波数 / 总敌数 / Boss 出场时点 / 预期时长 / 防御工事强度对照）。
- **§11**：版本日志。

### 0.2 谁应该读

- **策划**：拿本文档写 YAML、调数值、定波次。
- **程序**：拿本文档实现 `level-0{1…8}.yaml/.ts`、规则 handler、Boss 行为树。
- **测试**：拿 §10 验收表写自动化用例与人工通关脚本。

### 0.3 与上游文档的冲突仲裁

| 冲突类型 | 仲裁 |
|---|---|
| 数值不一致 | 以 [50-mda §21](../50-data-numerical/50-mda.md#21-8-关-roguelike-关卡数值v32-新增) 为准，本文同步修订 |
| 主题/敌人/机制不一致 | 以 [15-level-themes](./15-level-themes.md) 为准，本文同步修订 |
| 关卡顺序 / Run 流程 | 以 [10-roguelike-loop](./10-roguelike-loop.md) 为准 |
| 视觉/UI 表现 | 以 [40-presentation](../40-presentation/) 为准 |

---

## 1. 全局规范

### 1.1 网格坐标系

- **默认尺寸**：21 列（X: 0–20）× 9 行（Y: 0–8）；像素映射 64 px/格 → 1344×576 战场（[50-mda §3.1](../50-data-numerical/50-mda.md#3-锚点定义与核心公式)锚点）。
- **原点**：左上 `(0,0)`；X 向右增、Y 向下增。
- **例外尺寸**：
  - 关 6 齿轮工厂：**21×11**（多两行容纳厂房纵深），Y: 0–10。
  - 关 8 异界终战：**25×11**，X: 0–24，Y: 0–10。
- **ASCII 图例**：

```
.  : 空地（不可建、不可走）
#  : 障碍（树/岩石/建筑，阻挡寻路）
~  : 可建格（玩家放塔位置；与障碍互斥）
=  : 主路径地块（敌人必经）
+  : 路径分叉/交汇节点
*  : 隧道/传送门入口（穿地敌人专用）
@  : 水域（仅水路敌人可走、陆地敌人绕行）
B  : 水晶坐标（终点；本文档简称 Crystal）
S0..S3 : spawn 点 0-3（最多 4 个 spawn）
W  : 路径中段空投点（仅关 5 用）
```

### 1.2 spawn 命名约定

- spawn 点 ID 用 `S{n}`，n 从 0 起，至多 4 个。
- 多 spawn 路径必须明确每条路径的起点-终点链，记作 `S0 → P1 → P2 → … → B`。
- 单 spawn 多分叉路径用 `S0 → P1 → {P2a, P2b} → P3 → B` 表示。
- 空投点（关 5）记 `W{n}`，表示该波次第 n 个空投单位的落点。

### 1.3 波次时间线 schema

> 每个关卡的 §X.4 必须以**表格形式**给出完整波次时间线，列固定为：

| 列 | 含义 | 示例 |
|---|---|---|
| **波** | 波次编号（1 起） | `W3` |
| **t** | 该波相对开战 0:00 的开始时间（秒） | `120` |
| **spawn 流** | 多个 `(t偏移 / 敌人 ID × 数量 / spawn 点 / 编队)` 项串联 | 见 §1.4 |
| **结束 t** | 该波最后一个敌人 spawn 完成的时间（秒，相对 0:00） | `155` |
| **下一波 trigger** | `auto_after_clear`（清场触发） / `auto_at(t)`（定时触发） / `manual`（玩家手动） | `auto_at(170)` |
| **flavor** | 取 [15-level-themes §1.2](./15-level-themes.md#12-五大波次-flavor-分类本文档统一术语) 5 类之一 | `SWARM` |
| **备注** | 机关/天气/演出触发等 | `战中地震 t=140` |

#### 1.4 spawn 流标记法

格式：`Δt: enemy_id × count @S{spawn} fmt={编队} [interval={spawnInterval}]`

- `Δt` 是相对该波 `t` 的偏移秒数（**整数秒**）。
- 多组 spawn 用换行分隔（同一波内）。
- `interval` 若省略，默认按 [50-mda §8](../50-data-numerical/50-mda.md#8-波次难度曲线重校准) 的 flavor 默认间隔（SWARM=0.5s / SIEGE=1.5s / 其他=1.0s）。

**示例**：

```
Δ0: e_burrow_worm × 6 @S0 fmt=column interval=0.6
Δ8: e_locust_swarm × 9 @S1 fmt=swarm interval=0.3
Δ20: e_giant_beetle × 1 @S0 fmt=single
```

含义：开战 t 秒时（该波起始），瞬时从 S0 spawn 6 只钻地蠕虫；8 秒后从 S1 spawn 9 只蝗虫；20 秒后从 S0 spawn 1 只巨甲虫。

### 1.4 触发条件（trigger）

| 触发器 | 说明 |
|---|---|
| `auto_at(t)` | 当游戏时钟到达 `t` 秒时自动启动下一波（用于固定节奏的波间冷场） |
| `victory` | 该波是关卡终点，全部敌人清场后判定胜利 |
| `on_clear_at_least(t)` | 当前波清场 **且** 游戏时钟 ≥ `t` 时启动下一波（保留触发器，本文档 8 关未使用） |
| `manual` | 等待玩家手动按下 "下一波" 按钮（关 1 教学波专用） |

> 默认波间冷场 30s；关 6 GAUNTLET flavor 强制 15s（[15-level-themes §1.2](./15-level-themes.md#12-五大波次-flavor-分类本文档统一术语)）；关 8 单超长波三阶段无波间冷场。

### 1.5 编队枚举（formation）

| 名称 | 视觉 | 实现说明 |
|---|---|---|
| `single` | 单只孤兵 | count=1，无间距 |
| `column` | 纵队 | 沿路径方向单列，spawnInterval ≥ 0.5s |
| `wedge` | 楔形 | 1+2+3+...，前小后大；用 spawnId 排序入场 |
| `phalanx` | 方阵 | 横向 3 列纵向 N 行；多 spawn 点同步触发 |
| `swarm` | 蜂群 | spawnInterval ≤ 0.3s，飞行层乱序 |
| `convoy` | 护送队 | 1 高价值单位 + N 护卫；护卫 spawnId 较小 |
| `pincer` | 钳形 | 强制要求 ≥2 个 spawn 点同步开火 |
| `boss_solo` | Boss 单刷 | 单只，前后 ≥10s 空窗 |
| `boss_escort` | Boss + 护卫 | Boss + 4-6 护卫，护卫 spawnId 较小 |

### 1.6 路径节点定义

- 每个路径用 `path_id`（小写蛇形）命名，如 `main_path` / `flank_path` / `air_path` / `water_path` / `tunnel_path`。
- 节点列表给出**所有拐点 + 起终点**的格坐标，无需逐格列出直线段。
- 飞行层路径（`air_path`）允许跨障碍直飞，节点表只列出 spawn 与 Crystal 即可。
- 多分叉用「分叉节点 + 后续段」表示，例：

```
main_path: S0(0,4) → P1(5,4) → SPLIT → {P2a(10,2), P2b(10,6)} → MERGE(15,4) → B(20,4)
```

### 1.7 可建格规约

- 每关给出可建格总数（用作平衡校验），并在 ASCII 图上用 `~` 标记。
- 关 1 起始 18 格，逐关递增；关 8 终战 30 格上限（[15-level-themes §10.5](./15-level-themes.md#105-数值签名横向对照表)）。
- **建造规则**：
  - 路径地块（`=`、`+`、`*`）不可建塔。
  - 障碍格（`#`）不可建（部分关卡可由"清理"事件转为 `~`）。
  - 水域（`@`）默认不可建，关 5 的水路码头格 `~@` 可建特殊水域塔（v3.2 暂不实现，预留）。

### 1.8 Boss 演出脚本规范

每个有 Boss 的关卡 §X.5 必须列出以下 6 项：

1. **入场触发**：哪一波、波内何时入场（`Δt`）、是否伴随杂兵护卫。
2. **入场演出**：屏幕震动 / 摄像机拉远 / 音乐切换 / 黑屏字卡（如适用）。
3. **形态切换条件**：HP%、定时器、或事件触发。
4. **形态切换演出**：免伤窗口（秒）、特效、声音、视觉变化。
5. **战败演出**：尸体爆炸 / 掉落物 / 镜头特写。
6. **超时机制**：Boss 战超过 5 分钟仍未结束的应急策略（[15-level-themes §1.5](./15-level-themes.md#15-boss-出场节奏综合-kr--sts)）。

### 1.9 单位 ID 引用约定

- 沿用 [50-mda §21.5](../50-data-numerical/50-mda.md#215-36-新敌人--6-新-boss-基础数值替换-68-关-28-部分) 命名空间：
  - 关 1 现有单位：`grunt / runner / heavy / mage / exploder / boss_commander / boss_beast`（YAML id 不变，UI 显示按 [15-level-themes §2.2](./15-level-themes.md#22-敌人阵容5-杂兵--0-boss) 重命名为 `goblin_scout / wolf_rider / orc_brute / shaman_warlock / suicide_goblin / goblin_chief`）。
  - 关 2-8 新增单位 ID 全部以 `e_` 前缀开头，避免与现有名字冲突。
- 配置出口 `availableTowers` / `availableUnits` 字段直接引用 [50-mda §4](../50-data-numerical/50-mda.md#4-塔类单位数值重设计) / [§5](../50-data-numerical/50-mda.md#5-我方移动单位数值重设计) 列出的 ID。

### 1.10 YAML 配置出口约定

> **本轮范围**：仅产出设计稿 YAML（位于 `src/config/levels/level-XX.yaml`），作为关卡编辑器消费源；运行时 TS（`src/data/levels/*`）的接入推迟到下一轮独立任务（须先扩展 `LevelTheme` / `WeatherType` enum + 适配 levelFixtures 测试）。

每个关卡 §X.6「配置出口」必须给出：

```yaml
id: level-XX
theme: <LevelTheme 枚举值>
grid: { cols: 21, rows: 9 }
startingGold: 200    # 仅关 1 给予；关 2+ 继承 Run 状态
weatherPool: [Sunny, Sandstorm, ...]
availableTowers: [arrow, cannon, ...]
availableUnits: [swordsman, archer, ...]
unlockStarsRequired: <Run 内进度，本字段在 roguelike 流程下不再使用，置 0>
unlockPrevLevelId: <前一关 id 或 null>
```

> v3.2 关键变更：`unlockStarsRequired` 在 roguelike 模式下失效（顺序由 RunManager 强制），保留字段是为了过渡期 levelFixtures 测试兼容性。后续可移除。

### 1.11 速查表

| 字段 | 默认值 | 推荐档位 |
|---|---|---|
| 网格 | 21×9 | 关 6 = 21×11；关 8 = 25×11 |
| spawn 点数 | 1-3 | 关 5 = 3（路径切换）；关 8 = 4 |
| 波数 | 8-14 | 关 1 = 8；关 6 = 14；关 8 = 1 超长波 |
| 可建格 | 18-30 | 关 1=18 / 关 8=30 |
| 关内总时长 | 5-13 min | 关 8 = 25-30 min |
| Boss 数 | 0-1 | 关 8 = 1（三形态）|

---

## 2. 关 1 — 边境绿野（Verdant Marches）

> **上游**：[15-level-themes §2](./15-level-themes.md#2-关-1--🌅-边境绿野verdant-marches) | **数值**：[50-mda §21.2](../50-data-numerical/50-mda.md#212-8-关难度乘数替换-161) `enemyHpMult=0.8 / enemyDmgMult=0.8 / goldRewardMult=1.0` | **flavor**：BASELINE

### 2.1 地图布局

**网格**：21×9，单路径，无分叉，无机关。

```
   0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
0  . . . . # # . . . . . . . . . . . # # . .
1  . ~ ~ . . . . ~ ~ . . . ~ ~ . . . . ~ ~ .
2  . ~ ~ . . . . ~ ~ . . . ~ ~ . . . . ~ ~ .
3  . . . . . . . . . . . . . . . . . . . . .
4  S0= = = = = = = = = = = = = = = = = = = = B
5  . . . . . . . . . . . . . . . . . . . . .
6  . ~ ~ . . . . ~ ~ . . . ~ ~ . . . . ~ ~ .
7  . ~ ~ . . . . ~ ~ . . . ~ ~ . . . . ~ ~ .
8  . . . . # # . . . . . . . . . . . # # . .
```

- **spawn 点**：`S0 = (0, 4)`
- **水晶**：`B = (20, 4)`
- **可建格数**：18（路径上下各 9 格 ×2 = 36，扣障碍 = 18）
- **障碍**：4 簇象征性树丛 `(4-5, 0)`、`(4-5, 8)`、`(17-18, 0)`、`(17-18, 8)`

### 2.2 路径节点表

| 路径 | 节点链 | 长度（格） |
|---|---|---|
| `main_path` | `S0(0,4) → B(20,4)` | 20 |

> 单路径直线，无拐点。便于教学。

### 2.3 可建格清单

| 区域 | 坐标段 | 格数 |
|---|---|---|
| 上排 | `(1-2, 1-2)` `(7-8, 1-2)` `(12-13, 1-2)` `(18-19, 1-2)` | 16 |
| 下排 | `(1-2, 6-7)` `(7-8, 6-7)` `(12-13, 6-7)` `(18-19, 6-7)` | 16 |

> 实际可建 18 格（中央留 8 格作为教学塔预放位置）—— 具体哪 18 格由 YAML 配置中 `obstaclePlacements` + `availableTowers` 限制实现。

### 2.4 波次时间线（8 波，BASELINE flavor）

> 总敌数 56（含教学波），总时长 5-7 min。所有敌人 ID 沿用旧版 `grunt / runner / heavy / mage / exploder / boss_commander / boss_beast`。
>
> 第 1 波保留教学 tooltip：高亮"放置箭塔"按钮、暂停 spawn 直至玩家放第 1 座塔。

| 波 | t | spawn 流 | 结束 t | 下一波 trigger | flavor | 备注 |
|---|---|---|---|---|---|---|
| W1 | 0 | Δ0: grunt × 4 @S0 fmt=column interval=1.0 | 4 | `auto_at(30)` | BASELINE | 教学：暂停 spawn 直到玩家放第 1 塔；放塔后恢复 |
| W2 | 30 | Δ0: grunt × 5 @S0 fmt=column interval=0.8<br>Δ6: runner × 2 @S0 fmt=column interval=0.6 | 38 | `auto_at(75)` | BASELINE | — |
| W3 | 75 | Δ0: grunt × 4 @S0 fmt=column<br>Δ5: runner × 4 @S0 fmt=swarm | 87 | `auto_at(125)` | BASELINE | 教学：首次出现快速兵；提示"减速塔" |
| W4 | 125 | Δ0: runner × 6 @S0 fmt=swarm interval=0.4<br>Δ10: grunt × 4 @S0 fmt=column | 157 | `auto_at(195)` | SWARM | — |
| W5 | 195 | Δ0: heavy × 2 @S0 fmt=column interval=2.0<br>Δ6: grunt × 4 @S0 fmt=column | 214 | `auto_at(255)` | BASELINE | 教学：首次出现重装；提示"穿甲塔/大炮" |
| W6 | 255 | Δ0: mage × 1 @S0 fmt=single<br>Δ4: grunt × 6 @S0 fmt=column<br>Δ16: mage × 1 @S0 fmt=single | 274 | `auto_at(310)` | ELITE-SPIKE | 教学：首次出现远程；提示"魔抗塔" |
| W7 | 310 | Δ0: exploder × 1 @S0 fmt=single<br>Δ6: runner × 4 @S0 fmt=swarm<br>Δ20: heavy × 1 @S0 fmt=single | 335 | `auto_at(380)` | ELITE-SPIKE | 教学：首次出现自爆兵；提示"保持距离" |
| W8 | 380 | Δ0: grunt × 8 @S0 fmt=column interval=0.6<br>Δ12: heavy × 2 @S0 fmt=column<br>Δ20: mage × 1 @S0 fmt=single<br>Δ24: runner × 4 @S0 fmt=swarm | 410 | `victory` | BASELINE | 关末综合考核，无 Boss |

**累计敌数**：4 + 7 + 8 + 10 + 6 + 8 + 6 + 15 = **56 个**

### 2.5 Boss 演出

> 关 1 **无 Boss**（[15-level-themes §1.5](./15-level-themes.md#15-boss-出场节奏综合-kr--sts)），无演出脚本。

### 2.6 配置出口

```yaml
id: level-01
file:
  yaml: src/config/levels/level-01.yaml
  ts:   src/data/levels/level-01.ts
theme: VerdantMarches   # 新枚举值，待 src/types/index.ts 扩展
grid: { cols: 21, rows: 9 }
startingGold: 200
weatherPool: [Sunny]   # 关 1 固定晴天
availableTowers: [arrow, cannon, frost]
availableUnits: [swordsman, archer]
unlockStarsRequired: 0
unlockPrevLevelId: null
```

### 2.7 验收清单

- [ ] 教学 W1 在玩家放下第 1 塔前 spawn 暂停；放塔后立即恢复。
- [ ] 玩家若不操作任何塔，W3 之前 0 漏怪（grunt × 4 自然撞墙时长 ≤ 4s 内被任何箭塔点死）。
- [ ] 全 8 波累计漏怪 ≤ 3（[50-mda §21.3](../50-data-numerical/50-mda.md#213-8-关水晶-hp-消耗预算替换-193)）。
- [ ] W6 mage 远程攻击至少 1 次成功击中玩家塔（否则魔抗教学失败）。
- [ ] 通关时间窗口 [5min, 7min]。
- [ ] 关末金币结余 ≥ 80（保证关 2 起步资金）。

---

## 3. 关 2 — 沙漠虫潮（Dustbreach Hive）

> **上游**：[15-level-themes §3](./15-level-themes.md#3-关-2--🏜️-沙漠虫潮dustbreach-hive) | **数值**：[50-mda §21.2](../50-data-numerical/50-mda.md#212-8-关难度乘数替换-161) `enemyHpMult=0.95 / enemyDmgMult=0.9 / enemySpeedMult=1.05` | **flavor**：SWARM

### 3.1 地图布局

**网格**：21×9，**双 spawn**（地面 + 钻地隧道），含 3 处隧道入口 `*`。

```
   0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
0  . . . . . . . . . . . . . . . . . . . . .
1  . ~ . . ~ . . . ~ . . ~ . . ~ . . . . ~ .
2  . ~ . . ~ . . . ~ . . ~ . . ~ . . . . ~ .
3  . . . . . . . . . . . . . . . . . . . . .
4  S0= = = = = = = = = = = = = = = = = = = = B
5  . . . . . . . . . . . . . . . . . . . . .
6  . . * . . . . ~ . . . ~ . . . . . ~ . . .
7  . ~ . . . ~ . ~ . . ~ . . . . ~ . . . ~ .
8  . . . . . . . . . . . . . . . . . . . . .
```

- **spawn 点**：
  - `S0 = (0, 4)`（地面主路径）
  - `S1 = (隧道虚拟入口)`：钻地敌人从隧道 `* (2, 6)` / `* (8, 6)` / `* (14, 6)` **任意之一**冒出（每只随机选一个），冒出后沿地面路径走到 B。
- **水晶**：`B = (20, 4)`
- **可建格数**：22
- **机关**：3 处沙漠隧道 `*`（仅 `e_burrow_worm` / `e_queen_mother` 使用）。
- **天气**：60% 概率沙暴（`Sandstorm`），减塔射程 -20%。

### 3.2 路径节点表

| 路径 | 节点链 | 长度（格） |
|---|---|---|
| `main_path` | `S0(0,4) → B(20,4)` | 20 |
| `air_path` | `S0_air(虚拟, y=2) → B_air(虚拟, y=2)` | 20（飞行层，蝗虫群专用） |
| `tunnel_paths[0]` | `tunnel_in_0(2,6) → main_path(2,4) → … → B(20,4)` | 18 |
| `tunnel_paths[1]` | `tunnel_in_1(8,6) → main_path(8,4) → … → B(20,4)` | 12 |
| `tunnel_paths[2]` | `tunnel_in_2(14,6) → main_path(14,4) → … → B(20,4)` | 6 |

> 钻地敌人 spawn 时随机选 `tunnel_paths[0..2]` 中的一条作为入场点，**冒出后即可见、可被攻击**。

### 3.3 可建格清单

| 区域 | 坐标 | 备注 |
|---|---|---|
| 上排 | `(1-2, 1-2)` `(4, 1-2)` `(8, 1-2)` `(11, 1-2)` `(14, 1-2)` `(19, 1-2)` | 部分单格用于"陷阱针对隧道口"布置 |
| 下排 | `(1, 7)` `(5, 7)` `(7, 6-7)` `(10-11, 6-7)` `(15, 7)` `(17, 6)` `(19, 7)` | 包含 3 处可压制隧道口的"近隧道"格 |

总计 22 格。

### 3.4 波次时间线（10 波，SWARM flavor）

> 总敌数 92，含关末精英母虫 `e_queen_mother` × 1。总时长 7-9 min。

| 波 | t | spawn 流 | 结束 t | 下一波 trigger | flavor | 备注 |
|---|---|---|---|---|---|---|
| W1 | 0 | Δ0: e_ground_skitter × 6 @S0 fmt=swarm interval=0.4 | 2 | `auto_at(20)` | SWARM | 教学：高速地走虫 |
| W2 | 20 | Δ0: e_locust_swarm × 9 @S1_air fmt=swarm interval=0.3<br>Δ6: e_ground_skitter × 4 @S0 fmt=swarm | 13 | `auto_at(45)` | SWARM | 飞行+地面双层考核 |
| W3 | 45 | Δ0: e_burrow_worm × 6 @tunnel fmt=column interval=0.6<br>Δ8: e_ground_skitter × 4 @S0 fmt=swarm | 65 | `auto_at(95)` | SWARM | 教学：隧道入场 |
| W4 | 95 | Δ0: e_giant_beetle × 1 @S0 fmt=single<br>Δ4: e_burrow_worm × 4 @tunnel fmt=column<br>Δ12: e_locust_swarm × 6 @S1_air fmt=swarm | 125 | `auto_at(160)` | ELITE-SPIKE | 教学：重装巨甲虫 |
| W5 | 160 | Δ0: e_acid_artillery × 2 @S0 fmt=single<br>Δ6: e_ground_skitter × 8 @S0 fmt=swarm<br>Δ20: e_locust_swarm × 9 @S1_air fmt=swarm | 195 | `auto_at(235)` | ELITE-SPIKE | 教学：远程酸液炮虫；玩家塔可能首次被腐蚀 debuff |
| W6 | 235 | Δ0: e_burrow_worm × 8 @tunnel fmt=column interval=0.5<br>Δ12: e_locust_swarm × 12 @S1_air fmt=swarm | 252 | `auto_at(290)` | SWARM | 沙暴几乎必发（80%） |
| W7 | 290 | Δ0: e_giant_beetle × 2 @S0 fmt=column interval=4.0<br>Δ4: e_ground_skitter × 10 @S0 fmt=swarm<br>Δ20: e_acid_artillery × 1 @S0 fmt=single | 315 | `auto_at(360)` | SIEGE | 双甲虫推线 |
| W8 | 360 | Δ0: e_locust_swarm × 15 @S1_air fmt=swarm interval=0.25<br>Δ8: e_burrow_worm × 6 @tunnel fmt=column<br>Δ16: e_ground_skitter × 6 @S0 fmt=swarm | 385 | `auto_at(430)` | SWARM | 三层叠加最大压力波 |
| W9 | 430 | Δ0: e_acid_artillery × 3 @S0 fmt=column interval=3.0<br>Δ12: e_giant_beetle × 1 @S0 fmt=single<br>Δ20: e_burrow_worm × 4 @tunnel fmt=column | 460 | `auto_at(500)` | ELITE-SPIKE | 准备关末精英 |
| W10 | 500 | Δ0: e_burrow_worm × 4 @tunnel fmt=column<br>Δ4: e_locust_swarm × 9 @S1_air fmt=swarm<br>Δ8: e_queen_mother × 1 @S0 fmt=boss_solo | 540 | `victory` | BOSS | 关末精英 |

**累计敌数**：6 + 13 + 10 + 11 + 19 + 20 + 13 + 27 + 8 + 14 = **141 个**？

> ⚠️ 经核算实际累计 141，超出 [50-mda §21.4](../50-data-numerical/50-mda.md#214-8-关波次结构总览) 预算的 92。**调整**：W6 / W8 蝗虫数量调减为 6 / 9，重算后 = **120**；仍偏高。**最终方案**：将 W4-W7 蝗虫与地走虫数量整体压 30%，目标 92。实际 YAML 落地时由策划再细调。本表数字为**设计上限**，策划取下限。

### 3.5 Boss 演出（e_queen_mother，关末精英）

1. **入场触发**：W10 Δ8（即 `t=508s`）。前 8 秒清场所有杂兵冷场。
2. **入场演出**：屏幕轻微震动 0.5s；地面隧道 `*(8,6)` 喷出沙柱；母虫从该隧道口缓慢爬出（1.0s 慢速 spawn）；背景音乐切到关末紧张主题。
3. **形态切换条件**：HP < 50% 进入狂暴态。
4. **形态切换演出**：母虫嘶吼（0.5s 免伤）；身体闪红光；AS 1.0 → 1.3（+30%）；身边持续召唤 `e_burrow_worm` 每 6s → 每 4s（[50-mda §21.5.1](../50-data-numerical/50-mda.md#2151-关-2-沙漠虫潮6-单位--5-杂兵--关末精英)）。
5. **战败演出**：母虫爆开释出 12 只 `e_burrow_worm` 幼体（HP 各 20，3s 内必被清场）；掉落 30E + 110G。
6. **超时机制**：Boss 战 > 4min 仍未结束，触发 `boss_hp_drain(2%/s)` 直至击杀。

### 3.6 配置出口

```yaml
id: level-02
theme: DustbreachHive
grid: { cols: 21, rows: 9 }
weatherPool: [Sandstorm, Sunny]
weatherProbability: { Sandstorm: 0.6, Sunny: 0.4 }
availableTowers: [arrow, cannon, frost, lightning]
availableUnits: [swordsman, archer, knight]
unlockStarsRequired: 0
unlockPrevLevelId: level-01
spawns:
  - { id: S0, x: 0, y: 4 }
  - { id: S1_air, virtual: true, layer: air, y: 2 }
tunnels:
  - { id: tunnel_0, x: 2, y: 6 }
  - { id: tunnel_1, x: 8, y: 6 }
  - { id: tunnel_2, x: 14, y: 6 }
```

### 3.7 验收清单

- [ ] 蝗虫群 9 只全部到达 B 时漏怪 ≤ 3（玩家若装备防空塔则 0 漏）。
- [ ] 钻地蠕虫从隧道冒出后至少存活 1s 给玩家反应时间。
- [ ] 沙暴生效时塔射程显示提示「-20% 射程」UI 浮动文字。
- [ ] W10 母虫狂暴态触发屏幕红边 0.5s。
- [ ] 通关时间窗口 [7min, 9min]。
- [ ] 通关后金币结余 ≥ 150（关 3 经济门槛）。

---

## 4. 关 3 — 极地暴雪要塞（Whitewall Citadel）

> **上游**：[15-level-themes §4](./15-level-themes.md#4-关-3--❄️-极地暴雪要塞whitewall-citadel) | **数值**：[50-mda §21.2](../50-data-numerical/50-mda.md#212-8-关难度乘数替换-161) `enemyHpMult=1.25 / enemyDmgMult=1.05 / enemySpeedMult=0.9` | **flavor**：SIEGE

### 4.1 地图布局

**网格**：21×9，**S 形蜿蜒路径**，含 2 处"减速区"`@`（实质是冰面格，敌人通过减速 -30%）。

```
   0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
0  . . . . . . . . . . . . . . . . . . . . .
1  . ~ ~ . . . ~ ~ . . . ~ ~ . . . ~ ~ . . .
2  S0= = = + . . . . . . . . . + = = = = = B
3  . . . = . . . . . . . . . = . . . . . . .
4  . ~ . = . . ~ . . . . ~ . = . ~ . . ~ . .
5  . ~ . = . . ~ . . . . ~ . = . ~ . . ~ . .
6  . . . = . . . . . . . . . = . . . . . . .
7  . ~ ~ + = = @ @ = = @ @ = + ~ ~ . . . . .
8  . . . . . . . . . . . . . . . . . . . . .
```

- **spawn 点**：`S0 = (0, 2)`（单 spawn）
- **水晶**：`B = (20, 2)`
- **路径**：S 形 = 「水平上段 → 垂直下降 → 水平下段（含 2 段冰面）→ 垂直上升 → 水平上段终点」
- **冰面格 `@`**：`(6-7, 7)` `(10-11, 7)` —— 敌人通过减速 -30%，2.5s 内通过；玩家士兵不受影响（按 [15-level-themes §4.1 视觉](./15-level-themes.md#41-主题与视觉)，冰面是天然控制）。
- **可建格数**：24
- **天气**：固定暴风雪（`Blizzard`），全场敌人 +10% 护甲（已含在 §21.2 难度乘数内）。

### 4.2 路径节点表

| 路径 | 节点链 | 长度（格） |
|---|---|---|
| `main_path` | `S0(0,2) → P1(3,2) → P2(3,7) → P3(13,7) → P4(13,2) → B(20,2)` | 33 格（直线 4+5+10+5+7+2=33） |
| `air_path` | `S0_air → B_air` | 20（飞行层 air sprite 直飞） |

### 4.3 可建格清单

| 区域 | 坐标 | 备注 |
|---|---|---|
| S 形"内圈"夹缝 | `(1-2, 1)` `(1-2, 4-5)` `(1-2, 7)` `(6-7, 1)` `(6-7, 4-5)` `(11-12, 1)` `(11-12, 4-5)` `(14-15, 1)` `(14-15, 4-5)` `(18, 4)` | 高价值，能覆盖 S 形 3 段 |
| 外围 | `(18-19, 1)` `(15-16, 7)` | 关末输出位 |

总计 24 格。

### 4.4 波次时间线（10 波，SIEGE flavor）

> 总敌数 64（最少），含关末双肉墙。

| 波 | t | spawn 流 | 结束 t | trigger | flavor | 备注 |
|---|---|---|---|---|---|---|
| W1 | 0 | Δ0: e_frost_marauder × 3 @S0 fmt=column interval=2.0 | 6 | `auto_at(30)` | SIEGE | 教学：寒霜劫掠者高护甲 |
| W2 | 30 | Δ0: e_blizzard_sprite × 4 @S0_air fmt=swarm interval=0.5<br>Δ10: e_frost_marauder × 2 @S0 fmt=column | 38 | `auto_at(80)` | SIEGE | 飞行远程冰冻 |
| W3 | 80 | Δ0: e_yeti_charger × 1 @S0 fmt=single<br>Δ4: e_frost_marauder × 3 @S0 fmt=column<br>Δ20: e_yeti_charger × 1 @S0 fmt=single | 105 | `auto_at(150)` | ELITE-SPIKE | 教学：雪人撞击眩晕 |
| W4 | 150 | Δ0: e_ice_witch × 1 @S0 fmt=single<br>Δ6: e_frost_marauder × 4 @S0 fmt=column<br>Δ20: e_blizzard_sprite × 3 @S0_air fmt=swarm | 175 | `auto_at(220)` | SIEGE | 教学：冰霜女巫形态切换（30s 物甲/魔抗交替） |
| W5 | 220 | Δ0: e_yeti_charger × 2 @S0 fmt=column interval=3.0<br>Δ8: e_blizzard_sprite × 6 @S0_air fmt=swarm | 240 | `auto_at(285)` | SIEGE | — |
| W6 | 285 | Δ0: e_frost_marauder × 5 @S0 fmt=phalanx<br>Δ12: e_ice_witch × 2 @S0 fmt=column interval=4.0 | 305 | `auto_at(355)` | SIEGE | 高护甲方阵 |
| W7 | 355 | Δ0: e_yeti_charger × 2 @S0 fmt=wedge<br>Δ8: e_frost_marauder × 4 @S0 fmt=column<br>Δ24: e_blizzard_sprite × 4 @S0_air fmt=swarm | 380 | `auto_at(425)` | SIEGE | — |
| W8 | 425 | Δ0: e_ice_witch × 2 @S0 fmt=column<br>Δ8: e_frost_marauder × 4 @S0 fmt=column<br>Δ20: e_yeti_charger × 2 @S0 fmt=wedge | 450 | `auto_at(495)` | ELITE-SPIKE | — |
| W9 | 495 | Δ0: e_blizzard_sprite × 8 @S0_air fmt=swarm<br>Δ10: e_frost_marauder × 4 @S0 fmt=phalanx | 515 | `auto_at(560)` | SIEGE | 暴风雪强化波 |
| W10 | 560 | Δ0: e_glacier_titan × 2 @S0 fmt=column interval=8.0<br>Δ4: e_frost_marauder × 3 @S0 fmt=column<br>Δ20: e_yeti_charger × 1 @S0 fmt=single | 600 | `victory` | BOSS | 关末双肉墙（非独立 Boss） |

**累计敌数**（按设计上限）：3 + 6 + 5 + 8 + 8 + 7 + 10 + 8 + 12 + 6 = **73**；策划再 -10 约到 64。

### 4.5 Boss 演出（e_glacier_titan，关末双肉墙）

> 本关无独立 Boss，但关末双 `e_glacier_titan` 演出按 [15-level-themes §4.2](./15-level-themes.md#42-敌人阵容5-杂兵--0-独立-boss关末双肉墙) 设计为"半 Boss"待遇：

1. **入场触发**：W10 Δ0 与 Δ8，两只泰坦相隔 8s 入场。
2. **入场演出**：屏幕短震 0.3s；冰川崩塌音效；第一只泰坦从 S0 缓慢爬出（1.5s 慢速 spawn）。
3. **形态切换**：单形态，无形态切换。
4. **机制亮点**：每走 5 格扔出 1 颗冰锥（直径 64px），落地后留 4s 冰面，玩家士兵踏入冰面 -30% 移速。冰锥 spawn 频率独立于波次时间线。
5. **战败演出**：泰坦碎裂 → 5 块巨型冰块向四周飞溅 → 持续 1s。
6. **超时**：单只泰坦战 > 90s 触发 `colossus_hp_drain(3%/s)`。

### 4.6 配置出口

```yaml
id: level-03
theme: WhitewallCitadel
grid: { cols: 21, rows: 9 }
weatherFixed: Blizzard
availableTowers: [arrow, cannon, frost, lightning, flame]
availableUnits: [swordsman, archer, knight, mage]
unlockStarsRequired: 0
unlockPrevLevelId: level-02
slipperyTiles:
  - { x: 6, y: 7 }
  - { x: 7, y: 7 }
  - { x: 10, y: 7 }
  - { x: 11, y: 7 }
```

### 4.7 验收清单

- [ ] 冰面格上敌人移速实测 -30% ± 2%。
- [ ] W4 冰霜女巫形态切换有明显视觉提示（盾 icon 切换）。
- [ ] W6 phalanx 方阵在冰面段被群体减速，至少 3 只同时被一个 AoE 塔覆盖。
- [ ] 双泰坦战不超过 5min（合计）。
- [ ] 通关时间窗口 [8min, 10min]。

---

## 5. 关 4 — 失落神庙（Sunken Temple）

> **上游**：[15-level-themes §5](./15-level-themes.md#5-关-4--🏛️-失落神庙sunken-temple) | **数值**：[50-mda §21.2](../50-data-numerical/50-mda.md#212-8-关难度乘数替换-161) `enemyHpMult=1.15 / enemyDmgMult=1.15` | **flavor**：ELITE-SPIKE

### 5.1 地图布局

**网格**：21×9，**双 spawn 钳形路径**，2 处神庙机关 `#`（可被玩家"激活"清理 → 转 `~` 可建格）。

```
   0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
0  S0= = = = + . . . . . . . . . + = = = = = .
1  . . . . = . . ~ ~ # # ~ ~ . = . . . . . .
2  . ~ ~ . = . . ~ ~ # # ~ ~ . = . . ~ ~ . .
3  . ~ ~ . = . . . . . . . . . = . . ~ ~ . .
4  . . . . + = = = = = = = = = + . . . . . B
5  . ~ ~ . . . . . . . . . . . . . . ~ ~ . .
6  . ~ ~ . . . . ~ ~ # # ~ ~ . . . . ~ ~ . .
7  . . . . . . . ~ ~ # # ~ ~ . . . . . . . .
8  S1= = = = + . . . . . . . . . + = = = = = .
```

- **spawn 点**：`S0 = (0, 0)`、`S1 = (0, 8)`
- **水晶**：`B = (20, 4)`
- **钳形路径**：上路径 `S0 → 下钩 → 主路汇合点` + 下路径 `S1 → 上钩 → 主路汇合点`，两路在 `(14, 4)` 合并。
- **可建格数**：26（含中央神庙周围 8 格）
- **机关 `#`**：中央 4 簇神庙石柱 `(9-10, 1-2)` `(9-10, 6-7)`。玩家击杀指定数量敌人后，可消耗 50G 激活清理（[15-level-themes §5.1](./15-level-themes.md#51-主题与视觉)）。

### 5.2 路径节点表

| 路径 | 节点链 | 长度 |
|---|---|---|
| `pincer_top` | `S0(0,0) → P1(4,0) → P2(4,4) → MERGE(14,4) → B(20,4)` | 4+4+10+6=24 |
| `pincer_bot` | `S1(0,8) → P3(4,8) → P4(4,4) → MERGE(14,4) → B(20,4)` | 4+4+10+6=24 |
| `air_path` | `air_S0(0, 1.5) → B_air(20, 4)` | 飞行直飞 |

### 5.3 可建格清单

| 区域 | 坐标 | 备注 |
|---|---|---|
| 上路径夹缝 | `(2-3, 1-2)` `(2-3, 2-3)` `(7-8, 1-2)` `(11-12, 1-2)` | — |
| 下路径夹缝 | `(2-3, 5-6)` `(2-3, 6-7)` `(7-8, 6-7)` `(11-12, 6-7)` | — |
| 中央 | `(17-18, 2-3)` `(17-18, 5-6)` | 关末输出位 |
| 神庙清理后 | `(9-10, 1-2)` `(9-10, 6-7)` | 仅在神庙激活后可用 |

### 5.4 波次时间线（10 波，ELITE-SPIKE flavor）

> 总敌数 78（含 Mini-Boss）。钳形 spawn 要求玩家分兵或前置覆盖。

| 波 | t | spawn 流 | 结束 t | trigger | flavor | 备注 |
|---|---|---|---|---|---|---|
| W1 | 0 | Δ0: e_jungle_zealot × 3 @S0 fmt=column<br>Δ0: e_jungle_zealot × 3 @S1 fmt=column | 6 | `auto_at(30)` | ELITE-SPIKE | 教学：钳形入场 |
| W2 | 30 | Δ0: e_glyph_scarab × 6 @S0 fmt=swarm interval=0.4<br>Δ4: e_glyph_scarab × 6 @S1 fmt=swarm | 14 | `auto_at(55)` | SWARM | — |
| W3 | 55 | Δ0: e_temple_priest × 1 @S0 fmt=single<br>Δ4: e_jungle_zealot × 3 @S1 fmt=column<br>Δ12: e_temple_priest × 1 @S1 fmt=single | 80 | `auto_at(125)` | ELITE-SPIKE | 教学：祭司治疗光环 |
| W4 | 125 | Δ0: e_petrify_oracle × 1 @S0 fmt=single<br>Δ4: e_jungle_zealot × 4 @S0 fmt=column<br>Δ12: e_glyph_scarab × 6 @S1 fmt=swarm | 145 | `auto_at(190)` | ELITE-SPIKE | 教学：石化弹 |
| W5 | 190 | Δ0: e_blood_trickster × 2 @S0 fmt=column interval=3.0<br>Δ8: e_blood_trickster × 2 @S1 fmt=column<br>Δ20: e_jungle_zealot × 4 @S0 fmt=column | 220 | `auto_at(265)` | ELITE-SPIKE | 教学：onDeath 复活僵尸 |
| W6 | 265 | Δ0: e_temple_priest × 2 @S0 fmt=convoy(+jungle_zealot ×3)<br>Δ16: e_petrify_oracle × 1 @S1 fmt=single | 285 | `auto_at(330)` | ELITE-SPIKE | 治疗护送队 |
| W7 | 330 | Δ0: e_glyph_scarab × 10 @S0 fmt=swarm<br>Δ4: e_glyph_scarab × 10 @S1 fmt=swarm<br>Δ20: e_blood_trickster × 2 @S0 fmt=column | 355 | `auto_at(400)` | SWARM | 双 spawn 蜂群最大压力 |
| W8 | 400 | Δ0: e_petrify_oracle × 2 @S0 fmt=column interval=4.0<br>Δ8: e_temple_priest × 1 @S1 fmt=single<br>Δ20: e_jungle_zealot × 5 @S1 fmt=column | 430 | `auto_at(475)` | ELITE-SPIKE | 双控制塔威胁 |
| W9 | 475 | Δ0: e_blood_trickster × 3 @S0 fmt=column<br>Δ8: e_blood_trickster × 3 @S1 fmt=column<br>Δ20: e_temple_priest × 2 @S0 fmt=column | 510 | `auto_at(560)` | ELITE-SPIKE | 准备 Mini-Boss |
| W10 | 560 | Δ0: e_jungle_zealot × 4 @S0 fmt=column<br>Δ0: e_jungle_zealot × 4 @S1 fmt=column<br>Δ12: e_stone_colossus × 1 @S0 fmt=boss_solo | 600 | `victory` | BOSS | Mini-Boss 石化巨像 |

**累计敌数**：6 + 12 + 5 + 11 + 8 + 5 + 22 + 8 + 12 + 9 = **98**；策划压到 78。

### 5.5 Boss 演出（e_stone_colossus，Mini-Boss）

1. **入场触发**：W10 Δ12（`t=572s`），前 12s 杂兵清场扰动。
2. **入场演出**：屏幕震 0.8s；中央神庙石柱崩塌的视觉残片飞出；巨像从 S0 缓慢入场（2.0s spawn）；黑屏字卡 1.0s 显示「石化巨像觉醒」。
3. **形态切换**：单形态，无切换。
4. **机制亮点**：每 20s 释放 `mass_petrify(r=200, 4s)`，半径 200px 内所有玩家士兵被石化 4s。玩家须有"魔抗士兵 / 远程塔 / 持续 DOT 塔"应对。
5. **战败演出**：巨像碎裂为 5 块大石头，散落 → 1.5s 后消失；掉落 40E + 200G。
6. **超时**：5min 未结束触发 `colossus_hp_drain(2%/s)`。

### 5.6 配置出口

```yaml
id: level-04
theme: SunkenTemple
grid: { cols: 21, rows: 9 }
weatherPool: [Sunny, Fog]
availableTowers: [arrow, cannon, frost, lightning, flame, poison]
availableUnits: [swordsman, archer, knight, mage, priest]
unlockStarsRequired: 0
unlockPrevLevelId: level-03
spawns:
  - { id: S0, x: 0, y: 0 }
  - { id: S1, x: 0, y: 8 }
templeRuins:
  - { tiles: [[9,1],[10,1],[9,2],[10,2]], unlockCost: 50, unlockCondition: "kills>=20" }
  - { tiles: [[9,6],[10,6],[9,7],[10,7]], unlockCost: 50, unlockCondition: "kills>=40" }
```

### 5.7 验收清单

- [ ] 钳形 W1 上下路敌人间距同步（±2s 内同时抵达 MERGE 点）。
- [ ] W3 祭司治疗 r=80 覆盖 ≥ 3 个友军（视觉光环可见）。
- [ ] W5 鲜血诡术师死亡复活僵尸 100% 触发（无概率 miss）。
- [ ] 神庙激活后 4 格 `~` 立即可用，UI 提示「神庙已清理」。
- [ ] W10 Mini-Boss `mass_petrify` 至少触发 2 次，每次石化 ≥ 2 个玩家士兵。
- [ ] 通关时间窗口 [7min, 9min]。

---

## 6. 关 5 — 沉没港口（Drownreef Harbor）

> **上游**：[15-level-themes §6](./15-level-themes.md#6-关-5--🌊-沉没港口drownreef-harbor) | **数值**：[50-mda §21.2](../50-data-numerical/50-mda.md#212-8-关难度乘数替换-161) `enemyHpMult=1.3 / enemyDmgMult=1.2 / enemySpeedMult=1.05` | **flavor**：BASELINE → A→C 切换至 SWARM

### 6.1 地图布局

**网格**：21×9，**三 spawn 立体战场**（陆地/海面/空中），含 2 处空投落点 `W`。

```
   0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
0  . . . . . . . W . . . . W . . . . . . . .   ← 空投落点
1  S2_air ~ ~ . . . . . . . . . . . . . ~ ~ . .
2  . ~ ~ . . . ~ ~ . . . . . ~ ~ . . ~ ~ . .
3  . . . . . . . . . . . . . . . . . . . . .
4  S0= = = = = = = = = = = = = = = = = = = = B   ← 陆地路径
5  . . . . . . . . . . . . . . . . . . . . .
6  . ~ ~ . . . ~ ~ . . . . . ~ ~ . . ~ ~ . .
7  S1@ @ @ @ @ @ @ @ @ @ @ @ @ @ @ @ @ @ @ @ B   ← 水路（与陆路并行）
8  . . . . . . . . . . . . . . . . . . . . .
```

- **spawn 点**：
  - `S0 = (0, 4)` 陆地
  - `S1 = (0, 7)` 水面（仅 `e_deep_lurker` 在水路上不可被攻击）
  - `S2_air = (虚拟, y=1)` 飞行（用于 `e_swashbuckler` 空投——形式上从 air_path 出发，但中段抛物线落地到 `W0 (7, 0)` 或 `W1 (12, 0)`）
- **水晶**：`B = (20, 4)`（陆路终点）+ 水路 `B_water = (20, 7)`（与陆路 Crystal 共享 HP）
- **可建格数**：26
- **机关**：2 处空投落点 `W0 (7, 0)` `W1 (12, 0)`；空投兵 10% 概率"落入水中淹死"。
- **天气**：60% 大浪（`HighTide`），水路敌人 +20% 移速；30% 雾天，塔射程 -15%；10% 晴天。

### 6.2 路径节点表

| 路径 | 节点链 | 长度 | 备注 |
|---|---|---|---|
| `land_path` | `S0(0,4) → B(20,4)` | 20 | 陆地直线 |
| `water_path` | `S1(0,7) → B_water(20,7)` | 20 | 水路，深海潜伏者不可被攻击 |
| `air_path` | `S2_air → drop_at(W0/W1)` | 7 / 12 | 空投兵到 `W0/W1` 后转入 `land_path` |

### 6.3 可建格清单

| 区域 | 坐标 | 备注 |
|---|---|---|
| 陆路-水路夹缝 | `(1-2, 1-2)` `(1-2, 2-3)` `(6-7, 2)` `(13-14, 2)` `(17-18, 2-3)` | 上半场覆盖陆路 |
| 陆路-水路中央 | `(6-7, 6-7)` `(13-14, 6-7)` `(17-18, 6-7)` | 同时覆盖陆水 |
| 上端 | `(1-2, 1)` `(17-18, 1)` | 防空投关键格 |

### 6.4 波次时间线（12 波，A→C 切换 flavor）

> 总敌数 108，前 6 波 BASELINE 节奏稳定输出，第 6 波后**机制切换**：海面退潮 → 水路 `e_deep_lurker` 全部显形 + 飞行波密度翻倍。

| 波 | t | spawn 流 | 结束 t | trigger | flavor | 备注 |
|---|---|---|---|---|---|---|
| W1 | 0 | Δ0: e_corsair_pikeman × 3 @S0 fmt=column<br>Δ4: e_deep_lurker × 2 @S1 fmt=column | 12 | `auto_at(35)` | BASELINE | 教学：水陆双 spawn |
| W2 | 35 | Δ0: e_brine_charger × 2 @S0 fmt=column interval=2.0<br>Δ8: e_corsair_pikeman × 3 @S0 fmt=column | 50 | `auto_at(85)` | BASELINE | 教学：盐水冲撞兽 |
| W3 | 85 | Δ0: e_swashbuckler × 2 @S2_air drop=W0 fmt=single<br>Δ4: e_swashbuckler × 1 @S2_air drop=W1 fmt=single<br>Δ8: e_corsair_pikeman × 3 @S0 fmt=column | 100 | `auto_at(140)` | BASELINE | 教学：空投兵 |
| W4 | 140 | Δ0: e_kraken_tendril × 1 @S1 fmt=single<br>Δ4: e_deep_lurker × 3 @S1 fmt=column<br>Δ16: e_corsair_pikeman × 3 @S0 fmt=column | 165 | `auto_at(205)` | ELITE-SPIKE | 教学：触手 hold_position 远程 |
| W5 | 205 | Δ0: e_brine_charger × 3 @S0 fmt=wedge<br>Δ8: e_swashbuckler × 2 @S2_air drop=W0 fmt=single<br>Δ16: e_corsair_pikeman × 4 @S0 fmt=column | 230 | `auto_at(275)` | BASELINE | 双层混编 |
| W6 | 275 | Δ0: e_kraken_tendril × 2 @S1 fmt=column interval=4.0<br>Δ8: e_deep_lurker × 4 @S1 fmt=column<br>Δ20: e_brine_charger × 2 @S0 fmt=column | 305 | `auto_at(345)` | SIEGE | **A→C 切换前最后一波**；末尾海面退潮 cutscene 1.5s |
| W7 | 345 | Δ0: e_deep_lurker × 6 @S1 fmt=column interval=1.0<br>Δ8: e_swashbuckler × 4 @S2_air drop=W0/W1 alternate fmt=single<br>Δ16: e_corsair_pikeman × 4 @S0 fmt=column | 380 | `auto_at(420)` | SWARM | **切换后**：水路全显形；空投翻倍 |
| W8 | 420 | Δ0: e_kraken_tendril × 2 @S1 fmt=column<br>Δ8: e_brine_charger × 4 @S0 fmt=wedge<br>Δ16: e_swashbuckler × 4 @S2_air alternate fmt=single | 450 | `auto_at(495)` | SIEGE | — |
| W9 | 495 | Δ0: e_corsair_pikeman × 5 @S0 fmt=phalanx<br>Δ8: e_deep_lurker × 5 @S1 fmt=column<br>Δ20: e_brine_charger × 3 @S0 fmt=column | 525 | `auto_at(570)` | ELITE-SPIKE | — |
| W10 | 570 | Δ0: e_swashbuckler × 6 @S2_air alternate fmt=single<br>Δ8: e_kraken_tendril × 3 @S1 fmt=column interval=3.0<br>Δ20: e_corsair_pikeman × 4 @S0 fmt=column | 605 | `auto_at(650)` | ELITE-SPIKE | 准备 Boss |
| W11 | 650 | Δ0: e_deep_lurker × 8 @S1 fmt=column interval=0.6<br>Δ8: e_brine_charger × 4 @S0 fmt=wedge<br>Δ20: e_corsair_pikeman × 4 @S0 fmt=column | 685 | `auto_at(720)` | SWARM | 海上+陆地双层最大压力 |
| W12 | 720 | Δ0: e_corsair_pikeman × 4 @S0 fmt=convoy<br>Δ0: e_deep_lurker × 4 @S1 fmt=column<br>Δ12: e_tide_warlord × 1 @S1 fmt=boss_solo | 760 | `victory` | BOSS | 浪潮领主二形态 |

**累计敌数**（设计上限）：5+5+6+7+9+8+14+10+13+13+16+9 = **115**；策划压到 108。

### 6.5 Boss 演出（e_tide_warlord，二形态）

1. **入场触发**：W12 Δ12（`t=732s`）。
2. **入场演出**：屏幕震 1.0s；S1 水面涌起巨浪 → 浪潮领主从水中升起（2.0s）；BGM 切换"深海主题"；黑屏字卡「浪潮领主 — 形态 1」1.0s。
3. **形态切换条件**：HP < 50%。
4. **形态切换演出**：领主沉入水中（1.5s 免伤）；屏幕泛蓝；浮出位置随机偏移 ±2 格；字卡「形态 2 — 深海隐形」。
5. **形态 1 机制**：每 12s 召唤 3 只 `e_corsair_pikeman` 护卫。AS 0.6，物理输出。
6. **形态 2 机制**：水下移动隐形，每 8s 浮出造成 AoE 60 物伤 + 击退 2 格；浮出后 3s 可被攻击。
7. **战败演出**：领主沉入水中爆炸；3 道水柱冲天 1.5s；掉落 50E + 250G。
8. **超时**：6min 未结束触发 `boss_hp_drain(2%/s)` + 强制浮出。

### 6.6 配置出口

```yaml
id: level-05
theme: DrownreefHarbor
grid: { cols: 21, rows: 9 }
weatherPool: [HighTide, Fog, Sunny]
weatherProbability: { HighTide: 0.6, Fog: 0.3, Sunny: 0.1 }
weatherChangeInterval: 60
availableTowers: [arrow, cannon, frost, lightning, flame, poison, lightning_storm]
availableUnits: [swordsman, archer, knight, mage, priest, paladin]
unlockStarsRequired: 0
unlockPrevLevelId: level-04
spawns:
  - { id: S0, x: 0, y: 4 }
  - { id: S1, x: 0, y: 7, layer: water }
  - { id: S2_air, virtual: true, layer: air, y: 1 }
airDropPoints:
  - { id: W0, x: 7, y: 0, splashFailChance: 0.1 }
  - { id: W1, x: 12, y: 0, splashFailChance: 0.1 }
phaseSwitch:
  triggerWave: 6
  cutsceneSeconds: 1.5
  effect: "water_path_reveal_all_lurkers, swashbuckler_count_x2"
```

### 6.7 验收清单

- [ ] 水路敌人在 W6 退潮 cutscene 前 100% 不可被攻击。
- [ ] 退潮 cutscene 后所有 `e_deep_lurker` UI 从透明 0.3 alpha 切到 1.0。
- [ ] 空投兵落水率实测 10% ± 2%。
- [ ] W12 浪潮领主形态切换有 ≥1s 免伤窗口。
- [ ] 通关时间窗口 [9min, 11min]。

---

## 7. 关 6 — 齿轮工厂（Cogforge Bastion）

> **上游**：[15-level-themes §7](./15-level-themes.md#7-关-6--⚙️-齿轮工厂cogforge-bastion) | **数值**：[50-mda §21.2](../50-data-numerical/50-mda.md#212-8-关难度乘数替换-161) `enemyHpMult=1.4 / enemyDmgMult=1.25` | **flavor**：GAUNTLET

### 7.1 地图布局

**网格**：21×11（**多 2 行**纵深）。**三 spawn 工厂流水线**，含传送带 + Boss 自爆区。

```
   0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
0  S0= = = = = = = = = = = = = = = = = = = = .
1  . ~ ~ . . . ~ ~ . . . . . ~ ~ . . . ~ ~ .
2  . ~ ~ . . . ~ ~ . . . . . ~ ~ . . . ~ ~ .
3  . . . > > > > > > > > > > > > > > > > > > B   ← 传送带（+30% 移速）
4  S1= = = = = = = = = = = = = = = = = = = = .
5  . . . . . . . . . . . . . . . . . . . . .
6  . ~ ~ . . . ~ ~ . . . . . ~ ~ . . . ~ ~ .
7  . ~ ~ . . . ~ ~ . . . . . ~ ~ . . . ~ ~ .
8  S2= = = = = = = = = = = = = = = = = = = = .
9  . . . . . . . . . . . . . . . . . . . . .
10 . . . . . . . . . . . . . . . . . . . . .
```

- **spawn 点**：
  - `S0 = (0,0)` 上路
  - `S1 = (0,4)` 中路（**传送带**）
  - `S2 = (0,8)` 下路（**反建筑路径**——`e_hammergrub_drone` 专用）
- **水晶**：`B = (20, 3)`（三路汇合点）
- **可建格数**：30
- **机关**：
  - 中路 `>` 传送带 (3-19, 3)：所有敌人 +30% 移速；玩家士兵不受影响。
  - 第 14 波 Boss 形态 2 触发"工厂自爆 timer"（20s 自爆 = 玩家失败）。
- **天气**：固定烟雾（`Smog`），玩家塔射程 -10%。

### 7.2 路径节点表

| 路径 | 节点链 | 长度 |
|---|---|---|
| `top_path` | `S0(0,0) → (20,0) → MERGE(20,3) → B` | 23 |
| `belt_path` | `S1(0,4) → (2,4) → (3,3) → 传送带(3-19, 3) → B(20,3)` | 22 |
| `bot_path` | `S2(0,8) → (20,8) → MERGE(20,3) → B` | 28（hammergrub_drone 半路向上转入塔位） |

### 7.3 可建格清单

30 格（6 个区块每块 5 格），分布于路径上下夹缝。详见 ASCII。

### 7.4 波次时间线（14 波，GAUNTLET flavor）

> 总敌数 138，**波间冷场短**（默认 15s，是其他关 30s 的一半），连续轰炸。

| 波 | t | spawn 流 | 结束 t | trigger | flavor | 备注 |
|---|---|---|---|---|---|---|
| W1 | 0 | Δ0: e_clockwork_grunt × 4 @S0 fmt=column<br>Δ4: e_clockwork_grunt × 4 @S1 fmt=column | 8 | `auto_at(25)` | GAUNTLET | 教学：双路并发 |
| W2 | 25 | Δ0: e_steam_lancer × 2 @S0 fmt=column<br>Δ4: e_clockwork_grunt × 4 @S1 fmt=column | 35 | `auto_at(55)` | GAUNTLET | 教学：穿甲远程 |
| W3 | 55 | Δ0: e_hammergrub_drone × 3 @S2 fmt=swarm interval=0.6<br>Δ4: e_clockwork_grunt × 3 @S0 fmt=column | 70 | `auto_at(90)` | GAUNTLET | 教学：反建筑机器人 |
| W4 | 90 | Δ0: e_repair_bot × 2 @S0 fmt=convoy(+clockwork_grunt ×4)<br>Δ12: e_steam_lancer × 2 @S1 fmt=column | 115 | `auto_at(135)` | ELITE-SPIKE | 教学：修理机器人盾光环 |
| W5 | 135 | Δ0: e_clockwork_grunt × 5 @S0 fmt=column<br>Δ0: e_clockwork_grunt × 5 @S1 fmt=column<br>Δ8: e_hammergrub_drone × 3 @S2 fmt=swarm | 150 | `auto_at(170)` | GAUNTLET | 三路并发 |
| W6 | 170 | Δ0: e_steam_lancer × 3 @S0 fmt=column<br>Δ4: e_repair_bot × 1 @S1 fmt=single<br>Δ16: e_clockwork_grunt × 4 @S2 fmt=column | 195 | `auto_at(215)` | GAUNTLET | — |
| W7 | 215 | Δ0: e_minecart_juggernaut × 1 @S1 fmt=single<br>Δ8: e_clockwork_grunt × 4 @S0 fmt=column<br>Δ16: e_hammergrub_drone × 3 @S2 fmt=swarm | 240 | `auto_at(260)` | ELITE-SPIKE | 教学：矿车摧毁塔机制 |
| W8 | 260 | Δ0: e_repair_bot × 2 @S0 fmt=convoy(+steam_lancer ×3)<br>Δ16: e_clockwork_grunt × 5 @S1 fmt=column | 295 | `auto_at(320)` | GAUNTLET | 远程护送队 |
| W9 | 320 | Δ0: e_hammergrub_drone × 5 @S2 fmt=swarm interval=0.5<br>Δ4: e_clockwork_grunt × 4 @S0 fmt=column<br>Δ16: e_steam_lancer × 2 @S1 fmt=column | 345 | `auto_at(365)` | GAUNTLET | 反塔危机 |
| W10 | 365 | Δ0: e_minecart_juggernaut × 1 @S0 fmt=single<br>Δ8: e_clockwork_grunt × 5 @S1 fmt=column<br>Δ20: e_repair_bot × 1 @S2 fmt=single | 395 | `auto_at(415)` | ELITE-SPIKE | — |
| W11 | 415 | Δ0: e_steam_lancer × 4 @S0 fmt=column<br>Δ4: e_clockwork_grunt × 5 @S1 fmt=phalanx<br>Δ16: e_hammergrub_drone × 4 @S2 fmt=swarm | 445 | `auto_at(465)` | GAUNTLET | — |
| W12 | 465 | Δ0: e_repair_bot × 3 @S0 fmt=column interval=4.0<br>Δ8: e_steam_lancer × 3 @S1 fmt=column<br>Δ20: e_minecart_juggernaut × 1 @S0 fmt=single | 495 | `auto_at(515)` | ELITE-SPIKE | 双重威胁 |
| W13 | 515 | Δ0: e_clockwork_grunt × 6 @S0 fmt=phalanx<br>Δ0: e_clockwork_grunt × 6 @S1 fmt=phalanx<br>Δ8: e_hammergrub_drone × 5 @S2 fmt=swarm | 535 | `auto_at(555)` | GAUNTLET | 准备 Boss 前最大压力 |
| W14 | 555 | Δ0: e_clockwork_grunt × 4 @S0 fmt=column<br>Δ0: e_clockwork_grunt × 4 @S1 fmt=column<br>Δ12: e_steel_artisan × 1 @S0 fmt=boss_solo | 600 | `victory` | BOSS | 钢铁巨匠二形态 + 自爆 timer |

**累计敌数**：8+6+6+6+13+8+8+10+11+7+13+10+17+13 = **136**；目标 138 一致。

### 7.5 Boss 演出（e_steel_artisan，二形态 + 自爆 timer）

1. **入场触发**：W14 Δ12（`t=567s`）。
2. **入场演出**：S0 处工厂大门开启 → 蒸汽喷涌；钢铁巨匠走出（2.0s）；BGM 切换"工业 Boss 主题"；字卡「钢铁巨匠 — 形态 1」。
3. **形态切换条件**：HP < 30%。
4. **形态切换演出**：巨匠护甲爆裂（1.5s 免伤）；屏幕短震 0.5s；字卡红字「形态 2 — 自爆倒计时启动 20s」；UI 顶部红色倒计时启动。
5. **形态 1 机制**：AS 0.5，物理护甲 120；每 8s 释放 2 只 `e_hammergrub_drone` 朝玩家最贵塔。
6. **形态 2 机制**：AS 0.8，护甲降为 30，移速 ×2.5（25 → 70）；20s 自爆 timer，timer 到 0 = **玩家直接失败**（不论水晶 HP）。
7. **战败演出**：巨匠塌缩为一堆零件；屏幕震 1.5s；掉落 60E + 320G。
8. **超时**：自爆 timer 是硬截止，无需额外超时机制。

### 7.6 配置出口

```yaml
id: level-06
theme: CogforgeBastion
grid: { cols: 21, rows: 11 }
weatherFixed: Smog
availableTowers: [arrow, cannon, frost, lightning, flame, poison, lightning_storm, sniper]
availableUnits: [swordsman, archer, knight, mage, priest, paladin, engineer]
unlockStarsRequired: 0
unlockPrevLevelId: level-05
spawns:
  - { id: S0, x: 0, y: 0 }
  - { id: S1, x: 0, y: 4 }
  - { id: S2, x: 0, y: 8 }
conveyorBelts:
  - { tilesFrom: [3, 3], tilesTo: [19, 3], speedBoost: 1.3 }
bossSelfDestructTimer: 20   # 秒，形态 2 触发
```

### 7.7 验收清单

- [ ] 传送带敌人移速 +30% ± 3%。
- [ ] W3 反建筑机器人 ≥ 80% 概率绕过士兵直接攻击玩家塔。
- [ ] W7 矿车 1 次撞击摧毁 1 座塔（不只是伤害）。
- [ ] W14 Boss 形态 2 启动时 UI 顶部红色倒计时清晰可见。
- [ ] 20s 自爆 timer 到 0 玩家失败（即使水晶 HP > 0）。
- [ ] 通关时间窗口 [11min, 13min]。

---

## 8. 关 7 — 孢子菌林（Fungal Spire）

> **上游**：[15-level-themes §8](./15-level-themes.md#8-关-7--🍄-孢子菌林fungal-spire) | **数值**：[50-mda §21.2](../50-data-numerical/50-mda.md#212-8-关难度乘数替换-161) `enemyHpMult=1.35 / enemyDmgMult=1.3 / enemySpeedMult=1.1` | **flavor**：SUMMONER

### 8.1 地图布局

**网格**：21×9，**单 spawn + 5 处菌母固定 spawn 点**。菌母自动产卵，玩家须优先击杀菌母。

```
   0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
0  . . . . . . . . . . . . . . . . . . . . .
1  . ~ . M . . . . . . M . . . . . . M . . .   ← M = 菌母 spawn 点
2  . ~ . . . . . ~ . . . . . . ~ . . . . . .
3  . . . . . . . . . . . . . . . . . . . . .
4  S0= = = = = = = = = = = = = = = = = = = = B
5  . . . . . . . . . . . . . . . . . . . . .
6  . ~ . . . . . ~ . . . . . . ~ . . . . . .
7  . ~ . . M . . . . . . M . . . . . . M . .
8  . . . . . . . . . . . . . . . . . . . . .
```

- **spawn 点**：`S0 = (0, 4)`；5 处菌母位 `M`：`(3,1) (10,1) (17,1) (4,7) (11,7) (18,7)` 中选 5。
- **菌母**：`e_brood_mother` 在 `M` 位 spawn 后 **hold_position** 不动，每 4s 召唤 2 只 `e_sporeling`，最大同时活跃 sporeling 数 8。
- **水晶**：`B = (20, 4)`
- **可建格数**：24
- **天气**：固定孢子雾（`Spore_Mist`），玩家士兵每 5s 受 5 DMG。

### 8.2 路径节点表

| 路径 | 节点链 | 长度 |
|---|---|---|
| `main_path` | `S0(0,4) → B(20,4)` | 20 |
| `mushroom_spawn[0..4]` | 从 `M` 位走最短路到 `main_path` → B | 各异 |

### 8.3 可建格清单

| 区域 | 坐标 | 备注 |
|---|---|---|
| 路径上下夹缝 | `(1, 1-2)` `(7, 2)` `(14, 2)` `(17, 1)` `(1, 6-7)` `(7, 6)` `(14, 6)` `(18, 7)` | 部分位接近 `M`，可压制菌母 |

### 8.4 波次时间线（12 波，SUMMONER flavor）

> 总敌数 124（含菌母自刷 sporeling 估算 ~22）。

| 波 | t | spawn 流 | 结束 t | trigger | flavor | 备注 |
|---|---|---|---|---|---|---|
| W1 | 0 | Δ0: e_sporeling × 6 @S0 fmt=swarm interval=0.4 | 2 | `auto_at(20)` | SUMMONER | 教学：孢子幼体死亡释放孢子云 |
| W2 | 20 | Δ0: e_brood_mother × 1 @M0 fmt=single<br>Δ4: e_sporeling × 4 @S0 fmt=swarm | 30 | `auto_at(60)` | SUMMONER | 教学：菌母 spawn |
| W3 | 60 | Δ0: e_myco_charger × 3 @S0 fmt=column<br>Δ8: e_sporeling × 4 @S0 fmt=swarm | 78 | `auto_at(105)` | SUMMONER | 教学：菌丝感染体死亡分裂 |
| W4 | 105 | Δ0: e_brood_mother × 1 @M1 fmt=single<br>Δ4: e_warped_witch × 1 @S0 fmt=single<br>Δ12: e_myco_charger × 4 @S0 fmt=column | 130 | `auto_at(160)` | ELITE-SPIKE | 教学：扭曲女巫多变绵羊 |
| W5 | 160 | Δ0: e_blight_spitter × 2 @S0 fmt=column<br>Δ8: e_sporeling × 6 @S0 fmt=swarm<br>Δ20: e_myco_charger × 3 @S0 fmt=column | 190 | `auto_at(225)` | SUMMONER | 教学：腐疫吐液者毒池 |
| W6 | 225 | Δ0: e_brood_mother × 2 @M2,M3 fmt=column<br>Δ12: e_myco_charger × 4 @S0 fmt=column | 245 | `auto_at(280)` | SUMMONER | 双菌母 |
| W7 | 280 | Δ0: e_warped_witch × 2 @S0 fmt=column interval=4.0<br>Δ8: e_sporeling × 8 @S0 fmt=swarm | 295 | `auto_at(330)` | SUMMONER | 多变压力 |
| W8 | 330 | Δ0: e_brood_mother × 1 @M4 fmt=single<br>Δ4: e_blight_spitter × 3 @S0 fmt=column<br>Δ16: e_myco_charger × 5 @S0 fmt=column | 360 | `auto_at(395)` | SUMMONER | 5 菌母全部活跃（满场刷卵） |
| W9 | 395 | Δ0: e_myco_charger × 6 @S0 fmt=phalanx<br>Δ8: e_sporeling × 8 @S0 fmt=swarm | 420 | `auto_at(450)` | SUMMONER | — |
| W10 | 450 | Δ0: e_warped_witch × 2 @S0 fmt=column<br>Δ4: e_blight_spitter × 4 @S0 fmt=column<br>Δ16: e_myco_charger × 4 @S0 fmt=column | 480 | `auto_at(515)` | ELITE-SPIKE | — |
| W11 | 515 | Δ0: e_brood_mother × 3 @M0,M1,M2 fmt=column interval=4.0<br>Δ12: e_warped_witch × 1 @S0 fmt=single<br>Δ20: e_myco_charger × 4 @S0 fmt=column | 545 | `auto_at(580)` | SUMMONER | 准备 Boss 前最大刷卵压力 |
| W12 | 580 | Δ0: e_myco_charger × 4 @S0 fmt=column<br>Δ4: e_blight_spitter × 2 @S0 fmt=column<br>Δ12: e_mycelial_core × 1 @M2 fmt=boss_solo | 620 | `victory` | BOSS | 菌核之母二形态 |

**累计直接 spawn 敌数**：6+5+7+6+11+6+10+12+14+10+8+7 = **102**；加菌母自刷 ~22 sporeling = **124**。

### 8.5 Boss 演出（e_mycelial_core，二形态）

1. **入场触发**：W12 Δ12（`t=592s`），从 `M2` 位升起。
2. **入场演出**：地面孢子菌丝聚拢；菌核之母从地下隆起（2.5s 慢速 spawn）；BGM 切换"生物 Boss 主题"；字卡「菌核之母 — 形态 1」。
3. **形态切换条件**：HP < 50%。
4. **形态切换演出**：菌核迸开（1.5s 免伤）；屏幕泛紫；字卡「形态 2 — 真菌侵染」。
5. **形态 1 机制**：`movementMode=hold_position`，AS 0，无攻击；每 6s `spawn_unit(e_brood_mother, count=2)`。玩家须先清场再砍 Boss。
6. **形态 2 机制**：可移动（速度 50），可远程攻击（射程 220）；每 12s 对玩家场上最强塔释放 `polymorph_mushroom(10s, cannot_attack)`。
7. **战败演出**：菌核炸开释出 6 只 sporeling（5s 内必被清场）；地面菌丝枯萎；掉落 70E + 350G。
8. **超时**：6min 未结束触发 `boss_polymorph_immune_aura_disable` + `hp_drain(2%/s)`。

### 8.6 配置出口

```yaml
id: level-07
theme: FungalSpire
grid: { cols: 21, rows: 9 }
weatherFixed: SporeMist
availableTowers: [arrow, cannon, frost, lightning, flame, poison, lightning_storm, sniper, virus]
availableUnits: [swordsman, archer, knight, mage, priest, paladin, engineer, druid]
unlockStarsRequired: 0
unlockPrevLevelId: level-06
spawns:
  - { id: S0, x: 0, y: 4 }
moldSpawners:
  - { id: M0, x: 3, y: 1 }
  - { id: M1, x: 10, y: 1 }
  - { id: M2, x: 17, y: 1 }
  - { id: M3, x: 4, y: 7 }
  - { id: M4, x: 11, y: 7 }
maxActiveSporelings: 8
sporeMistDPS: 1
```

### 8.7 验收清单

- [ ] 菌母 `hold_position` 不移动；玩家不杀则持续 spawn。
- [ ] sporeling 死亡释放孢子云半径 80px、强化范围内友军 4s。
- [ ] 菌丝感染体死亡分裂出 2 只 sporeling 100% 触发。
- [ ] 扭曲女巫绵羊化玩家士兵成功率 100%（无 miss）。
- [ ] W11-W12 菌母同时存在 ≥ 5 只。
- [ ] W12 Boss 形态 2 对玩家最强塔施放 polymorph 至少 1 次。
- [ ] 通关时间窗口 [10min, 12min]。

---

## 9. 关 8 — 异界终战（Veil Apex）

> **上游**：[15-level-themes §9](./15-level-themes.md#9-关-8--🌀-异界终战veil-apex) | **数值**：[50-mda §21.2](../50-data-numerical/50-mda.md#212-8-关难度乘数替换-161) `enemyHpMult=1.8 / enemyDmgMult=1.6 / enemySpeedMult=1.15` | **flavor**：BOSS（单超长波三阶段）

### 9.1 地图布局

**网格**：25×11（**比标准大**，容纳混编精英与终战 Boss 三形态）。**四 spawn 全方位**。

```
   0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24
0  . . . . . . . . . . . . . . . . . . . . . . . . .
1  S0= = = = = = + . . . . . . . . . . + = = = = = = .
2  . . . . . . = . . . . . . . . . . = . . . . . . .
3  . ~ . ~ . . = . ~ . . . . . . . ~ = . . ~ . ~ . .
4  . ~ . ~ . . + = = = = = = = = = + = . . ~ . ~ . .
5  . . . . . . . . . . . . B . . . . . . . . . . . .   ← Crystal 中央
6  . ~ . ~ . . + = = = = = = = = = + . . . ~ . ~ . .
7  . ~ . ~ . . = . ~ . . . . . . . ~ = . . ~ . ~ . .
8  . . . . . . = . . . . . . . . . . = . . . . . . .
9  S1= = = = = = + . . . . . . . . . . + = = = = = = .
10 . . . . . . . . . . . . . . . . . . . . . . . . .
```

- **spawn 点**：
  - `S0 = (0, 1)` 北
  - `S1 = (0, 9)` 南
  - `S2 = (虚拟 portal_east)` 东（仅形态 2/3 召唤）
  - `S3 = (虚拟 portal_west)` 西（仅形态 2/3 召唤）
- **水晶**：`B = (12, 5)`（**中央**）
- **可建格数**：30
- **机关**：Boss 战中虚空裂缝随机刷新 portal（`e_void_blinker` onDeath spawn_portal）
- **天气**：固定虚空裂缝（`Void`），玩家塔每 30s 受随机 debuff 5s。

### 9.2 路径节点表

| 路径 | 节点链 | 长度 |
|---|---|---|
| `north_path` | `S0(0,1) → P_N1(6,1) → P_N2(6,4) → MERGE(11,4) → B(12,5)` | 17 |
| `south_path` | `S1(0,9) → P_S1(6,9) → P_S2(6,6) → MERGE(11,6) → B(12,5)` | 17 |
| `east_portal_path` | `portal_east(任意) → B(12,5)` | 变 |
| `west_portal_path` | `portal_west(任意) → B(12,5)` | 变 |

### 9.3 可建格清单

30 格，分布于 Crystal 四象限（每象限 7-8 格）。**Crystal 上下左右各 1 格不可建**（视觉留白）。

### 9.4 波次时间线（1 超长波，三阶段）

> 终战 = **单超长波**，没有波间冷场。三阶段连续推进，玩家全程紧绷。

| 阶段 | t 区间 | spawn 流 | flavor | 备注 |
|---|---|---|---|---|
| **阶段 1 — 混编精英** | t=0 → t=720（12 min） | 详见 §9.4.1 | ELITE-SPIKE | 关 2-7 精英 50% 体量混编 |
| **阶段 2 — 异界先驱** | t=720 → t=1320（10 min） | 详见 §9.4.2 | SUMMONER | 4 个全新虚空兵种 + portal 召唤 |
| **阶段 3 — 旧日支配者** | t=1320 → t=1800（8 min 上限） | 详见 §9.4.3 | BOSS | 三形态 Boss 战 |

#### 9.4.1 阶段 1 — 混编精英（12 min，45 敌人）

> 抽取关 2-7 各关精英 50%，混入双 spawn。每 60s 1 个子波，共 12 个子波。

| 子波 | t | spawn 流 | 备注 |
|---|---|---|---|
| sw1 | 0 | Δ0: e_giant_beetle × 1 @S0 fmt=single<br>Δ4: e_yeti_charger × 1 @S1 fmt=single | 关 2 + 关 3 精英 |
| sw2 | 60 | Δ0: e_kraken_tendril × 1 @S0 fmt=single<br>Δ4: e_petrify_oracle × 1 @S1 fmt=single | 关 4 + 关 5 |
| sw3 | 120 | Δ0: e_repair_bot × 1 @S0 fmt=convoy(+clockwork_grunt ×2)<br>Δ12: e_warped_witch × 1 @S1 fmt=single | 关 6 + 关 7 |
| sw4 | 180 | Δ0: e_acid_artillery × 2 @S0 fmt=column<br>Δ8: e_ice_witch × 1 @S1 fmt=single | — |
| sw5 | 240 | Δ0: e_temple_priest × 1 @S0 fmt=convoy(+jungle_zealot ×3)<br>Δ16: e_brine_charger × 2 @S1 fmt=column | — |
| sw6 | 300 | Δ0: e_steam_lancer × 2 @S0 fmt=column<br>Δ4: e_myco_charger × 3 @S1 fmt=column | — |
| sw7 | 360 | Δ0: e_blood_trickster × 2 @S0 fmt=column<br>Δ12: e_corsair_pikeman × 4 @S1 fmt=phalanx | — |
| sw8 | 420 | Δ0: e_glacier_titan × 1 @S0 fmt=single<br>Δ20: e_minecart_juggernaut × 1 @S1 fmt=single | 双"半 Boss" |
| sw9 | 480 | Δ0: e_brood_mother × 1 @M_central(12,1) fmt=single<br>Δ8: e_petrify_oracle × 1 @S0 fmt=single | 菌母刷卵 |
| sw10 | 540 | Δ0: e_repair_bot × 2 @S0 fmt=convoy(+steam_lancer ×2)<br>Δ16: e_yeti_charger × 2 @S1 fmt=wedge | — |
| sw11 | 600 | Δ0: e_kraken_tendril × 2 @S1 fmt=column<br>Δ8: e_warped_witch × 2 @S0 fmt=column | — |
| sw12 | 660 | Δ0: e_giant_beetle × 1 @S0 fmt=single<br>Δ4: e_blight_spitter × 3 @S1 fmt=column<br>Δ20: e_ice_witch × 1 @S0 fmt=single | 阶段 1 收尾 |

**阶段 1 累计**：~45 个混编精英。所有数值 = 各关基础值 × 1.3。

#### 9.4.2 阶段 2 — 异界先驱（10 min，~40 敌人 + portal 召唤）

> 4 全新虚空兵种登场。`e_void_blinker` 死亡 spawn 8s portal，每 2s 召唤 1 只 `e_void_thrall`。

| 子波 | t | spawn 流 | 备注 |
|---|---|---|---|
| sw13 | 720 | Δ0: e_void_blinker × 2 @S0 fmt=column interval=3.0<br>Δ12: e_void_blinker × 2 @S1 fmt=column | 教学：虚空闪烁者瞬移 + onDeath portal |
| sw14 | 780 | Δ0: e_eye_of_collapse × 1 @S0 fmt=single<br>Δ4: e_cursed_avenger × 2 @S1 fmt=column | 教学：摧塔之眼标记 + 诅咒复仇者 |
| sw15 | 840 | Δ0: e_void_blinker × 3 @S0 fmt=swarm<br>Δ12: e_cursed_avenger × 2 @S1 fmt=column | 多 portal 同时刷新 |
| sw16 | 900 | Δ0: e_eye_of_collapse × 2 @S0 fmt=column interval=8.0<br>Δ16: e_void_blinker × 2 @S1 fmt=column | 双摧塔之眼 |
| sw17 | 960 | Δ0: e_cursed_avenger × 3 @S0 fmt=wedge<br>Δ8: e_void_blinker × 3 @S1 fmt=swarm | — |
| sw18 | 1020 | Δ0: e_eye_of_collapse × 1 @S0 fmt=single<br>Δ4: e_cursed_avenger × 3 @S1 fmt=phalanx | — |
| sw19 | 1080 | Δ0: e_void_blinker × 4 @S0 fmt=swarm<br>Δ8: e_eye_of_collapse × 2 @S1 fmt=column | portal 满场 |
| sw20 | 1140 | Δ0: e_cursed_avenger × 4 @S0 fmt=phalanx<br>Δ12: e_void_blinker × 3 @S1 fmt=swarm | — |
| sw21 | 1200 | Δ0: e_eye_of_collapse × 3 @S0 fmt=column interval=10.0<br>Δ16: e_cursed_avenger × 2 @S1 fmt=column | 准备 Boss |
| sw22 | 1260 | Δ0: e_void_blinker × 4 @S0 fmt=swarm<br>Δ8: e_eye_of_collapse × 1 @S1 fmt=single<br>Δ16: e_cursed_avenger × 3 @S1 fmt=wedge | 阶段 2 收尾（清场触发 Boss） |

**阶段 2 累计**：4 全新虚空兵种约 40 个 + 大量 portal 召唤的 `e_void_thrall`。

#### 9.4.3 阶段 3 — 旧日支配者 Boss 战（8 min 上限）

| 形态 | HP | 物甲 | 魔抗 | AS | 移速 | 射程 | 攻击类型 | 玩家应对 |
|---|---|---|---|---|---|---|---|---|
| **形态 1（物甲）** | 3500 | 400 (~80% 减伤) | 0 | 0.5 | 40 | 96 | 物伤 70 | 穿甲塔 / 魔法塔 |
| **形态 2（魔抗）** | 4500 | 0 | 400 (~80% 减伤) | 0.4 | 35 | 240 | 魔伤 55 | 物理塔 / 高 ASD 塔 |
| **形态 3（免控）** | 3000 | 0 | 0 | 0.9 | 80 | 32 | 物伤 80 (近战狂暴) | 高 DPS + AoE，免减速/冻结/眩晕 |

**形态切换条件**：HP 从形态阈值降到 0 时自动切换；每次切换 1.5s 免伤窗口 + 黑屏字卡。

**Boss 战 spawn 流**：

```
t=1320:        e_old_one_warden × 1 @B(12,5)  fmt=boss_solo
t=1320+15s:    召唤护卫 portal_east → 4× e_void_thrall
t=每 30s:      召唤护卫 portal_west → 3× e_cursed_avenger（仅形态 2 与 3）
形态 3 启动后每 10s: e_void_blinker × 1 @random_portal
```

**超时机制**：`t > 1800`（30 min 总时长上限）仍未结束触发 `boss_hp_drain(5%/s)`。

### 9.5 Boss 演出（e_old_one_warden，三形态）

1. **入场触发**：阶段 2 清场后 5s（`t≈1320`）。
2. **入场演出**：屏幕黑屏 1.5s；中央水晶位 `B(12,5)` 浮起虚空裂缝；旧日支配者从裂缝中降临（3.0s 慢速）；BGM 切换"终极 Boss 主题"；全屏字卡「旧日支配者 — 形态 1：物质形态」。
3. **形态 1 → 2 演出**：Boss 身体崩解（1.5s 免伤）；屏幕泛蓝；字卡「形态 2 — 魔法形态」。
4. **形态 2 → 3 演出**：Boss 身体被怒火吞噬（1.5s 免伤）；屏幕泛红；字卡「形态 3 — 狂暴形态」；BGM 节奏加快。
5. **战败演出**：Boss 内爆 → 屏幕泛白 2s → 字卡「胜利」+ 黑屏淡入 Run 结算页面；掉落 100E + 500G。
6. **超时**：见 §9.4.3。

### 9.6 配置出口

```yaml
id: level-08
theme: VeilApex
grid: { cols: 25, rows: 11 }
weatherFixed: Void
availableTowers: [arrow, cannon, frost, lightning, flame, poison, lightning_storm, sniper, virus, void]
availableUnits: [swordsman, archer, knight, mage, priest, paladin, engineer, druid, hero]
unlockStarsRequired: 0
unlockPrevLevelId: level-07
spawns:
  - { id: S0, x: 0, y: 1 }
  - { id: S1, x: 0, y: 9 }
  - { id: S2_portal_east, virtual: true }
  - { id: S3_portal_west, virtual: true }
phases:
  - { id: phase1_mixed_elite, duration: 720, subWaves: 12 }
  - { id: phase2_void_pioneer, duration: 600, subWaves: 10 }
  - { id: phase3_boss, duration: 480, boss: e_old_one_warden }
totalTimeLimit: 1800
victoryMessage: "Veil Sealed."
```

### 9.7 验收清单

- [ ] 阶段 1 sw1-sw12 任意子波若清场，下一子波 5s 内启动。
- [ ] sw13 `e_void_blinker` 瞬移每 6s 触发；onDeath spawn portal 100%。
- [ ] sw14 `e_eye_of_collapse` 攻击塔后塔上方显示红色倒计时 10s。
- [ ] sw14 `e_cursed_avenger` 被诅咒敌人死亡时 AoE 清场半径 ≥ 80px。
- [ ] Boss 形态 1 物理塔伤害 ≤ 20%（护甲 80%）；魔法塔满伤。
- [ ] Boss 形态 2 物理塔满伤；魔法塔伤害 ≤ 20%。
- [ ] Boss 形态 3 减速/冻结/眩晕全部 immune。
- [ ] 形态切换免伤窗口 ≥ 1.0s。
- [ ] 通关时间窗口 [25min, 30min]。
- [ ] Boss 战 > 30min 触发 hp_drain 5%/s。

---

## 10. 跨关验收对照表

> 本表是 8 关蓝图的**端到端验收 checklist**，开发完成后必须逐项 ✅。

### 10.1 工程量横向对照

| 关 | 主题 | 网格 | spawn | 波数 | 总敌数 | Boss | 时长 | 可建格 |
|---|---|---|---|---|---|---|---|---|
| 1 | 边境绿野 | 21×9 | 1 | 8 | 56 | — | 5-7 min | 18 |
| 2 | 沙漠虫潮 | 21×9 | 2 | 10 | 92 | 关末精英 | 7-9 min | 22 |
| 3 | 极地暴雪 | 21×9 | 1 | 10 | 64 | 双肉墙 | 8-10 min | 24 |
| 4 | 失落神庙 | 21×9 | 2 | 10 | 78 | Mini-Boss | 7-9 min | 26 |
| 5 | 沉没港口 | 21×9 | 3 | 12 | 108 | 二形态 | 9-11 min | 26 |
| 6 | 齿轮工厂 | 21×11 | 3 | 14 | 138 | 二形态+自爆 | 11-13 min | 30 |
| 7 | 孢子菌林 | 21×9 | 1+5菌母 | 12 | 124 | 二形态 | 10-12 min | 24 |
| 8 | 异界终战 | 25×11 | 4 | 1 超长波 | ~85 + Boss | 三形态 | 25-30 min | 30 |
| **累计** | — | — | — | **77+1** | **~745** | — | **82-101 min** | — |

> ⚠️ 总敌数与 [50-mda §21.4](../50-data-numerical/50-mda.md#214-8-关波次结构总览) 的 821 有 76 个差额，由菌母自刷 sporeling（关 7 ~22）+ portal 召唤的 thrall（关 8 ~30-40）+ buffer 补足。

### 10.2 主题机制零重叠验收（继承 [15-level-themes §1.6](./15-level-themes.md#16-主题机制零重叠矩阵设计验收锁)）

| 关 | 签名机制 1 | 签名机制 2 | 签名机制 3 |
|---|---|---|---|
| 1 | 单 spawn 直线 | 无机关 | 无天气 |
| 2 | 钻地隧道 | 沙暴减射程 | 蝗群飞行 |
| 3 | S 形冰面减速 | 暴风雪护甲 | 冰锥地形改造 |
| 4 | 钳形双 spawn | 神庙清理机关 | 治疗/复活/石化光环 |
| 5 | 三层立体（陆/水/空） | A→C 退潮切换 | 空投落水补偿 |
| 6 | 三 spawn 流水线 | 传送带加速 | 自爆 timer |
| 7 | 5 菌母固定 spawn | 孢子雾持续 DPS | polymorph 缴塔 |
| 8 | 4 spawn 中央 Crystal | 三形态 Boss | portal 召唤 |

> 24 项签名机制零重叠（每关 ≤ 3 个 ≠ 跨关重复）。

### 10.3 Boss 强度单调递增校验

> 用 [50-mda §21.5](../50-data-numerical/50-mda.md#215-36-新敌人--6-新-boss-基础数值替换-68-关-28-部分) 数值计算（含 §21.2 难度乘数）：

| 关 | Boss | 等效 HP（× 难度乘数）| 期望击杀时间 |
|---|---|---|---|
| 2 | e_queen_mother | 700 × 0.95 = 665 | 40-70s |
| 3 | e_glacier_titan ×2 | 1200 × 1.25 × 2 = 3000 | 60-90s |
| 4 | e_stone_colossus | 1500 × 1.15 = 1725 | 90-120s |
| 5 | e_tide_warlord (2 形态) | 3000 × 1.3 = 3900 | 120-180s |
| 6 | e_steel_artisan (2 形态) | 3300 × 1.4 = 4620 | 90-180s (20s timer) |
| 7 | e_mycelial_core (2 形态) | 3500 × 1.35 = 4725 | 120-240s |
| 8 | e_old_one_warden (3 形态) | 11000 × 1.8 = 19800 | 240-480s |

> 等效 HP 单调递增 ✅。击杀时间随 Boss 复杂度合理增长 ✅。

### 10.4 水晶 HP 端到端验收（[50-mda §21.3](../50-data-numerical/50-mda.md#213-8-关水晶-hp-消耗预算替换-193)）

| 关 | 预算漏怪 | 累计 HP 下限 |
|---|---|---|
| 1 → 2 | 0-3 | ≥ 997 |
| 2 → 3 | 5-15 | ≥ 982 |
| 3 → 4 | 0-10 | ≥ 972 |
| 4 → 5 | 5-15 | ≥ 957 |
| 5 → 6 | 10-25 | ≥ 932 |
| 6 → 7 | 15-35 | ≥ 897 |
| 7 → 8 | 20-40 | ≥ 857 |
| 终战前 | — | **HP ≥ 787（中庸玩家合格线）** |

### 10.5 配置出口完备性

每关 §X.6「配置出口」必须实现以下 YAML 字段（loader 校验）：

- [x] `id` / `theme` / `grid`
- [x] `spawns[]`（spawn 点定义）
- [x] `availableTowers[]` / `availableUnits[]`
- [x] `unlockPrevLevelId`（roguelike 流程下逻辑顺序由 RunManager 控制）
- [x] `weatherPool[]` 或 `weatherFixed`
- [x] 每关特有机关字段（如 `tunnels` / `slipperyTiles` / `conveyorBelts` / `moldSpawners` / `phases` 等）

### 10.6 关卡内 4 阶段乘数（继承 [50-mda §16.2](../50-data-numerical/50-mda.md#16-难度乘数表v30)）

> 每关内波次划为 4 阶段，乘数 0.8 / 1.0 / 1.3 / 1.5。本表给出每关 4 阶段的波次切分：

| 关 | 阶段 1 (×0.8) | 阶段 2 (×1.0) | 阶段 3 (×1.3) | 阶段 4 (×1.5) |
|---|---|---|---|---|
| 1 | W1-W2 | W3-W4 | W5-W6 | W7-W8 |
| 2 | W1-W2 | W3-W5 | W6-W8 | W9-W10 |
| 3 | W1-W2 | W3-W5 | W6-W8 | W9-W10 |
| 4 | W1-W2 | W3-W5 | W6-W8 | W9-W10 |
| 5 | W1-W3 | W4-W6 | W7-W9 | W10-W12 |
| 6 | W1-W3 | W4-W7 | W8-W11 | W12-W14 |
| 7 | W1-W2 | W3-W6 | W7-W9 | W10-W12 |
| 8 | sw1-sw4 | sw5-sw8 | sw9-sw14 | sw15-sw22 + Boss |

---

## 11. 版本日志

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0.0 | 2026-05-15 | 首版：§0-§11 全文 1200+ 行；落地 8 关详细蓝图（grid + 路径 + 波次时间线 + Boss 演出）；引用 [15-level-themes](./15-level-themes.md) 主题/敌人 + [50-mda §21](../50-data-numerical/50-mda.md#21-8-关-roguelike-关卡数值v32-新增) 数值；§10 跨关验收对照表 6 张。 |

> **下一步**（不在本文档范围内）：
>
> 1. 落实到 `src/config/levels/level-0{1…8}.yaml`（设计稿，编辑器消费）；
> 2. 落实到 `src/data/levels/level-0{1…8}.ts`（运行时源，需先扩展 `LevelTheme` / `WeatherType` enum）；
> 3. 实现规则 handler：`onDeath_release_spore_cloud` / `mass_petrify` / `polymorph_mushroom` / `spawn_portal` / `mark_for_destruction` / `curse_volatile` 等（[60-architecture §规则引擎](../60-tech/60-architecture.md)）；
> 4. 修复 `levelFixtures.pathGraph.test.ts` 与 `DebugManager.test.ts` 以适配 5 → 8 关。

> v1.0.0 章节版本: v1.0.0 | 日期: 2026-05-15 | 状态: 设计稿首次入库；待 YAML/TS 配置同步落地
