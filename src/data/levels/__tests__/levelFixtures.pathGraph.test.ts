import { describe, it, expect } from 'vitest';
import { LEVELS } from '../index.js';
import type { MapConfig } from '../../../types/index.js';

const fixtures: { name: string; map: MapConfig }[] = LEVELS.map((l) => ({
  name: l.id,
  map: l.map,
}));

describe('Level fixtures B.15 — pathGraph + spawns self-consistency (no enemyPath)', () => {
  for (const { name, map } of fixtures) {
    describe(name, () => {
      it('has a pathGraph with >=2 nodes', () => {
        expect(map.pathGraph).toBeDefined();
        expect(map.pathGraph!.nodes.length).toBeGreaterThanOrEqual(2);
      });

      it('has a spawns property with at least one spawn', () => {
        expect(map.spawns).toBeDefined();
        expect(map.spawns!.length).toBeGreaterThanOrEqual(1);
      });

      it('graph has exactly one crystal_anchor node', () => {
        const anchors = map.pathGraph!.nodes.filter((n) => n.role === 'crystal_anchor');
        expect(anchors.length).toBe(1);
      });

      it('graph has at least one spawn node, and spawns align with spawn-role nodes by row/col', () => {
        const spawnNodes = map.pathGraph!.nodes.filter((n) => n.role === 'spawn');
        expect(spawnNodes.length).toBeGreaterThanOrEqual(1);
        for (const sp of map.spawns!) {
          const node = map.pathGraph!.nodes.find(
            (n) => n.role === 'spawn' && n.row === sp.row && n.col === sp.col,
          );
          expect(node, `spawn ${sp.id} (row=${sp.row}, col=${sp.col}) has no matching spawn node`).toBeDefined();
        }
      });

      it('edges reference only existing node ids', () => {
        const ids = new Set(map.pathGraph!.nodes.map((n) => n.id));
        for (const e of map.pathGraph!.edges) {
          expect(ids.has(e.from), `edge.from ${e.from} not in nodes`).toBe(true);
          expect(ids.has(e.to), `edge.to ${e.to} not in nodes`).toBe(true);
        }
      });
    });
  }
});
