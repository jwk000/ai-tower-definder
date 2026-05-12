import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Position, Health, Movement, UnitTag, AI, Visual } from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import { EnemyType } from '../types/index.js';
import { addBuff } from './BuffSystem.js';

/** AI config ID for Shaman enemies（与 ALL_AI_CONFIGS 注册顺序一致：enemy_shaman = 17） */
const SHAMAN_AI_ID = 17;

/** Shaman entities: have Position, AI (to check configId), and UnitTag (isEnemy check) */
const shamanQuery = defineQuery([Position, AI, UnitTag, Health]);

/** All enemy entities (potential heal/aura targets) */
const enemyQuery = defineQuery([Position, Health, Movement, UnitTag]);

/** Duration of the green heal flash (seconds) */
const HEAL_FLASH_DURATION = 0.3;
/** Frequency multiplier for the heal flash alpha pulse */
const HEAL_FLASH_FREQ = 20;

/**
 * ShamanSystem — Shaman enemies heal nearby allies and provide aura speed buffs.
 *
 * - Every `healInterval` seconds, each Shaman heals the lowest-HP enemy
 *   within `healRadius` (excluding itself).
 * - Boss enemies receive half healing.
 * - Enemies within `auraRadius` receive a speed bonus.
 * - Healed enemies flash green (alpha pulse on Visual).
 */
export class ShamanSystem implements System {
  readonly name = 'ShamanSystem';

  /** Per-shaman healing cooldown remaining (eid → seconds) */
  private healCooldowns: Map<number, number> = new Map();

  /** Heal flash timers (eid → seconds remaining) */
  private healFlashTimers: Map<number, number> = new Map();

  update(world: TowerWorld, dt: number): void {
    const w = world.world;

    const shamanCfg = ENEMY_CONFIGS[EnemyType.Shaman];
    const healAmount = shamanCfg.healAmount ?? 25;
    const healInterval = shamanCfg.healInterval ?? 4;
    const healRadius = shamanCfg.healRadius ?? 150;
    const auraSpeedBonus = shamanCfg.auraSpeedBonus ?? 15;
    const auraRadius = shamanCfg.auraRadius ?? 120;

    const shamans = shamanQuery(w);
    const enemies = enemyQuery(w);

    // Filter to alive Shaman enemies only
    const aliveShamans: number[] = [];
    for (let i = 0; i < shamans.length; i++) {
      const sid = shamans[i]!;
      if (AI.configId[sid] !== SHAMAN_AI_ID) continue;
      if (UnitTag.isEnemy[sid] !== 1) continue;
      if (Health.current[sid]! <= 0) continue;
      aliveShamans.push(sid);
    }

    // Filter to alive enemy targets
    const aliveEnemies: number[] = [];
    for (let i = 0; i < enemies.length; i++) {
      const eid = enemies[i]!;
      if (UnitTag.isEnemy[eid] !== 1) continue;
      if (Health.current[eid]! <= 0) continue;
      aliveEnemies.push(eid);
    }

    // Build the set of enemies currently in any Shaman's aura range
    const currentAuraSet = new Set<number>();

    for (let si = 0; si < aliveShamans.length; si++) {
      const shamanId = aliveShamans[si]!;
      const sx = Position.x[shamanId]!;
      const sy = Position.y[shamanId]!;

      // ---- Aura: collect enemies within aura radius ----
      for (let ei = 0; ei < aliveEnemies.length; ei++) {
        const enemyId = aliveEnemies[ei]!;
        const ex = Position.x[enemyId]!;
        const ey = Position.y[enemyId]!;
        const dx = ex - sx;
        const dy = ey - sy;
        if (dx * dx + dy * dy <= auraRadius * auraRadius) {
          currentAuraSet.add(enemyId);
        }
      }

      // ---- Healing: tick cooldown and heal when ready ----
      let cooldown = this.healCooldowns.get(shamanId) ?? 0;
      cooldown -= dt;

      if (cooldown <= 0) {
        // Find the lowest-HP enemy within healRadius (not the shaman itself)
        let bestTarget: number | null = null;
        let bestHp = Infinity;

        for (let ei = 0; ei < aliveEnemies.length; ei++) {
          const enemyId = aliveEnemies[ei]!;
          if (enemyId === shamanId) continue;

          const ex = Position.x[enemyId]!;
          const ey = Position.y[enemyId]!;
          const dx = ex - sx;
          const dy = ey - sy;
          if (dx * dx + dy * dy > healRadius * healRadius) continue;

          const hp = Health.current[enemyId]!;
          if (hp < bestHp) {
            bestHp = hp;
            bestTarget = enemyId;
          }
        }

        if (bestTarget !== null) {
          // Bosses receive reduced healing
          let actualHeal = healAmount;
          if (UnitTag.isBoss[bestTarget] === 1) {
            actualHeal = Math.floor(healAmount / 2);
          }

          Health.current[bestTarget] = Math.min(
            Health.max[bestTarget]!,
            Health.current[bestTarget]! + actualHeal,
          );

          // Trigger green flash on the healed enemy
          this.healFlashTimers.set(bestTarget, HEAL_FLASH_DURATION);
        }

        cooldown = healInterval;
      }

      this.healCooldowns.set(shamanId, cooldown);
    }

    // ---- Clean up dead shamans from cooldown map ----
    const aliveShamanSet = new Set(aliveShamans);
    for (const [sid] of this.healCooldowns) {
      if (!aliveShamanSet.has(sid)) {
        this.healCooldowns.delete(sid);
      }
    }

    // 每帧 refresh：停止 refresh 即自然衰减消失。
    // duration=0.5s 留 dt 抖动 buffer（详见 design/22-buff-system.md）。
    for (const eid of currentAuraSet) {
      addBuff(world, eid, {
        id: 'shaman_aura',
        sourceId: -1,
        attribute: 'speed',
        value: auraSpeedBonus,
        isPercent: false,
        duration: 0.5,
        stacks: 1,
        maxStacks: 1,
        appliedAt: 0,
      });
    }

    // ---- Update heal flash timers (alpha pulse) ----
    for (const [eid, timer] of this.healFlashTimers) {
      const remaining = timer - dt;
      if (remaining <= 0) {
        Visual.alpha[eid] = 1;
        this.healFlashTimers.delete(eid);
      } else {
        // Pulsing alpha: oscillates between ~0.4 and 1.0 for a greenish dim-bright flash
        const pulse = Math.sin(remaining * HEAL_FLASH_FREQ);
        Visual.alpha[eid] = 0.4 + 0.6 * Math.abs(pulse);
        this.healFlashTimers.set(eid, remaining);
      }
    }
  }
}
