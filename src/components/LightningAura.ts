import { CType } from '../types/index.js';

/** White glow ring on enemy after lightning hit — fades over time */
export class LightningAura {
  readonly type = 'LightningAura';
  timer: number;

  constructor(duration: number) {
    this.timer = duration;
  }
}
