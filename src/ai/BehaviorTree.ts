import { NodeStatus, TowerType, type BTNodeConfig, type BehaviorTreeConfig, type MapConfig } from '../types/index.js';
import { hasComponent } from 'bitecs';
import type { TowerWorld } from '../core/World.js';
import { getGlobalRandom } from '../utils/Random.js';
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
  Layer,
  LayerVal,
  Faction,
  FactionVal,
  MissileCharge,
  TargetingMark,
  Visual,
  ShapeVal,
  enemyQuery as enemyTargetQuery,
  towerQuery as towerTargetQuery,
  friendlyFighterQuery,
} from '../core/components.js';
import { spawnBomb } from '../systems/BombSystem.js';
import { addBuff } from '../systems/BuffSystem.js';
import { evaluateMissileTarget } from '../systems/MissileTargeting.js';
import {
  spawnMissileProjectile,
  spawnProjectile,
  doLightningAttack,
  doLaserAttack,
  findEnemiesInRange,
  TOWER_SHOOT_SOUNDS,
} from '../systems/AttackSystem.js';
import { doEnemyAttack } from '../systems/EnemyAttackSystem.js';
import { Sound } from '../utils/Sound.js';
import { TOWER_CONFIGS } from '../data/gameData.js';

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
  /** Optional: 当前天气 provider（check_weather 节点使用）*/
  getWeather?: () => string;
  /** Optional: 技能施放 provider（use_skill 节点使用） */
  castSkill?: (entityId: number, skillId: string) => boolean;
  /** Optional: 地图配置 provider（select_missile_target 节点需要 grid↔pixel 换算）*/
  getMapConfig?: () => MapConfig | null;
}

// ============================================================
// 行为树节点基类
// ============================================================

export abstract class BTNode {
  private static nextNodeId = 0;
  protected name: string;
  protected params: Record<string, unknown>;
  protected readonly nodeId: number;

