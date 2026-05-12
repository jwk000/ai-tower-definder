import { TowerWorld, type System, defineQuery } from '../core/World.js';
import { Position, Health, Trap, GridOccupant, Layer, LayerVal, DamageTypeVal } from '../core/components.js';
import { applyDamageToTarget } from '../utils/damageUtils.js';
import { RenderSystem } from './RenderSystem.js';

const trapQuery = defineQuery([Trap, Position, GridOccupant]);
const damageableQuery = defineQuery([Position, Health]);

/**
 * Grid-based trap damage system — damages enemies on the same tile.
 *
 * Layer rules (design/18-layer-system.md §5.4):
 *   AboveGrid trap (default): triggers on Ground + AboveGrid; LowAir flies over
 *   BelowGrid trap (mine pre-arming): triggers on any layer
 *   LowAir trap (sky trap): triggers on LowAir only
 */
export class TrapSystem implements System {
  readonly name = 'TrapSystem';

  constructor(private tileSize: number) {}

  update(world: TowerWorld, dt: number): void {
    const traps = trapQuery(world.world);
    const enemies = damageableQuery(world.world);
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;

    for (const trapId of traps) {
      Trap.animTimer[trapId] = Math.max(0, Trap.animTimer[trapId]! - dt);

      const trapRow = GridOccupant.row[trapId];
      const trapCol = GridOccupant.col[trapId];
      const trapLayer = Layer.value[trapId] ?? LayerVal.AboveGrid;
      let damaging = false;

      for (const enemyId of enemies) {
        const enemyCol = Math.floor((Position.x[enemyId]! - ox) / this.tileSize);
        const enemyRow = Math.floor((Position.y[enemyId]! - oy) / this.tileSize);

        if (enemyRow !== trapRow || enemyCol !== trapCol) continue;

        const enemyLayer = Layer.value[enemyId] ?? LayerVal.Ground;
        if (!TrapSystem.canTriggerOnEnemy(trapLayer, enemyLayer)) continue;

        applyDamageToTarget(world, enemyId, Trap.damagePerSecond[trapId]! * dt, DamageTypeVal.Physical);
        damaging = true;
        break;
      }

      if (damaging) {
        Trap.animTimer[trapId] = Trap.animDuration[trapId]!;
      }
    }
  }

  /**
   * Layer trigger matrix per design/18 §5.4.
   * Exported as static helper to enable unit testing without world setup.
   */
  static canTriggerOnEnemy(trapLayer: number, enemyLayer: number): boolean {
    switch (trapLayer) {
      case LayerVal.AboveGrid:
        return enemyLayer === LayerVal.Ground || enemyLayer === LayerVal.AboveGrid;
      case LayerVal.BelowGrid:
        return true;
      case LayerVal.LowAir:
        return enemyLayer === LayerVal.LowAir;
      default:
        return enemyLayer === LayerVal.Ground || enemyLayer === LayerVal.AboveGrid;
    }
  }
}
