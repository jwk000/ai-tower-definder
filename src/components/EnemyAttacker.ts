import { CType } from '../types/index.js';

export class EnemyAttacker {
  readonly type = CType.EnemyAttacker;
  attackRange: number;
  attackSpeed: number;
  attackDamage: number;
  cooldown: number;
  targetId: number | null;

  constructor(range: number, speed: number, damage: number) {
    this.attackRange = range;
    this.attackSpeed = speed;
    this.attackDamage = damage;
    this.cooldown = 0;
    this.targetId = null;
  }
}
