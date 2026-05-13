import { useEffect, useState } from 'preact/hooks';
import type { LevelEditor, LevelListEntry, EditorStatus } from '../LevelEditor.js';

export interface EditorRootProps {
  editor: LevelEditor;
  onClose: () => void;
}

interface ViewState {
  status: EditorStatus;
  list: readonly LevelListEntry[];
  currentId: string | null;
  currentContent: string | null;
  isDirty: boolean;
  lastError: string | null;
}

function snapshot(editor: LevelEditor): ViewState {
  return {
    status: editor.status,
    list: editor.list,
    currentId: editor.currentId,
    currentContent: editor.currentContent,
    isDirty: editor.isDirty,
    lastError: editor.lastError,
  };
}

export function EditorRoot({ editor, onClose }: EditorRootProps) {
  const [view, setView] = useState<ViewState>(() => snapshot(editor));

  useEffect(() => {
    const onChange = () => setView(snapshot(editor));
    editor.addEventListener('change', onChange);
    void editor.refreshList();
    return () => editor.removeEventListener('change', onChange);
  }, [editor]);

  const onPickLevel = (id: string): void => {
    void editor.loadLevel(id);
  };

  const onEdit = (ev: Event): void => {
    const target = ev.currentTarget as HTMLTextAreaElement;
    editor.setCurrentContent(target.value);
  };

  const onSave = (): void => {
    void editor.saveCurrent();
  };

  const showEditor = view.currentId !== null && view.currentContent !== null;
  const canSave = showEditor && view.isDirty && view.status !== 'saving';

  return (
    <div class="editor-root" style={rootStyle} data-testid="editor-root">
      <header style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#e0e0e0' }}>关卡编辑器</h2>
        <div style={statusStyle} data-testid="editor-status">{describeStatus(view.status)}</div>
        <button type="button" onClick={onClose} style={closeButtonStyle} title="关闭 (F2 / ESC)" data-testid="editor-close">✕</button>
      </header>

      {view.lastError !== null && (
        <div style={errorBannerStyle} data-testid="editor-error">
          ⚠️ {view.lastError}
        </div>
      )}

      <div style={bodyStyle}>
        <section style={listSectionStyle}>
          <h3 style={sectionTitleStyle}>关卡列表</h3>
          {view.list.length === 0 ? (
            <p style={{ color: '#888', fontSize: 13 }}>
              {view.status === 'loading' ? '加载中…' : '暂无关卡（请检查 src/config/levels/）'}
            </p>
          ) : (
            <ul style={listStyle}>
              {view.list.map((entry) => {
                const active = entry.id === view.currentId;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onPickLevel(entry.id)}
                      style={{ ...listItemButtonStyle, background: active ? '#1e3a5f' : 'transparent' }}
                      data-testid={`editor-level-item-${entry.id}`}
                    >
                      <span style={{ color: '#e0e0e0' }}>{entry.id}</span>
                      <span style={{ color: '#666', fontSize: 12, marginLeft: 8 }}>{entry.filename}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section style={editSectionStyle}>
          {showEditor ? (
            <>
              <div style={editToolbarStyle}>
                <span style={{ color: '#e0e0e0', fontWeight: 600 }}>{view.currentId}</span>
                {view.isDirty && <span style={dirtyBadgeStyle} data-testid="editor-dirty">● 未保存</span>}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!canSave}
                  style={{ ...saveButtonStyle, opacity: canSave ? 1 : 0.4, cursor: canSave ? 'pointer' : 'not-allowed' }}
                  data-testid="editor-save"
                >
                  {view.status === 'saving' ? '保存中…' : '保存 (Ctrl+S)'}
                </button>
              </div>
              <textarea
                value={view.currentContent ?? ''}
                onInput={onEdit}
                style={textareaStyle}
                spellcheck={false}
                data-testid="editor-textarea"
              />
            </>
          ) : (
            <p style={{ color: '#888', fontSize: 14, padding: 20 }}>从左侧选择一个关卡开始编辑</p>
          )}
        </section>
      </div>
    </div>
  );
}

function describeStatus(status: EditorStatus): string {
  switch (status) {
    case 'loading': return '⏳ 加载中';
    case 'saving': return '💾 保存中';
    case 'error': return '⚠️ 错误';
    case 'idle': return '✓ 就绪';
  }
}

const rootStyle = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(20, 22, 32, 0.97)',
  color: '#e0e0e0',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  zIndex: 10000,
  display: 'flex',
  flexDirection: 'column' as const,
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '12px 20px',
  background: '#1e1e2e',
  borderBottom: '1px solid #3a3a4a',
};

const statusStyle = {
  flex: 1,
  fontSize: 13,
  color: '#a0a0b0',
};

const closeButtonStyle = {
  background: 'none',
  border: '1px solid #3a3a4a',
  color: '#e0e0e0',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 14,
  borderRadius: 4,
};

const errorBannerStyle = {
  padding: '8px 20px',
  background: '#5a1f1f',
  borderBottom: '1px solid #7a2a2a',
  color: '#ffb4b4',
  fontSize: 13,
};

const bodyStyle = {
  flex: 1,
  display: 'flex',
  overflow: 'hidden',
};

const listSectionStyle = {
  width: 280,
  borderRight: '1px solid #3a3a4a',
  overflowY: 'auto' as const,
  padding: '16px',
  background: '#181820',
};

const editSectionStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column' as const,
  overflow: 'hidden',
};

const sectionTitleStyle = {
  margin: '0 0 8px',
  fontSize: 14,
  color: '#a0a0b0',
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
};

const listItemButtonStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #2a2a3a',
  borderRadius: 4,
  fontSize: 14,
  textAlign: 'left' as const,
  cursor: 'pointer',
  color: '#e0e0e0',
};

const editToolbarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  background: '#1e1e2e',
  borderBottom: '1px solid #3a3a4a',
};

const dirtyBadgeStyle = {
  color: '#ffb84d',
  fontSize: 12,
};

const saveButtonStyle = {
  background: '#2a5a3a',
  border: '1px solid #3a7a4a',
  color: '#fff',
  padding: '6px 14px',
  borderRadius: 4,
  fontSize: 13,
};

const textareaStyle = {
  flex: 1,
  width: '100%',
  margin: 0,
  padding: '12px 16px',
  border: 'none',
  background: '#0e0e16',
  color: '#d0d0e0',
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: 13,
  lineHeight: 1.5,
  resize: 'none' as const,
  outline: 'none',
};
