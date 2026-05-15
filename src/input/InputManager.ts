export interface PointerEvent {
  readonly type: 'down' | 'up' | 'move';
  readonly x: number;
  readonly y: number;
}

export type InputHandler = (event: PointerEvent) => boolean;

export type InputLayer = 'ui' | 'hand' | 'battlefield';

const LAYER_ORDER: readonly InputLayer[] = ['ui', 'hand', 'battlefield'];

export interface RegisterOptions {
  readonly replace?: boolean;
}

export class InputManager {
  private readonly queue: PointerEvent[] = [];
  private readonly handlers = new Map<InputLayer, InputHandler>();

  register(layer: InputLayer, handler: InputHandler, options?: RegisterOptions): void {
    if (this.handlers.has(layer) && !options?.replace) {
      throw new Error(`[InputManager] handler for layer "${layer}" already registered`);
    }
    this.handlers.set(layer, handler);
  }

  unregister(layer: InputLayer): void {
    this.handlers.delete(layer);
  }

  enqueue(event: PointerEvent): void {
    this.queue.push(event);
  }

  flush(): void {
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      this.dispatch(event);
    }
  }

  private dispatch(event: PointerEvent): void {
    for (const layer of LAYER_ORDER) {
      const handler = this.handlers.get(layer);
      if (!handler) continue;
      if (handler(event)) return;
    }
  }
}
