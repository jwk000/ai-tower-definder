import { describe, expect, it } from 'vitest';

import {
  parseCardConfig,
  parseLevelConfig,
  parseUnitConfig,
  type LevelConfig,
} from '../loader.js';

describe('parseUnitConfig (YAML -> UnitConfig)', () => {
  it('reads MVP-required fields from a tower YAML doc and ignores unknown extras', () => {
    const yaml = `
id: arrow_tower
name: 箭塔
category: Tower
faction: Player
layer: Ground
stats:
  hp: 100
  atk: 10
  attackSpeed: 1.0
  range: 200
  armor: 0
  mr: 0
  damageType: physical
cost:
  build: 50
  upgrade: [40, 70, 110, 160]
visual:
  shape: rect
  color: "#4fc3f7"
  size: 36
  outline: false
behavior:
  targetSelection: nearest
  attackMode: single_target
  movementMode: hold_position
lifecycle:
  onAttack:
    - { type: spawn_projectile, projectile: arrow }
passives:
  l3:
    id: precise_shot
`;
    const cfg = parseUnitConfig(yaml);
    expect(cfg.id).toBe('arrow_tower');
    expect(cfg.category).toBe('Tower');
    expect(cfg.faction).toBe('Player');
    expect(cfg.stats.hp).toBe(100);
    expect(cfg.stats.atk).toBe(10);
    expect(cfg.stats.attackSpeed).toBe(1);
    expect(cfg.stats.range).toBe(200);
    // tower lacks `speed` field; loader defaults to 0 (towers are stationary).
    expect(cfg.stats.speed).toBe(0);
    expect(cfg.visual.shape).toBe('rect');
    // hex string "#4fc3f7" is normalized to numeric 0x4fc3f7.
    expect(cfg.visual.color).toBe(0x4fc3f7);
    expect(cfg.visual.size).toBe(36);
  });

  it('reads enemy YAML with explicit speed and a lifecycle drop_gold rule', () => {
    const yaml = `
id: grunt
category: Enemy
faction: Enemy
stats:
  hp: 30
  atk: 5
  attackSpeed: 0.5
  range: 10
  speed: 100
visual:
  shape: circle
  color: "#ef5350"
  size: 24
lifecycle:
  onDeath:
    - handler: drop_gold
      params:
        amount: 5
`;
    const cfg = parseUnitConfig(yaml);
    expect(cfg.id).toBe('grunt');
    expect(cfg.category).toBe('Enemy');
    expect(cfg.stats.speed).toBe(100);
    expect(cfg.lifecycle?.onDeath?.[0]?.handler).toBe('drop_gold');
    expect(cfg.lifecycle?.onDeath?.[0]?.params).toEqual({ amount: 5 });
  });

  it('numeric color values pass through unchanged', () => {
    const yaml = `
id: t
category: Tower
faction: Player
stats: { hp: 1, atk: 1, attackSpeed: 1, range: 1 }
visual: { shape: rect, color: 0xff0000, size: 10 }
`;
    const cfg = parseUnitConfig(yaml);
    expect(cfg.visual.color).toBe(0xff0000);
  });

  it('throws when required field is missing', () => {
    const yaml = `
id: bad
faction: Player
stats: { hp: 1, atk: 1, attackSpeed: 1, range: 1 }
visual: { shape: rect, color: 0, size: 10 }
`;
    expect(() => parseUnitConfig(yaml)).toThrow(/category/i);
  });

  it('throws when category is invalid', () => {
    const yaml = `
id: bad
category: Asteroid
faction: Player
stats: { hp: 1, atk: 1, attackSpeed: 1, range: 1 }
visual: { shape: rect, color: 0, size: 10 }
`;
    expect(() => parseUnitConfig(yaml)).toThrow();
  });

  it('throws when stats.hp is negative', () => {
    const yaml = `
id: bad
category: Enemy
faction: Enemy
stats: { hp: -1, atk: 1, attackSpeed: 1, range: 1, speed: 50 }
visual: { shape: rect, color: 0, size: 10 }
`;
    expect(() => parseUnitConfig(yaml)).toThrow();
  });
});