  constructor(name: string, params: Record<string, unknown> = {}) {
    this.name = name;
    this.params = params;
    this.nodeId = BTNode.nextNodeId++;
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

export class ParallelNode extends CompositeNode {
  tick(context: AIContext): NodeStatus {
    const successPolicy = (this.params['successPolicy'] as string) ?? 'requireAll';
    const failurePolicy = (this.params['failurePolicy'] as string) ?? 'requireOne';

    let successCount = 0;
    let failureCount = 0;
    let runningCount = 0;

    for (const child of this.children) {
      const status = child.tick(context);
      if (status === NodeStatus.Success) successCount++;
      else if (status === NodeStatus.Failure) failureCount++;
      else runningCount++;
    }

    const failed = failurePolicy === 'requireOne'
      ? failureCount >= 1
      : failureCount >= this.children.length;
    if (failed) return NodeStatus.Failure;

    const succeeded = successPolicy === 'requireOne'
      ? successCount >= 1
      : successCount >= this.children.length;
    if (succeeded) return NodeStatus.Success;

    return runningCount > 0 ? NodeStatus.Running : NodeStatus.Failure;
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

export class RepeaterNode extends DecoratorNode {
  tick(context: AIContext): NodeStatus {
    const count = (this.params['count'] as number) ?? -1;
    const key = `__n${this.nodeId}_iter`;
    let iter = (context.blackboard.get(key) as number | undefined) ?? 0;

    const status = this.child.tick(context);
    if (status === NodeStatus.Running) return NodeStatus.Running;
    if (status === NodeStatus.Failure) {
      context.blackboard.set(key, 0);
      return NodeStatus.Failure;
    }

    iter++;
    if (count >= 0 && iter >= count) {
      context.blackboard.set(key, 0);
      return NodeStatus.Success;
    }
    context.blackboard.set(key, iter);
    return NodeStatus.Running;
  }
}

export class UntilFailNode extends DecoratorNode {
  tick(context: AIContext): NodeStatus {
    const status = this.child.tick(context);
    if (status === NodeStatus.Failure) return NodeStatus.Success;
    return NodeStatus.Running;
  }
}

export class AlwaysSucceedNode extends DecoratorNode {
  tick(context: AIContext): NodeStatus {
    const status = this.child.tick(context);
    if (status === NodeStatus.Running) return NodeStatus.Running;
    return NodeStatus.Success;
  }
}

export class CooldownNode extends DecoratorNode {
  tick(context: AIContext): NodeStatus {
    const elapsedKey = `__n${this.nodeId}_elapsed`;
    const lastKey = `__n${this.nodeId}_lastSuccess`;
    const seconds = (this.params['seconds'] as number) ?? 0;

    const elapsed = ((context.blackboard.get(elapsedKey) as number | undefined) ?? 0) + context.dt;
    context.blackboard.set(elapsedKey, elapsed);

    const lastSuccess = (context.blackboard.get(lastKey) as number | undefined) ?? -Infinity;
    if (elapsed - lastSuccess < seconds) {
      return NodeStatus.Failure;
    }
    const status = this.child.tick(context);
    if (status === NodeStatus.Success) {
      context.blackboard.set(lastKey, elapsed);
    }
    return status;
  }
}

export class OnceNode extends DecoratorNode {
  tick(context: AIContext): NodeStatus {
    const key = `__n${this.nodeId}_fired`;
    if (context.blackboard.get(key) === true) return NodeStatus.Failure;
    const status = this.child.tick(context);
    if (status === NodeStatus.Success) {
      context.blackboard.set(key, true);
    }
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
    return NodeStatus.Failure;
  }
}

export class CheckCurrentTargetAliveNode extends ConditionNode {
  tick(context: AIContext): NodeStatus {
    const targetId = context.blackboard.get('current_target') as number | undefined;
    if (targetId === undefined) return NodeStatus.Failure;
    const hp = Health.current[targetId];
    if (hp === undefined || hp <= 0) {
      context.blackboard.delete('current_target');
      return NodeStatus.Failure;
    }
    return NodeStatus.Success;
  }
}

export class CheckCurrentTargetInRangeNode extends ConditionNode {
  tick(context: AIContext): NodeStatus {
    const targetId = context.blackboard.get('current_target') as number | undefined;
    if (targetId === undefined) return NodeStatus.Failure;
    const hp = Health.current[targetId];
    if (hp === undefined || hp <= 0) {
      context.blackboard.delete('current_target');
      return NodeStatus.Failure;
    }
    const eid = context.entityId;
    const range = this.getParam<number>('range', context, Attack.range[eid] ?? 0);
    const dx = Position.x[targetId]! - Position.x[eid]!;
    const dy = Position.y[targetId]! - Position.y[eid]!;
    return dx * dx + dy * dy <= range * range
      ? NodeStatus.Success
      : NodeStatus.Failure;
  }
}

export class CheckLayerNode extends ConditionNode {
  tick(context: AIContext): NodeStatus {
    const expected = this.getParam<number | number[]>('layer', context, -1);
    const actual = Layer.value[context.entityId];
    if (actual === undefined) return NodeStatus.Failure;
    if (Array.isArray(expected)) {
      return expected.includes(actual) ? NodeStatus.Success : NodeStatus.Failure;
    }
    return actual === expected ? NodeStatus.Success : NodeStatus.Failure;
  }
}

export class CheckWeatherNode extends ConditionNode {
  tick(context: AIContext): NodeStatus {
    if (!context.getWeather) return NodeStatus.Failure;
    const expected = this.getParam<string | string[]>('weather', context, '');
    const current = context.getWeather();
    if (Array.isArray(expected)) {
      return expected.includes(current) ? NodeStatus.Success : NodeStatus.Failure;
    }
    return current === expected ? NodeStatus.Success : NodeStatus.Failure;
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

    if (targetParam === 'current_target') {
      const t = context.blackboard.get('current_target') as number | undefined;
      return t ?? 0;
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

    return NodeStatus.Success;
  }
}

export class UseSkillNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    if (!context.castSkill) return NodeStatus.Failure;
    const skillId = this.getParam<string>('skill_id', context, '');
    if (!skillId) return NodeStatus.Failure;
    return context.castSkill(context.entityId, skillId)
      ? NodeStatus.Success
      : NodeStatus.Failure;
  }
}

export class TriggerTrapNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const cd = this.getParam<number>('cd', context, 1.0);
    const lastKey = `__n${this.nodeId}_lastFired`;
    const elapsedKey = `__n${this.nodeId}_elapsed`;

    const elapsed = ((context.blackboard.get(elapsedKey) as number | undefined) ?? 0) + context.dt;
    context.blackboard.set(elapsedKey, elapsed);

    const lastFired = (context.blackboard.get(lastKey) as number | undefined) ?? -Infinity;
    if (elapsed - lastFired < cd) return NodeStatus.Failure;

    const damage = this.getParam<number>('damage', context, 0);
    const radius = this.getParam<number>('radius', context, 0);
    const eid = context.entityId;
    const px = Position.x[eid];
    const py = Position.y[eid];
    if (px === undefined || py === undefined) return NodeStatus.Failure;

    const enemies = enemyTargetQuery(context.world.world);
    for (const target of enemies) {
      if (UnitTag.isEnemy[target] !== 1) continue;
      if ((Health.current[target] ?? 0) <= 0) continue;
      const dx = (Position.x[target] ?? 0) - px;
      const dy = (Position.y[target] ?? 0) - py;
      if (dx * dx + dy * dy <= radius * radius) {
        Health.current[target] = Math.max(0, (Health.current[target] ?? 0) - damage);
      }
    }

    context.blackboard.set(lastKey, elapsed);
    return NodeStatus.Success;
  }
}

export class IgnoreInvulnerableNode extends DecoratorNode {
  tick(context: AIContext): NodeStatus {
    const status = this.child.tick(context);
    const target = context.blackboard.get('current_target') as number | undefined;
    if (target === undefined) return status;
    const invulnSet = context.blackboard.get('invulnerable_set') as Set<number> | undefined;
    if (invulnSet && invulnSet.has(target)) {
      context.blackboard.delete('current_target');
      return NodeStatus.Failure;
    }
    return status;
  }
}

export class OnTargetDeadReselectNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const current = context.blackboard.get('current_target') as number | undefined;
    const alive = current !== undefined && (Health.current[current] ?? 0) > 0;
    if (alive) return NodeStatus.Success;

