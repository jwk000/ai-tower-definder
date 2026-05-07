import { CType } from '../types/index.js';

export class Trap {
  readonly type = CType.Trap;
  damage: number;
  cooldown: number;
  currentCooldown: number;
  radius: number;

  constructor(damage: number, cooldown: number, radius: number) {
    this.damage = damage;
    this.cooldown = cooldown;
    this.currentCooldown = 0;
    this.radius = radius;
  }

  get ready(): boolean {
    return this.currentCooldown <= 0;
  }

  resetCooldown(): void {
    this.currentCooldown = this.cooldown;
  }

  tick(dt: number): void {
    if (this.currentCooldown > 0) {
      this.currentCooldown -= dt;
    }
  }
}
