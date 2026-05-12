import { TowerWorld, type System } from '../core/World.js';
import { UnitTag } from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import { Sound } from '../utils/Sound.js';

// ============================================================
// P1-#11 — Refund mechanics (design/06-economy-system.md §4)
// ============================================================

/** Per-entity refund metadata tracked side-channel to avoid component bloat. */
export interface RefundMeta {
  /** Game-time seconds when entity was built. */
  buildTime: number;
  /** Game-time of last damage taken (-Infinity = never). */
  lastDamageTime: number;
  /** Game-time of last attack made (-Infinity = never). */
  lastAttackTime: number;
  /** Whether entity has ever taken damage or attacked. */
  everInCombat: boolean;
  /** Refund ratio for this entity (default 0.5; barricade/structure may differ). */
  refundRatio: number;
  /** Total invested gold (build + all upgrades). */
  totalCost: number;
}

const BUILD_COOLDOWN = 3.0;
const COMBAT_GUARD = 2.0;
const MISBUILD_WINDOW = 5.0;
const MISBUILD_REFUND_RATIO = 0.9;
const DEFAULT_REFUND_RATIO = 0.5;
const GOLD_CAP = 999_999;

/** Reason returned alongside refund amount, for UI hints. */
export type RefundReason = 'ok' | 'misbuild' | 'cooldown' | 'combat_damage' | 'combat_attack' | 'unknown';

export interface RefundCalcInput {
  currentTime: number;
  meta: RefundMeta;
  currentHp: number;
  maxHp: number;
}

export interface RefundCalcResult {
  amount: number;
  reason: RefundReason;
}

/**
 * Pure refund formula (design §4.3) — no world access, fully unit-testable.
 *
 *   if (age < 3s) → reject (cooldown)
 *   if (damaged within 2s) → reject (combat damage)
 *   if (attacked within 2s) → reject (combat attack)
 *   if (age < 5s && !everInCombat) → 90% misbuild refund
 *   else → totalCost × refundRatio × (currentHp / maxHp)
 */
export function calculateRefund(input: RefundCalcInput): RefundCalcResult {
  const { currentTime, meta, currentHp, maxHp } = input;
  const age = currentTime - meta.buildTime;

  if (age < BUILD_COOLDOWN) return { amount: 0, reason: 'cooldown' };
  if (currentTime - meta.lastDamageTime < COMBAT_GUARD) return { amount: 0, reason: 'combat_damage' };
  if (currentTime - meta.lastAttackTime < COMBAT_GUARD) return { amount: 0, reason: 'combat_attack' };

  if (age < MISBUILD_WINDOW && !meta.everInCombat) {
    return { amount: Math.floor(meta.totalCost * MISBUILD_REFUND_RATIO), reason: 'misbuild' };
  }

  const hpRatio = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 1;
  return {
    amount: Math.floor(meta.totalCost * meta.refundRatio * hpRatio),
    reason: 'ok',
  };
}

export class EconomySystem implements System {
  readonly name = 'EconomySystem';

  gold: number = 220;
  private pendingGold: number = 0;

  energy: number = 50;
  private pendingEnergy: number = 0;

  population: number = 0;
  maxPopulation: number = 6;

  endlessScore: number = 0;
  isEndless: boolean = false;

  /** Game-time accumulator (seconds since battle start). */
  gameTime: number = 0;

  /** Side-channel refund metadata by entity ID. */
  private refundMeta = new Map<number, RefundMeta>();

  registerBuild(entityId: number, totalCost: number, refundRatio: number = DEFAULT_REFUND_RATIO): void {
    this.refundMeta.set(entityId, {
      buildTime: this.gameTime,
      lastDamageTime: -Infinity,
      lastAttackTime: -Infinity,
      everInCombat: false,
      refundRatio,
      totalCost,
    });
  }

  addUpgradeCost(entityId: number, upgradeCost: number): void {
    const meta = this.refundMeta.get(entityId);
    if (meta) meta.totalCost += upgradeCost;
  }

  notifyDamaged(entityId: number): void {
    const meta = this.refundMeta.get(entityId);
    if (!meta) return;
    meta.lastDamageTime = this.gameTime;
    meta.everInCombat = true;
  }

