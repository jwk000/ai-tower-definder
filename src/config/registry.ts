// ============================================================
// Tower Defender — Config Registry
// ============================================================
// Stores unit configs loaded from YAML and provides lookup by ID,
// category, faction, etc. Singleton instance exported.
// ============================================================

// ---- Unit Category & Classifications ----

/** Unit category classification */
export type UnitCategory = 'Tower' | 'Soldier' | 'Enemy' | 'Building' | 'Trap' | 'Neutral' | 'Objective';

/** Faction / team allegiance */
export type Faction = 'Player' | 'Enemy' | 'Neutral';

/** Spatial layer for collision and targeting */
export type UnitLayer = 'Ground' | 'LowAir' | 'AboveGrid' | 'BelowGrid';

// ---- Unit Config Sub-types ----

/** Core combat and survival stats */
export interface UnitStats {
  hp: number;
  atk: number;
  attackSpeed?: number;
  range?: number;
  speed?: number;
  armor?: number;
  mr?: number; // magic resist
}

/** Economy: construction and upgrade costs */
export interface UnitCost {
  build?: number;
  upgrade?: number[];
  pop?: number;
}

/** Economy: rewards on kill/destroy */
export interface UnitReward {
  gold?: number;
  energy?: number;
}

/** Visual identity */
export interface UnitVisual {
  shape: string;
  color: string;
  size: number;
}

/** Runtime behavior rules */
export interface UnitBehavior {
  targetSelection: string;
  attackMode: string;
  movementMode: string;
  special?: Record<string, unknown>;
}

/** A single lifecycle rule entry (e.g. onDeath explosion) */
export interface LifecycleRule {
  type: string;
  [key: string]: unknown;
}

/** Lifecycle event handlers */
export interface UnitLifecycle {
  onCreate?: LifecycleRule[];
  onDeath?: LifecycleRule[];
  onHit?: LifecycleRule[];
  onAttack?: LifecycleRule[];
  onKill?: LifecycleRule[];
  onUpgrade?: LifecycleRule[];
  onDestroy?: LifecycleRule[];
}

// ---- Main Unit Config ----

/** Unified unit configuration — matches the YAML design doc structure */
export interface UnitConfig {
  id: string;
  name: string;
  category: UnitCategory;
  faction: Faction;
  layer: UnitLayer;
  stats: UnitStats;
  cost?: UnitCost;
  reward?: UnitReward;
  visual: UnitVisual;
  behavior: UnitBehavior;
  lifecycle?: UnitLifecycle;
  /** Additional category-specific fields (Boss tier, description, etc.) */
  [extras: string]: unknown;
}

// ---- Registry ----

/** Stores unit configs and provides indexed lookups */
export class UnitConfigRegistry {
  private readonly configs = new Map<string, UnitConfig>();

  /** Register a unit config (overwrites if id already exists) */
  register(config: UnitConfig): void {
    this.configs.set(config.id, config);
  }

  /** Look up a single unit config by ID */
  get(id: string): UnitConfig | undefined {
    return this.configs.get(id);
  }

  /** Return all registered unit configs */
  getAll(): UnitConfig[] {
    return [...this.configs.values()];
  }

  /** Filter by category string */
  getByCategory(category: string): UnitConfig[] {
    return [...this.configs.values()].filter((c) => c.category === category);
  }

  /** Filter by faction string */
  getByFaction(faction: string): UnitConfig[] {
    return [...this.configs.values()].filter((c) => c.faction === faction);
  }
}

/** Global singleton — populated by loader.ts */
export const unitConfigRegistry = new UnitConfigRegistry();
