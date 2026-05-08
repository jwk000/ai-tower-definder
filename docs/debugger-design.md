# 调试器设计文档

## 1. 概述

调试器是Tower Defender的运行时调试工具，用于查看单位AI行为树、监控游戏状态、输出日志等。

### 1.1 设计目标

- **非侵入式**：覆盖在游戏界面上，不影响游戏运行
- **即时可用**：点击单位即可查看其AI行为树
- **半屏设计**：右侧面板形式，可展开收起
- **实时更新**：行为树状态每帧刷新

## 2. 功能需求

### 2.1 行为树查看器

| 功能 | 说明 |
|------|------|
| 树状可视化 | 以节点连线图展示行为树结构 |
| 节点状态高亮 | 不同颜色表示节点执行状态 |
| 节点详情 | 悬停显示节点参数和执行信息 |
| 视图控制 | 拖拽平移、滚轮缩放、适应视图 |

### 2.2 调试控制台

| 功能 | 说明 |
|------|------|
| 日志输出 | 拦截console输出并显示 |
| 清除日志 | 一键清空日志 |
| 自动滚动 | 新日志自动滚动到底部 |

### 2.3 单位选择集成

| 功能 | 说明 |
|------|------|
| 点击选择 | 在场景中点击单位自动切换行为树查看器 |
| 无AI提示 | 选择无AI的单位时显示提示 |
| 自动刷新 | 选中单位后每帧更新行为树状态 |

## 3. 交互设计

### 3.1 面板布局

```
┌─────────────────────────────────────────────────────────────┐
│                        游戏画面                              │
│                                                             │
│                                                             │
│                                            ┌────────────────┤
│                                            │   调试面板     │
│                                            │────────────────│
│                                            │ [行为树][控制台]│
│                                            │────────────────│
│                                            │                │
│                                            │  行为树可视化  │
│                                            │                │
│                                            │────────────────│
│                                            │  节点详情      │
│                                            │                │
│   [🔧]                                    │                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 展开/收起

- **收起状态**：右侧边缘显示🔧按钮
- **展开状态**：450px宽的半屏面板覆盖在游戏界面上
- **切换方式**：
  - 点击🔧按钮展开
  - 点击✕按钮收起
  - 按F12切换
  - 按Escape收起

### 3.3 标签页切换

- **行为树标签**：显示行为树可视化和节点详情
- **控制台标签**：显示日志输出

## 4. 视觉设计

### 4.1 节点状态颜色

| 状态 | 颜色 | 说明 |
|------|------|------|
| 空闲 (Idle) | `#757575` 灰色 | 节点未执行 |
| 运行中 (Running) | `#4CAF50` 绿色 | 节点正在执行 |
| 成功 (Success) | `#2196F3` 蓝色 | 节点执行成功 |
| 失败 (Failure) | `#f44336` 红色 | 节点执行失败 |

### 4.2 节点类型图标

| 图标 | 节点类型 | 说明 |
|------|----------|------|
| ▶ | Sequence | 顺序节点 |
| ? | Selector | 选择节点 |
| ◇ | Check | 条件节点 |
| ○ | Action | 动作节点 |
| ⬡ | Decorator | 装饰节点 |

### 4.3 配色方案

```
背景色:     #1e1e2e (深蓝灰)
面板背景:   #252535 (中蓝灰)
边框色:     #3a3a4a (浅蓝灰)
文字主色:   #e0e0e0 (浅灰)
文字副色:   #a0a0b0 (中灰)
强调色:     #7a7aaa (紫色)
```

## 5. 技术设计

### 5.1 模块结构

```
src/debug/
├── DebugManager.ts           # 调试管理器（主入口）
├── DebugPanel.ts             # 调试面板（半屏UI）
├── BehaviorTreeRenderer.ts   # 行为树渲染器（Canvas绘制）
├── types.ts                  # 类型定义
└── index.ts                  # 导出索引
```

### 5.2 类关系图

