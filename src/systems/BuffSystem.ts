// ============================================================
// Tower Defender — BuffSystem (bitecs migration) v1.1 (P1-#10)
//
// Manages buff/debuff lifecycle with per‑entity side‑channel Map.
// bitecs SoA stores cannot hold Map references, so buff data
// lives in a module‑level Map indexed by entity ID.
//
// Status effects (Slowed, Frozen, Stunned) are synced to bitecs
// components so other systems can query them directly.
//
// v1.1 additions (design/04-skill-buff-system.md §3.2.1-§3.2.3):
// - Per-entity buff cap: MAX_BUFFS_PER_ENTITY = 8
// - LRU eviction by priority (lower priority evicted first; tie → oldest)
// - Player-faction buffs receive +100 priority bonus (protected from LRU)
// - Source-death cleanup via removeOnSourceDeath flag
// ============================================================

import { TowerWorld, type System, hasComponent, entityExists } from '../core/World.js';
import { Slowed, Frozen, Stunned, Faction, FactionVal, defineQuery } from '../core/components.js';
import { error, warn, debug, getFrame } from '../utils/debugLog.js';

// ============================================================
// Buff Data Types
// ============================================================

/**
 * Buff category — drives priority resolution (design §3.2.2).
 * Lower numeric value = higher priority (stun overrides everything).
 */
export const BuffPriority = {
  Stun: 1,
  Taunt: 2,
  Slow: 3,
  Dot: 4,
  Buff: 5,
  Mark: 6,
} as const;

export const MAX_BUFFS_PER_ENTITY = 8;
export const PLAYER_BUFF_PRIORITY_BONUS = 100;

export interface BuffData {
  /** Buff identifier, e.g. 'ice_slow', 'ice_frozen', 'taunt' */
  id: string;
  /** Affected attribute, e.g. 'speed', 'atk', 'range', 'attack_speed' */
  attribute: string;
  /** Effect magnitude per stack */
  value: number;
  /** Whether value is a percentage modifier */
  isPercent: boolean;
  /** Remaining duration in seconds */
  duration: number;
  /** Current stack count */
  stacks: number;
  /** Maximum stacks this buff can accumulate */
  maxStacks: number;
  /** Entity that applied this buff (source) */
  sourceId: number;
  /** Priority for LRU eviction; lower = more important (default Buff=5) */
  priority?: number;
  /** Auto-remove this buff when sourceId entity dies (default false) */
  removeOnSourceDeath?: boolean;
  /** Internal: monotonic timestamp set on apply, used for LRU tie-break */
  appliedAt?: number;
}

// ============================================================
// Side-channel buff storage
// ============================================================

const buffMap = new Map<number, Map<string, BuffData>>();

let buffApplyCounter = 0;

// ============================================================
// Queries for status-effect bitecs components
// ============================================================

const frozenQuery = defineQuery([Frozen]);
const stunnedQuery = defineQuery([Stunned]);

// ============================================================
// BuffSystem
// ============================================================

export class BuffSystem implements System {
  readonly name = 'BuffSystem';

