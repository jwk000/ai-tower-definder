import { Application, Graphics } from 'pixi.js';

export interface RendererConfig {
  readonly canvas: HTMLCanvasElement;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly cellSize: number;
}

export class Renderer {
  readonly app: Application;
  private readonly config: RendererConfig;

  constructor(config: RendererConfig) {
    this.config = config;
    this.app = new Application();
  }

  async init(): Promise<void> {
    await this.app.init({
      canvas: this.config.canvas,
      width: this.config.worldWidth,
      height: this.config.worldHeight,
      background: 0x000000,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
    });
    this.drawGrid();
  }

  private drawGrid(): void {
    const { worldWidth, worldHeight, cellSize } = this.config;
    const grid = new Graphics();
    const lineColor = 0x222a3a;
    const lineAlpha = 1;
    for (let x = 0; x <= worldWidth; x += cellSize) {
      grid.moveTo(x, 0).lineTo(x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += cellSize) {
      grid.moveTo(0, y).lineTo(worldWidth, y);
    }
    grid.stroke({ width: 1, color: lineColor, alpha: lineAlpha });
    this.app.stage.addChild(grid);
  }
}
