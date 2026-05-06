import {
  TileType,
  TowerType,
  EnemyType,
  type TowerConfig,
  type EnemyConfig,
  type MapConfig,
  type WaveConfig,
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
    upgradeCosts: [30, 60, 100, 150],
    upgradeAtkBonus: [5, 8, 12, 18],
    upgradeRangeBonus: [20, 20, 30, 30],
    color: '#4fc3f7',
  },
};

// ---- Enemy Configs ----

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  [EnemyType.Grunt]: {
    type: EnemyType.Grunt,
    name: '小兵',
    hp: 60,
    speed: 70,
    atk: 10, // damage to base
    defense: 0,
    rewardGold: 10,
    color: '#ef5350',
    radius: 16,
  },
};

// ---- MVP Map ----

export const MAP_01: MapConfig = {
  name: '第一关 — 平原',
  cols: 30,
  rows: 17,
  tileSize: 64,
  // 0=empty, 1=path, 2=blocked, 3=base, 4=spawn
  tiles: buildMapTiles(),
  enemyPath: buildEnemyPath(),
};

function buildMapTiles(): TileType[][] {
  // Create a zigzag path across the map
  const tiles: TileType[][] = [];
  for (let row = 0; row < 17; row++) {
    const line: TileType[] = [];
    for (let col = 0; col < 30; col++) {
      const onPath = isOnPath(row, col);
      if (col === 0 && row === 3) line.push(TileType.Spawn);
      else if (col === 29 && row === 8) line.push(TileType.Base);
      else if (onPath) line.push(TileType.Path);
      else line.push(TileType.Empty);
    }
    tiles.push(line);
  }
  return tiles;
}

function isOnPath(row: number, col: number): boolean {
  // Path: starts at (3, 0), zigzags to (13, 0), then to (13, 29), then to (8, 29)
  // Segment 1: (3,0) → (3,7)  — horizontal
  if (row === 3 && col >= 0 && col <= 7) return true;
  // Segment 2: (3,7) → (13,7) — vertical
  if (col === 7 && row >= 3 && row <= 13) return true;
  // Segment 3: (13,7) → (13,22) — horizontal
  if (row === 13 && col >= 7 && col <= 22) return true;
  // Segment 4: (13,22) → (8,22) — vertical (up)
  if (col === 22 && row >= 8 && row <= 13) return true;
  // Segment 5: (8,22) → (8,29) — horizontal to base
  if (row === 8 && col >= 22 && col <= 29) return true;
  return false;
}

function buildEnemyPath() {
  return [
    { row: 3, col: 0 },
    { row: 3, col: 7 },
    { row: 13, col: 7 },
    { row: 13, col: 22 },
    { row: 8, col: 22 },
    { row: 8, col: 29 },
  ];
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
