import { NodeStatus, type BTNodeConfig, type BehaviorTreeConfig } from '../types/index.js';
import type { TowerWorld } from '../core/World.js';
import {
  AI,
  Position,
  Health,
  Attack,
  UnitTag,
  Tower,
  Movement,
  Production,
  ResourceTypeVal,
  AlertMark,
  AlertMarkVal,
  enemyQuery as enemyTargetQuery,
  towerQuery as towerTargetQuery,
  friendlyFighterQuery,
} from '../core/components.js';

// ============================================================
// Query helpers for leaf nodes — find entities in the world
// ============================================================

// Reuse pre-defined queries from components.ts:
//   enemyTargetQuery  → Position + Health + UnitTag (filter for isEnemy)
//   towerTargetQuery  → Position + Tower + Attack

/**
 * AI上下文 — 行为树执行时的环境信息 (bitecs-optimized)
 *
 * Leaf nodes read component stores directly via context.entityId.
 * The TowerWorld reference is available for entity manipulation
 * (spawning, destruction, etc.) and for running queries.
 */
export interface AIContext {
  /** Entity ID being processed */
  entityId: number;
  /** TowerWorld for entity manipulation */
  world: TowerWorld;
  /** Delta time in seconds */
  dt: number;
  /** Per-entity blackboard (AI state storage) */
  blackboard: Map<string, unknown>;
}

// ============================================================
// 行为树节点基类
// ============================================================

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

  /** 解析内置变量（从bitecs组件存储读取） */
  protected resolveVariable(varName: string, context: AIContext): unknown {
    const eid = context.entityId;
    switch (varName) {
      case 'hp': return Health.current[eid];
      case 'max_hp': return Health.max[eid];
      case 'hp_ratio': {
        const max = Health.max[eid]!;
        return max > 0 ? Health.current[eid]! / max : 0;
      }
      case 'atk': return Attack.damage[eid] ?? 0;
      case 'defense': return Health.armor[eid] ?? 0;
      case 'attack_speed': return Attack.attackSpeed[eid] ?? 0;
      case 'move_speed': return Movement.speed[eid] ?? 0;
      case 'attack_range': return Attack.range[eid] ?? 0;
      case 'alert_range': return Attack.alertRange[eid] ?? 0;
      case 'move_range': return Movement.moveRange[eid] ?? 0;
      case 'x': return Position.x[eid];
      case 'y': return Position.y[eid];
      default:
        // Check blackboard
        return context.blackboard.get(varName);
    }
  }

  /** 获取参数值（支持变量解析） */
  protected getParam<T>(key: string, context: AIContext, defaultValue?: T): T {
    const value = this.resolveParam(key, context);
    return (value as T) ?? (defaultValue as T);
  }
}

// ============================================================
// 组合节点
// ============================================================

export abstract class CompositeNode extends BTNode {
  protected children: BTNode[];

  constructor(name: string, children: BTNode[], params: Record<string, unknown> = {}) {
    super(name, params);
    this.children = children;
  }
}

/** 顺序节点 - 依次执行子节点，一个失败则失败 */
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

/** 选择节点 - 依次执行子节点，一个成功则成功 */
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

// ============================================================
// 装饰节点
// ============================================================

export abstract class DecoratorNode extends BTNode {
  protected child: BTNode;

  constructor(name: string, child: BTNode, params: Record<string, unknown> = {}) {
    super(name, params);
    this.child = child;
  }
}

/** 反转节点 - 反转子节点结果 */
export class InverterNode extends DecoratorNode {
  tick(context: AIContext): NodeStatus {
    const status = this.child.tick(context);
    if (status === NodeStatus.Success) return NodeStatus.Failure;
    if (status === NodeStatus.Failure) return NodeStatus.Success;
    return status;
  }
}

// ============================================================
// 条件/动作节点基类
// ============================================================

