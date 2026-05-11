// ============================================================
// Tower Defender — Core Type Definitions
// ============================================================

// ---- ECS Core ----

/** Unique entity identifier */
export type EntityId = number;

/** Component tag (no data — used for type filtering) */
export interface Component {
  readonly type: string;
}

/** System processes entities matching its required components */
export interface System {
  readonly name: string;
  /** Required component types to process an entity */
  readonly requiredComponents: readonly string[];
  /** Called once per frame with matching entities */
  update(entities: EntityId[], deltaTime: number): void;
}

// ---- Grid & Map ----

export enum TileType {
  Empty = 'empty',
  Path = 'path',
  Blocked = 'blocked',
  Base = 'base',
  Spawn = 'spawn',
}

export interface Tile {
  type: TileType;
  row: number;
  col: number;
}

export interface SceneLayout {
  offsetX: number;
  offsetY: number;
  cols: number;
  rows: number;
  tileSize: number;
  mapPixelW: number;
  mapPixelH: number;
}

export enum ObstacleType {
  // Plains
  Tree = 'tree',
  Bush = 'bush',
  Flower = 'flower',
  // Desert
  Rock = 'rock',
  Cactus = 'cactus',
  Bones = 'bones',
  // Tundra
  IceCrystal = 'ice_crystal',
  SnowTree = 'snow_tree',
  FrozenRock = 'frozen_rock',
  // Volcano
  LavaVent = 'lava_vent',
  ScorchedTree = 'scorched_tree',
  VolcanicRock = 'volcanic_rock',
  // Castle
  Pillar = 'pillar',
  Brazier = 'brazier',
  Rubble = 'rubble',
}

export interface ObstaclePlacement {
  row: number;
  col: number;
  type: ObstacleType;
}

// ---- 场景表现增强 ----

/** 环境生物类型 */
export enum AmbientCreatureType {
  Bird = 0,            // 小鸟
  Butterfly = 1,       // 蝴蝶
  Squirrel = 2,        // 松鼠（平原）
  Lizard = 3,          // 蜥蜴（沙漠）
  Penguin = 4,         // 企鹅（冰原）
  Firefly = 5,         // 萤火虫（火山/夜晚）
  Rat = 6,             // 老鼠（城堡）
  // 通用
  GrassBlade = 10,     // 草丛叶片（微动）
  FloatingDust = 11,   // 漂浮尘埃/花粉
}

/** 环境生物预设活动路径 */
export interface CreaturePath {
  type: AmbientCreatureType;
  /** 路径点序列（像素坐标，非网格坐标） */
  waypoints: { x: number; y: number }[];
  /** true = 循环路径，false = 来回走动 */
  loop: boolean;
}

/** 环境生物配置 */
export interface AmbientCreatureConfig {
  birds: { min: number; max: number };
  groundAnimals: {
    types: AmbientCreatureType[];
    count: number;
    spawnChance: number;  // 每波刷新概率 (0-1)
  };
  grassBlades: { enabled: boolean; density: number };  // density: 0-1
  floatingDust: { enabled: boolean };
}

/** 全屏环境特效开关 */
export interface EnvironmentFXConfig {
  sunRays: boolean;
  cloudShadows: boolean;
  windLines: boolean;
  vignette: boolean;
  heatShimmer: boolean;
  waterShimmer: boolean;
  cameraBreathing: boolean;
}

export interface MapConfig {
  name: string;
  cols: number;
  rows: number;
  tileSize: number;
  tiles: TileType[][];
  enemyPath: GridPos[];
  tileColors?: Partial<Record<TileType, string>>;
  altSpawnPoints?: GridPos[];
  sceneDescription?: string;
  obstaclePlacements?: ObstaclePlacement[];
  neutralUnits?: Array<{
    type: 'trap' | 'spring' | 'chest';
    row: number; col: number;
    config?: Record<string, number>;
  }>;
  /** 动态环境生物配置 */
  ambientCreatures?: AmbientCreatureConfig;
  /** 全屏环境特效开关 */
  environmentFX?: EnvironmentFXConfig;
  /** 生物活动预设路径 */
  creaturePaths?: CreaturePath[];
}

export interface GridPos {
  row: number;
  col: number;
}

// ---- Building / Tower ----

