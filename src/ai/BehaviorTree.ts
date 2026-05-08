import { NodeStatus, type BTNodeConfig, type BehaviorTreeConfig, type EntityId } from '../types/index.js';
import type { World } from '../core/World.js';
import type { Position } from '../components/Position.js';
import type { Health } from '../components/Health.js';
import type { Attack } from '../components/Attack.js';
import type { UnitTag } from '../components/UnitTag.js';
import type { AI } from '../components/AI.js';
import { CType } from '../types/index.js';

/**
 * AI上下文 - 行为树执行时的环境信息
 */
export interface AIContext {
  entityId: EntityId;
  world: World;
  unitTag: UnitTag;
  position: Position;
  health: Health;
  attack?: Attack;
  ai: AI;
  dt: number;
  currentTime: number;
}

/**
 * 行为树节点基类
 */
export abstract class BTNode {
  protected name: string;
  protected params: Record<string, unknown>;

  constructor(name: string, params: Record<string, unknown> = {}) {
    this.name = name;
    this.params = params;
  }

  abstract tick(context: AIContext): NodeStatus;

  /** 解析参数中的变量引用 */
  protected resolveParam(key: string, context: AIContext): unknown {
    const value = this.params[key];
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      const varName = value.slice(2, -1);
      return this.resolveVariable(varName, context);
    }
    return value;
  }

  /** 解析内置变量 */
  protected resolveVariable(varName: string, context: AIContext): unknown {
    switch (varName) {
      case 'hp': return context.health.current;
      case 'max_hp': return context.health.max;
      case 'hp_ratio': return context.health.ratio;
      case 'atk': return context.attack?.atk ?? 0;
      case 'defense': return 0; // TODO: add defense component
      case 'attack_speed': return context.attack?.attackSpeed ?? 0;
      case 'move_speed': return 0; // TODO: add move speed
      case 'attack_range': return context.attack?.range ?? 0;
      case 'move_range': return 0; // TODO: add move range
      case 'level': return context.unitTag.level;
      case 'x': return context.position.x;
      case 'y': return context.position.y;
      default:
        // Check blackboard
        return context.ai.getBlackboard(varName);
    }
  }

  /** 获取参数值（支持变量解析） */
  protected getParam<T>(key: string, context: AIContext, defaultValue?: T): T {
    const value = this.resolveParam(key, context);
    return (value as T) ?? (defaultValue as T);
  }
}

/**
 * 组合节点基类
 */
export abstract class CompositeNode extends BTNode {
  protected children: BTNode[];

  constructor(name: string, children: BTNode[], params: Record<string, unknown> = {}) {
    super(name, params);
    this.children = children;
  }
}

/**
 * 顺序节点 - 依次执行子节点，一个失败则失败
 */
export class SequenceNode extends CompositeNode {
  tick(context: AIContext): NodeStatus {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status !== NodeStatus.Success) {
        return status;
      }
    }
    return NodeStatus.Success;
  }
}

/**
 * 选择节点 - 依次执行子节点，一个成功则成功
 */
export class SelectorNode extends CompositeNode {
  tick(context: AIContext): NodeStatus {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status !== NodeStatus.Failure) {
        return status;
      }
    }
    return NodeStatus.Failure;
  }
}

/**
 * 装饰节点基类
 */
export abstract class DecoratorNode extends BTNode {
  protected child: BTNode;

  constructor(name: string, child: BTNode, params: Record<string, unknown> = {}) {
    super(name, params);
    this.child = child;
  }
}

/**
 * 反转节点 - 反转子节点结果
 */
export class InverterNode extends DecoratorNode {
  tick(context: AIContext): NodeStatus {
    const status = this.child.tick(context);
    if (status === NodeStatus.Success) return NodeStatus.Failure;
    if (status === NodeStatus.Failure) return NodeStatus.Success;
    return status;
  }
}

/**
 * 条件节点基类
 */
export abstract class ConditionNode extends BTNode {
  constructor(name: string, params: Record<string, unknown> = {}) {
    super(name, params);
  }
}

/**
 * 动作节点基类
 */
export abstract class ActionNode extends BTNode {
  constructor(name: string, params: Record<string, unknown> = {}) {
    super(name, params);
  }
}

// ==================== 条件节点实现 ====================

