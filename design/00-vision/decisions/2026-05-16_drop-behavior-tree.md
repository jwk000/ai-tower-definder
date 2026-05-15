---
title: ADR-2026.05.16 放弃行为树作为 AI 实现方式
status: accepted
date: 2026-05-16
decision-makers: [产品 owner]
affects:
  - 30-ai/30-behavior-tree.md
  - 30-ai/31-soldier-ai.md
  - 60-tech/60-architecture.md §5.3
  - 00-vision/01-acceptance-criteria.md
  - design/_plans/mvp-v3.4-rewrite.md S6 / P5
supersedes: []
---

# 放弃行为树作为 AI 实现方式

## 决策

**v3.4 MVP 起放弃行为树（Behavior Tree）作为 AI 实现框架**。所有单位（含士兵四状态机、Boss、高级敌人、威胁度评分等）的 AI 改由**规则引擎驱动的配置路径**实现：

- 配置中声明 `targetSelection` / `attackMode` / `movementMode`
- 生命周期事件挂 `RuleHandler`（`onCreate` / `onHit` / `onKill` / `onDeath` / `onHpThreshold` / `onPhaseTransition` 等）
- 状态字段（如士兵的警戒/追击/战斗/游荡）挂在 ECS 组件上，由 AttackSystem / MovementSystem 在每帧 query 中查表 + 转换

## 关键澄清：放弃的是实现方式，不是 AI 需求

| 维度 | 决策 |
|---|---|
| **AI 实现框架（BT 引擎、节点接口、aiConfigs 预设）** | 🛑 全部放弃 |
| **AI 产品需求** | ✅ 全部保留 |

具体需求保留清单：

- **士兵 AI 四状态机**（警戒 / 追击 / 战斗 / 游荡）—— [`31-soldier-ai.md`](../../30-ai/31-soldier-ai.md) §3 仍是权威
- **三圈模型**（警戒圈 / 追击圈 / 攻击圈）—— §2 仍是权威
- **嘲讽机制**（attacker priority、aggro 重置）—— §10 仍是权威
- **AOE 主目标策略**（splashRadius 分群伤害选目标）—— §11 仍是权威
- **士兵升级机制**（`onUpgrade` 触发）—— §12 仍是权威
- **Boss 阶段切换**（HP 阈值触发新攻击模式）—— 由 `RuleHandler` 实现
- **敌方威胁度评分**（识别高威胁目标主动停下攻击）—— 由 `targetSelection: threat_score` 配置承载

## 缘由

### 推动因素

1. **过度设计审计**: v3.1 时期 [`30-ai/30-behavior-tree.md` §审计现状](../../30-ai/30-behavior-tree.md) 列出 14 套 BT 配置已编写但实际驱动率低：
   - AI ID 数值映射错位（P0）
   - UnitSystem / BatSwarmSystem / ShamanSystem / HotAirBalloonSystem / TrapSystem / HealingSystem / ProductionSystem 6 个系统硬编码 AI 绕过 BT
   - AttackSystem / EnemyAttackSystem 覆盖 BT 的 attack 节点（修复后塔/敌的 BT attack 节点变死代码）
   - parallel / repeater / cooldown / use_skill / heal / check_ally_in_range / produce_resource / check_cooldown 多个节点未实现或降级
2. **80/20 规律**: [`60-tech/60-architecture.md` §1 重构动机](../../60-tech/60-architecture.md) 已识别"行为树引擎完整但 80% 的单位只需要简单的『选最近→打』"——配置规则路径足以覆盖绝大多数 AI 需求。
3. **v3.4 MVP 范围**: MVP 仅交付 L1 一关闭环 + 一个 Boss（abyss_lord 推迟到 L9 终战，MVP 不含）。规则引擎完全够用，行为树是负担。
4. **TDD 成本**: BT 节点接口冻结需配套大量节点级单测；规则引擎 handler 是平铺函数，TDD 成本低 1 个数量级。

### 替代方案对比

