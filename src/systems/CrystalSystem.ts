import { defineQuery } from 'bitecs';

import { Crystal, Faction, FactionTeam, Health, Position } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';

export function createCrystalSystem(): System {
  const crystalQuery = defineQuery([Position, Health, Crystal]);
  const enemyQuery = defineQuery([Position, Health, Faction]);

  return {
    name: 'CrystalSystem',
    phase: 'gameplay',
    update(world: TowerWorld): void {
      const crystals = crystalQuery(world);
      const candidates = enemyQuery(world);

      for (let i = 0; i < crystals.length; i += 1) {
        const crystal = crystals[i]!;
        if (Health.current[crystal]! <= 0) continue;

        const cx = Position.x[crystal]!;
        const cy = Position.y[crystal]!;
        const r = Crystal.radius[crystal]!;
        const rSq = r * r;

        for (let j = 0; j < candidates.length; j += 1) {
          const enemy = candidates[j]!;
          if (enemy === crystal) continue;
          if (Faction.team[enemy] !== FactionTeam.Enemy) continue;
          if (Health.current[enemy]! <= 0) continue;

          const dx = Position.x[enemy]! - cx;
          const dy = Position.y[enemy]! - cy;
          if (dx * dx + dy * dy > rSq) continue;

          Health.current[enemy] = 0;
          Health.current[crystal] = Health.current[crystal]! - 1;

          if (Health.current[crystal]! <= 0) break;
        }
      }
    },
  };
}