    if (current !== undefined) context.blackboard.delete('current_target');

    const range = this.getParam<number>('range', context, 100);
    const setTarget = this.getParam<boolean>('set_target', context, true);
    const eid = context.entityId;
    const px = Position.x[eid];
    const py = Position.y[eid];
    if (px === undefined || py === undefined) return NodeStatus.Failure;

    const candidates = enemyTargetQuery(context.world.world);
    let bestId = -1;
    let bestDistSq = Infinity;
    for (const c of candidates) {
      if (c === eid) continue;
      if (UnitTag.isEnemy[c] !== 1) continue;
      if ((Health.current[c] ?? 0) <= 0) continue;
      const dx = (Position.x[c] ?? 0) - px;
      const dy = (Position.y[c] ?? 0) - py;
      const dsq = dx * dx + dy * dy;
      if (dsq <= range * range && dsq < bestDistSq) {
        bestDistSq = dsq;
        bestId = c;
      }
    }

    if (bestId === -1) return NodeStatus.Failure;
    if (setTarget) context.blackboard.set('current_target', bestId);
    return NodeStatus.Success;
  }
}

/**
 * DropBombNode — 投放重力炸弹（气球/未来塔投弹）
 *
 * 节点规格（design/23 §0.5 line 81）：
 *   params: damage / radius / cd / fall_speed?
 *   blackboard 输入: current_target（必需，用其 Position.y 作为引爆高度）
 *   blackboard 输出: 无（CD 状态用 __n${nodeId}_cd_* 隔离）
 *
 * 返回语义：
 *   - 无 current_target 或目标无 Position → FAILURE
 *   - CD 未到 → FAILURE
 *   - CD 到 + 有目标 → spawnBomb + SUCCESS（重置 CD）
 *
 * ownerFaction 自动从执行者的 Faction 组件读；无 Faction 默认 Enemy（兼容气球当前数据）。
 *
 * 注：design/23 §0.5 还列了 `falloff: float`，当前 BombSystem 半径内统一伤害，
 * falloff 未实现，参数若传入会被忽略。等 P3 优化（21 数值表当前无衰减需求）。
 */
