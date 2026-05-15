import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';

import { parseCardConfig, parseLevelConfig, parseUnitConfig } from '../config/loader.js';
import { spawnUnit } from '../factories/UnitFactory.js';
import { createTowerWorld } from '../core/World.js';
import { Health, Position, UnitTag } from '../core/components.js';

const VFX_STUBS = [
  'leave_ruins',
  'play_effect',
  'play_sound',
  'flash_color',
  'spawn_projectile',
  'spawn_lightning_bolt',
  'spawn_laser_beam',
  'spawn_bat_swarm',
  'drop_gold',
];

function withVfxStubs<W extends ReturnType<typeof createTowerWorld>>(world: W): W {
  for (const name of VFX_STUBS) world.ruleEngine.registerHandler(name, () => {});
  return world;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG = resolve(HERE, '..', 'config');

function loadDocs(rel: string): unknown[] {
  const text = readFileSync(resolve(CONFIG, rel), 'utf8');
  return yaml.loadAll(text);
}

function findEntry(docs: unknown[], id: string): unknown {
  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;
    const map = doc as Record<string, unknown>;
    if (map[id]) return map[id];
    if ((map['id'] ?? null) === id) return map;
  }
  return undefined;
}

function dumpEntry(entry: unknown): string {
  return yaml.dump(entry, { lineWidth: -1 });
}

describe('real YAML files: units/towers.yaml -> parseUnitConfig', () => {
  it('loads arrow_tower with the MVP fields populated', () => {
    const docs = loadDocs('units/towers.yaml');
    const arrow = findEntry(docs, 'arrow_tower');
    expect(arrow).toBeDefined();
    const cfg = parseUnitConfig(dumpEntry(arrow));
    expect(cfg.id).toBe('arrow_tower');
    expect(cfg.category).toBe('Tower');
    expect(cfg.faction).toBe('Player');
    expect(cfg.stats.range).toBeGreaterThan(0);
    expect(cfg.stats.speed).toBe(0);
    expect(cfg.visual.color).toBe(0x4fc3f7);
  });

  it('spawnUnit accepts the loader output and creates a live entity', () => {
    const docs = loadDocs('units/towers.yaml');
    const arrow = findEntry(docs, 'arrow_tower');
    const cfg = parseUnitConfig(dumpEntry(arrow));
    const world = withVfxStubs(createTowerWorld());
    const eid = spawnUnit(world, cfg, { x: 100, y: 200 });
    expect(Position.x[eid]).toBe(100);
    expect(Position.y[eid]).toBe(200);
    expect(Health.current[eid]).toBe(cfg.stats.hp);
    expect(UnitTag.category[eid]).toBeDefined();
  });
});

describe('real YAML files: units/enemies.yaml -> parseUnitConfig', () => {
  it('loads grunt, runner, heavy with non-zero speed and an onDeath rule chain', () => {
    const docs = loadDocs('units/enemies.yaml');
    for (const id of ['grunt', 'runner', 'heavy']) {
      const raw = findEntry(docs, id);
      expect(raw, `missing enemy ${id}`).toBeDefined();
      const cfg = parseUnitConfig(dumpEntry(raw));
      expect(cfg.id).toBe(id);
      expect(cfg.category).toBe('Enemy');
      expect(cfg.faction).toBe('Enemy');
      expect(cfg.stats.speed).toBeGreaterThan(0);
      expect(cfg.lifecycle?.onDeath?.length).toBeGreaterThan(0);
    }
  });

  it('no remaining ai_tree fields after Wave 4.4 cleanup', () => {
    const text = readFileSync(resolve(CONFIG, 'units/enemies.yaml'), 'utf8');
    expect(text).not.toMatch(/^\s*ai_tree:/m);
  });
});

describe('real YAML files: cards/towers.yaml -> parseCardConfig with idFallback', () => {
  it('reads arrow_tower_card via its YAML key as id fallback', () => {
    const docs = loadDocs('cards/towers.yaml');
    const cardEntry = findEntry(docs, 'arrow_tower_card');
    expect(cardEntry).toBeDefined();
    const cfg = parseCardConfig(dumpEntry(cardEntry), { idFallback: 'arrow_tower_card' });
    expect(cfg.id).toBe('arrow_tower_card');
    expect(cfg.type).toBe('unit');
    expect(cfg.energyCost).toBeGreaterThan(0);
    expect(cfg.unitConfigId).toBe('arrow_tower');
  });
});

describe('real YAML files: levels/level-01.yaml -> parseLevelConfig', () => {
  it('flattens the L1 row-4 horizontal path into 2 waypoints in world coords', () => {
    const text = readFileSync(resolve(CONFIG, 'levels/level-01.yaml'), 'utf8');
    const cfg = parseLevelConfig(text);
    expect(cfg.id).toBe('level_01');
    expect(cfg.tileSize).toBe(64);
    expect(cfg.path.length).toBe(2);
    expect(cfg.path[0]?.y).toBe(4 * 64 + 32);
    expect(cfg.path[1]?.y).toBe(4 * 64 + 32);
    expect(cfg.path[0]?.x).toBeLessThan(cfg.path[1]!.x);
    expect(cfg.crystal).toEqual({ row: 4, col: 20 });
    expect(cfg.waves.length).toBeGreaterThanOrEqual(3);
    expect(cfg.waves[0]?.groups[0]?.enemyId).toBe('grunt');
    expect(cfg.startingGold).toBeGreaterThan(0);
  });
});
