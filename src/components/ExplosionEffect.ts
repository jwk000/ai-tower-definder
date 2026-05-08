import { CType } from '../types/index.js';

export class ExplosionEffect {
  readonly type = 'ExplosionEffect';
  timer: number;
  maxTimer: number;
  maxRadius: number;
  color: string;

  constructor(maxRadius: number, color: string, duration: number) {
    this.timer = duration;
    this.maxTimer = duration;
    this.maxRadius = maxRadius;
    this.color = color;
  }

  get progress(): number {
    return 1 - this.timer / this.maxTimer;
  }

  get currentRadius(): number {
    return this.maxRadius * this.progress;
  }

  get currentAlpha(): number {
    return Math.max(0, 1 - this.progress * 0.8);
  }
}
