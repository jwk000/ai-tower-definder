import { CType, type EnemyType } from '../types/index.js';

export class Enemy {
  readonly type = CType.Enemy;
  enemyType: EnemyType;
  defense: number;
  atk: number;
  movementPaused: boolean;
  originalSpeed: number;
  /** Stun timer in seconds — enemy stops moving/attacking while > 0 */
  stunTimer: number = 0;

  constructor(enemyType: EnemyType, defense: number, atk: number, speed: number) {
    this.enemyType = enemyType;
    this.defense = defense;
    this.atk = atk;
    this.movementPaused = false;
    this.originalSpeed = speed;
  }
}
