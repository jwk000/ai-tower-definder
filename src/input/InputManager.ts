import { InputAction, type InputEvent } from '../types/index.js';

/** Cross-platform input manager. Abstracts mouse and touch into unified InputActions. */
export class InputManager {
  private canvas: HTMLCanvasElement;
  private events: InputEvent[] = [];
  private pointerDown: boolean = false;
  private pointerX: number = 0;
  private pointerY: number = 0;

  // Callbacks — set by UI or game logic each frame
  onPointerDown: ((e: InputEvent) => void) | null = null;
  onPointerMove: ((e: InputEvent) => void) | null = null;
  onPointerUp: ((e: InputEvent) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupListeners();
  }

  private getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  private handleDown = (clientX: number, clientY: number): void => {
    const pos = this.getCanvasPos(clientX, clientY);
    this.pointerDown = true;
    this.pointerX = pos.x;
    this.pointerY = pos.y;
    this.events.push({ action: InputAction.PointerDown, x: pos.x, y: pos.y });
  };

  private handleMove = (clientX: number, clientY: number): void => {
    const pos = this.getCanvasPos(clientX, clientY);
    this.pointerX = pos.x;
    this.pointerY = pos.y;
    if (this.pointerDown) {
      this.events.push({ action: InputAction.PointerMove, x: pos.x, y: pos.y });
    }
  };

  private handleUp = (clientX: number, clientY: number): void => {
    const pos = this.getCanvasPos(clientX, clientY);
    this.pointerDown = false;
    this.events.push({ action: InputAction.PointerUp, x: pos.x, y: pos.y });
  };

  private setupListeners(): void {
    // Mouse (PC)
    this.canvas.addEventListener('mousedown', (e) => this.handleDown(e.clientX, e.clientY));
    this.canvas.addEventListener('mousemove', (e) => this.handleMove(e.clientX, e.clientY));
    this.canvas.addEventListener('mouseup', (e) => this.handleUp(e.clientX, e.clientY));

    // Touch (Mobile)
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        const t = e.touches[0]!;
        this.handleDown(t.clientX, t.clientY);
      },
      { passive: false },
    );
    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        const t = e.touches[0]!;
        this.handleMove(t.clientX, t.clientY);
      },
      { passive: false },
    );
    this.canvas.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0]!;
      this.handleUp(t.clientX, t.clientY);
    });
  }

  /** Drain queued events and dispatch to callbacks */
  flush(): void {
    for (const event of this.events) {
      switch (event.action) {
        case InputAction.PointerDown:
          this.onPointerDown?.(event);
          break;
        case InputAction.PointerMove:
          this.onPointerMove?.(event);
          break;
        case InputAction.PointerUp:
          this.onPointerUp?.(event);
          break;
      }
    }
    this.events = [];
  }

  update(_dt: number): void {
    // reserved for continuous-state tracking (e.g., hold-to-drag)
  }

  get pointerPosition(): { x: number; y: number } {
    return { x: this.pointerX, y: this.pointerY };
  }

  get isPointerDown(): boolean {
    return this.pointerDown;
  }
}
