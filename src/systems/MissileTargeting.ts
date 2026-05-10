// ============================================================
// Tower Defender — MissileTargeting
//
// Grid-based scoring algorithm for the Missile tower.
// Evaluates all grid positions with enemies and returns the
// best-scoring position for the missile to target.
// ============================================================

import { TowerWorld } from '../core/World.js';
import { Position, UnitTag } from '../core/components.js';

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
 * Scoring factors:
 * 1. Distance to base (closer = higher) - weight 0.35
 * 2. Enemy density in blast radius - weight 0.45
 * 3. Enemy tier (isBoss ×4, others ×1) - weight 0.20
 */
export function evaluateMissileTarget(
  world: TowerWorld,
  _towerId: number,
  enemyList: number[],
): MissileTargetResult | null {
  if (enemyList.length === 0) return null;

  // Hardcoded scene layout constants (matches MAP_01 and other maps)
  // Tile size is 64, map is 21×9
  const TILE_SIZE = 64;
  const MAP_COLS = 21;
  const MAP_ROWS = 9;
  const SCENE_OFFSET_X = 288;
  const SCENE_OFFSET_Y = 216;
  const BLAST_RADIUS = 120; // missile explosion radius

  // Grid to pixel conversion
  const gridToPixel = (row: number, col: number) => ({
    x: SCENE_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2,
    y: SCENE_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2,
  });

  // Pixel to grid conversion
  const pixelToGrid = (px: number, py: number) => ({
    row: Math.floor((py - SCENE_OFFSET_Y) / TILE_SIZE),
    col: Math.floor((px - SCENE_OFFSET_X) / TILE_SIZE),
  });

  // Collect all unique grid positions that have enemies
  const gridPositions = new Map<string, { row: number; col: number; enemies: number[] }>();

  for (const enemyId of enemyList) {
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

  // Distance to base: base is approximately at (6, 20) for MAP_01
  const BASE_ROW = 6;
  const BASE_COL = 20;
  const MAX_PATH_DIST = MAP_COLS + MAP_ROWS; // 30, max possible Manhattan distance

  let bestResult: MissileTargetResult | null = null;
  let bestScore = -Infinity;

  for (const [, gridData] of gridPositions) {
    const { row, col } = gridData;
    const { x: centerX, y: centerY } = gridToPixel(row, col);

    // Factor 1: Distance to base (0-1, closer = higher)
    const manhattanDist = Math.abs(row - BASE_ROW) + Math.abs(col - BASE_COL);
    const distanceScore = (MAX_PATH_DIST - manhattanDist) / MAX_PATH_DIST;

    // Factor 2 & 3: Count enemies in blast radius and sum tier weights
    let blastCount = 0;
    let blastTierSum = 0;
    for (const enemyId of enemyList) {
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
