import type { SpawnPoint } from '../../../level/graph/types.js';

export interface SpawnPanelProps {
  spawns: SpawnPoint[];
  onAddSpawn?: () => void;
  onRemoveSpawn: (spawnId: string) => void;
  onRenameSpawn: (spawnId: string, name: string) => void;
}

export function SpawnPanel({ spawns, onRemoveSpawn, onRenameSpawn }: SpawnPanelProps) {
  return (
    <div data-testid="spawn-panel" style={panelStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>生成口（spawn）</span>
      </div>
      {spawns.length === 0 ? (
        <div data-testid="spawn-panel-empty" style={emptyStyle}>
          暂无 spawn 生成口。在地图上刷涂 <code>spawn</code> tile 可自动新增。
        </div>
      ) : (
        <ul style={listStyle}>
          {spawns.map((s) => (
            <li key={s.id} data-testid={`spawn-row-${s.id}`} style={rowStyle}>
              <div style={rowInfoStyle}>
                <span style={idStyle}>{s.id}</span>
                <span style={coordStyle}>({s.row}, {s.col})</span>
              </div>
              <input
                type="text"
                data-testid={`spawn-name-${s.id}`}
                value={s.name ?? ''}
                placeholder="名称（可选）"
                style={nameInputStyle}
                onInput={(e) => onRenameSpawn(s.id, (e.currentTarget as HTMLInputElement).value)}
              />
              <button
                type="button"
                data-testid={`spawn-delete-${s.id}`}
                style={deleteButtonStyle}
                title="删除生成口"
                onClick={() => onRemoveSpawn(s.id)}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const panelStyle = {
  margin: '8px 0',
  padding: '10px 12px',
  background: '#1a1a2e',
  border: '1px solid #2a2a3a',
  borderRadius: 4,
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 8,
};

const titleStyle = {
  fontWeight: 600,
  fontSize: 13,
  color: '#a0c0e0',
};

const emptyStyle = {
  color: '#888',
  fontSize: 12,
  padding: '4px 0',
};

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 6,
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
};

const rowInfoStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  minWidth: 90,
};

const idStyle = {
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: 11,
  color: '#80b0d0',
};

const coordStyle = {
  fontSize: 11,
  color: '#666',
};

const nameInputStyle = {
  flex: 1,
  background: '#0e0e16',
  border: '1px solid #2a2a3a',
  borderRadius: 3,
  color: '#d0d0e0',
  fontSize: 12,
  padding: '2px 6px',
  outline: 'none',
};

const deleteButtonStyle = {
  background: 'transparent',
  border: '1px solid #2a2a3a',
  color: '#a04a4a',
  padding: '2px 6px',
  borderRadius: 3,
  fontSize: 12,
  cursor: 'pointer',
};
