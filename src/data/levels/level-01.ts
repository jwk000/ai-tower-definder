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

const TILES: TileType[][] = [
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Spawn,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Base],
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
];

const MAP: MapConfig = {
  name: '平原',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: TILES,
  enemyPath: WAYPOINTS,
  tileColors: {
    [TileType.Empty]: '#3a7d44',
    [TileType.Path]: '#a1887f',
    [TileType.Spawn]: '#ff8f00',
    [TileType.Base]: '#1e88e5',
  },
  sceneDescription: '青翠的草原上点缀着野花和灌木丛。一条土路从村庄延伸而来，蜿蜒穿过田野。这里是哥布林侦察兵经常出没的地方，村民们已经加固了道路尽头的基地。微风吹过，草浪起伏，看似平静的表面下暗藏杀机。',
  obstaclePlacements: [
    { type: ObstacleType.Tree, row: 0, col: 3 },
    { type: ObstacleType.Tree, row: 0, col: 17 },
    { type: ObstacleType.Tree, row: 3, col: 18 },
    { type: ObstacleType.Tree, row: 7, col: 20 },
    { type: ObstacleType.Tree, row: 8, col: 2 },
    { type: ObstacleType.Bush, row: 1, col: 8 },
    { type: ObstacleType.Bush, row: 2, col: 9 },
    { type: ObstacleType.Bush, row: 3, col: 10 },
    { type: ObstacleType.Bush, row: 4, col: 12 },
    { type: ObstacleType.Bush, row: 7, col: 8 },
    { type: ObstacleType.Bush, row: 8, col: 15 },
    { type: ObstacleType.Flower, row: 0, col: 10 },
    { type: ObstacleType.Flower, row: 1, col: 16 },
    { type: ObstacleType.Flower, row: 2, col: 1 },
    { type: ObstacleType.Flower, row: 3, col: 14 },
    { type: ObstacleType.Flower, row: 8, col: 11 },
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
  startingGold: 200,
  availableTowers: [TowerType.Arrow, TowerType.Cannon],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: null,
  weatherPool: [WeatherType.Sunny, WeatherType.Rain, WeatherType.Fog],
};
