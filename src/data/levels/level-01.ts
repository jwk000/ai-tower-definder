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
  { row: 0, col: 0 },
  { row: 0, col: 20 },
  { row: 1, col: 20 },
  { row: 2, col: 20 },
  { row: 3, col: 20 },
  { row: 3, col: 1 },
  { row: 4, col: 1 },
  { row: 5, col: 1 },
  { row: 6, col: 1 },
  { row: 6, col: 20 },
  { row: 7, col: 20 },
  { row: 8, col: 20 },
];

const TILES: TileType[][] = [
  // Row 0: spawn top-left, then full-width horizontal path →
  [TileType.Spawn,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path],
  // Row 1: buildable grassland, right edge connector ↓
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path],
  // Row 2: buildable grassland, right edge connector ↓
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path],
  // Row 3: full-width horizontal path ← (reversed direction)
  [TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path],
  // Row 4: left edge connector ↓, then buildable grassland
  [TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  // Row 5: left edge connector ↓, then buildable grassland
  [TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  // Row 6: full-width horizontal path →
  [TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path],
  // Row 7: buildable grassland, right edge connector ↓
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path],
  // Row 8: buildable grassland, base at bottom-right
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Base],
];

const { pathGraph: PATH_GRAPH, spawns: SPAWNS } = migrateEnemyPathToGraph({ enemyPath: WAYPOINTS });

const MAP: MapConfig = {
  name: '平原',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: TILES,
  pathGraph: PATH_GRAPH,
  spawns: SPAWNS,
  tileColors: {
    [TileType.Empty]: '#7d9b6e',
    [TileType.Path]: '#bfad94',
    [TileType.Spawn]: '#ff8f00',
    [TileType.Base]: '#1e88e5',
  },
  sceneDescription: '广袤的草原上，一条宽阔的土路从山脚蜿蜒而出，横穿整个平原后折返，经过麦田和农舍，最终通向那座被村民加固过的石墙基地。哥布林侦察兵常年沿此路南下劫掠，如今村民们已在沿途布下防御。',
  obstaclePlacements: [
    { type: ObstacleType.Tree, row: 1, col: 8 },
    { type: ObstacleType.Tree, row: 2, col: 15 },
    { type: ObstacleType.Tree, row: 4, col: 18 },
    { type: ObstacleType.Tree, row: 7, col: 5 },
    { type: ObstacleType.Tree, row: 8, col: 17 },
    { type: ObstacleType.Bush, row: 1, col: 3 },
    { type: ObstacleType.Bush, row: 2, col: 10 },
    { type: ObstacleType.Bush, row: 4, col: 10 },
    { type: ObstacleType.Bush, row: 5, col: 12 },
    { type: ObstacleType.Bush, row: 7, col: 16 },
    { type: ObstacleType.Bush, row: 8, col: 5 },
    { type: ObstacleType.Flower, row: 3, col: 0 },
    { type: ObstacleType.Flower, row: 4, col: 15 },
    { type: ObstacleType.Flower, row: 5, col: 18 },
    { type: ObstacleType.Flower, row: 7, col: 10 },
    { type: ObstacleType.Flower, row: 8, col: 12 },
  ],
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
  sceneDescription: '村庄郊外的草原。哥布林步兵、侦察兵和萨满从这条路发起进攻。第5波会出现哥布林指挥官，第10波巨兽将亲自出马。',
  map: MAP,
  waves: WAVES,
  startingGold: 220,
  availableTowers: [TowerType.Arrow, TowerType.Cannon],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: null,
  weatherPool: [WeatherType.Sunny, WeatherType.Rain, WeatherType.Fog],
};
