/**
 * 调试系统类型定义
 *
 * v1.0 (design/27-debug-system.md): 移除 LogEntry/LogLevel/DebugPanelType，
 * 调试面板不再有日志/控制台功能。
 */

/** 行为树节点执行状态 */
export const NodeExecutionStatus = {
  Idle: 'idle',
  Running: 'running',
  Success: 'success',
  Failure: 'failure',
} as const;

export type NodeExecutionStatus = typeof NodeExecutionStatus[keyof typeof NodeExecutionStatus];

/** 行为树节点调试信息 */
export interface BTNodeDebugInfo {
  id: string;
  name: string;
  type: string;
  status: NodeExecutionStatus;
  params?: Record<string, unknown>;
  children?: BTNodeDebugInfo[];
  lastExecuted?: number;
  executionTime?: number;
}

/** 行为树调试状态 */
export interface BehaviorTreeDebugState {
  entityId: number;
  unitName: string;
  aiConfigId: string;
  root: BTNodeDebugInfo | null;
  blackboard: Record<string, unknown>;
  currentState: string;
  targetId: number | null;
  lastUpdateTime: number;
}
