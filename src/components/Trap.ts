import { CType } from '../types/index.js';

export class Trap {
  readonly type = CType.Trap;
  damagePerSecond: number;
  radius: number;
  spikeAnimTimer: number;
  spikeAnimDuration: number;

  constructor(damagePerSecond: number, radius: number) {
    this.damagePerSecond = damagePerSecond;
    this.radius = radius;
    this.spikeAnimTimer = 0;
    this.spikeAnimDuration = 0.4;
  }
}
