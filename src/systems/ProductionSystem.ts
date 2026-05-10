import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Production, ResourceTypeVal } from '../core/components.js';
import type { EconomySystem } from './EconomySystem.js';

export class ProductionSystem implements System {
  readonly name = 'ProductionSystem';
  private query = defineQuery([Production]);

  constructor(private economy: EconomySystem) {}

  update(world: TowerWorld, dt: number): void {
    const entities = this.query(world.world);
    for (const eid of entities) {
      Production.accumulator[eid] += Production.rate[eid] * dt;

      while (Production.accumulator[eid] >= 1) {
        Production.accumulator[eid] -= 1;
        if (Production.resourceType[eid] === ResourceTypeVal.Gold) {
          this.economy.addGold(1);
        } else {
          this.economy.addEnergy(1);
        }
      }
    }
  }
}
