// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { GraphToolbar, GRAPH_TOOLS, type GraphTool } from '../GraphToolbar.js';

function findByTestId<T extends HTMLElement = HTMLElement>(root: HTMLElement, id: string): T | null {
  return root.querySelector(`[data-testid="${id}"]`) as T | null;
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('GraphToolbar', () => {
  let host: HTMLDivElement;
  let onSelectTool: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    onSelectTool = vi.fn();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders a button for each graph tool', async () => {
    render(<GraphToolbar activeTool="select" onSelectTool={onSelectTool} />, host);
    await tick();
    for (const tool of GRAPH_TOOLS) {
      expect(findByTestId(host, `graph-tool-${tool}`)).not.toBeNull();
    }
  });

  it('marks the active tool button with aria-pressed=true', async () => {
    render(<GraphToolbar activeTool="add-node" onSelectTool={onSelectTool} />, host);
    await tick();
    const active = findByTestId<HTMLButtonElement>(host, 'graph-tool-add-node')!;
    expect(active.getAttribute('aria-pressed')).toBe('true');
    const other = findByTestId<HTMLButtonElement>(host, 'graph-tool-select')!;
    expect(other.getAttribute('aria-pressed')).toBe('false');
  });

  it('calls onSelectTool with the tool id when a button is clicked', async () => {
    render(<GraphToolbar activeTool="select" onSelectTool={onSelectTool} />, host);
    await tick();
    findByTestId<HTMLButtonElement>(host, 'graph-tool-add-edge')!.click();
    expect(onSelectTool).toHaveBeenCalledWith('add-edge');
  });

  it('renders 6 tools in total', async () => {
    render(<GraphToolbar activeTool="select" onSelectTool={onSelectTool} />, host);
    await tick();
    expect(GRAPH_TOOLS).toHaveLength(6);
  });
});
