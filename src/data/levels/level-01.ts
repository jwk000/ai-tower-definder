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

const WAYPOINTS: GridPos[] = [
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

function isOnPath(row: number, col: number): boolean {
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const a = WAYPOINTS[i]!;
    const b = WAYPOINTS[i + 1]!;
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

function buildTiles(): TileType[][] {
  const tiles: TileType[][] = [];
  for (let row = 0; row < 9; row++) {
    const line: TileType[] = [];
    for (let col = 0; col < 21; col++) {
      if (col === 0 && row === 1) line.push(TileType.Spawn);
      else if (col === 20 && row === 6) line.push(TileType.Base);
      else if (isOnPath(row, col)) line.push(TileType.Path);
      else line.push(TileType.Empty);
    }
    tiles.push(line);
  }
  return tiles;
}

const MAP: MapConfig = {
  name: '平原',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: buildTiles(),
  enemyPath: WAYPOINTS,
  tileColors: {
    [TileType.Empty]: '#3a7d44',
    [TileType.Path]: '#a1887f',
  },
};

const WAVES: WaveConfig[] = [
  {
    waveNumber: 1,
    enemies: [{ enemyType: EnemyType.Grunt, count: 5, spawnInterval: 1.5 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 2,
    enemies: [{ enemyType: EnemyType.Grunt, count: 8, spawnInterval: 1.2 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 3,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 6, spawnInterval: 1.0 },
      { enemyType: EnemyType.Runner, count: 3, spawnInterval: 0.6 },
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
      { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 1.2 },
      { enemyType: EnemyType.BossCommander, count: 1, spawnInterval: 0 },
    ],
    spawnDelay: 3,
    isBossWave: true,
  },
  {
    waveNumber: 6,
    enemies: [
      { enemyType: EnemyType.Runner, count: 6, spawnInterval: 0.6 },
      { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 1.0 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 7,
    enemies: [{ enemyType: EnemyType.Heavy, count: 4, spawnInterval: 1.8 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 8,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 2, spawnInterval: 2.0 },
      { enemyType: EnemyType.Runner, count: 5, spawnInterval: 0.5 },
      { enemyType: EnemyType.Exploder, count: 2, spawnInterval: 1.5 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 9,
    enemies: [
      { enemyType: EnemyType.Mage, count: 4, spawnInterval: 1.5 },
      { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 2.0 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 10,
    enemies: [
      { enemyType: EnemyType.BossBeast, count: 1, spawnInterval: 0 },
      { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 0.8 },
      { enemyType: EnemyType.Exploder, count: 2, spawnInterval: 1.2 },
    ],
    spawnDelay: 4,
    isBossWave: true,
  },
];

export const LEVEL_01: LevelConfig = {
  id: 'L1_plains',
  name: '平原',
  theme: LevelTheme.Plains,
  description: '简单的草原地形，适合熟悉基础操作',
  map: MAP,
  waves: WAVES,
  startingGold: 200,
  availableTowers: [TowerType.Arrow],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: null,
};
