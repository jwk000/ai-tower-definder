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
}

function snapshot(editor: LevelEditor): ViewState {
  return {
    status: editor.status,
    list: editor.list,
    currentId: editor.currentId,
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

  return (
    <div class="editor-root" style={rootStyle}>
      <header style={headerStyle}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#e0e0e0' }}>关卡编辑器</h2>
        <div style={statusStyle}>{describeStatus(view.status)}</div>
        <button type="button" onClick={onClose} style={closeButtonStyle} title="关闭 (F2 / ESC)">✕</button>
      </header>
      <section style={listSectionStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#a0a0b0' }}>关卡列表（只读）</h3>
        {view.list.length === 0 ? (
          <p style={{ color: '#888', fontSize: 13 }}>
            {view.status === 'loading' ? '加载中…' : '暂无关卡（请检查 src/config/levels/）'}
          </p>
        ) : (
          <ul style={listStyle}>
            {view.list.map((entry) => (
              <li
                key={entry.id}
                style={{
                  ...listItemStyle,
                  background: entry.id === view.currentId ? '#1e3a5f' : 'transparent',
                }}
              >
                <span style={{ color: '#e0e0e0' }}>{entry.id}</span>
                <span style={{ color: '#666', fontSize: 12, marginLeft: 8 }}>{entry.filename}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
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

const listSectionStyle = {
  flex: 1,
  overflowY: 'auto' as const,
  padding: '20px',
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
};

const listItemStyle = {
  padding: '8px 12px',
  border: '1px solid #2a2a3a',
  borderRadius: 4,
  fontSize: 14,
};