export class DropBombNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const eid = context.entityId;
    const px = Position.x[eid];
    const py = Position.y[eid];
    if (px === undefined || py === undefined) return NodeStatus.Failure;

    const target = context.blackboard.get('current_target') as number | undefined;
    if (target === undefined) return NodeStatus.Failure;
    const ty = Position.y[target];
    if (ty === undefined) return NodeStatus.Failure;

    const cd = this.getParam<number>('cd', context, 3.0);
    const cdRemainingKey = `__n${this.nodeId}_cd_remaining`;
    const cdRemaining = ((context.blackboard.get(cdRemainingKey) as number | undefined) ?? 0) - context.dt;
    if (cdRemaining > 0) {
      context.blackboard.set(cdRemainingKey, cdRemaining);
      return NodeStatus.Failure;
    }

    const damage = this.getParam<number>('damage', context, 50);
    const radius = this.getParam<number>('radius', context, 60);
    const fallSpeed = this.getParam<number>('fall_speed', context, 300);

    const ownerFaction = hasComponent(context.world.world, Faction, eid)
      ? (Faction.value[eid] as number)
      : FactionVal.Enemy;

    spawnBomb(context.world, {
      fromX: px,
      fromY: py,
      targetY: ty,
      damage,
      radius,
      ownerFaction,
      fallSpeed,
    });

    context.blackboard.set(cdRemainingKey, cd);
    return NodeStatus.Success;
  }
}

/**
 * AuraBuffNode — 范围光环 buff，对应 design/23 §0.5 aura_buff
 *
 * 每 tick 扫描范围内符合阵营的单位，通过 BuffSystem.addBuff 刷新 buff。
 * addBuff 对重复 id 仅刷新 duration（不重置 stacks），保证单源叠加正确。
 *
 * 返回语义：
 *   - 范围内有合法目标 → 至少刷一个 buff → SUCCESS
 *   - 范围内无目标 → FAILURE（让选择器跳到 fallback 分支）
 *
 * 参数：
 *   buff_id (string, required)         buff 唯一 id（同源 shaman 共享 → 推荐 'shaman_aura'）
 *   attribute (string, default 'speed') 影响属性
 *   value (number, required)            buff 数值
 *   is_percent (bool, default false)    数值/百分比
 *   range (number, required)            光环半径 px
 *   target_faction (string, default 'ally')  'ally'/'enemy'/'all' - 阵营过滤
 *   duration (number, default 0.5)      每帧刷新窗口（留 dt 抖动 buffer）
 */
export class AuraBuffNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const eid = context.entityId;
    const sx = Position.x[eid];
    const sy = Position.y[eid];
    if (sx === undefined || sy === undefined) return NodeStatus.Failure;

    const buffId = this.getParam<string>('buff_id', context, '');
    if (!buffId) return NodeStatus.Failure;

    const attribute = this.getParam<string>('attribute', context, 'speed');
    const value = this.getParam<number>('value', context, 0);
    const isPercent = this.getParam<boolean>('is_percent', context, false);
    const range = this.getParam<number>('range', context, 0);
    const duration = this.getParam<number>('duration', context, 0.5);
    const targetFaction = this.getParam<string>('target_faction', context, 'ally');

    if (range <= 0 || value === 0) return NodeStatus.Failure;

    const selfFaction = hasComponent(context.world.world, Faction, eid)
      ? (Faction.value[eid] as number)
      : FactionVal.Enemy;

    const candidates = enemyTargetQuery(context.world.world);
    const r2 = range * range;
    let buffed = 0;

    for (let i = 0; i < candidates.length; i++) {
      const tid = candidates[i]!;
      if (Health.current[tid]! <= 0) continue;

      const tFaction = hasComponent(context.world.world, Faction, tid)
        ? (Faction.value[tid] as number)
        : (UnitTag.isEnemy[tid] === 1 ? FactionVal.Enemy : FactionVal.Player);

      if (targetFaction === 'ally' && tFaction !== selfFaction) continue;
      if (targetFaction === 'enemy' && tFaction === selfFaction) continue;

      const tx = Position.x[tid]!;
      const ty = Position.y[tid]!;
      const dx = tx - sx;
      const dy = ty - sy;
      if (dx * dx + dy * dy > r2) continue;

      addBuff(context.world, tid, {
        id: buffId,
        sourceId: eid,
        attribute,
        value,
        isPercent,
        duration,
        stacks: 1,
        maxStacks: 1,
        appliedAt: 0,
      });
      buffed++;
    }

    return buffed > 0 ? NodeStatus.Success : NodeStatus.Failure;
  }
}

