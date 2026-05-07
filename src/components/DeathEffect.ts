import { CType } from '../types/index.js';

export class DeathEffect {
  readonly type = CType.DeathEffect;
  timer: number;

  constructor(duration: number = 0.3) {
    this.timer = duration;
  }
}
