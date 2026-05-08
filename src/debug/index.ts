/**
 * 调试系统
 * 
 * 提供运行时调试工具，包括：
 * - 行为树查看器
 * - 调试控制台
 * - 调试菜单
 */

// 导出调试工具
export { DebugManager } from './DebugManager.js';
export { BehaviorTreeViewer } from './BehaviorTreeViewer.js';
export { BehaviorTreeRenderer } from './BehaviorTreeRenderer.js';
export { DebugConsole } from './DebugConsole.js';

// 导出类型
export {
  LogLevel,
  NodeExecutionStatus,
  DebugPanelType,
  type LogEntry,
  type BTNodeDebugInfo,
  type BehaviorTreeDebugState,
  type DebugSystemState,
} from './types.js';