/**
 * SelectMissileTargetNode — 导弹塔地格评分目标选择（design/23 §0.5）
 *
 * 节点规格：
 *   params: 无
 *   blackboard 输入: 无
 *   blackboard 输出: current_target_pos / current_target_score / current_target_enemy_count
 *
 * 返回语义：
 *   - 无 getMapConfig provider 或 map 为空 → FAILURE
 *   - 调 evaluateMissileTarget 后无目标格（无可命中地敌 / 全在射程外）→ 清黑板 + FAILURE
 *   - 找到最佳目标格 → 写黑板 + SUCCESS
 *
 * 黑板写入位置而非 entity id 因为 missile 目标是「网格中心像素坐标」（地格评分结果），
 * 与一般 attack 节点用 current_target=entityId 不同；charge_attack/launch 节点消费此结果。
 *
 * 注：射程过滤、飞行敌过滤已由 evaluateMissileTarget 内部完成（读 Attack.range[tower]
 * 与 TOWER_CONFIGS[Missile].cantTargetFlying）。caller 直接传完整 enemy 列表即可。
 */
export class SelectMissileTargetNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const map = context.getMapConfig?.();
    if (!map) return NodeStatus.Failure;

    const eid = context.entityId;
    const enemies = enemyTargetQuery(context.world.world);
    const aliveEnemies: number[] = [];
    for (const e of enemies) {
      if ((Health.current[e] ?? 0) > 0) aliveEnemies.push(e);
    }

    const result = evaluateMissileTarget(context.world, eid, aliveEnemies, map);
    if (!result) {
      context.blackboard.delete('current_target_pos');
      context.blackboard.delete('current_target_score');
      context.blackboard.delete('current_target_enemy_count');
      return NodeStatus.Failure;
    }

    context.blackboard.set('current_target_pos', {
      x: result.targetX,
      y: result.targetY,
      row: result.row,
      col: result.col,
    });
    context.blackboard.set('current_target_score', result.score);
    context.blackboard.set('current_target_enemy_count', result.enemyCount);
    return NodeStatus.Success;
  }
}

/**
 * ChargeAttackNode — 导弹塔蓄力（design/23 §0.5）
 *
 * 节点规格：
 *   params: { charge_time?: number }  — 默认 0.6 秒
 *   blackboard 输入: current_target_pos = {x,y,row,col}（由 SelectMissileTargetNode 写入）
 *   blackboard 输出: 无（蓄力状态通过 MissileCharge ECS 组件管理，
 *                    与 RenderSystem 蓄力视觉脉冲共用真理源）
 *
 * 返回语义：
 *   - 首次进入（塔身无 MissileCharge 组件）：
 *     · Attack.cooldownTimer > 0 → FAILURE（装弹未完成，等待下一帧；
 *       cooldown 由 AISystem 每帧 tick 递减）
 *     · 无 current_target_pos → FAILURE
 *     · 装弹完毕且有目标 → spawn 红色 TargetingMark 实体 + 挂 MissileCharge 组件 → RUNNING
 *   - 持续 tick（塔身已有 MissileCharge 组件）：
 *     · chargeElapsed += dt；未满 → RUNNING；满 → SUCCESS
 *     · SUCCESS 时保留 MissileCharge 组件 + TargetingMark 实体，留给 LaunchMissileProjectileNode 消费
 *
 * 与原 AttackSystem.handleMissileTower 等价：保留 ECS 组件 + spawn mark + tick timer 三层逻辑。
 * cooldown 自检对应原 AttackSystem.update line 148 `if cooldownTimer > 0 continue`。
 */
