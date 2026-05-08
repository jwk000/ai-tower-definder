/**
 * 调试系统类型定义
 */

/** 调试日志级别 */
export const LogLevel = {
  Debug: 'debug',
  Info: 'info',
  Warn: 'warn',
  Error: 'error',
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

/** 调试日志条目 */
export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

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

/** 调试面板类型 */
export const DebugPanelType = {
  None: 'none',
  Console: 'console',
  BehaviorTree: 'behavior_tree',
} as const;

export type DebugPanelType = typeof DebugPanelType[keyof typeof DebugPanelType];

/** 调试系统状态 */
export interface DebugSystemState {
  isOpen: boolean;
  activePanel: DebugPanelType;
  selectedEntityId: number | null;
  logs: LogEntry[];
  behaviorTreeState: BehaviorTreeDebugState | null;
  autoRefresh: boolean;
  refreshInterval: number;
}
