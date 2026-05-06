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

export interface MapConfig {
  name: string;
  cols: number;
  rows: number;
  tileSize: number;
  tiles: TileType[][];
  enemyPath: GridPos[]; // ordered waypoints enemies follow
}

export interface GridPos {
  row: number;
  col: number;
}

// ---- Building / Tower ----

export enum TowerType {
  Arrow = 'arrow',
  // Future: Cannon, Ice, Lightning, Poison, Light
}

export interface TowerConfig {
  type: TowerType;
  name: string;
  cost: number;
  hp: number;
  atk: number;
  attackSpeed: number; // attacks per second
  range: number; // pixels
  upgradeCosts: number[]; // cost to each level [L2, L3, L4, L5]
  upgradeAtkBonus: number[]; // atk increase per level
  upgradeRangeBonus: number[]; // range increase per level
  color: string; // geometric shape fill color
}

// ---- Enemy ----

export enum EnemyType {
  Grunt = 'grunt',
  // Future: Runner, Heavy, Mage, Exploder
}

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number; // pixels per second
  atk: number; // damage to base if reaches end
  defense: number;
  rewardGold: number;
  color: string;
  radius: number;
}

// ---- Wave ----

export interface WaveEnemyGroup {
  enemyType: EnemyType;
  count: number;
  spawnInterval: number; // seconds between spawns
}

export interface WaveConfig {
  waveNumber: number;
  enemies: WaveEnemyGroup[];
  spawnDelay: number; // seconds before wave starts
}

// ---- Economy ----

export interface PlayerResources {
  gold: number;
  lives: number;
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

export type ShapeType = 'rect' | 'circle' | 'triangle' | 'diamond' | 'hexagon';

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
} as const;

export type ComponentType = (typeof CType)[keyof typeof CType];
