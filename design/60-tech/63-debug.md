---
title: 调试系统设计
status: stable
version: 1.0.0
last-modified: 2026-05-14
authority-for:
  - debug-tooling
supersedes: []
cross-refs:
  - 60-tech/60-architecture.md
  - 60-tech/64-level-editor.md
---

# 调试系统设计

> 版本: v1.0 | 日期: 2026-05-12

## 1. 目标

为开发者与 QA 提供运行时调试入口，覆盖关卡选择、战斗、胜利、失败等**所有界面**，统一通过悬浮按钮触发。

## 2. 需求

### 2.1 调试入口
- **调试按钮（🔧）必须在所有界面持续可见**：包含关卡选择界面、战斗界面（部署/战斗/波间/胜利/失败子阶段）。
- 入口形式：DOM 固定定位的浮动按钮，挂载于 `document.body`，z-index 高于游戏画布与 UI 系统。
- 快捷键：保留反引号 `` ` `` 切换面板、`Escape` 收起面板。

### 2.2 调试面板形态
- 形态：**右侧抽屉式 DOM 面板**，从右侧滑入。
- 内容：**仅显示一个纵向功能按钮列表**（不再有 Tab）。无说明面板、无单位信息条、无控制台、无日志监视器。
- 标题栏：保留「调试面板」标题与收起按钮（✕）。

### 2.3 功能按钮列表（v1.0）

| 序号 | 功能 | 适用界面 | 行为 |
|------|------|---------|------|
| 1 | 一键通关，所有关卡 3 星 | 全部 | 立即将 1~5 关写入 `levelStars = 3`、`unlockedLevels = 5`，刷新关卡选择 UI；按钮可点。完成后弹出短暂提示「✅ 已通关 5 关」（按钮自身文案 1.5 秒变色反馈，无需 toast 组件）。 |
| 2 | 金币 +99999 | 仅战斗中 | 调用 `EconomySystem.addGold(99999)`；非战斗界面（关卡选择/无 EconomySystem 实例）按钮置灰且 `disabled`，鼠标悬停 tooltip 显示「仅战斗中可用」。 |
| 3 | 查看行为树 | 全部 | 弹出独立的行为树查看窗口（全屏覆盖，可关闭）。窗口内显示当前选中单位的行为树状态；若未选中单位，显示「请在战斗中点击一个单位」。复用现有 `BehaviorTreeRenderer`。 |

### 2.4 移除的功能（v0.x 历史，不再保留）

- ❌ 控制台 Tab（DOM 日志列表 + `console.log/info/warn/error/debug` 拦截）
- ❌ 日志监视器 Tab（`LogMonitor` 订阅 `debugLog.ts`）
- ❌ `DebugConsole.ts`（独立全屏控制台，从未集成）
- ❌ `BehaviorTreeViewer.ts` 全屏查看器（其能力被「查看行为树」功能按钮 + 独立弹窗替代，但内部仍可复用其 DOM 装配逻辑）

> 上述代码文件将被删除或简化，对应类型导出从 `src/debug/index.ts` 移除。

## 3. 架构与生命周期

### 3.1 DebugManager 全局化

| 项 | v0.x（旧） | v1.0（新） |
|----|-----------|-----------|
| 创建时机 | `initBattle()` 内（每次进入战斗重新创建） | `TowerDefenderGame` **构造函数**中创建一次 |
| 生命周期 | 战斗范围 | 与游戏实例同生命周期 |
| 关卡选择界面 | 调试按钮不可见 | 调试按钮持续可见 |
| AI 配置注册 | 战斗初始化时注册 | 构造函数中注册一次（`ALL_AI_CONFIGS` 是静态数据） |

### 3.2 经济系统访问

DebugManager 通过 `setEconomyProvider(provider: () => EconomySystem | null)` 注入访问器：
- 战斗开始时 `setEconomyProvider(() => this.economy)`；
- 战斗结束（`enterLevelSelect`）时 `setEconomyProvider(() => null)`，让金币按钮自动置灰。

### 3.3 关卡选择 UI 刷新回调

DebugManager 通过 `setOnLevelSelectRefresh(cb: () => void)` 注入刷新回调：
- 「一键通关」执行后调用此回调；
- 当前回调实现：`this.levelSelectUI.refresh()`。

### 3.4 单位选择集成

战斗中点击实体仍调用 `debugManager.selectEntity(eid)`（行为不变），DebugManager 内部记录选中实体并在「查看行为树」窗口打开时即时构建 BT 状态。

## 4. 文件与代码影响清单

### 新增 / 修改

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/debug/DebugManager.ts` | 修改 | 注入 EconomyProvider + LevelSelectRefresh 回调；移除 console 拦截；移除 addLog API；保留快捷键、行为树状态构建、selectEntity。 |
| `src/debug/DebugPanel.ts` | 重写 | 抽屉面板只渲染功能按钮列表；行为树移到独立弹窗；移除控制台/日志 tab 与 LogMonitor 依赖。 |
| `src/debug/BehaviorTreeWindow.ts` | **新建** | 独立的行为树查看弹窗（DOM 全屏覆盖 + canvas + 关闭按钮 + 单位信息条）；复用 `BehaviorTreeRenderer`。 |
| `src/debug/index.ts` | 修改 | 仅导出 `DebugManager`、`BehaviorTreeRenderer`、相关类型；移除 `DebugConsole`、`BehaviorTreeViewer`。 |
| `src/main.ts` | 修改 | DebugManager 改为构造函数中创建；注入 economy/refresh provider；删除战斗初始化中重复创建。 |

