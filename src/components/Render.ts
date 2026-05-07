import { CType, type ShapeType } from '../types/index.js';

export class Render {
  readonly type = CType.Render;
  shape: ShapeType;
  color: string;
  size: number;
  alpha: number;
  outline: boolean;
  label: string | null;
  labelColor: string;
  labelSize: number;
  /** Used by arrow shape: direction toward target */
  targetEntityId: number | null;
  /** White flash on damage (consumed same frame by RenderSystem) */
  hitFlashTimer: number;

  constructor(
    shape: ShapeType,
    color: string,
    size: number,
  ) {
    this.shape = shape;
    this.color = color;
    this.size = size;
    this.alpha = 1;
    this.outline = false;
    this.label = null;
    this.labelColor = '#ffffff';
    this.labelSize = 12;
    this.targetEntityId = null;
    this.hitFlashTimer = 0;
  }
}
