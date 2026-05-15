import { useEffect, useMemo, useState } from 'preact/hooks';
import type { LevelEditor, LevelListEntry, EditorStatus } from '../LevelEditor.js';
import {
  parseYamlToModel,
  serializeModelToYaml,
  type LevelFormModel,
  type MapModel,
  type TileCell,
} from '../state/levelModel.js';
import { validateLevel, type ValidationError } from '../state/levelValidation.js';
import { MetadataPanel } from './panels/MetadataPanel.js';
import { StartingPanel } from './panels/StartingPanel.js';
import { AvailablePanel } from './panels/AvailablePanel.js';
import { WaveListPanel } from './panels/WaveListPanel.js';
import { WeatherPanel } from './panels/WeatherPanel.js';
import { MapToolbar, BRUSH_TILE_TYPES } from './panels/MapToolbar.js';
import { MapView } from './MapView.js';
import type { MapPreviewModel } from '../preview/MapCanvas.js';
import type { GraphModel } from '../preview/graphDrawOps.js';
import { SpawnPanel } from './panels/SpawnPanel.js';
import { addSpawn, removeSpawn, renameSpawn } from '../state/spawnOps.js';
import { GraphToolbar, type GraphTool } from './panels/GraphToolbar.js';
import { NodePanel } from './panels/NodePanel.js';
import {
  addNode,
  removeNode,
  addEdge,
  removeEdge,
  setNodeRole,
  setPortalTarget,
  setEdgeWeight,
  generateNodeId,
} from '../state/graphOps.js';
import type { PathGraph, PathNodeRole } from '../../level/graph/types.js';

type EditTab = 'form' | 'raw';

interface ParseResult {
  model: LevelFormModel | null;
  error: string | null;
}

function tryParseModel(content: string | null): ParseResult {
  if (content === null) return { model: null, error: null };
  try {
    return { model: parseYamlToModel(content), error: null };
  } catch (e) {
    return { model: null, error: e instanceof Error ? e.message : String(e) };
  }
}

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
  canMigrate: boolean;
}

function snapshot(editor: LevelEditor): ViewState {
  return {
    status: editor.status,
    list: editor.list,
    currentId: editor.currentId,
    currentContent: editor.currentContent,
    isDirty: editor.isDirty,
    lastError: editor.lastError,
    canMigrate: editor.canMigrate(),
  };
}

function tileCellToString(cell: TileCell): string {
  if (typeof cell === 'string') return cell;
  switch (cell) {
    case 0: return 'empty';
    case 1: return 'path';
    case 2: return 'blocked';
    case 3: return 'spawn';
    case 4: return 'base';
    default: return 'empty';
  }
}

function buildPreviewModel(map: MapModel): MapPreviewModel {
  const tileSize = map.tileSize > 0 ? map.tileSize : 64;
  const tiles: string[][] = map.tiles.map((row) => row.map(tileCellToString));
  return {
    cols: map.cols,
    rows: map.rows,
    tileSize,
    tiles,
  };
}

function buildGraphModel(map: MapModel): GraphModel {
  return {
    graph: map.pathGraph ?? { nodes: [], edges: [] },
    spawns: map.spawns ?? [],
    tileSize: map.tileSize > 0 ? map.tileSize : 64,
  };
}

function withTileAt(model: LevelFormModel, row: number, col: number, tile: string): LevelFormModel {
  const oldTiles = model.map.tiles;
  if (row < 0 || row >= oldTiles.length) return model;
  const oldRow = oldTiles[row];
  if (oldRow === undefined || col < 0 || col >= oldRow.length) return model;
  const newRow: TileCell[] = oldRow.slice();
  newRow[col] = tile;
  const newTiles: TileCell[][] = oldTiles.slice();
  newTiles[row] = newRow;
  return {
    ...model,
    map: { ...model.map, tiles: newTiles },
  };
}

