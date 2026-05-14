import {
  TileType,
  TowerType,
  EnemyType,
  LevelTheme,
  ObstacleType,
  WeatherType,
  type LevelConfig,
  type MapConfig,
  type WaveConfig,
  type GridPos,
} from '../../types/index.js';
import { migrateEnemyPathToGraph } from '../../level/graph/migration.js';

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

const TILES: TileType[][] = [
  [TileType.Empty,TileType.Empty,TileType.Spawn,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Path,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Blocked,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Blocked,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Blocked,TileType.Empty,TileType.Path,TileType.Empty,TileType.Path,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Base],
  [TileType.Empty,TileType.Empty,TileType.Path,TileType.Path,TileType.Blocked,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Path,TileType.Path,TileType.Path,TileType.Blocked,TileType.Path,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path,TileType.Blocked,TileType.Path,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Path,TileType.Path,TileType.Path,TileType.Blocked,TileType.Path,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
];

const { pathGraph: PATH_GRAPH, spawns: SPAWNS } = migrateEnemyPathToGraph({ enemyPath: WAYPOINTS });

const MAP: MapConfig = {
  name: '沙漠',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: TILES,
  pathGraph: PATH_GRAPH,
  spawns: SPAWNS,
  tileColors: {
    [TileType.Empty]: '#dcc89a',
    [TileType.Path]: '#a89078',
    [TileType.Blocked]: '#8d6e63',
    [TileType.Spawn]: '#e6c44d',
    [TileType.Base]: '#1e88e5',
  },
  sceneDescription: '曾经繁荣的古代商路如今被黄沙半掩。巨大的砂岩和枯骨散落在道路两旁，仙人掌在烈日下顽强生长。沙漠强盗占据了这片区域，在岩石后方设伏，等待过往的商队。热浪扭曲了地平线，每一步都像是在火炉中行走。',
  obstaclePlacements: [
    { type: ObstacleType.Rock, row: 0, col: 6 },
    { type: ObstacleType.Rock, row: 0, col: 14 },
    { type: ObstacleType.Rock, row: 3, col: 15 },
    { type: ObstacleType.Rock, row: 7, col: 18 },
    { type: ObstacleType.Rock, row: 6, col: 13 },
    { type: ObstacleType.Cactus, row: 1, col: 10 },
    { type: ObstacleType.Cactus, row: 2, col: 18 },
    { type: ObstacleType.Cactus, row: 5, col: 16 },
    { type: ObstacleType.Cactus, row: 7, col: 3 },
    { type: ObstacleType.Cactus, row: 8, col: 9 },
    { type: ObstacleType.Bones, row: 1, col: 14 },
    { type: ObstacleType.Bones, row: 3, col: 10 },
    { type: ObstacleType.Bones, row: 5, col: 19 },
    { type: ObstacleType.Bones, row: 7, col: 0 },
    { type: ObstacleType.Bones, row: 8, col: 16 },
  ],
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
  sceneDescription: '古代商路的沙漠遗迹。沙漠掠夺者、沙岩铠甲兵和沙漠术士据守此地。第6波强盗头目现身，第12波沙虫巨兽压阵。岩石限制了防御塔的布置。',
  map: MAP,
  waves: WAVES,
  startingGold: 260,
  availableTowers: [TowerType.Arrow, TowerType.Cannon, TowerType.Laser],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: 'L1_plains',
  weatherPool: [WeatherType.Sunny, WeatherType.Fog, WeatherType.Night],
};