export class ChargeAttackNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const eid = context.entityId;
    const world = context.world;

    if (hasComponent(world.world, MissileCharge, eid)) {
      const elapsed = (MissileCharge.chargeElapsed[eid] ?? 0) + context.dt;
      MissileCharge.chargeElapsed[eid] = elapsed;
      const total = MissileCharge.chargeTime[eid] ?? 0.6;
      return elapsed >= total ? NodeStatus.Success : NodeStatus.Running;
    }

    if ((Attack.cooldownTimer[eid] ?? 0) > 0) return NodeStatus.Failure;

    const targetPos = context.blackboard.get('current_target_pos') as
      | { x: number; y: number; row: number; col: number }
      | undefined;
    if (!targetPos) return NodeStatus.Failure;

    const chargeTime = this.getParam<number>('charge_time', context, 0.6);

    const towerCfg = TOWER_CONFIGS[TowerType.Missile];
    const blastRadius = towerCfg?.splashRadius ?? 120;
    const markId = world.createEntity();
    world.addComponent(markId, Position, { x: targetPos.x, y: targetPos.y });
    world.addComponent(markId, TargetingMark, {
      blastRadius: blastRadius * 0.5, // outer ring = 50% of blast radius
      pulsePhase: 0,
      ringRotation: 0,
    });
    world.addComponent(markId, Visual, {
      shape: ShapeVal.Cross,
      colorR: 0xff,
      colorG: 0x17,
      colorB: 0x44,
      size: blastRadius,
      alpha: 0.9,
      outline: 0,
      hitFlashTimer: 0,
      idlePhase: 0,
    });
    world.addComponent(markId, Layer, { value: LayerVal.AboveGrid });

    world.addComponent(eid, MissileCharge, {
      chargeTime,
      chargeElapsed: 0,
      targetX: targetPos.x,
      targetY: targetPos.y,
      markEntityId: markId,
    });

    return NodeStatus.Running;
  }
}

/**
 * LaunchMissileProjectileNode — 导弹塔发射（design/23 §0.5）
 *
 * 节点规格：
 *   params: 无
 *   blackboard 输入: 无（直接读 MissileCharge 组件，由 ChargeAttackNode 写入）
 *   blackboard 输出: 无
 *
 * 返回语义：
 *   - 塔身无 MissileCharge 组件 → FAILURE（必须由 charge_attack SUCCESS 前置）
 *   - 有组件 → 调 spawnMissileProjectile + Sound.play('tower_missile') +
 *     重置 cooldownTimer + 移除 MissileCharge → SUCCESS
 *
 * 副作用：
 *   - 创建 Projectile 实体（抛物线飞向 markEntityId 的位置，ProjectileSystem 接管）
 *   - 重置 Attack.cooldownTimer = 1 / attackSpeed（开始下一发装弹冷却）
 *   - 移除 tower 的 MissileCharge 组件（RenderSystem 蓄力视觉脉冲消失）
 *   - TargetingMark 实体保留（由 ProjectileSystem 命中时销毁，或 stale-cleanup）
 *
 * 与原 AttackSystem.handleMissileTower 等价：launch 阶段三件套（spawn projectile +
 * sound + cooldown reset + remove component）从 AttackSystem line 296-320 迁来。
 */
export class LaunchMissileProjectileNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const eid = context.entityId;
    const world = context.world;

    if (!hasComponent(world.world, MissileCharge, eid)) return NodeStatus.Failure;

    const targetX = MissileCharge.targetX[eid] ?? 0;
    const targetY = MissileCharge.targetY[eid] ?? 0;
    const markId = MissileCharge.markEntityId[eid] ?? 0;

    spawnMissileProjectile(world, eid, markId, targetX, targetY);
    Sound.play('tower_missile');

    const attackSpeed = Attack.attackSpeed[eid];
    if (attackSpeed && attackSpeed > 0) {
      Attack.cooldownTimer[eid] = 1 / attackSpeed;
    }

    world.removeComponent(eid, MissileCharge);
    return NodeStatus.Success;
  }
}

