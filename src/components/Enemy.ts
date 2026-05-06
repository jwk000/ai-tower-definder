import { CType, type EnemyType } from '../types/index.js';

export class Enemy {
  readonly type = CType.Enemy;
  enemyType: EnemyType;
  defense: number;
  atk: number; // damage to base on reaching end

  constructor(enemyType: EnemyType, defense: number, atk: number) {
    this.enemyType = enemyType;
    this.defense = defense;
    this.atk = atk;
  }
}
