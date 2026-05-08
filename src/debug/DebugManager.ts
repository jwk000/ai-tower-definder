import { DebugPanel } from './DebugPanel.js';
import type { LogEntry, BehaviorTreeDebugState, BTNodeDebugInfo } from './types.js';
import { LogLevel } from './types.js';
import type { World } from '../core/World.js';
import type { EntityId } from '../types/index.js';
import { CType } from '../types/index.js';
import type { AI } from '../components/AI.js';
import type { UnitTag } from '../components/UnitTag.js';
import type { Unit } from '../components/Unit.js';
import type { Tower } from '../components/Tower.js';
import type { Enemy } from '../components/Enemy.js';
import type { Position } from '../components/Position.js';
import type { Health } from '../components/Health.js';
import type { Attack } from '../components/Attack.js';
import type { BehaviorTreeConfig, BTNodeConfig } from '../types/index.js';

/**
 * 调试管理器
 * 
 * 管理调试面板，包括：
 * - 行为树查看器
 * - 调试控制台
 * - 单位选择集成
 */
export class DebugManager {
  private world: World;
  
  // 调试面板
  private debugPanel: DebugPanel;
  
  // 状态
  private selectedEntityId: EntityId | null = null;
  
  // AI配置缓存
  private aiConfigs: Map<string, BehaviorTreeConfig> = new Map();
  
  // 日志收集
  private logIdCounter: number = 0;
  
  // 原始console方法
  private originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  constructor(world: World) {
    this.world = world;
    
    // 创建调试面板
    this.debugPanel = new DebugPanel();
    
    // 拦截console输出
    this.interceptConsole();
    
    // 设置键盘快捷键
    this.setupKeyboardShortcuts();
  }

  /**
   * 注册AI配置
   */
  registerAIConfigs(configs: BehaviorTreeConfig[]): void {
    for (const config of configs) {
      this.aiConfigs.set(config.id, config);
    }
    console.log(`[Debug] 注册了 ${configs.length} 个AI配置`);
  }

  /**
   * 拦截console输出
   */
  private interceptConsole(): void {
    const self = this;
    
    console.log = function(...args: unknown[]) {
      self.originalConsole.log.apply(console, args);
      self.addLog('info', 'console', args.map(String).join(' '));
    };
    
    console.info = function(...args: unknown[]) {
      self.originalConsole.info.apply(console, args);
      self.addLog('info', 'console', args.map(String).join(' '));
    };
    
    console.warn = function(...args: unknown[]) {
      self.originalConsole.warn.apply(console, args);
      self.addLog('warn', 'console', args.map(String).join(' '));
    };
    
    console.error = function(...args: unknown[]) {
      self.originalConsole.error.apply(console, args);
      self.addLog('error', 'console', args.map(String).join(' '));
    };
    
    console.debug = function(...args: unknown[]) {
      self.originalConsole.debug.apply(console, args);
      self.addLog('debug', 'console', args.map(String).join(' '));
    };
  }

  /**
   * 设置键盘快捷键
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // F12: 切换调试面板
      if (e.key === 'F12') {
        e.preventDefault();
        this.debugPanel.toggle();
      }
      
      // Escape: 收起调试面板
      if (e.key === 'Escape') {
        this.debugPanel.collapse();
      }
    });
  }

  /**
   * 选择实体（由游戏调用）
   */
  selectEntity(entityId: EntityId | null): void {
    this.selectedEntityId = entityId;
    
    if (entityId === null) {
      this.debugPanel.updateBehaviorTreeState(null);
      return;
    }
    
    // 获取AI组件
    const ai = this.world.getComponent<AI>(entityId, CType.AI);
    
    if (!ai) {
      console.log(`[Debug] 实体 ${entityId} 没有AI组件`);
      this.debugPanel.updateBehaviorTreeState(null);
      return;
    }
    
    // 获取单位名称（尝试多种组件）
    let unitName = '未知单位';
    const unitTag = this.world.getComponent<UnitTag>(entityId, CType.UnitTag);
    const unit = this.world.getComponent<Unit>(entityId, CType.Unit);
    const tower = this.world.getComponent<Tower>(entityId, CType.Tower);
    const enemy = this.world.getComponent<Enemy>(entityId, CType.Enemy);
    
    if (unitTag) {
      unitName = unitTag.unitConfigId;
    } else if (tower) {
      unitName = `Tower_${tower.towerType}`;
    } else if (enemy) {
      unitName = `Enemy_${enemy.enemyType}`;
    } else if (unit) {
      unitName = `Unit_${unit.unitType}`;
    }
    
    console.log(`[Debug] 选择单位: ${unitName} (ID: ${entityId}, AI: ${ai.configId})`);
    
    // 更新行为树状态
    this.updateBehaviorTreeState(entityId, unitName);
  }

