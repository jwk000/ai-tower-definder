import { System, CType, NodeStatus, type EntityId } from '../types/index.js';
import type { World } from '../core/World.js';
import type { AI } from '../components/AI.js';
import type { UnitTag } from '../components/UnitTag.js';
import type { Position } from '../components/Position.js';
import type { Health } from '../components/Health.js';
import type { Attack } from '../components/Attack.js';
import { BehaviorTree, type AIContext } from '../ai/BehaviorTree.js';
import type { BehaviorTreeConfig } from '../types/index.js';

/**
 * AISystem - 处理所有单位的AI逻辑
 * 
 * 使用行为树架构，每个单位可以有独立的AI配置。
 * 支持通过JSON配置定义单位行为。
 */
export class AISystem implements System {
  readonly name = 'AISystem';
  readonly requiredComponents = [CType.AI, CType.UnitTag, CType.Position, CType.Health] as const;

  private world: World;
  
  /** 行为树缓存 */
  private behaviorTreeCache: Map<string, BehaviorTree> = new Map();
  
  /** AI配置 */
  private aiConfigs: Map<string, BehaviorTreeConfig> = new Map();
  
  /** 当前时间（毫秒） */
  private currentTime: number = 0;
  
  /** 性能统计 */
  private stats = {
    totalUpdates: 0,
    avgUpdateTime: 0,
    maxUpdateTime: 0,
  };

  constructor(world: World) {
    this.world = world;
  }

  /**
   * 注册AI配置
   */
  registerAIConfig(config: BehaviorTreeConfig): void {
    this.aiConfigs.set(config.id, config);
  }

  /**
   * 批量注册AI配置
   */
  registerAIConfigs(configs: BehaviorTreeConfig[]): void {
    for (const config of configs) {
      this.registerAIConfig(config);
    }
  }

  /**
   * 获取或创建行为树实例
   */
  private getBehaviorTree(configId: string): BehaviorTree | null {
    // Check cache first
    const cached = this.behaviorTreeCache.get(configId);
    if (cached) {
      return cached;
    }

    // Get config
    const config = this.aiConfigs.get(configId);
    if (!config) {
      console.warn(`AI config not found: ${configId}`);
      return null;
    }

    // Create and cache behavior tree
    const tree = new BehaviorTree(config);
    this.behaviorTreeCache.set(configId, tree);
    return tree;
  }

  /**
   * 更新所有单位的AI
   */
  update(entities: EntityId[], dt: number): void {
    this.currentTime += dt * 1000; // Convert to milliseconds
    
    const startTime = performance.now();
    let updateCount = 0;

    for (const entityId of entities) {
      const ai = this.world.getComponent<AI>(entityId, CType.AI);
      const unitTag = this.world.getComponent<UnitTag>(entityId, CType.UnitTag);
      const position = this.world.getComponent<Position>(entityId, CType.Position);
      const health = this.world.getComponent<Health>(entityId, CType.Health);

      if (!ai || !unitTag || !position || !health) continue;
      if (!ai.active) continue;
      if (!unitTag.alive) continue;

      // Check if it's time to update this unit
      if (!ai.shouldUpdate(this.currentTime)) {
        continue;
      }

      // Get behavior tree
      const tree = this.getBehaviorTree(ai.configId);
      if (!tree) continue;

      // Create AI context
      const context: AIContext = {
        entityId,
        world: this.world,
        unitTag,
        position,
        health,
        attack: this.world.getComponent<Attack>(entityId, CType.Attack),
        ai,
        dt,
        currentTime: this.currentTime,
      };

      // Execute behavior tree
      try {
        const status = tree.tick(context);
        ai.markUpdated(this.currentTime);
        updateCount++;
      } catch (error) {
        console.error(`AI error for entity ${entityId}:`, error);
        ai.active = false; // Disable AI on error
      }
    }

    // Update stats
    const updateTime = performance.now() - startTime;
    this.stats.totalUpdates += updateCount;
    if (updateCount > 0) {
      this.stats.avgUpdateTime = updateTime / updateCount;
      this.stats.maxUpdateTime = Math.max(this.stats.maxUpdateTime, updateTime);
    }
  }

  /**
   * 获取性能统计
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 重置性能统计
   */
  resetStats(): void {
    this.stats = {
      totalUpdates: 0,
      avgUpdateTime: 0,
      maxUpdateTime: 0,
    };
  }

  /**
   * 清除行为树缓存
   */
  clearCache(): void {
    this.behaviorTreeCache.clear();
  }

  /**
   * 获取单位的AI上下文（用于调试）
   */
  getAIContext(entityId: number): AIContext | null {
    const ai = this.world.getComponent<AI>(entityId, CType.AI);
    const unitTag = this.world.getComponent<UnitTag>(entityId, CType.UnitTag);
    const position = this.world.getComponent<Position>(entityId, CType.Position);
    const health = this.world.getComponent<Health>(entityId, CType.Health);

    if (!ai || !unitTag || !position || !health) return null;

    return {
      entityId,
      world: this.world,
      unitTag,
      position,
      health,
      attack: this.world.getComponent<Attack>(entityId, CType.Attack),
      ai,
      dt: 0,
      currentTime: this.currentTime,
    };
  }
}
