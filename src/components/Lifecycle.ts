import { CType, LifecycleEvent, type EffectConfig, type LifecycleConfig } from '../types/index.js';

/**
 * Lifecycle组件 - 生命周期事件配置
 * 
 * 定义单位在各个生命周期事件触发时的效果。
 * 死亡和销毁的区别：
 * - 死亡（Death）：触发onDeath效果
 * - 销毁（Destroy）：不触发onDeath效果，直接移除
 */
export class Lifecycle {
  readonly type = CType.Lifecycle;
  
  /** 生命周期效果配置 */
  effects: Map<LifecycleEvent, EffectConfig[]>;
  
  /** 已触发的事件记录（防止重复触发） */
  triggeredEvents: Set<string>;

  constructor(config?: LifecycleConfig) {
    this.effects = new Map();
    this.triggeredEvents = new Set();
    
    if (config) {
      if (config.onSpawn) this.effects.set(LifecycleEvent.Spawn, config.onSpawn);
      if (config.onDeath) this.effects.set(LifecycleEvent.Death, config.onDeath);
      if (config.onDestroy) this.effects.set(LifecycleEvent.Destroy, config.onDestroy);
      if (config.onUpgrade) this.effects.set(LifecycleEvent.Upgrade, config.onUpgrade);
      if (config.onDowngrade) this.effects.set(LifecycleEvent.Downgrade, config.onDowngrade);
      if (config.onAttack) this.effects.set(LifecycleEvent.Attack, config.onAttack);
      if (config.onHit) this.effects.set(LifecycleEvent.Hit, config.onHit);
    }
  }

  /** 获取事件对应的效果列表 */
  getEffects(event: LifecycleEvent): EffectConfig[] {
    return this.effects.get(event) ?? [];
  }

  /** 设置事件效果 */
  setEffects(event: LifecycleEvent, effects: EffectConfig[]): void {
    this.effects.set(event, effects);
  }

  /** 检查事件是否已触发 */
  hasTriggered(event: LifecycleEvent): boolean {
    return this.triggeredEvents.has(event);
  }

  /** 标记事件已触发 */
  markTriggered(event: LifecycleEvent): void {
    this.triggeredEvents.add(event);
  }

  /** 重置触发记录（用于重生等场景） */
  resetTriggered(): void {
    this.triggeredEvents.clear();
  }

  /** 检查是否有指定事件的效果 */
  hasEffectsFor(event: LifecycleEvent): boolean {
    const effects = this.effects.get(event);
    return effects !== undefined && effects.length > 0;
  }
}
