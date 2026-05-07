import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType, BuffAttribute, type BuffInstance } from '../types/index.js';
import { BuffContainer } from '../components/Buff.js';

export class BuffSystem implements System {
  readonly name = 'BuffSystem';
  readonly requiredComponents = [CType.Buff] as const;

  constructor(private world: World) {}

  update(entities: number[], dt: number): void {
    for (const id of entities) {
      const container = this.world.getComponent<BuffContainer>(id, CType.Buff);
      if (!container) continue;

      const toRemove: string[] = [];

      for (const [buffId, buff] of container.buffs) {
        if (buff.duration > 0) {
          buff.duration -= dt;
          if (buff.duration <= 0) {
            toRemove.push(buffId);
          }
        }
      }

      for (const buffId of toRemove) {
        container.removeBuff(buffId);
      }

      this.checkFreeze(container, id);
    }
  }

  private checkFreeze(container: BuffContainer, entityId: number): void {
    const chill = container.buffs.get('chill');
    if (chill && chill.currentStacks >= chill.maxStacks) {
      container.removeBuff('chill');
      const freezeBuff: BuffInstance = {
        id: 'freeze',
        name: '冰冻',
        attribute: BuffAttribute.Speed,
        value: -100,
        isPercent: true,
        duration: 1.0,
        maxStacks: 1,
        currentStacks: 1,
        sourceEntityId: entityId,
      };
      container.addBuff(freezeBuff);
    }
  }

  getEffectiveValue(entityId: number, attribute: BuffAttribute): { absolute: number; percent: number } {
    const container = this.world.getComponent<BuffContainer>(entityId, CType.Buff);
    if (!container) return { absolute: 0, percent: 0 };
    return container.getEffectiveValue(attribute);
  }
}
