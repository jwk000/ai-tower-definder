import {
  TileType,
  TowerType,
  EnemyType,
  UnitType,
  ProductionType,
  SkillTrigger,
  type TowerConfig,
  type EnemyConfig,
  type UnitConfig,
  type ProductionConfig,
  type SkillConfig,
  type MapConfig,
  type WaveConfig,
  type GridPos,
} from '../types/index.js';

// ---- Tower Configs ----

export const TOWER_CONFIGS: Record<TowerType, TowerConfig> = {
  [TowerType.Arrow]: {
    type: TowerType.Arrow,
    name: '箭塔',
    cost: 50,
    hp: 100,
    atk: 10,
    attackSpeed: 1.0,
    range: 180,
    damageType: 'physical',
    upgradeCosts: [30, 60, 100, 150],
    upgradeAtkBonus: [5, 8, 12, 18],
    upgradeRangeBonus: [20, 20, 30, 30],
    color: '#4fc3f7',
  },
  [TowerType.Cannon]: {
    type: TowerType.Cannon,
    name: '炮塔',
    cost: 80,
    hp: 120,
    atk: 25,
    attackSpeed: 0.4,
    range: 180,
    damageType: 'physical',
    splashRadius: 80,
    stunDuration: 1.5,
    upgradeCosts: [50, 90, 140, 200],
    upgradeAtkBonus: [8, 12, 16, 22],
    upgradeRangeBonus: [20, 20, 30, 30],
    color: '#ff8a65',
  },
  [TowerType.Ice]: {
    type: TowerType.Ice,
    name: '冰塔',
    cost: 65,
    hp: 100,
    atk: 5,
    attackSpeed: 1.2,
    range: 200,
    damageType: 'magic',
    slowPercent: 20,
    slowMaxStacks: 5,
    freezeDuration: 1.0,
    upgradeCosts: [40, 70, 110, 160],
    upgradeAtkBonus: [3, 5, 7, 10],
    upgradeRangeBonus: [20, 20, 30, 30],
    color: '#81d4fa',
  },
  [TowerType.Lightning]: {
    type: TowerType.Lightning,
    name: '电塔',
    cost: 70,
    hp: 100,
    atk: 15,
    attackSpeed: 0.9,
    range: 170,
    damageType: 'magic',
    chainCount: 3,
    chainDecay: 0.2,
    upgradeCosts: [45, 75, 120, 170],
    upgradeAtkBonus: [6, 9, 13, 18],
    upgradeRangeBonus: [15, 15, 20, 20],
    color: '#fff176',
  },
};

// ---- Enemy Configs ----

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  [EnemyType.Grunt]: {
    type: EnemyType.Grunt,
    name: '小兵',
    description: '基础敌人',
    hp: 60,
    speed: 70,
    atk: 10,
    defense: 0,
    magicResist: 0,
    attackRange: 0,
    attackSpeed: 1,
    canAttackBuildings: false,
    rewardGold: 10,
    color: '#ef5350',
    radius: 16,
  },
  [EnemyType.Runner]: {
    type: EnemyType.Runner,
    name: '快兵',
    description: '高速移动',
    hp: 30,
    speed: 150,
    atk: 5,
    defense: 0,
    magicResist: 0,
    attackRange: 0,
    attackSpeed: 1,
    canAttackBuildings: false,
    rewardGold: 8,
    color: '#ffab91',
    radius: 10,
  },
  [EnemyType.Heavy]: {
    type: EnemyType.Heavy,
    name: '重装兵',
    description: '高护甲',
    hp: 200,
    speed: 35,
    atk: 15,
    defense: 30,
    magicResist: 0,
    attackRange: 0,
    attackSpeed: 1,
    canAttackBuildings: false,
    rewardGold: 20,
    color: '#8d6e63',
    radius: 20,
  },
  [EnemyType.Mage]: {
    type: EnemyType.Mage,
    name: '法师',
    description: '远程攻击建筑',
    hp: 80,
    speed: 55,
    atk: 12,
    defense: 0,
    magicResist: 0,
    attackRange: 0,
    attackSpeed: 1,
    canAttackBuildings: false,
    rewardGold: 18,
    color: '#ce93d8',
    radius: 14,
  },
  [EnemyType.Exploder]: {
    type: EnemyType.Exploder,
    name: '自爆虫',
    description: '死亡爆炸',
    hp: 40,
    speed: 90,
    atk: 8,
    defense: 0,
    magicResist: 0,
    attackRange: 0,
    attackSpeed: 1,
    canAttackBuildings: false,
    rewardGold: 15,
    color: '#ff8a65',
    radius: 12,
  },
  [EnemyType.BossCommander]: {
    type: EnemyType.BossCommander,
    name: '指挥官',
    description: 'Boss — 高攻高防',
    hp: 500,
    speed: 40,
    atk: 40,
    defense: 20,
    magicResist: 0,
    attackRange: 0,
    attackSpeed: 1,
    canAttackBuildings: false,
    rewardGold: 100,
    color: '#f44336',
    radius: 28,
    isBoss: true,
    bossPhase2HpRatio: 0.5,
  },
  [EnemyType.BossBeast]: {
    type: EnemyType.BossBeast,
    name: '攻城兽',
    description: 'Boss — 超高血量',
    hp: 700,
    speed: 30,
    atk: 50,
    defense: 40,
    magicResist: 0,
    attackRange: 0,
    attackSpeed: 1,
    canAttackBuildings: false,
    rewardGold: 150,
    color: '#9c27b0',
    radius: 32,
    isBoss: true,
    bossPhase2HpRatio: 0.5,
  },
};