/**
 * SpawnProjectileTowerNode — 通用弹道塔发射（design/23 §0.5 `spawn_projectile_tower`）
 *
 * 节点规格：
 *   params: 无
 *   blackboard 输入: `current_target`（由 check_enemy_in_range 写入）
 *   blackboard 输出: 无
 *
 * 返回语义：
 *   - cooldownTimer > 0 → FAILURE（与 AttackSystem.update line 140 等价的冷却守卫）
 *   - 无 current_target / target 已死 → FAILURE
 *   - 成功 → spawnProjectile + Sound.play + set targetId + reset cooldown → SUCCESS
 *
 * 副作用（与 AttackSystem.update line 207-234 通用 spawnProjectile 路径等价）：
 *   - Projectile 实体（含 splash/slow/stun/freeze/lifeSteal 修饰，ProjectileSystem 命中执行）
 *   - Attack.targetId = current_target
 *   - Attack.cooldownTimer = 1 / attackSpeed
 *   - Sound.play(TOWER_SHOOT_SOUNDS[towerTypeVal])
 *
 * 服务 basic/cannon/ice/bat 4 塔；lightning/laser 用各自专用节点（chain / multi-beam 语义不同）。
 */
export class SpawnProjectileTowerNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const eid = context.entityId;
    const world = context.world;

    if ((Attack.cooldownTimer[eid] ?? 0) > 0) return NodeStatus.Failure;

    const targetId = context.blackboard.get('current_target') as number | undefined;
    if (targetId === undefined || targetId === 0) return NodeStatus.Failure;
    if ((Health.current[targetId] ?? 0) <= 0) return NodeStatus.Failure;

    const towerTypeVal = Tower.towerType[eid];
    if (towerTypeVal === undefined) return NodeStatus.Failure;

    spawnProjectile(world, eid, targetId, towerTypeVal);
    Sound.play(TOWER_SHOOT_SOUNDS[towerTypeVal] ?? 'tower_shoot');

    Attack.targetId[eid] = targetId;
    const attackSpeed = Attack.attackSpeed[eid];
    if (attackSpeed && attackSpeed > 0) {
      Attack.cooldownTimer[eid] = 1 / attackSpeed;
    }

    return NodeStatus.Success;
  }
}

/**
 * LightningChainNode — 闪电塔链式攻击（design/23 §0.5 `lightning_chain`）
 *
 * 节点规格：
 *   params: 无
 *   blackboard 输入: `current_target`（由 check_enemy_in_range 写入）
 *   blackboard 输出: 无
 *
 * 返回语义：
 *   - cooldownTimer > 0 → FAILURE
 *   - 无 current_target / target 已死 → FAILURE
 *   - 成功 → doLightningAttack（chainCount 跳 + 衰减 + LightningBolt 视觉）
 *           + Sound.play('tower_lightning') + set targetId + reset cooldown → SUCCESS
 *
 * 副作用（与 AttackSystem.update line 216-217 doLightningAttack 路径等价）：
 *   - chainCount = TOWER_CONFIGS.chainCount + (level-1) 跳；每跳衰减 chainDecay；
 *     每跳 spawn LightningBolt entity（视觉 0.5s）+ applyDamageToTarget
 *   - 首跳 Sound.play('lightning_hit')（在 doLightningAttack 内部）
 *   - 节点层 Sound.play('tower_lightning')（发射音，与命中音独立）
 *
 * 服务 lightning 塔（towerType=3 / TowerType.Lightning）。
 */
export class LightningChainNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const eid = context.entityId;
    const world = context.world;

    if ((Attack.cooldownTimer[eid] ?? 0) > 0) return NodeStatus.Failure;

    const targetId = context.blackboard.get('current_target') as number | undefined;
    if (targetId === undefined || targetId === 0) return NodeStatus.Failure;
    if ((Health.current[targetId] ?? 0) <= 0) return NodeStatus.Failure;

    const level = Tower.level[eid] ?? 1;

    doLightningAttack(world, eid, targetId, level);
    Sound.play('tower_lightning');

    Attack.targetId[eid] = targetId;
    const attackSpeed = Attack.attackSpeed[eid];
    if (attackSpeed && attackSpeed > 0) {
      Attack.cooldownTimer[eid] = 1 / attackSpeed;
    }

    return NodeStatus.Success;
  }
}

