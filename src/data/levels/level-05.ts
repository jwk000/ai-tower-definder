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
  { row: 1, col: 1 },
  { row: 1, col: 6 },
  { row: 4, col: 6 },
  { row: 4, col: 9 },
  { row: 7, col: 9 },
  { row: 7, col: 3 },
  { row: 11, col: 3 },
  { row: 11, col: 8 },
  { row: 13, col: 8 },
  { row: 13, col: 11 },
  { row: 9, col: 11 },
  { row: 9, col: 15 },
  { row: 4, col: 15 },
  { row: 4, col: 19 },
  { row: 8, col: 19 },
  { row: 8, col: 23 },
  { row: 12, col: 23 },
  { row: 12, col: 27 },
  { row: 7, col: 27 },
  { row: 7, col: 24 },
  { row: 2, col: 24 },
  { row: 2, col: 19 },
  { row: 7, col: 19 },
  { row: 7, col: 29 },
];

const WALL_TILES = new Set([
  '2,0', '2,7', '2,8', '2,9', '2,10', '2,11',
  '3,0', '3,7', '3,10', '3,11', '3,12', '3,14',
  '5,0', '5,5', '5,7', '5,10', '5,11', '5,12', '5,14',
  '6,0', '6,5', '6,10', '6,12', '6,13',
  '8,0', '8,7', '8,9', '8,13', '8,14', '8,16',
  '10,0', '10,7', '10,9', '10,13', '10,14', '10,16',
  '12,7', '12,9', '12,13', '12,14', '12,15',
  '14,0', '14,4', '14,5', '14,9', '14,10', '14,13', '14,14',
  '15,4', '15,5', '15,9', '15,10',
  '3,20', '3,21', '3,25', '3,26',
  '5,20', '5,21', '5,25', '5,26',
  '9,20', '9,21', '9,25', '9,26',
  '10,20', '10,21', '10,25', '10,26',
  '13,20', '13,21', '13,25', '13,26',
  '14,20', '14,21', '14,22', '14,25', '14,26',
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
  for (let row = 0; row < 16; row++) {
    const line: TileType[] = [];
    for (let col = 0; col < 30; col++) {
      if (col === 1 && row === 1) line.push(TileType.Spawn);
      else if (col === 29 && row === 7) line.push(TileType.Base);
      else if (isOnPath(row, col)) line.push(TileType.Path);
      else if (WALL_TILES.has(`${row},${col}`)) line.push(TileType.Blocked);
      else line.push(TileType.Empty);
    }
    tiles.push(line);
  }
  return tiles;
}

const MAP: MapConfig = {
  name: '城堡',
  cols: 30,
  rows: 16,
  tileSize: 64,
  tiles: buildTiles(),
  enemyPath: WAYPOINTS,
  tileColors: {
    [TileType.Empty]: '#37474f',
    [TileType.Path]: '#616161',
    [TileType.Blocked]: '#1a1a1a',
    [TileType.Spawn]: '#fff176',
    [TileType.Base]: '#42a5f5',
  },
};

const WAVES: WaveConfig[] = [
  {
    waveNumber: 1,
    enemies: [{ enemyType: EnemyType.Grunt, count: 8, spawnInterval: 1.2 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 2,
    enemies: [{ enemyType: EnemyType.Grunt, count: 10, spawnInterval: 1.0 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 3,
    enemies: [
      { enemyType: EnemyType.Grunt, count: 5, spawnInterval: 1.0 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.6 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 4,
    enemies: [{ enemyType: EnemyType.Heavy, count: 4, spawnInterval: 1.8 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 5,
    enemies: [
      { enemyType: EnemyType.Runner, count: 6, spawnInterval: 0.5 },
      { enemyType: EnemyType.Mage, count: 2, spawnInterval: 1.5 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 6,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 5, spawnInterval: 1.8 },
      { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 1.0 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 7,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 2.0 },
      { enemyType: EnemyType.Mage, count: 4, spawnInterval: 1.5 },
      { enemyType: EnemyType.Runner, count: 3, spawnInterval: 0.6 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 8,
    enemies: [
      { enemyType: EnemyType.Exploder, count: 5, spawnInterval: 1.0 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.5 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 9,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 6, spawnInterval: 1.6 },
      { enemyType: EnemyType.Mage, count: 3, spawnInterval: 1.5 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 10,
    enemies: [
      { enemyType: EnemyType.BossCommander, count: 1, spawnInterval: 0 },
      { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 1.8 },
      { enemyType: EnemyType.Exploder, count: 3, spawnInterval: 1.2 },
    ],
    spawnDelay: 3,
    isBossWave: true,
  },
  {
    waveNumber: 11,
    enemies: [
      { enemyType: EnemyType.Mage, count: 6, spawnInterval: 1.5 },
      { enemyType: EnemyType.Runner, count: 5, spawnInterval: 0.5 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 12,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 5, spawnInterval: 1.6 },
      { enemyType: EnemyType.Exploder, count: 4, spawnInterval: 1.0 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 13,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 4, spawnInterval: 1.8 },
      { enemyType: EnemyType.Mage, count: 4, spawnInterval: 1.5 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.5 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 14,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 6, spawnInterval: 1.6 },
      { enemyType: EnemyType.Mage, count: 5, spawnInterval: 1.5 },
      { enemyType: EnemyType.Exploder, count: 4, spawnInterval: 1.0 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 15,
    enemies: [
      { enemyType: EnemyType.BossCommander, count: 1, spawnInterval: 0 },
      { enemyType: EnemyType.Heavy, count: 4, spawnInterval: 1.8 },
      { enemyType: EnemyType.Mage, count: 3, spawnInterval: 1.5 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.5 },
    ],
    spawnDelay: 4,
    isBossWave: true,
  },
];

export const LEVEL_05: LevelConfig = {
  id: 'L5_castle',
  name: '城堡',
  theme: LevelTheme.Castle,
  description: '迷宫般的城堡路径，考验你的全部防御能力',
  map: MAP,
  waves: WAVES,
  startingGold: 400,
  availableTowers: [TowerType.Arrow, TowerType.Cannon, TowerType.Ice, TowerType.Lightning],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: 'L4_volcano',
};