describe('parseCardConfig (YAML -> CardConfig)', () => {
  it('reads a unit card with energyCost + unitConfigId', () => {
    const yaml = `
id: arrow_tower_card
name: 箭塔
type: unit
rarity: common
energyCost: 3
unitConfigId: arrow_tower
placement:
  targetType: tile
`;
    const cfg = parseCardConfig(yaml);
    expect(cfg.id).toBe('arrow_tower_card');
    expect(cfg.type).toBe('unit');
    expect(cfg.energyCost).toBe(3);
    expect(cfg.unitConfigId).toBe('arrow_tower');
  });

  it('reads a spell card with spellEffectId', () => {
    const yaml = `
id: fireball_card
type: spell
energyCost: 4
spellEffectId: deal_aoe_damage
`;
    const cfg = parseCardConfig(yaml);
    expect(cfg.type).toBe('spell');
    expect(cfg.spellEffectId).toBe('deal_aoe_damage');
  });

  it('synthesizes id from YAML key when id field is omitted', () => {
    // existing v3.3 YAML uses YAML keys like `arrow_tower_card:` with no `id:` inside.
    // Loader callers supply the key as `idFallback`.
    const yaml = `
type: unit
energyCost: 3
unitConfigId: arrow_tower
`;
    const cfg = parseCardConfig(yaml, { idFallback: 'arrow_tower_card' });
    expect(cfg.id).toBe('arrow_tower_card');
  });

  it('rejects unknown card type', () => {
    const yaml = `
id: bad
type: cocktail
energyCost: 1
`;
    expect(() => parseCardConfig(yaml)).toThrow();
  });

  it('rejects negative energyCost', () => {
    const yaml = `
id: bad
type: unit
energyCost: -2
unitConfigId: arrow_tower
`;
    expect(() => parseCardConfig(yaml)).toThrow();
  });

  it('drops the v3.3 shop_item type as an MVP simplification (S13)', () => {
    // v3.4 MVP explicitly excludes shop_item from the combat hand (see 48 §3).
    // Loader must reject shop_item so a stray shop card never enters the deck.
    const yaml = `
id: shop_thing
type: shop_item
energyCost: 0
`;
    expect(() => parseCardConfig(yaml)).toThrow(/shop_item|unsupported/i);
  });
});

