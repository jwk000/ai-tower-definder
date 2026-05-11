import { UnitCategory, UnitLayer, type UnitTypeConfig, type LifecycleConfig } from '../../types/index.js';

/**
 * 单位配置文件 - 定义所有单位的属性和行为
 * 
 * 统一单位概念：所有游戏实体都使用相同的配置结构
 */

// ==================== 辅助函数 ====================

function createLifecycle(config?: Partial<LifecycleConfig>): LifecycleConfig {
  return {
    onSpawn: config?.onSpawn ?? [],
    onDeath: config?.onDeath ?? [],
    onDestroy: config?.onDestroy ?? [],
    onUpgrade: config?.onUpgrade ?? [],
    onDowngrade: config?.onDowngrade ?? [],
    onAttack: config?.onAttack ?? [],
    onHit: config?.onHit ?? [],
  };
}

// ==================== 塔类配置 ====================

export const ARROW_TOWER_CONFIG: UnitTypeConfig = {
  id: 'arrow_tower',
  name: '箭塔',
  category: 'tower' as UnitCategory,
  description: '基础防御塔，攻击单个敌人',
  
  hp: 100,
  atk: 10,
  defense: 0,
  attackSpeed: 1.0,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 180,
  magicResist: 0,
  
  color: '#4fc3f7',
  size: 40,
  shape: 'rect',
  
  aiConfig: 'tower_basic',
  
  lifecycle: createLifecycle({
    onDeath: [{ type: 'destroy_entity' }],
    onHit: [{ type: 'flash_white', params: { duration: 0.12 } }],
  }),
  
  cost: 50,
  sellValue: 25,
  upgradeCosts: [30, 60, 100, 150],
  
  special: {
    damageType: 'physical',
    upgradeAtkBonus: [5, 8, 12, 18],
    upgradeRangeBonus: [20, 20, 30, 30],
  },
};

export const CANNON_TOWER_CONFIG: UnitTypeConfig = {
  id: 'cannon_tower',
  name: '炮塔',
  category: 'tower' as UnitCategory,
  description: '范围攻击防御塔，有溅射效果',
  
  hp: 120,
  atk: 30,
  defense: 0,
  attackSpeed: 0.25,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 180,
  magicResist: 0,
  
  color: '#ff8a65',
  size: 40,
  shape: 'rect',
  
  aiConfig: 'tower_cannon',
  
  lifecycle: createLifecycle({
    onDeath: [{ type: 'destroy_entity' }],
    onHit: [{ type: 'flash_white', params: { duration: 0.12 } }],
    onAttack: [{ type: 'create_explosion', params: { radius: 80 } }],
  }),
  
  cost: 80,
  sellValue: 40,
  upgradeCosts: [50, 90, 140, 200],
  
  special: {
    damageType: 'physical',
    splashRadius: 80,
    stunDuration: 0.8,
    upgradeAtkBonus: [8, 12, 16, 22],
    upgradeRangeBonus: [20, 20, 30, 30],
  },
};

export const ICE_TOWER_CONFIG: UnitTypeConfig = {
  id: 'ice_tower',
  name: '冰塔',
  category: 'tower' as UnitCategory,
  description: '减速敌人，叠加后可冰冻',
  
  hp: 100,
  atk: 5,
  defense: 0,
  attackSpeed: 1.2,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 200,
  magicResist: 0,
  
  color: '#81d4fa',
  size: 40,
  shape: 'rect',
  
  aiConfig: 'tower_ice',
  
  lifecycle: createLifecycle({
    onDeath: [{ type: 'destroy_entity' }],
    onHit: [{ type: 'flash_white', params: { duration: 0.12 } }],
    onAttack: [{ type: 'apply_slow', params: { percent: 20, maxStacks: 5, freezeDuration: 1.0 } }],
  }),
  
  cost: 65,
  sellValue: 32,
  upgradeCosts: [40, 70, 110, 160],
  
  special: {
    damageType: 'magic',
    slowPercent: 20,
    slowMaxStacks: 5,
    freezeDuration: 1.0,
    upgradeAtkBonus: [3, 5, 7, 10],
    upgradeRangeBonus: [20, 20, 30, 30],
  },
};

