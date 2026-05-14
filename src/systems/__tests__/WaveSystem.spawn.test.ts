import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WaveSystem } from '../WaveSystem.js';
import { TowerWorld } from '../../core/World.js';
import { GamePhase, EnemyType, type WaveConfig, type MapConfig } from '../../types/index.js';
import { Position } from '../../core/components.js';
import { RenderSystem } from '../RenderSystem.js';

function makeBaseMap(): Omit<MapConfig, 'enemyPath' | 'spawns' | 'pathGraph'> {
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

describe('WaveSystem: spawn coords via resolveGraphFromMap', () => {
  let phase: GamePhase;
  const getPhase = (): GamePhase => phase;
  const setPhase = (p: GamePhase): void => { phase = p; };

  beforeEach(() => {
    phase = GamePhase.Deployment;
    RenderSystem.sceneOffsetX = 0;
    RenderSystem.sceneOffsetY = 0;
  });

  it('legacy enemyPath: enemy spawns at enemyPath[0]', () => {
    const world = new TowerWorld();
    const map: MapConfig = {
      ...makeBaseMap(),
      enemyPath: [{ row: 3, col: 5 }, { row: 3, col: 9 }],
    };
    const ws = new WaveSystem(world, map, makeSingleWave(), getPhase, setPhase);
    ws.startWave();
    for (let i = 0; i < 5; i++) ws.update(world, 0.1);

    const pos = findEnemyPosition(world);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(5 * 64 + 32);
    expect(pos!.y).toBe(3 * 64 + 32);
  });

  it('new pathGraph format: enemy spawns at spawns[0]', () => {
    const world = new TowerWorld();
    const map: MapConfig = {
      ...makeBaseMap(),
      enemyPath: [{ row: 99, col: 99 }, { row: 99, col: 100 }],
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

  it('both formats with same head position produce identical spawn coords', () => {
    const head = { row: 4, col: 7 };

    const worldA = new TowerWorld();
    const mapA: MapConfig = { ...makeBaseMap(), enemyPath: [head, { row: 4, col: 9 }] };
    const wsA = new WaveSystem(worldA, mapA, makeSingleWave(), getPhase, setPhase);
    wsA.startWave();
    for (let i = 0; i < 5; i++) wsA.update(worldA, 0.1);
    const posA = findEnemyPosition(worldA);

    const worldB = new TowerWorld();
    const mapB: MapConfig = {
      ...makeBaseMap(),
      enemyPath: [head, { row: 4, col: 9 }],
      spawns: [{ id: 'spawn_0', ...head }],
      pathGraph: {
        nodes: [
          { id: 'n0', ...head, role: 'spawn', spawnId: 'spawn_0' },
          { id: 'n1', row: 4, col: 9, role: 'crystal_anchor' },
        ],
        edges: [{ from: 'n0', to: 'n1' }],
      },
    };
    const wsB = new WaveSystem(worldB, mapB, makeSingleWave(), getPhase, setPhase);
    wsB.startWave();
    for (let i = 0; i < 5; i++) wsB.update(worldB, 0.1);
    const posB = findEnemyPosition(worldB);

    expect(posA).not.toBeNull();
    expect(posB).not.toBeNull();
    expect(posA!.x).toBe(posB!.x);
    expect(posA!.y).toBe(posB!.y);
  });

  it('throws at construction when both enemyPath empty and no pathGraph', () => {
    const world = new TowerWorld();
    const badMap = { ...makeBaseMap(), enemyPath: [] } as unknown as MapConfig;
    expect(() => new WaveSystem(world, badMap, makeSingleWave(), getPhase, setPhase)).toThrow();
  });
});