describe('parseLevelConfig (YAML -> LevelConfig)', () => {
  it('reads the L1 layout and reduces pathGraph to a 2-point straight path', () => {
    const yaml = `
id: level_01
name: 边境绿野
map:
  cols: 21
  rows: 9
  tileSize: 64
  spawns:
    - { id: spawn_0, row: 4, col: 0 }
  pathGraph:
    nodes:
      - { id: n0, row: 4, col: 0, role: spawn, spawnId: spawn_0 }
      - { id: n1, row: 4, col: 20, role: crystal_anchor }
    edges:
      - { from: n0, to: n1 }
waves:
  - waveNumber: 1
    spawnDelay: 2
    enemies:
      - { enemyType: grunt, count: 4, spawnInterval: 1.5 }
  - waveNumber: 2
    spawnDelay: 30
    enemies:
      - { enemyType: grunt, count: 5, spawnInterval: 1.0 }
      - { enemyType: runner, count: 2, spawnInterval: 0.6 }
starting:
  gold: 200
  energy: 50
`;
    const cfg: LevelConfig = parseLevelConfig(yaml);
    expect(cfg.id).toBe('level_01');
    expect(cfg.tileSize).toBe(64);
    // path is expanded from pathGraph; each node becomes one waypoint in world coords.
    expect(cfg.path.length).toBe(2);
    expect(cfg.path[0]).toEqual({ x: 0 * 64 + 32, y: 4 * 64 + 32 });
    expect(cfg.path[1]).toEqual({ x: 20 * 64 + 32, y: 4 * 64 + 32 });
    expect(cfg.crystal).toEqual({ row: 4, col: 20 });

    // waves flattened to a (time, enemyId, interval) schedule. Wave 1 starts at t=2,
    // emits 4 grunts every 1.5s. Wave 2 starts after wave 1 finishes + 30s gap.
    expect(cfg.waves.length).toBe(2);
    expect(cfg.waves[0]).toEqual({
      waveNumber: 1,
      startDelay: 2,
      groups: [{ enemyId: 'grunt', count: 4, interval: 1.5 }],
    });
    expect(cfg.waves[1]?.groups).toEqual([
      { enemyId: 'grunt', count: 5, interval: 1.0 },
      { enemyId: 'runner', count: 2, interval: 0.6 },
    ]);
  });

  it('rejects a level with no waves', () => {
    const yaml = `
id: empty
map:
  cols: 1
  rows: 1
  tileSize: 64
  pathGraph:
    nodes: [{ id: n0, row: 0, col: 0, role: spawn }, { id: n1, row: 0, col: 0, role: crystal_anchor }]
    edges: [{ from: n0, to: n1 }]
waves: []
`;
    expect(() => parseLevelConfig(yaml)).toThrow(/waves/i);
  });

  it('rejects a pathGraph with no crystal_anchor node', () => {
    const yaml = `
id: no_anchor
map:
  cols: 1
  rows: 1
  tileSize: 64
  pathGraph:
    nodes: [{ id: n0, row: 0, col: 0, role: spawn }]
    edges: []
waves:
  - waveNumber: 1
    spawnDelay: 0
    enemies: [{ enemyType: grunt, count: 1, spawnInterval: 1 }]
`;
    expect(() => parseLevelConfig(yaml)).toThrow(/crystal_anchor/i);
  });

  it('parses map.spawns into world coords (x/y projected from row/col + tileSize)', () => {
    const yaml = `
id: spawn_proj
map:
  cols: 10
  rows: 10
  tileSize: 64
  spawns:
    - { id: spawn_0, row: 4, col: 0 }
    - { id: spawn_1, row: 0, col: 9 }
  pathGraph:
    nodes:
      - { id: n0, row: 4, col: 0, role: spawn, spawnId: spawn_0 }
      - { id: n1, row: 4, col: 9, role: crystal_anchor }
    edges:
      - { from: n0, to: n1 }
waves:
  - waveNumber: 1
    spawnDelay: 0
    enemies: [{ enemyType: grunt, count: 1, spawnInterval: 1 }]
available:
  towers: [arrow, cannon]
  units: [militia]
  cards: [arrow_tower_card]
`;
    const cfg = parseLevelConfig(yaml);
    expect(cfg.spawns.length).toBe(2);
    expect(cfg.spawns[0]).toEqual({
      id: 'spawn_0',
      row: 4,
      col: 0,
      x: 0 * 64 + 32,
      y: 4 * 64 + 32,
    });
    expect(cfg.spawns[1]).toEqual({
      id: 'spawn_1',
      row: 0,
      col: 9,
      x: 9 * 64 + 32,
      y: 0 * 64 + 32,
    });
    expect(cfg.available.towers).toEqual(['arrow', 'cannon']);
    expect(cfg.available.units).toEqual(['militia']);
    expect(cfg.available.cards).toEqual(['arrow_tower_card']);
  });

  it('defaults spawns=[] and available={towers:[],units:[],cards:[]} when omitted', () => {
    const yaml = `
id: no_optional
map:
  cols: 2
  rows: 2
  tileSize: 64
  pathGraph:
    nodes:
      - { id: n0, row: 0, col: 0, role: spawn }
      - { id: n1, row: 0, col: 1, role: crystal_anchor }
    edges:
      - { from: n0, to: n1 }
waves:
  - waveNumber: 1
    spawnDelay: 0
    enemies: [{ enemyType: grunt, count: 1, spawnInterval: 1 }]
`;
    const cfg = parseLevelConfig(yaml);
    expect(cfg.spawns).toEqual([]);
    expect(cfg.available).toEqual({ towers: [], units: [], cards: [] });
  });
});
