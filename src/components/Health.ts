import { CType } from '../types/index.js';

export class Health {
  readonly type = CType.Health;
  current: number;
  max: number;

  constructor(max: number) {
    this.max = max;
    this.current = max;
  }

  get alive(): boolean {
    return this.current > 0;
  }

  get ratio(): number {
    return this.current / this.max;
  }

  takeDamage(amount: number): void {
    this.current = Math.max(0, this.current - amount);
  }

  heal(amount: number): void {
    this.current = Math.min(this.max, this.current + amount);
  }
}
