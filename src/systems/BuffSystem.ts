// ============================================================
// Tower Defender — BuffSystem (bitecs migration)
//
// Manages buff/debuff lifecycle with per‑entity side‑channel Map.
// bitecs SoA stores cannot hold Map references, so buff data
// lives in a module‑level Map indexed by entity ID.
//
// Status effects (Slowed, Frozen, Stunned) are synced to bitecs
// components so other systems can query them directly.
// ============================================================

import { TowerWorld, type System, hasComponent, entityExists } from '../core/World.js';
import { Slowed, Frozen, Stunned, defineQuery } from '../core/components.js';
import { error, warn, debug, getFrame } from '../utils/debugLog.js';

// ============================================================
// Buff Data Types
// ============================================================

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
}

// ============================================================
// Side-channel buff storage
// ============================================================

const buffMap = new Map<number, Map<string, BuffData>>();

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
        buff.duration -= dt;
        if (buff.duration <= 0) {
          expired.push(buffId);
        }
      }

      for (const buffId of expired) {
        debug('BuffSystem', `[F${frame}] eid=${eid} buff "${buffId}" expired`, {
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
 * Apply or update a buff on an entity.
 *
 * If a buff with the same id already exists on the entity,
 * its duration is refreshed and stacks are incremented (up to maxStacks).
 * Otherwise a new buff entry is created.
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
  } else {
    entityBuffs.set(data.id, { ...data });
  }
}
