import { CType } from '../types/index.js';

export class BatTower {
  readonly type = CType.BatTower;

  maxBats: number;
  batIds: Set<number>;
  replenishCooldown: number;
  replenishTimer: number;
  batDamage: number;
  batAttackRange: number;
  batAttackSpeed: number;
  batHp: number;
  batSpeed: number;
  batSize: number;

  constructor(
    maxBats: number,
    replenishCooldown: number,
    batDamage: number,
    batAttackRange: number,
    batAttackSpeed: number,
    batHp: number,
    batSpeed: number,
    batSize: number,
  ) {
    this.maxBats = maxBats;
    this.batIds = new Set();
    this.replenishCooldown = replenishCooldown;
    this.replenishTimer = 0;
    this.batDamage = batDamage;
    this.batAttackRange = batAttackRange;
    this.batAttackSpeed = batAttackSpeed;
    this.batHp = batHp;
    this.batSpeed = batSpeed;
    this.batSize = batSize;
  }

  get aliveBatCount(): number {
    return this.batIds.size;
  }

  startReplenish(): void {
    this.replenishTimer = this.replenishCooldown;
  }
}
