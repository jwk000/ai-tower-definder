import { render, h } from 'preact';
import { EditorRoot } from './ui/EditorRoot.js';
import type { LevelEditor } from './LevelEditor.js';
import type { Game } from '../core/Game.js';

export interface MountEditorRootDeps {
  host: HTMLElement;
  editor: LevelEditor;
  onClose: () => void;
  game?: Game;
}

export function mountEditorRoot(deps: MountEditorRootDeps): () => void {
  render(h(EditorRoot, { editor: deps.editor, onClose: deps.onClose, game: deps.game }), deps.host);
  return () => render(null, deps.host);
}
