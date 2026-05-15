import { Application, Container, Graphics } from 'pixi.js';

export interface RendererConfig {
  readonly canvas: HTMLCanvasElement;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly cellSize: number;
}

export class Renderer {
  readonly app: Application;
  readonly mapLayer: Container;
  readonly entityLayer: Container;
  readonly projectileLayer: Container;
  readonly uiLayer: Container;
  private readonly config: RendererConfig;

  constructor(config: RendererConfig) {
    this.config = config;
    this.app = new Application();
    this.mapLayer = new Container();
    this.entityLayer = new Container();
    this.projectileLayer = new Container();
    this.uiLayer = new Container();
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
    this.app.stage.addChild(this.mapLayer, this.entityLayer, this.projectileLayer, this.uiLayer);
    this.drawGrid();
  }

  private drawGrid(): void {
    const { worldWidth, worldHeight, cellSize } = this.config;
    const grid = new Graphics();
    for (let x = 0; x <= worldWidth; x += cellSize) {
      grid.moveTo(x, 0).lineTo(x, worldHeight);
    }
    for (let y = 0; y <= worldHeight; y += cellSize) {
      grid.moveTo(0, y).lineTo(worldWidth, y);
    }
    grid.stroke({ width: 1, color: 0x222a3a, alpha: 1 });
    this.mapLayer.addChild(grid);
  }
}
