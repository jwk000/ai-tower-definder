import { CType } from '../types/index.js';

export class Attack {
  readonly type = CType.Attack;
  atk: number; // damage per hit
  range: number; // pixels
  attackSpeed: number; // attacks per second
  private cooldown: number; // seconds remaining

  constructor(atk: number, range: number, attackSpeed: number) {
    this.atk = atk;
    this.range = range;
    this.attackSpeed = attackSpeed;
    this.cooldown = 0;
  }

  get canAttack(): boolean {
    return this.cooldown <= 0;
  }

  resetCooldown(): void {
    this.cooldown = 1 / this.attackSpeed;
  }

  tickCooldown(dt: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }
  }
}
