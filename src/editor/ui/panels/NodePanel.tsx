import type { PathNode, PathEdge, PathNodeRole, SpawnPoint } from '../../../level/graph/types.js';

const EDITABLE_ROLES: PathNodeRole[] = ['waypoint', 'branch', 'portal', 'crystal_anchor'];

export interface NodePanelProps {
  node: PathNode | null;
  outEdges: PathEdge[];
  inEdges: PathEdge[];
  allNodes: PathNode[];
  spawns: SpawnPoint[];
  onSetRole: (nodeId: string, role: PathNodeRole) => void;
  onSetPortalTarget: (nodeId: string, target: string | undefined) => void;
  onRemoveEdge: (from: string, to: string) => void;
  onSetEdgeWeight: (from: string, to: string, weight: number) => void;
}

export function NodePanel({
  node,
  outEdges,
  inEdges,
  allNodes,
  onSetRole,
  onSetPortalTarget,
  onRemoveEdge,
  onSetEdgeWeight,
}: NodePanelProps) {
  if (node === null) return null;

  const isSpawn = node.role === 'spawn';
  const isPortal = node.role === 'portal';

  const portalTargetCandidates = allNodes.filter(
    (n) => n.id !== node.id && n.role !== 'portal',
  );

  return (
    <div data-testid="node-panel" style={panelStyle}>
      <div style={headerStyle}>
        <span style={idStyle}>{node.id}</span>
        <span style={coordStyle}>({node.row}, {node.col})</span>
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>角色</label>
        <select
          data-testid="node-panel-role-select"
          value={node.role}
          disabled={isSpawn}
          style={selectStyle}
          onChange={(e) => onSetRole(node.id, (e.currentTarget as HTMLSelectElement).value as PathNodeRole)}
        >
          {isSpawn ? (
            <option value="spawn">spawn</option>
          ) : (
            EDITABLE_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))
          )}
        </select>
      </div>

      {isPortal && (
        <div style={rowStyle}>
          <label style={labelStyle}>传送到</label>
          <select
            data-testid="node-panel-portal-target"
            value={node.teleportTo ?? ''}
            style={selectStyle}
            onChange={(e) => {
              const val = (e.currentTarget as HTMLSelectElement).value;
              onSetPortalTarget(node.id, val === '' ? undefined : val);
            }}
          >
            <option value="">（未设置）</option>
            {portalTargetCandidates.map((n) => (
              <option key={n.id} value={n.id}>{n.id}</option>
            ))}
          </select>
        </div>
      )}

      {outEdges.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>出边</div>
          {outEdges.map((e) => {
            const key = `${e.from}->${e.to}`;
            return (
              <div key={key} data-testid={`node-out-edge-${key}`} style={edgeRowStyle}>
                <span style={edgeToStyle}>→ {e.to}</span>
                <input
                  type="number"
                  value={e.weight ?? ''}
                  min={0}
                  placeholder="权重"
                  style={weightInputStyle}
                  onInput={(ev) => {
                    const v = parseInt((ev.currentTarget as HTMLInputElement).value, 10);
                    if (!isNaN(v)) onSetEdgeWeight(e.from, e.to, v);
                  }}
                />
                <button
                  type="button"
                  data-testid={`node-out-edge-delete-${key}`}
                  style={deleteButtonStyle}
                  onClick={() => onRemoveEdge(e.from, e.to)}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {inEdges.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>入边（只读）</div>
          {inEdges.map((e) => (
            <div key={`${e.from}->${e.to}`} style={{ ...edgeRowStyle, opacity: 0.6 }}>
              <span style={edgeToStyle}>← {e.from}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const panelStyle = {
  margin: '8px 0',
  padding: '10px 12px',
  background: '#1a2030',
  border: '1px solid #2a3a4a',
  borderRadius: 4,
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 10,
};

const idStyle = {
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: 13,
  color: '#80c0f0',
  fontWeight: 600,
};

const coordStyle = {
  fontSize: 11,
  color: '#666',
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 6,
};

const labelStyle = {
  fontSize: 11,
  color: '#a0a0b0',
  minWidth: 44,
};

const selectStyle = {
  flex: 1,
  background: '#0e0e16',
  border: '1px solid #2a2a3a',
  borderRadius: 3,
  color: '#d0d0e0',
  fontSize: 12,
  padding: '2px 4px',
};

const sectionStyle = {
  marginTop: 10,
};

const sectionTitleStyle = {
  fontSize: 11,
  color: '#888',
  marginBottom: 4,
};

const edgeRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '2px 0',
};

const edgeToStyle = {
  fontSize: 11,
  color: '#a0c8e0',
  flex: 1,
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
};

const weightInputStyle = {
  width: 52,
  background: '#0e0e16',
  border: '1px solid #2a2a3a',
  borderRadius: 3,
  color: '#d0d0e0',
  fontSize: 11,
  padding: '1px 4px',
  textAlign: 'right' as const,
};

const deleteButtonStyle = {
  background: 'transparent',
  border: '1px solid #2a2a3a',
  color: '#a04a4a',
  padding: '1px 5px',
  borderRadius: 3,
  fontSize: 11,
  cursor: 'pointer',
};
