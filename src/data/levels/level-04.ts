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

const TILES: TileType[][] = [
  [TileType.Empty,TileType.Spawn,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Blocked,TileType.Path,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Blocked,TileType.Empty,TileType.Path,TileType.Blocked,TileType.Blocked,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Blocked,TileType.Empty,TileType.Path,TileType.Blocked,TileType.Blocked,TileType.Path,TileType.Empty,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Blocked,TileType.Path,TileType.Blocked,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Blocked,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Blocked,TileType.Path,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Empty,TileType.Path,TileType.Path,TileType.Blocked,TileType.Path,TileType.Path,TileType.Blocked,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty,TileType.Empty],
  [TileType.Blocked,TileType.Empty,TileType.Blocked,TileType.Empty,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Path,TileType.Base],
];

const MAP: MapConfig = {
  name: '火山',
  cols: 21,
  rows: 9,
  tileSize: 64,
  tiles: TILES,
  enemyPath: WAYPOINTS,
  tileColors: {
    [TileType.Empty]: '#4e342e',
    [TileType.Path]: '#8d6e63',
    [TileType.Blocked]: '#d32f2f',
    [TileType.Spawn]: '#ff5722',
    [TileType.Base]: '#1e88e5',
  },
  sceneDescription: '活火山的斜坡上，岩浆河从裂缝中涌出，将黑曜石般的大地切割成支离破碎的岛屿。烧焦的树干像炭化的骨骼指向天空，火山砾石铺满了所有可以立足的地方。火山灰如黑雪般飘落，空气中弥漫着硫磺的气味。敌人在这种极端环境中如鱼得水。',
  obstaclePlacements: [
    { type: ObstacleType.LavaVent, row: 0, col: 13 },
    { type: ObstacleType.LavaVent, row: 0, col: 18 },
    { type: ObstacleType.LavaVent, row: 2, col: 14 },
    { type: ObstacleType.LavaVent, row: 6, col: 15 },
    { type: ObstacleType.ScorchedTree, row: 1, col: 8 },
    { type: ObstacleType.ScorchedTree, row: 3, col: 16 },
    { type: ObstacleType.ScorchedTree, row: 4, col: 10 },
    { type: ObstacleType.ScorchedTree, row: 7, col: 0 },
    { type: ObstacleType.VolcanicRock, row: 1, col: 16 },
    { type: ObstacleType.VolcanicRock, row: 2, col: 9 },
    { type: ObstacleType.VolcanicRock, row: 4, col: 18 },
    { type: ObstacleType.VolcanicRock, row: 5, col: 14 },
    { type: ObstacleType.VolcanicRock, row: 6, col: 19 },
    { type: ObstacleType.VolcanicRock, row: 7, col: 16 },
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
  sceneDescription: '活火山脚下的炼狱之地。熔岩河将大地割裂，火元素步兵和熔岩巨像在灼热的道路上推进。第10波炎魔将领现身，第15波熔核巨兽是最终考验。熔岩裂缝不可建造。',
  map: MAP,
  waves: WAVES,
  startingGold: 350,
  availableTowers: [TowerType.Arrow, TowerType.Cannon, TowerType.Lightning, TowerType.Laser],
  availableUnits: [],
  unlockStarsRequired: 0,
  unlockPrevLevelId: 'L3_tundra',
  weatherPool: [WeatherType.Sunny, WeatherType.Rain, WeatherType.Fog],
};