/** 检查血量 */
export class CheckHPNode extends ConditionNode {
  tick(context: AIContext): NodeStatus {
    const op = this.getParam<string>('op', context, '<');
    const value = this.getParam<number>('value', context, 0.5);
    const ratio = context.health.ratio;

    switch (op) {
      case '<': return ratio < value ? NodeStatus.Success : NodeStatus.Failure;
      case '>': return ratio > value ? NodeStatus.Success : NodeStatus.Failure;
      case '<=': return ratio <= value ? NodeStatus.Success : NodeStatus.Failure;
      case '>=': return ratio >= value ? NodeStatus.Success : NodeStatus.Failure;
      case '==': return Math.abs(ratio - value) < 0.001 ? NodeStatus.Success : NodeStatus.Failure;
      case '!=': return Math.abs(ratio - value) >= 0.001 ? NodeStatus.Success : NodeStatus.Failure;
      default: return NodeStatus.Failure;
    }
  }
}

/** 检查范围内敌人 */
export class CheckEnemyInRangeNode extends ConditionNode {
  tick(context: AIContext): NodeStatus {
    const range = this.getParam<number>('range', context, 100);
    const targetType = this.getParam<string>('target_type', context, 'any');
    const count = this.getParam<number>('count', context, 1);

    const enemies = this.findEnemiesInRange(context, range, targetType);
    
    if (enemies.length >= count) {
      // Store found enemies in blackboard for action nodes
      context.ai.setBlackboard('found_enemies', enemies);
      return NodeStatus.Success;
    }
    return NodeStatus.Failure;
  }

  private findEnemiesInRange(context: AIContext, range: number, targetType: string): EntityId[] {
    const { world, entityId, position } = context;
    const enemies: EntityId[] = [];

    // Query based on target type
    let queryComponents: string[];
    if (targetType === 'tower') {
      queryComponents = [CType.Position, CType.Health, CType.Tower];
    } else if (targetType === 'soldier') {
      queryComponents = [CType.Position, CType.Health, CType.Unit];
    } else {
      queryComponents = [CType.Position, CType.Health, CType.Enemy];
    }

    const entities = world.query(...queryComponents);
    
    for (const id of entities) {
      if (id === entityId) continue;
      
      const pos = world.getComponent<Position>(id, CType.Position);
      const health = world.getComponent<Health>(id, CType.Health);
      
      if (!pos || !health?.alive) continue;

      const dx = pos.x - position.x;
      const dy = pos.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= range) {
        enemies.push(id);
      }
    }

    return enemies;
  }
}

/** 检查技能冷却 */
export class CheckCooldownNode extends ConditionNode {
  tick(context: AIContext): NodeStatus {
    // TODO: implement cooldown check
    return NodeStatus.Failure;
  }
}

// ==================== 动作节点实现 ====================

/** 攻击动作 */
export class AttackNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const targetParam = this.getParam<string>('target', context, 'nearest_enemy');
    const targetId = this.resolveTarget(targetParam, context);
    
    if (targetId === null) {
      return NodeStatus.Failure;
    }

    const { world, entityId, position, attack } = context;
    
    if (!attack) {
      return NodeStatus.Failure;
    }

    // Get target position
    const targetPos = world.getComponent<Position>(targetId, CType.Position);
    const targetHealth = world.getComponent<Health>(targetId, CType.Health);
    
    if (!targetPos || !targetHealth?.alive) {
      return NodeStatus.Failure;
    }

    // Check range
    const dx = targetPos.x - position.x;
    const dy = targetPos.y - position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > attack.range) {
      return NodeStatus.Failure;
    }

    // Attack if cooldown allows
    if (attack.canAttack) {
      attack.resetCooldown();
      targetHealth.takeDamage(attack.atk);
      
      // Set target for rendering
      context.ai.setTarget(targetId);
      
      return NodeStatus.Success;
    }

    return NodeStatus.Failure;
  }

  private resolveTarget(targetParam: string, context: AIContext): EntityId | null {
    if (targetParam === 'self.target' || targetParam === 'target') {
      return context.ai.targetId;
    }
    
    if (targetParam === 'nearest_enemy') {
      const enemies = context.ai.getBlackboard<EntityId[]>('found_enemies');
      if (enemies && enemies.length > 0) {
        return enemies[0] ?? null;
      }
      return this.findNearestEnemy(context);
    }

    return null;
  }

  private findNearestEnemy(context: AIContext): EntityId | null {
    const { world, entityId, position } = context;
    const enemies = world.query(CType.Position, CType.Health, CType.Enemy);
    
    let nearestId: EntityId | null = null;
    let nearestDist = Infinity;

    for (const id of enemies) {
      if (id === entityId) continue;
      
      const pos = world.getComponent<Position>(id, CType.Position);
      const health = world.getComponent<Health>(id, CType.Health);
      
      if (!pos || !health?.alive) continue;

      const dx = pos.x - position.x;
      const dy = pos.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = id;
      }
    }

    return nearestId;
  }
}

