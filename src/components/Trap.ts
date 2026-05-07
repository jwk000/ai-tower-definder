import { CType } from '../types/index.js';

export class Trap {
  readonly type = CType.Trap;
  damagePerSecond: number;
  radius: number;

  constructor(damagePerSecond: number, radius: number) {
    this.damagePerSecond = damagePerSecond;
    this.radius = radius;
  }
}
