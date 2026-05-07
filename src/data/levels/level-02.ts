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
  { row: 0, col: 2 },
  { row: 3, col: 2 },
  { row: 3, col: 5 },
  { row: 6, col: 5 },
  { row: 6, col: 1 },
  { row: 8, col: 1 },
  { row: 8, col: 6 },
  { row: 5, col: 6 },
  { row: 5, col: 3 },
  { row: 2, col: 3 },
  { row: 2, col: 8 },
  { row: 4, col: 8 },
  { row: 4, col: 20 },
];

const BLOCKED_TILES = new Set([
  '1,4', '1,7', '2,1', '2,6',
  '4,1', '4,6', '5,4', '6,3',
  '7,1', '7,5', '7,7', '8,4',
]);

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
      if (col === 2 && row === 0) line.push(TileType.Spawn);
      else if (col === 20 && row === 4) line.push(TileType.Base);
      else if (isOnPath(row, col)) line.push(TileType.Path);
      else if (BLOCKED_TILES.has(`${row},${col}`)) line.push(TileType.Blocked);
      else line.push(TileType.Empty);
    }
    tiles.push(line);
  }
  return tiles;
}

const MAP: MapConfig = {
  name: '沙漠',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: buildTiles(),
  enemyPath: WAYPOINTS,
  tileColors: {
    [TileType.Empty]: '#c9a96e',
    [TileType.Path]: '#8b7355',
    [TileType.Blocked]: '#795548',
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
      { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 1.0 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.7 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 4,
    enemies: [{ enemyType: EnemyType.Runner, count: 8, spawnInterval: 0.5 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 5,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 6, spawnInterval: 1.0 },
      { enemyType: EnemyType.Heavy, count: 2, spawnInterval: 2.0 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 6,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 3, spawnInterval: 1.0 },
      { enemyType: EnemyType.BossCommander, count: 1, spawnInterval: 0 },
      { enemyType: EnemyType.Runner, count: 2, spawnInterval: 0.6 },
    ],
    spawnDelay: 3,
    isBossWave: true,
  },
  {
    waveNumber: 7,
    enemies: [{ enemyType: EnemyType.Heavy, count: 5, spawnInterval: 1.8 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 8,
    enemies: [
      { enemyType: EnemyType.Mage, count: 3, spawnInterval: 1.5 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.6 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 9,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 5, spawnInterval: 1.0 },
      { enemyType: EnemyType.Exploder, count: 3, spawnInterval: 1.2 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 10,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 4, spawnInterval: 1.8 },
      { enemyType: EnemyType.Mage, count: 3, spawnInterval: 1.5 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 11,
    enemies: [
      { enemyType: EnemyType.Runner, count: 5, spawnInterval: 0.5 },
      { enemyType: EnemyType.Exploder, count: 4, spawnInterval: 1.0 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 12,
    enemies: [
      { enemyType: EnemyType.BossBeast, count: 1, spawnInterval: 0 },
      { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 1.8 },
      { enemyType: EnemyType.Runner, count: 3, spawnInterval: 0.5 },
    ],
    spawnDelay: 4,
    isBossWave: true,
  },
];

export const LEVEL_02: LevelConfig = {
  id: 'L2_desert',
  name: '沙漠',
  theme: LevelTheme.Desert,
  description: '蜿蜒的沙漠路径，岩石阻碍了建造空间',
  map: MAP,
  waves: WAVES,
  startingGold: 250,
  availableTowers: [TowerType.Arrow, TowerType.Cannon],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: 'L1_plains',
};