// ---- MVP Map ----

const MAP_01_WAYPOINTS: GridPos[] = [
  { row: 1, col: 0 },
  { row: 1, col: 4 },
  { row: 4, col: 4 },
  { row: 4, col: 1 },
  { row: 6, col: 1 },
  { row: 6, col: 5 },
  { row: 4, col: 5 },
  { row: 4, col: 8 },
  { row: 6, col: 8 },
  { row: 6, col: 20 },
];

export const MAP_01: MapConfig = {
  name: '第一关 — 平原',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: buildMapTiles(),
  enemyPath: MAP_01_WAYPOINTS,
  neutralUnits: [],
};

function buildMapTiles(): TileType[][] {
  const tiles: TileType[][] = [];
  for (let row = 0; row < 9; row++) {
    const line: TileType[] = [];
    for (let col = 0; col < 21; col++) {
      const onPath = isOnPath(row, col);
      if (col === 0 && row === 1) line.push(TileType.Spawn);
      else if (col === 20 && row === 6) line.push(TileType.Base);
      else if (onPath) line.push(TileType.Path);
      else line.push(TileType.Empty);
    }
    tiles.push(line);
  }
  return tiles;
}

function isOnPath(row: number, col: number): boolean {
  for (let i = 0; i < MAP_01_WAYPOINTS.length - 1; i++) {
    const a = MAP_01_WAYPOINTS[i]!;
    const b = MAP_01_WAYPOINTS[i + 1]!;
    if (a.row === b.row) {
      const minCol = Math.min(a.col, b.col);
      const maxCol = Math.max(a.col, b.col);
      if (row === a.row && col >= minCol && col <= maxCol) return true;
    } else if (a.col === b.col) {
      const minRow = Math.min(a.row, b.row);
      const maxRow = Math.max(a.row, b.row);
      if (col === a.col && row >= minRow && row <= maxRow) return true;
    }
  }
  return false;
}

function buildEnemyPath() {
  return MAP_01_WAYPOINTS;
}

// ---- MVP Waves ----

export const MVP_WAVES: WaveConfig[] = [
  {
    waveNumber: 1,
    enemies: [{ enemyType: EnemyType.Grunt, count: 5, spawnInterval: 1.2 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 2,
    enemies: [{ enemyType: EnemyType.Grunt, count: 8, spawnInterval: 1.0 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 3,
    enemies: [{ enemyType: EnemyType.Grunt, count: 12, spawnInterval: 0.8 }],
    spawnDelay: 2,
  },
];

// ---- Unit Configs ----

export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  [UnitType.ShieldGuard]: {
    type: UnitType.ShieldGuard,
    name: '盾卫',
    hp: 300,
    atk: 8,
    attackSpeed: 0.8,
    attackRange: 40,
    speed: 60,
    defense: 20,
    popCost: 2,
    color: '#64b5f6',
    size: 28,
    skillId: 'taunt',
    cost: 60,
  },
  [UnitType.Swordsman]: {
    type: UnitType.Swordsman,
    name: '剑士',
    hp: 150,
    atk: 15,
    attackSpeed: 1.0,
    attackRange: 35,
    speed: 80,
    defense: 5,
    popCost: 2,
    color: '#ef5350',
    size: 24,
    skillId: 'whirlwind',
    cost: 50,
  },
};

// ---- Production Configs ----

export const PRODUCTION_CONFIGS: Record<ProductionType, ProductionConfig> = {
  [ProductionType.GoldMine]: {
    type: ProductionType.GoldMine,
    name: '金矿',
    cost: 100,
    hp: 80,
    resourceType: 'gold',
    baseRate: 2,
    upgradeRateBonus: 2,
    upgradeCosts: [80, 150],
    maxLevel: 3,
    color: '#ffd54f',
  },
  [ProductionType.EnergyTower]: {
    type: ProductionType.EnergyTower,
    name: '能量塔',
    cost: 75,
    hp: 60,
    resourceType: 'energy',
    baseRate: 1,
    upgradeRateBonus: 1,
    upgradeCosts: [60, 120],
    maxLevel: 3,
    color: '#81c784',
  },
};

// ---- Skill Configs ----

export const SKILL_CONFIGS: Record<string, SkillConfig> = {
  taunt: {
    id: 'taunt',
    name: '嘲讽',
    trigger: SkillTrigger.Active,
    cooldown: 8,
    energyCost: 20,
    range: 100,
    value: 3,
    buffId: null,
    description: '强制周围敌人攻击自己3秒',
  },
  whirlwind: {
    id: 'whirlwind',
    name: '旋风斩',
    trigger: SkillTrigger.Active,
    cooldown: 6,
    energyCost: 15,
    range: 60,
    value: 25,
    buffId: null,
    description: '对周围敌人造成AOE伤害',
  },
};

export const PHASE2_WAVES: WaveConfig[] = [
  {
    waveNumber: 1,
    enemies: [{ enemyType: EnemyType.Grunt, count: 6, spawnInterval: 1.0 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 2,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 1.0 },
      { enemyType: EnemyType.Grunt, count: 3, spawnInterval: 0.6 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 3,
    enemies: [{ enemyType: EnemyType.Grunt, count: 10, spawnInterval: 0.8 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 4,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 3, spawnInterval: 1.0 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.5 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 5,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 2, spawnInterval: 1.0 },
      { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 2.0 },
    ],
    spawnDelay: 3,
  },
];
