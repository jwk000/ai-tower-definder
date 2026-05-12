// ============================================================
// Tower Defender — MissileTargeting
//
// Grid-based scoring algorithm for the Missile tower.
// Evaluates all grid positions with enemies and returns the
// best-scoring position for the missile to target.
//
// Uses dynamic scene offsets from RenderSystem + MapConfig
// to correctly convert between pixel and grid coordinates.
// ============================================================

import { TowerWorld } from '../core/World.js';
import { Position, UnitTag, Attack, Layer, LayerVal } from '../core/components.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { TOWER_CONFIGS } from '../data/gameData.js';
import { TowerType } from '../types/index.js';
import type { MapConfig } from '../types/index.js';

export interface MissileTargetResult {
  targetX: number;
  targetY: number;
  row: number;
  col: number;
  score: number;
  enemyCount: number;
}

/**
 * Evaluate all grid positions with enemies and return the best missile target.
 *
 * Uses the **actual** scene layout (computed by RenderSystem) for
 * pixel ↔ grid coordinate conversions, and derives the base position
 * from the MapConfig's enemyPath.
 *
 * Scoring factors:
 * 1. Distance to base (closer = higher) - weight 0.35
 * 2. Enemy density in blast radius - weight 0.45
 * 3. Enemy tier (isBoss ×4, others ×1) - weight 0.20
 */
export function evaluateMissileTarget(
  world: TowerWorld,
  towerId: number,
  enemyList: number[],
  map: MapConfig,
): MissileTargetResult | null {
  if (enemyList.length === 0) return null;

  // ---- v1.1: Filter out flying enemies (cantTargetFlying) ----
  // Missile is a ground-explosion weapon; flying-layer enemies are immune.
  const missileCfg = TOWER_CONFIGS[TowerType.Missile];
  const cantTargetFlying = missileCfg?.cantTargetFlying === true;
  const groundEnemyList = cantTargetFlying
    ? enemyList.filter((eid) => (Layer.value[eid] ?? LayerVal.Ground) !== LayerVal.LowAir)
    : enemyList;
  if (groundEnemyList.length === 0) return null;

  // ---- Dynamic scene layout ----
  const TILE_SIZE      = map.tileSize;
  const MAP_COLS       = map.cols;
  const MAP_ROWS       = map.rows;
  const SCENE_OFFSET_X = RenderSystem.sceneOffsetX;
  const SCENE_OFFSET_Y = RenderSystem.sceneOffsetY;

  // ---- Tower range (v1.1: 600px, no longer full-map) ----
  const towerX = Position.x[towerId] ?? 0;
  const towerY = Position.y[towerId] ?? 0;
  const TOWER_RANGE = Attack.range[towerId] ?? missileCfg?.range ?? 600;
  const TOWER_RANGE_SQ = TOWER_RANGE * TOWER_RANGE;

  // ---- Blast radius: read from tower's Attack component ----
  const towerSplashRadius = Attack.splashRadius[towerId];
  const BLAST_RADIUS = towerSplashRadius !== undefined && towerSplashRadius > 0
    ? towerSplashRadius
    : 120; // fallback

  // ---- Base position: last waypoint of enemyPath ----
  const basePos = map.enemyPath[map.enemyPath.length - 1];
  const BASE_ROW = basePos?.row ?? MAP_ROWS - 1;
  const BASE_COL = basePos?.col ?? MAP_COLS - 1;
  const MAX_PATH_DIST = MAP_COLS + MAP_ROWS;

  // ---- Grid ↔ pixel conversion ----
  const gridToPixel = (row: number, col: number) => ({
    x: SCENE_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2,
    y: SCENE_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2,
  });

  const pixelToGrid = (px: number, py: number) => ({
    row: Math.floor((py - SCENE_OFFSET_Y) / TILE_SIZE),
    col: Math.floor((px - SCENE_OFFSET_X) / TILE_SIZE),
  });

  // ---- Collect all unique grid positions that have enemies ----
  const gridPositions = new Map<string, { row: number; col: number; enemies: number[] }>();

  for (const enemyId of groundEnemyList) {
    const ex = Position.x[enemyId]!;
    const ey = Position.y[enemyId]!;
    const { row, col } = pixelToGrid(ex, ey);

    // Clamp to map bounds
    const clampedRow = Math.max(0, Math.min(MAP_ROWS - 1, row));
    const clampedCol = Math.max(0, Math.min(MAP_COLS - 1, col));

    const key = `${clampedRow},${clampedCol}`;
    if (!gridPositions.has(key)) {
      gridPositions.set(key, { row: clampedRow, col: clampedCol, enemies: [] });
    }
    gridPositions.get(key)!.enemies.push(enemyId);
  }

  // ---- Score each grid position ----
  let bestResult: MissileTargetResult | null = null;
  let bestScore = -Infinity;

  for (const [, gridData] of gridPositions) {
    const { row, col } = gridData;
    const { x: centerX, y: centerY } = gridToPixel(row, col);

    // v1.1: Range filter — skip grid cells beyond tower range
    const dxTower = centerX - towerX;
    const dyTower = centerY - towerY;
    if (dxTower * dxTower + dyTower * dyTower > TOWER_RANGE_SQ) continue;

    // Factor 1: Distance to base (0-1, closer = higher)
    const manhattanDist = Math.abs(row - BASE_ROW) + Math.abs(col - BASE_COL);
    const distanceScore = (MAX_PATH_DIST - manhattanDist) / MAX_PATH_DIST;

    // Factor 2 & 3: Count enemies in blast radius and sum tier weights
    let blastCount = 0;
    let blastTierSum = 0;
    for (const enemyId of groundEnemyList) {
      const ex = Position.x[enemyId]!;
      const ey = Position.y[enemyId]!;
      const dx = ex - centerX;
      const dy = ey - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= BLAST_RADIUS) {
        blastCount++;
        // Tier multiplier: Boss = 4, others = 1
        const isBoss = UnitTag.isBoss[enemyId] === 1 ? 4 : 1;
        blastTierSum += isBoss;
      }
    }

    const densityScore = Math.min(blastCount / 8, 1.0);
    const tierScore = blastCount > 0 ? blastTierSum / (blastCount * 4) : 0;

    // Same-grid bonus: 0.05 if there are enemies directly on this tile
    const sameGridBonus = gridData.enemies.length > 0 ? 0.05 : 0;

    // Weighted total score
    const score =
      distanceScore * 0.35 +
      densityScore * 0.45 +
      tierScore * 0.20 +
      sameGridBonus;

    if (score > bestScore) {
      bestScore = score;
      bestResult = {
        targetX: centerX,
        targetY: centerY,
        row,
        col,
        score,
        enemyCount: blastCount,
      };
    }
  }

  return bestResult;
}
