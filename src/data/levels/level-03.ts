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

const PRIMARY_WAYPOINTS: GridPos[] = [
  { row: 0, col: 1 },
  { row: 3, col: 1 },
  { row: 3, col: 4 },
  { row: 6, col: 4 },
  { row: 6, col: 7 },
  { row: 8, col: 7 },
  { row: 8, col: 20 },
];

const TILES: TileType[][] = [
  [TileType.Empty,TileType.Spawn,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Spawn,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Base],
];

const MAP: MapConfig = {
  name: '冰原',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: TILES,
  enemyPath: PRIMARY_WAYPOINTS,
  altSpawnPoints: [{ row: 0, col: 6 }],
  tileColors: {
    [TileType.Empty]: '#cfd8dc',
    [TileType.Path]: '#90a4ae',
    [TileType.Spawn]: '#4dd0e1',
    [TileType.Base]: '#42a5f5',
  },
  sceneDescription: '永恒的冬天笼罩着这片冰原。地面覆盖着厚厚的积雪，尖锐的冰晶从地表刺出，被冰封的古树如同幽灵般伫立。两条道路从不同的方向汇聚——敌人在此地建立了双线进攻的据点。寒风呼啸，连呼吸都会在空气中凝结成冰雾。',
  obstaclePlacements: [
    { type: ObstacleType.IceCrystal, row: 0, col: 3 },
    { type: ObstacleType.IceCrystal, row: 0, col: 10 },
    { type: ObstacleType.IceCrystal, row: 2, col: 15 },
    { type: ObstacleType.IceCrystal, row: 5, col: 10 },
    { type: ObstacleType.IceCrystal, row: 7, col: 2 },
    { type: ObstacleType.SnowTree, row: 1, col: 10 },
    { type: ObstacleType.SnowTree, row: 4, col: 16 },
    { type: ObstacleType.SnowTree, row: 6, col: 14 },
    { type: ObstacleType.FrozenRock, row: 0, col: 17 },
    { type: ObstacleType.FrozenRock, row: 2, col: 10 },
    { type: ObstacleType.FrozenRock, row: 5, col: 17 },
    { type: ObstacleType.FrozenRock, row: 7, col: 12 },
    { type: ObstacleType.FrozenRock, row: 8, col: 0 },
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
  sceneDescription: '永冻之地的冰原战场。冰原斥候和冰面滑行者从两条路线同时进攻。第5波、第13波冰霜将领指挥作战，第15波冰原猛犸与将领联手。冰晶和冰封的树木散落在雪地中。',
  map: MAP,
  waves: WAVES,
  startingGold: 300,
  availableTowers: [TowerType.Arrow, TowerType.Ice, TowerType.Bat],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: 'L2_desert',
  weatherPool: [WeatherType.Snow, WeatherType.Fog, WeatherType.Night],
};
