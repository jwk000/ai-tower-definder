// ============================================================
// Tower Defender — PixiJS Application Wrapper
//
// Design: design/12-visual-effects.md Section 2
// Stage layer hierarchy:
//   BackgroundLayer > MapLayer > EntityLayer > ProjectileLayer
//   > EffectLayer > UILayer > OverlayLayer
// ============================================================

import { Application, Container, type ColorSource } from 'pixi.js';

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

export class PixiApp {
  readonly app: Application;
  readonly stage: Container;

  // Layer containers (bottom → top)
  readonly backgroundLayer: Container;
  readonly mapLayer: Container;
  readonly entityLayer: Container;
  readonly projectileLayer: Container;
  readonly effectLayer: Container;
  readonly uiLayer: Container;
  readonly overlayLayer: Container;

  constructor(container: HTMLElement, bgColor: ColorSource = 0x1a1a2e) {
    this.app = new Application();
    this.stage = new Container();

    // Create layer hierarchy
    this.backgroundLayer = new Container({ label: 'BackgroundLayer' });
    this.mapLayer = new Container({ label: 'MapLayer' });
    this.entityLayer = new Container({ label: 'EntityLayer' });
    this.projectileLayer = new Container({ label: 'ProjectileLayer' });
    this.effectLayer = new Container({ label: 'EffectLayer' });
    this.uiLayer = new Container({ label: 'UILayer' });
    this.overlayLayer = new Container({ label: 'OverlayLayer' });

    this.stage.addChild(
      this.backgroundLayer,
      this.mapLayer,
      this.entityLayer,
      this.projectileLayer,
      this.effectLayer,
      this.uiLayer,
      this.overlayLayer,
    );
  }

  /** Initialize the PixiJS Application asynchronously */
  async init(): Promise<void> {
    await this.app.init({
      width: DESIGN_W,
      height: DESIGN_H,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: window,
    });

    document.body.appendChild(this.app.canvas);
    this.app.stage.addChild(this.stage);

    // Scale stage to fit design resolution
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
  }

  /** Scale stage to maintain design aspect ratio */
  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = DESIGN_W / DESIGN_H;

    let scale: number;
    if (w / h > aspect) {
      scale = h / DESIGN_H;
    } else {
      scale = w / DESIGN_W;
    }

    this.stage.scale.set(scale);
    this.stage.x = (w - DESIGN_W * scale) / 2;
    this.stage.y = (h - DESIGN_H * scale) / 2;
  }

  /** Sort entity layer children by Y position each frame */
  sortEntityLayer(): void {
    const children = this.entityLayer.children;
    children.sort((a, b) => a.y - b.y);
  }

  destroy(): void {
    window.removeEventListener('resize', this.resize.bind(this));
    this.app.destroy(true);
  }
}
