import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import type { PathGraph, SpawnPoint } from '../../level/graph/types.js';

export interface WaveEnemyGroup {
  enemyType: string;
  count: number;
  spawnInterval: number;
  spawnId?: string;
}

export interface WaveSpec {
  waveNumber: number;
  spawnDelay: number;
  isBossWave?: boolean;
  enemies: WaveEnemyGroup[];
  specialRules?: unknown;
  __extras?: Record<string, unknown>;
}

export type TileCell = string | number;

export interface MapModel {
  cols: number;
  rows: number;
  tileSize: number;
  tiles: TileCell[][];
  tileColors?: Record<string, string>;
  obstacles?: Array<Record<string, unknown>>;
  spawns?: SpawnPoint[];
  pathGraph?: PathGraph;
  __extras?: Record<string, unknown>;
}

export interface StartingResources {
  gold?: number;
  energy?: number;
  maxPopulation?: number;
}

export interface AvailableContent {
  towers: string[];
  units: string[];
}

export interface WeatherSection {
  pool: string[];
  initial: string;
  changeInterval?: number;
}

export interface LevelFormModel {
  id: string;
  name: string;
  theme?: string;
  description?: string;
  sceneDescription?: string;
  map: MapModel;
  waves: WaveSpec[];
  starting?: StartingResources;
  available?: AvailableContent;
  weather?: WeatherSection;
  banPool?: string[] | null;
  neutralPool?: string[] | null;
  __extras?: Record<string, unknown>;
  __wrapped?: boolean;
}

const TOP_LEVEL_FIELD_ORDER: Array<keyof LevelFormModel> = [
  'id',
  'name',
  'theme',
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

const MAP_FIELD_ORDER: Array<keyof MapModel> = [
  'cols',
  'rows',
  'tileSize',
  'tiles',
  'tileColors',
  'obstacles',
  'spawns',
  'pathGraph',
];

const KNOWN_TOP_LEVEL_KEYS = new Set<string>([
  'id',
  'name',
  'theme',
  'description',
  'sceneDescription',
  'map',
  'waves',
  'starting',
  'available',
  'weather',
  'banPool',
  'neutralPool',
]);

const KNOWN_MAP_KEYS = new Set<string>([
  'cols',
  'rows',
  'tileSize',
  'tiles',
  'tileColors',
  'obstacles',
  'spawns',
  'pathGraph',
]);

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.every((x) => typeof x === 'string') ? (v as string[]) : undefined;
}

function asTiles(v: unknown): TileCell[][] {
  if (!Array.isArray(v)) return [];
  const rows: TileCell[][] = [];
  for (const row of v) {
    if (Array.isArray(row)) {
      const cells: TileCell[] = [];
      for (const c of row) {
        if (typeof c === 'string' || typeof c === 'number') cells.push(c);
      }
      rows.push(cells);
    } else {
      rows.push([]);
    }
  }
  return rows;
}

function parseMap(raw: unknown): MapModel {
  const rec = asRecord(raw);
  if (!rec) {
    return { cols: 0, rows: 0, tileSize: 64, tiles: [] };
  }
  const map: MapModel = {
    cols: typeof rec.cols === 'number' ? rec.cols : 0,
    rows: typeof rec.rows === 'number' ? rec.rows : 0,
    tileSize: typeof rec.tileSize === 'number' ? rec.tileSize : 64,
    tiles: asTiles(rec.tiles),
  };
  if (rec.tileColors !== undefined) map.tileColors = rec.tileColors as Record<string, string>;
  if (rec.obstacles !== undefined) map.obstacles = rec.obstacles as Array<Record<string, unknown>>;
  if (rec.spawns !== undefined) map.spawns = rec.spawns as SpawnPoint[];
  if (rec.pathGraph !== undefined) map.pathGraph = rec.pathGraph as PathGraph;

  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (!KNOWN_MAP_KEYS.has(k)) extras[k] = v;
  }
  if (Object.keys(extras).length > 0) map.__extras = extras;
  return map;
}

const KNOWN_WAVE_KEYS = new Set<string>([
  'waveNumber',
  'spawnDelay',
  'isBossWave',
  'enemies',
  'specialRules',
]);

function parseWaves(raw: unknown): WaveSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((w) => {
    const rec = asRecord(w) ?? {};
    const enemiesRaw = Array.isArray(rec.enemies) ? rec.enemies : [];
    const enemies: WaveEnemyGroup[] = enemiesRaw.map((e) => {
      const er = asRecord(e) ?? {};
      const group: WaveEnemyGroup = {
        enemyType: typeof er.enemyType === 'string' ? er.enemyType : '',
        count: typeof er.count === 'number' ? er.count : 0,
        spawnInterval: typeof er.spawnInterval === 'number' ? er.spawnInterval : 0,
      };
      if (typeof er.spawnId === 'string') group.spawnId = er.spawnId;
      return group;
    });
    const wave: WaveSpec = {
      waveNumber: typeof rec.waveNumber === 'number' ? rec.waveNumber : 0,
      spawnDelay: typeof rec.spawnDelay === 'number' ? rec.spawnDelay : 0,
      enemies,
    };
    if (rec.isBossWave === true) wave.isBossWave = true;
    if (rec.specialRules !== undefined) wave.specialRules = rec.specialRules;

    const extras: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (!KNOWN_WAVE_KEYS.has(k)) extras[k] = v;
    }
    if (Object.keys(extras).length > 0) wave.__extras = extras;

    return wave;
  });
}

