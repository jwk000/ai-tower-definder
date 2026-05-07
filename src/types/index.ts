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

export interface MapConfig {
  name: string;
  cols: number;
  rows: number;
  tileSize: number;
  tiles: TileType[][];
  enemyPath: GridPos[];
  tileColors?: Partial<Record<TileType, string>>;
  altSpawnPoints?: GridPos[];
  neutralUnits?: Array<{
    type: 'trap' | 'spring' | 'chest';
    row: number; col: number;
    config?: Record<string, number>;
  }>;
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
  specialOnDeath?: 'explode';
  deathDamage?: number;
  deathRadius?: number;
  isBoss?: boolean;
  bossPhase2HpRatio?: number;
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
}

// ---- Projectile ----

export interface ProjectileConfig {
  speed: number;       // pixels per second
  damage: number;
  shape: ShapeType;
  color: string;
  size: number;
}

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
  map: MapConfig;
  waves: WaveConfig[];
  startingGold: number;
  availableTowers: TowerType[];
  availableUnits: UnitType[];
  unlockStarsRequired: number;
  unlockPrevLevelId: string | null;
}