export const LIGHTNING_TOWER_CONFIG: UnitTypeConfig = {
  id: 'lightning_tower',
  name: '电塔',
  category: 'tower' as UnitCategory,
  description: '链式闪电攻击多个敌人',
  
  hp: 100,
  atk: 15,
  defense: 0,
  attackSpeed: 0.9,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 170,
  magicResist: 0,
  
  color: '#fff176',
  size: 40,
  shape: 'rect',
  
  aiConfig: 'tower_lightning',
  
  lifecycle: createLifecycle({
    onDeath: [{ type: 'destroy_entity' }],
    onHit: [{ type: 'flash_white', params: { duration: 0.12 } }],
    onAttack: [{ type: 'chain_lightning', params: { count: 3, decay: 0.2 } }],
  }),
  
  cost: 70,
  sellValue: 35,
  upgradeCosts: [45, 75, 120, 170],
  
  special: {
    damageType: 'magic',
    chainCount: 3,
    chainDecay: 0.2,
    upgradeAtkBonus: [6, 9, 13, 18],
    upgradeRangeBonus: [15, 15, 20, 20],
  },
};

export const LASER_TOWER_CONFIG: UnitTypeConfig = {
  id: 'laser_tower',
  name: '激光塔',
  category: 'tower' as UnitCategory,
  description: '穿透光束攻击路径上所有敌人',

  hp: 80,
  atk: 22,
  defense: 0,
  attackSpeed: 0.4,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 250,
  magicResist: 0,

  color: '#00e5ff',
  size: 36,
  shape: 'rect',

  aiConfig: 'tower_laser',

  lifecycle: createLifecycle({
    onDeath: [{ type: 'destroy_entity' }],
    onHit: [{ type: 'flash_white', params: { duration: 0.12 } }],
  }),

  cost: 90,
  sellValue: 45,
  upgradeCosts: [55, 85, 130, 190],

  special: {
    damageType: 'magic',
    pierceCount: 99,
    pierceDecay: 0.15,
    laserBeamWidth: 6,
    upgradeAtkBonus: [6, 9, 13, 18],
    upgradeRangeBonus: [15, 15, 20, 20],
  },
};

export const BAT_TOWER_CONFIG: UnitTypeConfig = {
  id: 'bat_tower',
  name: '蝙蝠塔',
  category: 'tower' as UnitCategory,
  description: '暗夜生物 — 仅在夜晚和雾天攻击，附带生命偷取',

  hp: 90,
  atk: 25,
  defense: 0,
  attackSpeed: 0.75,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 200,
  magicResist: 0,

  color: '#7c4dff',
  size: 34,
  shape: 'rect',

  layer: 'low_air' as UnitLayer,

  aiConfig: 'tower_bat',

  lifecycle: createLifecycle({
    onDeath: [{ type: 'destroy_entity' }],
    onHit: [{ type: 'flash_white', params: { duration: 0.12 } }],
  }),

  cost: 85,
  sellValue: 42,
  upgradeCosts: [50, 80, 120, 175],

  special: {
    damageType: 'magic',
    lifeSteal: 0.3,
    nightOnly: true,
    upgradeAtkBonus: [7, 10, 15, 21],
    upgradeRangeBonus: [15, 15, 20, 20],
  },
};

// ==================== 敌人类配置 ====================

export const GRUNT_CONFIG: UnitTypeConfig = {
  id: 'grunt',
  name: '小兵',
  category: 'enemy' as UnitCategory,
  description: '基础敌人',
  
  hp: 60,
  atk: 10,
  defense: 0,
  attackSpeed: 1,
  moveSpeed: 70,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#ef5350',
  size: 16,
  shape: 'circle',
  
  aiConfig: 'enemy_basic',
  
  lifecycle: createLifecycle({
    onDeath: [
      { type: 'reward_gold', params: { amount: 10 } },
      { type: 'destroy_entity' },
    ],
  }),
  
  special: {
    rewardGold: 10,
  },
};

