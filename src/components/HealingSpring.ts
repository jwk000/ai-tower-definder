import { CType } from '../types/index.js';

export class HealingSpring {
  readonly type = CType.HealingSpring;
  healAmount: number;
  radius: number;

  constructor(healAmount: number, radius: number) {
    this.healAmount = healAmount;
    this.radius = radius;
  }
}
