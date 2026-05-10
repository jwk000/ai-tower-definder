import { TowerWorld, type System } from '../core/World.js';
import { Position, Health, HealingSpring, PlayerOwned, defineQuery } from '../core/components.js';

const springQuery = defineQuery([Position, HealingSpring]);
const healTargetQuery = defineQuery([Position, Health, PlayerOwned]);

/** Area-healing system — HealingSpring entities heal nearby PlayerOwned entities each frame */
export class HealingSystem implements System {
  readonly name = 'HealingSystem';

  update(world: TowerWorld, dt: number): void {
    const w = world.world;
    const springs = springQuery(w);
    const targets = healTargetQuery(w);

    for (const springId of springs) {
      const healRange = HealingSpring.healRange[springId]!;
      const healAmount = HealingSpring.healAmount[springId]!;
      const sx = Position.x[springId]!;
      const sy = Position.y[springId]!;

      for (const targetId of targets) {
        const tx = Position.x[targetId]!;
        const ty = Position.y[targetId]!;
        const dx = tx - sx;
        const dy = ty - sy;

        if (dx * dx + dy * dy <= healRange * healRange) {
          Health.current[targetId]! = Math.min(
            Health.max[targetId]!,
            Health.current[targetId]! + healAmount * dt,
          );
        }
      }
    }
  }
}
