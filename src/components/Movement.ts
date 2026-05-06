import { CType } from '../types/index.js';

export class Movement {
  readonly type = CType.Movement;
  speed: number; // pixels per second
  pathIndex: number; // current waypoint index
  private progress: number; // 0-1 between current and next waypoint

  constructor(speed: number, startIndex: number = 0) {
    this.speed = speed;
    this.pathIndex = startIndex;
    this.progress = 0;
  }

  get progressValue(): number {
    return this.progress;
  }

  advance(distance: number, segmentLength: number): boolean {
    // Returns true if reached next waypoint
    this.progress += distance / segmentLength;
    if (this.progress >= 1) {
      this.progress = 0;
      this.pathIndex++;
      return true;
    }
    return false;
  }

  setProgress(value: number): void {
    this.progress = value;
  }
}