### 删除

| 文件 | 原因 |
|------|------|
| `src/debug/DebugConsole.ts` | 控制台功能下线 |
| `src/debug/LogMonitor.ts` | 日志监视器功能下线 |
| `src/debug/BehaviorTreeViewer.ts` | 被 `BehaviorTreeWindow` 取代 |

### 保留

- `src/debug/BehaviorTreeRenderer.ts` — Canvas 行为树绘制引擎，复用。
- `src/debug/types.ts` — 类型定义，删除 `LogEntry`/`LogLevel`/`DebugPanelType`，保留 `BTNodeDebugInfo`/`BehaviorTreeDebugState`/`NodeExecutionStatus`。

## 5. UI 规范

### 5.1 右侧抽屉

- 宽度 360px（旧版 600px，因为不再有 Tab + canvas，缩小腾出视野）
- 标题栏：左「调试面板」14px 加粗 / 右收起按钮 ✕
- 按钮列表：每个按钮 12px padding、占满宽度、悬停高亮、`disabled` 时灰色 `opacity: 0.4`

### 5.2 行为树弹窗

- 全屏覆盖（z-index: 10000）
- 顶部工具条：左「行为树查看器 · 当前单位：{unitName}（{aiConfigId}）」/ 右关闭按钮 ✕
- 中部 canvas：复用 `BehaviorTreeRenderer`（拖拽/缩放/适应视图）
- 底部节点信息条（hover 节点时显示）
- 关闭：✕ 按钮、Escape 键、点击空白蒙层均可关闭

## 6. 验收

- ✅ 关卡选择界面右侧可见 🔧 调试按钮，点击展开抽屉面板。
- ✅ 战斗界面同样可见；不同界面切换时按钮不消失、状态不丢失。
- ✅ 抽屉面板内只见三个功能按钮，无 Tab、无控制台日志列表。
- ✅ 点「一键通关」后，刷新页面，关卡选择 UI 显示 5 关全部 3 星且全部解锁。
- ✅ 关卡选择界面「金币 +99999」按钮置灰；战斗中点击后 HUD 金币数 +99999。
- ✅ 战斗中点击单位后点「查看行为树」，弹出独立窗口显示该单位 BT；未选中单位时弹窗内提示「请在战斗中点击一个单位」。
- ✅ 反引号 / Escape 快捷键正常工作。
- ✅ 旧的 `console.log/warn/error` 不再被拦截（浏览器原生 DevTools 显示正常）。
- ✅ `npm run typecheck` 与 `npm test` 全部通过。

## 7. 测试策略

新增 `src/debug/DebugManager.test.ts`：
- `triggerCompleteAllLevels()` 后 `SaveManager.load()` 返回 `unlockedLevels === 5`、`levelStars` 全为 3。
- `addDebugGold()` 在已注入 EconomySystem 时调用 `economy.addGold(99999)`；未注入时返回 `false` 不抛错。
- DOM 测试不在单测覆盖，依赖手动 / e2e 验收。

## 8. 与其他文档的关系

- 不修改 [13-存档系统](./61-save-system.md)；仅通过其公共 API（`setStars`、`unlockLevel`）写入。
- 不修改 [06-经济系统](../10-gameplay/11-economy.md)；仅通过 `addGold` 公共 API 写入。
- 不修改 [23-AI 行为树](../30-ai/30-behavior-tree.md)；仅消费 `AI` 组件与 `BehaviorTreeConfig`。
