import { CType } from '../types/index.js';

/** Visual effect — a lightning bolt line between two points */
export class LightningBolt {
  readonly type = 'LightningBolt';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  timer: number;
  maxTimer: number;

  constructor(fromX: number, fromY: number, toX: number, toY: number, duration: number) {
    this.fromX = fromX;
    this.fromY = fromY;
    this.toX = toX;
    this.toY = toY;
    this.timer = duration;
    this.maxTimer = duration;
  }

  get alpha(): number {
    return Math.max(0, this.timer / this.maxTimer);
  }
}
