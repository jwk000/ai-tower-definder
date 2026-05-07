import { CType } from '../types/index.js';

export class Skill {
  readonly type = CType.Skill;
  skillId: string;
  cooldown: number;
  currentCooldown: number;
  energyCost: number;

  constructor(skillId: string, cooldown: number, energyCost: number) {
    this.skillId = skillId;
    this.cooldown = cooldown;
    this.currentCooldown = 0;
    this.energyCost = energyCost;
  }

  get isReady(): boolean {
    return this.currentCooldown <= 0;
  }

  resetCooldown(): void {
    this.currentCooldown = this.cooldown;
  }

  tickCooldown(dt: number): void {
    if (this.currentCooldown > 0) {
      this.currentCooldown = Math.max(0, this.currentCooldown - dt);
    }
  }
}
