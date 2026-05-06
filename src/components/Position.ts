import type { GridPos } from '../types/index.js';
import { CType } from '../types/index.js';

export class Position {
  readonly type = CType.Position;
  x: number; // pixel center
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

export class GridOccupant {
  readonly type = CType.GridOccupant;
  gridPos: GridPos;

  constructor(row: number, col: number) {
    this.gridPos = { row, col };
  }
}
