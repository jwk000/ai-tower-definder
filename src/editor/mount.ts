import { render, h } from 'preact';
import { EditorRoot } from './ui/EditorRoot.js';
import type { LevelEditor } from './LevelEditor.js';

export interface MountEditorRootDeps {
  host: HTMLElement;
  editor: LevelEditor;
  onClose: () => void;
}

export function mountEditorRoot(deps: MountEditorRootDeps): () => void {
  render(h(EditorRoot, { editor: deps.editor, onClose: deps.onClose }), deps.host);
  return () => render(null, deps.host);
}