/** 移动到目标动作 */
export class MoveToNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const targetParam = this.getParam<string>('target', context, 'path_waypoint');
    const { position, ai } = context;
    
    let targetX: number | null = null;
    let targetY: number | null = null;

    if (targetParam === 'path_waypoint') {
      // TODO: implement path following
      return NodeStatus.Failure;
    } else if (targetParam === 'player_target') {
      // TODO: implement player control
      return NodeStatus.Failure;
    } else if (targetParam === 'home') {
      const homeX = ai.getBlackboard<number>('home_x');
      const homeY = ai.getBlackboard<number>('home_y');
      if (homeX !== undefined && homeY !== undefined) {
        targetX = homeX;
        targetY = homeY;
      }
    }

    if (targetX === null || targetY === null) {
      return NodeStatus.Failure;
    }

    // Check if already at target
    const dx = targetX - position.x;
    const dy = targetY - position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 5) {
      return NodeStatus.Success;
    }

    // TODO: implement actual movement
    return NodeStatus.Running;
  }
}

/** 等待动作 */
export class WaitNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const duration = this.getParam<number>('duration', context, 1.0);
    const waitUntil = context.ai.getBlackboard<number>('wait_until');
    
    if (waitUntil === undefined) {
      // Start waiting
      context.ai.setBlackboard('wait_until', context.currentTime + duration * 1000);
      return NodeStatus.Running;
    }

    if (context.currentTime >= waitUntil) {
      // Done waiting
      context.ai.setBlackboard('wait_until', undefined);
      return NodeStatus.Success;
    }

    return NodeStatus.Running;
  }
}

/**
 * 行为树类
 */
export class BehaviorTree {
  private root: BTNode;
  private config: BehaviorTreeConfig;

  constructor(config: BehaviorTreeConfig) {
    this.config = config;
    this.root = BehaviorTree.buildNode(config.root);
  }

  tick(context: AIContext): NodeStatus {
    return this.root.tick(context);
  }

  getConfig(): BehaviorTreeConfig {
    return this.config;
  }

  /**
   * 从配置构建行为树节点
   */
  static buildNode(config: BTNodeConfig): BTNode {
    const { type, params = {}, children = [] } = config;
    
    // Build child nodes
    const childNodes = children.map(child => BehaviorTree.buildNode(child));

    switch (type) {
      // Composite nodes
      case 'sequence':
        return new SequenceNode(type, childNodes, params);
      case 'selector':
        return new SelectorNode(type, childNodes, params);
      case 'parallel':
        // TODO: implement parallel node
        return new SequenceNode(type, childNodes, params);

      // Decorator nodes
      case 'inverter':
        return new InverterNode(type, childNodes[0]!, params);
      case 'repeater':
        // TODO: implement repeater node
        return childNodes[0] ?? new WaitNode(type, params);
      case 'until_fail':
        // TODO: implement until fail node
        return childNodes[0] ?? new WaitNode(type, params);
      case 'always_succeed':
        // TODO: implement always succeed node
        return childNodes[0] ?? new WaitNode(type, params);
      case 'cooldown':
        // TODO: implement cooldown node
        return childNodes[0] ?? new WaitNode(type, params);

      // Condition nodes
      case 'check_hp':
        return new CheckHPNode(type, params);
      case 'check_enemy_in_range':
        return new CheckEnemyInRangeNode(type, params);
      case 'check_cooldown':
        return new CheckCooldownNode(type, params);

      // Action nodes
      case 'attack':
        return new AttackNode(type, params);
      case 'move_to':
        return new MoveToNode(type, params);
      case 'wait':
        return new WaitNode(type, params);

      default:
        console.warn(`Unknown node type: ${type}`);
        return new WaitNode('fallback', { duration: 0.1 });
    }
  }
}
