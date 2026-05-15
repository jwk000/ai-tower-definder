import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addComponent } from 'bitecs';
import yaml from 'js-yaml';

import { Game } from '../core/Game.js';
import {
  Crystal,
  Faction,
  FactionTeam,
  Health,
  Position,
  UnitCategory,
  UnitTag,
} from '../core/components.js';
import { parseLevelConfig, parseUnitConfig } from '../config/loader.js';
import { spawnUnit } from '../factories/UnitFactory.js';
import { CardRegistry } from '../unit-system/CardRegistry.js';
import { DeckSystem } from '../unit-system/DeckSystem.js';
import { HandSystem } from '../unit-system/HandSystem.js';
import { EnergySystem } from '../unit-system/EnergySystem.js';
import { RunManager, RunPhase } from '../unit-system/RunManager.js';
import { EconomySystem } from '../systems/EconomySystem.js';
import { createCrystalSystem } from '../systems/CrystalSystem.js';
import { createHealthSystem } from '../systems/HealthSystem.js';
import { createLifecycleSystem } from '../systems/LifecycleSystem.js';
import { createMovementSystem } from '../systems/MovementSystem.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG = resolve(HERE, '..', 'config');

function readFile(rel: string): string {
  return readFileSync(resolve(CONFIG, rel), 'utf8');
}

function extractEntry(rel: string, key: string): string {
  const docs = yaml.loadAll(readFile(rel));
  for (const doc of docs) {
    if (doc && typeof doc === 'object' && key in (doc as Record<string, unknown>)) {
      return yaml.dump((doc as Record<string, unknown>)[key], { lineWidth: -1 });
    }
  }
  throw new Error(`[content-test] entry not found: ${rel}#${key}`);
}

const VFX_STUBS = [
  'leave_ruins',
  'play_effect',
  'play_sound',
  'flash_color',
  'spawn_projectile',
  'spawn_lightning_bolt',
  'spawn_laser_beam',
  'spawn_bat_swarm',
];

function makeRng(seed = 0): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe('Wave 4 content integration: YAML -> full Run with combat', () => {
  it('loads L1 level + grunt enemy + arrow_tower from YAML and runs a complete short Run', () => {
    const level = parseLevelConfig(readFile('levels/level-01.yaml'));
    const grunt = parseUnitConfig(extractEntry('units/enemies.yaml', 'grunt'));
    const arrowTower = parseUnitConfig(extractEntry('units/towers.yaml', 'arrow_tower'));

    expect(level.id).toBe('level_01');
    expect(level.path.length).toBeGreaterThanOrEqual(2);
    expect(grunt.stats.speed).toBeGreaterThan(0);
    expect(arrowTower.stats.range).toBeGreaterThan(0);

    const game = new Game();
    for (const name of VFX_STUBS) game.world.ruleEngine.registerHandler(name, () => {});

    const econ = new EconomySystem();
    game.world.ruleEngine.registerHandler('drop_gold', (_eid, params) => {
      const amount = typeof params?.['amount'] === 'number' ? params['amount'] : 10;
      econ.addGold(amount);
    });

    game.pipeline.register(createMovementSystem({ path: level.path }));
    game.pipeline.register(createCrystalSystem());
    game.pipeline.register(createHealthSystem());
    game.pipeline.register(createLifecycleSystem());

    const registry = new CardRegistry();
    registry.registerUnit(arrowTower);
    const run = new RunManager({ totalLevels: 1 });
    const deck = new DeckSystem({ pool: ['placeholder'], deckSize: 1, rng: makeRng(1) });
    const hand = new HandSystem({ maxSize: 4 });
    const energy = new EnergySystem({ regenPerSecond: 1, max: 10, startWith: 0 });

    run.startRun();
    expect(run.phase).toBe(RunPhase.Battle);

    const crystalEid = game.world.addEntity();
    const crystalAnchor = level.path[level.path.length - 1]!;
    addComponent(game.world, Position, crystalEid);
    Position.x[crystalEid] = crystalAnchor.x;
    Position.y[crystalEid] = crystalAnchor.y;
    addComponent(game.world, Health, crystalEid);
    Health.current[crystalEid] = 3;
    Health.max[crystalEid] = 3;
    addComponent(game.world, Faction, crystalEid);
    Faction.team[crystalEid] = FactionTeam.Player;
    addComponent(game.world, UnitTag, crystalEid);
    UnitTag.category[crystalEid] = UnitCategory.Objective;
    addComponent(game.world, Crystal, crystalEid);
    Crystal.radius[crystalEid] = 60;

    const spawnAt = level.path[0]!;
    for (let i = 0; i < 3; i += 1) {
      spawnUnit(game.world, grunt, { x: spawnAt.x - i * 30, y: spawnAt.y });
    }

    for (let i = 0; i < 1200 && econ.gold < 30; i += 1) {
      game.tick(0.1);
      energy.tick(0.1);
    }

    expect(econ.gold).toBeGreaterThanOrEqual(30);

    run.completeLevel();
    expect(run.phase).toBe(RunPhase.Result);
    expect(run.outcome).toBe('victory');

    econ.grantLevelClearReward(run.currentLevel);
    expect(econ.sp).toBe(2);
  });

  it('loader output drives DeckSystem when a card pool is built from cards/towers.yaml entries', () => {
    const arrowYaml = extractEntry('cards/towers.yaml', 'arrow_tower_card');
    expect(arrowYaml).toContain('unitConfigId: arrow_tower');

    const cannonYaml = extractEntry('cards/towers.yaml', 'cannon_tower_card');
    expect(cannonYaml).toContain('unitConfigId: cannon_tower');

    const deck = new DeckSystem({
      pool: ['arrow_tower_card', 'cannon_tower_card'],
      deckSize: 4,
      rng: makeRng(7),
    });
    const hand = new HandSystem({ maxSize: 4 });
    hand.drawTo(deck);
    expect(hand.size).toBe(4);
    for (const cardId of hand.cards) {
      expect(['arrow_tower_card', 'cannon_tower_card']).toContain(cardId);
    }
  });
});
