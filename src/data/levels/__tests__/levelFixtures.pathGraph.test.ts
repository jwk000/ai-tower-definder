import { describe, it, expect } from 'vitest';
import { LEVEL_01 } from '../level-01.js';
import { LEVEL_02 } from '../level-02.js';
import { LEVEL_03 } from '../level-03.js';
import { LEVEL_04 } from '../level-04.js';
import { LEVEL_05 } from '../level-05.js';
import { migrateEnemyPathToGraph } from '../../../level/graph/migration.js';
import type { MapConfig } from '../../../types/index.js';

const fixtures: { name: string; map: MapConfig }[] = [
  { name: 'level-01', map: LEVEL_01.map },
  { name: 'level-02', map: LEVEL_02.map },
  { name: 'level-03', map: LEVEL_03.map },
  { name: 'level-04', map: LEVEL_04.map },
  { name: 'level-05', map: LEVEL_05.map },
];

describe('Level fixtures B.14 — pathGraph + spawns derived from enemyPath', () => {
  for (const { name, map } of fixtures) {
    describe(name, () => {
      it('has a pathGraph property', () => {
        expect(map.pathGraph).toBeDefined();
        expect(map.pathGraph?.nodes.length ?? 0).toBeGreaterThan(0);
      });

      it('has a spawns property with at least one spawn', () => {
        expect(map.spawns).toBeDefined();
        expect(map.spawns?.length ?? 0).toBeGreaterThanOrEqual(1);
      });

      it('pathGraph equals migrateEnemyPathToGraph(enemyPath) — zero behavior drift', () => {
        const derived = migrateEnemyPathToGraph({ enemyPath: map.enemyPath });
        expect(map.pathGraph).toEqual(derived.pathGraph);
        expect(map.spawns).toEqual(derived.spawns);
      });

      it('graph has exactly one crystal_anchor at enemyPath tail', () => {
        const anchors = map.pathGraph?.nodes.filter((n) => n.role === 'crystal_anchor') ?? [];
        expect(anchors.length).toBe(1);
        const tail = map.enemyPath[map.enemyPath.length - 1]!;
        expect(anchors[0]?.row).toBe(tail.row);
        expect(anchors[0]?.col).toBe(tail.col);
      });

      it('graph has exactly one spawn node at enemyPath head', () => {
        const spawnNodes = map.pathGraph?.nodes.filter((n) => n.role === 'spawn') ?? [];
        expect(spawnNodes.length).toBe(1);
        const head = map.enemyPath[0]!;
        expect(spawnNodes[0]?.row).toBe(head.row);
        expect(spawnNodes[0]?.col).toBe(head.col);
      });
    });
  }
});
