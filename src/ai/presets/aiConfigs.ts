import type { BehaviorTreeConfig } from '../../types/index.js';

/**
 * AI配置文件 - 定义各种单位的AI行为
 * 
 * 使用行为树架构，通过JSON配置定义单位的行为逻辑。
 */

// ==================== 塔类AI ====================

/** 基础塔AI - 攻击范围内敌人 */
export const TOWER_BASIC_AI: BehaviorTreeConfig = {
  id: 'tower_basic',
  name: '基础塔AI',
  description: '攻击范围内最近的敌人',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.1 }
      }
    ]
  }
};

/** 炮塔AI - 范围攻击 */
export const TOWER_CANNON_AI: BehaviorTreeConfig = {
  id: 'tower_cannon',
  name: '炮塔AI',
  description: '攻击范围内敌人，有溅射效果',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'attack', params: { target: 'nearest_enemy', splash: true } }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.1 }
      }
    ]
  }
};

/** 冰塔AI - 减速敌人 */
export const TOWER_ICE_AI: BehaviorTreeConfig = {
  id: 'tower_ice',
  name: '冰塔AI',
  description: '攻击范围内敌人，附带减速效果',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'attack', params: { target: 'nearest_enemy', effect: 'slow' } }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.1 }
      }
    ]
  }
};

/** 闪电塔AI - 链式攻击 */
export const TOWER_LIGHTNING_AI: BehaviorTreeConfig = {
  id: 'tower_lightning',
  name: '闪电塔AI',
  description: '攻击范围内敌人，可链式弹射',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'attack', params: { target: 'nearest_enemy', chain: true } }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.1 }
      }
    ]
  }
};

// ==================== 敌人类AI ====================

/** 基础敌人AI - 沿路径移动 */
export const ENEMY_BASIC_AI: BehaviorTreeConfig = {
  id: 'enemy_basic',
  name: '基础敌人AI',
  description: '沿路径移动，攻击途中敌人',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击单位',
        children: [
          { type: 'check_enemy_in_range', params: { range: 30, target_type: 'soldier' } },
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      {
        type: 'move_to',
        params: { target: 'path_waypoint' }
      }
    ]
  }
};

/** 远程敌人AI - 攻击建筑 */
export const ENEMY_RANGED_AI: BehaviorTreeConfig = {
  id: 'enemy_ranged',
  name: '远程敌人AI',
  description: '优先攻击建筑，也可攻击单位',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击建筑',
        children: [
          { type: 'check_enemy_in_range', params: { range: 150, target_type: 'tower' } },
          { type: 'attack', params: { target: 'nearest_enemy', projectile: true } }
        ]
      },
      {
        type: 'sequence',
        name: '攻击单位',
        children: [
          { type: 'check_enemy_in_range', params: { range: 30, target_type: 'soldier' } },
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      {
        type: 'move_to',
        params: { target: 'path_waypoint' }
      }
    ]
  }
};

/** Boss AI - 使用技能 */
export const ENEMY_BOSS_AI: BehaviorTreeConfig = {
  id: 'enemy_boss',
  name: 'Boss AI',
  description: 'Boss敌人AI，有特殊技能',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '阶段2技能',
        children: [
          { type: 'check_hp', params: { op: '<', value: 0.5 } },
          { type: 'check_cooldown', params: { skill_id: 'boss_special' } },
          { type: 'use_skill', params: { skill_id: 'boss_special' } }
        ]
      },
      {
        type: 'sequence',
        name: '攻击',
        children: [
          { type: 'check_enemy_in_range', params: { range: 30 } },
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      {
        type: 'move_to',
        params: { target: 'path_waypoint' }
      }
    ]
  }
};

// ==================== 士兵类AI ====================

/** 基础士兵AI - 自动攻击 */
export const SOLDIER_BASIC_AI: BehaviorTreeConfig = {
  id: 'soldier_basic',
  name: '基础士兵AI',
  description: '自动攻击范围内敌人',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击敌人',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      {
        type: 'sequence',
        name: '追击敌人',
        children: [
          { type: 'check_enemy_in_range', params: { range: 200 } },
          { type: 'move_towards', params: { target: 'nearest_enemy' } }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.2 }
      }
    ]
  }
};

