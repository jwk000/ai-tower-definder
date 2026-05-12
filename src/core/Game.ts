import { TowerWorld } from './World.js';
import { InputManager } from '../input/InputManager.js';
import { Renderer } from '../render/Renderer.js';
import { LayoutManager } from '../ui/LayoutManager.js';
import { tickFrame, systemCrashed, systemStart, systemEnd } from '../utils/debugLog.js';

export class Game {
  world: TowerWorld;
  input: InputManager;
  renderer: Renderer;
  onPostRender: (() => void) | null = null;
  onUpdate: ((dt: number) => void) | null = null;
  onAfterUpdate: ((dt: number) => void) | null = null;

  /** Game speed multiplier (1.0 = normal, 2.0 = double) */
  gameSpeed: number = 1.0;
  /** Pause state — skips logic updates but still renders */
  paused: boolean = false;

  private running: boolean = false;
  private lastTime: number = 0;
  private rafId: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.world = new TowerWorld();
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

    try {
      // Advance debug log frame counter (each loop iteration = 1 frame)
      tickFrame();

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
          for (const sys of this.world.systems) {
            const t0 = performance.now();
            try {
              systemStart(sys.name);
              sys.update(this.world, dt);
              systemEnd(sys.name, performance.now() - t0);
            } catch (sysErr) {
              systemCrashed(sys.name, sysErr);
              throw new Error(`System "${sys.name}" crashed: ${String(sysErr)}`);
            }
          }
          this.world.cleanupDeadEntities();
        }
        this.onAfterUpdate?.(rawDt * this.gameSpeed);
      } else {
        this.world.update(0);
      }

      // 4. Render
      this.renderer.endFrame();

      // 5. UI overlay
      this.onPostRender?.();
    } catch (e) {
      console.error('[Game] Fatal:', String(e));
      const ctx = this.renderer.context;
      // Reset to viewport space for error overlay (covers full window)
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#c62828';
      ctx.fillRect(0, 0, LayoutManager.viewportW, 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${String(e)}`, 16, 16);
      ctx.restore();
      this.running = false;
      return;
    }

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