/**
 * LaserBeamNode — 激光塔多束自扫攻击（design/23 §0.5 `laser_beam`）
 *
 * 节点规格：
 *   params: 无
 *   blackboard 输入: 无（不依赖 current_target，节点自扫范围内全部活敌）
 *   blackboard 输出: 无
 *
 * 返回语义：
 *   - cooldownTimer > 0 → FAILURE
 *   - 范围内无活敌 → FAILURE
 *   - 成功 → doLaserAttack（spawn N 个 LaserBeam entity，N = getLaserBeamCount(level)）
 *           + Sound.play('tower_laser') + set targetId（第一束目标）+ reset cooldown → SUCCESS
 *
 * 副作用（与 AttackSystem.update line 220-233 laser 分支等价）：
 *   - 自扫 range 内活敌，按距离升序排序（findEnemiesInRange）
 *   - 取前 N 束（L1-2: 1 束 / L3-4: 2 束 / L5: 3 束），每束 spawn LaserBeam entity（duration 1.0s）
 *   - 持续伤害（DOT）由 LaserBeamSystem 周期 tick 实施，本节点不直接造伤
 *
 * 服务 laser 塔（towerType=4 / TowerType.Laser）。
 */
export class LaserBeamNode extends ActionNode {
  tick(context: AIContext): NodeStatus {
    const eid = context.entityId;
    const world = context.world;

    if ((Attack.cooldownTimer[eid] ?? 0) > 0) return NodeStatus.Failure;

    const range = Attack.range[eid] ?? 0;
    const enemiesInRange = findEnemiesInRange(world, eid, range);
    if (enemiesInRange.length === 0) return NodeStatus.Failure;

    const level = Tower.level[eid] ?? 1;
    doLaserAttack(world, eid, enemiesInRange, level);
    Sound.play('tower_laser');

    Attack.targetId[eid] = enemiesInRange[0]!.id;
    const attackSpeed = Attack.attackSpeed[eid];
    if (attackSpeed && attackSpeed > 0) {
      Attack.cooldownTimer[eid] = 1 / attackSpeed;
    }

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

      const rng = getGlobalRandom().wave;
      const angle = rng.next() * Math.PI * 2;
      const dist = rng.next() * radius;
      context.blackboard.set('wander_target_x', homeX + Math.cos(angle) * dist);
      context.blackboard.set('wander_target_y', homeY + Math.sin(angle) * dist);

      // Schedule next pick in 2-4 seconds
      context.blackboard.set('wander_next_pick_time', elapsed + 2 + rng.next() * 2);
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
        return new ParallelNode(type, childNodes, params);

      // Decorator nodes
      case 'inverter':
        return new InverterNode(type, childNodes[0]!, params);
      case 'repeater':
        return new RepeaterNode(type, childNodes[0]!, params);
      case 'until_fail':
        return new UntilFailNode(type, childNodes[0]!, params);
      case 'always_succeed':
        return new AlwaysSucceedNode(type, childNodes[0]!, params);
      case 'cooldown':
        return new CooldownNode(type, childNodes[0]!, params);
      case 'once':
        return new OnceNode(type, childNodes[0]!, params);

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
      case 'check_current_target_alive':
        return new CheckCurrentTargetAliveNode(type, params);
      case 'check_current_target_in_range':
        return new CheckCurrentTargetInRangeNode(type, params);
      case 'check_layer':
        return new CheckLayerNode(type, params);
      case 'check_weather':
        return new CheckWeatherNode(type, params);

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
      case 'use_skill':
        return new UseSkillNode(type, params);
      case 'trigger_trap':
        return new TriggerTrapNode(type, params);
      case 'on_target_dead_reselect':
        return new OnTargetDeadReselectNode(type, params);
      case 'drop_bomb':
        return new DropBombNode(type, params);
      case 'aura_buff':
        return new AuraBuffNode(type, params);
      case 'select_missile_target':
        return new SelectMissileTargetNode(type, params);
      case 'charge_attack':
        return new ChargeAttackNode(type, params);
      case 'launch_missile_projectile':
        return new LaunchMissileProjectileNode(type, params);
      case 'spawn_projectile_tower':
        return new SpawnProjectileTowerNode(type, params);
      case 'lightning_chain':
        return new LightningChainNode(type, params);
      case 'laser_beam':
        return new LaserBeamNode(type, params);
      case 'ignore_invulnerable':
        return new IgnoreInvulnerableNode(type, childNodes[0]!, params);

      default:
        console.warn(`Unknown node type: ${type}`);
        return new WaitNode('fallback', { duration: 0.1 });
    }
  }
}