export enum TowerType {
  Arrow = 'arrow',
  Cannon = 'cannon',
  Ice = 'ice',
  Lightning = 'lightning',
  Laser = 'laser',
  Bat = 'bat',
  Missile = 'missile',
  Vine = 'vine',
  Command = 'command',
  Ballista = 'ballista',
}

export interface TowerConfig {
  type: TowerType;
  name: string;
  cost: number;
  hp: number;
  atk: number;
  attackSpeed: number;
  range: number;
  damageType: 'physical' | 'magic';
  upgradeCosts: number[];
  upgradeAtkBonus: number[];
  upgradeRangeBonus: number[];
  color: string;
  splashRadius?: number;
  stunDuration?: number;
  slowPercent?: number;
  slowMaxStacks?: number;
  freezeDuration?: number;
  chainCount?: number;
  chainDecay?: number;
  chainRange?: number;
  // Bat tower specific
  batCount?: number;
  batReplenishCD?: number;
  batHP?: number;
  batDamage?: number;
  batAttackRange?: number;
  batAttackSpeed?: number;
  batSpeed?: number;
  // Vine tower specific (DOT)
  dotDamage?: number;
  dotDuration?: number;
  dotMaxStacks?: number;
  // Command tower specific (aura buff)
  auraRadius?: number;
  auraAtkSpeedBonus?: number;
  auraRangeBonus?: number;
  auraAtkBonus?: number;
  // Ballista tower specific (piercing sniper)
  pierceCount?: number;
  armorPenetration?: number;
}

// ---- Enemy ----

export enum EnemyType {
  Grunt = 'grunt',
  Runner = 'runner',
  Heavy = 'heavy',
  Mage = 'mage',
  Exploder = 'exploder',
  BossCommander = 'boss_commander',
  BossBeast = 'boss_beast',
  HotAirBalloon = 'hot_air_balloon',
  Shaman = 'shaman',
  Juggernaut = 'juggernaut',
}

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number;
  atk: number;
  defense: number;
  magicResist: number;
  attackRange: number;
  attackSpeed: number;
  canAttackBuildings: boolean;
  rewardGold: number;
  color: string;
  radius: number;
  description?: string;
  isBoss?: boolean;
  bossPhase2HpRatio?: number;
  /** 死亡时触发的特殊效果类型 */
  specialOnDeath?: 'explode';
  /** 死亡爆炸伤害 */
  deathDamage?: number;
  /** 死亡爆炸半径 */
  deathRadius?: number;
  /** 热气球专用：炸弹伤害 */
  bombDamage?: number;
  /** 热气球专用：投弹间隔(秒) */
  bombInterval?: number;
  /** 热气球专用：炸弹爆炸半径 */
  bombRadius?: number;
  /** 萨满专用：治疗量/次 */
  healAmount?: number;
  /** 萨满专用：治疗间隔(秒) */
  healInterval?: number;
  /** 萨满专用：治疗光环半径 */
  healRadius?: number;
  /** 萨满专用：光环移速加成 */
  auraSpeedBonus?: number;
  /** 萨满专用：光环攻击加成 */
  auraAttackBonus?: number;
  /** 萨满专用：光环半径 */
  auraRadius?: number;
  /** 铁甲巨兽专用：冲锋速度加成 */
  chargeSpeedBonus?: number;
  /** 铁甲巨兽专用：冲锋冷却(秒) */
  chargeCooldown?: number;
  /** 铁甲巨兽专用：冲锋持续时间(秒) */
  chargeDuration?: number;
  /** 铁甲巨兽专用：眩晕抵抗(0-1, 0=正常 1=免疫) */
  stunResist?: number;
  /** 铁甲巨兽专用：冰冻抵抗(秒, 免疫时长减免) */
  freezeResist?: number;
}

// ---- Unit ----

export enum UnitType {
  ShieldGuard = 'shield_guard',
  Swordsman = 'swordsman',
}

export interface UnitConfig {
  type: UnitType;
  name: string;
  hp: number;
  atk: number;
  attackSpeed: number;
  attackRange: number;
  speed: number;
  defense: number;
  popCost: number;
  color: string;
  size: number;
  skillId: string;
  cost: number;
  moveRange: number;
  alertRange?: number; // detection radius for soldier AI alert behavior (default 0)
}

// ---- Production ----

export enum ProductionType {
  GoldMine = 'gold_mine',
  EnergyTower = 'energy_tower',
}

