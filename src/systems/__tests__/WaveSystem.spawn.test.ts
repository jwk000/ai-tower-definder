import { describe, it, expect, beforeEach } from 'vitest';
import { WaveSystem } from '../WaveSystem.js';
import { TowerWorld } from '../../core/World.js';
import { GamePhase, EnemyType, type WaveConfig, type MapConfig } from '../../types/index.js';
import { Position } from '../../core/components.js';
import { RenderSystem } from '../RenderSystem.js';
import { migrateEnemyPathToGraph } from '../../level/graph/migration.js';

function makeBaseMap(): Omit<MapConfig, 'spawns' | 'pathGraph'> {
  return { name: 'test', cols: 10, rows: 10, tileSize: 64, tiles: [[]] };
}

function makeSingleWave(): WaveConfig[] {
  return [{
    waveNumber: 1,
    spawnDelay: 0,
    enemies: [{ enemyType: EnemyType.Grunt, count: 1, spawnInterval: 0 }],
  }];
}

function findEnemyPosition(world: TowerWorld): { x: number; y: number } | null {
  let result: { x: number; y: number } | null = null;
  for (let eid = 0; eid < 10000; eid++) {
    if (world.hasComponent(eid, Position)) {
      result = { x: Position.x[eid]!, y: Position.y[eid]!  };
      break;
    }
  }
  return result;
}

describe('WaveSystem B.15 — spawn coords via resolveGraphFromMap (pathGraph-only)', () => {
  let phase: GamePhase;
  const getPhase = (): GamePhase => phase;
  const setPhase = (p: GamePhase): void => { phase = p; };

  beforeEach(() => {
    phase = GamePhase.Deployment;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('pathGraph migrated from waypoints: enemy spawns at head waypoint', () => {
    const world = new TowerWorld();
    const { pathGraph, spawns } = migrateEnemyPathToGraph({
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    });
    const map: MapConfig = { ...makeBaseMap(), pathGraph, spawns };
    const ws = new WaveSystem(world, map, makeSingleWave(), getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const pos = findEnemyPosition(world);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(5 * 64 + 32);
    expect(pos!.y).toBe(3 * 64 + 32);
  });

  it('explicit pathGraph: enemy spawns at spawns[0]', () => {
    const world = new TowerWorld();
    const map: MapConfig = {
      ...makeBaseMap(),
      spawns: [{ id: 'spawn_main', row: 3, col: 5 }],
      pathGraph: {
        nodes: [
          { id: 'n0', row: 3, col: 5, role: 'spawn', spawnId: 'spawn_main' },
          { id: 'n1', row: 3, col: 9, role: 'crystal_anchor' },
        ],
        edges: [{ from: 'n0', to: 'n1' }],
      },
    };
    const ws = new WaveSystem(world, map, makeSingleWave(), getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const pos = findEnemyPosition(world);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(5 * 64 + 32);
    expect(pos!.y).toBe(3 * 64 + 32);
  });

  it('throws at construction when pathGraph is missing', () => {
    const world = new TowerWorld();
    const badMap = { ...makeBaseMap() } as MapConfig;
    expect(() => new WaveSystem(world, badMap, makeSingleWave(), getPhase, setPhase)).toThrow();
  });
});