| 维度 | 行为树（旧） | 规则引擎（新） |
|---|---|---|
| 实现层级 | BT 引擎 + 节点 + 配置 三层 | RuleHandler 平铺函数 |
| 节点接口冻结成本 | 高（一旦冻结只允许新增） | 无（handler 签名独立） |
| 调试可视化 | BehaviorTreeViewer 全屏弹窗 | 标准 console / debug 工具 |
| AI 决策延迟 | 每帧 tick BT 树 | 每帧 query 一次 + handler 调用 |
| 配置可读性 | 嵌套 JSON / YAML 节点树 | 平铺字段（`targetSelection: threat_score`） |
| 与 ECS 集成 | 通过 AISystem 全权代理 | 各 system 直接读写组件 |
| 复杂 AI 承载 | BT Selector / Sequence / Once 装饰 | 生命周期事件 + 状态字段 + handler 组合 |
| TDD 单测成本 | 高（mock BT tick） | 低（handler 是纯函数） |

### 反对意见已审查

- **"BT 处理复杂 AI 更自然"**: Boss 阶段切换在 BT 中需要 `Once` 装饰节点 + 子树重置，在规则引擎中是 `onHpThreshold` handler 触发组件字段切换（如 `Boss.phase = 2`），后续每帧 query 按 `phase` 分支选 `targetSelection`——同样直观，且无需引入 BT 装饰节点抽象。
- **"威胁度评分需要 BT 的 ScoreSelectTarget 节点"**: 改为 `targetSelection: threat_score` 配置 + AttackSystem 内置评分函数（读配置中的 priority 权重），同样可配置化。
- **"BehaviorTreeViewer 调试工具"**: 不再需要——状态字段直接展示在 DebugManager 单位面板，比 BT 树可视化更直接。

## 影响范围

### 文档层

- 🛑 [`30-ai/30-behavior-tree.md`](../../30-ai/30-behavior-tree.md) → 整体 deprecated（仅供历史回溯）
- ⚠️ [`30-ai/31-soldier-ai.md`](../../30-ai/31-soldier-ai.md) → 局部 deprecated（§6 行为树映射 / §7 BT 节点扩展 作废；§1-§5 / §10-§12 需求段仍权威）
- ⚠️ [`60-tech/60-architecture.md`](../../60-tech/60-architecture.md) §5.3 → 整节 deprecated
- ⚠️ [`60-tech/63-debug.md`](../../60-tech/63-debug.md) 行为树查看器章节 → 后续 v3.4 第 4 轮重写时移除
- ⚠️ [`20-units/20-unit-system.md`](../../20-units/20-unit-system.md) §3.3 行为树章节 + [`20-units/21-unit-roster.md`](../../20-units/21-unit-roster.md) `aiBehavior` 字段引用 → v3.4 实装时改写
- ⚠️ [`10-gameplay/10-roguelike-loop.md`](../../10-gameplay/10-roguelike-loop.md) §核心保留项 "行为树驱动 AI" → 改为 "规则引擎驱动 AI"
- ⚠️ [`00-vision/01-acceptance-criteria.md`](../01-acceptance-criteria.md) Phase 2 验收项 → 已修订
- ⚠️ [`design/_plans/mvp-v3.4-rewrite.md`](../../_plans/mvp-v3.4-rewrite.md) S6 已实质降级（写 "不接行为树"）+ P5 题目保留但 BT 引擎接入子项移除 → v2.5 修订历史补记

### 代码层

截至本决策（W2.6 完成时），rougelike-v34 分支**尚未引入任何 BT 代码**，零代码影响。Wave 7 收尾前不会出现 BT 代码。

### 配置层

`src/config/units/enemies.yaml` 等 YAML 中存在 `aiBehavior:` / `ai_tree:` 字段引用，待 v3.4 第 4 轮 UnitFactory 接入 YAML 时清理（用 `targetSelection` / `attackMode` 替换）。

## 后续动作

1. ✅ 文档归档（本 PR 完成）
2. ⏭️ 计划文档 v2.5 修订历史记录此决策
3. ⏭️ Wave 2 W2.7-2.10 实装时 UnitFactory 不再支持 `ai_tree` 字段（直接读 `targetSelection` / `attackMode`）
4. ⏭️ Wave 5/7 实装 Boss / 高级敌人 / 士兵四状态机时，按规则引擎路径实现，参考 [`31-soldier-ai.md`](../../30-ai/31-soldier-ai.md) §1-§5 / §10-§12 需求段
5. ⏭️ 待 Wave 5 前补出 `30-ai/30-ai-rules.md`（暂定名）描述规则引擎落地 AI 的统一规格

## 历史

- 2026-05-16: 决策落地（rougelike-v34 分支 W2.6 完成后由产品 owner 提出，本会话归档）