export abstract class ConditionNode extends BTNode {
  constructor(name: string, params: Record<string, unknown> = {}) {
    super(name, params);
  }
}

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
    const eid = context.entityId;
    const max = Health.max[eid]!;
    const ratio = max > 0 ? Health.current[eid]! / max : 0;

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
    const sameTile = this.getParam<boolean>('same_tile', context, false);
    const setTarget = this.getParam<boolean>('set_target', context, false);

    // same_tile: 用实体自身攻击范围作为检测距离
    const checkRange = sameTile
      ? (Attack.range[context.entityId] ?? range)
      : range;

    const enemies = this.findTargetsInRange(context, checkRange, targetType);

    if (enemies.length >= count) {
      context.blackboard.set('found_enemies', enemies);
      // Store nearest enemy as current_target if set_target is truthy
      if (setTarget && enemies[0] !== undefined) {
        context.blackboard.set('current_target', enemies[0]);
      }
      return NodeStatus.Success;
    }
    return NodeStatus.Failure;
  }

  private findTargetsInRange(context: AIContext, range: number, targetType: string): number[] {
    const { world, entityId } = context;
    const px = Position.x[entityId]!;
    const py = Position.y[entityId]!;
    const results: number[] = [];

    let candidateIds: readonly number[];

    if (targetType === 'tower') {
      candidateIds = towerTargetQuery(world.world);
    } else {
      // For 'soldier', 'any', or default: query enemies
      candidateIds = enemyTargetQuery(world.world);
    }

    for (const id of candidateIds) {
      if (id === entityId) continue;
      if (Health.current[id]! <= 0) continue;

      // Filter by type if needed
      if (targetType === 'tower') {
        // towerTargetQuery already filters for Tower component
      } else if (targetType === 'soldier') {
        // soldier = player-owned fighters, exclude enemies
        if (UnitTag.isEnemy[id] === 1) continue;
      } else {
        // 'any' or default: only enemies
        if (UnitTag.isEnemy[id] !== 1) continue;
      }

      const tx = Position.x[id]!;
      const ty = Position.y[id]!;
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= range) {
        results.push(id);
      }
    }

    return results;
  }
}

/** 检查范围内友方单位 */
export class CheckAllyInRangeNode extends ConditionNode {
  tick(context: AIContext): NodeStatus {
    const range = this.getParam<number>('range', context, 100);
    const count = this.getParam<number>('count', context, 1);
    const allies = this.findTargetsInRange(context, range);
    if (allies.length >= count) {
      context.blackboard.set('found_allies', allies);
      return NodeStatus.Success;
    }
    return NodeStatus.Failure;
  }
  private findTargetsInRange(context: AIContext, range: number): number[] {
    const { world, entityId } = context;
    const px = Position.x[entityId]!;
    const py = Position.y[entityId]!;
    const candidates = friendlyFighterQuery(world.world);
    const results: number[] = [];
    for (const id of candidates) {
      if (id === entityId) continue;
      if (Health.current[id]! <= 0) continue;
      const tx = Position.x[id]!;
      const ty = Position.y[id]!;
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range) results.push(id);
    }
    return results;
  }
}

/** 检查技能冷却 */
export class CheckCooldownNode extends ConditionNode {
  tick(context: AIContext): NodeStatus {
    // TODO: implement cooldown check with Skill component
    return NodeStatus.Failure;
  }
}

// ==================== 动作节点实现 ====================

