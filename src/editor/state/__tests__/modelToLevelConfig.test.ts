import { describe, it, expect } from 'vitest';
import { modelToLevelConfig } from '../modelToLevelConfig.js';
import type { LevelFormModel } from '../levelModel.js';
import { LevelTheme, WeatherType } from '../../../types/index.js';

function makeModel(overrides: Partial<LevelFormModel> = {}): LevelFormModel {
  return {
    id: 'level_01',
    name: '平原',
    map: {
      cols: 21,
      rows: 9,
      tileSize: 64,
      tiles: [],
      spawns: [{ id: 'spawn_0', row: 0, col: 0 }],
      pathGraph: {
        nodes: [
          { id: 'n0', row: 0, col: 0, role: 'spawn', spawnId: 'spawn_0' },
          { id: 'n1', row: 8, col: 20, role: 'crystal_anchor' },
        ],
        edges: [{ from: 'n0', to: 'n1' }],
      },
    },
    waves: [
      { waveNumber: 1, spawnDelay: 0, enemies: [{ enemyType: 'goblin_grunt', count: 3, spawnInterval: 1 }] },
    ],
    ...overrides,
  };
}

describe('modelToLevelConfig', () => {
  it('maps id and name', () => {
    const cfg = modelToLevelConfig(makeModel());
    expect(cfg.id).toBe('level_01');
    expect(cfg.name).toBe('平原');
  });

  it('maps theme from model.theme string', () => {
    const cfg = modelToLevelConfig(makeModel({ theme: 'desert' }));
    expect(cfg.theme).toBe(LevelTheme.Desert);
  });

  it('defaults to Plains when theme is missing', () => {
    const cfg = modelToLevelConfig(makeModel({ theme: undefined }));
    expect(cfg.theme).toBe(LevelTheme.Plains);
  });

  it('maps description and sceneDescription', () => {
    const cfg = modelToLevelConfig(makeModel({ description: 'desc', sceneDescription: 'scene' }));
    expect(cfg.description).toBe('desc');
    expect(cfg.sceneDescription).toBe('scene');
  });

  it('maps map cols/rows/tileSize/tiles/spawns/pathGraph', () => {
    const model = makeModel();
    const cfg = modelToLevelConfig(model);
    expect(cfg.map.cols).toBe(model.map.cols);
    expect(cfg.map.rows).toBe(model.map.rows);
    expect(cfg.map.spawns).toBe(model.map.spawns);
    expect(cfg.map.pathGraph).toBe(model.map.pathGraph);
  });

  it('maps waves with enemyType strings', () => {
    const cfg = modelToLevelConfig(makeModel());
    expect(cfg.waves).toHaveLength(1);
    expect(cfg.waves[0]!.enemies[0]!.enemyType).toBe('goblin_grunt');
  });

  it('uses starting.gold for startingGold', () => {
    const cfg = modelToLevelConfig(makeModel({ starting: { gold: 350 } }));
    expect(cfg.startingGold).toBe(350);
  });

  it('defaults startingGold to 200 when starting is absent', () => {
    const cfg = modelToLevelConfig(makeModel({ starting: undefined }));
    expect(cfg.startingGold).toBe(200);
  });

  it('maps available.towers to availableTowers', () => {
    const cfg = modelToLevelConfig(makeModel({ available: { towers: ['arrow', 'cannon'], units: [] } }));
    expect(cfg.availableTowers).toContain('arrow');
    expect(cfg.availableTowers).toContain('cannon');
  });

  it('defaults availableTowers to all tower types when available is absent', () => {
    const cfg = modelToLevelConfig(makeModel({ available: undefined }));
    expect(cfg.availableTowers.length).toBeGreaterThan(0);
  });

  it('maps weather.pool to weatherPool as WeatherType array', () => {
    const cfg = modelToLevelConfig(makeModel({ weather: { pool: ['sunny', 'rain'], initial: 'sunny' } }));
    expect(cfg.weatherPool).toContain(WeatherType.Sunny);
    expect(cfg.weatherPool).toContain(WeatherType.Rain);
  });

  it('unlockStarsRequired is always 0 (no gate in editor preview)', () => {
    const cfg = modelToLevelConfig(makeModel());
    expect(cfg.unlockStarsRequired).toBe(0);
  });

  it('unlockPrevLevelId is always null (no gate in editor preview)', () => {
    const cfg = modelToLevelConfig(makeModel());
    expect(cfg.unlockPrevLevelId).toBeNull();
  });
});