```
DebugManager
    │
    ├── DebugPanel (UI层)
    │   ├── 标题栏
    │   ├── 标签页切换
    │   ├── 行为树视图
    │   │   └── Canvas (BehaviorTreeRenderer)
    │   └── 控制台视图
    │       └── 日志列表
    │
    └── World (ECS层)
        ├── AI组件
        ├── UnitTag组件
        └── BehaviorTreeConfig
```

### 5.3 数据流

```
用户点击单位
      │
      ▼
main.ts: handleMapClick()
      │
      ▼
debugManager.selectEntity(entityId)
      │
      ▼
从World获取组件:
  - AI (行为树配置ID、黑板数据、状态)
  - UnitTag (单位名称、类型)
      │
      ▼
构建BehaviorTreeDebugState:
  - 从aiConfigs获取行为树结构
  - 遍历BTNodeConfig生成BTNodeDebugInfo
      │
      ▼
debugPanel.updateBehaviorTreeState(state)
      │
      ▼
BehaviorTreeRenderer.render(root)
      │
      ▼
Canvas绘制节点和连线
```

### 5.4 关键接口

```typescript
// 行为树节点调试信息
interface BTNodeDebugInfo {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'success' | 'failure';
  params?: Record<string, unknown>;
  children?: BTNodeDebugInfo[];
}

// 行为树调试状态
interface BehaviorTreeDebugState {
  entityId: number;
  unitName: string;
  aiConfigId: string;
  root: BTNodeDebugInfo | null;
  blackboard: Record<string, unknown>;
  currentState: string;
  targetId: number | null;
}

// 调试日志条目
interface LogEntry {
  id: number;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
}
```

## 6. 集成方式

### 6.1 初始化

```typescript
// main.ts
import { DebugManager } from './debug/DebugManager.js';

class TowerDefenderGame extends Game {
  private debugManager!: DebugManager;

  private initBattle(config: LevelConfig): void {
    // ... 其他初始化 ...
    
    // 初始化调试管理器
    this.debugManager = new DebugManager(this.world);
    
    // 注册AI配置
    this.debugManager.registerAIConfigs(ALL_AI_CONFIGS);
  }
}
```

### 6.2 单位选择集成

```typescript
// main.ts - handleMapClick()
private handleMapClick(e: InputEvent): void {
  // ... 现有点击检测逻辑 ...
  
  // 选中单位后通知调试管理器
  if (unitId !== null) {
    this.debugManager.selectEntity(unitId);
  } else {
    this.debugManager.selectEntity(null);
  }
}
```

### 6.3 每帧更新

```typescript
// main.ts - onAfterUpdate
this.onAfterUpdate = () => {
  // 更新调试管理器
  this.debugManager.update();
  
  // ... 其他逻辑 ...
};
```

### 6.4 Console拦截

调试管理器会拦截`console.log/warn/error/debug`，将输出同步到控制台面板。

```typescript
// 拦截后，以下调用会同时输出到浏览器控制台和调试面板
console.log('这是一条日志');
console.warn('警告信息');
console.error('错误信息');
```

## 7. 快捷键

| 快捷键 | 功能 |
|--------|------|
| `F12` | 切换调试面板展开/收起 |
| `Escape` | 收起调试面板 |

## 8. 性能考虑

- **按需渲染**：仅在面板展开时渲染行为树
- **Canvas绘制**：使用Canvas而非DOM，性能更优
- **日志限制**：最多保留500条日志，超出自动删除旧日志
- **状态缓存**：行为树结构从配置构建，不依赖运行时状态

## 9. 后续扩展

### 9.1 可能的增强功能

- [ ] 节点执行时间统计
- [ ] 行为树断点调试
- [ ] 黑板数据实时编辑
- [ ] 日志导出功能
- [ ] 多单位对比查看
- [ ] 行为树回放功能

### 9.2 扩展点

- `BehaviorTreeRenderer`：可扩展更多节点类型和样式
- `DebugPanel`：可添加更多标签页（性能监控、实体列表等）
- `DebugManager`：可集成更多游戏状态监控
