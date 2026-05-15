// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from 'preact';
import { MapToolbar, BRUSH_TILE_TYPES } from '../MapToolbar.js';

function tile(host: HTMLElement, t: string): HTMLButtonElement {
  return host.querySelector(`[data-testid="map-toolbar-tile-${t}"]`) as HTMLButtonElement;
}

describe('MapToolbar', () => {
  let host: HTMLDivElement;
  let onSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    onSelect = vi.fn();
  });

  afterEach(() => {
    render(null, host);
    host.remove();
  });

  it('renders a button for each brushable tile type', () => {
    render(<MapToolbar activeTile="empty" onSelectTile={onSelect} />, host);

    for (const t of BRUSH_TILE_TYPES) {
      expect(tile(host, t), `missing button for ${t}`).toBeTruthy();
    }
  });

  it('marks the active tile button with aria-pressed=true', () => {
    render(<MapToolbar activeTile="path" onSelectTile={onSelect} />, host);

    expect(tile(host, 'path').getAttribute('aria-pressed')).toBe('true');
    expect(tile(host, 'empty').getAttribute('aria-pressed')).toBe('false');
    expect(tile(host, 'spawn').getAttribute('aria-pressed')).toBe('false');
  });

  it('invokes onSelectTile when a tile button is clicked', () => {
    render(<MapToolbar activeTile="empty" onSelectTile={onSelect} />, host);
    tile(host, 'path').click();
    tile(host, 'spawn').click();

    expect(onSelect).toHaveBeenNthCalledWith(1, 'path');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'spawn');
  });

  it('exposes the brushable tile set covering core map roles', () => {
    expect(BRUSH_TILE_TYPES).toEqual(
      expect.arrayContaining(['empty', 'path', 'blocked', 'spawn', 'base']),
    );
  });
});