/** 攻击动作 */
export class AttackNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const targetParam = this.getParam<string>('target', context, 'nearest_enemy');
    const damageType = this.getParam<string>('damage_type', context, 'direct');
    const eid = context.entityId;
    const attackDmg = Attack.damage[eid];
    const atkSpeed = Attack.attackSpeed[eid];
    if (attackDmg === undefined) return NodeStatus.Failure;

    // all_in_range: 攻击 check_enemy_in_range 已找到的所有敌人
    if (targetParam === 'all_in_range') {
      const enemies = context.blackboard.get('found_enemies') as number[] | undefined;
      if (!enemies || enemies.length === 0) return NodeStatus.Failure;
      const cooldown = Attack.cooldownTimer[eid]!;
      if (cooldown > 0) return NodeStatus.Failure;
      Attack.cooldownTimer[eid] = 1 / atkSpeed!;
      for (const tid of enemies) {
        if (Health.current[tid]! <= 0) continue;
        Health.current[tid]! -= damageType === 'dot' ? attackDmg * context.dt : attackDmg;
      }
      AI.targetId[eid] = enemies[0]!;
      return NodeStatus.Success;
    }

    // ---- 单目标攻击 ----
    const targetId = this.resolveTarget(targetParam, context);
    if (targetId === 0) return NodeStatus.Failure;
    const attackRange = Attack.range[eid];
    const targetX = Position.x[targetId];
    const targetY = Position.y[targetId];
    const targetHp = Health.current[targetId];
    if (targetX === undefined || targetHp! <= 0) return NodeStatus.Failure;
    if (attackRange !== undefined) {
      const dx = targetX - Position.x[eid]!;
      const dy = targetY! - Position.y[eid]!;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > attackRange) return NodeStatus.Failure;
    }
    const cooldown = Attack.cooldownTimer[eid]!;
    if (cooldown <= 0) {
      Attack.cooldownTimer[eid] = 1 / atkSpeed!;
      const isEnemy = UnitTag.isEnemy[eid] === 1;
      const isTower = Tower.towerType[eid] !== undefined;
      if (isEnemy) {
        Attack.targetId[eid] = targetId;
      } else if (isTower) {
        Attack.targetId[eid] = targetId;
      } else {
        Health.current[targetId]! -= damageType === 'dot' ? attackDmg * context.dt : attackDmg;
        if (UnitTag.isEnemy[targetId] === 1 && Attack.damage[targetId] !== undefined) {
          Attack.targetId[targetId] = eid;
        }
      }
      AI.targetId[eid] = targetId;
      return NodeStatus.Success;
    }
    return NodeStatus.Failure;
  }

  private resolveTarget(targetParam: string, context: AIContext): number {
    if (targetParam === 'self.target' || targetParam === 'target') {
      return AI.targetId[context.entityId] ?? 0;
    }

    if (targetParam === 'nearest_enemy') {
      const enemies = context.blackboard.get('found_enemies') as number[] | undefined;
      if (enemies && enemies.length > 0) {
        return enemies[0] ?? 0;
      }
      return this.findNearestEnemy(context);
    }

    return 0;
  }

  private findNearestEnemy(context: AIContext): number {
    const { world, entityId } = context;
    const px = Position.x[entityId]!;
    const py = Position.y[entityId]!;
    const candidates = enemyTargetQuery(world.world);

    let nearestId = 0;
    let nearestDist = Infinity;

    for (const id of candidates) {
      if (id === entityId) continue;
      if (UnitTag.isEnemy[id] !== 1) continue;
      if (Health.current[id]! <= 0) continue;

      const tx = Position.x[id]!;
      const ty = Position.y[id]!;
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = id;
      }
    }

    return nearestId;
  }
}

/** 治疗友方单位 — 治疗 blackboard 的 found_allies */
export class HealNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const amount = this.getParam<number>('amount', context, 10);
    const allies = context.blackboard.get('found_allies') as number[] | undefined;
    if (!allies || allies.length === 0) return NodeStatus.Failure;
    for (const aid of allies) {
      const hp = Health.current[aid];
      const maxHp = Health.max[aid];
      if (hp !== undefined && maxHp !== undefined && hp > 0) {
        Health.current[aid] = Math.min(maxHp, hp + amount * context.dt);
      }
    }
    return NodeStatus.Success;
  }
}

/** 移动到目标动作 */
export class MoveToNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const targetParam = this.getParam<string>('target', context, 'path_waypoint');
    const eid = context.entityId;
    const px = Position.x[eid]!;
    const py = Position.y[eid]!;

    let targetX: number | null = null;
    let targetY: number | null = null;

    if (targetParam === 'path_waypoint') {
      // TODO: implement path following via Movement component
      // MovementSystem handles the actual movement.
      // AI just sets the move mode.
      Movement.moveMode[eid] = 0; // FollowPath
      return NodeStatus.Running;
    } else if (targetParam === 'player_target') {
      // TODO: implement player control
      return NodeStatus.Failure;
    } else if (targetParam === 'home') {
      const homeX = context.blackboard.get('home_x') as number | undefined;
      const homeY = context.blackboard.get('home_y') as number | undefined;
      if (homeX !== undefined && homeY !== undefined) {
        targetX = homeX;
        targetY = homeY;
      }
    }

    if (targetX === null || targetY === null) {
      return NodeStatus.Failure;
    }

    // Check if already at target
    const dx = targetX - px;
    const dy = targetY - py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      return NodeStatus.Success;
    }

    // Set movement target
    Movement.targetX[eid] = targetX;
    Movement.targetY[eid] = targetY;
    return NodeStatus.Running;
  }
}

