---
title: 50-data-numerical 综述 — 数值真理源
status: module-summary
version: V1
last-modified: 2026-05-14 21:32:22 +08:00
source: design/50-data-numerical/
---

# 50-data-numerical 综述 — 数值真理源

> 本层只有一份文档：`50-mda.md`。它是**全部游戏数值的唯一权威来源**。
>
> ⭐ `authority-for: all-numerical-values · damage-formulas · progression-curves · balance-tables`

---

## 文档清单

| 文档 | 状态 | 权威范围 | 一句话 |
|---|---|---|---|
| `50-mda.md` | ⭐ authoritative | all-numerical-values · damage-formulas · progression-curves · balance-tables | MDA 驱动的全局数值：能量表、商品价、难度乘数、卡解锁价、碎片价、科技节点数值 |

---

## 为什么单独成层？

**因为数值是最容易蔓延的设计漂移源**。如果数值散落在 N 个文档里，必然出现：

- 某文档说箭塔伤害 10，另一份说 12。
- 50-mda 改了商店刷新费，但 UI 文档还写老价格。
- 代码里 hardcode 数字，没人知道出处。

为避免这种漂移，项目定下**铁律**：

> ⚠️ **所有数值只在 `50-mda.md` 中定义。其它文档只描述字段语义、公式骨架、规则边界，不持有数值表。**

如果在其它文档里看到了数值，**视为 BUG，必须删除残留并以 50-mda 为准**。

---

## 50-mda 的内容范围（按章节）

> 具体数值见 `design/50-data-numerical/50-mda.md` 原文。下表是**章节地图**，便于查找。

| 章节范围 | 主题 | 关键内容 |
|---|---|---|
| §1-§11 | v2.x 旧版数值 | 单位 stats、攻速、伤害公式、护甲、波次配置等 |
| §12-§20 | v3.0/v3.1 新增数值 | 能量表、金币掉落、卡牌稀有度权重、商店商品价、秘境奖励池、碎片转换率、塔科技树节点成本 |
| §17 | 火花碎片经济 | Run 结束按到达关卡发放碎片的曲线、卡解锁价、科技节点价 |
| §18+ | 难度乘数 | 关卡内 4 阶段难度乘数、关与关之间的难度递增 |

---

## MDA 框架（设计方法）

50-mda 用 **MDA 框架**（Mechanics-Dynamics-Aesthetics）组织数值设计：

- **Mechanics（机制）**：规则、公式、单位 stats。
- **Dynamics（动态）**：玩家在机制下产生的行为模式（如「能量短缺压力」「金币储蓄博弈」）。
- **Aesthetics（美学体验）**：玩家最终的感受（紧张、成就、惊喜）。

调数值时**逆向工作**：先定 Aesthetics 目标（"这关要让玩家感到压力"）→ 推 Dynamics（"能量必须吃紧"）→ 落 Mechanics（"能量上限不变，但敌人波次密度 +30%"）。

---

## 数值改动的工作流

```
1. 想改数值
2. 改 design/50-data-numerical/50-mda.md（唯一权威）
3. 同步 src/data/gameData.ts（代码侧的数值常量）
4. 同步配置 YAML（如果数值在 config/units/ 或 config/levels/）
5. 同步测试（vitest 中可能 hardcode 期望值）
6. 跑 npm test 全量
7. PR 标题加 [数值] 前缀
```

### 检测残留数值（防止漂移）

定期或在 review 时，检查其它文档是否残留数值：

```bash
# 例：找所有非 50-mda 文档中出现的具体数字
grep -rn -E '\b[0-9]{2,}\b' design/ --exclude-dir=archive --exclude-dir=dev-logs \
  | grep -v '50-mda'
```

发现残留 → 删除 → 写明"数值见 50-mda §X"。

---

## 与其它层的耦合

50-mda 是**单向被依赖**：所有其它层都引用它，它不引用任何其它文档（除少量 cross-refs 用于回链）。

| 引用 50-mda 的文档 | 引用什么 |
|---|---|
| `10-gameplay/10-roguelike-loop.md` | 能量表、金币、卡牌稀有度、商店价格、碎片经济 |
| `10-gameplay/11-economy.md` | 三资源完整数值表 |
| `10-gameplay/14-weather.md` | 天气对战斗的数值影响矩阵 |
| `20-units/21-unit-roster.md` | 每个单位的具体 stats |
| `20-units/22-tower-tech-tree.md` | 每个科技树节点的碎片成本 |
| `20-units/24-combat.md` | 伤害公式中的系数 |
| `60-tech/61-save-system.md` | 默认存档值 |

代码侧依赖：`src/data/gameData.ts`、`config/units/*.yaml`、`config/levels/*.yaml`、`config/cards/*.yaml`。

---

## 实现侧关键约束

1. **代码中禁止 hardcode 游戏数值**。所有数值从 `src/data/gameData.ts` 或 YAML 配置加载，源头是 50-mda。
2. **修改数值的 PR 必须标 `[数值]` 前缀**，便于历史追溯。
3. **数值改动必须有 dev-log**，记录改动理由（Aesthetics → Dynamics → Mechanics 反推）。
4. **测试中的期望值要么不写数值（用公式），要么明确注释 "对应 50-mda §X 的定义"**。
5. **不要在文档中复述 50-mda 的数值**。其它文档只能引用 "见 50-mda §X"，不许搬运。

---

## 未来扩展提示

- 当数值表足够大时，可以从 50-mda 抽出独立 YAML（如 `balance.yaml`），代码和文档都从这一份 YAML 读取，实现"单一真理源"的硬约束。
- v3.1 已经把单位 stats 放到 `config/units/*.yaml`，下一步可以把 `gameData.ts` 也合并进 YAML 体系，减少 TS 常量。
