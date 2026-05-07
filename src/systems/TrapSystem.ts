import { System, CType } from '../types/index.js';
import { World } from '../core/World.js';
import { Position } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { Trap } from '../components/Trap.js';

export class TrapSystem implements System {
  readonly name = 'TrapSystem';
  readonly requiredComponents = [CType.Trap, CType.Position] as const;

  constructor(private world: World) {}

  update(trapEntities: number[], dt: number): void {
    const enemies = this.world.query(CType.Enemy, CType.Position, CType.Health);

    for (const trapId of trapEntities) {
      const trap = this.world.getComponent<Trap>(trapId, CType.Trap)!;
      const trapPos = this.world.getComponent<Position>(trapId, CType.Position)!;

      trap.tick(dt);
      if (!trap.ready) continue;

      for (const enemyId of enemies) {
        const enemyPos = this.world.getComponent<Position>(enemyId, CType.Position)!;
        const dx = enemyPos.x - trapPos.x;
        const dy = enemyPos.y - trapPos.y;
        if (Math.sqrt(dx * dx + dy * dy) <= trap.radius) {
          const health = this.world.getComponent<Health>(enemyId, CType.Health)!;
          health.current -= trap.damage;
          trap.resetCooldown();
          break;
        }
      }
    }
  }
}
