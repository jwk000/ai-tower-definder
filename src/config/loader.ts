import yaml from 'js-yaml';
import { z } from 'zod';

import type { UnitConfig } from '../factories/UnitFactory.js';
import type { CardConfig } from '../unit-system/CardRegistry.js';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeColor(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && HEX_RE.test(raw)) {
    const hex = raw.slice(1);
    const full = hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;
    return parseInt(full, 16);
  }
  throw new Error(`[loader] invalid color value: ${JSON.stringify(raw)}`);
}

const StatsSchema = z
  .object({
    hp: z.number().nonnegative(),
    atk: z.number().nonnegative(),
    attackSpeed: z.number().nonnegative(),
    range: z.number().nonnegative().optional(),
    speed: z.number().nonnegative().optional(),
  })
  .passthrough();

const VisualSchema = z
  .object({
    shape: z.enum(['rect', 'circle', 'triangle']),
    color: z.union([z.number(), z.string()]),
    size: z.number().positive(),
  })
  .passthrough();

const RuleSchema = z
  .object({
    handler: z.string().optional(),
    type: z.string().optional(),
    params: z.record(z.unknown()).optional(),
  })
  .passthrough()
  .transform((raw) => {
    const handler = raw.handler ?? raw.type;
    if (!handler) {
      throw new Error('[loader] lifecycle rule must have `handler` or `type` field');
    }
    const { handler: _h, type: _t, params, ...extras } = raw as Record<string, unknown>;
    const mergedParams = { ...(params ?? {}), ...extras };
    return Object.keys(mergedParams).length > 0
      ? { handler, params: mergedParams }
      : { handler };
  });

const LifecycleSchema = z
  .object({
    onCreate: z.array(RuleSchema).optional(),
    onDeath: z.array(RuleSchema).optional(),
    onHit: z.array(RuleSchema).optional(),
    onAttack: z.array(RuleSchema).optional(),
    onKill: z.array(RuleSchema).optional(),
    onUpgrade: z.array(RuleSchema).optional(),
    onDestroy: z.array(RuleSchema).optional(),
    onEnter: z.array(RuleSchema).optional(),
    onLeave: z.array(RuleSchema).optional(),
  })
  .passthrough();

const UnitDocSchema = z
  .object({
    id: z.string(),
    category: z.enum(['Tower', 'Soldier', 'Enemy', 'Building', 'Trap', 'Neutral', 'Objective']),
    faction: z.enum(['Player', 'Enemy', 'Neutral']),
    stats: StatsSchema,
    visual: VisualSchema,
    lifecycle: LifecycleSchema.optional(),
  })
  .passthrough();

export function parseUnitConfig(yamlText: string): UnitConfig {
  const doc = yaml.load(yamlText);
  const parsed = UnitDocSchema.parse(doc);
  const lifecycle = parsed.lifecycle
    ? Object.fromEntries(
        Object.entries(parsed.lifecycle).filter(([, v]) => Array.isArray(v)),
      )
    : undefined;
  return {
    id: parsed.id,
    category: parsed.category,
    faction: parsed.faction,
    stats: {
      hp: parsed.stats.hp,
      atk: parsed.stats.atk,
      attackSpeed: parsed.stats.attackSpeed,
      range: parsed.stats.range ?? 0,
      speed: parsed.stats.speed ?? 0,
    },
    visual: {
      shape: parsed.visual.shape,
      color: normalizeColor(parsed.visual.color),
      size: parsed.visual.size,
    },
    ...(lifecycle ? { lifecycle: lifecycle as UnitConfig['lifecycle'] } : {}),
  };
}

const CardDocSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(['unit', 'spell', 'trap', 'production']),
    energyCost: z.number().nonnegative(),
    unitConfigId: z.string().optional(),
    spellEffectId: z.string().optional(),
  })
  .passthrough();

export interface ParseCardOptions {
  idFallback?: string;
}

export function parseCardConfig(yamlText: string, opts: ParseCardOptions = {}): CardConfig {
  const doc = yaml.load(yamlText) as Record<string, unknown> | null | undefined;
  if (doc && typeof doc === 'object' && 'type' in doc && (doc as { type: unknown }).type === 'shop_item') {
    throw new Error('[loader] unsupported card type: shop_item (MVP excludes shop cards from combat hand, see 48 §3)');
  }
  const parsed = CardDocSchema.parse(doc);
  const id = parsed.id ?? opts.idFallback;
  if (!id) {
    throw new Error('[loader] card YAML must have `id` field or caller must pass { idFallback }');
  }
  const card: CardConfig = {
    id,
    type: parsed.type,
    energyCost: parsed.energyCost,
    ...(parsed.unitConfigId ? { unitConfigId: parsed.unitConfigId } : {}),
    ...(parsed.spellEffectId ? { spellEffectId: parsed.spellEffectId } : {}),
  };
  return card;
}

