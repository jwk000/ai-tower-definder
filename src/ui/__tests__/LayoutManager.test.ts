import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutManager, AnchorX, AnchorY } from '../LayoutManager.js';

beforeEach(() => {
  LayoutManager.update(1920, 1080);
});

describe('LayoutManager — scale computation', () => {
  it('scale = viewportH / DESIGN_H at native 1920x1080', () => {
    LayoutManager.update(1920, 1080);
    expect(LayoutManager.scale).toBe(1.0);
    expect(LayoutManager.designOffsetX).toBe(0);
    expect(LayoutManager.designOffsetY).toBe(0);
  });

  it('scales uniformly by height when viewport is taller-than-design ratio', () => {
    LayoutManager.update(960, 540);
    expect(LayoutManager.scale).toBe(0.5);
    expect(LayoutManager.viewportW).toBe(960);
    expect(LayoutManager.viewportH).toBe(540);
  });

  it('centers design space horizontally on ultrawide viewport (21:9)', () => {
    LayoutManager.update(2520, 1080);
    expect(LayoutManager.scale).toBe(1.0);
    expect(LayoutManager.designOffsetX).toBe(300);
    expect(LayoutManager.isUltrawide).toBe(true);
  });

  it('reports isUltrawide=false on exact 16:9', () => {
    LayoutManager.update(1920, 1080);
    expect(LayoutManager.isUltrawide).toBe(false);
  });
});

describe('LayoutManager — anchor resolution', () => {
  it('resolves top-left anchor with positive offset', () => {
    const pt = LayoutManager.anchor({
      anchorX: AnchorX.Left, anchorY: AnchorY.Top, offsetX: 50, offsetY: 30,
    });
    expect(pt).toEqual({ x: 50, y: 30 });
  });

  it('resolves bottom-right anchor with negative offset', () => {
    const pt = LayoutManager.anchor({
      anchorX: AnchorX.Right, anchorY: AnchorY.Bottom, offsetX: -100, offsetY: -50,
    });
    expect(pt).toEqual({ x: 1820, y: 1030 });
  });

  it('resolves center-middle anchor at viewport midpoint', () => {
    const pt = LayoutManager.anchor({
      anchorX: AnchorX.Center, anchorY: AnchorY.Middle, offsetX: 0, offsetY: 0,
    });
    expect(pt).toEqual({ x: 960, y: 540 });
  });
});

describe('LayoutManager — design <-> viewport conversion', () => {
  it('toDesignX inverts scaleX at scale 0.5', () => {
    LayoutManager.update(960, 540);
    const designX = 800;
    const viewportX = LayoutManager.scaleX(designX) + LayoutManager.designOffsetX;
    expect(Math.round(LayoutManager.toDesignX(viewportX))).toBe(designX);
  });
});
