// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  computeMapDrawOps,
  hitTestTile,
  TILE_COLORS,
  type MapPreviewModel,
} from '../MapCanvas.js';

function makeModel(tiles: string[][], tileSize = 8): MapPreviewModel {
  return {
    cols: tiles[0]?.length ?? 0,
    rows: tiles.length,
    tileSize,
    tiles,
  };
}

describe('computeMapDrawOps', () => {
  it('produces one fill op per tile, in row-major order, sized to tileSize', () => {
    const model = makeModel(
      [
        ['empty', 'path'],
        ['spawn', 'base'],
      ],
      10,
    );

    const ops = computeMapDrawOps(model);

    const fills = ops.filter((o) => o.kind === 'fill');
    expect(fills).toHaveLength(4);

    expect(fills[0]).toMatchObject({ kind: 'fill', x: 0,  y: 0,  w: 10, h: 10, color: TILE_COLORS.empty });
    expect(fills[1]).toMatchObject({ kind: 'fill', x: 10, y: 0,  w: 10, h: 10, color: TILE_COLORS.path });
    expect(fills[2]).toMatchObject({ kind: 'fill', x: 0,  y: 10, w: 10, h: 10, color: TILE_COLORS.spawn });
    expect(fills[3]).toMatchObject({ kind: 'fill', x: 10, y: 10, w: 10, h: 10, color: TILE_COLORS.base });
  });

  it('falls back to the empty color when a tile string is unknown', () => {
    const model = makeModel([['mystery']], 5);
    const ops = computeMapDrawOps(model);
    const fills = ops.filter((o) => o.kind === 'fill');
    expect(fills[0]?.color).toBe(TILE_COLORS.empty);
  });

  it('respects tileColors overrides from the model', () => {
    const model: MapPreviewModel = {
      cols: 1,
      rows: 1,
      tileSize: 4,
      tiles: [['path']],
      tileColors: { path: '#123456' },
    };
    const ops = computeMapDrawOps(model);
    const fill = ops.find((o) => o.kind === 'fill');
    expect(fill?.color).toBe('#123456');
  });

  it('emits a thin stroke op between adjacent tiles so the grid stays readable', () => {
    const model = makeModel(
      [
        ['empty', 'empty'],
        ['empty', 'empty'],
      ],
      8,
    );
    const ops = computeMapDrawOps(model);
    const strokes = ops.filter((o) => o.kind === 'stroke');
    expect(strokes.length).toBeGreaterThanOrEqual(4);
  });

  it('produces an empty op list for an empty map', () => {
    const ops = computeMapDrawOps(makeModel([]));
    expect(ops).toEqual([]);
  });
});

describe('hitTestTile', () => {
  const model = makeModel(
    [
      ['empty', 'path', 'empty'],
      ['empty', 'spawn', 'empty'],
    ],
    10,
  );

  it('maps a click inside a tile to (row, col)', () => {
    expect(hitTestTile(model, 5, 5)).toEqual({ row: 0, col: 0 });
    expect(hitTestTile(model, 15, 5)).toEqual({ row: 0, col: 1 });
    expect(hitTestTile(model, 25, 15)).toEqual({ row: 1, col: 2 });
  });

  it('returns the right tile on tile boundaries (floor semantics)', () => {
    expect(hitTestTile(model, 10, 0)).toEqual({ row: 0, col: 1 });
    expect(hitTestTile(model, 0, 10)).toEqual({ row: 1, col: 0 });
  });

  it('returns null for coordinates outside the map', () => {
    expect(hitTestTile(model, -1, 5)).toBeNull();
    expect(hitTestTile(model, 5, -1)).toBeNull();
    expect(hitTestTile(model, 30, 5)).toBeNull();
    expect(hitTestTile(model, 5, 20)).toBeNull();
  });

  it('returns null for an empty map', () => {
    expect(hitTestTile(makeModel([]), 0, 0)).toBeNull();
  });
});

describe('MapCanvas (DOM integration)', () => {
  it('attaches a canvas element to the host on mount and removes it on dispose', async () => {
    const { MapCanvas } = await import('../MapCanvas.js');
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      const canvas = new MapCanvas(host);
      expect(host.querySelector('canvas')).not.toBeNull();
      canvas.dispose();
      expect(host.querySelector('canvas')).toBeNull();
    } finally {
      host.remove();
    }
  });

  it('sizes the canvas to cols*tileSize × rows*tileSize when a model is set', async () => {
    const { MapCanvas } = await import('../MapCanvas.js');
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      const canvas = new MapCanvas(host);
      canvas.setModel(makeModel([['empty', 'path'], ['empty', 'empty']], 16));
      const el = host.querySelector('canvas') as HTMLCanvasElement;
      expect(el.width).toBe(32);
      expect(el.height).toBe(32);
      canvas.dispose();
    } finally {
      host.remove();
    }
  });

  it('invokes onTileClick with the row/col under the pointer on a left click', async () => {
    const { MapCanvas } = await import('../MapCanvas.js');
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      const seen: Array<{ row: number; col: number; button: number }> = [];
      const canvas = new MapCanvas(host, {
        onTileClick: (row, col, ev) => seen.push({ row, col, button: ev.button }),
      });
      canvas.setModel(makeModel([['empty', 'empty'], ['empty', 'empty']], 10));

      const el = host.querySelector('canvas') as HTMLCanvasElement;
      // happy-dom always reports getBoundingClientRect as zeros; offsetX/Y on
      // the event is what MapCanvas reads, so dispatch a MouseEvent with those.
      const ev = new MouseEvent('mousedown', { button: 0, clientX: 15, clientY: 5 });
      Object.defineProperty(ev, 'offsetX', { value: 15 });
      Object.defineProperty(ev, 'offsetY', { value: 5 });
      el.dispatchEvent(ev);

      expect(seen).toEqual([{ row: 0, col: 1, button: 0 }]);
      canvas.dispose();
    } finally {
      host.remove();
    }
  });

  it('does not invoke onTileClick for clicks outside the map area', async () => {
    const { MapCanvas } = await import('../MapCanvas.js');
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      const seen: Array<{ row: number; col: number }> = [];
      const canvas = new MapCanvas(host, {
        onTileClick: (row, col) => seen.push({ row, col }),
      });
      canvas.setModel(makeModel([['empty']], 10));

      const el = host.querySelector('canvas') as HTMLCanvasElement;
      const ev = new MouseEvent('mousedown', { button: 0 });
      Object.defineProperty(ev, 'offsetX', { value: 999 });
      Object.defineProperty(ev, 'offsetY', { value: 999 });
      el.dispatchEvent(ev);

      expect(seen).toEqual([]);
      canvas.dispose();
    } finally {
      host.remove();
    }
  });
});