export function EditorRoot({ editor, onClose }: EditorRootProps) {
  const [view, setView] = useState<ViewState>(() => snapshot(editor));
  const [tab, setTab] = useState<EditTab>('raw');
  const [validationState, setValidationState] = useState<{ content: string | null; errors: ValidationError[] }>({ content: null, errors: [] });
  const [brushTile, setBrushTile] = useState<string>(BRUSH_TILE_TYPES[1] ?? 'path');
  const [graphTool, setGraphTool] = useState<GraphTool>('select');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingEdgeFrom, setPendingEdgeFrom] = useState<string | null>(null);

  useEffect(() => {
    const onChange = () => setView(snapshot(editor));
    editor.addEventListener('change', onChange);
    void editor.refreshList();
    return () => editor.removeEventListener('change', onChange);
  }, [editor]);

  const parsed = useMemo<ParseResult>(
    () => tryParseModel(view.currentContent),
    [view.currentContent],
  );

  const previewModel = useMemo<MapPreviewModel>(
    () => parsed.model !== null
      ? buildPreviewModel(parsed.model.map)
      : { cols: 0, rows: 0, tileSize: 64, tiles: [] },
    [parsed.model],
  );

  const graphModel = useMemo<GraphModel | undefined>(
    () => parsed.model !== null ? buildGraphModel(parsed.model.map) : undefined,
    [parsed.model],
  );

  const onFormChange = (next: LevelFormModel): void => {
    editor.setCurrentContent(serializeModelToYaml(next));
  };

  const onTileClick = (row: number, col: number, button: number): void => {
    if (parsed.model === null) return;
    const targetTile = button === 2 ? 'empty' : brushTile;
    const currentTile = tileCellToString(parsed.model.map.tiles[row]?.[col] ?? 'empty');
    let nextMap = parsed.model.map;

    if (targetTile === 'spawn') {
      nextMap = addSpawn(nextMap, row, col);
    } else {
      if (currentTile === 'spawn') {
        const victimSpawn = nextMap.spawns?.find((s) => s.row === row && s.col === col);
        if (victimSpawn !== undefined) {
          nextMap = removeSpawn(nextMap, victimSpawn.id);
        }
      }
      nextMap = withTileAt({ ...parsed.model, map: nextMap }, row, col, targetTile).map;
    }

    editor.setCurrentContent(serializeModelToYaml({ ...parsed.model, map: nextMap }));
  };

  const applyGraphChange = (nextGraph: PathGraph): void => {
    if (parsed.model === null) return;
    const nextMap = { ...parsed.model.map, pathGraph: nextGraph };
    editor.setCurrentContent(serializeModelToYaml({ ...parsed.model, map: nextMap }));
  };

  const onNodeClick = (nodeId: string): void => {
    if (graphTool === 'select') {
      setSelectedNodeId(nodeId);
    } else if (graphTool === 'delete') {
      if (parsed.model === null) return;
      const graph = parsed.model.map.pathGraph ?? { nodes: [], edges: [] };
      applyGraphChange(removeNode(graph, nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    } else if (graphTool === 'add-edge') {
      if (pendingEdgeFrom === null) {
        setPendingEdgeFrom(nodeId);
      } else if (pendingEdgeFrom !== nodeId) {
        if (parsed.model !== null) {
          const graph = parsed.model.map.pathGraph ?? { nodes: [], edges: [] };
          try {
            applyGraphChange(addEdge(graph, { from: pendingEdgeFrom, to: nodeId }));
          } catch { /* cycle or missing node — silently skip */ }
        }
        setPendingEdgeFrom(null);
      }
    } else if (graphTool === 'mark-branch') {
      if (parsed.model === null) return;
      const graph = parsed.model.map.pathGraph ?? { nodes: [], edges: [] };
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (node !== undefined && node.role !== 'spawn' && node.role !== 'crystal_anchor') {
        applyGraphChange(setNodeRole(graph, nodeId, 'branch'));
      }
    }
  };

  const onEdgeClick = (from: string, to: string): void => {
    if (graphTool === 'delete') {
      if (parsed.model === null) return;
      const graph = parsed.model.map.pathGraph ?? { nodes: [], edges: [] };
      applyGraphChange(removeEdge(graph, from, to));
    }
  };

  const onGraphCanvasClick = (row: number, col: number): void => {
    if (graphTool === 'add-node' || graphTool === 'add-portal') {
      if (parsed.model === null) return;
      const graph = parsed.model.map.pathGraph ?? { nodes: [], edges: [] };
      const role: PathNodeRole = graphTool === 'add-portal' ? 'portal' : 'waypoint';
      const id = generateNodeId(graph.nodes.map((n) => n.id));
      applyGraphChange(addNode(graph, { id, row, col, role }));
    }
  };

  const onSetNodeRole = (nodeId: string, role: PathNodeRole): void => {
    if (parsed.model === null) return;
    const graph = parsed.model.map.pathGraph ?? { nodes: [], edges: [] };
    applyGraphChange(setNodeRole(graph, nodeId, role));
  };

  const onSetPortalTarget = (nodeId: string, target: string | undefined): void => {
    if (parsed.model === null) return;
    const graph = parsed.model.map.pathGraph ?? { nodes: [], edges: [] };
    applyGraphChange(setPortalTarget(graph, nodeId, target));
  };

  const onSetEdgeWeight = (from: string, to: string, weight: number): void => {
    if (parsed.model === null) return;
    const graph = parsed.model.map.pathGraph ?? { nodes: [], edges: [] };
    applyGraphChange(setEdgeWeight(graph, from, to, weight));
  };

  const onEdgeDelete = (from: string, to: string): void => {
    if (parsed.model === null) return;
    const graph = parsed.model.map.pathGraph ?? { nodes: [], edges: [] };
    applyGraphChange(removeEdge(graph, from, to));
  };

  const onRemoveSpawn = (spawnId: string): void => {
    if (parsed.model === null) return;
    const nextMap = removeSpawn(parsed.model.map, spawnId);
    editor.setCurrentContent(serializeModelToYaml({ ...parsed.model, map: nextMap }));
  };

  const onRenameSpawn = (spawnId: string, name: string): void => {
    if (parsed.model === null) return;
    const nextMap = renameSpawn(parsed.model.map, spawnId, name);
    editor.setCurrentContent(serializeModelToYaml({ ...parsed.model, map: nextMap }));
  };

  const onPickLevel = (id: string): void => {
    void editor.loadLevel(id);
  };

  const onEdit = (ev: Event): void => {
    const target = ev.currentTarget as HTMLTextAreaElement;
    editor.setCurrentContent(target.value);
  };

  const onSave = (): void => {
    if (parsed.model !== null) {
      const errors = validateLevel(parsed.model);
      if (errors.length > 0) {
        setValidationState({ content: view.currentContent, errors });
        return;
      }
    }
    setValidationState({ content: null, errors: [] });
    void editor.saveCurrent();
  };

  const validationErrors =
    validationState.content !== null && validationState.content === view.currentContent
      ? validationState.errors
      : [];

  const onMigrate = (): void => {
    if (!view.canMigrate) return;
    if (!window.confirm('将当前关卡的 enemyPath 迁移为图模型（spawns + pathGraph）？\n迁移结果会写入编辑器，需手动保存。')) return;
    editor.migrateCurrent();
  };

  const onDuplicate = async (): Promise<void> => {
    if (view.currentId === null) return;
    const suggested = `${view.currentId}_copy`;
    const newId = window.prompt('输入新关卡 ID（小写、数字、下划线、连字符）:', suggested);
    if (newId === null) return;
    const trimmed = newId.trim();
    if (trimmed === '') return;
    const result = await editor.duplicate(view.currentId, trimmed);
    if (result.ok) {
      await editor.refreshList();
    }
  };

  const onDelete = async (id: string): Promise<void> => {
    if (!window.confirm(`确定删除关卡 "${id}"？\n（文件会移到 .editor-trash/ 回收站）`)) return;
    const result = await editor.delete(id);
    if (result.ok) {
      await editor.refreshList();
    }
  };

  const showEditor = view.currentId !== null && view.currentContent !== null;
  const canSave = showEditor && view.isDirty && view.status !== 'saving';
  const canDuplicate = view.currentId !== null;

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
          <div style={listToolbarStyle}>
            <h3 style={sectionTitleStyle}>关卡列表</h3>
            <button
              type="button"
              onClick={() => { void onDuplicate(); }}
              disabled={!canDuplicate}
              style={{ ...duplicateButtonStyle, opacity: canDuplicate ? 1 : 0.4, cursor: canDuplicate ? 'pointer' : 'not-allowed' }}
              data-testid="editor-duplicate"
              title={canDuplicate ? '复制当前关卡' : '请先选中一个关卡'}
            >
              + 复制
            </button>
          </div>
          {view.list.length === 0 ? (
            <p style={{ color: '#888', fontSize: 13 }}>
              {view.status === 'loading' ? '加载中…' : '暂无关卡（请检查 src/config/levels/）'}
            </p>
          ) : (
            <ul style={listStyle}>
              {view.list.map((entry) => {
                const active = entry.id === view.currentId;
                return (
                  <li key={entry.id} style={listItemRowStyle}>
                    <button
                      type="button"
                      onClick={() => onPickLevel(entry.id)}
                      style={{ ...listItemButtonStyle, background: active ? '#1e3a5f' : 'transparent' }}
                      data-testid={`editor-level-item-${entry.id}`}
                    >
                      <span style={{ color: '#e0e0e0' }}>{entry.id}</span>
                      <span style={{ color: '#666', fontSize: 12, marginLeft: 8 }}>{entry.filename}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { void onDelete(entry.id); }}
                      style={deleteButtonStyle}
                      data-testid={`editor-delete-${entry.id}`}
                      title="删除（移到回收站）"
                    >
                      🗑
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
                <div style={tabGroupStyle}>
                  <button
                    type="button"
                    data-testid="editor-tab-form"
                    onClick={() => setTab('form')}
                    style={tab === 'form' ? tabButtonActiveStyle : tabButtonStyle}
                  >
                    表单
                  </button>
                  <button
                    type="button"
                    data-testid="editor-tab-raw"
                    onClick={() => setTab('raw')}
                    style={tab === 'raw' ? tabButtonActiveStyle : tabButtonStyle}
                  >
                    YAML
                  </button>
                </div>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={onMigrate}
                  disabled={!view.canMigrate}
                  style={{ ...migrateButtonStyle, opacity: view.canMigrate ? 1 : 0.4, cursor: view.canMigrate ? 'pointer' : 'not-allowed' }}
                  data-testid="editor-migrate"
                  title={view.canMigrate ? '迁移 enemyPath → spawns + pathGraph' : '无 enemyPath 或已迁移'}
                >
                  ↗ 迁移为图模型
                </button>
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
              {validationErrors.length > 0 && (
                <div style={validationPanelStyle} data-testid="editor-validation-errors">
                  <div style={validationHeaderStyle}>
                    ⚠️ 保存被阻塞：发现 {validationErrors.length} 个校验错误
                  </div>
                  <ul style={validationListStyle}>
                    {validationErrors.map((err, i) => (
                      <li
                        key={`${err.code}-${i}`}
                        data-testid={`editor-validation-error-${err.code}`}
                        style={validationItemStyle}
                      >
                        <span style={validationCodeStyle}>{err.code}</span>
                        <span style={validationMessageStyle}>{err.message}</span>
                        {err.path.length > 0 && (
                          <span style={validationPathStyle}>at {err.path.join('.')}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tab === 'raw' ? (
                <textarea
                  value={view.currentContent ?? ''}
                  onInput={onEdit}
                  style={textareaStyle}
                  spellcheck={false}
                  data-testid="editor-textarea"
                />
              ) : parsed.model === null ? (
                <div style={formErrorStyle} data-testid="editor-form-parse-error">
                  YAML 解析失败，请切回 YAML 标签页修复：
                  <pre style={formErrorPreStyle}>{parsed.error ?? '(unknown error)'}</pre>
                </div>
              ) : (
                <div style={formScrollStyle} data-testid="editor-form-container">
                  <div data-testid="panel-map">
                    <MapToolbar activeTile={brushTile} onSelectTile={setBrushTile} />
                    <GraphToolbar activeTool={graphTool} onSelectTool={setGraphTool} />
                    <MapView
                      model={previewModel}
                      onTileClick={onTileClick}
                      graphModel={graphModel}
                      onNodeClick={onNodeClick}
                      onEdgeClick={onEdgeClick}
                      onOverlayBlankClick={(px, py) => {
                        const tileSize = previewModel.tileSize > 0 ? previewModel.tileSize : 64;
                        const row = Math.floor(py / tileSize);
                        const col = Math.floor(px / tileSize);
                        onGraphCanvasClick(row, col);
                      }}
                    />
                    {selectedNodeId !== null && parsed.model !== null && (() => {
                      const graph = parsed.model.map.pathGraph ?? { nodes: [], edges: [] };
                      const selNode = graph.nodes.find((n) => n.id === selectedNodeId) ?? null;
                      const outEdges = graph.edges.filter((e) => e.from === selectedNodeId);
                      const inEdges = graph.edges.filter((e) => e.to === selectedNodeId);
                      return (
                        <NodePanel
                          node={selNode}
                          outEdges={outEdges}
                          inEdges={inEdges}
                          allNodes={graph.nodes}
                          spawns={parsed.model.map.spawns ?? []}
                          onSetRole={onSetNodeRole}
                          onSetPortalTarget={onSetPortalTarget}
                          onRemoveEdge={onEdgeDelete}
                          onSetEdgeWeight={onSetEdgeWeight}
                        />
                      );
                    })()}
                    <SpawnPanel
                      spawns={parsed.model.map.spawns ?? []}
                      onRemoveSpawn={onRemoveSpawn}
                      onRenameSpawn={onRenameSpawn}
                    />
                  </div>
                  <div data-testid="panel-metadata">
                    <MetadataPanel model={parsed.model} onChange={onFormChange} />
                  </div>
                  <div data-testid="panel-starting">
                    <StartingPanel model={parsed.model} onChange={onFormChange} />
                  </div>
                  <div data-testid="panel-available">
                    <AvailablePanel model={parsed.model} onChange={onFormChange} />
                  </div>
                  <div data-testid="panel-waves">
                    <WaveListPanel model={parsed.model} onChange={onFormChange} />
                  </div>
                  <div data-testid="panel-weather">
                    <WeatherPanel model={parsed.model} onChange={onFormChange} />
                  </div>
                </div>
              )}
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
  flex: 1,
  padding: '8px 12px',
  border: '1px solid #2a2a3a',
  borderRadius: 4,
  fontSize: 14,
  textAlign: 'left' as const,
  cursor: 'pointer',
  color: '#e0e0e0',
};

const listToolbarStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
};

const duplicateButtonStyle = {
  background: '#2a3a5a',
  border: '1px solid #3a4a7a',
  color: '#fff',
  padding: '4px 10px',
  borderRadius: 4,
  fontSize: 12,
};

const listItemRowStyle = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 4,
};

const deleteButtonStyle = {
  background: 'transparent',
  border: '1px solid #2a2a3a',
  color: '#a04a4a',
  padding: '0 8px',
  borderRadius: 4,
  fontSize: 14,
  cursor: 'pointer',
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

const migrateButtonStyle = {
  background: '#3a3a6a',
  border: '1px solid #4a4a8a',
  color: '#fff',
  padding: '6px 12px',
  borderRadius: 4,
  fontSize: 12,
  marginRight: 8,
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

const tabGroupStyle = {
  display: 'flex',
  gap: 4,
  marginLeft: 12,
};

const tabButtonStyle = {
  background: 'transparent',
  border: '1px solid #3a3a4a',
  color: '#a0a0b0',
  padding: '4px 12px',
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
};

const tabButtonActiveStyle = {
  ...tabButtonStyle,
  background: '#2a5a3a',
  border: '1px solid #3a7a4a',
  color: '#fff',
};

const formScrollStyle = {
  flex: 1,
  overflowY: 'auto' as const,
  padding: '16px',
  background: '#15151e',
};

const formErrorStyle = {
  flex: 1,
  padding: '20px',
  color: '#ffb4b4',
  background: '#2a1818',
  fontSize: 13,
};

const formErrorPreStyle = {
  marginTop: 8,
  padding: 12,
  background: '#1a0e0e',
  borderRadius: 4,
  fontSize: 12,
  whiteSpace: 'pre-wrap' as const,
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
};

const validationPanelStyle = {
  padding: '12px 16px',
  background: '#3a2018',
  borderBottom: '1px solid #5a3028',
  color: '#ffd0c0',
  fontSize: 12,
  maxHeight: 200,
  overflowY: 'auto' as const,
};

const validationHeaderStyle = {
  fontWeight: 600,
  fontSize: 13,
  marginBottom: 8,
  color: '#ffb89a',
};

const validationListStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
};

const validationItemStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'baseline',
  padding: '4px 8px',
  background: '#2a1410',
  borderRadius: 3,
};

const validationCodeStyle = {
  color: '#ff9070',
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: 11,
  fontWeight: 600,
  minWidth: 180,
};

const validationMessageStyle = {
  flex: 1,
  color: '#e8d0c8',
};

const validationPathStyle = {
  color: '#a08070',
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: 11,
};
