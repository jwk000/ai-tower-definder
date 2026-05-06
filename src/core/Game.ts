import { World } from './World.js';
import { InputManager } from '../input/InputManager.js';
import { Renderer } from '../render/Renderer.js';

export class Game {
  world: World;
  input: InputManager;
  renderer: Renderer;
  /** Called after the command buffer is flushed — for UI overlay drawing */
  onPostRender: (() => void) | null = null;
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

    const deltaTime = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // 1. Begin frame — clear buffer + background
    this.renderer.beginFrame();

    // 2. Process input (consume queued events)
    this.input.flush();

    // 3. Update game logic — systems push render commands
    this.world.update(deltaTime);

    // 4. Render scene — flush command buffer to canvas
    this.renderer.endFrame();

    // 5. UI overlay — text drawn on top
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
