import type { BehaviorTreeConfig } from '../../types/index.js';

/**
 * AI配置文件 - 定义各种单位的AI行为
 * 
 * 使用行为树架构，通过JSON配置定义单位的行为逻辑。
 */

// ==================== 塔类AI ====================

/** 基础塔AI v2.0 - 攻击范围内敌人（design/23 §0.5 BT 真接管） */
export const TOWER_BASIC_AI: BehaviorTreeConfig = {
  id: 'tower_basic',
  name: '基础塔AI',
  description: '攻击范围内最近的敌人',
  version: '2.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'spawn_projectile_tower', params: {} }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.1 }
      }
    ]
  }
};

/** 炮塔AI v2.0 - 范围攻击（溅射由 SpawnProjectileTowerNode 按 towerType 内部处理） */
export const TOWER_CANNON_AI: BehaviorTreeConfig = {
  id: 'tower_cannon',
  name: '炮塔AI',
  description: '攻击范围内敌人，有溅射效果',
  version: '2.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'spawn_projectile_tower', params: {} }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.1 }
      }
    ]
  }
};

/** 冰塔AI v2.0 - 减速敌人（slow 由 SpawnProjectileTowerNode 按 towerType 透传） */
export const TOWER_ICE_AI: BehaviorTreeConfig = {
  id: 'tower_ice',
  name: '冰塔AI',
  description: '攻击范围内敌人，附带减速效果',
  version: '2.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'spawn_projectile_tower', params: {} }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.1 }
      }
    ]
  }
};

/** 闪电塔AI v2.0 - 链式攻击（lightning_chain 节点专管） */
export const TOWER_LIGHTNING_AI: BehaviorTreeConfig = {
  id: 'tower_lightning',
  name: '闪电塔AI',
  description: '攻击范围内敌人，可链式弹射',
  version: '2.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'lightning_chain', params: {} }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.1 }
      }
    ]
  }
};

/** 激光塔AI v2.0 - 多束自扫（laser_beam 节点自扫范围，不依赖 current_target） */
export const TOWER_LASER_AI: BehaviorTreeConfig = {
  id: 'tower_laser',
  name: '激光塔AI',
  description: '范围内多束自扫，L1-2:1束 / L3-4:2束 / L5:3束',
  version: '2.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'laser_beam', params: {} }
        ]
      },
      {
        type: 'wait',
        params: { duration: 0.1 }
      }
    ]
  }
};

/** 蝙蝠塔AI v2.0 - 暗夜攻击（lifeSteal 由 SpawnProjectileTowerNode 按 towerType 透传） */
export const TOWER_BAT_AI: BehaviorTreeConfig = {
  id: 'tower_bat',
  name: '蝙蝠塔AI',
  description: '仅在夜晚/雾天攻击，附带生命偷取',
  version: '2.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_weather', params: { allowed: ['night', 'fog'] } },
          { type: 'check_enemy_in_range', params: { range: '${attack_range}' } },
          { type: 'spawn_projectile_tower', params: {} }
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

/** 基础敌人AI v2.0 - 沿路径移动，攻击途中士兵（enemy_melee_attack 节点接管） */
export const ENEMY_BASIC_AI: BehaviorTreeConfig = {
  id: 'enemy_basic',
  name: '基础敌人AI',
  description: '沿路径移动，攻击途中士兵',
  version: '2.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击士兵',
        children: [
          { type: 'check_enemy_in_range', params: { range: 30, target_type: 'soldier' } },
          { type: 'enemy_melee_attack', params: {} }
        ]
      },
      {
        type: 'move_to',
        params: { target: 'path_waypoint' }
      }
    ]
  }
};

/** 远程敌人AI v2.0 - 攻击建筑（ranged）/ 士兵（melee） */
export const ENEMY_RANGED_AI: BehaviorTreeConfig = {
  id: 'enemy_ranged',
  name: '远程敌人AI',
  description: '优先攻击建筑，也可攻击单位',
  version: '2.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击建筑',
        children: [
          { type: 'check_enemy_in_range', params: { range: 150, target_type: 'tower' } },
          { type: 'enemy_ranged_attack', params: {} }
        ]
      },
      {
        type: 'sequence',
        name: '攻击单位',
        children: [
          { type: 'check_enemy_in_range', params: { range: 30, target_type: 'soldier' } },
          { type: 'enemy_melee_attack', params: {} }
        ]
      },
      {
        type: 'move_to',
        params: { target: 'path_waypoint' }
      }
    ]
  }
};

