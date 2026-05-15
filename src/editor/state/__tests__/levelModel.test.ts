import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { parseYamlToModel, serializeModelToYaml } from '../levelModel.js';

const LEVELS_DIR = resolve(import.meta.dirname, '../../../config/levels');

function loadLevelYaml(filename: string): string {
  return readFileSync(resolve(LEVELS_DIR, filename), 'utf8');
}

function deepEqualParsed(original: string, roundtripped: string): void {
  const a = yamlLoad(original);
  const b = yamlLoad(roundtripped);
  expect(b).toEqual(a);
}

describe('parseYamlToModel / serializeModelToYaml round-trip', () => {
  const levels = [
    { filename: 'level-01.yaml', label: 'L1 平原（flat root）' },
    { filename: 'level-02.yaml', label: 'L2 沙漠（flat root）' },
    { filename: 'level-03.yaml', label: 'L3 冰原（flat root）' },
    { filename: 'level-04.yaml', label: 'L4 火山（flat root）' },
    { filename: 'level-05.yaml', label: 'L5 城堡（wrapped root）' },
  ];

  for (const { filename, label } of levels) {
    it(`${label} — parse→serialize preserves all data fields`, () => {
      const original = loadLevelYaml(filename);
      const model = parseYamlToModel(original);
      const roundtripped = serializeModelToYaml(model);
      deepEqualParsed(original, roundtripped);
    });
  }

  it('L5 wrapped root is preserved (__wrapped flag)', () => {
    const yaml = loadLevelYaml('level-05.yaml');
    const model = parseYamlToModel(yaml);
    expect(model.__wrapped).toBe(true);
    const out = serializeModelToYaml(model);
    const parsed = yamlLoad(out) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['L5_castle']);
  });

  it('model id matches YAML id field', () => {
    const yaml = loadLevelYaml('level-01.yaml');
    const model = parseYamlToModel(yaml);
    expect(model.id).toBe('level_01');
  });

  it('all L1-L5 models have pathGraph with nodes and edges', () => {
    for (const { filename } of levels) {
      const model = parseYamlToModel(loadLevelYaml(filename));
      expect(model.map.pathGraph, `${filename} missing pathGraph`).toBeTruthy();
      expect(model.map.pathGraph!.nodes.length, `${filename} pathGraph has no nodes`).toBeGreaterThan(0);
      expect(model.map.pathGraph!.edges.length, `${filename} pathGraph has no edges`).toBeGreaterThan(0);
    }
  });

  it('all L1-L5 models have at least one spawn point', () => {
    for (const { filename } of levels) {
      const model = parseYamlToModel(loadLevelYaml(filename));
      expect(model.map.spawns, `${filename} missing spawns`).toBeTruthy();
      expect(model.map.spawns!.length, `${filename} spawns empty`).toBeGreaterThan(0);
    }
  });

  it('all L1-L5 models have at least one wave', () => {
    for (const { filename } of levels) {
      const model = parseYamlToModel(loadLevelYaml(filename));
      expect(model.waves.length, `${filename} has no waves`).toBeGreaterThan(0);
    }
  });

  it('L3 冰原 — has at least 1 spawn point', () => {
    const model = parseYamlToModel(loadLevelYaml('level-03.yaml'));
    expect(model.map.spawns!.length).toBeGreaterThanOrEqual(1);
  });

  it('parse then serialize then parse — model is structurally identical', () => {
    for (const { filename } of levels) {
      const original = loadLevelYaml(filename);
      const model1 = parseYamlToModel(original);
      const yaml2 = serializeModelToYaml(model1);
      const model2 = parseYamlToModel(yaml2);

      expect(model2.id, filename).toBe(model1.id);
      expect(model2.name, filename).toBe(model1.name);
      expect(model2.waves.length, filename).toBe(model1.waves.length);
      expect(model2.map.pathGraph?.nodes.length, filename).toBe(model1.map.pathGraph?.nodes.length);
      expect(model2.map.pathGraph?.edges.length, filename).toBe(model1.map.pathGraph?.edges.length);
      expect(model2.map.spawns?.length, filename).toBe(model1.map.spawns?.length);
    }
  });
});
