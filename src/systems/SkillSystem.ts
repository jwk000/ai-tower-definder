import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Skill, Position, Health, UnitTag, Taunted, enemyQuery, DamageTypeVal } from '../core/components.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { SKILL_CONFIGS } from '../data/gameData.js';
import { SkillTrigger } from '../types/index.js';
import type { SkillConfig } from '../types/index.js';
import { Sound } from '../utils/Sound.js';

// --- Skill ID Mapping (string key → bitecs ui8 value) ---

const SkillIdNum: Record<string, number> = {
  taunt: 0,
  whirlwind: 1,
};

/** Reverse lookup: ui8 → string skill key */
const SKILL_ID_MAP: string[] = ['taunt', 'whirlwind'];

// ============================================================
// SkillSystem — 玩家技能执行（嘲讽、旋风斩）
// ============================================================

export class SkillSystem implements System {
  readonly name = 'SkillSystem';

  private skillQuery = defineQuery([Skill]);

  constructor(private spendEnergy: (amount: number) => boolean) {}

  // ---- Update (per-frame) ----

  update(world: TowerWorld, dt: number): void {
    const entities = this.skillQuery(world.world);
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i]!;

      // Tick cooldown
      Skill.currentCooldown[eid] = Math.max(0, Skill.currentCooldown[eid]! - dt);

      // Apply passive skills
      const sid = Skill.skillId[eid]!;
      const key = SKILL_ID_MAP[sid];
      if (key !== undefined) {
        const config = SKILL_CONFIGS[key];
        if (config && config.trigger === SkillTrigger.Passive) {
          this.applyPassive(world, eid, config);
        }
      }
    }
  }

  // ---- Public API ----

  /** Try to activate a skill. Returns true if skill was used (cooldown reset, energy spent). */
  useSkill(entityId: number, skillId: string): boolean {
    const skillIdNum = SkillIdNum[skillId];
    if (skillIdNum === undefined) return false;
    if (Skill.skillId[entityId] !== skillIdNum) return false;
    if (Skill.currentCooldown[entityId]! > 0) return false;

    const config = SKILL_CONFIGS[skillId];
    if (!config) return false;
    if (config.trigger !== SkillTrigger.Active) return false;

    if (!this.spendEnergy(Skill.energyCost[entityId]!)) return false;

    Skill.currentCooldown[entityId] = Skill.cooldown[entityId]!;
    return true;
  }

  /** Execute taunt — enemies within range get Taunted component */
  executeTaunt(world: TowerWorld, sourceId: number, x: number, y: number, config: { range: number; value: number }): void {
    Sound.play('skill_taunt');
    const enemies = enemyQuery(world.world);
    for (let i = 0; i < enemies.length; i++) {
      const eid = enemies[i]!;
      if (UnitTag.isEnemy[eid] !== 1) continue;
      const ex = Position.x[eid];
      const ey = Position.y[eid];
      if (ex === undefined || ey === undefined) continue;
      const dx = ex - x;
      const dy = ey - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= config.range) {
        world.addComponent(eid, Taunted, { sourceId, timer: config.value });
      }
    }
  }

  /** Execute whirlwind — enemies within range take direct damage */
  executeWhirlwind(world: TowerWorld, x: number, y: number, config: { range: number; value: number }): void {
    Sound.play('skill_whirlwind');
    const enemies = enemyQuery(world.world);
    for (let i = 0; i < enemies.length; i++) {
      const eid = enemies[i]!;
      if (UnitTag.isEnemy[eid] !== 1) continue;
      const ex = Position.x[eid];
      const ey = Position.y[eid];
      if (ex === undefined || ey === undefined) continue;
      const dx = ex - x;
      const dy = ey - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= config.range) {
        applyDamageToTarget(world, eid, config.value, DamageTypeVal.Physical);
      }
    }
  }

  /** Check whether an entity's skill is ready to use */
  isSkillReady(entityId: number, skillId: string): boolean {
    const skillIdNum = SkillIdNum[skillId];
    if (skillIdNum === undefined) return false;
    if (Skill.skillId[entityId] !== skillIdNum) return false;
    return Skill.currentCooldown[entityId]! <= 0;
  }

  // ---- Private ----

  private applyPassive(_world: TowerWorld, _entityId: number, _config: SkillConfig): void {
    // Passive skill framework — to be extended per-tower-skill
  }
}
