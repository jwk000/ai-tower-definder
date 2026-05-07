import {
  TileType,
  TowerType,
  EnemyType,
  LevelTheme,
  type LevelConfig,
  type MapConfig,
  type WaveConfig,
  type GridPos,
} from '../../types/index.js';

const PRIMARY_WAYPOINTS: GridPos[] = [
  { row: 0, col: 1 },
  { row: 3, col: 1 },
  { row: 3, col: 4 },
  { row: 6, col: 4 },
  { row: 6, col: 7 },
  { row: 8, col: 7 },
  { row: 8, col: 20 },
];

const SECONDARY_WAYPOINTS: GridPos[] = [
  { row: 0, col: 6 },
  { row: 2, col: 6 },
  { row: 2, col: 4 },
  { row: 3, col: 4 },
];

function isOnPath(row: number, col: number, waypoints: GridPos[]): boolean {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
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

function isOnAnyPath(row: number, col: number): boolean {
  return isOnPath(row, col, PRIMARY_WAYPOINTS) || isOnPath(row, col, SECONDARY_WAYPOINTS);
}

function buildTiles(): TileType[][] {
  const tiles: TileType[][] = [];
  for (let row = 0; row < 9; row++) {
    const line: TileType[] = [];
    for (let col = 0; col < 21; col++) {
      if ((col === 1 || col === 6) && row === 0) line.push(TileType.Spawn);
      else if (col === 20 && row === 8) line.push(TileType.Base);
      else if (isOnAnyPath(row, col)) line.push(TileType.Path);
      else line.push(TileType.Empty);
    }
    tiles.push(line);
  }
  return tiles;
}

const MAP: MapConfig = {
  name: '冰原',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: buildTiles(),
  enemyPath: PRIMARY_WAYPOINTS,
  altSpawnPoints: [{ row: 0, col: 6 }],
  tileColors: {
    [TileType.Empty]: '#cfd8dc',
    [TileType.Path]: '#90a4ae',
    [TileType.Spawn]: '#4dd0e1',
    [TileType.Base]: '#42a5f5',
  },
};

const WAVES: WaveConfig[] = [
  {
    waveNumber: 1,
    enemies: [{ enemyType: EnemyType.Grunt, count: 6, spawnInterval: 1.3 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 2,
    enemies: [{ enemyType: EnemyType.Grunt, count: 8, spawnInterval: 1.1 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 3,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 5, spawnInterval: 1.0 },
      { enemyType: EnemyType.Runner, count: 3, spawnInterval: 0.7 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 4,
    enemies: [{ enemyType: EnemyType.Grunt, count: 10, spawnInterval: 1.0 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 5,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 3, spawnInterval: 1.0 },
      { enemyType: EnemyType.BossCommander, count: 1, spawnInterval: 0 },
    ],
    spawnDelay: 3,
    isBossWave: true,
  },
  {
    waveNumber: 6,
    enemies: [
      { enemyType: EnemyType.Runner, count: 7, spawnInterval: 0.6 },
      { enemyType: EnemyType.Mage, count: 3, spawnInterval: 1.5 },
    ],
    spawnDelay: 2,
    spawnPointIndex: 1,
  },
  {
    waveNumber: 7,
    enemies: [{ enemyType: EnemyType.Runner, count: 8, spawnInterval: 0.5 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 8,
    enemies: [{ enemyType: EnemyType.Heavy, count: 5, spawnInterval: 1.8 }],
    spawnDelay: 2,
    spawnPointIndex: 0,
  },
  {
    waveNumber: 9,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 6, spawnInterval: 1.0 },
      { enemyType: EnemyType.Exploder, count: 4, spawnInterval: 1.2 },
    ],
    spawnDelay: 2,
    spawnPointIndex: 1,
  },
  {
    waveNumber: 10,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 4, spawnInterval: 1.8 },
      { enemyType: EnemyType.Mage, count: 4, spawnInterval: 1.5 },
    ],
    spawnDelay: 3,
    spawnPointIndex: 0,
  },
  {
    waveNumber: 11,
    enemies: [
      { enemyType: EnemyType.Runner, count: 6, spawnInterval: 0.5 },
      { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 2.0 },
    ],
    spawnDelay: 2,
    spawnPointIndex: 1,
  },
  {
    waveNumber: 12,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 5, spawnInterval: 1.8 },
      { enemyType: EnemyType.Exploder, count: 5, spawnInterval: 1.0 },
    ],
    spawnDelay: 3,
    spawnPointIndex: 0,
  },
  {
    waveNumber: 13,
    enemies: [
      { enemyType: EnemyType.BossCommander, count: 1, spawnInterval: 0 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.6 },
    ],
    spawnDelay: 3,
    isBossWave: true,
    spawnPointIndex: 0,
  },
  {
    waveNumber: 14,
    enemies: [
      { enemyType: EnemyType.Mage, count: 4, spawnInterval: 1.5 },
      { enemyType: EnemyType.Heavy, count: 4, spawnInterval: 1.8 },
      { enemyType: EnemyType.Exploder, count: 3, spawnInterval: 1.2 },
    ],
    spawnDelay: 2,
    spawnPointIndex: 1,
  },
  {
    waveNumber: 15,
    enemies: [
      { enemyType: EnemyType.BossCommander, count: 1, spawnInterval: 0 },
      { enemyType: EnemyType.BossBeast, count: 1, spawnInterval: 2.0 },
      { enemyType: EnemyType.Heavy, count: 2, spawnInterval: 1.8 },
    ],
    spawnDelay: 4,
    isBossWave: true,
    spawnPointIndex: 0,
  },
];

export const LEVEL_03: LevelConfig = {
  id: 'L3_tundra',
  name: '冰原',
  theme: LevelTheme.Tundra,
  description: '双路线冰原地形，路径上的敌人会被减速',
  map: MAP,
  waves: WAVES,
  startingGold: 300,
  availableTowers: [TowerType.Arrow, TowerType.Ice],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: 'L2_desert',
};
