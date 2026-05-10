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

    // ---- 1. Tick buff durations from side-channel Map ----
    for (const [eid, buffs] of buffMap) {
      // Entity may have been destroyed by HealthSystem — clean up silently
      if (!entityExists(w, eid)) {
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
        buffs.delete(buffId);
      }

      // ---- Check freeze trigger: slow stacks reaching max ----
      this.checkFreeze(world, eid, buffs);

      // ---- Sync Slowed bitecs component from side-channel ----
      this.syncSlowed(world, eid, buffs);

      // ---- Clean up entity entry when no buffs remain ----
      if (buffs.size === 0) {
        buffMap.delete(eid);
      }
    }

    // ---- 2. Tick Frozen component timers ----
    for (const eid of frozenQuery(w)) {
      Frozen.timer[eid]! -= dt;
      if (Frozen.timer[eid]! <= 0) {
        world.removeComponent(eid, Frozen);
      }
    }

    // ---- 3. Tick Stunned component timers ----
    for (const eid of stunnedQuery(w)) {
      Stunned.timer[eid]! -= dt;
      if (Stunned.timer[eid]! <= 0) {
        world.removeComponent(eid, Stunned);
      }
    }
  }

  // ---- Private helpers ----

  private checkFreeze(world: TowerWorld, eid: number, buffs: Map<string, BuffData>): void {
    for (const [buffId, buff] of buffs) {
      if (buff.stacks >= buff.maxStacks && buff.isPercent && buff.attribute === 'speed') {
        buffs.delete(buffId);
        world.addComponent(eid, Frozen, { timer: 1.0 });
        break;
      }
    }
  }

  private syncSlowed(world: TowerWorld, eid: number, buffs: Map<string, BuffData>): void {
    // Find the active slow-type buff (percent speed reduction)
    let slowBuff: BuffData | undefined;
    for (const buff of buffs.values()) {
      if (buff.attribute === 'speed' && buff.isPercent && buff.value < 0) {
        slowBuff = buff;
        break;
      }
    }

    if (slowBuff) {
      world.addComponent(eid, Slowed, {
        percent: Math.abs(slowBuff.value),
        timer: slowBuff.duration,
        stacks: slowBuff.stacks,
        maxStacks: slowBuff.maxStacks,
      });
    } else {
      if (hasComponent(world.world, eid, Slowed)) {
        world.removeComponent(eid, Slowed);
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
