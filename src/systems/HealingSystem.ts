import { System, CType } from '../types/index.js';
import { World } from '../core/World.js';
import { Position } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { HealingSpring } from '../components/HealingSpring.js';

export class HealingSystem implements System {
  readonly name = 'HealingSystem';
  readonly requiredComponents = [CType.HealingSpring, CType.Position] as const;

  constructor(private world: World) {}

  update(springEntities: number[], dt: number): void {
    const healTargets = this.world.query(CType.PlayerOwned, CType.Health, CType.Position);

    for (const springId of springEntities) {
      const spring = this.world.getComponent<HealingSpring>(springId, CType.HealingSpring)!;
      const springPos = this.world.getComponent<Position>(springId, CType.Position)!;

      for (const targetId of healTargets) {
        const targetPos = this.world.getComponent<Position>(targetId, CType.Position)!;
        const dx = targetPos.x - springPos.x;
        const dy = targetPos.y - springPos.y;
        if (Math.sqrt(dx * dx + dy * dy) <= spring.radius) {
          const health = this.world.getComponent<Health>(targetId, CType.Health)!;
          health.heal(spring.healAmount * dt);
        }
      }
    }
  }
}