export interface ProductionConfig {
  type: ProductionType;
  name: string;
  cost: number;
  hp: number;
  resourceType: 'gold' | 'energy';
  baseRate: number;
  upgradeRateBonus: number;
  upgradeCosts: number[];
  maxLevel: number;
  color: string;
}

// ---- Buff ----

export enum BuffAttribute {
  HP = 'hp',
  ATK = 'atk',
  Speed = 'speed',
  Defense = 'defense',
  Range = 'range',
  AttackSpeed = 'attack_speed',
}

// ---- Weather ----

export enum WeatherType {
  Sunny = 'sunny',
  Rain = 'rain',
  Snow = 'snow',
  Fog = 'fog',
  Night = 'night',
}

export interface WeatherModifier {
  targetType: string;
  attribute: BuffAttribute;
  value: number;
  isPercent: boolean;
}

export interface WeatherConfig {
  type: WeatherType;
  name: string;
  modifiers: WeatherModifier[];
  screenTint: string;
  screenAlpha: number;
}

export interface BuffInstance {
  id: string;
  name: string;
  attribute: BuffAttribute;
  value: number;
  isPercent: boolean;
  duration: number;
  maxStacks: number;
  currentStacks: number;
  sourceEntityId: EntityId;
}

// ---- Skill ----

export enum SkillTrigger {
  Active = 'active',
  Passive = 'passive',
  Aura = 'aura',
  Conditional = 'conditional',
}

export interface SkillConfig {
  id: string;
  name: string;
  trigger: SkillTrigger;
  cooldown: number;
  energyCost: number;
  range: number;
  value: number;
  buffId: string | null;
  description: string;
}

// ---- Economy ----

export interface PlayerResources {
  gold: number;
  energy: number;
  lives: number;
  population: number;
  maxPopulation: number;
}

// ---- Wave ----

export interface WaveEnemyGroup {
  enemyType: EnemyType;
  count: number;
  spawnInterval: number;
}

export interface WaveConfig {
  waveNumber: number;
  enemies: WaveEnemyGroup[];
  spawnDelay: number;
  isBossWave?: boolean;
  spawnPointIndex?: number;
}

// ---- Game State ----

export enum GamePhase {
  Deployment = 'deployment',
  Battle = 'battle',
  WaveBreak = 'wave_break', // between waves
  Victory = 'victory',
  Defeat = 'defeat',
}

// ---- Input Abstraction ----

export enum InputAction {
  PointerDown = 'pointer_down',
  PointerMove = 'pointer_move',
  PointerUp = 'pointer_up',
  // Future: LongPress, DoubleTap
}

export interface InputEvent {
  action: InputAction;
  x: number; // canvas-relative
  y: number;
}

// ---- Geometry Rendering ----

export type ShapeType = 'rect' | 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'arrow';

export interface RenderCommand {
  shape: ShapeType;
  x: number;
  y: number;
  size: number;
  color: string;
  alpha?: number;
  rotation?: number;
  stroke?: string;
  strokeWidth?: number;
  label?: string;
  labelColor?: string;
  labelSize?: number;
  targetX?: number;
  targetY?: number;
  h?: number;           // height for rect (defaults to size = square)
  /** 渲染层级 (z-index)，值越大越靠前。默认 5 (Ground 层) */
  z?: number;
  /** 圆形裁剪半径 — 设置后 rect 绘制会被裁剪到该圆内 */
  clipRadius?: number;
}

// ---- Projectile ----

export interface ProjectileConfig {
  speed: number;       // pixels per second
  damage: number;
  shape: ShapeType;
  color: string;
  size: number;
}

// ---- Upgrade Visuals ----

/** Composite geometry part — a single visual element in a unit's multi-part rendering */
export interface CompositePart {
  shape: ShapeType;
  offsetX: number;   // relative to entity center
  offsetY: number;   // relative to entity center
  size: number;
  color: string;
  alpha?: number;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
}

/** Per-level upgrade visual configuration */
export interface UpgradeVisualConfig {
  level: number;
  /** Scale multiplier relative to base size (L1 = 1.0) */
  scaleMultiplier: number;
  /** Extra composite parts added at this level (beyond the base shape) */
  extraParts: CompositePart[];
  /** Glow config (L3-L5) */
  glow?: {
    radius: number;
    color: string;
    alpha: number;
    pulseAmplitude?: number; // default 0.05
  };
  /** Passive visual unlock at L3 */
  passiveVisual?: {
    type: 'crit_flash' | 'aoe_ring' | 'shatter_effect' | 'arc_upgrade' | 'beam_widen' | 'bat_plus' | 'double_explosion';
    description: string;
  };
}

