import { TowerWorld, type System } from '../core/World.js';
import { UnitTag } from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';

export class EconomySystem implements System {
  readonly name = 'EconomySystem';

  gold: number = 200;
  private pendingGold: number = 0;

  energy: number = 50;
  private pendingEnergy: number = 0;

  population: number = 0;
  maxPopulation: number = 6;

  endlessScore: number = 0;
  isEndless: boolean = false;

  addEndlessKillScore(enemyGoldReward: number, waveNumber: number): void {
    if (!this.isEndless) return;
    this.endlessScore += enemyGoldReward * waveNumber;
  }

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

  addEnergy(amount: number): void {
    this.pendingEnergy += amount;
  }

  spendEnergy(amount: number): boolean {
    const total = this.energy + this.pendingEnergy;
    if (total >= amount) {
      if (this.pendingEnergy >= amount) {
        this.pendingEnergy -= amount;
      } else {
        const fromEnergy = amount - this.pendingEnergy;
        this.pendingEnergy = 0;
        this.energy -= fromEnergy;
      }
      return true;
    }
    return false;
  }

  canDeployUnit(popCost: number): boolean {
    return this.population + popCost <= this.maxPopulation;
  }

  deployUnit(popCost: number): void {
    this.population += popCost;
  }

  releaseUnit(popCost: number): void {
    this.population = Math.max(0, this.population - popCost);
  }

  rewardForEnemy(enemyId: number): void {
    const goldReward = UnitTag.rewardGold[enemyId];
    if (goldReward !== undefined) {
      this.addGold(goldReward);
    }
  }

  update(_world: TowerWorld, _dt: number): void {
    this.gold += this.pendingGold;
    this.pendingGold = 0;
    this.energy += this.pendingEnergy;
    this.pendingEnergy = 0;
  }
}
