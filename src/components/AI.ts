import { CType, type EntityId } from '../types/index.js';

/**
 * AI组件 - 存储单位的AI状态和行为树配置
 * 
 * 每个单位可以有自己的AI配置，通过行为树定义其行为逻辑。
 */
export class AI {
  readonly type = CType.AI;
  
  /** AI配置ID（对应预设或自定义配置） */
  configId: string;
  
  /** 当前状态 */
  state: string;
  
  /** 黑板数据（单位私有的AI数据） */
  blackboard: Map<string, unknown>;
  
  /** 当前目标实体ID */
  targetId: EntityId | null;
  
  /** 上次更新时间 */
  lastUpdateTime: number;
  
  /** AI更新间隔（秒） */
  updateInterval: number;
  
  /** 是否激活 */
  active: boolean;

  constructor(configId: string, updateInterval: number = 0.1) {
    this.configId = configId;
    this.state = 'idle';
    this.blackboard = new Map();
    this.targetId = null;
    this.lastUpdateTime = 0;
    this.updateInterval = updateInterval;
    this.active = true;
  }

  /** 设置黑板数据 */
  setBlackboard(key: string, value: unknown): void {
    this.blackboard.set(key, value);
  }

  /** 获取黑板数据 */
  getBlackboard<T>(key: string): T | undefined {
    return this.blackboard.get(key) as T | undefined;
  }

  /** 检查是否需要更新 */
  shouldUpdate(currentTime: number): boolean {
    if (!this.active) return false;
    return (currentTime - this.lastUpdateTime) >= this.updateInterval;
  }

  /** 标记已更新 */
  markUpdated(currentTime: number): void {
    this.lastUpdateTime = currentTime;
  }

  /** 设置目标 */
  setTarget(targetId: EntityId | null): void {
    this.targetId = targetId;
  }

  /** 清除目标 */
  clearTarget(): void {
    this.targetId = null;
  }

  /** 设置状态 */
  setState(state: string): void {
    this.state = state;
  }
}
