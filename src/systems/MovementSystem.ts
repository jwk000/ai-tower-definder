import { System, type GridPos } from '../types/index.js';
import { World } from '../core/World.js';
import { CType } from '../types/index.js';
import { Position } from '../components/Position.js';
import { Movement } from '../components/Movement.js';
import { Health } from '../components/Health.js';
import { Enemy } from '../components/Enemy.js';
import type { MapConfig } from '../types/index.js';

/** Moves enemy entities along the predefined path */
export class MovementSystem implements System {
  readonly name = 'MovementSystem';
  readonly requiredComponents = [CType.Position, CType.Movement, CType.Enemy] as const;

  constructor(
    private world: World,
    private map: MapConfig,
  ) {}

  update(entities: number[], dt: number): void {
    for (const id of entities) {
      const pos = this.world.getComponent<Position>(id, CType.Position)!;
      const mov = this.world.getComponent<Movement>(id, CType.Movement)!;

      const path = this.map.enemyPath;
      const currentIdx = mov.pathIndex;

      // Check if reached end of path
      if (currentIdx >= path.length - 1) {
        this.onReachEnd(id);
        continue;
      }

      const current = path[currentIdx]!;
      const next = path[currentIdx + 1]!;

      // Calculate world position of waypoints
      const ts = this.map.tileSize;
      const cx = current.col * ts + ts / 2;
      const cy = current.row * ts + ts / 2;
      const nx = next.col * ts + ts / 2;
      const ny = next.row * ts + ts / 2;

      const dx = nx - cx;
      const dy = ny - cy;
      const segmentLen = Math.sqrt(dx * dx + dy * dy);

      if (segmentLen > 0) {
        const dist = mov.speed * dt;
        const reachedNext = mov.advance(dist, segmentLen);

        // Interpolate position along segment
        const t = mov.progressValue;
        pos.x = cx + dx * t;
        pos.y = cy + dy * t;

        if (reachedNext) {
          // Snap to next waypoint
          pos.x = nx;
          pos.y = ny;
        }
      }
    }
  }

  private onReachEnd(enemyId: number): void {
    // Enemy reached base — deal damage to base
    const enemy = this.world.getComponent<Enemy>(enemyId, CType.Enemy);
    const damage = enemy?.atk ?? 10;

    // Find the "base" entity (player lives tracker)
    const bases = this.world.query(CType.Health, CType.Position);
    // For MVP, base is the only non-enemy Health entity (or a dedicated Base component)
    // We use a simple approach: find Health entity that's NOT an Enemy
    for (const baseId of bases) {
      if (!this.world.hasComponent(baseId, CType.Enemy)) {
        const health = this.world.getComponent<Health>(baseId, CType.Health);
        if (health) {
          health.takeDamage(damage);
        }
      }
    }

    this.world.destroyEntity(enemyId);
  }
}