export const RUNNER_CONFIG: UnitTypeConfig = {
  id: 'runner',
  name: '快兵',
  category: 'enemy' as UnitCategory,
  description: '高速移动敌人',
  
  hp: 30,
  atk: 5,
  defense: 0,
  attackSpeed: 1,
  moveSpeed: 150,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#ffab91',
  size: 10,
  shape: 'circle',
  
  aiConfig: 'enemy_basic',
  
  lifecycle: createLifecycle({
    onDeath: [
      { type: 'reward_gold', params: { amount: 8 } },
      { type: 'destroy_entity' },
    ],
  }),
  
  special: {
    rewardGold: 8,
  },
};

export const HEAVY_CONFIG: UnitTypeConfig = {
  id: 'heavy',
  name: '重装兵',
  category: 'enemy' as UnitCategory,
  description: '高护甲敌人',
  
  hp: 200,
  atk: 15,
  defense: 30,
  attackSpeed: 1,
  moveSpeed: 35,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#8d6e63',
  size: 20,
  shape: 'circle',
  
  aiConfig: 'enemy_basic',
  
  lifecycle: createLifecycle({
    onDeath: [
      { type: 'reward_gold', params: { amount: 20 } },
      { type: 'destroy_entity' },
    ],
  }),
  
  special: {
    rewardGold: 20,
  },
};

export const MAGE_CONFIG: UnitTypeConfig = {
  id: 'mage',
  name: '法师',
  category: 'enemy' as UnitCategory,
  description: '远程攻击建筑',
  
  hp: 80,
  atk: 12,
  defense: 0,
  attackSpeed: 1,
  moveSpeed: 55,
  moveRange: 0,
  attackRange: 150,
  magicResist: 0,
  
  color: '#ce93d8',
  size: 14,
  shape: 'circle',
  
  aiConfig: 'enemy_ranged',
  
  lifecycle: createLifecycle({
    onDeath: [
      { type: 'reward_gold', params: { amount: 18 } },
      { type: 'destroy_entity' },
    ],
  }),
  
  special: {
    rewardGold: 18,
    canAttackBuildings: true,
  },
};

export const EXPLODER_CONFIG: UnitTypeConfig = {
  id: 'exploder',
  name: '自爆虫',
  category: 'enemy' as UnitCategory,
  description: '死亡爆炸造成范围伤害',
  
  hp: 40,
  atk: 8,
  defense: 0,
  attackSpeed: 1,
  moveSpeed: 90,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#ff8a65',
  size: 12,
  shape: 'circle',
  
  aiConfig: 'enemy_basic',
  
  lifecycle: createLifecycle({
    onDeath: [
      { type: 'reward_gold', params: { amount: 15 } },
      { type: 'explode', params: { radius: 50, damage: 20 } },
      { type: 'destroy_entity' },
    ],
  }),
  
  special: {
    rewardGold: 15,
    specialOnDeath: 'explode',
    deathDamage: 20,
    deathRadius: 50,
  },
};

export const BOSS_COMMANDER_CONFIG: UnitTypeConfig = {
  id: 'boss_commander',
  name: '指挥官',
  category: 'enemy' as UnitCategory,
  description: 'Boss - 高攻高防',
  
  hp: 500,
  atk: 40,
  defense: 20,
  attackSpeed: 1,
  moveSpeed: 40,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#f44336',
  size: 28,
  shape: 'circle',
  
  aiConfig: 'enemy_boss',
  
  lifecycle: createLifecycle({
    onSpawn: [{ type: 'boss_intro' }],
    onDeath: [
      { type: 'reward_gold', params: { amount: 100 } },
      { type: 'destroy_entity' },
    ],
  }),
  
  special: {
    rewardGold: 100,
    isBoss: true,
    bossPhase2HpRatio: 0.5,
  },
};

export const BOSS_BEAST_CONFIG: UnitTypeConfig = {
  id: 'boss_beast',
  name: '攻城兽',
  category: 'enemy' as UnitCategory,
  description: 'Boss - 超高血量',
  
  hp: 700,
  atk: 50,
  defense: 40,
  attackSpeed: 1,
  moveSpeed: 30,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#9c27b0',
  size: 32,
  shape: 'circle',
  
  aiConfig: 'enemy_boss',
  
  lifecycle: createLifecycle({
    onSpawn: [{ type: 'boss_intro' }],
    onDeath: [
      { type: 'reward_gold', params: { amount: 150 } },
      { type: 'destroy_entity' },
    ],
  }),
  
  special: {
    rewardGold: 150,
    isBoss: true,
    bossPhase2HpRatio: 0.5,
  },
};

