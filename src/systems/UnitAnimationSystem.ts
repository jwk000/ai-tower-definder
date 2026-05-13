import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Visual } from '../core/components.js';

const BREATH_RATE = 2.2;

export class UnitAnimationSystem implements System {
  readonly name = 'UnitAnimationSystem';

  private query = defineQuery([Visual]);

  update(world: TowerWorld, dt: number): void {
    const ents = this.query(world.world);
    for (let i = 0; i < ents.length; i++) {
      const eid = ents[i]!;
      if (Visual.partsId[eid]! === 0) continue;

      Visual.breathPhase[eid] = ((Visual.breathPhase[eid] ?? 0) + dt * BREATH_RATE) % (Math.PI * 2);

      const t = Visual.attackAnimTimer[eid] ?? 0;
      if (t > 0) {
        Visual.attackAnimTimer[eid] = Math.max(0, t - dt);
      }
    }
  }
}
