export type GraphTool = 'select' | 'add-node' | 'add-edge' | 'delete' | 'mark-branch' | 'add-portal';

export const GRAPH_TOOLS: GraphTool[] = [
  'select',
  'add-node',
  'add-edge',
  'delete',
  'mark-branch',
  'add-portal',
];

const TOOL_LABELS: Record<GraphTool, string> = {
  'select': '选择 [1]',
  'add-node': '加节点 [2]',
  'add-edge': '加边 [3]',
  'delete': '删除 [4]',
  'mark-branch': '标分支 [5]',
  'add-portal': '传送门 [6]',
};

export interface GraphToolbarProps {
  activeTool: GraphTool;
  onSelectTool: (tool: GraphTool) => void;
}

export function GraphToolbar({ activeTool, onSelectTool }: GraphToolbarProps) {
  return (
    <div data-testid="graph-toolbar" style={containerStyle}>
      {GRAPH_TOOLS.map((tool) => (
        <button
          key={tool}
          type="button"
          data-testid={`graph-tool-${tool}`}
          aria-pressed={activeTool === tool ? 'true' : 'false'}
          onClick={() => onSelectTool(tool)}
          style={activeTool === tool ? activeButtonStyle : buttonStyle}
        >
          {TOOL_LABELS[tool]}
        </button>
      ))}
    </div>
  );
}

const containerStyle = {
  display: 'flex',
  gap: 4,
  padding: '6px 12px',
  background: '#12121e',
  borderBottom: '1px solid #2a2a3a',
  flexWrap: 'wrap' as const,
};

const buttonStyle = {
  background: 'transparent',
  border: '1px solid #3a3a4a',
  color: '#a0a0b0',
  padding: '4px 10px',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
};

const activeButtonStyle = {
  ...buttonStyle,
  background: '#1e3a5a',
  border: '1px solid #2a6a9a',
  color: '#80c0f0',
};
