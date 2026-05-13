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
  const { game } = deps;
  let open = false;
  let wasPausedBeforeOpen = false;

  const handle: EditorHandle = {
    open() {
      if (open) return;
      open = true;
      wasPausedBeforeOpen = game.paused;
      game.paused = true;
    },
    close() {
      if (!open) return;
      open = false;
      game.paused = wasPausedBeforeOpen;
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