  update(world: TowerWorld, dt: number): void {
    const w = world.world;
    const frame = getFrame();

    // ---- 1. Tick buff durations from side-channel Map ----
    for (const [eid, buffs] of buffMap) {
      // Entity may have been destroyed — clean up silently
      if (!entityExists(w, eid)) {
        debug('BuffSystem', `[F${frame}] eid=${eid} stale in buffMap → cleanup (entity gone)`, {
          buffCount: buffs.size,
        });
        buffMap.delete(eid);
        continue;
      }

      const expired: string[] = [];

      for (const [buffId, buff] of buffs) {
        if (buff.duration > 0) {
          buff.duration -= dt;
        }
        if (buff.duration <= 0 && buff.duration !== -1) {
          expired.push(buffId);
          continue;
        }
        if (buff.removeOnSourceDeath && !entityExists(w, buff.sourceId)) {
          expired.push(buffId);
        }
      }

      for (const buffId of expired) {
        debug('BuffSystem', `[F${frame}] eid=${eid} buff "${buffId}" expired/source-dead`, {
          remaining: buffs.size - 1,
        });
        buffs.delete(buffId);
      }

      // ---- Check freeze trigger: slow stacks reaching max ----
      this.checkFreeze(world, eid, buffs);

      // ---- Sync Slowed bitecs component from side-channel ----
      this.syncSlowed(world, eid, buffs);

      // ---- Clean up entity entry when no buffs remain ----
      if (buffs.size === 0) {
        debug('BuffSystem', `[F${frame}] eid=${eid} all buffs cleared → removing from map`);
        buffMap.delete(eid);
      }
    }

    // ---- 2. Tick Frozen component timers ----
    const frozenEntities = frozenQuery(w);
    for (const eid of frozenEntities) {
      // Defensive: verify entity still exists before accessing
      if (!entityExists(w, eid)) {
        warn('BuffSystem', `[F${frame}] eid=${eid} in frozenQuery but entity does not exist — skipping`);
        continue;
      }
      Frozen.timer[eid]! -= dt;
      if (Frozen.timer[eid]! <= 0) {
        debug('BuffSystem', `[F${frame}] eid=${eid} Frozen expired → removing component`);
        try {
          world.removeComponent(eid, Frozen);
        } catch (e) {
          error('BuffSystem', `[F${frame}] Failed to remove Frozen from eid=${eid}`, {
            error: String(e),
            entityExists: entityExists(w, eid),
          });
          throw e;
        }
      }
    }

    // ---- 3. Tick Stunned component timers ----
    const stunnedEntities = stunnedQuery(w);
    for (const eid of stunnedEntities) {
      if (!entityExists(w, eid)) {
        warn('BuffSystem', `[F${frame}] eid=${eid} in stunnedQuery but entity does not exist — skipping`);
        continue;
      }
      Stunned.timer[eid]! -= dt;
      if (Stunned.timer[eid]! <= 0) {
        debug('BuffSystem', `[F${frame}] eid=${eid} Stunned expired → removing component`);
        try {
          world.removeComponent(eid, Stunned);
        } catch (e) {
          error('BuffSystem', `[F${frame}] Failed to remove Stunned from eid=${eid}`, {
            error: String(e),
            entityExists: entityExists(w, eid),
          });
          throw e;
        }
      }
    }
  }

  // ---- Private helpers ----

  private checkFreeze(world: TowerWorld, eid: number, buffs: Map<string, BuffData>): void {
    const frame = getFrame();
    for (const [buffId, buff] of buffs) {
      if (buff.stacks >= buff.maxStacks && buff.isPercent && buff.attribute === 'speed') {
        buffs.delete(buffId);
        try {
          world.addComponent(eid, Frozen, { timer: 1.0 });
          debug('BuffSystem', `[F${frame}] eid=${eid} FROZEN triggered (stacks=${buff.stacks}/${buff.maxStacks})`);
        } catch (e) {
          error('BuffSystem', `[F${frame}] checkFreeze: Failed to add Frozen to eid=${eid}`, {
            error: String(e),
            entityExists: entityExists(world.world, eid),
          });
          throw e;
        }
        break;
      }
    }
  }

  private syncSlowed(world: TowerWorld, eid: number, buffs: Map<string, BuffData>): void {
    const w = world.world;
    const frame = getFrame();

    // Find the active slow-type buff (percent speed reduction)
    let slowBuff: BuffData | undefined;
    for (const buff of buffs.values()) {
      if (buff.attribute === 'speed' && buff.isPercent && buff.value < 0) {
        slowBuff = buff;
        break;
      }
    }

    if (slowBuff) {
      try {
        world.addComponent(eid, Slowed, {
          percent: Math.abs(slowBuff.value),
          timer: slowBuff.duration,
          stacks: slowBuff.stacks,
          maxStacks: slowBuff.maxStacks,
        });
      } catch (e) {
        error('BuffSystem', `[F${frame}] syncSlowed: Failed to add Slowed to eid=${eid}`, {
          error: String(e),
          entityExists: entityExists(w, eid),
          slowBuff: { id: slowBuff.id, value: slowBuff.value, stacks: slowBuff.stacks },
        });
        throw e;
      }
    } else {
      if (hasComponent(w, Slowed, eid)) {
        try {
          world.removeComponent(eid, Slowed);
          debug('BuffSystem', `[F${frame}] eid=${eid} Slowed removed (no slow buff active)`);
        } catch (e) {
          error('BuffSystem', `[F${frame}] syncSlowed: Failed to remove Slowed from eid=${eid}`, {
            error: String(e),
            entityExists: entityExists(w, eid),
            hasComponent: true,
          });
          throw e;
        }
      }
    }
  }

  // ---- Public API ----