/** 追击敌人动作 — 持续向最近敌人移动，始终返回 Running */
export class MoveTowardsNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const eid = context.entityId;
    const px = Position.x[eid]!;
    const py = Position.y[eid]!;

    // 如果设置了 max_range，检查是否超出 home 范围
    const maxRange = this.getParam<number>('max_range', context, 0);
    if (maxRange > 0) {
      const homeX = Movement.homeX[eid];
      const homeY = Movement.homeY[eid];
      if (homeX !== undefined && homeY !== undefined) {
        const dx = px - homeX;
        const dy = py - homeY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRange) {
          return NodeStatus.Failure;
        }
      }
    }

    // 查找最近敌人
    const targetId = this.findNearestEnemy(context);
    if (targetId === 0) {
      return NodeStatus.Failure;
    }

    const tx = Position.x[targetId]!;
    const ty = Position.y[targetId]!;

    // 已在攻击范围内则停止追击（留给 attack 节点处理）
    const attackRange = Attack.range[eid];
    if (attackRange !== undefined) {
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= attackRange) {
        return NodeStatus.Success; // 已进入攻击范围
      }
    }

    // 设置移动目标，持续追击
    Movement.targetX[eid] = tx;
    Movement.targetY[eid] = ty;
    return NodeStatus.Running;
  }

  private findNearestEnemy(context: AIContext): number {
    const { world, entityId } = context;
    const px = Position.x[entityId]!;
    const py = Position.y[entityId]!;
    const candidates = enemyTargetQuery(world.world);

    let nearestId = 0;
    let nearestDist = Infinity;

    for (const id of candidates) {
      if (id === entityId) continue;
      if (UnitTag.isEnemy[id] !== 1) continue;
      if (Health.current[id]! <= 0) continue;

      const tx = Position.x[id]!;
      const ty = Position.y[id]!;
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = id;
      }
    }

    return nearestId;
  }
}

/** 资源生产动作 — 按 rate × dt 累积，满 1 后产出到经济系统 */
export class ProduceResourceNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const eid = context.entityId;
    const rate = Production.rate[eid];
    if (rate === undefined) return NodeStatus.Failure;

    Production.accumulator[eid]! += rate * context.dt;

    // 检查是否需要产出（需要访问 EconomySystem）
    // ProductionSystem 会独立处理，这里只做累积标记
    return NodeStatus.Success;
  }
}

/** 等待动作 */
export class WaitNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const duration = this.getParam<number>('duration', context, 1.0);
    const waitUntil = context.blackboard.get('wait_until') as number | undefined;

    if (waitUntil === undefined) {
      // Start waiting — use elapsed time stored in blackboard
      context.blackboard.set('wait_elapsed', 0);
      return NodeStatus.Running;
    }

    // Accumulate elapsed time
    const elapsed = (context.blackboard.get('wait_elapsed') as number) ?? 0;
    const newElapsed = elapsed + context.dt;
    context.blackboard.set('wait_elapsed', newElapsed);

    if (newElapsed >= duration) {
      // Done waiting
      context.blackboard.delete('wait_elapsed');
      return NodeStatus.Success;
    }

    return NodeStatus.Running;
  }
}

/** 设置AI状态 — 写入 blackboard 'ai_state' */
export class SetStateNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const state = this.getParam<string>('state', context, '');
    if (state) {
      context.blackboard.set('ai_state', state);
    }
    return NodeStatus.Success;
  }
}

/** 显示警戒标记 — 设置 AlertMark 为 Blinking 或 Solid */
export class ShowAlertMarkNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const blink = this.getParam<boolean>('blink', context, false);
    const eid = context.entityId;
    // Check if AlertMark component exists on entity
    AlertMark.visible[eid] = blink ? AlertMarkVal.Blinking : AlertMarkVal.Solid;
    AlertMark.blink[eid] = blink ? 1 : 0;
    return NodeStatus.Success;
  }
}

