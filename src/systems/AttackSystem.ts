import { defineQuery } from 'bitecs';

import { Attack, Faction, Health, Position } from '../core/components.js';
import type { System } from '../core/pipeline.js';
import type { TowerWorld } from '../core/World.js';
import { spawnProjectile } from './ProjectileSystem.js';

const DEFAULT_PROJECTILE_SPEED = 480;

export function createAttackSystem(): System {
  const attackerQuery = defineQuery([Position, Faction, Attack]);
  const targetQuery = defineQuery([Position, Faction, Health]);

  return {
    name: 'AttackSystem',
    phase: 'gameplay',
    update(world: TowerWorld, dt: number): void {
      const attackers = attackerQuery(world);
      const candidates = targetQuery(world);

      for (let i = 0; i < attackers.length; i += 1) {
        const attacker = attackers[i]!;
        const cd = Attack.cooldownLeft[attacker]! - dt;
        Attack.cooldownLeft[attacker] = cd > 0 ? cd : 0;

        if (Attack.cooldownLeft[attacker]! > 0) continue;

        const ax = Position.x[attacker]!;
        const ay = Position.y[attacker]!;
        const range = Attack.range[attacker]!;
        const rangeSq = range * range;
        const myTeam = Faction.team[attacker]!;

        let bestTarget = -1;
        let bestDistSq = Number.POSITIVE_INFINITY;

        for (let j = 0; j < candidates.length; j += 1) {
          const cand = candidates[j]!;
          if (cand === attacker) continue;
          if (Faction.team[cand] === myTeam) continue;
          if (Health.current[cand]! <= 0) continue;

          const dx = Position.x[cand]! - ax;
          const dy = Position.y[cand]! - ay;
          const distSq = dx * dx + dy * dy;
          if (distSq > rangeSq) continue;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestTarget = cand;
          }
        }

        if (bestTarget < 0) continue;

        const speed = Attack.projectileSpeed[attacker]! || DEFAULT_PROJECTILE_SPEED;
        spawnProjectile(world, {
          sourceEid: attacker,
          targetEid: bestTarget,
          damage: Attack.damage[attacker]!,
          speed,
        });
        Attack.cooldownLeft[attacker] = Attack.cooldown[attacker]!;
      }
    },
  };
}
