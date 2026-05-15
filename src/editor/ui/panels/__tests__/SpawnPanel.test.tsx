// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { SpawnPanel } from '../SpawnPanel.js';
import type { SpawnPoint } from '../../../../level/graph/types.js';

function findByTestId<T extends HTMLElement = HTMLElement>(root: HTMLElement, id: string): T | null {
  return root.querySelector(`[data-testid="${id}"]`) as T | null;
}

function findAllByTestId<T extends HTMLElement = HTMLElement>(root: HTMLElement, prefix: string): T[] {
  return Array.from(root.querySelectorAll(`[data-testid^="${prefix}"]`)) as T[];
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

function makeSpawns(n: number): SpawnPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `spawn_${String.fromCharCode(97 + i)}`,
    row: i,
    col: 0,
    name: `生成口 ${i + 1}`,
  }));
}

describe('SpawnPanel', () => {
  let host: HTMLDivElement;
  let onAddSpawn: ReturnType<typeof vi.fn>;
  let onRemoveSpawn: ReturnType<typeof vi.fn>;
  let onRenameSpawn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    onAddSpawn = vi.fn();
    onRemoveSpawn = vi.fn();
    onRenameSpawn = vi.fn();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders an empty state message when there are no spawns', async () => {
    render(
      <SpawnPanel
        spawns={[]}
        onAddSpawn={onAddSpawn}
        onRemoveSpawn={onRemoveSpawn}
        onRenameSpawn={onRenameSpawn}
      />,
      host,
    );
    await tick();
    expect(findByTestId(host, 'spawn-panel')).not.toBeNull();
    expect(findByTestId(host, 'spawn-panel-empty')).not.toBeNull();
  });

  it('renders a row for each spawn with id, row, col info', async () => {
    const spawns = makeSpawns(2);
    render(
      <SpawnPanel
        spawns={spawns}
        onAddSpawn={onAddSpawn}
        onRemoveSpawn={onRemoveSpawn}
        onRenameSpawn={onRenameSpawn}
      />,
      host,
    );
    await tick();
    const rows = findAllByTestId(host, 'spawn-row-');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('spawn_a');
    expect(rows[1]?.textContent).toContain('spawn_b');
  });

  it('each row shows row/col coordinates', async () => {
    const spawns: SpawnPoint[] = [{ id: 'spawn_a', row: 3, col: 7, name: '北口' }];
    render(
      <SpawnPanel
        spawns={spawns}
        onAddSpawn={onAddSpawn}
        onRemoveSpawn={onRemoveSpawn}
        onRenameSpawn={onRenameSpawn}
      />,
      host,
    );
    await tick();
    const row = findByTestId(host, 'spawn-row-spawn_a');
    expect(row?.textContent).toContain('3');
    expect(row?.textContent).toContain('7');
  });

  it('calls onRemoveSpawn with the spawn id when the delete button is clicked', async () => {
    const spawns = makeSpawns(1);
    render(
      <SpawnPanel
        spawns={spawns}
        onAddSpawn={onAddSpawn}
        onRemoveSpawn={onRemoveSpawn}
        onRenameSpawn={onRenameSpawn}
      />,
      host,
    );
    await tick();
    findByTestId<HTMLButtonElement>(host, 'spawn-delete-spawn_a')!.click();
    expect(onRemoveSpawn).toHaveBeenCalledWith('spawn_a');
  });

  it('calls onRenameSpawn when the name input changes', async () => {
    const spawns: SpawnPoint[] = [{ id: 'spawn_a', row: 0, col: 0, name: '原名' }];
    render(
      <SpawnPanel
        spawns={spawns}
        onAddSpawn={onAddSpawn}
        onRemoveSpawn={onRemoveSpawn}
        onRenameSpawn={onRenameSpawn}
      />,
      host,
    );
    await tick();
    const input = findByTestId<HTMLInputElement>(host, 'spawn-name-spawn_a')!;
    input.value = '新名';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onRenameSpawn).toHaveBeenCalledWith('spawn_a', '新名');
  });

  it('shows a hint about clicking on the map to add spawns', async () => {
    render(
      <SpawnPanel
        spawns={[]}
        onAddSpawn={onAddSpawn}
        onRemoveSpawn={onRemoveSpawn}
        onRenameSpawn={onRenameSpawn}
      />,
      host,
    );
    await tick();
    const panel = findByTestId(host, 'spawn-panel');
    expect(panel?.textContent).toContain('spawn');
  });
});
