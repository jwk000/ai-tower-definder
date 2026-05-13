import { TowerWorld, type System, defineQuery, hasComponent } from '../core/World.js';
import { Position, Attack, Tower, Health, BuildingTower } from '../core/components.js';
import { TowerType } from '../types/index.js';
import { TOWER_CONFIGS } from '../data/gameData.js';

// ---- Aura Stats Per Level ----
// The command tower config in TOWER_CONFIGS defines L1 base values.
// For L2+, aura values are hardcoded here since the upgradeAtkBonus/upgradeRangeBonus
// arrays in the config are not used for standard attack upgrades (command tower has no attack).

const AURA_STATS: Record<number, {
  radius: number;
  atkSpeedBonus: number;
  rangeBonus: number;
  atkBonus: number;
}> = {
  1: { radius: 120, atkSpeedBonus: 10, rangeBonus: 0, atkBonus: 0 },
  2: { radius: 150, atkSpeedBonus: 10, rangeBonus: 10, atkBonus: 0 },
  3: { radius: 180, atkSpeedBonus: 15, rangeBonus: 10, atkBonus: 10 },
  4: { radius: 210, atkSpeedBonus: 15, rangeBonus: 15, atkBonus: 10 },
  5: { radius: 250, atkSpeedBonus: 20, rangeBonus: 15, atkBonus: 15 },
};

/** TowerType.Command → bitecs towerType value (ui8) */
const COMMAND_TOWER_TYPE = 8;

/** All towers (for finding command towers) */
const towerQuery = defineQuery([Position, Tower]);

/** Towers that can receive aura buffs (must have Attack capability) */
const buffableQuery = defineQuery([Position, Tower, Attack, Health]);

/** Record of original stats saved before aura buff was applied */
interface BuffRecord {
  originalDamage: number;
  originalAttackSpeed: number;
  originalRange: number;
}

/**
 * CommandTowerSystem — 号令塔光环系统
 *
 * Command towers (TowerType.Command) do NOT attack. Instead, they provide
 * aura buffs to nearby friendly towers within auraRadius:
 *   - atkSpeed bonus: +10% at L1, scaling with level
 *   - range bonus: +0 at L1, scaling with level
 *   - atk bonus: +0 at L1, scaling with level
 *
 * Multiple command tower auras do NOT stack — the highest-level commanding
 * tower takes priority. Aura is recomputed each frame.
 *
 * Pattern follows ShamanSystem: track original values with a Map,
 * restore when target leaves aura range.
 */
export class CommandTowerSystem implements System {
  readonly name = 'CommandTowerSystem';

  /** Per-target buff record (eid → original stats before aura) */
  private auraTargets: Map<number, BuffRecord> = new Map();

  update(world: TowerWorld, _dt: number): void {
    const w = world.world;

    // ---- Step 1: Find all alive command towers ----
    const allTowers = towerQuery(w);
    const commandTowers: { eid: number; x: number; y: number; level: number }[] = [];

    for (let i = 0; i < allTowers.length; i++) {
      const eid = allTowers[i]!;
      if (Tower.towerType[eid] !== COMMAND_TOWER_TYPE) continue;
      if (hasComponent(w, BuildingTower, eid)) continue;

      const hp = Health.current[eid];
      if (hp !== undefined && hp <= 0) continue;

      const x = Position.x[eid];
      const y = Position.y[eid];
      const level = Tower.level[eid];
      if (x === undefined || y === undefined || level === undefined) continue;

      commandTowers.push({ eid, x, y, level });
    }

    // ---- Step 2: Find all buffable towers (alive, non-command, with Attack) ----
    const buffTargets = buffableQuery(w);
    const buffableTowers: number[] = [];

    for (let i = 0; i < buffTargets.length; i++) {
      const eid = buffTargets[i]!;
      if (Tower.towerType[eid] === COMMAND_TOWER_TYPE) continue;
      if (hasComponent(w, BuildingTower, eid)) continue;

      const hp = Health.current[eid];
      if (hp !== undefined && hp <= 0) continue;

      buffableTowers.push(eid);
    }

    // ---- Step 3: Restore all previously buffed towers to original stats ----
    for (const [eid, record] of this.auraTargets) {
      if (Attack.damage[eid] !== undefined) {
        Attack.damage[eid] = record.originalDamage;
      }
      if (Attack.attackSpeed[eid] !== undefined) {
        Attack.attackSpeed[eid] = record.originalAttackSpeed;
      }
      if (Attack.range[eid] !== undefined) {
        Attack.range[eid] = record.originalRange;
      }
    }
    this.auraTargets.clear();

    // ---- Step 4: No command towers → nothing to do ----
    if (commandTowers.length === 0) return;

    // ---- Step 5: Recompute aura buffs for each valid target ----
    for (let ti = 0; ti < buffableTowers.length; ti++) {
      const targetEid = buffableTowers[ti]!;
      const tx = Position.x[targetEid];
      const ty = Position.y[targetEid];
      if (tx === undefined || ty === undefined) continue;

      // Find the highest-level command tower within aura range (non-stacking)
      let bestLevel = 0;
      for (let ci = 0; ci < commandTowers.length; ci++) {
        const ct = commandTowers[ci]!;
        const auraCfg = AURA_STATS[ct.level];
        if (!auraCfg) continue;

        const dx = tx - ct.x;
        const dy = ty - ct.y;
        if (dx * dx + dy * dy <= auraCfg.radius * auraCfg.radius) {
          if (ct.level > bestLevel) {
            bestLevel = ct.level;
          }
        }
      }

      // No command tower in range — skip
      if (bestLevel === 0) continue;

      const auraCfg = AURA_STATS[bestLevel]!;
      const baseDamage = Attack.damage[targetEid];
      const baseAttackSpeed = Attack.attackSpeed[targetEid];
      const baseRange = Attack.range[targetEid];

      if (baseDamage === undefined || baseAttackSpeed === undefined || baseRange === undefined) continue;

      // Save original values before applying buff
      const record: BuffRecord = {
        originalDamage: baseDamage,
        originalAttackSpeed: baseAttackSpeed,
        originalRange: baseRange,
      };

      // Apply aura buffs
      Attack.damage[targetEid] = baseDamage * (1 + auraCfg.atkBonus / 100);
      Attack.attackSpeed[targetEid] = baseAttackSpeed * (1 + auraCfg.atkSpeedBonus / 100);
      Attack.range[targetEid] = baseRange + auraCfg.rangeBonus;

      this.auraTargets.set(targetEid, record);
    }
  }
}