  notifyAttacked(entityId: number): void {
    const meta = this.refundMeta.get(entityId);
    if (!meta) return;
    meta.lastAttackTime = this.gameTime;
    meta.everInCombat = true;
  }

  getRefundMeta(entityId: number): RefundMeta | undefined {
    return this.refundMeta.get(entityId);
  }

  clearRefundMeta(entityId: number): void {
    this.refundMeta.delete(entityId);
  }

  computeRefund(entityId: number, currentHp: number, maxHp: number): RefundCalcResult {
    const meta = this.refundMeta.get(entityId);
    if (!meta) return { amount: 0, reason: 'unknown' };
    return calculateRefund({ currentTime: this.gameTime, meta, currentHp, maxHp });
  }

  /** Snapshot all refund metadata for persistence (design/13 §1 battleSnapshot). */
  serializeRefundMeta(): Array<[number, RefundMeta]> {
    return Array.from(this.refundMeta.entries());
  }

  /**
   * Overwrite refund metadata from a previously serialized snapshot.
   *
   * JSON cannot represent ±Infinity (becomes null after round-trip). We coerce
   * null/undefined timestamps back to -Infinity to preserve "never happened" semantics
   * critical to combat-guard correctness (a NaN comparison would always be false,
   * silently disabling the refund-abuse guard).
   */
  deserializeRefundMeta(entries: Array<[number, RefundMeta]>): void {
    this.refundMeta.clear();
    for (const [eid, raw] of entries) {
      const meta: RefundMeta = {
        buildTime: typeof raw.buildTime === 'number' ? raw.buildTime : 0,
        lastDamageTime: typeof raw.lastDamageTime === 'number' ? raw.lastDamageTime : -Infinity,
        lastAttackTime: typeof raw.lastAttackTime === 'number' ? raw.lastAttackTime : -Infinity,
        everInCombat: !!raw.everInCombat,
        refundRatio: typeof raw.refundRatio === 'number' ? raw.refundRatio : 0.5,
        totalCost: typeof raw.totalCost === 'number' ? raw.totalCost : 0,
      };
      this.refundMeta.set(eid, meta);
    }
  }

  addEndlessKillScore(enemyGoldReward: number, waveNumber: number): void {
    if (!this.isEndless) return;
    this.endlessScore += enemyGoldReward * waveNumber;
  }

  addGold(amount: number): void {
    this.pendingGold += amount;
  }

  spendGold(amount: number): boolean {
    const total = this.gold + this.pendingGold;
    if (total >= amount) {
      if (this.pendingGold >= amount) {
        this.pendingGold -= amount;
      } else {
        const fromGold = amount - this.pendingGold;
        this.pendingGold = 0;
        this.gold -= fromGold;
      }
      Sound.play('gold_spend');
      return true;
    }
    return false;
  }

  addEnergy(amount: number): void {
    this.pendingEnergy += amount;
  }

  spendEnergy(amount: number): boolean {
    const total = this.energy + this.pendingEnergy;
    if (total >= amount) {
      if (this.pendingEnergy >= amount) {
        this.pendingEnergy -= amount;
      } else {
        const fromEnergy = amount - this.pendingEnergy;
        this.pendingEnergy = 0;
        this.energy -= fromEnergy;
      }
      return true;
    }
    return false;
  }

  canDeployUnit(popCost: number): boolean {
    return this.population + popCost <= this.maxPopulation;
  }

  deployUnit(popCost: number): void {
    this.population += popCost;
  }

  releaseUnit(popCost: number): void {
    this.population = Math.max(0, this.population - popCost);
  }

  rewardForEnemy(enemyId: number): void {
    const goldReward = UnitTag.rewardGold[enemyId];
    if (goldReward !== undefined) {
      this.addGold(goldReward);
    }
  }

  update(_world: TowerWorld, dt: number): void {
    this.gameTime += dt;
    this.gold = Math.min(GOLD_CAP, this.gold + this.pendingGold);
    this.pendingGold = 0;
    this.energy += this.pendingEnergy;
    this.pendingEnergy = 0;
  }
}
