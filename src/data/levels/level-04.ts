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
  { row: 0, col: 1 },
  { row: 2, col: 1 },
  { row: 2, col: 3 },
  { row: 5, col: 3 },
  { row: 5, col: 1 },
  { row: 7, col: 1 },
  { row: 7, col: 4 },
  { row: 5, col: 4 },
  { row: 5, col: 6 },
  { row: 3, col: 6 },
  { row: 3, col: 8 },
  { row: 6, col: 8 },
  { row: 6, col: 5 },
  { row: 8, col: 5 },
  { row: 8, col: 20 },
];

const LAVA_TILES = new Set([
  '1,2', '1,5', '2,2', '2,5',
  '3,1', '3,4', '4,1', '4,4',
  '5,5', '5,7', '6,2', '6,7',
  '7,3', '7,6', '8,1', '8,3',
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
      if (col === 1 && row === 0) line.push(TileType.Spawn);
      else if (col === 20 && row === 8) line.push(TileType.Base);
      else if (isOnPath(row, col)) line.push(TileType.Path);
      else if (LAVA_TILES.has(`${row},${col}`)) line.push(TileType.Blocked);
      else line.push(TileType.Empty);
    }
    tiles.push(line);
  }
  return tiles;
}

const MAP: MapConfig = {
  name: '火山',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: buildTiles(),
  enemyPath: WAYPOINTS,
  tileColors: {
    [TileType.Empty]: '#4e342e',
    [TileType.Path]: '#8d6e63',
    [TileType.Blocked]: '#d32f2f',
    [TileType.Spawn]: '#ff5722',
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
      { enemyType: EnemyType.Grunt, count: 6, spawnInterval: 1.0 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.6 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 4,
    enemies: [{ enemyType: EnemyType.Heavy, count: 5, spawnInterval: 1.8 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 5,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 2.0 },
      { enemyType: EnemyType.Grunt, count: 4, spawnInterval: 1.0 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 6,
    enemies: [
      { enemyType: EnemyType.Runner, count: 8, spawnInterval: 0.5 },
      { enemyType: EnemyType.Mage, count: 3, spawnInterval: 1.5 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 7,
    enemies: [{ enemyType: EnemyType.Heavy, count: 6, spawnInterval: 1.6 }],
    spawnDelay: 2,
  },
  {
    waveNumber: 8,
    enemies: [
      { enemyType: EnemyType.Mage, count: 4, spawnInterval: 1.5 },
      { enemyType: EnemyType.Exploder, count: 4, spawnInterval: 1.2 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 9,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 5, spawnInterval: 1.8 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.6 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 10,
    enemies: [
      { enemyType: EnemyType.BossCommander, count: 1, spawnInterval: 0 },
      { enemyType: EnemyType.Heavy, count: 4, spawnInterval: 1.8 },
    ],
    spawnDelay: 3,
    isBossWave: true,
  },
  {
    waveNumber: 11,
    enemies: [
      { enemyType: EnemyType.Mage, count: 5, spawnInterval: 1.5 },
      { enemyType: EnemyType.Exploder, count: 5, spawnInterval: 1.0 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 12,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 4, spawnInterval: 1.8 },
      { enemyType: EnemyType.Mage, count: 4, spawnInterval: 1.5 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 13,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 6, spawnInterval: 1.6 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.5 },
    ],
    spawnDelay: 2,
  },
  {
    waveNumber: 14,
    enemies: [
      { enemyType: EnemyType.Heavy, count: 5, spawnInterval: 1.8 },
      { enemyType: EnemyType.Mage, count: 4, spawnInterval: 1.5 },
      { enemyType: EnemyType.Exploder, count: 3, spawnInterval: 1.2 },
    ],
    spawnDelay: 3,
  },
  {
    waveNumber: 15,
    enemies: [
      { enemyType: EnemyType.BossBeast, count: 1, spawnInterval: 0 },
      { enemyType: EnemyType.Heavy, count: 3, spawnInterval: 1.8 },
      { enemyType: EnemyType.Runner, count: 4, spawnInterval: 0.5 },
    ],
    spawnDelay: 4,
    isBossWave: true,
  },
];

export const LEVEL_04: LevelConfig = {
  id: 'L4_volcano',
  name: '火山',
  theme: LevelTheme.Volcano,
  description: '熔岩地形限制了建造空间，敌人拥有火焰抗性',
  map: MAP,
  waves: WAVES,
  startingGold: 350,
  availableTowers: [TowerType.Arrow, TowerType.Cannon, TowerType.Lightning],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: 'L3_tundra',
};
