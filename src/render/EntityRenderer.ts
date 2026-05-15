import { Container, Graphics } from 'pixi.js';

import { VisualShape } from '../core/components.js';
import type { EntityViewSink, VisualSnapshot } from './RenderSystem.js';

export class EntityRenderer implements EntityViewSink {
  readonly container: Container;
  private readonly views = new Map<number, Graphics>();

  constructor(parent: Container) {
    this.container = new Container();
    this.container.sortableChildren = false;
    parent.addChild(this.container);
  }

  hasView(eid: number): boolean {
    return this.views.has(eid);
  }

  createView(eid: number, visual: VisualSnapshot): void {
    const g = new Graphics();
    drawShape(g, visual);
    this.views.set(eid, g);
    this.container.addChild(g);
  }

  updateView(eid: number, x: number, y: number): void {
    const g = this.views.get(eid);
    if (!g) return;
    g.x = x;
    g.y = y;
  }

  destroyView(eid: number): void {
    const g = this.views.get(eid);
    if (!g) return;
    this.container.removeChild(g);
    g.destroy();
    this.views.delete(eid);
  }

  sortByY(): void {
    const children = this.container.children as Graphics[];
    children.sort((a, b) => a.y - b.y);
    for (let i = 0; i < children.length; i++) {
      this.container.setChildIndex(children[i]!, i);
    }
  }
}

function drawShape(g: Graphics, visual: VisualSnapshot): void {
  const half = visual.size / 2;
  switch (visual.shape) {
    case VisualShape.Square:
      g.rect(-half, -half, visual.size, visual.size);
      break;
    case VisualShape.Triangle:
      g.moveTo(0, -half).lineTo(half, half).lineTo(-half, half).closePath();
      break;
    case VisualShape.Circle:
    default:
      g.circle(0, 0, half);
      break;
  }
  g.fill({ color: visual.color, alpha: 1 });
}
