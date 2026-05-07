import { CType, BuffAttribute, type BuffInstance } from '../types/index.js';

export class BuffContainer {
  readonly type = CType.Buff;
  buffs: Map<string, BuffInstance>;

  constructor() {
    this.buffs = new Map();
  }

  addBuff(buff: BuffInstance): boolean {
    const existing = this.buffs.get(buff.id);
    if (existing) {
      existing.duration = buff.duration;
      if (existing.currentStacks < existing.maxStacks) {
        existing.currentStacks++;
        return true;
      }
      return false;
    }
    this.buffs.set(buff.id, { ...buff });
    return true;
  }

  removeBuff(buffId: string): void {
    this.buffs.delete(buffId);
  }

  getEffectiveValue(attribute: BuffAttribute): { absolute: number; percent: number } {
    let absolute = 0;
    let percent = 0;
    for (const buff of this.buffs.values()) {
      if (buff.attribute === attribute) {
        const stackValue = buff.value * buff.currentStacks;
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
