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
  type UpgradeVisualRegistry,
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
    atk: 30,
    attackSpeed: 0.25,
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
  [TowerType.Laser]: {
    type: TowerType.Laser,
    name: '激光塔',
    cost: 90,
    hp: 80,
    atk: 8,
    attackSpeed: 0.45,
    range: 250,
    damageType: 'magic',
    upgradeCosts: [55, 85, 130, 190],
    upgradeAtkBonus: [3, 3, 5, 5],
    upgradeRangeBonus: [15, 15, 20, 20],
    color: '#e040fb',
  },
  [TowerType.Bat]: {
    type: TowerType.Bat,
    name: '蝙蝠塔',
    cost: 85,
    hp: 90,
    atk: 10,
    attackSpeed: 1.0,
    range: 200,
    damageType: 'magic',
    upgradeCosts: [50, 80, 120, 175],
    upgradeAtkBonus: [4, 6, 8, 12],
    upgradeRangeBonus: [15, 15, 20, 20],
    color: '#7c4dff',
    batCount: 4,
    batReplenishCD: 12,
    batHP: 30,
    batDamage: 10,
    batAttackRange: 150,
    batAttackSpeed: 0.8,
    batSpeed: 120,
  },
};

// ---- Upgrade Visual Configs ----

export const UPGRADE_VISUALS: UpgradeVisualRegistry = {
  arrow_tower: [
    // L1: base form
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    // L2: slightly larger, 1 diamond
    { level: 2, scaleMultiplier: 1.08, extraParts: [] },
    // L3: larger, glow, passive visual
    { level: 3, scaleMultiplier: 1.17, extraParts: [
      { shape: 'triangle', offsetX: -7, offsetY: -25, size: 6, color: '#8d6e63', alpha: 0.7 },
      { shape: 'triangle', offsetX: 7, offsetY: -25, size: 6, color: '#8d6e63', alpha: 0.7 },
    ], glow: { radius: 24, color: '#4fc3f7', alpha: 0.15 }, passiveVisual: { type: 'crit_flash', description: '15% crit — golden flash on arrow tip' } },
    // L4
    { level: 4, scaleMultiplier: 1.25, extraParts: [
      { shape: 'triangle', offsetX: -8, offsetY: -28, size: 8, color: '#8d6e63', alpha: 0.8 },
      { shape: 'triangle', offsetX: 8, offsetY: -28, size: 8, color: '#8d6e63', alpha: 0.8 },
      { shape: 'circle', offsetX: -6, offsetY: -5, size: 3, color: '#ffd700', alpha: 0.8 },
      { shape: 'circle', offsetX: 6, offsetY: -5, size: 3, color: '#ffd700', alpha: 0.8 },
    ], glow: { radius: 28, color: '#4fc3f7', alpha: 0.25 } },
    // L5: final form
    { level: 5, scaleMultiplier: 1.36, extraParts: [
      { shape: 'triangle', offsetX: 0, offsetY: -30, size: 20, color: '#4fc3f7', alpha: 1 },
      { shape: 'triangle', offsetX: -9, offsetY: -24, size: 14, color: '#4fc3f7', alpha: 0.85 },
      { shape: 'triangle', offsetX: 9, offsetY: -24, size: 14, color: '#4fc3f7', alpha: 0.85 },
      { shape: 'triangle', offsetX: -10, offsetY: -30, size: 10, color: '#ffd700', alpha: 0.8 },
      { shape: 'triangle', offsetX: 10, offsetY: -30, size: 10, color: '#ffd700', alpha: 0.8 },
      { shape: 'circle', offsetX: 0, offsetY: -35, size: 6, color: '#ffffff', alpha: 0.8 },
    ], glow: { radius: 36, color: '#4fc3f7', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  cannon_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.08, extraParts: [] },
    { level: 3, scaleMultiplier: 1.16, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: -2, size: 22, color: '#616161', alpha: 0.6, stroke: '#616161', strokeWidth: 2 },
    ], glow: { radius: 24, color: '#ff8a65', alpha: 0.15 }, passiveVisual: { type: 'aoe_ring', description: 'AOE +30%, splash 80%' } },
    { level: 4, scaleMultiplier: 1.24, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: -2, size: 26, color: '#616161', alpha: 0.7, stroke: '#616161', strokeWidth: 2 },
      { shape: 'circle', offsetX: -8, offsetY: 8, size: 4, color: '#9e9e9e', alpha: 0.8 },
      { shape: 'circle', offsetX: 8, offsetY: 8, size: 4, color: '#9e9e9e', alpha: 0.8 },
      { shape: 'circle', offsetX: -8, offsetY: -8, size: 4, color: '#9e9e9e', alpha: 0.8 },
      { shape: 'circle', offsetX: 8, offsetY: -8, size: 4, color: '#9e9e9e', alpha: 0.8 },
    ], glow: { radius: 30, color: '#ff8a65', alpha: 0.25 } },
    { level: 5, scaleMultiplier: 1.34, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: -3, size: 30, color: '#ffd700', alpha: 0.7, stroke: '#ffd700', strokeWidth: 2 },
      { shape: 'circle', offsetX: 0, offsetY: 12, size: 10, color: '#37474f', alpha: 1 },
      { shape: 'circle', offsetX: -10, offsetY: 5, size: 10, color: '#455a64', alpha: 0.8 },
      { shape: 'circle', offsetX: 10, offsetY: 5, size: 10, color: '#455a64', alpha: 0.8 },
      { shape: 'triangle', offsetX: 0, offsetY: 20, size: 8, color: '#ff6e40', alpha: 0.6 },
    ], glow: { radius: 45, color: '#ff8a65', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  ice_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.09, extraParts: [] },
    { level: 3, scaleMultiplier: 1.18, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 40, color: '#b2ebf2', alpha: 0.3, stroke: '#b2ebf2', strokeWidth: 1 },
    ], glow: { radius: 24, color: '#81d4fa', alpha: 0.15 }, passiveVisual: { type: 'shatter_effect', description: 'freeze ends in 30 dmg AOE' } },
    { level: 4, scaleMultiplier: 1.26, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 46, color: '#b2ebf2', alpha: 0.35, stroke: '#b2ebf2', strokeWidth: 1.5 },
      { shape: 'triangle', offsetX: 0, offsetY: -24, size: 8, color: '#b2ebf2', alpha: 0.7 },
      { shape: 'triangle', offsetX: 21, offsetY: -12, size: 8, color: '#b2ebf2', alpha: 0.7, rotation: Math.PI / 3 },
      { shape: 'triangle', offsetX: 21, offsetY: 12, size: 8, color: '#b2ebf2', alpha: 0.7, rotation: Math.PI * 2/3 },
      { shape: 'triangle', offsetX: 0, offsetY: 24, size: 8, color: '#b2ebf2', alpha: 0.7, rotation: Math.PI },
      { shape: 'triangle', offsetX: -21, offsetY: 12, size: 8, color: '#b2ebf2', alpha: 0.7, rotation: Math.PI * 4/3 },
      { shape: 'triangle', offsetX: -21, offsetY: -12, size: 8, color: '#b2ebf2', alpha: 0.7, rotation: Math.PI * 5/3 },
    ], glow: { radius: 30, color: '#81d4fa', alpha: 0.25 } },
    { level: 5, scaleMultiplier: 1.38, extraParts: [
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 52, color: '#e0f7fa', alpha: 0.4, stroke: '#e0f7fa', strokeWidth: 2 },
      { shape: 'diamond', offsetX: 0, offsetY: 0, size: 20, color: '#ffffff', alpha: 0.5 },
    ], glow: { radius: 48, color: '#81d4fa', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  lightning_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.09, extraParts: [] },
    { level: 3, scaleMultiplier: 1.18, extraParts: [
      { shape: 'triangle', offsetX: -10, offsetY: -18, size: 10, color: '#ffb300', alpha: 0.9 },
    ], glow: { radius: 22, color: '#fff176', alpha: 0.15 }, passiveVisual: { type: 'arc_upgrade', description: 'bounces +2, decay down to 15%' } },
    { level: 4, scaleMultiplier: 1.26, extraParts: [
      { shape: 'triangle', offsetX: -12, offsetY: -20, size: 11, color: '#ffb300', alpha: 0.9 },
      { shape: 'triangle', offsetX: 12, offsetY: -20, size: 11, color: '#ffb300', alpha: 0.9 },
      { shape: 'circle', offsetX: -10, offsetY: 12, size: 6, color: '#ffb300', alpha: 0.6 },
      { shape: 'circle', offsetX: 10, offsetY: 12, size: 6, color: '#ffb300', alpha: 0.6 },
    ], glow: { radius: 28, color: '#fff176', alpha: 0.25 } },
    { level: 5, scaleMultiplier: 1.38, extraParts: [
      { shape: 'triangle', offsetX: 0, offsetY: -22, size: 14, color: '#ffb300', alpha: 1 },
      { shape: 'triangle', offsetX: -10, offsetY: -16, size: 11, color: '#ffb300', alpha: 0.85 },
      { shape: 'triangle', offsetX: 10, offsetY: -16, size: 11, color: '#ffb300', alpha: 0.85 },
      { shape: 'triangle', offsetX: -18, offsetY: -10, size: 10, color: '#ffb300', alpha: 0.7 },
      { shape: 'triangle', offsetX: 18, offsetY: -10, size: 10, color: '#ffb300', alpha: 0.7 },
    ], glow: { radius: 42, color: '#fff176', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  laser_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.08, extraParts: [] },
    { level: 3, scaleMultiplier: 1.17, extraParts: [
      { shape: 'diamond', offsetX: 0, offsetY: -20, size: 10, color: '#ffffff', alpha: 0.5 },
    ], glow: { radius: 22, color: '#00e5ff', alpha: 0.15 }, passiveVisual: { type: 'beam_widen', description: 'beam width 6px -> 8px' } },
    { level: 4, scaleMultiplier: 1.25, extraParts: [
      { shape: 'diamond', offsetX: 0, offsetY: -22, size: 12, color: '#ffffff', alpha: 0.6 },
      { shape: 'rect', offsetX: -8, offsetY: -5, size: 6, color: '#26c6da', alpha: 0.6 },
      { shape: 'rect', offsetX: 8, offsetY: -5, size: 6, color: '#26c6da', alpha: 0.6 },
    ], glow: { radius: 28, color: '#00e5ff', alpha: 0.25 } },
    { level: 5, scaleMultiplier: 1.36, extraParts: [
      { shape: 'diamond', offsetX: 0, offsetY: -24, size: 14, color: '#ffffff', alpha: 0.8 },
      { shape: 'rect', offsetX: -8, offsetY: -5, size: 6, color: '#18ffff', alpha: 0.7 },
      { shape: 'rect', offsetX: 8, offsetY: -5, size: 6, color: '#18ffff', alpha: 0.7 },
      { shape: 'rect', offsetX: -14, offsetY: -10, size: 6, color: '#18ffff', alpha: 0.5 },
      { shape: 'rect', offsetX: 14, offsetY: -10, size: 6, color: '#18ffff', alpha: 0.5 },
    ], glow: { radius: 48, color: '#00e5ff', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
  bat_tower: [
    { level: 1, scaleMultiplier: 1.0, extraParts: [] },
    { level: 2, scaleMultiplier: 1.09, extraParts: [] },
    { level: 3, scaleMultiplier: 1.18, extraParts: [
      { shape: 'triangle', offsetX: -8, offsetY: -10, size: 14, color: '#7b1fa2', alpha: 0.8, rotation: -0.2 },
      { shape: 'triangle', offsetX: 8, offsetY: -10, size: 14, color: '#7b1fa2', alpha: 0.8, rotation: 0.2 },
      { shape: 'triangle', offsetX: 0, offsetY: -26, size: 8, color: '#311b92', alpha: 0.9 },
    ], glow: { radius: 22, color: '#7c4dff', alpha: 0.15 }, passiveVisual: { type: 'bat_plus', description: 'bat swarm +1 (4->5)' } },
    { level: 4, scaleMultiplier: 1.26, extraParts: [
      { shape: 'triangle', offsetX: -9, offsetY: -10, size: 16, color: '#7b1fa2', alpha: 0.85, rotation: -0.3 },
      { shape: 'triangle', offsetX: 9, offsetY: -10, size: 16, color: '#7b1fa2', alpha: 0.85, rotation: 0.3 },
      { shape: 'triangle', offsetX: 0, offsetY: 8, size: 14, color: '#7b1fa2', alpha: 0.7 },
      { shape: 'triangle', offsetX: 0, offsetY: -28, size: 10, color: '#311b92', alpha: 0.9 },
      { shape: 'circle', offsetX: 0, offsetY: 0, size: 36, color: '#311b92', alpha: 0.3, stroke: '#311b92', strokeWidth: 1 },
    ], glow: { radius: 26, color: '#7c4dff', alpha: 0.25 } },
    { level: 5, scaleMultiplier: 1.38, extraParts: [
      { shape: 'triangle', offsetX: -10, offsetY: -10, size: 18, color: '#9c27b0', alpha: 0.9, rotation: -0.3 },
      { shape: 'triangle', offsetX: 10, offsetY: -10, size: 18, color: '#9c27b0', alpha: 0.9, rotation: 0.3 },
      { shape: 'triangle', offsetX: 0, offsetY: 10, size: 16, color: '#9c27b0', alpha: 0.8 },
      { shape: 'triangle', offsetX: -10, offsetY: 18, size: 14, color: '#9c27b0', alpha: 0.6, rotation: 0.5 },
      { shape: 'triangle', offsetX: 10, offsetY: 18, size: 14, color: '#9c27b0', alpha: 0.6, rotation: -0.5 },
      { shape: 'triangle', offsetX: 0, offsetY: -30, size: 12, color: '#311b92', alpha: 1 },
      { shape: 'circle', offsetX: 0, offsetY: -33, size: 8, color: '#e53935', alpha: 0.8 },
    ], glow: { radius: 40, color: '#7c4dff', alpha: 0.4, pulseAmplitude: 0.12 } },
  ],
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
    attackRange: 150,
    attackSpeed: 1,
    canAttackBuildings: true,
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
    moveRange: 150,
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
    moveRange: 200,
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