  /**
   * Get the aggregated buff effect of a specific attribute on an entity.
   * Reads from the side-channel Map.
   */
  getEffectiveValue(entityId: number, attribute: string): { absolute: number; percent: number } {
    const entityBuffs = buffMap.get(entityId);
    if (!entityBuffs) return { absolute: 0, percent: 0 };

    let absolute = 0;
    let percent = 0;

    for (const buff of entityBuffs.values()) {
      if (buff.attribute === attribute) {
        const stackValue = buff.value * buff.stacks;
        if (buff.isPercent) {
          percent += stackValue;
        } else {
          absolute += stackValue;
        }
      }
    }

    return { absolute, percent };
  }
}

// ============================================================
// Public helpers — called by other systems to apply buffs
// ============================================================

/**
 * Apply or update a buff on an entity (P1-#10 v1.1).
 *
 * If a buff with the same id already exists on the entity,
 * its duration is refreshed and stacks are incremented (up to maxStacks).
 * Otherwise a new buff entry is created.
 *
 * Capacity enforcement (design §3.2.1):
 * - Entities may hold at most MAX_BUFFS_PER_ENTITY (8) distinct buffs.
 * - When full, the new buff evicts the existing buff with the highest
 *   numeric priority (= least important). Tie-break: oldest appliedAt.
 * - Player-faction-applied buffs receive +PLAYER_BUFF_PRIORITY_BONUS,
 *   making them effectively un-evictable by enemy buffs.
 * - If the incoming buff would itself be the eviction target (i.e. its
 *   effective priority is the highest), it is rejected silently.
 */
export function addBuff(world: TowerWorld, eid: number, data: BuffData): void {
  let entityBuffs = buffMap.get(eid);
  if (!entityBuffs) {
    entityBuffs = new Map<string, BuffData>();
    buffMap.set(eid, entityBuffs);
  }

  const existing = entityBuffs.get(data.id);
  if (existing) {
    existing.duration = data.duration;
    if (existing.stacks < existing.maxStacks) {
      existing.stacks++;
    }
    return;
  }

  const incoming: BuffData = {
    ...data,
    priority: effectivePriority(world, data),
    appliedAt: ++buffApplyCounter,
  };

  if (entityBuffs.size >= MAX_BUFFS_PER_ENTITY) {
    const victimId = pickLruVictim(entityBuffs, incoming.priority!);
    if (victimId === null) {
      debug('BuffSystem', `addBuff: eid=${eid} cap full, incoming "${data.id}" rejected (lowest priority)`);
      return;
    }
    debug('BuffSystem', `addBuff: eid=${eid} LRU evict "${victimId}" for "${data.id}"`);
    entityBuffs.delete(victimId);
  }

  entityBuffs.set(data.id, incoming);
}

/**
 * Manually remove a buff by id. Returns true if removed.
 */
export function removeBuff(eid: number, buffId: string): boolean {
  const entityBuffs = buffMap.get(eid);
  if (!entityBuffs) return false;
  const ok = entityBuffs.delete(buffId);
  if (ok && entityBuffs.size === 0) buffMap.delete(eid);
  return ok;
}

/**
 * Read-only buff list for testing/UI. Returns a shallow copy.
 */
export function getBuffs(eid: number): BuffData[] {
  const entityBuffs = buffMap.get(eid);
  if (!entityBuffs) return [];
  return [...entityBuffs.values()];
}

/**
 * Clear all buff state. Test-only helper.
 */
export function clearAllBuffs(): void {
  buffMap.clear();
  buffApplyCounter = 0;
}

function effectivePriority(world: TowerWorld, data: BuffData): number {
  const base = data.priority ?? BuffPriority.Buff;
  if (entityExists(world.world, data.sourceId) && hasComponent(world.world, Faction, data.sourceId)) {
    if (Faction.value[data.sourceId] === FactionVal.Player) {
      return base - PLAYER_BUFF_PRIORITY_BONUS;
    }
  }
  return base;
}

function pickLruVictim(buffs: Map<string, BuffData>, incomingPriority: number): string | null {
  let victimId: string | null = null;
  let victimPriority = -Infinity;
  let victimAppliedAt = Infinity;

  for (const [id, b] of buffs) {
    const p = b.priority ?? BuffPriority.Buff;
    const t = b.appliedAt ?? 0;
    if (p > victimPriority || (p === victimPriority && t < victimAppliedAt)) {
      victimPriority = p;
      victimAppliedAt = t;
      victimId = id;
    }
  }

  if (victimId === null) return null;
  if (incomingPriority >= victimPriority) return null;
  return victimId;
}
