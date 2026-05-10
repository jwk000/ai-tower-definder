import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { AI, Position, Health, UnitTag, Attack, Movement } from '../core/components.js';
import { BehaviorTree, type AIContext } from '../ai/BehaviorTree.js';
import type { BehaviorTreeConfig } from '../types/index.js';

/**
 * AISystem — 处理所有单位的AI逻辑 (bitecs 迁移版)
 *
 * 使用行为树架构，每个单位可以有独立的AI配置。
 * 支持通过JSON配置定义单位行为。
 *
 * 行为树读取 bitecs 组件存储，通过 TowerWorld 进行实体操作。
 */
export class AISystem implements System {
  readonly name = 'AISystem';

  /** Query: 拥有AI组件的实体 */
  private aiQuery = defineQuery([AI, Position, Health, UnitTag]);

  /** 行为树缓存: 配置ID字符串 → 已编译的行为树实例 */
  private behaviorTreeCache: Map<string, BehaviorTree> = new Map();

  /** AI配置注册表: 数值ID → 字符串配置ID */
  private configIndex: string[] = [];
  /** AI配置注册表: 字符串配置ID → 配置对象 */
  private configMap: Map<string, BehaviorTreeConfig> = new Map();

  /** 每个实体的黑板 (AI私有状态): 实体ID → key-value存储 */
  private blackboards: Map<number, Map<string, unknown>> = new Map();

  /** 性能统计 */
  private stats = {
    totalUpdates: 0,
    avgUpdateTime: 0,
    maxUpdateTime: 0,
  };

  /**
   * 批量注册AI配置
   *
   * 配置按注册顺序分配数值ID (即 configIndex 索引)。
   * 实体通过 AI.configId (ui16) 引用对应配置。
   */
  registerAIConfigs(configs: BehaviorTreeConfig[]): void {
    for (const config of configs) {
      if (this.configMap.has(config.id)) continue;
      this.configMap.set(config.id, config);
      this.configIndex.push(config.id);
    }
  }

  /**
   * 获取实体的黑板，不存在则创建
   */
  private getBlackboard(eid: number): Map<string, unknown> {
    let bb = this.blackboards.get(eid);
    if (!bb) {
      bb = new Map();
      this.blackboards.set(eid, bb);
    }
    return bb;
  }

  /**
   * 清理已销毁实体的黑板
   */
  private cleanupBlackboard(eid: number): void {
    this.blackboards.delete(eid);
  }

  /**
   * 获取或编译行为树实例
   */
  private getBehaviorTree(configIdStr: string): BehaviorTree | null {
    const cached = this.behaviorTreeCache.get(configIdStr);
    if (cached) return cached;

    const config = this.configMap.get(configIdStr);
    if (!config) {
      console.warn(`[AISystem] AI config not found: ${configIdStr}`);
      return null;
    }

    const tree = new BehaviorTree(config);
    this.behaviorTreeCache.set(configIdStr, tree);
    return tree;
  }

  /**
   * 主更新 — 遍历所有 AI 实体并执行行为树
   */
  update(world: TowerWorld, dt: number): void {
    const startTime = performance.now();
    let updateCount = 0;

    const entities = this.aiQuery(world.world);

    for (const eid of entities) {
      // 跳过未激活的 AI
      if (AI.active[eid] !== 1) continue;

      // 跳过已死亡的单位
      if (Health.current[eid]! <= 0) {
        this.cleanupBlackboard(eid);
        continue;
      }

      // 累积距离上次更新的时间
      AI.lastUpdateTime[eid]! += dt;

      // 检查是否到达更新间隔
      if (AI.lastUpdateTime[eid]! < AI.updateInterval[eid]!) continue;

      // 从数值ID解析字符串配置ID
      const configIdx = AI.configId[eid]!;
      const configIdStr = this.configIndex[configIdx];
      if (!configIdStr) continue;

      // 获取或编译行为树
      const tree = this.getBehaviorTree(configIdStr);
      if (!tree) continue;

      // 构建 AI 上下文
      const blackboard = this.getBlackboard(eid);
      const context: AIContext = {
        entityId: eid,
        world,
        dt: AI.lastUpdateTime[eid]!, // 传递累积的时间供行为树节点使用
        blackboard,
      };

      // 执行行为树
      try {
        tree.tick(context);
        // 重置累积时间
        AI.lastUpdateTime[eid] = 0;
        updateCount++;
      } catch (error) {
        console.error(`[AISystem] AI error for entity ${eid}:`, error);
        AI.active[eid] = 0;
        this.cleanupBlackboard(eid);
      }
    }

    // 更新性能统计
    const updateTime = performance.now() - startTime;
    this.stats.totalUpdates += updateCount;
    if (updateCount > 0) {
      this.stats.avgUpdateTime = updateTime / updateCount;
      this.stats.maxUpdateTime = Math.max(this.stats.maxUpdateTime, updateTime);
    }
  }

  /**
   * 获取性能统计（用于调试）
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 重置性能统计
   */
  resetStats(): void {
    this.stats = { totalUpdates: 0, avgUpdateTime: 0, maxUpdateTime: 0 };
  }

  /**
   * 清除行为树缓存（在配置热重载时使用）
   */
  clearCache(): void {
    this.behaviorTreeCache.clear();
  }
}