export function parseYamlToModel(yaml: string): LevelFormModel {
  const parsed = yamlLoad(yaml);
  const rawRoot = asRecord(parsed);
  if (!rawRoot) {
    throw new Error('[levelModel] YAML root must be a mapping');
  }

  let root = rawRoot;
  let wrapperId: string | null = null;
  const topKeys = Object.keys(rawRoot);
  const looksWrapped =
    topKeys.length === 1 &&
    !KNOWN_TOP_LEVEL_KEYS.has(topKeys[0]!) &&
    asRecord(rawRoot[topKeys[0]!]) !== null;
  if (looksWrapped) {
    wrapperId = topKeys[0]!;
    root = asRecord(rawRoot[wrapperId])!;
  }

  const model: LevelFormModel = {
    id: wrapperId ?? (typeof root.id === 'string' ? root.id : ''),
    name: typeof root.name === 'string' ? root.name : '',
    map: parseMap(root.map),
    waves: parseWaves(root.waves),
  };
  if (typeof root.theme === 'string') model.theme = root.theme;
  if (typeof root.description === 'string') model.description = root.description;
  if (typeof root.sceneDescription === 'string') model.sceneDescription = root.sceneDescription;

  const starting = asRecord(root.starting);
  if (starting) {
    const s: StartingResources = {};
    if (typeof starting.gold === 'number') s.gold = starting.gold;
    if (typeof starting.energy === 'number') s.energy = starting.energy;
    if (typeof starting.maxPopulation === 'number') s.maxPopulation = starting.maxPopulation;
    model.starting = s;
  }

  const available = asRecord(root.available);
  if (available) {
    model.available = {
      towers: asStringArray(available.towers) ?? [],
      units: asStringArray(available.units) ?? [],
    };
  }

  const weather = asRecord(root.weather);
  if (weather) {
    const w: WeatherSection = {
      pool: asStringArray(weather.pool) ?? [],
      initial: typeof weather.initial === 'string' ? weather.initial : 'random_from_pool',
    };
    if (typeof weather.changeInterval === 'number') w.changeInterval = weather.changeInterval;
    model.weather = w;
  }

  if ('banPool' in root) {
    model.banPool = root.banPool === null ? null : (asStringArray(root.banPool) ?? null);
  }
  if ('neutralPool' in root) {
    model.neutralPool = root.neutralPool === null ? null : (asStringArray(root.neutralPool) ?? null);
  }

  const extras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(root)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(k)) extras[k] = v;
  }
  if (Object.keys(extras).length > 0) model.__extras = extras;
  if (wrapperId !== null) model.__wrapped = true;

  return model;
}

function buildOrderedRecord<T extends Record<string, unknown>>(
  source: T,
  order: readonly (keyof T)[],
  extras: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of order) {
    const value = source[key];
    if (value === undefined) continue;
    out[key as string] = value;
  }
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      out[k] = v;
    }
  }
  return out;
}

function serializeMap(map: MapModel): Record<string, unknown> {
  return buildOrderedRecord(map as unknown as Record<string, unknown>, MAP_FIELD_ORDER as readonly string[], map.__extras);
}

const WAVE_FIELD_ORDER: readonly string[] = [
  'waveNumber',
  'spawnDelay',
  'isBossWave',
  'enemies',
  'specialRules',
];

function serializeWave(wave: WaveSpec): Record<string, unknown> {
  return buildOrderedRecord(wave as unknown as Record<string, unknown>, WAVE_FIELD_ORDER, wave.__extras);
}

export function serializeModelToYaml(model: LevelFormModel): string {
  const inner: Record<string, unknown> = {};
  for (const key of TOP_LEVEL_FIELD_ORDER) {
    if (key === 'id' && model.__wrapped) continue;
    if (key === 'map') {
      inner.map = serializeMap(model.map);
      continue;
    }
    if (key === 'waves') {
      inner.waves = model.waves.map(serializeWave);
      continue;
    }
    const value = model[key];
    if (value === undefined) continue;
    inner[key as string] = value;
  }
  if (model.__extras) {
    for (const [k, v] of Object.entries(model.__extras)) {
      inner[k] = v;
    }
  }

  const root = model.__wrapped ? { [model.id]: inner } : inner;

  return yamlDump(root, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
}
