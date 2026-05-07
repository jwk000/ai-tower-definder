import { System, CType } from '../types/index.js';
import { World } from '../core/World.js';
import { Position, GridOccupant } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { Render } from '../components/Render.js';
import { Trap } from '../components/Trap.js';
import { RenderSystem } from './RenderSystem.js';

export class TrapSystem implements System {
  readonly name = 'TrapSystem';
  readonly requiredComponents = [CType.Trap, CType.Position] as const;

  constructor(
    private world: World,
    private tileSize: number,
  ) {}

  update(trapEntities: number[], dt: number): void {
    const enemies = this.world.query(CType.Enemy, CType.Position, CType.Health);
    const ox = RenderSystem.sceneOffsetX;
    const oy = RenderSystem.sceneOffsetY;

    for (const trapId of trapEntities) {
      const trap = this.world.getComponent<Trap>(trapId, CType.Trap)!;
      const grid = this.world.getComponent<GridOccupant>(trapId, CType.GridOccupant);
      if (!grid) continue;

      let damaging = false;

      for (const enemyId of enemies) {
        const enemyPos = this.world.getComponent<Position>(enemyId, CType.Position)!;
        const col = Math.floor((enemyPos.x - ox) / this.tileSize);
        const row = Math.floor((enemyPos.y - oy) / this.tileSize);

        if (row === grid.gridPos.row && col === grid.gridPos.col) {
          const health = this.world.getComponent<Health>(enemyId, CType.Health)!;
          health.current -= trap.damagePerSecond * dt;
          damaging = true;
          break;
        }
      }

      if (damaging) {
        const trapRender = this.world.getComponent<Render>(trapId, CType.Render);
        if (trapRender) {
          trapRender.hitFlashTimer = 0.1;
        }
      }
    }
  }
}