const PathNodeSchema = z
  .object({
    id: z.string(),
    row: z.number().int().nonnegative(),
    col: z.number().int().nonnegative(),
    role: z.enum(['spawn', 'crystal_anchor', 'waypoint']).optional(),
    spawnId: z.string().optional(),
  })
  .passthrough();

const WaveGroupSchema = z
  .object({
    enemyType: z.string(),
    count: z.number().int().positive(),
    spawnInterval: z.number().nonnegative(),
  })
  .passthrough();

const WaveSchema = z
  .object({
    waveNumber: z.number().int().positive(),
    spawnDelay: z.number().nonnegative(),
    enemies: z.array(WaveGroupSchema).min(1),
  })
  .passthrough();

const LevelDocSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    map: z
      .object({
        cols: z.number().int().positive(),
        rows: z.number().int().positive(),
        tileSize: z.number().positive(),
        pathGraph: z
          .object({
            nodes: z.array(PathNodeSchema).min(1),
            edges: z.array(z.object({ from: z.string(), to: z.string() }).passthrough()),
          })
          .passthrough(),
      })
      .passthrough(),
    waves: z.array(WaveSchema).min(1, '[loader] level YAML must define at least 1 wave'),
    starting: z.object({ gold: z.number().nonnegative(), energy: z.number().nonnegative() }).passthrough().optional(),
  })
  .passthrough();

export interface LevelWaveGroup {
  readonly enemyId: string;
  readonly count: number;
  readonly interval: number;
}

export interface LevelWave {
  readonly waveNumber: number;
  readonly startDelay: number;
  readonly groups: LevelWaveGroup[];
}

export interface LevelConfig {
  readonly id: string;
  readonly name?: string;
  readonly tileSize: number;
  readonly path: Array<{ x: number; y: number }>;
  readonly crystal: { row: number; col: number };
  readonly waves: LevelWave[];
  readonly startingGold?: number;
  readonly startingEnergy?: number;
}

export function parseLevelConfig(yamlText: string): LevelConfig {
  const doc = yaml.load(yamlText);
  const parsed = LevelDocSchema.parse(doc);
  const tileSize = parsed.map.tileSize;
  const nodesById = new Map(parsed.map.pathGraph.nodes.map((n) => [n.id, n]));
  const anchor = parsed.map.pathGraph.nodes.find((n) => n.role === 'crystal_anchor');
  if (!anchor) {
    throw new Error('[loader] level pathGraph must contain a node with role=crystal_anchor');
  }
  const spawnNode = parsed.map.pathGraph.nodes.find((n) => n.role === 'spawn') ?? parsed.map.pathGraph.nodes[0]!;
  const ordered = orderPath(parsed.map.pathGraph.edges, spawnNode.id, anchor.id, nodesById);
  const path = ordered.map((n) => ({
    x: n.col * tileSize + tileSize / 2,
    y: n.row * tileSize + tileSize / 2,
  }));
  const waves: LevelWave[] = parsed.waves.map((w) => ({
    waveNumber: w.waveNumber,
    startDelay: w.spawnDelay,
    groups: w.enemies.map((g) => ({ enemyId: g.enemyType, count: g.count, interval: g.spawnInterval })),
  }));
  return {
    id: parsed.id,
    ...(parsed.name ? { name: parsed.name } : {}),
    tileSize,
    path,
    crystal: { row: anchor.row, col: anchor.col },
    waves,
    ...(parsed.starting?.gold !== undefined ? { startingGold: parsed.starting.gold } : {}),
    ...(parsed.starting?.energy !== undefined ? { startingEnergy: parsed.starting.energy } : {}),
  };
}

function orderPath(
  edges: Array<{ from: string; to: string }>,
  startId: string,
  endId: string,
  nodes: Map<string, z.infer<typeof PathNodeSchema>>,
): Array<z.infer<typeof PathNodeSchema>> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const path: Array<z.infer<typeof PathNodeSchema>> = [];
  const visited = new Set<string>();
  let cur: string | undefined = startId;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    const node = nodes.get(cur);
    if (!node) break;
    path.push(node);
    if (cur === endId) return path;
    cur = adj.get(cur)?.[0];
  }
  if (path.length === 0 || path[path.length - 1]!.id !== endId) {
    const startNode = nodes.get(startId);
    const endNode = nodes.get(endId);
    if (startNode && endNode) return [startNode, endNode];
  }
  return path;
}
