import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType, SkillTrigger, BuffAttribute, type BuffInstance } from '../types/index.js';
import { Skill } from '../components/Skill.js';
import { Position } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { BuffContainer } from '../components/Buff.js';
import { SKILL_CONFIGS } from '../data/gameData.js';

export class SkillSystem implements System {
  readonly name = 'SkillSystem';
  readonly requiredComponents = [CType.Skill] as const;

  constructor(
    private world: World,
    private spendEnergy: (amount: number) => boolean,
  ) {}

  update(entities: number[], dt: number): void {
    for (const id of entities) {
      const skill = this.world.getComponent<Skill>(id, CType.Skill);
      if (!skill) continue;

      skill.tickCooldown(dt);

      const config = SKILL_CONFIGS[skill.skillId];
      if (!config) continue;

      if (config.trigger === SkillTrigger.Passive) {
        this.applyPassive(id, config);
      }
    }
  }

  useSkill(entityId: number, skillId: string): boolean {
    const skill = this.world.getComponent<Skill>(entityId, CType.Skill);
    if (!skill || skill.skillId !== skillId) return false;
    if (!skill.isReady) return false;

    const config = SKILL_CONFIGS[skillId];
    if (!config) return false;

    if (!this.spendEnergy(config.energyCost)) return false;

    const pos = this.world.getComponent<Position>(entityId, CType.Position);
    if (!pos) return false;

    skill.resetCooldown();

    if (skillId === 'taunt') {
      this.executeTaunt(entityId, pos.x, pos.y, config);
    } else if (skillId === 'whirlwind') {
      this.executeWhirlwind(pos.x, pos.y, config);
    }

    return true;
  }

  private executeTaunt(sourceId: number, x: number, y: number, config: { range: number; value: number }): void {
    const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);
    for (const enemyId of enemies) {
      const ePos = this.world.getComponent<Position>(enemyId, CType.Position);
      if (!ePos) continue;
      const dx = ePos.x - x;
      const dy = ePos.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= config.range) {
        let container = this.world.getComponent<BuffContainer>(enemyId, CType.Buff);
        if (!container) {
          container = new BuffContainer();
          this.world.addComponent(enemyId, container);
        }
        const tauntBuff: BuffInstance = {
          id: 'taunt',
          name: '嘲讽',
          attribute: BuffAttribute.ATK,
          value: 0,
          isPercent: false,
          duration: config.value,
          maxStacks: 1,
          currentStacks: 1,
          sourceEntityId: sourceId,
        };
        container.addBuff(tauntBuff);
      }
    }
  }

  private executeWhirlwind(x: number, y: number, config: { range: number; value: number }): void {
    const enemies = this.world.query(CType.Position, CType.Health, CType.Enemy);
    for (const enemyId of enemies) {
      const ePos = this.world.getComponent<Position>(enemyId, CType.Position);
      if (!ePos) continue;
      const dx = ePos.x - x;
      const dy = ePos.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= config.range) {
        const health = this.world.getComponent<Health>(enemyId, CType.Health);
        if (health) {
          health.takeDamage(config.value);
        }
      }
    }
  }

  private applyPassive(_entityId: number, _config: { trigger: SkillTrigger }): void {
    // Passive skill framework — to be extended per-tower-skill
  }

  isSkillReady(entityId: number, skillId: string): boolean {
    const skill = this.world.getComponent<Skill>(entityId, CType.Skill);
    if (!skill || skill.skillId !== skillId) return false;
    return skill.isReady;
  }
}