/** Upgrade visual registry — maps tower ID to per-level configs */
export type UpgradeVisualRegistry = Record<string, UpgradeVisualConfig[]>;

// ---- Component Types (ECS data) ----

export const CType = {
  Position: 'Position',
  Render: 'Render',
  Health: 'Health',
  Attack: 'Attack',
  Movement: 'Movement',
  Tower: 'Tower',
  Enemy: 'Enemy',
  PlayerOwned: 'PlayerOwned',
  GridOccupant: 'GridOccupant',
  Projectile: 'Projectile',
  Unit: 'Unit',
  PlayerControllable: 'PlayerControllable',
  Buff: 'Buff',
  Skill: 'Skill',
  Production: 'Production',
  Boss: 'Boss',
  EnemyAttacker: 'EnemyAttacker',
  Trap: 'Trap',
  HealingSpring: 'HealingSpring',
  GoldChest: 'GoldChest',
  DeathEffect: 'DeathEffect',
  ExplosionEffect: 'ExplosionEffect',
  // New unified unit system components
  UnitTag: 'UnitTag',
  AI: 'AI',
  Lifecycle: 'Lifecycle',
  BatSwarmMember: 'BatSwarmMember',
  BatTower: 'BatTower',
  LaserBeam: 'LaserBeam',
} as const;

export type ComponentType = (typeof CType)[keyof typeof CType];

// ---- Game Screen ----

export enum GameScreen {
  LevelSelect = 'level_select',
  Battle = 'battle',
}

// ---- Level System ----

export enum LevelTheme {
  Plains = 'plains',
  Desert = 'desert',
  Tundra = 'tundra',
  Volcano = 'volcano',
  Castle = 'castle',
}

export interface LevelConfig {
  id: string;
  name: string;
  theme: LevelTheme;
  description: string;
  sceneDescription?: string;
  map: MapConfig;
  waves: WaveConfig[];
  startingGold: number;
  availableTowers: TowerType[];
  availableUnits: UnitType[];
  unlockStarsRequired: number;
  unlockPrevLevelId: string | null;
  weatherPool?: WeatherType[];
  weatherFixed?: WeatherType;
  weatherChangeInterval?: number;
}

// ============================================================
// Unit System — Unified Unit Concept
// ============================================================

/** Unit category classification */
export enum UnitCategory {
  Tower = 'tower',           // 防御塔
  Enemy = 'enemy',           // 敌人
  Soldier = 'soldier',       // 士兵（玩家单位）
  Building = 'building',     // 建筑（生产建筑等）
  Trap = 'trap',             // 陷阱
  Decoration = 'decoration', // 场景装饰
  Objective = 'objective',   // 目标点（出生点、大本营等）
  Effect = 'effect',         // 特效单位
}

/**
 * Unit layer - 垂直空间层级
 * 
 * 定义单位在垂直空间中的位置，影响可攻击性、碰撞检测和渲染顺序。
 * 从下到上：深渊层 → 地格下层 → 地格上层 → 地面层 → 低空层 → 太空层
 */
export enum UnitLayer {
  Abyss = 'abyss',           // 深渊层 - 无法抵达的最下层（边界层）
  BelowGrid = 'below_grid',  // 地格下层 - 被封印/隐藏的单位
  AboveGrid = 'above_grid',  // 地格上层 - 地面陷阱（如地刺）
  Ground = 'ground',         // 地面层 - 默认层级（大多数单位）
  LowAir = 'low_air',        // 低空层 - 飞行单位
  Space = 'space',           // 太空层 - 无法抵达的最上层（边界层）
}

/** Layer interaction rules */
export interface LayerInteractionConfig {
  /** 可被哪些层级攻击 */
  canBeAttackedBy: UnitLayer[];
  /** 可以攻击哪些层级 */
  canAttack: UnitLayer[];
  /** 与哪些层级有碰撞 */
  collidesWith: UnitLayer[];
}

/** Unit lifecycle events */
export enum LifecycleEvent {
  Spawn = 'spawn',         // 出生
  Death = 'death',         // 死亡（触发死亡效果）
  Destroy = 'destroy',     // 销毁（不触发死亡效果）
  Upgrade = 'upgrade',     // 升级
  Downgrade = 'downgrade', // 降级
  Attack = 'attack',       // 攻击
  Hit = 'hit',             // 受击
}

