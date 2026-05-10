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
  { row: 1, col: 2 },
  { row: 3, col: 2 },
  { row: 3, col: 4 },
  { row: 5, col: 4 },
  { row: 5, col: 1 },
  { row: 7, col: 1 },
  { row: 7, col: 5 },
  { row: 5, col: 5 },
  { row: 5, col: 7 },
  { row: 3, col: 7 },
  { row: 3, col: 8 },
  { row: 5, col: 8 },
  { row: 5, col: 20 },
];

const TILES: TileType[][] = [
  [TileType.Blocked,TileType.Blocked,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Spawn,TileType.Blocked,TileType.Path,TileType.Blocked,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Blocked,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Blocked,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Blocked,TileType.Blocked,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Path,TileType.Blocked,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Blocked,TileType.Blocked,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Base],
  [TileType.Empty,TileType.Path,TileType.Blocked,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Blocked,TileType.Path,TileType.Blocked,TileType.Path,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Blocked,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
];

const MAP: MapConfig = {
  name: '城堡',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: TILES,
  enemyPath: WAYPOINTS,
  tileColors: {
    [TileType.Empty]: '#37474f',
    [TileType.Path]: '#616161',
    [TileType.Blocked]: '#1a1a1a',
    [TileType.Spawn]: '#fff176',
    [TileType.Base]: '#42a5f5',
  },
  sceneDescription: '一座被遗忘的远古要塞内部。厚重的石墙和巨大的石柱构成了迷宫般的走廊，墙壁上的火炬是唯一的光源，投下摇曳的阴影。地面上散落着坍塌的碎石，敌人的主力部队已经占领了这座要塞，准备以此为据点发动最终进攻。这是最后的防线，退无可退。',
  obstaclePlacements: [
    { type: ObstacleType.Brazier, row: 0, col: 8 },
    { type: ObstacleType.Brazier, row: 2, col: 19 },
    { type: ObstacleType.Brazier, row: 4, col: 14 },
    { type: ObstacleType.Brazier, row: 7, col: 19 },
    { type: ObstacleType.Brazier, row: 6, col: 1 },
    { type: ObstacleType.Rubble, row: 0, col: 14 },
    { type: ObstacleType.Rubble, row: 2, col: 11 },
    { type: ObstacleType.Rubble, row: 3, col: 14 },
    { type: ObstacleType.Rubble, row: 4, col: 10 },
    { type: ObstacleType.Rubble, row: 6, col: 16 },
    { type: ObstacleType.Rubble, row: 7, col: 0 },
    { type: ObstacleType.Rubble, row: 8, col: 14 },
    { type: ObstacleType.Pillar, row: 0, col: 4 },
    { type: ObstacleType.Pillar, row: 2, col: 4 },
    { type: ObstacleType.Pillar, row: 6, col: 9 },
    { type: ObstacleType.Pillar, row: 8, col: 5 },
    { type: ObstacleType.Pillar, row: 8, col: 18 },
  ],
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
  sceneDescription: '远古要塞的深处，敌人的主力部队已全面占领此地。石墙与石柱形成迷宫走廊，所有敌人类型全部登场。第10波和第15波指挥官亲自率队冲锋。五路精英混编，是对防御体系的终极考验。',
  map: MAP,
  waves: WAVES,
  startingGold: 400,
  availableTowers: [TowerType.Arrow, TowerType.Cannon, TowerType.Ice, TowerType.Lightning, TowerType.Laser, TowerType.Bat],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: 'L4_volcano',
  weatherPool: [WeatherType.Rain, WeatherType.Night, WeatherType.Fog],
};
