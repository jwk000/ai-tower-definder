import type { Game } from '../core/Game.js';

export interface EditorBootstrapDeps {
  game: Game;
  hostElement: HTMLElement;
}

export interface EditorHandle {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

export function bootstrapEditor(deps: EditorBootstrapDeps): EditorHandle {
  if (!import.meta.env.DEV) {
    throw new Error('[editor] bootstrapEditor called in production build');
  }
  return createEditorHandle(deps);
}

function createEditorHandle(deps: EditorBootstrapDeps): EditorHandle {
  const { game, hostElement } = deps;
  let open = false;
  let wasPausedBeforeOpen = false;
  hostElement.style.display = 'none';

  const handle: EditorHandle = {
    open() {
      if (open) return;
      open = true;
      wasPausedBeforeOpen = game.paused;
      game.paused = true;
      hostElement.style.display = 'block';
    },
    close() {
      if (!open) return;
      open = false;
      game.paused = wasPausedBeforeOpen;
      hostElement.style.display = 'none';
    },
    toggle() {
      if (open) handle.close();
      else handle.open();
    },
    isOpen() {
      return open;
    },
    dispose() {
      if (open) handle.close();
    },
  };

  return handle;
}

export function attachF2Hotkey(handle: EditorHandle, target: EventTarget): () => void {
  const listener = (event: Event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== 'F2') return;
    if (typeof keyEvent.preventDefault === 'function') keyEvent.preventDefault();
    handle.toggle();
  };
  target.addEventListener('keydown', listener as EventListener);
  return () => target.removeEventListener('keydown', listener as EventListener);
}
