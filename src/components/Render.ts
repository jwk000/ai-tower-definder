import { CType, type ShapeType } from '../types/index.js';

export class Render {
  readonly type = CType.Render;
  shape: ShapeType;
  color: string;
  size: number;
  alpha: number;
  outline: boolean;

  constructor(
    shape: ShapeType,
    color: string,
    size: number,
    alpha: number = 1,
    outline: boolean = false,
  ) {
    this.shape = shape;
    this.color = color;
    this.size = size;
    this.alpha = alpha;
    this.outline = outline;
  }
}
