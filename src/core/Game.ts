import { World } from './World.js';
import { InputManager } from '../input/InputManager.js';
import { Renderer } from '../render/Renderer.js';

export class Game {
  world: World;
  input: InputManager;
  renderer: Renderer;
  onPostRender: (() => void) | null = null;
  onUpdate: ((dt: number) => void) | null = null;
  onAfterUpdate: (() => void) | null = null;

  /** Game speed multiplier (1.0 = normal, 2.0 = double) */
  gameSpeed: number = 1.0;
  /** Pause state — skips logic updates but still renders */
  paused: boolean = false;

  private running: boolean = false;
  private lastTime: number = 0;
  private rafId: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.world = new World();
    this.input = new InputManager(canvas);
    this.renderer = new Renderer(canvas);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    const rawDt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // 1. Begin frame
    this.renderer.beginFrame();

    // 2. Input (always processed for pause menu etc.)
    this.input.flush();

    // 3. Logic update — skip if paused, but still tick world for UI rendering
    if (!this.paused) {
      const dt = rawDt * this.gameSpeed;
      if (this.onUpdate) {
        this.onUpdate(dt);
      } else {
        this.world.update(dt);
      }
      this.onAfterUpdate?.();
    } else {
      this.world.update(0);
    }

    // 4. Render
    this.renderer.endFrame();

    // 5. UI overlay
    this.onPostRender?.();

    this.rafId = requestAnimationFrame(this.loop);
  };

  /** Override in subclass or set externally to handle rendering */
  render(_deltaTime: number): void {
    // Default: no-op — systems will push render commands to the Renderer
  }

  resize(): void {
    this.renderer.resize();
  }
}