  /**
   * 更新行为树状态
   */
  private updateBehaviorTreeState(entityId: EntityId, unitName: string): void {
    const ai = this.world.getComponent<AI>(entityId, CType.AI);
    
    if (!ai) {
      this.debugPanel.updateBehaviorTreeState(null);
      return;
    }
    
    // 获取AI配置
    const aiConfig = this.aiConfigs.get(ai.configId);
    
    if (!aiConfig) {
      console.warn(`[Debug] AI配置未找到: ${ai.configId}`);
    }
    
    // 构建行为树调试状态
    const state: BehaviorTreeDebugState = {
      entityId,
      unitName,
      aiConfigId: ai.configId,
      root: aiConfig ? this.buildBehaviorTreeDebugInfo(aiConfig.root, ai) : null,
      blackboard: Object.fromEntries(ai.blackboard),
      currentState: ai.state,
      targetId: ai.targetId,
      lastUpdateTime: ai.lastUpdateTime,
    };
    
    this.debugPanel.updateBehaviorTreeState(state);
  }

  /**
   * 构建行为树调试信息
   */
  private buildBehaviorTreeDebugInfo(nodeConfig: BTNodeConfig, ai: AI): BTNodeDebugInfo {
    const nodeId = `node_${Math.random().toString(36).substr(2, 9)}`;
    
    // 根据节点类型推断状态
    let status: 'idle' | 'running' | 'success' | 'failure' = 'idle';
    
    // 如果是当前正在执行的节点，标记为运行中
    if (ai.state === nodeConfig.type) {
      status = 'running';
    }
    
    const result: BTNodeDebugInfo = {
      id: nodeId,
      name: nodeConfig.name || this.getNodeDisplayName(nodeConfig.type),
      type: nodeConfig.type,
      status,
      params: nodeConfig.params,
    };
    
    // 递归处理子节点
    if (nodeConfig.children) {
      result.children = nodeConfig.children.map(child => 
        this.buildBehaviorTreeDebugInfo(child, ai)
      );
    }
    
    return result;
  }

  /**
   * 获取节点显示名称
   */
  private getNodeDisplayName(type: string): string {
    const displayNames: Record<string, string> = {
      'sequence': '顺序节点',
      'selector': '选择节点',
      'parallel': '并行节点',
      'inverter': '反转节点',
      'repeater': '重复节点',
      'until_fail': '直到失败',
      'always_succeed': '总是成功',
      'cooldown': '冷却节点',
      'check_hp': '检查血量',
      'check_enemy_in_range': '检查范围内敌人',
      'check_ally_in_range': '检查范围内友军',
      'check_buff': '检查Buff',
      'check_cooldown': '检查冷却',
      'check_phase': '检查阶段',
      'check_target_alive': '检查目标存活',
      'check_distance_to_target': '检查与目标距离',
      'check_moving': '检查移动中',
      'check_stunned': '检查眩晕',
      'check_player_control': '检查玩家控制',
      'attack': '攻击',
      'move_to': '移动到',
      'move_towards': '向目标移动',
      'flee': '逃跑',
      'use_skill': '使用技能',
      'wait': '等待',
      'spawn': '生成单位',
      'patrol': '巡逻',
      'set_target': '设置目标',
      'clear_target': '清除目标',
      'play_animation': '播放动画',
    };
    
    return displayNames[type] || type;
  }

  /**
   * 添加日志
   */
  addLog(level: LogLevel, category: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      id: this.logIdCounter++,
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    };
    
    this.debugPanel.addLog(entry);
  }

  /**
   * 更新（每帧调用）
   */
  update(): void {
    // 如果有选中的实体，持续更新行为树状态
    if (this.selectedEntityId !== null) {
      const ai = this.world.getComponent<AI>(this.selectedEntityId, CType.AI);
      if (ai && ai.active) {
        // 获取单位名称
        let unitName = '未知单位';
        const unitTag = this.world.getComponent<UnitTag>(this.selectedEntityId, CType.UnitTag);
        const unit = this.world.getComponent<Unit>(this.selectedEntityId, CType.Unit);
        const tower = this.world.getComponent<Tower>(this.selectedEntityId, CType.Tower);
        const enemy = this.world.getComponent<Enemy>(this.selectedEntityId, CType.Enemy);
        
        if (unitTag) {
          unitName = unitTag.unitConfigId;
        } else if (tower) {
          unitName = `Tower_${tower.towerType}`;
        } else if (enemy) {
          unitName = `Enemy_${enemy.enemyType}`;
        } else if (unit) {
          unitName = `Unit_${unit.unitType}`;
        }
        
        this.updateBehaviorTreeState(this.selectedEntityId, unitName);
      }
    }
  }

  /**
   * 销毁
   */
  destroy(): void {
    // 恢复原始console方法
    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;
    
    // 销毁调试面板
    this.debugPanel.destroy();
  }
}
