/**
 * 单位系统 - 统一单位概念
 * 
 * 所有游戏实体（塔、敌人、士兵、建筑、陷阱等）都使用统一的单位配置和组件系统。
 */

// Components
export { UnitTag } from '../components/UnitTag.js';
export { AI } from '../components/AI.js';
export { Lifecycle } from '../components/Lifecycle.js';

// Systems
export { AISystem } from '../systems/AISystem.js';
export { LifecycleSystem } from '../systems/LifecycleSystem.js';
export { UnitFactory } from '../systems/UnitFactory.js';

// AI
export { BehaviorTree, type AIContext } from '../ai/BehaviorTree.js';
export * from '../ai/presets/aiConfigs.js';

// Unit Configs
export * from '../data/units/unitConfigs.js';

// Types (re-export for convenience)
export {
  UnitCategory,
  UnitLayer,
  LifecycleEvent,
  NodeStatus,
  BTNodeType,
  TargetType,
  type UnitTypeConfig,
  type LifecycleConfig,
  type EffectConfig,
  type BehaviorTreeConfig,
  type BTNodeConfig,
  type AIPresetConfig,
  type ComparisonExpr,
  type LayerInteractionConfig,
} from '../types/index.js';
