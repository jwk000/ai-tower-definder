// ============================================================
// Tower Defender — RuleEngine
//
// 配置驱动架构的核心组件。
// 职责：将声明式配置转换为运行时行为。
// 
// 不替代ECS系统，而是提供配置驱动的调度层：
//   HealthSystem 检测死亡 → 通知 RuleEngine
//   RuleEngine 查找 onDeath 规则 → 执行规则
//
// 设计文档: design/02-unit-system.md (Section 7)
// ============================================================

import type { IWorld } from 'bitecs';
import { Position, Health, Faction, FactionVal, Category, UnitRef } from './components.js';
import type { UnitConfig, LifecycleRule, BehaviorRule, RuleHandler } from '../config/registry.js';

// ============================================================
// 类型定义
// ============================================================

/** 生命周期事件类型 */
export type LifecycleEvent =
  | 'onCreate'
  | 'onDeath'
  | 'onHit'
  | 'onAttack'
  | 'onKill'
  | 'onUpgrade'
  | 'onDestroy'
  | 'onEnter'
  | 'onLeave';

/** 事件上下文 — 传递给规则处理器的额外信息 */
export interface EventContext {
  /** 触发事件的时间 */
  time: number;
  /** 事件相关的实体ID（如攻击者、杀手等） */
  sourceId?: number;
  /** 事件相关的额外数据 */
  data?: Record<string, unknown>;
}

/** 规则处理器函数类型 */
export type RuleHandlerFn = (
  world: IWorld,
  entityId: number,
  params: Record<string, unknown>,
  context: EventContext,
) => void;

/** 行为规则提供者 */
export interface BehaviorRuleProvider {
  targetSelection: (world: IWorld, entityId: number, candidates: number[]) => number | null;
  attackMode: (world: IWorld, entityId: number, targetId: number, dt: number) => void;
  movementMode: (world: IWorld, entityId: number, dt: number) => void;
}

// ============================================================
// 规则引擎
// ============================================================

export class RuleEngine {
  /** 注册的规则处理器 */
  private handlers: Map<string, RuleHandlerFn> = new Map();

  /** 单位类型 → 生命周期规则 */
  private lifecycleRules: Map<string, Map<LifecycleEvent, LifecycleRule[]>> = new Map();

  /** 单位类型 → 行为规则提供者 */
  private behaviorRules: Map<string, BehaviorRuleProvider> = new Map();

  /** 已触发的一次性事件 */
  private firedOnceEvents: Map<string, Set<LifecycleEvent>> = new Map();

  // ---- 处理器注册 ----

  /**
   * 注册一个规则处理器
   * 例如: engine.registerHandler('deal_aoe_damage', (world, eid, params, ctx) => { ... })
   */
  registerHandler(type: string, handler: RuleHandlerFn): void {
    this.handlers.set(type, handler);
  }

  /**
   * 批量注册预定义处理器
   */
  registerHandlers(handlers: Record<string, RuleHandlerFn>): void {
    for (const [type, handler] of Object.entries(handlers)) {
      this.handlers.set(type, handler);
    }
  }

  // ---- 生命周期规则注册 ----

  /**
   * 为单位类型注册生命周期规则
   */
  registerLifecycleRules(unitConfigId: string, rules: Map<LifecycleEvent, LifecycleRule[]>): void {
    this.lifecycleRules.set(unitConfigId, rules);
  }

  // ---- 行为规则注册 ----

  /**
   * 为单位类型注册行为规则提供者
   */
  registerBehaviorRules(unitConfigId: string, provider: BehaviorRuleProvider): void {
    this.behaviorRules.set(unitConfigId, provider);
  }

  // ---- 事件分发 ----

  /**
   * 分发生命周期事件
   * @returns 是否找到并执行了规则
   */
  dispatch(
    world: IWorld,
    entityId: number,
    event: LifecycleEvent,
    context: EventContext = { time: 0 },
  ): boolean {
    // 获取单位类型
    const unitRef = UnitRef.configId[entityId];
    if (unitRef === undefined) return false;

    // 查找配置
    const configId = String(unitRef); // 通过 registry 查找实际 ID

    // 获取该类型的生命周期规则
    const eventRules = this.lifecycleRules.get(configId)?.get(event);
    if (!eventRules || eventRules.length === 0) return false;

    let handled = false;

    for (const rule of eventRules) {
      // 检查是否是一次性规则且已触发
      if (rule.fireOnce) {
        const fired = this.firedOnceEvents.get(configId + ':' + entityId);
        if (fired?.has(event)) continue;

        if (!fired) {
          this.firedOnceEvents.set(configId + ':' + entityId, new Set([event]));
        } else {
          fired.add(event);
        }
      }

      // 查找并执行处理器
      const handler = this.handlers.get(rule.type);
      if (handler) {
        handler(world, entityId, rule.params ?? {}, context);
        handled = true;
      } else {
        console.warn(`[RuleEngine] Unknown handler: ${rule.type}`);
      }
    }

    return handled;
  }

  // ---- 行为规则查询 ----

  /**
   * 获取单位的行为规则提供者
   */
  getBehaviorProvider(unitConfigId: string): BehaviorRuleProvider | undefined {
    return this.behaviorRules.get(unitConfigId);
  }

  /**
   * 获取实体的行为规则提供者（通过实体ID查找配置）
   */
  getBehaviorProviderForEntity(world: IWorld, entityId: number): BehaviorRuleProvider | undefined {
    const unitRef = UnitRef.configId[entityId];
    if (unitRef === undefined) return undefined;

    return this.behaviorRules.get(String(unitRef));
  }

  // ---- 查询实体 ----

  /**
   * 获取指定半径内的所有实体
   */
  getEntitiesInRadius(
    world: IWorld,
    centerX: number,
    centerY: number,
    radius: number,
    factionFilter: number[] = [],
  ): number[] {
    const result: number[] = [];
    // 遍历所有有 Position 的实体
    for (let eid = 0; eid < Position.x.length; eid++) {
      const x = Position.x[eid];
      const y = Position.y[eid];
      if (x === undefined || y === undefined) continue;

      // 距离检查
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      // 阵营过滤
      if (factionFilter.length > 0) {
        const faction = Faction.value[eid];
        if (faction === undefined || !factionFilter.includes(faction)) continue;
      }

      result.push(eid);
    }
    return result;
  }

  /**
   * 清除实体的触法记录
   */
  clearTriggeredEvents(entityId: number): void {
    // 清除所有匹配此实体ID的已触发事件
    for (const [key, _events] of this.firedOnceEvents) {
      if (key.endsWith(':' + entityId)) {
        this.firedOnceEvents.delete(key);
      }
    }
  }

  /**
   * 清空所有规则和处理器
   */
  reset(): void {
    this.handlers.clear();
    this.lifecycleRules.clear();
    this.behaviorRules.clear();
    this.firedOnceEvents.clear();
  }
}

// ============================================================
// 单例导出
// ============================================================

export const ruleEngine = new RuleEngine();
