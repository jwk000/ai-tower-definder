import { System } from '../types/index.js';
import { World } from '../core/World.js';
import { CType } from '../types/index.js';
import { Production } from '../components/Production.js';
import type { EconomySystem } from './EconomySystem.js';

export class ProductionSystem implements System {
  readonly name = 'ProductionSystem';
  readonly requiredComponents = [CType.Production] as const;

  constructor(
    private world: World,
    private economy: EconomySystem,
  ) {}

  update(entities: number[], dt: number): void {
    for (const id of entities) {
      const prod = this.world.getComponent<Production>(id, CType.Production);
      if (!prod) continue;

      prod.accumulator += prod.rate * dt;

      while (prod.accumulator >= 1) {
        prod.accumulator -= 1;
        if (prod.resourceType === 'gold') {
          this.economy.addGold(1);
        } else if (prod.resourceType === 'energy') {
          this.economy.addEnergy(1);
        }
      }
    }
  }
}
