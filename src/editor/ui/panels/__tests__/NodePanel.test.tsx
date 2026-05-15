// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { NodePanel } from '../NodePanel.js';
import type { PathNode, PathEdge, SpawnPoint } from '../../../../level/graph/types.js';

function findByTestId<T extends HTMLElement = HTMLElement>(root: HTMLElement, id: string): T | null {
  return root.querySelector(`[data-testid="${id}"]`) as T | null;
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

function makeNode(overrides: Partial<PathNode> = {}): PathNode {
  return { id: 'n_a', row: 1, col: 2, role: 'waypoint', ...overrides };
}

describe('NodePanel', () => {
  let host: HTMLDivElement;
  let onSetRole: ReturnType<typeof vi.fn>;
  let onSetPortalTarget: ReturnType<typeof vi.fn>;
  let onRemoveEdge: ReturnType<typeof vi.fn>;
  let onSetEdgeWeight: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    onSetRole = vi.fn();
    onSetPortalTarget = vi.fn();
    onRemoveEdge = vi.fn();
    onSetEdgeWeight = vi.fn();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  const defaultProps = () => ({
    node: makeNode(),
    outEdges: [] as PathEdge[],
    inEdges: [] as PathEdge[],
    allNodes: [makeNode()] as PathNode[],
    spawns: [] as SpawnPoint[],
    onSetRole,
    onSetPortalTarget,
    onRemoveEdge,
    onSetEdgeWeight,
  });

  it('renders null when node is null', async () => {
    render(
      <NodePanel {...defaultProps()} node={null} />,
      host,
    );
    await tick();
    expect(findByTestId(host, 'node-panel')).toBeNull();
  });

  it('renders the node id and role', async () => {
    render(<NodePanel {...defaultProps()} />, host);
    await tick();
    const panel = findByTestId(host, 'node-panel')!;
    expect(panel.textContent).toContain('n_a');
    expect(panel.textContent).toContain('waypoint');
  });

  it('shows role selector with non-spawn roles selectable', async () => {
    render(<NodePanel {...defaultProps()} />, host);
    await tick();
    expect(findByTestId(host, 'node-panel-role-select')).not.toBeNull();
  });

  it('role selector is disabled for spawn nodes', async () => {
    render(
      <NodePanel {...defaultProps()} node={makeNode({ role: 'spawn', spawnId: 'sp_a' })} />,
      host,
    );
    await tick();
    const sel = findByTestId<HTMLSelectElement>(host, 'node-panel-role-select')!;
    expect(sel.disabled).toBe(true);
  });

  it('calls onSetRole when role select changes', async () => {
    render(<NodePanel {...defaultProps()} />, host);
    await tick();
    const sel = findByTestId<HTMLSelectElement>(host, 'node-panel-role-select')!;
    sel.value = 'crystal_anchor';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSetRole).toHaveBeenCalledWith('n_a', 'crystal_anchor');
  });

  it('shows teleportTo selector for portal nodes', async () => {
    const allNodes: PathNode[] = [
      makeNode({ id: 'n_a', role: 'portal' }),
      makeNode({ id: 'n_b', row: 2, col: 2, role: 'waypoint' }),
    ];
    render(
      <NodePanel
        {...defaultProps()}
        node={makeNode({ role: 'portal' })}
        allNodes={allNodes}
      />,
      host,
    );
    await tick();
    expect(findByTestId(host, 'node-panel-portal-target')).not.toBeNull();
  });

  it('calls onSetPortalTarget when teleportTo changes', async () => {
    const allNodes: PathNode[] = [
      makeNode({ id: 'n_a', role: 'portal' }),
      makeNode({ id: 'n_b', row: 2, col: 2, role: 'waypoint' }),
    ];
    render(
      <NodePanel
        {...defaultProps()}
        node={makeNode({ role: 'portal' })}
        allNodes={allNodes}
      />,
      host,
    );
    await tick();
    const sel = findByTestId<HTMLSelectElement>(host, 'node-panel-portal-target')!;
    sel.value = 'n_b';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSetPortalTarget).toHaveBeenCalledWith('n_a', 'n_b');
  });

  it('renders out-edges list', async () => {
    const outEdges: PathEdge[] = [
      { from: 'n_a', to: 'n_b' },
      { from: 'n_a', to: 'n_c', weight: 40 },
    ];
    render(<NodePanel {...defaultProps()} outEdges={outEdges} />, host);
    await tick();
    expect(findByTestId(host, 'node-out-edge-n_a->n_b')).not.toBeNull();
    expect(findByTestId(host, 'node-out-edge-n_a->n_c')).not.toBeNull();
  });

  it('calls onRemoveEdge when edge delete button clicked', async () => {
    const outEdges: PathEdge[] = [{ from: 'n_a', to: 'n_b' }];
    render(<NodePanel {...defaultProps()} outEdges={outEdges} />, host);
    await tick();
    findByTestId<HTMLButtonElement>(host, 'node-out-edge-delete-n_a->n_b')!.click();
    expect(onRemoveEdge).toHaveBeenCalledWith('n_a', 'n_b');
  });
});
