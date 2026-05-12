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

/** 激光塔AI - 穿透攻击 */
export const TOWER_LASER_AI: BehaviorTreeConfig = {
  id: 'tower_laser',
  name: '激光塔AI',
  description: '攻击范围内敌人，光束穿透路径上所有敌人',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'attack', params: { target: 'nearest_enemy', pierce: true } }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.1 }
      }
    ]
  }
};

/** 蝙蝠塔AI - 暗夜攻击 + 生命偷取 */
export const TOWER_BAT_AI: BehaviorTreeConfig = {
  id: 'tower_bat',
  name: '蝙蝠塔AI',
  description: '仅在夜晚/雾天攻击，附带生命偷取',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_weather', params: { allowed: ['night', 'fog'] } },
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'attack', params: { target: 'nearest_enemy', lifeSteal: 0.3 } }
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

/** 基础敌人AI - 沿路径移动，攻击途中的士兵 */
export const ENEMY_BASIC_AI: BehaviorTreeConfig = {
  id: 'enemy_basic',
  name: '基础敌人AI',
  description: '沿路径移动，攻击途中士兵',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击士兵',
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

/**
 * 通用士兵AI — 4状态Selector
 *
 * 状态优先级: 战斗 > 警戒 > 返回 > 待机
 *
 * 前置条件: AISystem 应在首次tick时将以下值写入entity blackboard:
 *   - home_x, home_y: 单位部署/出生位置
 *   - attack_range: 攻击范围（默认使用Attack.range）
 *   - alert_range: 警戒范围（通常 = max(attack_range * 2, move_range)）
 *   - move_range: 活动的最大范围
 */
export const SOLDIER_GENERIC_AI: BehaviorTreeConfig = {
  id: 'soldier_generic',
  name: '通用士兵AI',
  description: '4状态选择器：战斗→警戒→返回→待机',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      // State 1: COMBAT — current_target 存活且在攻击范围内
      // design/24 §6: on_target_dead_reselect 同帧 reselect，消除 COMBAT→ALERT→COMBAT 1 帧空窗
      {
        type: 'sequence',
        name: '战斗',
        children: [
          { type: 'on_target_dead_reselect', params: { range: '${alert_range}', set_target: true } },
          { type: 'check_current_target_in_range', params: { range: '${attack_range}' } },
          { type: 'set_state', params: { state: 'combat' } },
          { type: 'show_alert_mark', params: { blink: false } },
          { type: 'attack', params: { target: 'current_target' } }
        ]
      },
      // State 2: ALERT — 在警戒范围内追击敌人
      {
        type: 'sequence',
        name: '警戒',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${alert_range}', set_target: true } },
          { type: 'set_state', params: { state: 'alert' } },
          { type: 'show_alert_mark', params: { blink: true } },
          { type: 'move_towards', params: { target: 'nearest_enemy', max_range: '${move_range}' } }
        ]
      },
      // State 3: RETURN — 远离出生点，返回
      {
        type: 'sequence',
        name: '返回',
        children: [
          { type: 'check_distance_from_home', params: { min: 10 } },
          { type: 'set_state', params: { state: 'return' } },
          { type: 'hide_alert_mark', params: {} },
          { type: 'move_to', params: { target: 'home' } }
        ]
      },
      // State 4: IDLE — 无敌人，在出生点附近游荡
      {
        type: 'sequence',
        name: '待机',
        children: [
          { type: 'set_state', params: { state: 'idle' } },
          { type: 'wander', params: { radius: '${move_range}', speed_ratio: 0.5 } }
        ]
      }
    ]
  }
};

/** 基础士兵AI — 与SOLDIER_GENERIC_AI相同 */
export const SOLDIER_BASIC_AI: BehaviorTreeConfig = {
  id: 'soldier_basic',
  name: '基础士兵AI',
  description: '4状态选择器：战斗→警戒→返回→待机',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '战斗',
        children: [
          { type: 'on_target_dead_reselect', params: { range: '${alert_range}', set_target: true } },
          { type: 'check_current_target_in_range', params: { range: '${attack_range}' } },
          { type: 'set_state', params: { state: 'combat' } },
          { type: 'show_alert_mark', params: { blink: false } },
          { type: 'attack', params: { target: 'current_target' } }
        ]
      },
      {
        type: 'sequence',
        name: '警戒',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${alert_range}', set_target: true } },
          { type: 'set_state', params: { state: 'alert' } },
          { type: 'show_alert_mark', params: { blink: true } },
          { type: 'move_towards', params: { target: 'nearest_enemy', max_range: '${move_range}' } }
        ]
      },
      {
        type: 'sequence',
        name: '返回',
        children: [
          { type: 'check_distance_from_home', params: { min: 10 } },
          { type: 'set_state', params: { state: 'return' } },
          { type: 'hide_alert_mark', params: {} },
          { type: 'move_to', params: { target: 'home' } }
        ]
      },
      {
        type: 'sequence',
        name: '待机',
        children: [
          { type: 'set_state', params: { state: 'idle' } },
          { type: 'wander', params: { radius: '${move_range}', speed_ratio: 0.5 } }
        ]
      }
    ]
  }
};

