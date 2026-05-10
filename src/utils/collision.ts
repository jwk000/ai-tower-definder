import { CType } from '../types/index.js';
import type { TowerWorld } from '../core/World.js';
import type { Position } from '../components/Position.js';
import type { Render } from '../components/Render.js';
import type { MapConfig } from '../types/index.js';
import { TileType } from '../types/index.js';
import { RenderSystem } from '../systems/RenderSystem.js';

export interface CollisionResult {
  blocked: boolean;
  pushX: number;
  pushY: number;
}

export function getEntityRadius(world: TowerWorld, entityId: number): number {
  const render = world.getComponent<Render>(entityId, CType.Render);
  if (render) {
    return render.size / 2;
  }
  return 16;
}

export function checkTileCollision(
  x: number,
  y: number,
  radius: number,
  map: MapConfig,
): boolean {
  const ox = RenderSystem.sceneOffsetX;
  const oy = RenderSystem.sceneOffsetY;
  const ts = map.tileSize;

  const minCol = Math.floor((x - radius - ox) / ts);
  const maxCol = Math.floor((x + radius - ox) / ts);
  const minRow = Math.floor((y - radius - oy) / ts);
  const maxRow = Math.floor((y + radius - oy) / ts);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (row < 0 || row >= map.rows || col < 0 || col >= map.cols) {
        return true;
      }
      const tile = map.tiles[row]![col]!;
      if (tile === TileType.Blocked || tile === TileType.Path) {
        const tileCenterX = col * ts + ts / 2 + ox;
        const tileCenterY = row * ts + ts / 2 + oy;
        const halfTs = ts / 2;

        const closestX = Math.max(tileCenterX - halfTs, Math.min(x, tileCenterX + halfTs));
        const closestY = Math.max(tileCenterY - halfTs, Math.min(y, tileCenterY + halfTs));

        const dx = x - closestX;
        const dy = y - closestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radius * radius) {
          return true;
        }
      }
    }
  }
  return false;
}

export function checkEntityCollision(
  world: TowerWorld,
  entityId: number,
  x: number,
  y: number,
  radius: number,
  excludeTypes: string[] = [],
): CollisionResult {
  const result: CollisionResult = { blocked: false, pushX: 0, pushY: 0 };

  const allEntities = world.query(CType.Position, CType.Render);

  for (const otherId of allEntities) {
    if (otherId === entityId) continue;

    let skip = false;
    for (const excludeType of excludeTypes) {
      if (world.hasComponent(otherId, excludeType)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;

    const otherPos = world.getComponent<Position>(otherId, CType.Position);
    if (!otherPos) continue;

    const otherRadius = getEntityRadius(world, otherId);

    const dx = x - otherPos.x;
    const dy = y - otherPos.y;
    const distSq = dx * dx + dy * dy;
    const minDist = radius + otherRadius;

    if (distSq < minDist * minDist && distSq > 0.01) {
      const dist = Math.sqrt(distSq);
      const overlap = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;

      result.blocked = true;
      result.pushX += nx * overlap;
      result.pushY += ny * overlap;
    }
  }

  return result;
}

export function findAvoidanceTarget(
  world: TowerWorld,
  entityId: number,
  x: number,
  y: number,
  radius: number,
  targetX: number,
  targetY: number,
  excludeTypes: string[] = [],
): { x: number; y: number } | null {
  const allEntities = world.query(CType.Position, CType.Render);

  for (const otherId of allEntities) {
    if (otherId === entityId) continue;

    let skip = false;
    for (const excludeType of excludeTypes) {
      if (world.hasComponent(otherId, excludeType)) {
        skip = true;
        break;
      }
    }
    if (skip) continue;

    const otherPos = world.getComponent<Position>(otherId, CType.Position);
    if (!otherPos) continue;

    const otherRadius = getEntityRadius(world, otherId);

    const dx = x - otherPos.x;
    const dy = y - otherPos.y;
    const distSq = dx * dx + dy * dy;
    const minDist = radius + otherRadius + 10;

    if (distSq < minDist * minDist && distSq > 0.01) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;

      const toTargetX = targetX - x;
      const toTargetY = targetY - y;
      const toTargetLen = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

      if (toTargetLen > 0.01) {
        const dirX = toTargetX / toTargetLen;
        const dirY = toTargetY / toTargetLen;

        const perpX = -dirY;
        const perpY = dirX;

        const dot = nx * perpX + ny * perpY;

        const avoidX = otherPos.x + (radius + otherRadius + 15) * (dot > 0 ? perpX : -perpX);
        const avoidY = otherPos.y + (radius + otherRadius + 15) * (dot > 0 ? perpY : -perpY);

        return { x: avoidX, y: avoidY };
      } else {
        const avoidX = otherPos.x + nx * (radius + otherRadius + 15);
        const avoidY = otherPos.y + ny * (radius + otherRadius + 15);
        return { x: avoidX, y: avoidY };
      }
    }
  }

  return null;
}