/** 隐藏警戒标记 — 设置 AlertMark.visible 为 Hidden */
export class HideAlertMarkNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const eid = context.entityId;
    AlertMark.visible[eid] = AlertMarkVal.Hidden;
    return NodeStatus.Success;
  }
}

/** 检查与出生点的距离 — 大于阈值返回 Success */
export class CheckDistanceFromHomeNode extends ConditionNode {
  tick(context: AIContext): NodeStatus {
    const min = this.getParam<number>('min', context, 5);
    const eid = context.entityId;
    const hx = Movement.homeX[eid];
    const hy = Movement.homeY[eid];
    const px = Position.x[eid];
    const py = Position.y[eid];

    if (hx === undefined || hy === undefined || px === undefined || py === undefined) {
      return NodeStatus.Failure;
    }

    const dx = px - hx;
    const dy = py - hy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    return dist > min ? NodeStatus.Success : NodeStatus.Failure;
  }
}

/** 游荡动作 — 在出生点半径内随机移动，始终返回 Running */
export class WanderNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const radius = this.getParam<number>('radius', context, 100);
    const speedRatio = this.getParam<number>('speed_ratio', context, 0.5);
    const eid = context.entityId;

    // Initialize / increment elapsed time
    const elapsed = ((context.blackboard.get('wander_elapsed') as number) ?? 0) + context.dt;
    context.blackboard.set('wander_elapsed', elapsed);

    const nextPick = context.blackboard.get('wander_next_pick_time') as number | undefined;

    // Pick a new wander target if needed
    if (nextPick === undefined || elapsed >= nextPick) {
      const homeX = Movement.homeX[eid] ?? Position.x[eid]!;
      const homeY = Movement.homeY[eid] ?? Position.y[eid]!;

      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      context.blackboard.set('wander_target_x', homeX + Math.cos(angle) * dist);
      context.blackboard.set('wander_target_y', homeY + Math.sin(angle) * dist);

      // Schedule next pick in 2-4 seconds
      context.blackboard.set('wander_next_pick_time', elapsed + 2 + Math.random() * 2);
    }

    // Set movement targets
    const tx = context.blackboard.get('wander_target_x') as number;
    const ty = context.blackboard.get('wander_target_y') as number;
    if (tx !== undefined && ty !== undefined) {
      Movement.targetX[eid] = tx;
      Movement.targetY[eid] = ty;
    }

    // Store original speed on first tick if not already stored
    if (context.blackboard.get('wander_original_speed') === undefined) {
      context.blackboard.set('wander_original_speed', Movement.speed[eid]);
    }

    // Apply speed ratio (each tick, in case speed changes externally)
    const origSpeed = context.blackboard.get('wander_original_speed') as number;
    Movement.speed[eid] = origSpeed * speedRatio;

    return NodeStatus.Running;
  }
}

// ============================================================
// 行为树类
// ============================================================

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
   * 从配置构建行为树节点（核心框架，未改动）
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
      case 'check_distance_from_home':
        return new CheckDistanceFromHomeNode(type, params);
      case 'check_ally_in_range':
        return new CheckAllyInRangeNode(type, params);

      // Action nodes
      case 'attack':
        return new AttackNode(type, params);
      case 'move_to':
        return new MoveToNode(type, params);
      case 'move_towards':
        return new MoveTowardsNode(type, params);
      case 'produce_resource':
        return new ProduceResourceNode(type, params);
      case 'heal':
        return new HealNode(type, params);
      case 'wait':
        return new WaitNode(type, params);
      case 'set_state':
        return new SetStateNode(type, params);
      case 'show_alert_mark':
        return new ShowAlertMarkNode(type, params);
      case 'hide_alert_mark':
        return new HideAlertMarkNode(type, params);
      case 'wander':
        return new WanderNode(type, params);

      default:
        console.warn(`Unknown node type: ${type}`);
        return new WaitNode('fallback', { duration: 0.1 });
    }
  }
}
