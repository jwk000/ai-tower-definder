import { useEffect, useRef } from 'preact/hooks';
import { MapCanvas, type MapPreviewModel } from '../preview/MapCanvas.js';
import { GraphOverlay } from '../preview/GraphOverlay.js';
import type { GraphModel } from '../preview/graphDrawOps.js';

export interface MapViewProps {
  model: MapPreviewModel;
  onTileClick: (row: number, col: number, button: number) => void;
  graphModel?: GraphModel;
}

export function MapView({ model, onTileClick, graphModel }: MapViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<MapCanvas | null>(null);
  const overlayRef = useRef<GraphOverlay | null>(null);
  const clickRef = useRef(onTileClick);
  clickRef.current = onTileClick;

  const hasMap = model.rows > 0 && model.cols > 0;

  useEffect(() => {
    if (!hasMap) return;
    const host = hostRef.current;
    if (host === null) return;
    const canvas = new MapCanvas(host, {
      onTileClick: (row, col, ev) => clickRef.current(row, col, ev.button),
    });
    canvasRef.current = canvas;
    const overlay = new GraphOverlay(host);
    overlayRef.current = overlay;
    return () => {
      canvas.dispose();
      canvasRef.current = null;
      overlay.dispose();
      overlayRef.current = null;
    };
  }, [hasMap]);

  useEffect(() => {
    if (canvasRef.current === null) return;
    canvasRef.current.setModel(model);
  }, [model]);

  useEffect(() => {
    if (overlayRef.current === null) return;
    const gm = graphModel ?? { graph: { nodes: [], edges: [] }, spawns: [], tileSize: model.tileSize };
    overlayRef.current.setModel(gm, model.cols, model.rows);
  }, [graphModel, model.cols, model.rows, model.tileSize]);

  if (!hasMap) {
    return (
      <div data-testid="editor-map-empty" style={emptyStyle}>
        当前关卡尚未配置地图（map.cols / map.rows 为 0）
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      data-testid="editor-map-view"
      style={hostStyle}
    />
  );
}

const hostStyle = {
  display: 'inline-block',
  background: '#0e0e16',
  border: '1px solid #2a2a3a',
  borderRadius: 4,
  padding: 0,
  margin: '8px 12px',
  lineHeight: 0,
};

const emptyStyle = {
  padding: 16,
  margin: '8px 12px',
  background: '#1a1a2e',
  border: '1px dashed #3a3a4a',
  borderRadius: 4,
  color: '#888',
  fontSize: 13,
};
