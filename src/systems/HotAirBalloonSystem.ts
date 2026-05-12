// ============================================================
// Tower Defender — HotAirBalloonSystem
//
// Handles HotAirBalloon enemies dropping bombs on Player-owned
// buildings (towers, gold mines, energy towers, base).
//
// - Finds HotAirBalloon enemies (UnitTag.isEnemy=1 + Attack.isRanged=1)
// - Checks for Player-owned buildings directly below the balloon
// - Spawns bombs via BombSystem.spawnBomb (lifecycle owned by BombSystem)
// ============================================================

import { TowerWorld, type System, defineQuery } from '../core/World.js';
import {
  Position, Attack, UnitTag, Health,
  Tower, Production, Category, CategoryVal,
  Faction, FactionVal, Movement,
} from '../core/components.js';
import { ENEMY_CONFIGS } from '../data/gameData.js';
import { EnemyType } from '../types/index.js';
import { spawnBomb } from './BombSystem.js';

const balloonQuery = defineQuery([Position, Attack, UnitTag, Movement]);
const positionHealthQuery = defineQuery([Position, Health]);

const BALLOON_CONFIG = ENEMY_CONFIGS[EnemyType.HotAirBalloon];

export class HotAirBalloonSystem implements System {
  readonly name = 'HotAirBalloonSystem';

  update(world: TowerWorld, dt: number): void {
    const balloons = balloonQuery(world.world);
    const balloonSet = new Set(balloons);

    for (const eid of balloons) {
      if (UnitTag.isEnemy[eid] !== 1) continue;
      if (Attack.isRanged[eid] !== 1) continue;

      Attack.cooldownTimer[eid]! -= dt;
      if (Attack.cooldownTimer[eid]! > 0) continue;

      const bx = Position.x[eid]!;
      const by = Position.y[eid]!;

      const buildingId = this.findBuildingBelow(world, bx, by, balloonSet);
      if (buildingId === 0) continue;

      const buildingY = Position.y[buildingId]!;
      const bombDamage = BALLOON_CONFIG?.bombDamage ?? 30;
      const bombRadius = BALLOON_CONFIG?.bombRadius ?? 60;

      spawnBomb(world, {
        fromX: bx,
        fromY: by,
        targetY: buildingY,
        damage: bombDamage,
        radius: bombRadius,
        ownerFaction: FactionVal.Enemy,
      });

      const bombInterval = BALLOON_CONFIG?.bombInterval ?? 3.5;
      Attack.cooldownTimer[eid] = bombInterval;
    }
  }

  /**
   * Find a Player-owned building directly below the balloon's position.
   *
   * "Directly below" means:
   *  - building Y > balloon Y (building is below in screen space)
   *  - |building X - balloon X| <= bombRadius (horizontal proximity)
   *
   * Prioritises the closest horizontal match.
   */
  private findBuildingBelow(
    world: TowerWorld,
    balloonX: number,
    balloonY: number,
    excludeSet: Set<number>,
  ): number {
    const searchRange = BALLOON_CONFIG?.bombRadius ?? 60;
    const candidates = positionHealthQuery(world.world);
    let bestId = 0;
    let bestDist = Infinity;

    for (const tid of candidates) {
      if (excludeSet.has(tid)) continue;
      if (Health.current[tid]! <= 0) continue;

      const ty = Position.y[tid]!;
      if (ty <= balloonY) continue;

      if (!this.isPlayerBuilding(tid)) continue;

      const tx = Position.x[tid]!;
      const dx = Math.abs(tx - balloonX);

      if (dx <= searchRange && dx < bestDist) {
        bestDist = dx;
        bestId = tid;
      }
    }

    return bestId;
  }

  private isPlayerBuilding(eid: number): boolean {
    if (Faction.value[eid] !== FactionVal.Player) return false;

    const category = Category.value[eid];
    if (
      category === CategoryVal.Tower ||
      category === CategoryVal.Building ||
      category === CategoryVal.Objective
    ) {
      return true;
    }

    if (Tower.towerType[eid] !== undefined) return true;
    if (Production.rate[eid] !== undefined) return true;

    return false;
  }
}
