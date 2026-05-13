import { ShapeVal } from '../core/components.js';
import type { ShapeType } from '../types/index.js';

export function shapeTypeToVal(shape: ShapeType): ShapeVal {
  switch (shape) {
    case 'rect': return ShapeVal.Rect;
    case 'circle': return ShapeVal.Circle;
    case 'triangle': return ShapeVal.Triangle;
    case 'diamond': return ShapeVal.Diamond;
    case 'hexagon': return ShapeVal.Hexagon;
    case 'arrow': return ShapeVal.Arrow;
    default: return ShapeVal.Rect;
  }
}