/** Boss AI v2.0 - 技能阶段 + 近战攻击（enemy_melee_attack 节点接管） */
export const ENEMY_BOSS_AI: BehaviorTreeConfig = {
  id: 'enemy_boss',
  name: 'Boss AI',
  description: 'Boss敌人AI，有特殊技能',
  version: '2.0',
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
          { type: 'enemy_melee_attack', params: {} }
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

/**
 * 导弹塔AI — 大范围预判 + 蓄力 + 抛物线 AOE。
 *
 * 三节点串联（design/23 §0.5）：
 *   1. select_missile_target — 全图地格评分（距离 0.35 + 密度 0.45 + tier 0.20），
 *      过滤飞行敌（cantTargetFlying=true）+ 射程内（600px），写黑板 current_target_pos。
 *   2. charge_attack — spawn 红色 TargetingMark 实体 + 挂 MissileCharge 组件 +
 *      0.6 秒蓄力（RenderSystem 渲染蓄力脉冲）。
 *   3. launch_missile_projectile — 发射抛物线导弹（PROJ_VISUAL[6]），
 *     ProjectileSystem 飞向 mark + AOE 爆炸（splashRadius 130px）。
 *
 * AttackSystem.handleMissileTower 已薄化为 no-op（R5 切换）。
 */
export const TOWER_MISSILE_AI: BehaviorTreeConfig = {
  id: 'tower_missile',
  name: '导弹塔AI',
  description: '全图地格评分 → 蓄力 → 抛物线 AOE（BT 接管完整流程）',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '蓄力发射流程',
        children: [
          { type: 'select_missile_target' },
          { type: 'charge_attack', params: { charge_time: 0.6 } },
          { type: 'launch_missile_projectile' },
        ],
      },
      { type: 'wait', params: { duration: 0.1 } },
    ],
  },
};

/**
 * 毒藤塔AI — 单体 DOT 攻击。
 * BT 负责目标选择和攻击触发，ProjectileSystem 处理 DOT 弹道的持续伤害周期。
 */
export const TOWER_VINE_AI: BehaviorTreeConfig = {
  id: 'tower_vine',
  name: '毒藤塔AI',
  description: '射程内最近敌人 DOT 攻击（ProjectileSystem 处理持续伤害周期）',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}', target_type: 'enemy' } },
          { type: 'attack', params: { target: 'nearest_enemy', effect: 'dot' } }
        ]
      },
      { type: 'wait', params: { duration: 0.1 } }
    ]
  }
};

/**
 * 萨满敌人AI — 沿路径移动 + 光环 buff 给同阵营友军。
 * 治疗逻辑仍由 ShamanSystem 接管（涉及 boss 半治疗 / 视觉 flash，BT 节点暂不覆盖）。
 * aura_buff 与 ShamanSystem.aura 双路径写同 id buff，addBuff 幂等不会双倍生效。
 */
export const ENEMY_SHAMAN_AI: BehaviorTreeConfig = {
  id: 'enemy_shaman',
  name: '萨满AI',
  description: '沿路径移动，光环加速友军（ShamanSystem 接管治疗）',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '光环+移动',
        children: [
          {
            type: 'aura_buff',
            params: {
              buff_id: 'shaman_aura',
              attribute: 'speed',
              value: 15,
              is_percent: false,
              range: 120,
              target_faction: 'ally',
              duration: 0.5,
            },
          },
          { type: 'move_to', params: { target: 'path_waypoint' } },
        ],
      },
      { type: 'move_to', params: { target: 'path_waypoint' } },
    ],
  },
};

/**
 * 热气球敌人AI — 沿路径飞行。
 * 投弹逻辑由 HotAirBalloonSystem 接管（依赖独有的「正下方建筑」目标选择），
 * BT 暂不接管 drop_bomb 以避免双倍生成；待 P3 引入 select_building_below 节点后再迁移。
 */
export const ENEMY_BALLOON_AI: BehaviorTreeConfig = {
  id: 'enemy_balloon',
  name: '热气球AI',
  description: '沿路径飞行（HotAirBalloonSystem 接管投弹）',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      { type: 'move_to', params: { target: 'path_waypoint' } },
    ],
  },
};

/**
 * 弩炮塔AI — 远程狙击最远敌人。
 * AttackSystem 接管贯穿伤害的弹道穿透逻辑（BT 仅触发单次攻击）。
 */
export const TOWER_BALLISTA_AI: BehaviorTreeConfig = {
  id: 'tower_ballista',
  name: '弩炮塔AI',
  description: '远程贯穿狙击最远敌人（AttackSystem 处理弹道穿透）',
  version: '1.0',
  root: {
    type: 'selector',
    children: [
      {
        type: 'sequence',
        name: '攻击流程',
        children: [
          { type: 'check_enemy_in_range', params: { range: '${attack_range}', target_type: 'enemy' } },
          { type: 'attack', params: { target: 'farthest', pierce: true } }
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
