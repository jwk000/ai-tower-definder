import { System, GamePhase } from '../types/index.js';
import { CType } from '../types/index.js';
import { Enemy } from '../components/Enemy.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import type { World } from '../core/World.js';

export class EconomySystem implements System {
  readonly name = 'EconomySystem';
  readonly requiredComponents = [] as const;

  gold: number = 200;
  private pendingGold: number = 0;

  constructor(private world: World) {}

  addGold(amount: number): void {
    this.pendingGold += amount;
  }

  spendGold(amount: number): boolean {
    const total = this.gold + this.pendingGold;
    if (total >= amount) {
      if (this.pendingGold >= amount) {
        this.pendingGold -= amount;
      } else {
        const fromGold = amount - this.pendingGold;
        this.pendingGold = 0;
        this.gold -= fromGold;
      }
      return true;
    }
    return false;
  }

  rewardForEnemy(enemyId: number): void {
    const enemy = this.world.getComponent<Enemy>(enemyId, CType.Enemy) as Enemy | undefined;
    if (enemy) {
      const config = ENEMY_CONFIGS[enemy.enemyType];
      if (config) {
        this.addGold(config.rewardGold);
      }
    }
  }

  update(_entities: number[], _dt: number): void {
    this.gold += this.pendingGold;
    this.pendingGold = 0;
  }
}