// ==================== 士兵类配置 ====================

export const SHIELD_GUARD_CONFIG: UnitTypeConfig = {
  id: 'shield_guard',
  name: '盾卫',
  category: 'soldier' as UnitCategory,
  description: '坦克型士兵，可嘲讽敌人',
  
  hp: 300,
  atk: 8,
  defense: 20,
  attackSpeed: 0.8,
  moveSpeed: 60,
  moveRange: 150,
  attackRange: 40,
  magicResist: 0,
  
  color: '#64b5f6',
  size: 28,
  shape: 'circle',
  
  aiConfig: 'soldier_tank',
  
  lifecycle: createLifecycle({
    onDeath: [
      { type: 'release_population', params: { cost: 2 } },
      { type: 'death_effect' },
      { type: 'destroy_entity' },
    ],
  }),
  
  cost: 60,
  sellValue: 30,
  
  special: {
    popCost: 2,
    skillId: 'taunt',
  },
};

export const SWORDSMAN_CONFIG: UnitTypeConfig = {
  id: 'swordsman',
  name: '剑士',
  category: 'soldier' as UnitCategory,
  description: '输出型士兵，可旋风斩',
  
  hp: 150,
  atk: 15,
  defense: 5,
  attackSpeed: 1.0,
  moveSpeed: 80,
  moveRange: 200,
  attackRange: 35,
  magicResist: 0,
  
  color: '#ef5350',
  size: 24,
  shape: 'circle',
  
  aiConfig: 'soldier_dps',
  
  lifecycle: createLifecycle({
    onDeath: [
      { type: 'release_population', params: { cost: 2 } },
      { type: 'death_effect' },
      { type: 'destroy_entity' },
    ],
  }),
  
  cost: 50,
  sellValue: 25,
  
  special: {
    popCost: 2,
    skillId: 'whirlwind',
  },
};

// ==================== 建筑类配置 ====================

export const GOLD_MINE_CONFIG: UnitTypeConfig = {
  id: 'gold_mine',
  name: '金矿',
  category: 'building' as UnitCategory,
  description: '每秒产出金币',
  
  hp: 80,
  atk: 0,
  defense: 0,
  attackSpeed: 0,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#ffd54f',
  size: 40,
  shape: 'rect',
  
  aiConfig: 'building_production',
  
  lifecycle: createLifecycle({
    onDeath: [{ type: 'destroy_entity' }],
  }),
  
  cost: 100,
  sellValue: 50,
  upgradeCosts: [80, 150],
  
  special: {
    resourceType: 'gold',
    baseRate: 2,
    upgradeRateBonus: 2,
    maxLevel: 3,
  },
};

export const ENERGY_TOWER_CONFIG: UnitTypeConfig = {
  id: 'energy_tower',
  name: '能量塔',
  category: 'building' as UnitCategory,
  description: '每秒产出能量',
  
  hp: 60,
  atk: 0,
  defense: 0,
  attackSpeed: 0,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#81c784',
  size: 40,
  shape: 'rect',
  
  aiConfig: 'building_production',
  
  lifecycle: createLifecycle({
    onDeath: [{ type: 'destroy_entity' }],
  }),
  
  cost: 75,
  sellValue: 37,
  upgradeCosts: [60, 120],
  
  special: {
    resourceType: 'energy',
    baseRate: 1,
    upgradeRateBonus: 1,
    maxLevel: 3,
  },
};

// ==================== 陷阱类配置 ====================

export const TRAP_SPIKE_CONFIG: UnitTypeConfig = {
  id: 'trap_spike',
  name: '地刺',
  category: 'trap' as UnitCategory,
  description: '对经过的敌人造成持续伤害',
  
  hp: 1,
  atk: 10,
  defense: 0,
  attackSpeed: 1,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#ff5252',
  size: 30,
  shape: 'triangle',
  
  aiConfig: 'trap_damage',
  
  lifecycle: createLifecycle({
    onDeath: [{ type: 'destroy_entity' }],
  }),
  
  cost: 40,
  sellValue: 20,
  
  special: {
    damagePerSecond: 10,
  },
};

