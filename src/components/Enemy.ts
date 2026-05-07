import { CType, type EnemyType } from '../types/index.js';

export class Enemy {
  readonly type = CType.Enemy;
  enemyType: EnemyType;
  defense: number;
  atk: number;
  movementPaused: boolean;
  originalSpeed: number;

  constructor(enemyType: EnemyType, defense: number, atk: number, speed: number) {
    this.enemyType = enemyType;
    this.defense = defense;
    this.atk = atk;
    this.movementPaused = false;
    this.originalSpeed = speed;
  }
}
