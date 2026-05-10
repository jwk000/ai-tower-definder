import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Position, Health, Trap, GridOccupant, UnitTag, DamageTypeVal } from '../core/components.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { RenderSystem } from './RenderSystem.js';

const trapQuery = defineQuery([Trap, Position, GridOccupant]);
const damageableQuery = defineQuery([Position, Health]);

/** Grid-based trap damage system — damages enemies on the same tile */
export class TrapSystem implements System {
  readonly name = 'TrapSystem';

  constructor(private tileSize: number) {}

  update(world: TowerWorld, dt: number): void {
    const traps = trapQuery(world.world);
    const enemies = damageableQuery(world.world);
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;

    for (const trapId of traps) {
      // Animation decay
      Trap.animTimer[trapId] = Math.max(0, Trap.animTimer[trapId]! - dt);

      const trapRow = GridOccupant.row[trapId];
      const trapCol = GridOccupant.col[trapId];
      let damaging = false;

      for (const enemyId of enemies) {
        const enemyCol = Math.floor((Position.x[enemyId]! - ox) / this.tileSize);
        const enemyRow = Math.floor((Position.y[enemyId]! - oy) / this.tileSize);

        if (enemyRow === trapRow && enemyCol === trapCol) {
          applyDamageToTarget(world, enemyId, Trap.damagePerSecond[trapId]! * dt, DamageTypeVal.Physical);
          damaging = true;
          break;
        }
      }

      if (damaging) {
        Trap.animTimer[trapId] = Trap.animDuration[trapId]!;
      }
    }
  }
}
