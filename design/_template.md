---
title: <文档标题（与一级标题一致）>
status: stable                       # authoritative | stable | draft | deprecated | archived
version: 1.0.0
last-modified: 2026-05-14
authority-for: []                    # 本文档独家裁定的领域，可为空。命名约定见 §3
supersedes: []                       # 本文档取代的旧文件相对路径（如 ["../03-unit-data.md"]）
cross-refs:                          # 本文档主要引用的兄弟文档（相对 design/ 根的路径片段）
  - 10-gameplay/10-roguelike-loop.md
  - 50-data-numerical/50-mda.md
---

# <文档标题>

> 一段话点明本文档的职责边界（≤ 60 字）。例如："本文档是塔升级机制的唯一权威。所有路径节点、碎片成本、UI 行为以此为准。"

> **本文档不包含**：明确列出本文档故意不涵盖的内容并 cross-ref。例如："不含具体数值（→ `50-mda.md`）；不含 UI 视觉（→ `40-ui-ux.md`）"。

---

## 0. 元信息

> 必填章节。给阅读者一个"是否需要继续读下去"的判断锚点。

- **目标读者**：策划 / 客户端开发 / QA / 美术 / 全员
- **前置阅读**：列出本文档假设读者已读完的兄弟文档
- **关联代码**：`src/...`（可选，仅在文档与某段代码紧密耦合时填）

---

## 1. <第一个核心章节>

### 1.1 <子节>

正文。

---

## 2. <第二个核心章节>

正文。

---

## N. v3.1 一致性核对（沿用类文档必备）

> **仅"沿用"或"重审" 类文档必备此章节**。新写文档可省略。

| v3.0/v3.1 关键变更 | 本文档影响 | 当前状态 |
|---|---|---|
| 三资源（能量/金币/碎片）替换金币/人口/能量 | §x.y | ✅ 已同步 / 🔶 部分同步 / ❌ 未处理 |
| 工具栏部署 → 手牌区出卡 | §x.y | ✅ |
| 塔升级 L1-L5 → 关外科技树 | §x.y | ✅ |
| 毒藤塔/弩炮塔废弃 | §x.y | ✅ |

---

## 修订历史

| 版本 | 日期 | 修订者 | 摘要 |
|---|---|---|---|
| 1.0.0 | 2026-05-14 | refactor | 文档迁移至新层级目录 + 加 frontmatter |

---

# 附录：模板使用说明（实际文档中删除本附录）

## A. frontmatter 字段定义

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✅ | 与一级标题一致，便于工具索引 |
| `status` | ✅ | 五种取值：`authoritative`（唯一权威源）/ `stable`（稳定可用）/ `draft`（草案）/ `deprecated`（已废弃但内容保留作历史参考）/ `archived`（归档不再维护） |
| `version` | ✅ | 语义化版本 `MAJOR.MINOR.PATCH`。MAJOR 变更 = 推翻重写、MINOR = 章节追加、PATCH = 错别字/小修订 |
| `last-modified` | ✅ | `YYYY-MM-DD`，每次实质修改时更新 |
| `authority-for` | 可空 | 数组，列出本文档独家裁定的领域标识符。例：`["tower-upgrade", "tech-tree-path"]` |
| `supersedes` | 可空 | 数组，列出被本文档取代的旧文件相对路径 |
| `cross-refs` | 可空 | 数组，列出本文档主要引用的同级文档相对路径 |

## B. 何时设 `status: authoritative`

仅当本文档是某个领域的**唯一**事实来源时。当前已确定的 4 个权威文档：

| 文档 | authority-for |
|---|---|
| `10-gameplay/10-roguelike-loop.md` | `["card-system", "run-flow", "energy-cost", "shop-mystic-node"]` |
| `20-units/22-tower-tech-tree.md` | `["tower-upgrade", "tech-tree-path", "shard-cost"]` |
| `50-data-numerical/50-mda.md` | `["all-numerical-truth"]` |
| `60-tech/64-level-editor.md` | `["level-editor-api", "level-editor-ui"]` |

⚠️ **每个 authority-for 标识符必须全局唯一**——同一个标识符不能出现在两个文档里。

## C. 何时设 `supersedes`

- 文件从旧路径迁移到新路径时（如 `01-game-overview.md` → `00-vision/00-game-overview.md`）
- 文件合并到本文档时（如 03 + 22 → 21-unit-roster.md，则 supersedes 含两项）
- 注意：**不要**把"被取代"理解成"已废弃"——被取代的文件应该被删除或归档，不应该并存。

## D. cross-refs 规范

- 仅列出 **本文档明显依赖、被频繁引用的兄弟文档** 3-5 个。
- 不要把所有引用都塞进来——cross-refs 是给读者的"前置阅读"提示，不是 grep 索引。
- 全部用相对路径。

## E. 必备章节顺序

1. frontmatter（YAML）
2. 一级标题 + 一句话职责边界 + 不包含项
3. `## 0. 元信息`
4. 业务核心章节（1.x / 2.x ...）
5. `## N. v3.1 一致性核对`（仅沿用/重审类）
6. `## 修订历史`

## F. 内部链接规范

- 同目录引用：`[文本](./文件名.md#锚点)`
- 跨层级引用：`[10-roguelike-loop §2.4](../10-gameplay/10-roguelike-loop.md#24-卡牌升级状态)`
- 引用具体小节时优先用锚点，便于定位
- 引用 50-mda 时强制写明小节号，例如：`详见 [50-mda §17 火花碎片](../50-data-numerical/50-mda.md#17-火花碎片获取与消费数值)`

## G. 禁止事项

- ❌ 在非 `50-mda.md` 中放数值表（数值真理源原则）
- ❌ 在非 `10-roguelike-loop.md` 中详述卡牌出卡事务流程（M7 决策）
- ❌ 在非 `22-tower-tech-tree.md` 中详述塔升级路径与节点解锁机制
- ❌ 同一概念在两个文档中并存定义（必有一处是 cross-ref）
- ❌ 用 "已废弃但保留参考" 这种模糊状态——要么删除（→ archive），要么 status: deprecated 并明确"何时彻底删除"

## H. 修订历史规范

- 至少 1 条记录（创建条目）
- 重大重构（status / authority-for / supersedes 变更）必须记录
- 错别字修订可以合并到下次实质修订一并记录，不必每次更新