export const HEALING_SPRING_CONFIG: UnitTypeConfig = {
  id: 'healing_spring',
  name: '治疗泉',
  category: 'trap' as UnitCategory,
  description: '治疗范围内友军',
  
  hp: 1,
  atk: 0,
  defense: 0,
  attackSpeed: 0,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 100,
  magicResist: 0,
  
  color: '#4caf50',
  size: 30,
  shape: 'circle',
  
  aiConfig: 'trap_healing',
  
  lifecycle: createLifecycle({
    onDeath: [{ type: 'destroy_entity' }],
  }),
  
  cost: 50,
  sellValue: 25,
  
  special: {
    healAmount: 10,
  },
};

// ==================== 目标点配置 ====================

export const BASE_CONFIG: UnitTypeConfig = {
  id: 'base',
  name: '大本营',
  category: 'objective' as UnitCategory,
  description: '玩家基地，被摧毁则失败',
  
  hp: 100,
  atk: 0,
  defense: 0,
  attackSpeed: 0,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#42a5f5',
  size: 40,
  shape: 'hexagon',
  
  aiConfig: '', // 无AI
  
  lifecycle: createLifecycle({
    onDeath: [{ type: 'game_over', params: { result: 'defeat' } }],
  }),
};

export const SPAWN_POINT_CONFIG: UnitTypeConfig = {
  id: 'spawn_point',
  name: '出生点',
  category: 'objective' as UnitCategory,
  description: '敌人出生点',
  
  hp: 0,
  atk: 0,
  defense: 0,
  attackSpeed: 0,
  moveSpeed: 0,
  moveRange: 0,
  attackRange: 0,
  magicResist: 0,
  
  color: '#ff9800',
  size: 40,
  shape: 'circle',
  
  aiConfig: '', // 无AI
  
  lifecycle: createLifecycle(),
};

// ==================== 单位配置注册表 ====================

export const UNIT_CONFIGS: Record<string, UnitTypeConfig> = {
  // Towers
  'arrow_tower': ARROW_TOWER_CONFIG,
  'cannon_tower': CANNON_TOWER_CONFIG,
  'ice_tower': ICE_TOWER_CONFIG,
  'lightning_tower': LIGHTNING_TOWER_CONFIG,
  'laser_tower': LASER_TOWER_CONFIG,
  'bat_tower': BAT_TOWER_CONFIG,
  
  // Enemies
  'grunt': GRUNT_CONFIG,
  'runner': RUNNER_CONFIG,
  'heavy': HEAVY_CONFIG,
  'mage': MAGE_CONFIG,
  'exploder': EXPLODER_CONFIG,
  'boss_commander': BOSS_COMMANDER_CONFIG,
  'boss_beast': BOSS_BEAST_CONFIG,
  
  // Soldiers
  'shield_guard': SHIELD_GUARD_CONFIG,
  'swordsman': SWORDSMAN_CONFIG,
  
  // Buildings
  'gold_mine': GOLD_MINE_CONFIG,
  'energy_tower': ENERGY_TOWER_CONFIG,
  
  // Traps
  'trap_spike': TRAP_SPIKE_CONFIG,
  'healing_spring': HEALING_SPRING_CONFIG,
  
  // Objectives
  'base': BASE_CONFIG,
  'spawn_point': SPAWN_POINT_CONFIG,
};

/** 获取单位配置 */
export function getUnitConfig(id: string): UnitTypeConfig | undefined {
  return UNIT_CONFIGS[id];
}

/** 获取指定分类的单位配置 */
export function getUnitConfigsByCategory(category: UnitCategory): UnitTypeConfig[] {
  return Object.values(UNIT_CONFIGS).filter(config => config.category === category);
}

/** 获取塔配置 */
export function getTowerConfigs(): UnitTypeConfig[] {
  return getUnitConfigsByCategory(UnitCategory.Tower);
}

/** 获取敌人配置 */
export function getEnemyConfigs(): UnitTypeConfig[] {
  return getUnitConfigsByCategory(UnitCategory.Enemy);
}

/** 获取士兵配置 */
export function getSoldierConfigs(): UnitTypeConfig[] {
  return getUnitConfigsByCategory(UnitCategory.Soldier);
}
