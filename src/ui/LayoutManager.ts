// ============================================================
// Tower Defender — LayoutManager
//
// Global singleton managing viewport dimensions, scale factor,
// and anchor-based UI positioning for adaptive/responsive layout.
// ============================================================

/** Horizontal anchor point: 0 = left edge, 0.5 = center, 1 = right edge */
export enum AnchorX {
  Left = 0,
  Center = 0.5,
  Right = 1,
}

/** Vertical anchor point: 0 = top edge, 0.5 = middle, 1 = bottom edge */
export enum AnchorY {
  Top = 0,
  Middle = 0.5,
  Bottom = 1,
}

/** Configuration for anchor-based positioning */
export interface AnchorConfig {
  anchorX: AnchorX;
  anchorY: AnchorY;
  /** Pixel offset from anchor point, in design-space units (will be scaled) */
  offsetX: number;
  /** Pixel offset from anchor point, in design-space units (will be scaled) */
  offsetY: number;
}

/**
 * Global layout manager.
 *
 * Design resolution: 1920×1080.
 * Scale factor is height-based: scale = viewportH / DESIGN_H.
 * On ultrawide (21:9) monitors, the design space is centered horizontally
 * with extra viewport space on the sides (usable by decorations/background).
 */
export class LayoutManager {
  /** Current viewport width in pixels (canvas internal resolution) */
  static viewportW = 1920;

  /** Current viewport height in pixels (canvas internal resolution) */
  static viewportH = 1080;

  /** Scale factor: viewportH / DESIGN_H (height-based uniform scale) */
  static scale = 1.0;

  /** Horizontal offset to center design space within viewport */
  static designOffsetX = 0;

  /** Vertical offset (always 0 since height-based scaling fills vertically) */
  static designOffsetY = 0;

  /** Design resolution constants */
  static readonly DESIGN_W = 1920;
  static readonly DESIGN_H = 1080;

  // ---- Lifecycle ----

  /**
   * Called on initial load and every window resize.
   * @param vw Viewport width (canvas internal resolution)
   * @param vh Viewport height (canvas internal resolution)
   */
  static update(vw: number, vh: number): void {
    LayoutManager.viewportW = vw;
    LayoutManager.viewportH = vh;
    LayoutManager.scale = vh / LayoutManager.DESIGN_H;

    // Center the design space horizontally
    const designViewportW = LayoutManager.DESIGN_W * LayoutManager.scale;
    LayoutManager.designOffsetX = Math.round((vw - designViewportW) / 2);
    LayoutManager.designOffsetY = 0;
  }

  // ---- Coordinate conversion: Design ← → Viewport ----

  /** Convert design-space X to viewport-space X */
  static scaleX(designPx: number): number {
    return Math.round(designPx * LayoutManager.scale);
  }

  /** Convert design-space Y to viewport-space Y */
  static scaleY(designPx: number): number {
    return Math.round(designPx * LayoutManager.scale);
  }

  /** Scale a size value (width/height) from design to viewport space */
  static scaleSize(designPx: number): number {
    return Math.round(designPx * LayoutManager.scale);
  }

  /** Convert viewport-space X back to design-space X */
  static toDesignX(viewportX: number): number {
    return (viewportX - LayoutManager.designOffsetX) / LayoutManager.scale;
  }

  /** Convert viewport-space Y back to design-space Y */
  static toDesignY(viewportY: number): number {
    return (viewportY - LayoutManager.designOffsetY) / LayoutManager.scale;
  }

  // ---- Anchor resolution ----

  /**
   * Resolve an anchor configuration to actual viewport-space coordinates.
   *
   * The anchor point defines a percentage position on the viewport.
   * Offsets are in design-space pixels (auto-scaled to viewport).
   *
   * Example:
   *   anchor({ anchorX: Right, anchorY: Top, offsetX: -150, offsetY: 18 })
   *   → position 150 design-px from the right edge, 18 design-px from top
   */
  static anchor(config: AnchorConfig): { x: number; y: number } {
    const x = LayoutManager.viewportW * config.anchorX + LayoutManager.scaleX(config.offsetX);
    const y = LayoutManager.viewportH * config.anchorY + LayoutManager.scaleY(config.offsetY);
    return { x: Math.round(x), y: Math.round(y) };
  }

  // ---- Convenience shortcuts ----

  /** @returns Viewport-space X from anchor config */
  static anchorX(config: AnchorConfig): number {
    return LayoutManager.anchor(config).x;
  }

  /** @returns Viewport-space Y from anchor config */
  static anchorY(config: AnchorConfig): number {
    return LayoutManager.anchor(config).y;
  }

  /** @returns Whether the viewport is wider than 16:9 (has extra horizontal space) */
  static get isUltrawide(): boolean {
    return LayoutManager.viewportW / LayoutManager.viewportH > LayoutManager.DESIGN_W / LayoutManager.DESIGN_H;
  }

  /** @returns Full design width in viewport pixels (1920 * scale) */
  static get designViewportW(): number {
    return Math.round(LayoutManager.DESIGN_W * LayoutManager.scale);
  }

  /** @returns Full design height in viewport pixels (1080 * scale) */
  static get designViewportH(): number {
    return Math.round(LayoutManager.DESIGN_H * LayoutManager.scale);
  }
}