/** 坦克士兵AI - 嘲讽技能 + 通用4状态逻辑 */
export const SOLDIER_TANK_AI: BehaviorTreeConfig = {
  id: 'soldier_tank',
  name: '坦克士兵AI',
  description: '优先使用嘲讽技能，然后执行通用4状态AI',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      // Skill: Taunt — 范围内敌人≥3时使用嘲讽
      {
        type: 'sequence',
        name: '嘲讽技能',
        children: [
          { type: 'check_enemy_in_range', params: { range: 100, count: 3 } },
          { type: 'check_cooldown', params: { skill_id: 'taunt' } },
          { type: 'use_skill', params: { skill_id: 'taunt' } }
        ]
      },
      // State 1: COMBAT — current_target 驱动，同帧 reselect（design/24 §6）
      {
        type: 'sequence',
        name: '战斗',
        children: [
          { type: 'on_target_dead_reselect', params: { range: '${alert_range}', set_target: true } },
          { type: 'check_current_target_in_range', params: { range: '${attack_range}' } },
          { type: 'set_state', params: { state: 'combat' } },
          { type: 'show_alert_mark', params: { blink: false } },
          { type: 'attack', params: { target: 'current_target' } }
        ]
      },
      // State 2: ALERT
      {
        type: 'sequence',
        name: '警戒',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${alert_range}', set_target: true } },
          { type: 'set_state', params: { state: 'alert' } },
          { type: 'show_alert_mark', params: { blink: true } },
          { type: 'move_towards', params: { target: 'nearest_enemy', max_range: '${move_range}' } }
        ]
      },
      // State 3: RETURN
      {
        type: 'sequence',
        name: '返回',
        children: [
          { type: 'check_distance_from_home', params: { min: 10 } },
          { type: 'set_state', params: { state: 'return' } },
          { type: 'hide_alert_mark', params: {} },
          { type: 'move_to', params: { target: 'home' } }
        ]
      },
      // State 4: IDLE
      {
        type: 'sequence',
        name: '待机',
        children: [
          { type: 'set_state', params: { state: 'idle' } },
          { type: 'wander', params: { radius: '${move_range}', speed_ratio: 0.5 } }
        ]
      }
    ]
  }
};

/** 输出士兵AI - 旋风斩技能 + 通用4状态逻辑 */
export const SOLDIER_DPS_AI: BehaviorTreeConfig = {
  id: 'soldier_dps',
  name: '输出士兵AI',
  description: '优先使用旋风斩，然后执行通用4状态AI',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      // Skill: Whirlwind — 范围内敌人≥2时使用旋风斩
      {
        type: 'sequence',
        name: '旋风斩',
        children: [
          { type: 'check_enemy_in_range', params: { range: 60, count: 2 } },
          { type: 'check_cooldown', params: { skill_id: 'whirlwind' } },
          { type: 'use_skill', params: { skill_id: 'whirlwind' } }
        ]
      },
      // State 1: COMBAT — current_target 驱动，同帧 reselect（design/24 §6）
      {
        type: 'sequence',
        name: '战斗',
        children: [
          { type: 'on_target_dead_reselect', params: { range: '${alert_range}', set_target: true } },
          { type: 'check_current_target_in_range', params: { range: '${attack_range}' } },
          { type: 'set_state', params: { state: 'combat' } },
          { type: 'show_alert_mark', params: { blink: false } },
          { type: 'attack', params: { target: 'current_target' } }
        ]
      },
      // State 2: ALERT
      {
        type: 'sequence',
        name: '警戒',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${alert_range}', set_target: true } },
          { type: 'set_state', params: { state: 'alert' } },
          { type: 'show_alert_mark', params: { blink: true } },
          { type: 'move_towards', params: { target: 'nearest_enemy', max_range: '${move_range}' } }
        ]
      },
      // State 3: RETURN
      {
        type: 'sequence',
        name: '返回',
        children: [
          { type: 'check_distance_from_home', params: { min: 10 } },
          { type: 'set_state', params: { state: 'return' } },
          { type: 'hide_alert_mark', params: {} },
          { type: 'move_to', params: { target: 'home' } }
        ]
      },
      // State 4: IDLE
      {
        type: 'sequence',
        name: '待机',
        children: [
          { type: 'set_state', params: { state: 'idle' } },
          { type: 'wander', params: { radius: '${move_range}', speed_ratio: 0.5 } }
        ]
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

/** 伤害陷阱AI - 对范围内敌人造成持续伤害 */
export const TRAP_DAMAGE_AI: BehaviorTreeConfig = {
  id: 'trap_damage',
  name: '伤害陷阱AI',
  description: '对范围内的敌人施加 DOT 持续伤害',
  version: '1.0',
  root: {
    type: 'sequence',
    children: [
      { type: 'check_enemy_in_range', params: { range: 0, same_tile: true, target_type: 'any' } },
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

// ==================== 桩配置（待完善节点后启用） ====================

/** 导弹塔AI — 桩：全图射程 AOE（AttackSystem 接管实际逻辑） */
export const TOWER_MISSILE_AI: BehaviorTreeConfig = {
  id: 'tower_missile',
  name: '导弹塔AI（桩）',
  description: '全图射程，由 AttackSystem 暂时接管',
  version: '0.1-stub',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: 2000 } },
          { type: 'attack', params: { target: 'nearest_enemy' } }
        ]
      },
      { type: 'wait', params: { duration: 0.5 } }
    ]
  }
};

