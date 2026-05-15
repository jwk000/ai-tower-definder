// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { MapView } from '../MapView.js';
import type { MapPreviewModel } from '../../preview/MapCanvas.js';

function makeModel(tiles: string[][], tileSize = 10): MapPreviewModel {
  return {
    cols: tiles[0]?.length ?? 0,
    rows: tiles.length,
    tileSize,
    tiles,
  };
}

async function tick(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('MapView (Preact wrapper around MapCanvas)', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('mounts a canvas element when given a model', async () => {
    render(
      <MapView model={makeModel([['empty', 'path']])} onTileClick={vi.fn()} />,
      host,
    );
    await tick(); await tick();
    expect(host.querySelector('[data-testid="editor-map-canvas"]')).not.toBeNull();
  });

  it('resizes the canvas when the model changes (rerender)', async () => {
    const onClick = vi.fn();
    render(<MapView model={makeModel([['empty']], 8)} onTileClick={onClick} />, host);
    await tick(); await tick();
    let canvas = host.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(8);
    expect(canvas.height).toBe(8);

    render(
      <MapView model={makeModel([['empty', 'empty'], ['empty', 'empty']], 8)} onTileClick={onClick} />,
      host,
    );
    await tick(); await tick();
    canvas = host.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).toBe(16);
    expect(canvas.height).toBe(16);
  });

  it('forwards tile clicks with row/col and the mouse button', async () => {
    const onClick = vi.fn();
    render(
      <MapView model={makeModel([['empty', 'empty'], ['empty', 'empty']], 10)} onTileClick={onClick} />,
      host,
    );
    await tick(); await tick();
    const canvas = host.querySelector('canvas') as HTMLCanvasElement;
    const ev = new MouseEvent('mousedown', { button: 0 });
    Object.defineProperty(ev, 'offsetX', { value: 15 });
    Object.defineProperty(ev, 'offsetY', { value: 5 });
    canvas.dispatchEvent(ev);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(0, 1, 0);
  });

  it('removes the canvas from the host when the component is unmounted', async () => {
    render(<MapView model={makeModel([['empty']])} onTileClick={vi.fn()} />, host);
    await tick(); await tick();
    expect(host.querySelector('canvas')).not.toBeNull();
    render(null, host);
    await tick(); await tick();
    expect(host.querySelector('canvas')).toBeNull();
  });

  it('renders a placeholder when given an empty map (no rows)', async () => {
    render(<MapView model={makeModel([])} onTileClick={vi.fn()} />, host);
    await tick(); await tick();
    expect(host.querySelector('[data-testid="editor-map-empty"]')).not.toBeNull();
    expect(host.querySelector('canvas')).toBeNull();
  });
});
