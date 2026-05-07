import { TileType, type MapConfig } from '../types/index.js';

/** Returns true if any of the 8 neighboring tiles of (row, col) is a Path tile. */
export function isAdjacentToPath(row: number, col: number, map: MapConfig): boolean {
  const { rows, cols, tiles } = map;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (tiles[nr]![nc] === TileType.Path) return true;
    }
  }
  return false;
}