/** 毒藤塔AI — 桩：单体 DOT 攻击（ProjectileSystem 接管 DOT 逻辑） */
export const TOWER_VINE_AI: BehaviorTreeConfig = {
  id: 'tower_vine',
  name: '毒藤塔AI（桩）',
  description: '射程内持续伤害，由 ProjectileSystem 接管 DOT',
  version: '0.1-stub',
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
      { type: 'wait', params: { duration: 0.1 } }
    ]
  }
};

/** 萨满敌人AI — 桩：简单跟随路径（ShamanSystem 接管治疗/光环） */
export const ENEMY_SHAMAN_AI: BehaviorTreeConfig = {
  id: 'enemy_shaman',
  name: '萨满AI（桩）',
  description: '沿路径移动，由 ShamanSystem 接管治疗逻辑',
  version: '0.1-stub',
  root: {
    type: 'selector',
    children: [
      { type: 'move_to', params: { target: 'path_waypoint' } }
    ]
  }
};

/** 热气球敌人AI — 桩：飞行路径移动（HotAirBalloonSystem 接管炸弹） */
export const ENEMY_BALLOON_AI: BehaviorTreeConfig = {
  id: 'enemy_balloon',
  name: '热气球AI（桩）',
  description: '沿路径飞行，由 HotAirBalloonSystem 接管轰炸逻辑',
  version: '0.1-stub',
  root: {
    type: 'selector',
    children: [
      { type: 'move_to', params: { target: 'path_waypoint' } }
    ]
  }
};

/** 弩炮塔AI — 桩：远程贯穿攻击（AttackSystem 接管） */
export const TOWER_BALLISTA_AI: BehaviorTreeConfig = {
  id: 'tower_ballista',
  name: '弩炮塔AI（桩）',
  description: '远程贯穿狙击，由 AttackSystem 暂时接管',
  version: '0.1-stub',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'attack', params: { target: 'farthest' } }
        ]
      },
      { type: 'wait', params: { duration: 0.1 } }
    ]
  }
};

// ==================== 导出所有AI配置 ====================

export const ALL_AI_CONFIGS: BehaviorTreeConfig[] = [
  // Tower AIs (0-5)
  TOWER_BASIC_AI,
  TOWER_CANNON_AI,
  TOWER_ICE_AI,
  TOWER_LIGHTNING_AI,
  TOWER_LASER_AI,
  TOWER_BAT_AI,
  
  // Enemy AIs (6-8)
  ENEMY_BASIC_AI,
  ENEMY_RANGED_AI,
  ENEMY_BOSS_AI,
  
  // Soldier AIs (9-11)
  SOLDIER_BASIC_AI,
  SOLDIER_TANK_AI,
  SOLDIER_DPS_AI,
  
  // Building AIs (12)
  BUILDING_PRODUCTION_AI,
  
  // Trap AIs (13-14)
  TRAP_DAMAGE_AI,
  TRAP_HEALING_AI,

  // ---- 桩配置（待完善） ----
  // Tower AIs (15-16)
  TOWER_MISSILE_AI,
  TOWER_VINE_AI,

  // Enemy AIs (17-18)
  ENEMY_SHAMAN_AI,
  ENEMY_BALLOON_AI,

  // Tower AI (19)
  TOWER_BALLISTA_AI,

  // Soldier AI (20) — 通用士兵4状态模板
  SOLDIER_GENERIC_AI,
];

/** 获取AI配置 */
export function getAIConfig(id: string): BehaviorTreeConfig | undefined {
  return ALL_AI_CONFIGS.find(config => config.id === id);
}
