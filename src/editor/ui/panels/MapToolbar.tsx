import { TILE_COLORS } from '../../preview/MapCanvas.js';

export const BRUSH_TILE_TYPES: ReadonlyArray<string> = ['empty', 'path', 'blocked', 'spawn', 'base'];

const TILE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  empty: '空地',
  path: '路径',
  blocked: '障碍',
  spawn: '生成口',
  base: '水晶',
});

export interface MapToolbarProps {
  activeTile: string;
  onSelectTile: (tile: string) => void;
}

export function MapToolbar({ activeTile, onSelectTile }: MapToolbarProps) {
  return (
    <div class="editor-map-toolbar" data-testid="map-toolbar" style={containerStyle}>
      <span style={titleStyle}>笔刷:</span>
      {BRUSH_TILE_TYPES.map((tile) => {
        const isActive = tile === activeTile;
        return (
          <button
            type="button"
            key={tile}
            data-testid={`map-toolbar-tile-${tile}`}
            aria-pressed={isActive}
            onClick={() => onSelectTile(tile)}
            style={{ ...buttonStyle, ...(isActive ? activeButtonStyle : {}) }}
            title={TILE_LABELS[tile] ?? tile}
          >
            <span
              aria-hidden="true"
              style={{ ...swatchStyle, background: TILE_COLORS[tile] ?? '#888' }}
            />
            <span>{TILE_LABELS[tile] ?? tile}</span>
          </button>
        );
      })}
    </div>
  );
}

const containerStyle = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  padding: '8px 12px',
  background: '#15151e',
  borderBottom: '1px solid #3a3a4a',
};

const titleStyle = {
  fontSize: 12,
  color: '#a0a0b0',
  marginRight: 6,
};

const buttonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  background: '#1e1e2e',
  border: '1px solid #3a3a4a',
  borderRadius: 4,
  fontSize: 12,
  color: '#e0e0e0',
  cursor: 'pointer',
};

const activeButtonStyle = {
  background: '#2a5a3a',
  border: '1px solid #3a7a4a',
};

const swatchStyle = {
  display: 'inline-block',
  width: 14,
  height: 14,
  border: '1px solid #00000040',
  borderRadius: 2,
};
