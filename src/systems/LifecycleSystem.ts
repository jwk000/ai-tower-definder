import { System, CType, LifecycleEvent, type EntityId, type EffectConfig } from '../types/index.js';
import type { World } from '../core/World.js';
import type { Lifecycle } from '../components/Lifecycle.js';
import type { UnitTag } from '../components/UnitTag.js';
import type { Health } from '../components/Health.js';
import { Position } from '../components/Position.js';

/**
 * 生命周期系统 - 处理单位的生命周期事件
 * 
 * 死亡和销毁的区别：
 * - 死亡（Death）：触发onDeath效果
 * - 销毁（Destroy）：不触发onDeath效果，直接移除
 */
export class LifecycleSystem implements System {
  readonly name = 'LifecycleSystem';
  readonly requiredComponents = [CType.Lifecycle, CType.UnitTag] as const;

  private world: World;
  
  /** 待处理的事件队列 */
  private eventQueue: Array<{
    entityId: EntityId;
    event: LifecycleEvent;
  }> = [];

  /** 效果处理器注册表 */
  private effectHandlers: Map<string, (entityId: EntityId, params: Record<string, unknown>) => void> = new Map();

  constructor(world: World) {
    this.world = world;
    
    // Register default effect handlers
    this.registerDefaultHandlers();
  }

  /**
   * 注册默认效果处理器
   */
  private registerDefaultHandlers(): void {
    // 销毁实体
    this.registerEffectHandler('destroy_entity', (entityId) => {
      this.world.destroyEntity(entityId);
    });

    // 金币奖励
    this.registerEffectHandler('reward_gold', (entityId, params) => {
      // TODO: integrate with economy system
      console.log(`Reward ${params.amount} gold for entity ${entityId}`);
    });

    // 释放人口
    this.registerEffectHandler('release_population', (entityId, params) => {
      // TODO: integrate with economy system
      console.log(`Release ${params.cost} population for entity ${entityId}`);
    });

    // 死亡特效
    this.registerEffectHandler('death_effect', (entityId) => {
      const pos = this.world.getComponent<Position>(entityId, CType.Position);
      if (pos) {
        // Create death effect entity
        const effectId = this.world.createEntity();
        this.world.addComponent(effectId, new Position(pos.x, pos.y));
        // TODO: add death effect component
      }
    });

    // 爆炸效果
    this.registerEffectHandler('explode', (entityId, params) => {
      const pos = this.world.getComponent<Position>(entityId, CType.Position);
      if (pos) {
        const radius = params.radius as number ?? 50;
        const damage = params.damage as number ?? 20;
        
        // Find entities in radius
        const entities = this.world.query(CType.Position, CType.Health);
        for (const id of entities) {
          if (id === entityId) continue;
          
          const targetPos = this.world.getComponent<Position>(id, CType.Position);
          const health = this.world.getComponent<Health>(id, CType.Health);
          
          if (!targetPos || !health?.alive) continue;

          const dx = targetPos.x - pos.x;
          const dy = targetPos.y - pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= radius) {
            health.takeDamage(damage);
          }
        }
      }
    });

    // Boss介绍
    this.registerEffectHandler('boss_intro', (entityId) => {
      // TODO: implement boss intro animation
      console.log(`Boss intro for entity ${entityId}`);
    });

    // 游戏结束
    this.registerEffectHandler('game_over', (entityId, params) => {
      // TODO: integrate with game phase system
      console.log(`Game over: ${params.result}`);
    });

    // 闪白效果
    this.registerEffectHandler('flash_white', (entityId, params) => {
      // TODO: integrate with render system
      console.log(`Flash white for entity ${entityId}`);
    });

    // 创建爆炸特效
    this.registerEffectHandler('create_explosion', (entityId, params) => {
      // TODO: create explosion effect entity
      console.log(`Create explosion for entity ${entityId}`);
    });

    // 应用减速
    this.registerEffectHandler('apply_slow', (entityId, params) => {
      // TODO: integrate with buff system
      console.log(`Apply slow to entity ${entityId}`);
    });

    // 链式闪电
    this.registerEffectHandler('chain_lightning', (entityId, params) => {
      // TODO: integrate with attack system
      console.log(`Chain lightning from entity ${entityId}`);
    });
  }

  /**
   * 注册效果处理器
   */
  registerEffectHandler(effectType: string, handler: (entityId: EntityId, params: Record<string, unknown>) => void): void {
    this.effectHandlers.set(effectType, handler);
  }

  /**
   * 触发生命周期事件
   */
  triggerEvent(entityId: EntityId, event: LifecycleEvent): void {
    this.eventQueue.push({ entityId, event });
  }

  /**
   * 更新生命周期系统
   */
  update(entities: EntityId[], dt: number): void {
    // Process queued events
    this.processEventQueue();

    // Check for death conditions
    this.checkDeathConditions(entities);
  }

  /**
   * 处理事件队列
   */
  private processEventQueue(): void {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (!event) continue;

      const { entityId, event: lifecycleEvent } = event;
      
      // Check if entity still exists
      if (!this.world.hasComponent(entityId, CType.Lifecycle)) continue;

      const lifecycle = this.world.getComponent<Lifecycle>(entityId, CType.Lifecycle);
      if (!lifecycle) continue;

      // Check if event already triggered (prevent duplicate)
      if (lifecycle.hasTriggered(lifecycleEvent)) continue;

      // Get effects for this event
      const effects = lifecycle.getEffects(lifecycleEvent);
      
      // Execute effects
      for (const effect of effects) {
        this.executeEffect(entityId, effect);
      }

      // Mark event as triggered
      lifecycle.markTriggered(lifecycleEvent);
    }
  }

  /**
   * 检查死亡条件
   */
  private checkDeathConditions(entities: EntityId[]): void {
    for (const entityId of entities) {
      const lifecycle = this.world.getComponent<Lifecycle>(entityId, CType.Lifecycle);
      const unitTag = this.world.getComponent<UnitTag>(entityId, CType.UnitTag);
      const health = this.world.getComponent<Health>(entityId, CType.Health);

      if (!lifecycle || !unitTag || !health) continue;
      if (!unitTag.alive) continue;

      // Check if unit should die
      if (health.current <= 0) {
        unitTag.markDead();
        
        // Trigger death event
        this.triggerEvent(entityId, LifecycleEvent.Death);
      }
    }
  }

  /**
   * 执行效果
   */
  private executeEffect(entityId: EntityId, effect: EffectConfig): void {
    const handler = this.effectHandlers.get(effect.type);
    if (handler) {
      try {
        handler(entityId, effect.params ?? {});
      } catch (error) {
        console.error(`Error executing effect ${effect.type} for entity ${entityId}:`, error);
      }
    } else {
      console.warn(`Unknown effect type: ${effect.type}`);
    }
  }

  /**
   * 获取效果处理器
   */
  getEffectHandler(effectType: string): ((entityId: EntityId, params: Record<string, unknown>) => void) | undefined {
    return this.effectHandlers.get(effectType);
  }

  /**
   * 检查效果处理器是否存在
   */
  hasEffectHandler(effectType: string): boolean {
    return this.effectHandlers.has(effectType);
  }

  /**
   * 获取所有注册的效果类型
   */
  getRegisteredEffectTypes(): string[] {
    return Array.from(this.effectHandlers.keys());
  }
}