/** 坦克士兵AI - 使用嘲讽技能 */
export const SOLDIER_TANK_AI: BehaviorTreeConfig = {
  id: 'soldier_tank',
  name: '坦克士兵AI',
  description: '使用嘲讽技能吸引敌人',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '嘲讽技能',
        children: [
          { type: 'check_enemy_in_range', params: { range: 100, count: 3 } },
          { type: 'check_cooldown', params: { skill_id: 'taunt' } },
          { type: 'use_skill', params: { skill_id: 'taunt' } }
        ]
      },
      {
        type: 'sequence',
        name: '攻击',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      {
        type: 'sequence',
        name: '移动',
        children: [
          { type: 'check_enemy_in_range', params: { range: 200 } },
          { type: 'move_towards', params: { target: 'nearest_enemy' } }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.2 }
      }
    ]
  }
};

/** 输出士兵AI - 使用旋风斩 */
export const SOLDIER_DPS_AI: BehaviorTreeConfig = {
  id: 'soldier_dps',
  name: '输出士兵AI',
  description: '使用旋风斩进行范围攻击',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '旋风斩',
        children: [
          { type: 'check_enemy_in_range', params: { range: 60, count: 2 } },
          { type: 'check_cooldown', params: { skill_id: 'whirlwind' } },
          { type: 'use_skill', params: { skill_id: 'whirlwind' } }
        ]
      },
      {
        type: 'sequence',
        name: '攻击',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      {
        type: 'sequence',
        name: '移动',
        children: [
          { type: 'check_enemy_in_range', params: { range: 200 } },
          { type: 'move_towards', params: { target: 'nearest_enemy' } }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.2 }
      }
    ]
  }
};

// ==================== 建筑类AI ====================

/** 生产建筑AI - 自动生产资源 */
export const BUILDING_PRODUCTION_AI: BehaviorTreeConfig = {
  id: 'building_production',
  name: '生产建筑AI',
  description: '自动生产资源',
  version: '1.0',
  root: {
    type: 'sequence',
    children: [
      { type: 'produce_resource', params: {} },
      { type: 'wait', params: { duration: 1.0 } }
    ]
  }
};

// ==================== 陷阱类AI ====================

/** 伤害陷阱AI - 对范围内敌人造成伤害 */
export const TRAP_DAMAGE_AI: BehaviorTreeConfig = {
  id: 'trap_damage',
  name: '伤害陷阱AI',
  description: '对同格敌人造成持续伤害',
  version: '1.0',
  root: {
    type: 'sequence',
    children: [
      { type: 'check_enemy_in_range', params: { range: 0, same_tile: true } },
      { type: 'attack', params: { target: 'all_in_range', damage_type: 'dot' } }
    ]
  }
};

/** 治疗泉AI - 治疗范围内友军 */
export const TRAP_HEALING_AI: BehaviorTreeConfig = {
  id: 'trap_healing',
  name: '治疗泉AI',
  description: '治疗范围内友军',
  version: '1.0',
  root: {
    type: 'sequence',
    children: [
      { type: 'check_ally_in_range', params: { range: 100 } },
      { type: 'heal', params: { target: 'all_allies_in_range', amount: 10 } }
    ]
  }
};

// ==================== 导出所有AI配置 ====================

export const ALL_AI_CONFIGS: BehaviorTreeConfig[] = [
  // Tower AIs
  TOWER_BASIC_AI,
  TOWER_CANNON_AI,
  TOWER_ICE_AI,
  TOWER_LIGHTNING_AI,
  
  // Enemy AIs
  ENEMY_BASIC_AI,
  ENEMY_RANGED_AI,
  ENEMY_BOSS_AI,
  
  // Soldier AIs
  SOLDIER_BASIC_AI,
  SOLDIER_TANK_AI,
  SOLDIER_DPS_AI,
  
  // Building AIs
  BUILDING_PRODUCTION_AI,
  
  // Trap AIs
  TRAP_DAMAGE_AI,
  TRAP_HEALING_AI,
];

/** 获取AI配置 */
export function getAIConfig(id: string): BehaviorTreeConfig | undefined {
  return ALL_AI_CONFIGS.find(config => config.id === id);
}
