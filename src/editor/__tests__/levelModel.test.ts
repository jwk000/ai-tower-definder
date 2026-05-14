// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { parseYamlToModel, serializeModelToYaml, type LevelFormModel } from '../state/levelModel.js';

const LEVELS_DIR = resolve(__dirname, '../../config/levels');

function listLevelFiles(): string[] {
  return readdirSync(LEVELS_DIR)
    .filter((f) => f.endsWith('.yaml'))
    .sort();
}

function readYaml(filename: string): string {
  return readFileSync(resolve(LEVELS_DIR, filename), 'utf-8');
}

describe('levelModel: parseYamlToModel', () => {
  it('parses level_01.yaml into a model with all known fields', () => {
    const yaml = readYaml('level-01.yaml');
    const model = parseYamlToModel(yaml);

    expect(model.id).toBe('level_01');
    expect(model.name).toBe('平原');
    expect(model.description).toContain('青翠的草原');
    expect(model.sceneDescription).toContain('广袤的草原');
    expect(model.waves.length).toBeGreaterThan(0);
    expect(model.starting?.gold).toBe(200);
    expect(model.starting?.energy).toBe(50);
    expect(model.starting?.maxPopulation).toBe(6);
    expect(model.available?.towers).toEqual(['arrow', 'cannon']);
    expect(model.available?.units).toEqual([]);
    expect(model.weather?.pool).toEqual(['sunny', 'rain', 'fog']);
    expect(model.weather?.initial).toBe('random_from_pool');
    expect(model.banPool).toEqual([]);
    expect(model.neutralPool).toEqual([]);
  });

  it('preserves map.tiles dimensions for all 5 levels', () => {
    for (const file of listLevelFiles()) {
      const yaml = readYaml(file);
      const model = parseYamlToModel(yaml);
      expect(model.map.rows, `${file} rows`).toBe(9);
      expect(model.map.cols, `${file} cols`).toBe(21);
      expect(model.map.tiles.length, `${file} tiles outer length`).toBe(9);
      expect(model.map.tiles[0]?.length, `${file} tiles inner length`).toBe(21);
    }
  });

  it('preserves pathGraph nodes and edges for all 5 levels', () => {
    for (const file of listLevelFiles()) {
      const yaml = readYaml(file);
      const model = parseYamlToModel(yaml);
      expect(model.map.pathGraph?.nodes.length, `${file} nodes`).toBeGreaterThan(0);
      expect(model.map.pathGraph?.edges.length, `${file} edges`).toBeGreaterThan(0);
    }
  });

  it('parses extras transparently for forward compat', () => {
    const yaml = readYaml('level-01.yaml');
    const model = parseYamlToModel(yaml);
    expect(model.banPool).toBeDefined();
    expect(model.neutralPool).toBeDefined();
  });
});

describe('levelModel: serializeModelToYaml', () => {
  it('round-trips all 5 level fixtures with no semantic loss', () => {
    for (const file of listLevelFiles()) {
      const original = readYaml(file);
      const model = parseYamlToModel(original);
      const out = serializeModelToYaml(model);

      const left = parseYaml(original);
      const right = parseYaml(out);
      expect(right, `${file} round-trip mismatch`).toEqual(left);
    }
  });

  it('produces deterministic output (same model → same YAML)', () => {
    const yaml = readYaml('level-01.yaml');
    const model = parseYamlToModel(yaml);
    const a = serializeModelToYaml(model);
    const b = serializeModelToYaml(model);
    expect(a).toBe(b);
  });

  it('emits top-level keys in canonical order', () => {
    const yaml = readYaml('level-01.yaml');
    const model = parseYamlToModel(yaml);
    const out = serializeModelToYaml(model);

    const lines = out.split('\n');
    const topLevelKeys = lines
      .filter((line) => /^[a-zA-Z]/.test(line))
      .map((line) => line.split(':')[0]!.trim());

    const expectedOrder = [
      'id',
      'name',
      'description',
      'sceneDescription',
      'map',
      'waves',
      'starting',
      'available',
      'weather',
      'banPool',
      'neutralPool',
    ];

    // For each expected key that exists in the YAML, its position should follow the canonical order
    const seen = expectedOrder.filter((k) => topLevelKeys.includes(k));
    const indices = seen.map((k) => topLevelKeys.indexOf(k));
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });
});

describe('levelModel: model mutation API', () => {
  it('allows mutating model.name and re-serializing without losing other fields', () => {
    const yaml = readYaml('level-01.yaml');
    const model = parseYamlToModel(yaml);
    const mutated: LevelFormModel = { ...model, name: '改名后的平原' };
    const out = serializeModelToYaml(mutated);

    const reparsed = parseYamlToModel(out);
    expect(reparsed.name).toBe('改名后的平原');
    expect(reparsed.id).toBe('level_01');
    expect(reparsed.waves.length).toBe(model.waves.length);
  });

  it('allows mutating starting.gold without dropping starting.energy/maxPopulation', () => {
    const yaml = readYaml('level-01.yaml');
    const model = parseYamlToModel(yaml);
    const mutated: LevelFormModel = {
      ...model,
      starting: { ...model.starting!, gold: 999 },
    };
    const out = serializeModelToYaml(mutated);

    const reparsed = parseYamlToModel(out);
    expect(reparsed.starting?.gold).toBe(999);
    expect(reparsed.starting?.energy).toBe(50);
    expect(reparsed.starting?.maxPopulation).toBe(6);
  });

  it('round-trips after adding a new wave', () => {
    const yaml = readYaml('level-01.yaml');
    const model = parseYamlToModel(yaml);
    const newWave = {
      waveNumber: 99,
      spawnDelay: 5,
      enemies: [{ enemyType: 'grunt' as const, count: 3, spawnInterval: 1 }],
    };
    const mutated: LevelFormModel = { ...model, waves: [...model.waves, newWave] };
    const out = serializeModelToYaml(mutated);
    const reparsed = parseYamlToModel(out);
    expect(reparsed.waves.length).toBe(model.waves.length + 1);
    expect(reparsed.waves.at(-1)?.waveNumber).toBe(99);
  });
});