/** Unit configuration - defines all properties for a unit type */
export interface UnitTypeConfig {
  id: string;
  name: string;
  category: UnitCategory;
  description?: string;

  // Layer (vertical position)
  layer?: UnitLayer; // Default: UnitLayer.Ground

  // Base attributes
  hp: number;
  atk: number;
  defense: number;
  attackSpeed: number;
  moveSpeed: number;
  moveRange: number;
  attackRange: number;
  alertRange?: number; // detection radius for soldier AI alert behavior (default 0)
  magicResist: number;

  // Visual
  color: string;
  size: number;
  shape: ShapeType;

  // AI behavior
  aiConfig: string; // AI preset ID

  // Lifecycle effects
  lifecycle: LifecycleConfig;

  // Layer interaction rules (optional, uses defaults based on layer if not specified)
  layerInteraction?: LayerInteractionConfig;

  // Special properties (category-specific)
  special?: Record<string, unknown>;

  // Economy
  cost?: number;
  sellValue?: number;
  upgradeCosts?: number[];
}

/** Lifecycle effect configuration */
export interface LifecycleConfig {
  onSpawn?: EffectConfig[];
  onDeath?: EffectConfig[];
  onDestroy?: EffectConfig[];
  onUpgrade?: EffectConfig[];
  onDowngrade?: EffectConfig[];
  onAttack?: EffectConfig[];
  onHit?: EffectConfig[];
}

/** Effect configuration */
export interface EffectConfig {
  type: string;
  params?: Record<string, unknown>;
}

// ============================================================
// AI System — Behavior Tree
// ============================================================

/** Behavior tree node status */
export enum NodeStatus {
  Success = 'success',
  Failure = 'failure',
  Running = 'running',
}

/** Behavior tree node types */
export enum BTNodeType {
  // Composite
  Sequence = 'sequence',
  Selector = 'selector',
  Parallel = 'parallel',

  // Decorator
  Inverter = 'inverter',
  Repeater = 'repeater',
  UntilFail = 'until_fail',
  AlwaysSucceed = 'always_succeed',
  Cooldown = 'cooldown',

  // Condition
  CheckHP = 'check_hp',
  CheckEnemyInRange = 'check_enemy_in_range',
  CheckAllyInRange = 'check_ally_in_range',
  CheckBuff = 'check_buff',
  CheckCooldown = 'check_cooldown',
  CheckPhase = 'check_phase',
  CheckTargetAlive = 'check_target_alive',
  CheckDistanceToTarget = 'check_distance_to_target',
  CheckMoving = 'check_moving',
  CheckStunned = 'check_stunned',
  CheckPlayerControl = 'check_player_control',

  // Action
  Attack = 'attack',
  MoveTo = 'move_to',
  MoveTowards = 'move_towards',
  Flee = 'flee',
  UseSkill = 'use_skill',
  Wait = 'wait',
  Spawn = 'spawn',
  Patrol = 'patrol',
  SetTarget = 'set_target',
  ClearTarget = 'clear_target',
  PlayAnimation = 'play_animation',
}

/** Target selection types */
export enum TargetType {
  Self = 'self',
  NearestEnemy = 'nearest_enemy',
  NearestAlly = 'nearest_ally',
  WeakestEnemy = 'weakest_enemy',
  StrongestEnemy = 'strongest_enemy',
  LowestHPAlly = 'lowest_hp_ally',
  PathWaypoint = 'path_waypoint',
  Home = 'home',
  PlayerTarget = 'player_target',
  AllInRange = 'all_in_range',
}

/** Behavior tree node configuration */
export interface BTNodeConfig {
  type: string;
  name?: string;
  params?: Record<string, unknown>;
  children?: BTNodeConfig[];
}

/** Behavior tree configuration */
export interface BehaviorTreeConfig {
  id: string;
  name: string;
  description?: string;
  version?: string;
  blackboard?: Record<string, unknown>;
  root: BTNodeConfig;
}

/** AI preset configuration */
export interface AIPresetConfig {
  id: string;
  name: string;
  description?: string;
  tree: BehaviorTreeConfig;
}

/** Comparison operators for conditions */
export type ComparisonOperator = '==' | '!=' | '<' | '>' | '<=' | '>=';

/** Comparison expression */
export interface ComparisonExpr {
  op: ComparisonOperator;
  value: number;
}
